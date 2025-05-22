import { Model } from '@/common/models/Model';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Product } from '@/modules/products/models/product.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';
import { Quote } from './quote.entity';

const quoteItemSchemaValidation = z.object({
  productId: z.number().int().positive(),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
  // totalLineAmountHt will be calculated
});

export type CreateQuoteItemInput = {
  productId: number;
  productVariantId?: number | null;
  description?: string | null;
  quantity: number;
  unitPriceHt: number;
  discountPercentage?: number;
  vatRatePercentage?: number | null;
};

export type UpdateQuoteItemInput = Partial<CreateQuoteItemInput>; // Allow all fields to be optional for update

export type QuoteItemApiResponse = {
  id: number;
  quoteId: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productVariantId: number | null;
  productVariantSku?: string | null;
  productVariantName?: string | null;
  description: string | null;
  quantity: number;
  unitPriceHt: number;
  discountPercentage: number;
  vatRatePercentage: number | null;
  totalLineAmountHt: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export const quoteItemValidationInputErrors: string[] = [];

@Entity({ name: 'quote_items' })
export class QuoteItem extends Model {
  @Column({ type: 'int', name: 'quote_id' })
  quoteId!: number;

  @ManyToOne(() => Quote, (quote) => quote.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'quote_id' })
  quote!: Quote;

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

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0, name: 'discount_percentage' })
  discountPercentage: number = 0;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'vat_rate_percentage' })
  vatRatePercentage: number | null = null;

  // total_line_amount_ht: DECIMAL(15, 4) DEFAULT 0.0000, -- Application to calculate
  // This will be a calculated property or set by the service.
  // For simplicity in entity, we omit it or make it a getter.
  // Let's assume service will calculate and it will be part of API response but not a direct DB column if not using GENERATED.
  // The SQL schema has this as a default 0, implying app calculates.

  getCalculatedTotalLineAmountHt(): number {
    const discountedPrice = this.unitPriceHt * (1 - (this.discountPercentage || 0) / 100);
    return parseFloat((this.quantity * discountedPrice).toFixed(4));
  }

  toApi(): QuoteItemApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      quoteId: this.quoteId,
      productId: this.productId,
      productSku: this.product?.sku,
      productName: this.product?.name,
      productVariantId: this.productVariantId,
      productVariantSku: this.productVariant?.skuVariant,
      productVariantName: this.productVariant?.nameVariant,
      description: this.description || this.productVariant?.nameVariant || this.product?.name,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      discountPercentage: Number(this.discountPercentage),
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null,
      totalLineAmountHt: this.getCalculatedTotalLineAmountHt(),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      productId: Number(this.productId),
      productVariantId: this.productVariantId ? Number(this.productVariantId) : null,
      description: this.description,
      quantity: Number(this.quantity),
      unitPriceHt: Number(this.unitPriceHt),
      discountPercentage: Number(this.discountPercentage),
      vatRatePercentage: this.vatRatePercentage ? Number(this.vatRatePercentage) : null,
    };
    const result = quoteItemSchemaValidation.safeParse(dataToValidate);
    quoteItemValidationInputErrors.length = 0;
    if (!result.success) {
      quoteItemValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `Item(${this.productId}): ${issue.path.join('.')}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
