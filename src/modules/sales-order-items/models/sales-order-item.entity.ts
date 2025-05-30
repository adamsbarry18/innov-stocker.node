import { Model } from '@/common/models/Model';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Product } from '@/modules/products/models/product.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';

export const createSalesOrderItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
});

export const updateSalesOrderItemSchema = createSalesOrderItemSchema
  .partial()
  .omit({ productId: true, productVariantId: true });

export type CreateSalesOrderItemInput = z.infer<typeof createSalesOrderItemSchema>;
export type UpdateSalesOrderItemInput = z.infer<typeof updateSalesOrderItemSchema>;

export type SalesOrderItemApiResponse = {
  id: number;
  salesOrderId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  description: string | null;
  quantity: number;
  unitPriceHt: number;
  discountPercentage: number;
  vatRatePercentage: number | null;
  totalLineAmountHt: number; // Calculated
  quantityShipped: number;
  quantityInvoiced: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export const salesOrderItemValidationInputErrors: string[] = [];

@Entity({ name: 'sales_order_items' })
export class SalesOrderItem extends Model {
  @Column({ type: 'int', name: 'sales_order_id' })
  salesOrderId!: number;

  @ManyToOne(() => SalesOrder, (so) => so.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder!: SalesOrder;

  @Column({ type: 'int', name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'int', name: 'product_variant_id', nullable: true })
  productVariantId: number | null = null;

  @ManyToOne(() => ProductVariant, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant: ProductVariant | null = null;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'unit_price_ht' })
  unitPriceHt!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0, name: 'discount_percentage' })
  discountPercentage: number = 0;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'vat_rate_percentage' })
  vatRatePercentage: number | null = null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'total_line_amount_ht',
    generatedType: 'STORED',
    asExpression: '`quantity` * `unit_price_ht` * (1 - `discount_percentage` / 100.0)',
    insert: false,
    update: false,
  })
  readonly totalLineAmountHt!: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0.0, name: 'quantity_shipped' })
  quantityShipped: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0.0, name: 'quantity_invoiced' })
  quantityInvoiced: number = 0;

  toApi(): SalesOrderItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      salesOrderId: this.salesOrderId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      description: this.description || this.productVariant?.nameVariant || this.product?.name,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      discountPercentage: Number(this.discountPercentage),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
      totalLineAmountHt: Number(this.totalLineAmountHt), // From DB generated column
      quantityShipped: Number(this.quantityShipped),
      quantityInvoiced: Number(this.quantityInvoiced),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      productId: this.productId,
      productVariantId: this.productVariantId,
      description: this.description,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      discountPercentage: Number(this.discountPercentage),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
    };
    const result = createSalesOrderItemSchema.partial().safeParse(dataToValidate);
    salesOrderItemValidationInputErrors.length = 0;
    if (!result.success) {
      salesOrderItemValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `Item(${this.productId || 'new'}): ${issue.path.join('.')}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.quantity !== undefined && this.quantity <= 0) {
      salesOrderItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (this.unitPriceHt !== undefined && this.unitPriceHt < 0) {
      salesOrderItemValidationInputErrors.push('Unit price cannot be negative.');
      return false;
    }
    return true;
  }
}
