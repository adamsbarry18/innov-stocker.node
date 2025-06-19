import { Model } from '@/common/models/Model';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { SupplierReturn } from '../../models/supplier-return.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions/purchase-reception-items/models/purchase-reception-item.entity';

export const createSupplierReturnItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity returned must be positive.' }),
  unitPriceAtReturn: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe('Original purchase price, for credit calculation context.'),
  purchaseReceptionItemId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe('ID of the Purchase Reception Item being returned, for traceability.'),
});

export const updateSupplierReturnItemSchema = createSupplierReturnItemSchema.partial().omit({
  productId: true,
  productVariantId: true,
  purchaseReceptionItemId: true,
});

export type CreateSupplierReturnItemInput = z.infer<typeof createSupplierReturnItemSchema>;
export type UpdateSupplierReturnItemInput = z.infer<typeof updateSupplierReturnItemSchema>;

export type SupplierReturnItemApiResponse = {
  id: number;
  supplierReturnId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  quantity: number;
  quantityShipped: number;
  quantityReceived: number;
  unitPriceAtReturn: number | null;
  purchaseReceptionItemId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const supplierReturnItemValidationInputErrors: string[] = [];

@Entity({ name: 'supplier_return_items' })
@Index(['supplierReturnId'])
export class SupplierReturnItem extends Model {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id!: number;

  @Column({ type: 'int', name: 'supplier_return_id' })
  supplierReturnId!: number;

  @ManyToOne(() => SupplierReturn, (sr) => sr.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'supplier_return_id' })
  supplierReturn!: SupplierReturn;

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

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_shipped', default: 0 })
  quantityShipped!: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_received', default: 0 })
  quantityReceived!: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'unit_price_at_return',
    nullable: true,
  })
  unitPriceAtReturn: number | null = null;

  @Column({ type: 'bigint', name: 'purchase_reception_item_id', nullable: true })
  purchaseReceptionItemId: number | null = null;

  @ManyToOne(() => PurchaseReceptionItem, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'purchase_reception_item_id' })
  purchaseReceptionItem?: PurchaseReceptionItem | null;

  toApi(): SupplierReturnItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      supplierReturnId: this.supplierReturnId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      quantity: Number(this.quantity),
      quantityShipped: Number(this.quantityShipped),
      quantityReceived: Number(this.quantityReceived),
      unitPriceAtReturn: this.unitPriceAtReturn !== null ? Number(this.unitPriceAtReturn) : null,
      purchaseReceptionItemId: this.purchaseReceptionItemId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    supplierReturnItemValidationInputErrors.length = 0;
    if (this.quantity === undefined || this.quantity <= 0) {
      supplierReturnItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    return true;
  }
}
