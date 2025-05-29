import { SupplierRepository } from '../../suppliers/data/supplier.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import {
  type ProductSupplier,
  type CreateProductSupplierForProductInput,
  type CreateProductSupplierForVariantInput,
  type UpdateProductSupplierInput,
  type ProductSupplierApiResponse,
  productSupplierValidationInputErrors,
} from '../models/product-supplier.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { ProductSupplierRepository } from '../data/product-supplier.repository';

let instance: ProductSupplierService | null = null;

export class ProductSupplierService {
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly productSupplierRepository: ProductSupplierRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly currencyRepository: CurrencyRepository;

  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    productSupplierRepository: ProductSupplierRepository = new ProductSupplierRepository(),
    supplierRepository: SupplierRepository = new SupplierRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
  ) {
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.productSupplierRepository = productSupplierRepository;
    this.supplierRepository = supplierRepository;
    this.currencyRepository = currencyRepository;
  }

  mapToApiResponse(ps: ProductSupplier | null): ProductSupplierApiResponse | null {
    if (!ps) return null;
    return ps.toApi();
  }

  private async validateCommonInput(input: {
    supplierId: number;
    currencyId: number;
  }): Promise<void> {
    const supplier = await this.supplierRepository.findById(input.supplierId);
    if (!supplier) {
      throw new BadRequestError(`Supplier with ID ${input.supplierId} not found.`);
    }
    const currency = await this.currencyRepository.findById(input.currencyId);
    if (!currency) {
      throw new BadRequestError(`Currency with ID ${input.currencyId} not found.`);
    }
  }

  async addSupplierToProduct(
    productId: number,
    input: Omit<CreateProductSupplierForProductInput, 'productId'>, // productId comes from path
    createdByUserId: number,
  ): Promise<ProductSupplierApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    await this.validateCommonInput(input);

    const existingLink = await this.productSupplierRepository.findSpecificLink(
      productId,
      null,
      input.supplierId,
    );
    if (existingLink) {
      throw new BadRequestError(
        `Supplier ID ${input.supplierId} is already linked to product ID ${productId}.`,
      );
    }

    if (input.isDefaultSupplier) {
      await this.productSupplierRepository.unsetDefaultForOthers(productId, null, -1);
    }

    const psEntity = this.productSupplierRepository.create({
      ...input,
      productId,
      productVariantId: null,
      // createdByUserId: createdByUserId, // If entity has this
    });

    if (!psEntity.isValid()) {
      throw new BadRequestError(
        `Product supplier data invalid: ${productSupplierValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedPs = await this.productSupplierRepository.save(psEntity);
      const populatedPs = await this.productSupplierRepository.findById(savedPs.id);
      const apiResponse = this.mapToApiResponse(populatedPs);
      if (!apiResponse) throw new ServerError('Failed to map created product supplier link.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error adding supplier to product ${productId}`, error, input });
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to add supplier to product.');
    }
  }

  async addSupplierToVariant(
    productId: number,
    variantId: number,
    input: Omit<CreateProductSupplierForVariantInput, 'productVariantId'>, // variantId comes from path
    createdByUserId: number,
  ): Promise<ProductSupplierApiResponse> {
    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new NotFoundError(
        `Product variant with ID ${variantId} not found for product ${productId}.`,
      );
    }
    await this.validateCommonInput(input);

    const existingLink = await this.productSupplierRepository.findSpecificLink(
      null,
      variantId,
      input.supplierId,
    );
    if (existingLink) {
      throw new BadRequestError(
        `Supplier ID ${input.supplierId} is already linked to product variant ID ${variantId}.`,
      );
    }

    if (input.isDefaultSupplier) {
      await this.productSupplierRepository.unsetDefaultForOthers(null, variantId, -1);
    }

    const psEntity = this.productSupplierRepository.create({
      ...input,
      productId: null, // Explicitly null as it's for a variant
      productVariantId: variantId,
      // createdByUserId: createdByUserId,
    });

    if (!psEntity.isValid()) {
      throw new BadRequestError(
        `Product variant supplier data invalid: ${productSupplierValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedPs = await this.productSupplierRepository.save(psEntity);
      const populatedPs = await this.productSupplierRepository.findById(savedPs.id);
      const apiResponse = this.mapToApiResponse(populatedPs);
      if (!apiResponse)
        throw new ServerError('Failed to map created product variant supplier link.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error adding supplier to variant ${variantId}`, error, input });
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to add supplier to product variant.');
    }
  }

  async getProductSuppliers(productId: number): Promise<ProductSupplierApiResponse[]> {
    if (!(await this.productRepository.findById(productId))) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }
    const links = await this.productSupplierRepository.findByProductId(productId);
    return links
      .map((ps) => this.mapToApiResponse(ps))
      .filter(Boolean) as ProductSupplierApiResponse[];
  }

  async getProductVariantSuppliers(
    productId: number,
    variantId: number,
  ): Promise<ProductSupplierApiResponse[]> {
    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new NotFoundError(
        `Product variant with ID ${variantId} not found for product ${productId}.`,
      );
    }
    const links = await this.productSupplierRepository.findByProductVariantId(variantId);
    return links
      .map((ps) => this.mapToApiResponse(ps))
      .filter(Boolean) as ProductSupplierApiResponse[];
  }

  async getProductSupplierLink(linkId: number): Promise<ProductSupplierApiResponse> {
    const link = await this.productSupplierRepository.findById(linkId);
    if (!link) {
      throw new NotFoundError(`Product supplier link with ID ${linkId} not found.`);
    }
    // TODO: Authorization - ensure user can view this link, potentially based on product/variant access
    const apiResponse = this.mapToApiResponse(link);
    if (!apiResponse) throw new ServerError('Failed to map product supplier link.');
    return apiResponse;
  }

  async updateProductSupplierLink(
    linkId: number,
    input: UpdateProductSupplierInput,
    updatedByUserId: number,
  ): Promise<ProductSupplierApiResponse> {
    const link = await this.productSupplierRepository.findById(linkId);
    if (!link) {
      throw new NotFoundError(`Product supplier link with ID ${linkId} not found.`);
    }

    // Validate currency if changed
    if (input.currencyId && input.currencyId !== link.currencyId) {
      if (!(await this.currencyRepository.findById(input.currencyId))) {
        throw new BadRequestError(`New currency with ID ${input.currencyId} not found.`);
      }
    }

    const tempLinkData = { ...link, ...input };
    const tempLink = this.productSupplierRepository.create(tempLinkData);
    if (!tempLink.isValid()) {
      throw new BadRequestError(
        `Updated product supplier data invalid: ${productSupplierValidationInputErrors.join(', ')}`,
      );
    }

    const updatePayload: Partial<ProductSupplier> = { ...input };
    // updatePayload.updatedByUserId = updatedByUserId; // If entity has this

    if (Object.keys(updatePayload).length === 0 && !input.hasOwnProperty('isDefaultSupplier')) {
      return this.mapToApiResponse(link) as ProductSupplierApiResponse;
    }

    if (input.isDefaultSupplier === true && !link.isDefaultSupplier) {
      await this.productSupplierRepository.unsetDefaultForOthers(
        link.productId,
        link.productVariantId,
        linkId,
      );
    }

    try {
      const result = await this.productSupplierRepository.update(linkId, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.productSupplierRepository.findById(linkId);
        if (!stillExists)
          throw new NotFoundError(
            `Product supplier link with ID ${linkId} not found during update.`,
          );
      }

      const updatedLink = await this.productSupplierRepository.findById(linkId);
      if (!updatedLink)
        throw new ServerError('Failed to re-fetch product supplier link after update.');

      const apiResponse = this.mapToApiResponse(updatedLink);
      if (!apiResponse) throw new ServerError('Failed to map updated product supplier link.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error updating product supplier link ${linkId}`, error, input });
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError('Failed to update product supplier link.');
    }
  }

  async deleteProductSupplierLink(linkId: number, deletedByUserId: number): Promise<void> {
    const link = await this.productSupplierRepository.findById(linkId);
    if (!link) {
      throw new NotFoundError(`Product supplier link with ID ${linkId} not found.`);
    }
    // No specific dependencies to check for deletion of the link itself, as it's a linking table record.
    try {
      await this.productSupplierRepository.softDelete(linkId);
    } catch (error) {
      logger.error({ message: `Error deleting product supplier link ${linkId}`, error });
      throw new ServerError('Error deleting product supplier link.');
    }
  }

  static getInstance(): ProductSupplierService {
    if (!instance) {
      instance = new ProductSupplierService();
    }
    return instance;
  }
}
