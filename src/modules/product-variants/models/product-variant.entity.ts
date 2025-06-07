import { Model } from '@/common/models/Model';
import {
  ProductImage,
  ProductImageApiResponse,
} from '@/modules/product-images/models/product-image.entity';
import { ProductSupplier } from '@/modules/product-suppliers/models/product-supplier.entity';
import { Product } from '@/modules/products/models/product.entity';
import { User } from '@/modules/users/models/users.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique, Index, OneToMany } from 'typeorm';
import { z } from 'zod';

const productVariantSchemaValidation = z.object({
  productId: z.number().int().positive(),
  skuVariant: z.string().min(1, 'Variant SKU is required.').max(150),
  nameVariant: z.string().min(1, 'Variant name is required.').max(255),
  attributes: z.record(z.string(), z.any(), {
    invalid_type_error: 'Attributes must be an object.',
  }), // JSON object
  purchasePrice: z.number().min(0).nullable().optional(),
  sellingPriceHt: z.number().min(0).nullable().optional(),
  barcodeQrCodeVariant: z.string().max(255).nullable().optional(),
  minStockLevelVariant: z.number().int().min(0).optional().default(0),
  maxStockLevelVariant: z.number().int().min(0).nullable().optional(),
  weightVariant: z.number().min(0).nullable().optional(),
  imageId: z.number().int().positive().nullable().optional(),
});

export type CreateProductVariantInput = {
  // productId will come from path
  skuVariant: string;
  nameVariant: string;
  attributes: Record<string, any>;
  purchasePrice?: number | null;
  sellingPriceHt?: number | null;
  barcodeQrCodeVariant?: string | null;
  minStockLevelVariant?: number;
  maxStockLevelVariant?: number | null;
  weightVariant?: number | null;
  imageId?: number | null; // ID of an existing ProductImage
};

export type UpdateProductVariantInput = Partial<CreateProductVariantInput>;

export type ProductVariantApiResponse = {
  id: number;
  productId: number;
  skuVariant: string;
  nameVariant: string;
  attributes: Record<string, any>;
  purchasePrice: number | null;
  sellingPriceHt: number | null;
  barcodeQrCodeVariant: string | null;
  minStockLevelVariant: number;
  maxStockLevelVariant: number | null;
  weightVariant: number | null;
  imageId: number | null;
  image?: ProductImageApiResponse | null; // Populated image details
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  productSuppliers?: any[]; // Add this if you want to include suppliers in the API response
};

export const productVariantValidationInputErrors: string[] = [];

@Entity({ name: 'product_variants' })
@Unique('uq_variant_sku', ['skuVariant'])
@Unique('uq_variant_barcode', ['barcodeQrCodeVariant']) // If barcode is unique per variant
@Index(['productId'])
export class ProductVariant extends Model {
  @Column({ type: 'int', name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'varchar', length: 150, name: 'sku_variant' })
  skuVariant!: string;

  @Column({ type: 'varchar', length: 255, name: 'name_variant' })
  nameVariant!: string;

  @Column({ type: 'json' })
  attributes!: Record<string, any>;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true, name: 'purchase_price' })
  purchasePrice: number | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true, name: 'selling_price_ht' })
  sellingPriceHt: number | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'barcode_qr_code_variant' })
  barcodeQrCodeVariant: string | null = null;

  @Column({ type: 'int', default: 0, name: 'min_stock_level_variant' })
  minStockLevelVariant: number = 0;

  @Column({ type: 'int', nullable: true, name: 'max_stock_level_variant' })
  maxStockLevelVariant: number | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true, name: 'weight_variant' })
  weightVariant: number | null = null;

  @Column({ type: 'int', nullable: true, name: 'image_id' })
  imageId: number | null = null;

  @ManyToOne(() => ProductImage, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_id' })
  image: ProductImage | null = null;

  @Column({ type: 'int', nullable: true, name: 'created_by_user_id' })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @Column({ type: 'int', nullable: true, name: 'updated_by_user_id' })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  @OneToMany(() => ProductSupplier, (productSupplier) => productSupplier.productVariant, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  productSuppliers?: ProductSupplier[];

  toApi(options?: { includeProductSuppliers?: boolean }): ProductVariantApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      productId: this.productId,
      skuVariant: this.skuVariant,
      nameVariant: this.nameVariant,
      attributes: this.attributes,
      purchasePrice: this.purchasePrice !== null ? Number(this.purchasePrice) : null,
      sellingPriceHt: this.sellingPriceHt !== null ? Number(this.sellingPriceHt) : null,
      barcodeQrCodeVariant: this.barcodeQrCodeVariant,
      minStockLevelVariant: this.minStockLevelVariant,
      maxStockLevelVariant: this.maxStockLevelVariant,
      weightVariant: this.weightVariant !== null ? Number(this.weightVariant) : null,
      imageId: this.imageId,
      image: this.image ? this.image.toApi() : null,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
      ...(options?.includeProductSuppliers && this.productSuppliers
        ? {
            productSuppliers: this.productSuppliers.map((ps) =>
              typeof ps.toApi === 'function' ? ps.toApi() : ps,
            ),
          }
        : {}),
    };
  }

  isValid(): boolean {
    const result = productVariantSchemaValidation.safeParse(this);
    productVariantValidationInputErrors.length = 0;
    if (!result.success) {
      productVariantValidationInputErrors.push(
        ...result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
      return false;
    }
    return true;
  }
}
