import { Model } from '@/common/models/Model';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Product } from '@/modules/products/models/product.entity';
import { Quote } from '@/modules/quotes/models/quote.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';

// Zod Schema for validation of input DTOs
export const createQuoteItemSchema = z.object({
  productId: z.number().int().positive({ message: 'Product ID is required.' }),
  productVariantId: z.number().int().positive().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  quantity: z.number().min(0.001, { message: 'Quantity must be positive.' }),
  unitPriceHt: z.number().min(0, { message: 'Unit price cannot be negative.' }),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  vatRatePercentage: z.number().min(0).max(100).nullable().optional(),
});

export const updateQuoteItemSchema = createQuoteItemSchema
  .partial()
  .omit({ productId: true, productVariantId: true });

export type CreateQuoteItemInput = z.infer<typeof createQuoteItemSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;

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

  getCalculatedTotalLineAmountHt(): number {
    const priceAfterDiscount = this.unitPriceHt * (1 - (this.discountPercentage || 0) / 100);
    return parseFloat((Number(this.quantity) * priceAfterDiscount).toFixed(4));
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
      productId: this.productId,
      productVariantId: this.productVariantId,
      description: this.description,
      quantity: Number(this.quantity), // Convert to Number
      unitPriceHt: Number(this.unitPriceHt), // Convert to Number
      discountPercentage: Number(this.discountPercentage), // Convert to Number
      vatRatePercentage: this.vatRatePercentage !== null ? Number(this.vatRatePercentage) : null, // Convert to Number
    };
    const result = createQuoteItemSchema.partial().safeParse(dataToValidate);
    quoteItemValidationInputErrors.length = 0;
    if (!result.success) {
      quoteItemValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `Item(${this.productId || 'new'}): ${issue.path.join('.')}: ${issue.message}`,
        ),
      );
      return false;
    }
    // These checks are now redundant if Zod schema handles them, but keep for explicit clarity
    if (Number(this.quantity) <= 0) {
      quoteItemValidationInputErrors.push('Quantity must be positive.');
      return false;
    }
    if (Number(this.unitPriceHt) < 0) {
      quoteItemValidationInputErrors.push('Unit price cannot be negative.');
      return false;
    }
    return true;
  }
}
