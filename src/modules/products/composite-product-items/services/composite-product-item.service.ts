import {
  type CompositeProductItem,
  type CreateCompositeProductItemInput,
  type UpdateCompositeProductItemInput,
} from '../models/composite-product-item.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { CompositeProductItemRepository } from '../data/composite-product-item.repository';

type CompositeProductItemApiResponse = ReturnType<CompositeProductItem['toApi']>;

let instance: CompositeProductItemService | null = null;

export class CompositeProductItemService {
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly itemRepository: CompositeProductItemRepository;

  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    itemRepository: CompositeProductItemRepository = new CompositeProductItemRepository(),
  ) {
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.itemRepository = itemRepository;
  }

  mapToApiResponse(item: CompositeProductItem | null): CompositeProductItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  async addComponentToProduct(
    compositeProductId: number,
    input: CreateCompositeProductItemInput,
    createdByUserId: number, // For audit, if entity has createdByUserId
  ): Promise<CompositeProductItemApiResponse> {
    const compositeProduct = await this.productRepository.findById(compositeProductId);
    if (!compositeProduct) {
      throw new NotFoundError(`Composite product with ID ${compositeProductId} not found.`);
    }
    if (!compositeProduct.isCompositeProduct) {
      throw new BadRequestError(
        `Product with ID ${compositeProductId} is not a composite product (kit). Cannot add components.`,
      );
    }
    if (compositeProductId === input.componentProductId) {
      throw new BadRequestError('A product cannot be a component of itself.');
    }

    const componentProduct = await this.productRepository.findById(input.componentProductId);
    if (!componentProduct) {
      throw new BadRequestError(`Component product with ID ${input.componentProductId} not found.`);
    }
    if (componentProduct.isCompositeProduct) {
      // Decide if a kit can be a component of another kit. For now, we forbid it for simplicity.
      throw new BadRequestError(
        `Component product ID ${input.componentProductId} is itself a composite product, which is not allowed as a component.`,
      );
    }

    if (input.componentVariantId) {
      const variant = await this.variantRepository.findById(input.componentVariantId);
      if (!variant || variant.productId !== input.componentProductId) {
        throw new BadRequestError(
          `Component variant ID ${input.componentVariantId} not found or does not belong to component product ID ${input.componentProductId}.`,
        );
      }
    }

    const existingLink = await this.itemRepository.findSpecificItem(
      compositeProductId,
      input.componentProductId,
      input.componentVariantId || null,
    );
    if (existingLink) {
      throw new BadRequestError(
        'This component (product/variant) is already part of this composite product.',
      );
    }

    const itemEntity = this.itemRepository.create({
      ...input,
      compositeProductId,
      // createdByUserId: createdByUserId, // If entity has this
    });

    if (!itemEntity.isValid()) {
      throw new BadRequestError(`Composite item data invalid.`);
    }

    try {
      const savedItem = await this.itemRepository.save(itemEntity);
      const populatedItem = await this.itemRepository.findById(savedItem.id);
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created composite item.');
      return apiResponse;
    } catch (error) {
      logger.error({
        message: `Error adding component to composite product ${compositeProductId}`,
        error,
        input,
      });
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to add component to composite product.');
    }
  }

  async getProductComponents(
    compositeProductId: number,
  ): Promise<CompositeProductItemApiResponse[]> {
    const product = await this.productRepository.findById(compositeProductId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${compositeProductId} not found.`);
    }
    // if (!product.isCompositeProduct) { // Optionnel: return empty array if not a composite product
    //   return [];
    // }
    const items = await this.itemRepository.findByCompositeProductId(compositeProductId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as CompositeProductItemApiResponse[];
  }

  async getCompositeItemById(
    compositeProductId: number,
    itemId: number,
  ): Promise<CompositeProductItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.compositeProductId !== compositeProductId) {
      throw new NotFoundError(
        `Component link with ID ${itemId} not found for composite product ${compositeProductId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map composite item.');
    return apiResponse;
  }

  async updateProductComponent(
    compositeProductId: number,
    itemId: number,
    input: UpdateCompositeProductItemInput,
    updatedByUserId: number, // For audit
  ): Promise<CompositeProductItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.compositeProductId !== compositeProductId) {
      throw new NotFoundError(
        `Component link ID ${itemId} not found for composite product ${compositeProductId}.`,
      );
    }

    // Only quantity is typically updatable. Changing componentProduct/Variant is a delete + add.
    if (input.quantity !== undefined && input.quantity <= 0) {
      throw new BadRequestError('Quantity must be positive.');
    }

    const updatePayload: Partial<CompositeProductItem> = { ...input };
    // updatePayload.updatedByUserId = updatedByUserId; // If entity has this

    if (Object.keys(updatePayload).length === 0) {
      const currentItem = await this.itemRepository.findById(itemId);
      return this.mapToApiResponse(currentItem) as CompositeProductItemApiResponse;
    }

    try {
      const result = await this.itemRepository.update(itemId, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.itemRepository.findById(itemId);
        if (!stillExists)
          throw new NotFoundError(`Component link ID ${itemId} not found during update.`);
      }

      const updatedItem = await this.itemRepository.findById(itemId);
      if (!updatedItem) throw new ServerError('Failed to re-fetch component item after update.');

      const apiResponse = this.mapToApiResponse(updatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated component item.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error updating component link ${itemId}`, error, input });
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError('Failed to update component item.');
    }
  }

  async removeProductComponent(
    compositeProductId: number,
    itemId: number,
    deletedByUserId: number, // For audit
  ): Promise<void> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.compositeProductId !== compositeProductId) {
      throw new NotFoundError(
        `Component link ID ${itemId} not found for composite product ${compositeProductId}.`,
      );
    }

    try {
      await this.itemRepository.removeByEntityId(itemId);
    } catch (error) {
      logger.error({ message: `Error removing component link ${itemId}`, error });
      throw new ServerError('Error removing component from composite product.');
    }
  }

  static getInstance(): CompositeProductItemService {
    instance ??= new CompositeProductItemService();
    return instance;
  }
}
