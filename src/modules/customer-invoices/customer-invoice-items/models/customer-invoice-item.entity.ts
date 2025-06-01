import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import logger from '@/lib/logger';
import { CustomerInvoice } from '../../models/customer-invoice.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { SalesOrderItem } from '@/modules/sales-orders/sales-order-items/models/sales-order-item.entity';
import { DeliveryItem } from '@/modules/deliveries/delivery-items/models/delivery-item.entity';

export const createCustomerInvoiceItemSchema = z.object({
  productId: z.number().int().positive(),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z
    .string()
    .min(1, 'Description is required if product not specified, or to override.')
    .nullable()
    .optional(),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
  salesOrderItemId: z.number().int().positive().nullable().optional(),
  deliveryItemId: z.number().int().positive().nullable().optional(),
});

export const updateCustomerInvoiceItemSchema = createCustomerInvoiceItemSchema.partial().omit({
  productId: true, // Usually fixed once invoiced
  productVariantId: true,
  salesOrderItemId: true,
  deliveryItemId: true,
});

export type CreateCustomerInvoiceItemInput = z.infer<typeof createCustomerInvoiceItemSchema>;
export type UpdateCustomerInvoiceItemInput = z.infer<typeof updateCustomerInvoiceItemSchema>;

export type CustomerInvoiceItemApiResponse = {
  id: number;
  customerInvoiceId: number;
  productId: number | null;
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
  totalLineAmountHt: number;
  salesOrderItemId: number | null;
  deliveryItemId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerInvoiceItemValidationInputErrors: string[] = [];

@Entity({ name: 'customer_invoice_items' })
@Index(
  ['customerInvoiceId', 'productId', 'productVariantId', 'salesOrderItemId', 'deliveryItemId'],
  { unique: true, where: `"deleted_time" IS NULL` },
) // Prevent duplicate lines for the same source item
export class CustomerInvoiceItem extends Model {
  @Column({ type: 'int', name: 'customer_invoice_id' })
  customerInvoiceId!: number;

  @ManyToOne(() => CustomerInvoice, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'customer_invoice_id' })
  customerInvoice!: CustomerInvoice;

  @Column({ type: 'int', name: 'product_id', nullable: true }) // Nullable for service/manual lines
  productId: number | null = null;

  @ManyToOne(() => Product, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null = null;

  @Column({ type: 'int', name: 'product_variant_id', nullable: true })
  productVariantId: number | null = null;

  @ManyToOne(() => ProductVariant, { eager: true, onDelete: 'SET NULL', nullable: true })
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
  })
  totalLineAmountHt!: number;

  @Column({ type: 'bigint', name: 'sales_order_item_id', nullable: true })
  salesOrderItemId: number | null = null;

  @ManyToOne(() => SalesOrderItem, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'sales_order_item_id' })
  salesOrderItem?: SalesOrderItem | null;

  @Column({ type: 'bigint', name: 'delivery_item_id', nullable: true })
  deliveryItemId: number | null = null;

  @ManyToOne(() => DeliveryItem, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'delivery_item_id' })
  deliveryItem?: DeliveryItem | null;

  calculateTotalLineAmountHt(): number {
    const priceAfterDiscount =
      Number(this.unitPriceHt) * (1 - (Number(this.discountPercentage) || 0) / 100);
    return parseFloat((Number(this.quantity) * priceAfterDiscount).toFixed(4));
  }

  toApi(): CustomerInvoiceItemApiResponse {
    const base = super.toApi();
    const calculatedTotal =
      this.totalLineAmountHt !== undefined
        ? Number(this.totalLineAmountHt)
        : this.calculateTotalLineAmountHt();
    return {
      ...base,
      id: this.id,
      customerInvoiceId: this.customerInvoiceId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      description: this.description,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      discountPercentage: Number(this.discountPercentage),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
      totalLineAmountHt: calculatedTotal,
      salesOrderItemId: this.salesOrderItemId,
      deliveryItemId: this.deliveryItemId,
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
      vatRatePercentage: this.vatRatePercentage,
      salesOrderItemId: this.salesOrderItemId,
      deliveryItemId: this.deliveryItemId,
    };
    const result = createCustomerInvoiceItemSchema.safeParse(dataToValidate);
    customerInvoiceItemValidationInputErrors.length = 0;
    if (!result.success) {
      customerInvoiceItemValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) =>
            `Item(ProdID:${this.productId || 'N/A'}): ${issue.path.join('.')}: ${issue.message}`,
        ),
      );
      logger.warn({
        message: 'CustomerInvoiceItem entity basic validation failed',
        errors: customerInvoiceItemValidationInputErrors,
        data: dataToValidate,
      });
      return false;
    }
    if (!this.description || this.description.trim() === '') {
      customerInvoiceItemValidationInputErrors.push('Description is required.');
      return false;
    }
    if (this.quantity !== undefined && this.quantity <= 0) {
      customerInvoiceItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (this.unitPriceHt !== undefined && this.unitPriceHt < 0) {
      customerInvoiceItemValidationInputErrors.push('Unit price cannot be negative.');
      return false;
    }
    return true;
  }
}
