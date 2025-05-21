import { type DataSource, type Repository, IsNull, type UpdateResult } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductVariant } from '../models/product-variant.entity';

export class ProductVariantRepository {
  private readonly repository: Repository<ProductVariant>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ProductVariant);
  }

  private getDefaultRelations(): string[] {
    return [
      'image',
      'product' /* 'createdByUser', 'updatedByUser', 'productSuppliers', 'productSuppliers.supplier', 'productSuppliers.currency' */,
    ];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<ProductVariant | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
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
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
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
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_variant_sku')) {
          throw new BadRequestError(
            `Product variant with SKU '${variant.skuVariant}' already exists.`,
          );
        }
        if (variant.barcodeQrCodeVariant && error.message?.includes('uq_variant_barcode')) {
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
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.skuVariant && error.message?.includes('uq_variant_sku')) {
          throw new BadRequestError(
            `Cannot update: Product variant with SKU '${dto.skuVariant}' may already exist.`,
          );
        }
        if (dto.barcodeQrCodeVariant && error.message?.includes('uq_variant_barcode')) {
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
      // TODO: Check dependencies (e.g., stock movements, order items) in service layer
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting product variant ${id}`, error });
      throw new ServerError('Error soft-deleting product variant.');
    }
  }
}
