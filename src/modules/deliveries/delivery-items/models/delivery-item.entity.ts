import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Delivery } from '@/modules/deliveries/models/delivery.entity';
import { SalesOrderItem } from '@/modules/sales-orders/sales-order-items/models/sales-order-item.entity';

export const createDeliveryItemSchema = z.object({
  salesOrderItemId: z
    .number()
    .int()
    .positive({ message: 'Sales Order Item ID is required to link the delivery item.' }),
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  quantityShipped: z.number().min(0.001, { message: 'Quantity shipped must be positive.' }),
});

export const updateDeliveryItemSchema = z.object({
  quantityShipped: z
    .number()
    .min(0.001, { message: 'Quantity shipped must be positive.' })
    .optional(),
});

export type CreateDeliveryItemInput = {
  salesOrderItemId: number;
  quantityShipped: number;
};

export type UpdateDeliveryItemInput = z.infer<typeof updateDeliveryItemSchema>;

export type DeliveryItemApiResponse = {
  id: number;
  deliveryId: number;
  salesOrderItemId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  quantityShipped: number;
  quantityOrderedFromSo?: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const deliveryItemValidationInputErrors: string[] = [];

@Entity({ name: 'delivery_items' })
@Index(['deliveryId', 'salesOrderItemId'], { unique: true, where: `"deleted_time" IS NULL` })
@Index(['deliveryId', 'productId', 'productVariantId'], { where: `"deleted_time" IS NULL` })
export class DeliveryItem extends Model {
  @Column({ type: 'int', name: 'delivery_id' })
  deliveryId!: number;

  @ManyToOne(() => Delivery, (delivery) => delivery.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'delivery_id' })
  delivery!: Delivery;

  @Column({ type: 'bigint', name: 'sales_order_item_id' })
  salesOrderItemId!: number;

  @ManyToOne(() => SalesOrderItem, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_order_item_id' })
  salesOrderItem!: SalesOrderItem;

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

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'quantity_shipped' })
  quantityShipped!: number;

  toApi(): DeliveryItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      deliveryId: this.deliveryId,
      salesOrderItemId: this.salesOrderItemId,
      productId: this.salesOrderItem?.productId || this.productId,
      productSku: this.salesOrderItem?.product?.sku || this.product?.sku,
      productName: this.salesOrderItem?.product?.name || this.product?.name,
      productVariantId: this.salesOrderItem?.productVariantId || this.productVariantId,
      productVariantSku:
        this.salesOrderItem?.productVariant?.skuVariant || this.productVariant?.skuVariant,
      productVariantName:
        this.salesOrderItem?.productVariant?.nameVariant || this.productVariant?.nameVariant,
      quantityShipped: Number(this.quantityShipped),
      quantityOrderedFromSo: this.salesOrderItem ? Number(this.salesOrderItem.quantity) : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    deliveryItemValidationInputErrors.length = 0;
    if (this.quantityShipped === undefined || this.quantityShipped <= 0) {
      deliveryItemValidationInputErrors.push('Quantity shipped must be positive.');
      return false;
    }
    if (!this.salesOrderItemId) {
      deliveryItemValidationInputErrors.push(
        'Sales Order Item ID is required to link the delivery item.',
      );
      return false;
    }
    if (!this.productId) {
      deliveryItemValidationInputErrors.push('Product ID is required.');
      return false;
    }
    return true;
  }
}
