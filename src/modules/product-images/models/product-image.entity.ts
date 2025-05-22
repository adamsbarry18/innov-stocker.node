// src/modules/products/models/product_image.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { z } from 'zod';
import { Model } from '../../../common/models/Model';
import { Product } from '../../products/models/product.entity'; // Forward reference

const productImageSchemaValidation = z.object({
  productId: z.number().int().positive(),
  imageUrl: z.string().url({ message: 'Invalid image URL.' }).max(2048),
  altText: z.string().max(255).nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

export type CreateProductImageInput = {
  // productId will come from path or context
  imageUrl: string; // Usually URL after upload, or direct upload handled by service
  altText?: string | null;
  isPrimary?: boolean;
};
// Update typically involves changing altText or isPrimary
export type UpdateProductImageInput = Partial<Omit<CreateProductImageInput, 'imageUrl'>>;

export type ProductImageApiResponse = {
  id: number;
  productId: number;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const productImageValidationInputErrors: string[] = [];

@Entity({ name: 'product_images' })
export class ProductImage extends Model {
  @Column({ type: 'int', name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product, (product) => product.images, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ type: 'varchar', length: 2048, name: 'image_url' })
  imageUrl!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'alt_text' })
  altText: string | null = null;

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary: boolean = false;

  toApi(): ProductImageApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      productId: this.productId,
      imageUrl: this.imageUrl,
      altText: this.altText,
      isPrimary: this.isPrimary,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = productImageSchemaValidation.safeParse({
      productId: this.productId, // Include productId in validation
      imageUrl: this.imageUrl,
      altText: this.altText,
      isPrimary: this.isPrimary,
    });
    productImageValidationInputErrors.length = 0;
    if (!result.success) {
      productImageValidationInputErrors.push(
        ...result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
      return false;
    }
    return true;
  }
}
