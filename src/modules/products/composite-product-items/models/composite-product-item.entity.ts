import { Model } from '@/common/models/Model';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { Product } from '@/modules/products/models/product.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';

export type CreateCompositeProductItemInput = {
  componentProductId: number;
  componentVariantId?: number | null;
  quantity: number;
};

export type UpdateCompositeProductItemInput = Partial<
  Pick<CreateCompositeProductItemInput, 'quantity'>
>;

@Entity({ name: 'composite_product_items' })
export class CompositeProductItem extends Model {
  @Column({ type: 'int', name: 'composite_product_id' })
  compositeProductId!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'composite_product_id' })
  compositeProduct!: Product;

  @Column({ type: 'int', name: 'component_product_id' })
  componentProductId!: number;

  @ManyToOne(() => Product, { eager: true, onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'component_product_id' })
  componentProduct!: Product;

  @Column({ type: 'int', name: 'component_variant_id', nullable: true })
  componentVariantId: number | null = null;

  @ManyToOne(() => ProductVariant, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'component_variant_id' })
  componentVariant: ProductVariant | null = null;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity!: number;

  toApi() {
    // Define a specific API response if needed
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      compositeProductId: this.compositeProductId,
      componentProductId: this.componentProductId,
      componentProductName: this.componentProduct?.name,
      componentVariantId: this.componentVariantId,
      componentVariantName: this.componentVariant?.nameVariant,
      quantity: Number(this.quantity),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    // Simple validation, more complex in service
    return this.quantity > 0 && this.componentProductId > 0 && this.compositeProductId > 0;
  }
}
