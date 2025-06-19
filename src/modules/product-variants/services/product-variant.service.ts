import {
  type ProductVariant,
  type CreateProductVariantInput,
  type UpdateProductVariantInput,
  type ProductVariantApiResponse,
  productVariantValidationInputErrors,
} from '../models/product-variant.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '../data/product-variant.repository';
import { ProductImageRepository } from '@/modules/product-images/data/product-image.repository';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: ProductVariantService | null = null;

export class ProductVariantService {
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly imageRepository: ProductImageRepository;

  /**
   * Creates an instance of ProductVariantService.
   * @param productRepository - The product repository.
   * @param variantRepository - The product variant repository.
   * @param imageRepository - The product image repository.
   */
  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    imageRepository: ProductImageRepository = new ProductImageRepository(),
  ) {
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.imageRepository = imageRepository;
  }

  /**
   * Maps a ProductVariant entity to a ProductVariantApiResponse.
   * @param variant - The product variant entity.
   * @returns The API response for the product variant, or null if the variant is null.
   */
  mapToApiResponse(variant: ProductVariant | null): ProductVariantApiResponse | null {
    if (!variant) return null;
    return variant.toApi({ includeProductSuppliers: false });
  }

  /**
   * Creates a new product variant for a given product.
   * @param productId - The ID of the product to which the variant belongs.
   * @param input - The input data for creating the product variant.
   * @param createdByUserId - The ID of the user who created the variant.
   * @returns The API response for the created product variant.
   */
  async createProductVariant(
    productId: number,
    input: CreateProductVariantInput,
    createdByUserId: number,
  ): Promise<ProductVariantApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    if (product.isCompositeProduct) {
      throw new BadRequestError(
        `Variants cannot be added to a composite product (kit). Manage components instead.`,
      );
    }

    const existingBySku = await this.variantRepository.findBySkuVariant(input.skuVariant);
    if (existingBySku) {
      throw new BadRequestError(`Product variant with SKU '${input.skuVariant}' already exists.`);
    }
    if (input.barcodeQrCodeVariant) {
      const existingByBarcode = await this.variantRepository.findByBarcodeQrCodeVariant(
        input.barcodeQrCodeVariant,
      );
      if (existingByBarcode) {
        throw new BadRequestError(
          `Product variant with barcode '${input.barcodeQrCodeVariant}' already exists.`,
        );
      }
    }
    if (input.imageId) {
      const image = await this.imageRepository.findById(input.imageId);
      if (!image || image.productId !== productId) {
        throw new BadRequestError(
          `Image with ID ${input.imageId} not found or does not belong to product ${productId}.`,
        );
      }
    }

    const variantEntity = this.variantRepository.create({
      ...input,
      productId,
      createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!variantEntity.isValid()) {
      throw new BadRequestError(
        `Product variant data is invalid. Errors: ${productVariantValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedVariant = await this.variantRepository.save(variantEntity);
      const populatedVariant = await this.variantRepository.findById(savedVariant.id);
      const apiResponse = this.mapToApiResponse(populatedVariant);
      if (!apiResponse) throw new ServerError('Failed to map created product variant.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PRODUCT_MANAGEMENT,
        savedVariant.id.toString(),
        {
          productId: productId,
          variantName: savedVariant.nameVariant,
          variantSku: savedVariant.skuVariant,
        },
      );

      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error creating variant for product ${productId}`, error, input });
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create product variant.');
    }
  }

  /**
   * Retrieves all product variants for a specific product.
   * @param productId - The ID of the product.
   * @returns An array of API responses for the product variants.
   */
  async getProductVariants(productId: number): Promise<ProductVariantApiResponse[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const variants = await this.variantRepository.findByProductId(productId);
    return variants
      .map((v) => this.mapToApiResponse(v))
      .filter(Boolean) as ProductVariantApiResponse[];
  }

  /**
   * Retrieves a specific product variant by its ID and product ID.
   * @param productId - The ID of the product the variant belongs to.
   * @param variantId - The ID of the product variant.
   * @returns The API response for the found product variant.
   */
  async getProductVariantById(
    productId: number,
    variantId: number,
  ): Promise<ProductVariantApiResponse> {
    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new NotFoundError(
        `Product variant with ID ${variantId} not found for product ${productId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(variant);
    if (!apiResponse) throw new ServerError(`Failed to map product variant ${variantId}.`);
    return apiResponse;
  }

  /**
   * Updates an existing product variant.
   * @param productId - The ID of the product the variant belongs to.
   * @param variantId - The ID of the product variant to update.
   * @param input - The input data for updating the product variant.
   * @param updatedByUserId - The ID of the user who updated the variant.
   * @returns The API response for the updated product variant.
   */
  async updateProductVariant(
    productId: number,
    variantId: number,
    input: UpdateProductVariantInput,
    updatedByUserId: number,
  ): Promise<ProductVariantApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new NotFoundError(
        `Product variant with ID ${variantId} not found for product ${productId}.`,
      );
    }

    if (input.skuVariant && input.skuVariant !== variant.skuVariant) {
      const existingBySku = await this.variantRepository.findBySkuVariant(input.skuVariant);
      if (existingBySku && existingBySku.id !== variantId) {
        throw new BadRequestError(
          `Another product variant with SKU '${input.skuVariant}' already exists.`,
        );
      }
    }
    if (input.barcodeQrCodeVariant && input.barcodeQrCodeVariant !== variant.barcodeQrCodeVariant) {
      const existingByBarcode = await this.variantRepository.findByBarcodeQrCodeVariant(
        input.barcodeQrCodeVariant,
        variantId,
      );
      if (existingByBarcode) {
        throw new BadRequestError(
          `Another product variant with barcode '${input.barcodeQrCodeVariant}' already exists.`,
        );
      }
    }
    if (input.imageId && input.imageId !== variant.imageId) {
      const image = await this.imageRepository.findById(input.imageId);
      if (!image || image.productId !== productId) {
        throw new BadRequestError(
          `New image with ID ${input.imageId} not found or does not belong to product ${productId}.`,
        );
      }
    }

    const tempVariantData = {
      ...variant,
      ...input,
      productId: variant.productId,
      skuVariant: input.skuVariant ?? variant.skuVariant,
      nameVariant: input.nameVariant ?? variant.nameVariant,
      attributes: input.attributes ?? variant.attributes,
      purchasePrice:
        input.purchasePrice !== undefined
          ? Number(input.purchasePrice)
          : Number(variant.purchasePrice),
      sellingPriceHt:
        input.sellingPriceHt !== undefined
          ? Number(input.sellingPriceHt)
          : Number(variant.sellingPriceHt),
      updatedByUserId,
    };
    const tempVariant = this.variantRepository.create(tempVariantData);
    if (!tempVariant.isValid()) {
      logger.error(
        `Product variant validation errors: ${productVariantValidationInputErrors.join(', ')}`,
      );
      throw new BadRequestError(
        `Updated product variant data is invalid. Errors: ${productVariantValidationInputErrors.join(', ')}`,
      );
    }

    const updatePayload: Partial<ProductVariant> = { ...input, updatedByUserId };
    if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
      return this.mapToApiResponse(variant) as ProductVariantApiResponse;
    }

    try {
      const result = await this.variantRepository.update(variantId, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.variantRepository.findById(variantId);
        if (!stillExists)
          throw new NotFoundError(`Product variant with ID ${variantId} not found during update.`);
      }

      const updatedVariant = await this.variantRepository.findById(variantId);
      if (!updatedVariant)
        throw new ServerError('Failed to re-fetch product variant after update.');

      const apiResponse = this.mapToApiResponse(updatedVariant);
      if (!apiResponse)
        throw new ServerError(`Failed to map updated product variant ${variantId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PRODUCT_MANAGEMENT,
        variantId.toString(),
        { productId: productId, updatedFields: Object.keys(input) },
      );

      return apiResponse;
    } catch (error) {
      logger.error({
        message: `Error updating variant ${variantId} for product ${productId}`,
        error,
        input,
      });
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError('Failed to update product variant.');
    }
  }

  /**
   * Deletes a product variant.
   * @param productId - The ID of the product the variant belongs to.
   * @param variantId - The ID of the product variant to delete.
   */
  async deleteProductVariant(productId: number, variantId: number): Promise<void> {
    try {
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }
      const variant = await this.variantRepository.findById(variantId);
      if (!variant || variant.productId !== productId) {
        throw new NotFoundError(
          `Product variant with ID ${variantId} not found for product ${productId}.`,
        );
      }

      const isUsed = await this.variantRepository.isProductVariantInUse(variantId);
      if (isUsed) {
        throw new BadRequestError(
          `Product variant with ID ${variantId} is currently in use by other entities and cannot be deleted.`,
        );
      }

      await this.variantRepository.softDelete(variantId);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PRODUCT_MANAGEMENT,
        variantId.toString(),
        { productId: productId },
      );
    } catch (error) {
      logger.error({ message: `Error deleting variant ${variantId}`, error });
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServerError('Error deleting product variant.');
    }
  }

  /**
   * Returns a singleton instance of the ProductVariantService.
   * @returns The singleton instance of ProductVariantService.
   */
  static getInstance(): ProductVariantService {
    instance ??= new ProductVariantService();
    return instance;
  }
}
