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
    createdByUserId: number, // For audit, if ProductImage entity had createdByUserId
  ): Promise<ProductImageApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    // If this image is set as primary, unset any other primary image for this product
    if (input.isPrimary === true) {
      await this.imageRepository.unsetPrimaryForOtherImages(productId, -1); // -1 as new image has no ID yet
    } else {
      // If no primary image exists for the product and this is the first image, set it as primary
      const primaryImage = await this.imageRepository.findPrimaryByProductId(productId);
      if (!primaryImage) {
        input.isPrimary = true;
      }
    }

    const imageEntity = this.imageRepository.create({
      ...input,
      productId,
      // createdByUserId: createdByUserId, // If ProductImage entity has this field
    });

    if (!imageEntity.isValid()) {
      throw new BadRequestError(
        `Product image data invalid: ${productImageValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedImage = await this.imageRepository.save(imageEntity);
      logger.info(`Image added successfully to product ${productId} (Image ID: ${savedImage.id}).`);

      const apiResponse = this.mapToApiResponse(savedImage);
      if (!apiResponse) throw new ServerError('Failed to map created product image.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error adding image to product ${productId}`, error, input });
      throw new ServerError('Failed to add product image.');
    }
  }

  async getProductImages(productId: number): Promise<ProductImageApiResponse[]> {
    const product = await this.productRepository.findById(productId); // Ensure product exists
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
    updatedByUserId: number, // For audit
  ): Promise<ProductImageApiResponse> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }

    // Handle primary status change
    if (input.isPrimary === true && !image.isPrimary) {
      await this.imageRepository.unsetPrimaryForOtherImages(productId, imageId);
    } else if (input.isPrimary === false && image.isPrimary) {
      // Prevent unsetting the primary image if it's the only one
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
    // updatePayload.updatedByUserId = updatedByUserId; // If audit field exists

    try {
      const result = await this.imageRepository.update(imageId, updatePayload);
      if (result.affected === 0) {
        // This might happen if the image was deleted between find and update
        const stillExists = await this.imageRepository.findById(imageId);
        if (!stillExists || stillExists.productId !== productId)
          throw new NotFoundError(
            `Image with ID ${imageId} not found for product ${productId} during update.`,
          );
      }

      const updatedImage = await this.imageRepository.findById(imageId);
      if (!updatedImage) throw new ServerError('Failed to re-fetch product image after update.');

      logger.info(`Image ID ${imageId} for product ${productId} updated successfully.`);
      const apiResponse = this.mapToApiResponse(updatedImage);
      if (!apiResponse) throw new ServerError('Failed to map updated product image.');
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

  async deleteProductImage(
    productId: number,
    imageId: number,
    deletedByUserId: number,
  ): Promise<void> {
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
      // Add audit log if necessary
      logger.info(`Image ID ${imageId} for product ${productId} soft-deleted successfully.`);
    } catch (error) {
      logger.error({ message: `Error deleting image ${imageId} for product ${productId}`, error });
      throw new ServerError('Error deleting product image.');
    }
  }

  async setPrimaryProductImage(
    productId: number,
    imageId: number,
    userId: number,
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
    logger.info(`Image ID ${imageId} set as primary for product ${productId}.`);
    return this.mapToApiResponse(updatedImage) as ProductImageApiResponse;
  }

  static getInstance(): ProductImageService {
    if (!instance) {
      instance = new ProductImageService();
    }
    return instance;
  }
}
