import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Product } from '../../products/models/product.entity';
import { Warehouse } from '../../warehouses/models/warehouse.entity';
import { Shop } from '../../shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';

// Types de mouvements de stock
export enum StockMovementType {
  PURCHASE_RECEPTION = 'purchase_reception', // Entrée suite à réception fournisseur
  SALE_DELIVERY = 'sale_delivery', // Sortie suite à livraison client
  CUSTOMER_RETURN = 'customer_return', // Entrée suite à retour client (réintégration)
  SUPPLIER_RETURN = 'supplier_return', // Sortie suite à retour fournisseur
  INVENTORY_ADJUSTMENT_IN = 'inventory_adjustment_in', // Ajustement d'inventaire positif
  INVENTORY_ADJUSTMENT_OUT = 'inventory_adjustment_out', // Ajustement d'inventaire négatif (perte, casse)
  STOCK_TRANSFER_OUT = 'stock_transfer_out', // Sortie pour transfert inter-sites
  STOCK_TRANSFER_IN = 'stock_transfer_in', // Entrée suite à transfert inter-sites
  MANUAL_ENTRY_IN = 'manual_entry_in', // Entrée manuelle diverse (ex: stock initial)
  MANUAL_ENTRY_OUT = 'manual_entry_out', // Sortie manuelle diverse
  PRODUCTION_IN = 'production_in', // Entrée de produits finis (fabrication)
  PRODUCTION_OUT = 'production_out', // Sortie de composants (fabrication)
}

// Zod Schema for validation (pour la création via DTO)
export const createStockMovementSchema = z
  .object({
    productId: z.number().int().positive(),
    productVariantId: z.number().int().positive().nullable().optional(),
    warehouseId: z.number().int().positive().nullable().optional(),
    shopId: z.number().int().positive().nullable().optional(),
    movementType: z.nativeEnum(StockMovementType),
    quantity: z.number().refine((val) => val !== 0, { message: 'Quantity cannot be zero.' }),
    movementDate: z.coerce.date().optional(),
    unitCostAtMovement: z.number().min(0).nullable().optional(),
    userId: z.number().int().positive({ message: 'User ID for the movement is required.' }),
    referenceDocumentType: z.string().max(50).nullable().optional(),
    referenceDocumentId: z.union([z.string(), z.number()]).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => data.warehouseId ?? data.shopId, {
    message: 'Either warehouseId or shopId must be provided for stock movement location.',
    path: ['warehouseId'],
  });

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export type StockMovementApiResponse = {
  id: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  warehouseId: number | null;
  warehouseName?: string;
  shopId: number | null;
  shopName?: string;
  movementType: StockMovementType;
  quantity: number;
  movementDate: string | null;
  unitCostAtMovement: number | null;
  userId: number;
  user?: UserApiResponse | null;
  referenceDocumentType: string | null;
  referenceDocumentId: string | number | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

@Entity({ name: 'stock_movements' })
@Index(['productId', 'productVariantId', 'movementDate'])
@Index(['warehouseId', 'movementDate'])
@Index(['shopId', 'movementDate'])
@Index(['movementType'])
@Index(['referenceDocumentType', 'referenceDocumentId'])
export class StockMovement extends Model {
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

  @Column({ type: 'int', name: 'warehouse_id', nullable: true })
  warehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'shop_id', nullable: true })
  shopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop | null = null;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'movement_type',
    enum: StockMovementType,
  })
  movementType!: StockMovementType;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity!: number;

  @Column({ type: 'timestamp', name: 'movement_date', default: () => 'CURRENT_TIMESTAMP' })
  movementDate!: Date;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'unit_cost_at_movement',
    nullable: true,
  })
  unitCostAtMovement: number | null = null;

  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50, name: 'reference_document_type', nullable: true })
  referenceDocumentType: string | null = null;
  @Column({ type: 'varchar', length: 100, name: 'reference_document_id', nullable: true })
  referenceDocumentId: string | number | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  toApi(): StockMovementApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      warehouseId: this.warehouseId,
      warehouseName: this.warehouse?.name,
      shopId: this.shopId,
      shopName: this.shop?.name,
      movementType: this.movementType,
      quantity: Number(this.quantity),
      movementDate: Model.formatISODate(this.movementDate),
      unitCostAtMovement: this.unitCostAtMovement !== null ? Number(this.unitCostAtMovement) : null,
      userId: this.userId,
      user: this.user ? this.user.toApi() : null,
      referenceDocumentType: this.referenceDocumentType,
      referenceDocumentId: this.referenceDocumentId,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValidBasic(): boolean {
    if (this.quantity === 0) return false;
    if (!this.warehouseId && !this.shopId) return false;
    if (this.warehouseId && this.shopId) return false;
    return true;
  }
}
