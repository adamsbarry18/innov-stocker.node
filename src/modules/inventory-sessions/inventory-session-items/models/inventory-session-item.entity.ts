import { Model } from '@/common/models/Model';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Product } from '@/modules/products/models/product.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { z } from 'zod';
import { InventorySession } from '../../models/inventory-session.entity';

export const createOrUpdateInventorySessionItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  counted_quantity: z.number().min(0, { message: 'Counted quantity cannot be negative.' }),
  notes: z.string().max(1000).nullable().optional(),
});

export type CreateOrUpdateInventorySessionItemInput = z.infer<
  typeof createOrUpdateInventorySessionItemSchema
>;

export type InventorySessionItemApiResponse = {
  id: number;
  inventorySessionId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  theoreticalQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  unitCostAtInventory: number | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const inventorySessionItemValidationInputErrors: string[] = [];

@Entity({ name: 'inventory_session_items' })
@Unique('inventory_item_unique', ['inventorySessionId', 'productId', 'productVariantId'])
@Index(['inventorySessionId'])
export class InventorySessionItem extends Model {
  @Column({ type: 'int', name: 'inventory_session_id' })
  inventorySessionId!: number;

  @ManyToOne(() => InventorySession, (session) => session.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'inventory_session_id' })
  inventorySession!: InventorySession;

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

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'theoretical_quantity' })
  theoreticalQuantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, name: 'counted_quantity' })
  countedQuantity!: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
    name: 'variance_quantity',
    default: 0,
  })
  varianceQuantity!: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'unit_cost_at_inventory',
    nullable: true,
  })
  unitCostAtInventory: number | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  calculateVariance(): void {
    this.varianceQuantity = parseFloat(
      (Number(this.countedQuantity) - Number(this.theoreticalQuantity)).toFixed(3),
    );
  }

  toApi(): InventorySessionItemApiResponse {
    const base = super.toApi();

    return {
      ...base,
      id: this.id,
      inventorySessionId: this.inventorySessionId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      theoreticalQuantity: Number(this.theoreticalQuantity),
      countedQuantity: Number(this.countedQuantity),
      varianceQuantity: Number(this.varianceQuantity),
      unitCostAtInventory:
        this.unitCostAtInventory !== null ? Number(this.unitCostAtInventory) : null,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    inventorySessionItemValidationInputErrors.length = 0;
    if (
      this.countedQuantity === undefined ||
      this.countedQuantity === null ||
      this.countedQuantity < 0
    ) {
      inventorySessionItemValidationInputErrors.push(
        'Counted quantity must be a non-negative number.',
      );
      return false;
    }
    if (this.theoreticalQuantity === undefined || this.theoreticalQuantity === null) {
      inventorySessionItemValidationInputErrors.push('Theoretical quantity must be set.');
      return false;
    }
    return true;
  }
}
