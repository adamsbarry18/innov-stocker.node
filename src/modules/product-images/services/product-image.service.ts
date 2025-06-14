import { appDataSource } from '@/database/data-source';
import { ProductImageRepository } from '../data/product-image.repository';
import {
  ProductImage,
  type CreateProductImageInput,
  type UpdateProductImageInput,
  type ProductImageApiResponse,
  productImageValidationInputErrors,
} from '../models/product-image.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { IsNull } from 'typeorm';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: ProductImageService | null = null;

export class ProductImageService {
  private readonly productRepository: ProductRepository;
  private readonly imageRepository: ProductImageRepository;

  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    imageRepository: ProductImageRepository = new ProductImageRepository(),
  ) {
    this.productRepository = productRepository;
    this.imageRepository = imageRepository;
  }

  mapToApiResponse(image: ProductImage | null): ProductImageApiResponse | null {
    if (!image) return null;
    return image.toApi();
  }

  async addProductImage(
    productId: number,
    input: CreateProductImageInput,
  ): Promise<ProductImageApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    if (input.isPrimary === true) {
      await this.imageRepository.unsetPrimaryForOtherImages(productId, -1);
    } else {
      const primaryImage = await this.imageRepository.findPrimaryByProductId(productId);
      if (!primaryImage) {
        input.isPrimary = true;
      }
    }

    const imageEntity = this.imageRepository.create({
      ...input,
      productId,
    });

    if (!imageEntity.isValid()) {
      throw new BadRequestError(
        `Product image data invalid: ${productImageValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedImage = await this.imageRepository.save(imageEntity);

      const apiResponse = this.mapToApiResponse(savedImage);
      if (!apiResponse) throw new ServerError('Failed to map created product image.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PRODUCT_MANAGEMENT,
        savedImage.id.toString(),
        { productId: productId, imageUrl: savedImage.imageUrl, isPrimary: savedImage.isPrimary },
      );

      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error adding image to product ${productId}`, error, input });
      throw new ServerError('Failed to add product image.');
    }
  }

  async getProductImages(productId: number): Promise<ProductImageApiResponse[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const images = await this.imageRepository.findByProductId(productId);
    return images
      .map((img) => this.mapToApiResponse(img))
      .filter(Boolean) as ProductImageApiResponse[];
  }

  async getProductImageById(productId: number, imageId: number): Promise<ProductImageApiResponse> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }
    const apiResponse = this.mapToApiResponse(image);
    if (!apiResponse) throw new ServerError(`Failed to map product image ${imageId}.`);
    return apiResponse;
  }

  async updateProductImage(
    productId: number,
    imageId: number,
    input: UpdateProductImageInput,
  ): Promise<ProductImageApiResponse> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }

    if (input.isPrimary === true && !image.isPrimary) {
      await this.imageRepository.unsetPrimaryForOtherImages(productId, imageId);
    } else if (input.isPrimary === false && image.isPrimary) {
      const otherImages = await this.imageRepository.findByProductId(productId);
      if (otherImages.filter((img) => img.id !== imageId && !img.deletedAt).length === 0) {
        throw new BadRequestError(
          'Cannot unset the only image as primary. Add another image or set another as primary.',
        );
      }
    }

    const tempImageData = { ...image, ...input };
    const tempImageEntity = this.imageRepository.create(tempImageData);
    if (!tempImageEntity.isValid()) {
      throw new BadRequestError(
        `Updated product image data invalid: ${productImageValidationInputErrors.join(', ')}`,
      );
    }

    const updatePayload: Partial<ProductImage> = { ...input };

    try {
      const result = await this.imageRepository.update(imageId, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.imageRepository.findById(imageId);
        if (!stillExists || stillExists.productId !== productId)
          throw new NotFoundError(
            `Image with ID ${imageId} not found for product ${productId} during update.`,
          );
      }

      const updatedImage = await this.imageRepository.findById(imageId);
      if (!updatedImage) throw new ServerError('Failed to re-fetch product image after update.');

      const apiResponse = this.mapToApiResponse(updatedImage);
      if (!apiResponse) throw new ServerError('Failed to map updated product image.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PRODUCT_MANAGEMENT,
        imageId.toString(),
        { productId: productId, updatedFields: Object.keys(input) },
      );

      return apiResponse;
    } catch (error) {
      logger.error({
        message: `Error updating image ${imageId} for product ${productId}`,
        error,
        input,
      });
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError('Failed to update product image.');
    }
  }

  async deleteProductImage(productId: number, imageId: number): Promise<void> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }

    if (image.isPrimary) {
      throw new BadRequestError(
        'Cannot delete the primary image. Set another image as primary first, or delete the product itself.',
      );
    }

    try {
      await this.imageRepository.softDelete(imageId);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PRODUCT_MANAGEMENT,
        imageId.toString(),
        { productId: productId },
      );
    } catch (error) {
      logger.error({ message: `Error deleting image ${imageId} for product ${productId}`, error });
      throw new ServerError('Error deleting product image.');
    }
  }

  async setPrimaryProductImage(
    productId: number,
    imageId: number,
  ): Promise<ProductImageApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError(`Product with ID ${productId} not found.`);

    const imageToSetPrimary = await this.imageRepository.findById(imageId);
    if (!imageToSetPrimary || imageToSetPrimary.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }

    if (imageToSetPrimary.isPrimary) {
      return this.mapToApiResponse(imageToSetPrimary) as ProductImageApiResponse;
    }

    await appDataSource.transaction(async (transactionalEntityManager) => {
      const imageRepoTx = transactionalEntityManager.getRepository(ProductImage);
      await imageRepoTx.update(
        { productId: productId, isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
      await imageRepoTx.update(imageId, { isPrimary: true });
    });

    const updatedImage = await this.imageRepository.findById(imageId);

    await UserActivityLogService.getInstance().insertEntry(
      ActionType.UPDATE,
      EntityType.PRODUCT_MANAGEMENT,
      imageId.toString(),
      { productId: productId, action: 'set_primary_image' },
    );

    return this.mapToApiResponse(updatedImage) as ProductImageApiResponse;
  }

  static getInstance(): ProductImageService {
    instance ??= new ProductImageService();
    return instance;
  }
}
