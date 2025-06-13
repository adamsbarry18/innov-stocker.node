import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  Not,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Product } from '../models/product.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
interface FindAllProductsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Product> | FindOptionsWhere<Product>[];
  order?: FindManyOptions<Product>['order'];
  relations?: string[];
}

export class ProductRepository {
  private readonly repository: Repository<Product>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Product);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'productCategory',
      'images',
      'variants',
      'variants.image',
      'productSuppliers',
      'productSuppliers.supplier',
      'productSuppliers.currency',
      'components',
      'components.componentProduct',
      'components.componentVariant',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['productCategory', 'images'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Product | null> {
    try {
      const product = await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
      if (product) {
        product.weight = product.weight !== null ? Number(product.weight) : null;
        product.length = product.length !== null ? Number(product.length) : null;
        product.width = product.width !== null ? Number(product.width) : null;
        product.height = product.height !== null ? Number(product.height) : null;
        product.defaultPurchasePrice =
          product.defaultPurchasePrice !== null ? Number(product.defaultPurchasePrice) : null;
        product.defaultSellingPriceHt =
          product.defaultSellingPriceHt !== null ? Number(product.defaultSellingPriceHt) : null;
        product.defaultVatRatePercentage =
          product.defaultVatRatePercentage !== null
            ? Number(product.defaultVatRatePercentage)
            : null;
      }
      return product;
    } catch (error) {
      logger.error(
        { message: `Error finding product with id ${id}`, error },
        'ProductRepository.findById',
      );
      throw new ServerError(`Error finding product with id ${id}.`);
    }
  }

  async findBySku(sku: string): Promise<Product | null> {
    try {
      return await this.repository.findOne({
        where: { sku, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding product by SKU '${sku}'`, error },
        'ProductRepository.findBySku',
      );
      throw new ServerError(`Error finding product by SKU '${sku}'.`);
    }
  }

  async findByBarcode(barcodeQrCode: string, excludeProductId?: number): Promise<Product | null> {
    if (!barcodeQrCode) return null;
    try {
      return await this.repository.findOne({
        where: {
          barcodeQrCode,
          deletedAt: IsNull(),
          ...(excludeProductId && { id: Not(excludeProductId) }),
        },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding product by barcode '${barcodeQrCode}'`, error },
        'ProductRepository.findByBarcode',
      );
      throw new ServerError(`Error finding product by barcode '${barcodeQrCode}'.`);
    }
  }

  async findAll(
    options: FindAllProductsOptions = {},
  ): Promise<{ products: Product[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<Product> = {
        where,
        order: options.order ?? { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [products, count] = await this.repository.findAndCount(findOptions);

      const productsWithNumbers = products.map((product) => {
        product.weight = product.weight !== null ? Number(product.weight) : null;
        product.length = product.length !== null ? Number(product.length) : null;
        product.width = product.width !== null ? Number(product.width) : null;
        product.height = product.height !== null ? Number(product.height) : null;
        product.defaultPurchasePrice =
          product.defaultPurchasePrice !== null ? Number(product.defaultPurchasePrice) : null;
        product.defaultSellingPriceHt =
          product.defaultSellingPriceHt !== null ? Number(product.defaultSellingPriceHt) : null;
        product.defaultVatRatePercentage =
          product.defaultVatRatePercentage !== null
            ? Number(product.defaultVatRatePercentage)
            : null;
        return product;
      });

      return { products: productsWithNumbers, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all products`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'ProductRepository.findAll',
      );
      throw new ServerError(`Error finding all products.`);
    }
  }

  create(dto: Partial<Product>): Product {
    return this.repository.create(dto);
  }

  async save(product: Product): Promise<Product> {
    try {
      return await this.repository.save(product);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_product_sku')) {
          throw new BadRequestError(`Product with SKU '${product.sku}' already exists.`);
        }
        if (
          product.barcodeQrCode &&
          (error.message?.includes('barcode_qr_code') ||
            error.message?.includes('barcodeQrCode_unique_if_not_null'))
        ) {
          throw new BadRequestError(
            `Product with Barcode/QR Code '${product.barcodeQrCode}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving product ${product.id || product.name}`, error },
        'ProductRepository.save',
      );
      throw new ServerError(`Error saving product.`);
    }
  }

  async update(id: number, dto: Partial<Product>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.sku && error.message?.includes('uq_product_sku')) {
          throw new BadRequestError(
            `Cannot update: Product with SKU '${dto.sku}' may already exist.`,
          );
        }
        if (
          dto.barcodeQrCode &&
          (error.message?.includes('barcode_qr_code') ||
            error.message?.includes('barcodeQrCode_unique_if_not_null'))
        ) {
          throw new BadRequestError(
            `Cannot update: Product with Barcode/QR Code '${dto.barcodeQrCode}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating product with id ${id}`, error },
        'ProductRepository.update',
      );
      throw new ServerError(`Error updating product with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting product with id ${id}`, error },
        'ProductRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting product with id ${id}.`);
    }
  }

  /* TODO
  async isProductInUse(productId: number): Promise<boolean> {
    logger.warn('ProductRepository.isProductInUse is a placeholder.');
    return false;
  }*/
}
