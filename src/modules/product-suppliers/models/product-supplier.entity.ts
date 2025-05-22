import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Currency, CurrencyApiResponse } from '@/modules/currencies/models/currency.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Supplier } from '@/modules/suppliers/models/supplier.entity';

const productSupplierSchemaValidation = z
  .object({
    productId: z.number().int().positive().nullable().optional(),
    productVariantId: z.number().int().positive().nullable().optional(),
    supplierId: z.number().int().positive({ message: 'Supplier ID is required.' }),
    supplierProductCode: z.string().max(100).nullable().optional(),
    purchasePrice: z.number().min(0, { message: 'Purchase price cannot be negative.' }),
    currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
    isDefaultSupplier: z.boolean().optional().default(false),
  })
  .refine((data) => data.productId || data.productVariantId, {
    message: 'Either productId or productVariantId must be provided.',
    path: ['productId'], // or a more general path
  });

export type CreateProductSupplierInput = {
  // productId or productVariantId will come from context or path
  supplierId: number;
  supplierProductCode?: string | null;
  purchasePrice: number;
  currencyId: number;
  isDefaultSupplier?: boolean;
};
// Specific inputs for associating with product or variant
export type CreateProductSupplierForProductInput = CreateProductSupplierInput & {
  productId: number;
  productVariantId?: never;
};
export type CreateProductSupplierForVariantInput = CreateProductSupplierInput & {
  productVariantId: number;
  productId?: never;
};

export type UpdateProductSupplierInput = Partial<Omit<CreateProductSupplierInput, 'supplierId'>>; // Cannot change supplier for an existing link, delete and recreate

// Simplified Supplier DTO for embedding
type EmbeddedSupplierApiResponse = {
  id: number;
  name: string;
};

export type ProductSupplierApiResponse = {
  id: number;
  productId: number | null;
  productVariantId: number | null;
  supplierId: number;
  supplier?: EmbeddedSupplierApiResponse | null;
  supplierProductCode: string | null;
  purchasePrice: number;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  isDefaultSupplier: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const productSupplierValidationInputErrors: string[] = [];

@Entity({ name: 'product_suppliers' })
@Unique('uq_product_supplier_link', ['productId', 'productVariantId', 'supplierId'])
export class ProductSupplier extends Model {
  @Column({ type: 'int', name: 'product_id', nullable: true })
  productId: number | null = null;

  @ManyToOne(() => Product, (product) => product.productSuppliers, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'product_id' })
  product?: Product | null;

  @Column({ type: 'int', name: 'product_variant_id', nullable: true })
  productVariantId: number | null = null;

  @ManyToOne(() => ProductVariant, (variant) => variant.productSuppliers, {
    onDelete: 'CASCADE',
    nullable: true,
  }) // Assuming ProductVariant will have productSuppliers relation
  @JoinColumn({ name: 'product_variant_id' })
  productVariant?: ProductVariant | null;

  @Column({ type: 'int', name: 'supplier_id' })
  supplierId!: number;

  @ManyToOne(() => Supplier, { eager: true, onDelete: 'CASCADE' }) // Cascade delete if supplier is deleted
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'supplier_product_code' })
  supplierProductCode: string | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'purchase_price' })
  purchasePrice!: number;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'boolean', default: false, name: 'is_default_supplier' })
  isDefaultSupplier: boolean = false;

  toApi(): ProductSupplierApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      productId: this.productId,
      productVariantId: this.productVariantId,
      supplierId: this.supplierId,
      supplier: this.supplier
        ? {
            id: this.supplier.id,
            name: this.supplier.name,
          }
        : null,
      supplierProductCode: this.supplierProductCode,
      purchasePrice: Number(this.purchasePrice),
      currencyId: this.currencyId,
      currency: this.currency?.toApi(),
      isDefaultSupplier: this.isDefaultSupplier,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = productSupplierSchemaValidation.safeParse(this);
    productSupplierValidationInputErrors.length = 0;
    if (!result.success) {
      productSupplierValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (!this.productId && !this.productVariantId) {
      productSupplierValidationInputErrors.push(
        'productId or productVariantId: At least one must be provided.',
      );
      return false;
    }
    return true;
  }
}
