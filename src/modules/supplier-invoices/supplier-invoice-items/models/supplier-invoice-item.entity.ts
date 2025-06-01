import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { SupplierInvoice } from '@/modules/supplier-invoices/models/supplier-invoice.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions/purchase-reception-items/models/purchase-reception-item.entity';

export const createSupplierInvoiceItemSchema = z.object({
  productId: z.number().int().positive().nullable().optional(),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z.string().min(1, { message: 'Item description is required.' }).max(1000),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
  purchaseReceptionItemId: z.number().int().positive().nullable().optional(),
});

export const updateSupplierInvoiceItemSchema = createSupplierInvoiceItemSchema.partial().omit({
  productId: true, // Usually not changed for an existing line
  productVariantId: true,
  purchaseReceptionItemId: true,
});

export type CreateSupplierInvoiceItemInput = z.infer<typeof createSupplierInvoiceItemSchema>;
export type UpdateSupplierInvoiceItemInput = z.infer<typeof updateSupplierInvoiceItemSchema>;

export type SupplierInvoiceItemApiResponse = {
  id: number;
  supplierInvoiceId: number;
  productId: number | null;
  productVariantId: number | null;
  description: string;
  quantity: number;
  unitPriceHt: number;
  vatRatePercentage: number | null;
  totalLineAmountHt: number;
  purchaseReceptionItemId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const supplierInvoiceItemValidationInputErrors: string[] = [];

@Entity({ name: 'supplier_invoice_items' })
export class SupplierInvoiceItem extends Model {
  @Column({ type: 'int', name: 'supplier_invoice_id' })
  supplierInvoiceId!: number;

  @ManyToOne(() => SupplierInvoice, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'supplier_invoice_id' })
  supplierInvoice!: SupplierInvoice;

  @Column({ type: 'int', name: 'product_id', nullable: true })
  productId: number | null = null;

  @ManyToOne(() => Product, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null = null;

  @Column({ type: 'int', name: 'product_variant_id', nullable: true })
  productVariantId: number | null = null;

  @ManyToOne(() => ProductVariant, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant: ProductVariant | null = null;

  @Column({ type: 'text' }) // Description from supplier invoice, can differ from product name
  description!: string;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'unit_price_ht' })
  unitPriceHt!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'vat_rate_percentage' })
  vatRatePercentage: number | null = null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'total_line_amount_ht',
    // SQL schema indicates application calculates this (default 0.0)
    // If DB generated: generatedType: 'STORED', asExpression: '`quantity` * `unit_price_ht`', insert: false, update: false
  })
  totalLineAmountHt!: number;

  @Column({ type: 'bigint', name: 'purchase_reception_item_id', nullable: true })
  purchaseReceptionItemId: number | null = null;

  @ManyToOne(() => PurchaseReceptionItem, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'purchase_reception_item_id' })
  purchaseReceptionItem?: PurchaseReceptionItem | null;

  toApi(): SupplierInvoiceItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      supplierInvoiceId: this.supplierInvoiceId,
      productId: this.productId,
      productVariantId: this.productVariantId,
      description: this.description,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
      totalLineAmountHt: Number(this.totalLineAmountHt),
      purchaseReceptionItemId: this.purchaseReceptionItemId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      productId: this.productId,
      productVariantId: this.productVariantId,
      description: this.description,
      quantity: this.quantity,
      unitPriceHt: this.unitPriceHt,
      vatRatePercentage: this.vatRatePercentage,
      purchaseReceptionItemId: this.purchaseReceptionItemId,
    };
    const result = createSupplierInvoiceItemSchema.safeParse(dataToValidate);
    supplierInvoiceItemValidationInputErrors.length = 0;
    if (!result.success) {
      supplierInvoiceItemValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) =>
            `Item(ProdID:${this.productId || 'N/A'}): ${issue.path.join('.')}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (!this.description || this.description.trim() === '') {
      supplierInvoiceItemValidationInputErrors.push('Description is required for an invoice item.');
      return false;
    }
    if (this.quantity !== undefined && this.quantity <= 0) {
      supplierInvoiceItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (this.unitPriceHt !== undefined && this.unitPriceHt < 0) {
      supplierInvoiceItemValidationInputErrors.push('Unit price cannot be negative.');
      return false;
    }
    return true;
  }
}
