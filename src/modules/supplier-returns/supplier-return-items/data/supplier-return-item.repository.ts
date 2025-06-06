import {
  type DataSource,
  type Repository,
  IsNull,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type EntityManager,
  type UpdateResult,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { SupplierReturnItem } from '../models/supplier-return-item.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class SupplierReturnItemRepository {
  private readonly repository: Repository<SupplierReturnItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SupplierReturnItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'supplierReturn', 'purchaseReceptionItem'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SupplierReturnItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding supplier return item by id ${id}`, error });
      throw new ServerError('Error finding supplier return item.');
    }
  }

  async findBySupplierReturnId(
    supplierReturnId: number,
    options?: FindManyOptions<SupplierReturnItem>,
  ): Promise<SupplierReturnItem[]> {
    try {
      return await this.repository.find({
        where: { supplierReturnId, deletedAt: IsNull(), ...(options?.where || {}) },
        relations:
          options?.relations === undefined
            ? ['product', 'productVariant', 'purchaseReceptionItem']
            : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for supplier return ${supplierReturnId}`,
        error,
      });
      throw new ServerError('Error finding supplier return items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<SupplierReturnItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierReturnItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.findOne({
        where: { ...where, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding supplier return item by criteria`, error, where });
      throw new ServerError('Error finding supplier return item.');
    }
  }

  create(
    dto: Partial<SupplierReturnItem> | Partial<SupplierReturnItem>[],
    transactionalEntityManager?: EntityManager,
  ): SupplierReturnItem | SupplierReturnItem[] {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SupplierReturnItem)
      : this.repository;
    return repo.create(dto as any); // TypeORM's create method is overloaded, 'as any' is a workaround
  }

  async save(
    item: SupplierReturnItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierReturnItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.save(item);
    } catch (error: any) {
      // Assuming a unique constraint 'uq_supplier_return_item_product_variant_reception' on (supplierReturnId, productId, productVariantId, purchaseReceptionItemId)
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_supplier_return_item_unique')) {
          throw new BadRequestError(
            `This product/variant (from reception item ${item.purchaseReceptionItemId || 'N/A'}) is already part of this supplier return.`,
          );
        }
      }
      logger.error({ message: 'Error saving supplier return item', error, item });
      throw new ServerError('Error saving supplier return item.');
    }
  }

  async saveMany(
    items: SupplierReturnItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierReturnItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple supplier return items', error });
      throw new ServerError('Error saving supplier return items.');
    }
  }

  async update(
    id: number,
    dto: Partial<SupplierReturnItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error({ message: `Error updating supplier return item ${id}`, error, dto });
      throw new ServerError(`Error updating supplier return item ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting supplier return item ${id}`, error });
      throw new ServerError('Error soft-deleting supplier return item.');
    }
  }

  async deleteBySupplierReturnId(
    supplierReturnId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturnItem)
        : this.repository;
      // If using soft delete via Model, this should be a softDelete call with where clause.
      // For hard delete as per cascade in entity:
      return await repo.delete({ supplierReturnId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for supplier return ${supplierReturnId}`,
        error,
      });
      throw new ServerError('Error deleting items for supplier return.');
    }
  }
}
