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
import { StockMovement } from '@/modules/stock-movements';
import { InventorySessionItem } from '@/modules/inventory-sessions';
import { StockTransferItem } from '@/modules/stock-transfers';
import { PurchaseOrderItem } from '@/modules/purchase-orders';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions';
import { SupplierReturnItem } from '@/modules/supplier-returns';
import { QuoteItem } from '@/modules/quotes';
import { SalesOrderItem } from '@/modules/sales-orders';
import { CompositeProductItem } from '../composite-product-items/models/composite-product-item.entity';
import { DeliveryItem } from '@/modules/deliveries/delivery-items';
import { CustomerReturnItem } from '@/modules/customer-returns/customer-return-items/models/customer-return-item.entity';

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
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_product_sku')) {
          throw new BadRequestError(`Product with SKU '${product.sku}' already exists.`);
        }
        if (
          product.barcodeQrCode &&
          ((error.message as string).includes('barcode_qr_code') ||
            (error.message as string).includes('barcodeQrCode_unique_if_not_null'))
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
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if (dto.sku && (error.message as string).includes('uq_product_sku')) {
          throw new BadRequestError(
            `Cannot update: Product with SKU '${dto.sku}' may already exist.`,
          );
        }
        if (
          (dto.barcodeQrCode && (error.message as string).includes('barcode_qr_code')) ||
          (error.message as string).includes('barcodeQrCode_unique_if_not_null')
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

  async isProductInUse(productId: number): Promise<boolean> {
    const manager = this.repository.manager;

    // Check CompositeProductItems (as component_product_id)
    const compositeItemCount = await manager
      .getRepository(CompositeProductItem)
      .count({ where: { componentProductId: productId, deletedAt: IsNull() } });
    if (compositeItemCount > 0) return true;

    // Check StockMovements
    const stockMovementCount = await manager
      .getRepository(StockMovement)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (stockMovementCount > 0) return true;

    // Check InventorySessionItems
    const inventorySessionItemCount = await manager
      .getRepository(InventorySessionItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (inventorySessionItemCount > 0) return true;

    // Check StockTransferItems
    const stockTransferItemCount = await manager
      .getRepository(StockTransferItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (stockTransferItemCount > 0) return true;

    // Check PurchaseOrderItems
    const purchaseOrderItemCount = await manager
      .getRepository(PurchaseOrderItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (purchaseOrderItemCount > 0) return true;

    // Check PurchaseReceptionItems
    const purchaseReceptionItemCount = await manager
      .getRepository(PurchaseReceptionItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (purchaseReceptionItemCount > 0) return true;

    // Check SupplierReturnItems
    const supplierReturnItemCount = await manager
      .getRepository(SupplierReturnItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (supplierReturnItemCount > 0) return true;

    // Check QuoteItems
    const quoteItemCount = await manager
      .getRepository(QuoteItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (quoteItemCount > 0) return true;

    // Check SalesOrderItems
    const salesOrderItemCount = await manager
      .getRepository(SalesOrderItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (salesOrderItemCount > 0) return true;

    // Check DeliveryItems
    const deliveryItemCount = await manager
      .getRepository(DeliveryItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (deliveryItemCount > 0) return true;

    // Check CustomerReturnItems
    const customerReturnItemCount = await manager
      .getRepository(CustomerReturnItem)
      .count({ where: { productId, deletedAt: IsNull() } });
    if (customerReturnItemCount > 0) return true;

    return false;
  }
}
