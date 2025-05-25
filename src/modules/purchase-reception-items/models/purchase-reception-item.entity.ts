import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { PurchaseOrderItem } from '@/modules/purchase-order-items/models/purchase-order-item.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { PurchaseReception } from '@/modules/purchase-receptions/models/purchase-reception.entity';

// Zod Schema for validation of input DTOs
export const createPurchaseReceptionItemSchema = z.object({
  purchaseOrderItemId: z.number().int().positive().nullable().optional(),
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  quantityOrdered: z.number().min(0).nullable().optional(),
  quantityReceived: z.number().min(0, { message: 'Quantity received must be non-negative.' }),
  lotNumber: z.string().max(100).nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updatePurchaseReceptionItemSchema = createPurchaseReceptionItemSchema.partial().omit({
  productId: true,
  productVariantId: true,
  purchaseOrderItemId: true,
});

export type CreatePurchaseReceptionItemInput = z.infer<typeof createPurchaseReceptionItemSchema>;
export type UpdatePurchaseReceptionItemInput = z.infer<typeof updatePurchaseReceptionItemSchema>;

export type PurchaseReceptionItemApiResponse = {
  id: number;
  purchaseReceptionId: number;
  purchaseOrderItemId: number | null;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  quantityOrdered: number | null;
  quantityReceived: number;
  lotNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const purchaseReceptionItemValidationInputErrors: string[] = [];

@Entity({ name: 'purchase_reception_items' })
@Index(['purchaseReceptionId', 'productId', 'productVariantId', 'purchaseOrderItemId'], {
  unique: true,
  where: `"deleted_time" IS NULL`,
}) // Prevent duplicate product line from same PO line
export class PurchaseReceptionItem extends Model {
  @Column({ type: 'int', name: 'purchase_reception_id' })
  purchaseReceptionId!: number;

  @ManyToOne(() => PurchaseReception, (pr) => pr.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'purchase_reception_id' })
  purchaseReception!: PurchaseReception;

  @Column({ type: 'bigint', name: 'purchase_order_item_id', nullable: true })
  purchaseOrderItemId: number | null = null;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem?: PurchaseOrderItem | null;

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

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_ordered', nullable: true })
  quantityOrdered: number | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_received' })
  quantityReceived!: number;

  @Column({ type: 'varchar', length: 100, name: 'lot_number', nullable: true })
  lotNumber: string | null = null;

  @Column({ type: 'date', name: 'expiry_date', nullable: true })
  expiryDate: Date | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  toApi(): PurchaseReceptionItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      purchaseReceptionId: this.purchaseReceptionId,
      purchaseOrderItemId: this.purchaseOrderItemId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      quantityOrdered: this.quantityOrdered !== null ? Number(this.quantityOrdered) : null,
      quantityReceived: Number(this.quantityReceived),
      lotNumber: this.lotNumber,
      expiryDate: Model.formatISODate(this.expiryDate), // formatISODate handles null
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      purchaseOrderItemId: this.purchaseOrderItemId,
      productId: this.productId,
      productVariantId: this.productVariantId,
      quantityOrdered: this.quantityOrdered,
      quantityReceived: this.quantityReceived,
      lotNumber: this.lotNumber,
      expiryDate: this.expiryDate,
      notes: this.notes,
    };
    const result = createPurchaseReceptionItemSchema.safeParse(dataToValidate);
    purchaseReceptionItemValidationInputErrors.length = 0;
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
      );
      purchaseReceptionItemValidationInputErrors.push(...errors);
      return false;
    }
    return true;
  }
}
