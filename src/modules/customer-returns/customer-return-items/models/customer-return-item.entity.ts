import { Model } from '@/common/models/Model';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { CustomerReturn } from '../../models/customer-return.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';

export enum ReturnedItemCondition {
  NEW = 'new', // Neuf, revendable
  USED = 'used', // Utilisé, potentiellement revendable comme occasion
  DAMAGED = 'damaged', // Endommagé
  DEFECTIVE = 'defective', // Défectueux (sous garantie potentiellement)
}

export enum ReturnItemActionTaken {
  PENDING_INSPECTION = 'pending_inspection',
  RESTOCK = 'restock', // Remettre en stock vendable
  RESTOCK_QUARANTINE = 'restock_quarantine', // Remettre en stock mais dans un lieu de quarantaine/inspection
  DISCARD = 'discard', // Jeter
  REPAIR = 'repair', // Envoyer en réparation
  RETURN_TO_SUPPLIER = 'return_to_supplier', // Retourner au fournisseur (si défectueux par exemple)
  REFUND_APPROVED = 'refund_approved', // Remboursement approuvé pour cet article
  EXCHANGE_APPROVED = 'exchange_approved', // Échange approuvé pour cet article
  CREDIT_NOTE_APPROVED = 'credit_note_approved', // Avoir approuvé pour cet article
}

export const createCustomerReturnItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity returned must be positive.' }),
  quantityReceived: z.number().min(0).optional().default(0),
  unitPriceAtReturn: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe(
      'Original unit price at the time of sale, for refund calculation. Can be fetched from original order/invoice.',
    ),
  condition: z
    .nativeEnum(ReturnedItemCondition)
    .nullable()
    .optional()
    .default(ReturnedItemCondition.NEW),
  actionTaken: z
    .nativeEnum(ReturnItemActionTaken)
    .optional()
    .default(ReturnItemActionTaken.PENDING_INSPECTION),
  notes: z.string().nullable().optional(),
  // Optionally link to original salesOrderItemId or deliveryItemId for traceability
  // salesOrderItemId: z.number().int().positive().nullable().optional(),
  // deliveryItemId: z.number().int().positive().nullable().optional(),
});

export const updateCustomerReturnItemSchema = createCustomerReturnItemSchema.partial().omit({
  productId: true,
  productVariantId: true,
});

export type CreateCustomerReturnItemInput = z.infer<typeof createCustomerReturnItemSchema>;
export type UpdateCustomerReturnItemInput = z.infer<typeof updateCustomerReturnItemSchema>;

export type CustomerReturnItemApiResponse = {
  id: number;
  customerReturnId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string;
  productVariantName?: string;
  quantity: number;
  quantityReceived: number;
  unitPriceAtReturn: number | null;
  condition: ReturnedItemCondition | null;
  actionTaken: ReturnItemActionTaken;
  notes?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerReturnItemValidationInputErrors: string[] = [];

@Entity({ name: 'customer_return_items' })
@Index(['customerReturnId'])
export class CustomerReturnItem extends Model {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id!: number;

  @Column({ type: 'int', name: 'customer_return_id' })
  customerReturnId!: number;

  @ManyToOne(() => CustomerReturn, (cr) => cr.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'customer_return_id' })
  customerReturn!: CustomerReturn;

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

  @Column({
    type: 'enum',
    enum: ReturnedItemCondition,
    nullable: true,
  })
  condition: ReturnedItemCondition | null = null;

  @Column({
    type: 'enum',
    enum: ReturnItemActionTaken,
    default: ReturnItemActionTaken.PENDING_INSPECTION,
    name: 'action_taken',
  })
  actionTaken!: ReturnItemActionTaken;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  toApi(): CustomerReturnItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      customerReturnId: this.customerReturnId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      quantity: Number(this.quantity),
      quantityReceived: Number(this.quantityReceived),
      unitPriceAtReturn: this.unitPriceAtReturn !== null ? Number(this.unitPriceAtReturn) : null,
      condition: this.condition,
      actionTaken: this.actionTaken,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    customerReturnItemValidationInputErrors.length = 0;
    if (this.quantity === undefined || this.quantity <= 0) {
      customerReturnItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (this.quantityReceived === undefined || this.quantityReceived < 0) {
      customerReturnItemValidationInputErrors.push('Quantity received cannot be negative.');
      return false;
    }
    if (this.quantityReceived > this.quantity) {
      customerReturnItemValidationInputErrors.push(
        'Quantity received cannot exceed quantity to return.',
      );
      return false;
    }
    if (this.unitPriceAtReturn !== null && this.unitPriceAtReturn < 0) {
      customerReturnItemValidationInputErrors.push('Unit price at return cannot be negative.');
      return false;
    }
    return true;
  }
}
