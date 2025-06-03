import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { StockTransfer } from '../../models/stock-transfer.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';

export const createStockTransferItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  quantityRequested: z.number().min(0.001, { message: 'Requested quantity must be positive.' }),
});

export const updateStockTransferItemSchema = z.object({
  quantityRequested: z
    .number()
    .min(0.001, { message: 'Requested quantity must be positive.' })
    .optional(),
  quantityShipped: z.number().min(0).optional(),
  quantityReceived: z.number().min(0).optional(),
});

export type CreateStockTransferItemInput = z.infer<typeof createStockTransferItemSchema>;
export type UpdateStockTransferItemInput = z.infer<typeof updateStockTransferItemSchema>;

export type StockTransferItemApiResponse = {
  id: number;
  stockTransferId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export const stockTransferItemValidationInputErrors: string[] = [];

@Entity({ name: 'stock_transfer_items' })
@Index(['stockTransferId'])
export class StockTransferItem extends Model {
  @Column({ type: 'int', name: 'stock_transfer_id' })
  stockTransferId!: number;

  @ManyToOne(() => StockTransfer, (transfer) => transfer.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'stock_transfer_id' })
  stockTransfer!: StockTransfer;

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

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_requested' })
  quantityRequested!: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_shipped', default: 0.0 })
  quantityShipped: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_received', default: 0.0 })
  quantityReceived: number = 0;

  toApi(): StockTransferItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      stockTransferId: this.stockTransferId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      quantityRequested: Number(this.quantityRequested),
      quantityShipped: Number(this.quantityShipped),
      quantityReceived: Number(this.quantityReceived),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    // Basic entity validation
    stockTransferItemValidationInputErrors.length = 0;
    if (this.quantityRequested === undefined || this.quantityRequested <= 0) {
      stockTransferItemValidationInputErrors.push('Requested quantity must be positive.');
      return false;
    }
    if (this.quantityShipped < 0) {
      stockTransferItemValidationInputErrors.push('Shipped quantity cannot be negative.');
      return false;
    }
    if (this.quantityReceived < 0) {
      stockTransferItemValidationInputErrors.push('Received quantity cannot be negative.');
      return false;
    }
    return true;
  }
}
