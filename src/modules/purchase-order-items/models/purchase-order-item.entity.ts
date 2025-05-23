import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Product } from '../../products/models/product.entity';
import logger from '@/lib/logger';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';

export const createPurchaseOrderItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
});

// Removed discountPercentage
export const updatePurchaseOrderItemSchema = createPurchaseOrderItemSchema
  .partial()
  .omit({ productId: true, productVariantId: true });

export type CreatePurchaseOrderItemInput = z.infer<typeof createPurchaseOrderItemSchema>;
export type UpdatePurchaseOrderItemInput = z.infer<typeof updatePurchaseOrderItemSchema>;

export type PurchaseOrderItemApiResponse = {
  id: number;
  purchaseOrderId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string | null;
  productVariantName?: string | null;
  description: string | null;
  quantity: number;
  unitPriceHt: number;
  vatRatePercentage: number | null;
  totalLineAmountHt: number; // Calculated by DB
  quantityReceived: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export const purchaseOrderItemValidationInputErrors: string[] = [];

@Entity({ name: 'purchase_order_items' })
export class PurchaseOrderItem extends Model {
  @Column({ type: 'int', name: 'purchase_order_id' })
  purchaseOrderId!: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

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

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'vat_rate_percentage' })
  vatRatePercentage: number | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0.0, name: 'quantity_received' })
  quantityReceived: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_line_amount_ht', default: 0.0 })
  totalLineAmountHt!: number; // Now managed by application

  toApi(): PurchaseOrderItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      purchaseOrderId: this.purchaseOrderId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      description: this.description || this.productVariant?.nameVariant || this.product?.name,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
      totalLineAmountHt: Number(this.totalLineAmountHt),
      quantityReceived: Number(this.quantityReceived),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      productId: this.productId,
      productVariantId: this.productVariantId,
      description: this.description,
      quantity: Number(this.quantity), // Ensure quantity is a number
      unitPriceHt: Number(this.unitPriceHt), // Ensure unitPriceHt is a number
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null, // Ensure vatRatePercentage is a number or null
    };
    const result = createPurchaseOrderItemSchema.partial().safeParse(dataToValidate);
    purchaseOrderItemValidationInputErrors.length = 0;
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `Item(${this.productId || 'new'}): ${issue.path.join('.')}: ${issue.message}`,
      );
      purchaseOrderItemValidationInputErrors.push(...errors);
      logger.warn({
        message: 'PurchaseOrderItem entity basic validation failed',
        errors: purchaseOrderItemValidationInputErrors,
        data: dataToValidate,
      });
      return false;
    }
    if (this.quantity !== undefined && this.quantity <= 0) {
      purchaseOrderItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (this.unitPriceHt !== undefined && this.unitPriceHt < 0) {
      purchaseOrderItemValidationInputErrors.push('Unit price cannot be negative.');
      return false;
    }
    return true;
  }
}
