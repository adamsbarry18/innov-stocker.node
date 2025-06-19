import { type DataSource, type Repository, IsNull, type UpdateResult, Not } from 'typeorm';
import { appDataSource } from '@/database/data-source';
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
import { DeliveryItem } from '@/modules/deliveries/delivery-items';
import { ProductVariant } from '../models/product-variant.entity';
import { CustomerReturnItem } from '@/modules/customer-returns/customer-return-items/models/customer-return-item.entity';
import { CompositeProductItem } from '@/modules/products';

export class ProductVariantRepository {
  private readonly repository: Repository<ProductVariant>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ProductVariant);
  }

  public async findByBarcodeQrCodeVariant(
    barcodeQrCodeVariant: string,
    excludeId?: number,
  ): Promise<ProductVariant | null> {
    const where: any = {
      barcodeQrCodeVariant,
      deletedAt: IsNull(),
    };
    if (excludeId !== undefined) {
      where.id = Not(excludeId);
    }
    return this.repository.findOneBy(where);
  }

  private getDefaultRelations(): string[] {
    return ['image', 'product'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<ProductVariant | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding product variant by id ${id}`, error });
      throw new ServerError('Error finding product variant.');
    }
  }

  async findByProductId(
    productId: number,
    options?: { relations?: string[] },
  ): Promise<ProductVariant[]> {
    try {
      return await this.repository.find({
        where: { productId, deletedAt: IsNull() },
        order: { nameVariant: 'ASC' },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding variants for product ${productId}`, error });
      throw new ServerError('Error finding product variants.');
    }
  }

  async findBySkuVariant(skuVariant: string): Promise<ProductVariant | null> {
    try {
      return await this.repository.findOne({
        where: { skuVariant, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product variant by SKU ${skuVariant}`, error });
      throw new ServerError('Error finding product variant by SKU.');
    }
  }

  create(dto: Partial<ProductVariant>): ProductVariant {
    return this.repository.create(dto);
  }

  async save(variant: ProductVariant): Promise<ProductVariant> {
    try {
      return await this.repository.save(variant);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_variant_sku')) {
          throw new BadRequestError(
            `Product variant with SKU '${variant.skuVariant}' already exists.`,
          );
        }
        if (
          variant.barcodeQrCodeVariant &&
          (error.message as string).includes('uq_variant_barcode')
        ) {
          throw new BadRequestError(
            `Product variant with Barcode '${variant.barcodeQrCodeVariant}' already exists.`,
          );
        }
      }
      logger.error({ message: 'Error saving product variant', error, variant });
      throw new ServerError('Error saving product variant.');
    }
  }

  async update(id: number, dto: Partial<ProductVariant>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if (dto.skuVariant && (error.message as string).includes('uq_variant_sku')) {
          throw new BadRequestError(
            `Cannot update: Product variant with SKU '${dto.skuVariant}' may already exist.`,
          );
        }
        if (dto.barcodeQrCodeVariant && (error.message as string).includes('uq_variant_barcode')) {
          throw new BadRequestError(
            `Cannot update: Product variant with Barcode '${dto.barcodeQrCodeVariant}' may already exist.`,
          );
        }
      }
      logger.error({ message: `Error updating product variant ${id}`, error, dto });
      throw new ServerError('Error updating product variant.');
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting product variant ${id}`, error });
      throw new ServerError('Error soft-deleting product variant.');
    }
  }

  async isProductVariantInUse(variantId: number): Promise<boolean> {
    const manager = this.repository.manager;

    // Check CompositeProductItems (as component_variant_id)
    const compositeItemCount = await manager
      .getRepository(CompositeProductItem)
      .count({ where: { componentVariantId: variantId, deletedAt: IsNull() } });
    if (compositeItemCount > 0) return true;

    // Check StockMovements
    const stockMovementCount = await manager
      .getRepository(StockMovement)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (stockMovementCount > 0) return true;

    // Check InventorySessionItems
    const inventorySessionItemCount = await manager
      .getRepository(InventorySessionItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (inventorySessionItemCount > 0) return true;

    // Check StockTransferItems
    const stockTransferItemCount = await manager
      .getRepository(StockTransferItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (stockTransferItemCount > 0) return true;

    // Check PurchaseOrderItems
    const purchaseOrderItemCount = await manager
      .getRepository(PurchaseOrderItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (purchaseOrderItemCount > 0) return true;

    // Check PurchaseReceptionItems
    const purchaseReceptionItemCount = await manager
      .getRepository(PurchaseReceptionItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (purchaseReceptionItemCount > 0) return true;

    // Check SupplierReturnItems
    const supplierReturnItemCount = await manager
      .getRepository(SupplierReturnItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (supplierReturnItemCount > 0) return true;

    // Check QuoteItems
    const quoteItemCount = await manager
      .getRepository(QuoteItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (quoteItemCount > 0) return true;

    // Check SalesOrderItems
    const salesOrderItemCount = await manager
      .getRepository(SalesOrderItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (salesOrderItemCount > 0) return true;

    // Check DeliveryItems
    const deliveryItemCount = await manager
      .getRepository(DeliveryItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (deliveryItemCount > 0) return true;

    // Check CustomerReturnItems
    const customerReturnItemCount = await manager
      .getRepository(CustomerReturnItem)
      .count({ where: { productVariantId: variantId, deletedAt: IsNull() } });
    if (customerReturnItemCount > 0) return true;

    return false;
  }
}
