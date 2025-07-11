import {
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductApiResponse,
  productValidationInputErrors,
} from '../models/product.entity';

import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductRepository } from '../data/product.repository';
import { ProductImageRepository } from '@/modules/product-images/data/product-image.repository';
import { ProductCategoryRepository } from '@/modules/product-categories/data/product-category.repository';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';

let instance: ProductService | null = null;

export class ProductService {
  private readonly productRepository: ProductRepository;
  private readonly imageRepository: ProductImageRepository;
  private readonly categoryRepository: ProductCategoryRepository;

  /**
   * Creates an instance of ProductService.
   * @param productRepository - The product repository.
   * @param imageRepository - The product image repository.
   * @param categoryRepository - The product category repository.
   */
  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    imageRepository: ProductImageRepository = new ProductImageRepository(),
    categoryRepository: ProductCategoryRepository = new ProductCategoryRepository(),
  ) {
    this.productRepository = productRepository;
    this.imageRepository = imageRepository;
    this.categoryRepository = categoryRepository;
  }

  /**
   * Maps a Product entity to a ProductApiResponse.
   * @param product - The product entity.
   * @param options - Options for including relations.
   * @returns The API response for the product, or null if the product is null.
   */
  mapProductToApiResponse(
    product: Product | null,
    options?: { includeRelations?: boolean },
  ): ProductApiResponse | null {
    if (!product) return null;
    return product.toApi(options);
  }

  /**
   * Creates a new product.
   * @param input - The input data for creating the product.
   * @param createdByUserId - The ID of the user who created the product.
   * @returns The API response for the created product.
   */
  async createProduct(
    input: CreateProductInput,
    createdByUserId: number,
  ): Promise<ProductApiResponse> {
    if (input.sku) {
      const existingBySku = await this.productRepository.findBySku(input.sku);
      if (existingBySku) {
        throw new BadRequestError(`Product with SKU '${input.sku}' already exists.`);
      }
    }
    if (input.barcodeQrCode) {
      const existingByBarcode = await this.productRepository.findByBarcode(input.barcodeQrCode);
      if (existingByBarcode) {
        throw new BadRequestError(`Product with barcode '${input.barcodeQrCode}' already exists.`);
      }
    }

    const productEntity = this.productRepository.create({
      ...input,
      createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!productEntity.isValid()) {
      throw new BadRequestError(
        `Product data is invalid. Errors: ${productValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedProduct = await this.productRepository.save(productEntity);

      const populatedProduct = await this.productRepository.findById(savedProduct.id, {
        relations: this.productRepository['getDefaultRelationsForFindOne'](),
      });
      const apiResponse = this.mapProductToApiResponse(populatedProduct, {
        includeRelations: true,
      });
      if (!apiResponse) throw new ServerError('Failed to map created product.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PRODUCT_MANAGEMENT,
        savedProduct.id.toString(),
        { productName: savedProduct.name, productSku: savedProduct.sku },
      );

      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error creating product`, error, input },
        'ProductService.createProduct',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create product.');
    }
  }

  /**
   * Finds a product by its ID.
   * @param productId - The ID of the product to find.
   * @param includeFullRelations - Whether to include full relations in the response.
   * @returns The API response for the found product.
   */
  async findProductById(
    productId: number,
    includeFullRelations: boolean = true,
  ): Promise<ProductApiResponse> {
    try {
      const relations = includeFullRelations
        ? this.productRepository['getDefaultRelationsForFindOne']()
        : this.productRepository['getDefaultRelationsForFindAll']();
      const product = await this.productRepository.findById(productId, { relations });
      if (!product) throw new NotFoundError(`Product with id ${productId} not found.`);

      const apiResponse = this.mapProductToApiResponse(product, {
        includeRelations: includeFullRelations,
      });
      if (!apiResponse) throw new ServerError(`Failed to map product ${productId}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding product by id ${productId}`, error },
        'ProductService.findProductById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding product by id ${productId}.`);
    }
  }

  /**
   * Finds all products based on the provided options.
   * @param options - Options for filtering, pagination, and sorting.
   * @returns An object containing the list of products and the total count.
   */
  async findAllProducts(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Product> | FindOptionsWhere<Product>[];
    sort?: FindManyOptions<Product>['order'];
  }): Promise<{ products: ProductApiResponse[]; total: number }> {
    try {
      const { products, count } = await this.productRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
        relations: this.productRepository['getDefaultRelationsForFindAll'](),
      });
      const apiProducts = products
        .map((p) => this.mapProductToApiResponse(p, { includeRelations: false }))
        .filter(Boolean) as ProductApiResponse[];
      return { products: apiProducts, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all products`, error, options },
        'ProductService.findAllProducts',
      );
      throw new ServerError('Error finding all products.');
    }
  }

  /**
   * Updates an existing product.
   * @param productId - The ID of the product to update.
   * @param input - The input data for updating the product.
   * @param updatedByUserId - The ID of the user who updated the product.
   * @returns The API response for the updated product.
   */
  async updateProduct(
    productId: number,
    input: UpdateProductInput,
    updatedByUserId: number,
  ): Promise<ProductApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError(`Product with id ${productId} not found.`);

    if (input.sku && input.sku !== product.sku) {
      const existingBySku = await this.productRepository.findBySku(input.sku);
      if (existingBySku && existingBySku.id !== productId) {
        throw new BadRequestError(`Another product with SKU '${input.sku}' already exists.`);
      }
    }
    if (input.barcodeQrCode && input.barcodeQrCode !== product.barcodeQrCode) {
      const existingByBarcode = await this.productRepository.findByBarcode(
        input.barcodeQrCode,
        productId,
      );
      if (existingByBarcode) {
        throw new BadRequestError(
          `Another product with barcode '${input.barcodeQrCode}' already exists.`,
        );
      }
    }
    if (input.productCategoryId && input.productCategoryId !== product.productCategoryId) {
      const category = await this.categoryRepository.findById(input.productCategoryId);
      if (!category) {
        throw new BadRequestError(`Product category with ID ${input.productCategoryId} not found.`);
      }
    }

    const tempProductData = { ...product, ...input, updatedByUserId };
    const tempProduct = this.productRepository.create(tempProductData);
    if (!tempProduct.isValid()) {
      throw new BadRequestError(
        `Updated product data is invalid. Errors: ${productValidationInputErrors.join(', ')}`,
      );
    }

    const updatePayload: Partial<Product> = { ...input, updatedByUserId };
    if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
      return this.mapProductToApiResponse(product, {
        includeRelations: true,
      }) as ProductApiResponse;
    }

    try {
      const result = await this.productRepository.update(productId, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.productRepository.findById(productId); // Re-check
        if (!stillExists)
          throw new NotFoundError(`Product with id ${productId} not found during update.`);
      }

      const updatedProduct = await this.productRepository.findById(productId, {
        relations: this.productRepository['getDefaultRelationsForFindOne'](),
      });
      if (!updatedProduct) throw new ServerError('Failed to re-fetch product after update.');

      const apiResponse = this.mapProductToApiResponse(updatedProduct, { includeRelations: true });
      if (!apiResponse) throw new ServerError(`Failed to map updated product ${productId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PRODUCT_MANAGEMENT,
        productId.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating product ${productId}`, error, input },
        'ProductService.updateProduct',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update product ${productId}.`);
    }
  }

  /**
   * Deletes a product by its ID.
   * @param productId - The ID of the product to delete.
   */
  async deleteProduct(productId: number): Promise<void> {
    try {
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${productId} not found.`);
      }

      const isUsed = await this.productRepository.isProductInUse(productId);
      if (isUsed) {
        throw new BadRequestError(
          `Product with ID ${productId} is currently in use by other entities and cannot be deleted.`,
        );
      }

      await this.productRepository.softDelete(productId);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PRODUCT_MANAGEMENT,
        productId.toString(),
      );
    } catch (error) {
      logger.error(`Error deleting product ${productId}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServerError(`Error deleting product ${productId}.`);
    }
  }

  /**
   * Retrieves stock movements for a specific product.
   * @param productId - The ID of the product.
   * @param options - Optional parameters.
   * @returns An array of stock movements.
   */
  async getProductStockMovements(productId: number): Promise<any[]> {
    if (!(await this.productRepository.findById(productId))) {
      throw new NotFoundError(`Product with id ${productId} not found.`);
    }
    return [];
  }

  /**
   * Retrieves the current stock for a specific product.
   * @param productId - The ID of the product.
   * @param warehouseId - Optional warehouse ID to filter stock.
   * @param shopId - Optional shop ID to filter stock.
   * @returns An object containing product stock information.
   */
  async getProductCurrentStock(
    productId: number,
    warehouseId?: number,
    shopId?: number,
  ): Promise<any> {
    if (!(await this.productRepository.findById(productId))) {
      throw new NotFoundError(`Product with id ${productId} not found.`);
    }
    return { productId, warehouseId, shopId, quantity: 0, lastUpdated: new Date().toISOString() };
  }

  /**
   * Returns a singleton instance of the ProductService.
   * @returns The singleton instance of ProductService.
   */
  static getInstance(): ProductService {
    instance ??= new ProductService();
    return instance;
  }
}
