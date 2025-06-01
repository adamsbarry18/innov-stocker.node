import { Model } from '@/common/models/Model';
import { ProductCategory } from '@/modules/product-categories/models/product-category.entity';
import {
  ProductImage,
  ProductImageApiResponse,
} from '@/modules/product-images/models/product-image.entity';
import {
  ProductSupplier,
  ProductSupplierApiResponse,
} from '@/modules/product-suppliers/models/product-supplier.entity';
import {
  ProductVariant,
  ProductVariantApiResponse,
} from '@/modules/product-variants/models/product-variant.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Unique, Index } from 'typeorm';
import { z } from 'zod';
import { CompositeProductItem } from '../composite-product-items/models/composite-product-item.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OBSOLETE = 'obsolete',
}

// Zod Schema for validation
const productSchemaValidation = z.object({
  sku: z.string().min(1, { message: 'SKU is required.' }).max(100),
  name: z.string().min(1, { message: 'Product name is required.' }).max(255),
  description: z.string().nullable().optional(),
  productCategoryId: z.number().int().positive({ message: 'Product category ID is required.' }),
  unitOfMeasure: z.string().min(1, { message: 'Unit of measure is required.' }).max(50),
  weight: z.number().min(0).nullable().optional(),
  weightUnit: z.string().max(10).nullable().optional(),
  length: z.number().min(0).nullable().optional(),
  width: z.number().min(0).nullable().optional(),
  height: z.number().min(0).nullable().optional(),
  dimensionUnit: z.string().max(10).nullable().optional(),
  barcodeQrCode: z.string().max(255).nullable().optional(),
  minStockLevel: z.number().int().min(0).optional().default(0),
  maxStockLevel: z.number().int().min(0).nullable().optional(),
  defaultPurchasePrice: z.number().min(0).nullable().optional(),
  defaultSellingPriceHt: z.number().min(0).nullable().optional(),
  defaultVatRatePercentage: z.number().min(0).max(100).nullable().optional(),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
  isCompositeProduct: z.boolean().optional().default(false),
  notes: z.string().nullable().optional(),
});

// DTOs for Product CRUD
// For CreateProductInput, sub-entities like variants, images, suppliers can be part of a more complex DTO
// or handled via separate endpoint calls after the main product is created.
// For simplicity here, we'll assume sub-entities are managed via their own endpoints.
export type CreateProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  productCategoryId: number;
  unitOfMeasure: string;
  weight?: number | null;
  weightUnit?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimensionUnit?: string | null;
  barcodeQrCode?: string | null;
  minStockLevel?: number;
  maxStockLevel?: number | null;
  defaultPurchasePrice?: number | null;
  defaultSellingPriceHt?: number | null;
  defaultVatRatePercentage?: number | null;
  status?: ProductStatus;
  isCompositeProduct?: boolean;
  notes?: string | null;
};

export type UpdateProductInput = Partial<CreateProductInput>;

// Simplified DTOs for embedded relations
type EmbeddedProductCategoryApiResponse = {
  id: number;
  name: string;
  parentCategoryId: number | null;
};

export type ProductApiResponse = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  productCategoryId: number;
  productCategory?: EmbeddedProductCategoryApiResponse | null;
  unitOfMeasure: string;
  weight: number | null;
  weightUnit: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: string | null;
  barcodeQrCode: string | null;
  minStockLevel: number;
  maxStockLevel: number | null;
  defaultPurchasePrice: number | null;
  defaultSellingPriceHt: number | null;
  defaultVatRatePercentage: number | null;
  status: ProductStatus;
  isCompositeProduct: boolean;
  notes: string | null;
  images?: ProductImageApiResponse[];
  variants?: ProductVariantApiResponse[];
  productSuppliers?: ProductSupplierApiResponse[]; // Suppliers for this specific product (not variants)
  components?: any[]; // Simplified for now, replace with CompositeProductItemApiResponse
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  updatedByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const productValidationInputErrors: string[] = [];

@Entity({ name: 'products' })
@Unique('uq_product_sku', ['sku'])
@Index(['name'])
@Index(['productCategoryId'])
export class Product extends Model {
  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'int', name: 'product_category_id' })
  productCategoryId!: number;

  @ManyToOne(() => ProductCategory, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_category_id' })
  productCategory!: ProductCategory;

  @Column({ type: 'varchar', length: 50, name: 'unit_of_measure' })
  unitOfMeasure!: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  weight: number | null = null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'weight_unit' })
  weightUnit: string | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  length: number | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  width: number | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  height: number | null = null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'dimension_unit' })
  dimensionUnit: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'barcode_qr_code', unique: true })
  barcodeQrCode: string | null = null;

  @Column({ type: 'int', default: 0, name: 'min_stock_level' })
  minStockLevel: number = 0;

  @Column({ type: 'int', nullable: true, name: 'max_stock_level' })
  maxStockLevel: number | null = null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
    name: 'default_purchase_price',
  })
  defaultPurchasePrice: number | null = null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
    name: 'default_selling_price_ht',
  })
  defaultSellingPriceHt: number | null = null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'default_vat_rate_percentage',
  })
  defaultVatRatePercentage: number | null = null;

  @Column({
    type: 'varchar', // As per SQL schema
    length: 20,
    default: ProductStatus.ACTIVE,
  })
  status!: ProductStatus;

  @Column({ type: 'boolean', default: false, name: 'is_composite_product' })
  isCompositeProduct: boolean = false;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'int', nullable: true, name: 'created_by_user_id' })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false }) // Eager false for User
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @Column({ type: 'int', nullable: true, name: 'updated_by_user_id' })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false }) // Eager false for User
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  // Relations to sub-entities
  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  images?: ProductImage[];

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  variants?: ProductVariant[];

  // For composite products: items that make up this product
  @OneToMany(() => CompositeProductItem, (item) => item.compositeProduct, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  components?: CompositeProductItem[]; // if this product IS a composite

  // For standard products: if this product IS a component of other composite products
  @OneToMany(() => CompositeProductItem, (item) => item.componentProduct, {
    cascade: false,
    eager: false,
  })
  componentInKits?: CompositeProductItem[];

  @OneToMany(() => ProductSupplier, (ps) => ps.product, {
    cascade: ['insert', 'update'],
    eager: false,
  })
  productSuppliers?: ProductSupplier[];

  toApi(options: { includeRelations?: boolean } = { includeRelations: false }): ProductApiResponse {
    const base = super.toApi();
    const response: ProductApiResponse = {
      ...base,
      id: this.id,
      sku: this.sku,
      name: this.name,
      description: this.description,
      productCategoryId: this.productCategoryId,
      productCategory: this.productCategory
        ? {
            id: this.productCategory.id,
            name: this.productCategory.name,
            parentCategoryId: this.productCategory.parentCategoryId,
          }
        : null,
      unitOfMeasure: this.unitOfMeasure,
      weight: this.weight !== null ? Number(this.weight) : null,
      weightUnit: this.weightUnit,
      length: this.length !== null ? Number(this.length) : null,
      width: this.width !== null ? Number(this.width) : null,
      height: this.height !== null ? Number(this.height) : null,
      dimensionUnit: this.dimensionUnit,
      barcodeQrCode: this.barcodeQrCode,
      minStockLevel: this.minStockLevel,
      maxStockLevel: this.maxStockLevel,
      defaultPurchasePrice:
        this.defaultPurchasePrice !== null ? Number(this.defaultPurchasePrice) : null,
      defaultSellingPriceHt:
        this.defaultSellingPriceHt !== null ? Number(this.defaultSellingPriceHt) : null,
      defaultVatRatePercentage:
        this.defaultVatRatePercentage !== null ? Number(this.defaultVatRatePercentage) : null,
      status: this.status,
      isCompositeProduct: this.isCompositeProduct,
      notes: this.notes,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };

    if (options.includeRelations) {
      response.images = this.images?.map((img) => img.toApi());
      response.variants = this.variants?.map((v) => v.toApi());
      response.productSuppliers = this.productSuppliers?.map((ps) => ps.toApi());
      response.components = this.components?.map((c) => c.toApi()); // Assuming CompositeProductItem has toApi
      // createdByUser and updatedByUser could be populated here if eager loaded or explicitly loaded
    }
    return response;
  }

  isValid(): boolean {
    const result = productSchemaValidation.safeParse(this);
    productValidationInputErrors.length = 0;
    if (!result.success) {
      productValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
