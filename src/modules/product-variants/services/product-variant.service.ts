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

let instance: ProductVariantService | null = null;

export class ProductVariantService {
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly imageRepository: ProductImageRepository;

  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    imageRepository: ProductImageRepository = new ProductImageRepository(),
  ) {
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.imageRepository = imageRepository;
  }

  mapToApiResponse(variant: ProductVariant | null): ProductVariantApiResponse | null {
    if (!variant) return null;
    return variant.toApi({ includeProductSuppliers: false }); // Par défaut, ne pas inclure les fournisseurs ici
  }

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
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error creating variant for product ${productId}`, error, input });
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create product variant.');
    }
  }

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

  async deleteProductVariant(
    productId: number,
    variantId: number,
    deletedByUserId: number,
  ): Promise<void> {
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

    // TODO: Dépendance - Check if variant is in use (stock movements, order items, composite items, product suppliers)
    // const isInUse = await this.variantRepository.isVariantInUse(variantId);
    // if (isInUse) {
    //   throw new BadRequestError(`Product variant '${variant.nameVariant}' is in use and cannot be deleted.`);
    // }

    try {
      await this.variantRepository.softDelete(variantId);
      // await this.variantRepository.update(variantId, { updatedByUserId: deletedByUserId }); // Audit
    } catch (error) {
      logger.error({ message: `Error deleting variant ${variantId}`, error });
      throw new ServerError('Error deleting product variant.');
    }
  }

  static getInstance(): ProductVariantService {
    if (!instance) {
      instance = new ProductVariantService();
    }
    return instance;
  }
}
