import {
  type DataSource,
  type Repository,
  IsNull,
  type FindOptionsWhere,
  type UpdateResult,
  Not,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ProductSupplier } from '../models/product-supplier.entity';

export class ProductSupplierRepository {
  private readonly repository: Repository<ProductSupplier>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ProductSupplier);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'supplier', 'currency'];
  }

  async findById(id: number): Promise<ProductSupplier | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product supplier link by id ${id}`, error });
      throw new ServerError('Error finding product supplier link.');
    }
  }


  async findSpecificLink(
    productId: number | null,
    productVariantId: number | null,
    supplierId: number,
  ): Promise<ProductSupplier | null> {
    try {
      const where: FindOptionsWhere<ProductSupplier> = { supplierId, deletedAt: IsNull() };
      if (productId) where.productId = productId;
      if (productVariantId) where.productVariantId = productVariantId;
      else where.productVariantId = IsNull();

      if (!productId && !productVariantId) {
        throw new BadRequestError(
          'Either productId or productVariantId must be provided to find a specific supplier link.',
        );
      }

      return await this.repository.findOne({ where });
    } catch (error) {
      logger.error({ message: 'Error finding specific product supplier link', error });
      throw new ServerError('Error finding specific product supplier link.');
    }
  }

  async findDefaultSupplierForProduct(productId: number): Promise<ProductSupplier | null> {
    try {
      return await this.repository.findOne({
        where: { productId, isDefaultSupplier: true, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding default supplier for product ${productId}`, error });
      throw new ServerError('Error finding default supplier.');
    }
  }

  async findDefaultSupplierForVariant(productVariantId: number): Promise<ProductSupplier | null> {
    try {
      return await this.repository.findOne({
        where: { productVariantId, isDefaultSupplier: true, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({
        message: `Error finding default supplier for variant ${productVariantId}`,
        error,
      });
      throw new ServerError('Error finding default supplier for variant.');
    }
  }

  create(dto: Partial<ProductSupplier>): ProductSupplier {
    return this.repository.create(dto);
  }

  async save(link: ProductSupplier): Promise<ProductSupplier> {
    try {
      return await this.repository.save(link);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('uq_product_supplier_link')
      ) {
        const itemType = link.productVariantId ? 'variant' : 'product';
        const itemId = link.productVariantId ?? link.productId;
        throw new BadRequestError(
          `Supplier ID ${link.supplierId} is already linked to this ${itemType} (ID: ${itemId}).`,
        );
      }
      logger.error({ message: 'Error saving product supplier link', error, link });
      throw new ServerError('Error saving product supplier link.');
    }
  }

  async update(id: number, dto: Partial<ProductSupplier>): Promise<UpdateResult> {
    // supplierId, productId, productVariantId are typically not changed for an existing link record.
    // Only price, code, isDefault.
    try {
      const { supplierId, productId, productVariantId, ...updateData } = dto;
      return await this.repository.update({ id, deletedAt: IsNull() }, updateData);
    } catch (error) {
      logger.error({ message: `Error updating product supplier link ${id}`, error, dto });
      throw new ServerError('Error updating product supplier link.');
    }
  }

  async unsetDefaultForOthers(
    productId: number | null,
    productVariantId: number | null,
    excludeLinktId: number,
  ): Promise<void> {
    try {
      const whereCondition: FindOptionsWhere<ProductSupplier> = {
        isDefaultSupplier: true,
        deletedAt: IsNull(),
        id: Not(excludeLinktId),
      };
      if (productId) {
        whereCondition.productId = productId;
        whereCondition.productVariantId = IsNull();
      } else if (productVariantId) {
        whereCondition.productVariantId = productVariantId;
      } else {
        return;
      }
      await this.repository.update(whereCondition, { isDefaultSupplier: false });
    } catch (error) {
      logger.error({ message: `Error unsetting default for other product suppliers`, error });
      throw new ServerError('Error updating default product supplier status.');
    }
  }

  async findByProductId(productId: number): Promise<ProductSupplier[]> {
    try {
      return await this.repository.find({
        where: { productId, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product suppliers for product ${productId}`, error });
      throw new ServerError('Error finding product suppliers.');
    }
  }

  async findByProductVariantId(productVariantId: number): Promise<ProductSupplier[]> {
    try {
      return await this.repository.find({
        where: { productVariantId, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product suppliers for variant ${productVariantId}`, error });
      throw new ServerError('Error finding product suppliers.');
    }
  }

  async findBySupplierId(supplierId: number): Promise<ProductSupplier[]> {
    try {
      return await this.repository.find({
        where: { supplierId, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product suppliers for supplier ${supplierId}`, error });
      throw new ServerError('Error finding product suppliers.');
    }
  }

  async findByCurrencyId(currencyId: number): Promise<ProductSupplier[]> {
    try {
      return await this.repository.find({
        where: { currencyId, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding product suppliers for currency ${currencyId}`, error });
      throw new ServerError('Error finding product suppliers.');
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting product supplier link ${id}`, error });
      throw new ServerError('Error soft-deleting product supplier link.');
    }
  }
}
