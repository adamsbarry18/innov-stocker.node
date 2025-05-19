import { Model } from '@/common/models/Model';
import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Unique, Index } from 'typeorm';
import { z } from 'zod';

// Zod Schema for validation
const productCategorySchemaValidation = z.object({
  name: z.string().min(1, { message: 'Category name is required.' }).max(255),
  description: z.string().nullable().optional(),
  imageUrl: z
    .string()
    .url({ message: 'Invalid URL format for image.' })
    .max(2048)
    .nullable()
    .optional(),
  parentCategoryId: z.number().int().positive().nullable().optional(),
});

export type CreateProductCategoryInput = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  parentCategoryId?: number | null;
};

export type UpdateProductCategoryInput = Partial<CreateProductCategoryInput>;

export type ProductCategoryApiResponse = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentCategoryId: number | null;
  children?: ProductCategoryApiResponse[];
  createdAt: string | null;
  updatedAt: string | null;
};

export const productCategoryValidationInputErrors: string[] = [];

@Entity({ name: 'product_categories' })
@Unique('name_unique_by_parent', ['name', 'parentCategoryId'])
@Index(['parentCategoryId'])
export class ProductCategory extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'image_url' })
  imageUrl: string | null = null;

  @Column({ type: 'int', nullable: true, name: 'parent_category_id' })
  parentCategoryId: number | null = null;

  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_category_id' })
  parentCategory?: ProductCategory | null;

  @OneToMany(() => ProductCategory, (category) => category.parentCategory)
  children?: ProductCategory[];

  toApi(includeChildren = false): ProductCategoryApiResponse {
    const base = super.toApi();
    const response: ProductCategoryApiResponse = {
      ...base,
      id: this.id,
      name: this.name,
      description: this.description,
      imageUrl: this.imageUrl,
      parentCategoryId: this.parentCategoryId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };

    if (includeChildren) {
      if (this.children && Array.isArray(this.children) && this.children.length > 0) {
        response.children = this.children
          .map((child) => {
            if (child instanceof ProductCategory) {
              return child.toApi(true); // Recursive call for children of children
            }
            return null;
          })
          .filter(Boolean) as ProductCategoryApiResponse[];
      } else {
        response.children = []; // Always include the children array if requested, even if empty
      }
    }
    return response;
  }

  isValid(): boolean {
    const result = productCategorySchemaValidation.safeParse(this);
    productCategoryValidationInputErrors.length = 0;

    if (!result.success) {
      productCategoryValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
