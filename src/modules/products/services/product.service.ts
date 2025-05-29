import { appDataSource } from '@/database/data-source';
import { IsNull, type FindManyOptions, type FindOptionsWhere, Not } from 'typeorm';

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
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { CompositeProductItemRepository } from '@/modules/composite-product-items/data/composite-product-item.repository';
import { ProductCategoryRepository } from '@/modules/product-categories/data/product-category.repository';
import { ProductSupplierRepository } from '@/modules/product-suppliers/data/product-supplier.repository';
import { SupplierRepository } from '@/modules/suppliers/data/supplier.repository';
import { CurrencyRepository } from '@/modules/currencies/data/currency.repository';
import { UserRepository } from '@/modules/users';
import {
  ProductImage,
  productImageValidationInputErrors,
  type CreateProductImageInput,
  type ProductImageApiResponse,
  type UpdateProductImageInput,
} from '@/modules/product-images/models/product-image.entity';
import {
  type ProductVariant,
  type ProductVariantApiResponse,
} from '@/modules/product-variants/models/product-variant.entity';
import {
  type ProductSupplier,
  type ProductSupplierApiResponse,
} from '@/modules/product-suppliers/models/product-supplier.entity';
import { type CompositeProductItem } from '@/modules/composite-product-items/models/composite-product-item.entity';

// TODO: Dépendance - Importer StockMovementRepository quand il existera
// import { StockMovementRepository } from '../../stock-movements/data/stock-movement.repository';
// import { type StockMovementApiResponse } from '../../stock-movements/models/stock-movement.entity';

let instance: ProductService | null = null;

export class ProductService {
  private readonly productRepository: ProductRepository;
  private readonly imageRepository: ProductImageRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly compositeItemRepository: CompositeProductItemRepository;
  private readonly productSupplierRepository: ProductSupplierRepository;
  private readonly categoryRepository: ProductCategoryRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly userRepository: UserRepository;
  // TODO: Dépendance - private readonly stockMovementRepository: StockMovementRepository;

  constructor(
    productRepository: ProductRepository = new ProductRepository(),
    imageRepository: ProductImageRepository = new ProductImageRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    compositeItemRepository: CompositeProductItemRepository = new CompositeProductItemRepository(),
    productSupplierRepository: ProductSupplierRepository = new ProductSupplierRepository(),
    categoryRepository: ProductCategoryRepository = new ProductCategoryRepository(),
    supplierRepository: SupplierRepository = new SupplierRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    userRepository: UserRepository = new UserRepository(),
    // stockMovementRepository: StockMovementRepository = new StockMovementRepository(),
  ) {
    this.productRepository = productRepository;
    this.imageRepository = imageRepository;
    this.variantRepository = variantRepository;
    this.compositeItemRepository = compositeItemRepository;
    this.productSupplierRepository = productSupplierRepository;
    this.categoryRepository = categoryRepository;
    this.supplierRepository = supplierRepository;
    this.currencyRepository = currencyRepository;
    this.userRepository = userRepository;
    // TODO: this.stockMovementRepository = stockMovementRepository;
  }

  mapProductToApiResponse(
    product: Product | null,
    options?: { includeRelations?: boolean },
  ): ProductApiResponse | null {
    if (!product) return null;
    return product.toApi(options);
  }
  mapImageToApiResponse(image: ProductImage | null): ProductImageApiResponse | null {
    if (!image) return null;
    return image.toApi();
  }
  mapVariantToApiResponse(
    variant: ProductVariant | null,
    options?: { includeProductSuppliers?: boolean },
  ): ProductVariantApiResponse | null {
    if (!variant) return null;
    return variant.toApi(options);
  }
  mapProductSupplierToApiResponse(ps: ProductSupplier | null): ProductSupplierApiResponse | null {
    if (!ps) return null;
    return ps.toApi();
  }
  mapCompositeItemToApiResponse(item: CompositeProductItem | null): any {
    // Remplacez any par le type DTO si défini
    if (!item) return null;
    return item.toApi();
  }

  // --- Product Core Methods ---

  async createProduct(
    input: CreateProductInput,
    createdByUserId: number,
  ): Promise<ProductApiResponse> {
    const category = await this.categoryRepository.findById(input.productCategoryId);
    if (!category) {
      throw new BadRequestError(`Product category with ID ${input.productCategoryId} not found.`);
    }
    const existingBySku = await this.productRepository.findBySku(input.sku);
    if (existingBySku) {
      throw new BadRequestError(`Product with SKU '${input.sku}' already exists.`);
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

  async findAllProducts(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Product> | FindOptionsWhere<Product>[];
    sort?: FindManyOptions<Product>['order'];
    searchTerm?: string;
  }): Promise<{ products: ProductApiResponse[]; total: number }> {
    try {
      const { products, count } = await this.productRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' },
        searchTerm: options?.searchTerm,
        relations: this.productRepository['getDefaultRelationsForFindAll'](), // Lighter relations for list
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

  async deleteProduct(productId: number, deletedByUserId: number): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError(`Product with id ${productId} not found.`);

    // TODO: Dépendance - Vérifier si le produit est utilisé dans des transactions, stocks, etc.
    // const isInUse = await this.productRepository.isProductInUse(productId);
    // if (isInUse) {
    //   throw new BadRequestError(`Product '${product.name}' is in use (e.g., in orders, stock) and cannot be deleted.`);
    // }

    // Soft delete cascades to images, variants, productSuppliers, components if DB constraints or TypeORM relations are set up for it.
    // Or handle manually here within a transaction.
    // For now, assuming direct soft delete is sufficient for the product entity itself.
    try {
      await this.productRepository.softDelete(productId);
      // Also set updatedByUserId if Model doesn't do it on softDelete
      // await this.productRepository.update(productId, { updatedByUserId: deletedByUserId });
    } catch (error) {
      logger.error(
        { message: `Error deleting product ${productId}`, error },
        'ProductService.deleteProduct',
      );
      throw new ServerError(`Error deleting product ${productId}.`);
    }
  }

  // --- ProductImage Methods ---
  async addProductImage(
    productId: number,
    input: CreateProductImageInput,
    userId: number,
  ): Promise<ProductImageApiResponse> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError(`Product with ID ${productId} not found.`);

    if (input.isPrimary) {
      // Unset other primary images for this product
      await this.imageRepository.unsetPrimaryForOtherImages(productId, -1); // -1 as no current image id yet
    }

    const imageEntity = this.imageRepository.create({ ...input, productId });
    if (!imageEntity.isValid()) {
      throw new BadRequestError(
        `Product image data invalid: ${productImageValidationInputErrors.join(', ')}`,
      );
    }
    const savedImage = await this.imageRepository.save(imageEntity);
    return this.mapImageToApiResponse(savedImage) as ProductImageApiResponse;
  }

  async getProductImages(productId: number): Promise<ProductImageApiResponse[]> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundError(`Product with ID ${productId} not found.`);
    const images = await this.imageRepository.findByProductId(productId);
    return images
      .map((img) => this.mapImageToApiResponse(img))
      .filter(Boolean) as ProductImageApiResponse[];
  }

  async updateProductImage(
    productId: number,
    imageId: number,
    input: UpdateProductImageInput,
    userId: number,
  ): Promise<ProductImageApiResponse> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }
    if (input.isPrimary && input.isPrimary === true) {
      await this.imageRepository.unsetPrimaryForOtherImages(productId, imageId);
    }

    await this.imageRepository.update(imageId, input);
    const updatedImage = await this.imageRepository.findById(imageId);
    return this.mapImageToApiResponse(updatedImage) as ProductImageApiResponse;
  }

  async deleteProductImage(productId: number, imageId: number, userId: number): Promise<void> {
    const image = await this.imageRepository.findById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError(`Image with ID ${imageId} not found for product ${productId}.`);
    }
    if (image.isPrimary) {
      throw new BadRequestError(
        'Cannot delete the primary image. Set another image as primary first.',
      );
    }
    await this.imageRepository.softDelete(imageId);
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

    await appDataSource.transaction(async (transactionalEntityManager) => {
      const imageRepoTx = transactionalEntityManager.getRepository(ProductImage);
      // Unset current primary image for the product
      await imageRepoTx.update(
        { productId: productId, isPrimary: true, deletedAt: IsNull(), id: Not(imageId) },
        { isPrimary: false },
      );
      // Set the new primary image
      await imageRepoTx.update(imageId, { isPrimary: true });
    });

    const updatedImage = await this.imageRepository.findById(imageId);
    return this.mapImageToApiResponse(updatedImage) as ProductImageApiResponse;
  }

  // --- ProductVariant Methods ---
  // (Similar CRUD: addProductVariant, getProductVariants, updateProductVariant, deleteProductVariant)
  // ... Implémentation pour les variantes ici ...

  // --- ProductSupplier Methods ---
  // ... Implémentation pour les fournisseurs de produits ici ...

  // --- CompositeProductItem Methods ---
  // ... Implémentation pour la composition des produits ici ...

  // --- Stock Information Methods (Stubs) ---
  async getProductStockMovements(productId: number, options?: any): Promise<any[]> {
    if (!(await this.productRepository.findById(productId))) {
      throw new NotFoundError(`Product with id ${productId} not found.`);
    }
    return [];
  }

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

  static getInstance(): ProductService {
    if (!instance) {
      instance = new ProductService();
    }
    return instance;
  }
}
