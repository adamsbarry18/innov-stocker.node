import {
  type DataSource,
  type Repository,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { SalesOrderItem } from '../models/sales-order-item.entity';

export class SalesOrderItemRepository {
  private readonly repository: Repository<SalesOrderItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SalesOrderItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'salesOrder'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SalesOrderItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.findOne({
        where: { id },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding sales order item by id ${id}`, error });
      throw new ServerError('Error finding sales order item.');
    }
  }

  async findBySalesOrderId(
    salesOrderId: number,
    options?: FindManyOptions<SalesOrderItem>,
  ): Promise<SalesOrderItem[]> {
    try {
      return await this.repository.find({
        where: { salesOrderId, ...(options?.where ?? {}) },
        relations: options?.relations ? ['product', 'productVariant'] : options?.relations,
        order: options?.order ?? { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding items for sales order ${salesOrderId}`, error });
      throw new ServerError('Error finding sales order items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<SalesOrderItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrderItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding sales order item by criteria`, error, where });
      throw new ServerError('Error finding sales order item.');
    }
  }

  create(dto: Partial<SalesOrderItem>, transactionalEntityManager?: EntityManager): SalesOrderItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SalesOrderItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: SalesOrderItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrderItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.save(item);
    } catch (error: any) {
      logger.error({ message: 'Error saving sales order item', error, item });
      throw new ServerError('Error saving sales order item.');
    }
  }

  async saveMany(
    items: SalesOrderItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrderItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple sales order items', error });
      throw new ServerError('Error saving sales order items.');
    }
  }

  async remove(
    item: SalesOrderItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrderItem> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing sales order item ${item.id}`, error });
      throw new ServerError('Error removing sales order item.');
    }
  }

  async removeMany(
    items: SalesOrderItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrderItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple sales order items', error });
      throw new ServerError('Error removing sales order items.');
    }
  }

  async deleteById(id: number, transactionalEntityManager?: EntityManager): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting sales order item by id ${id}`, error });
      throw new ServerError('Error deleting sales order item.');
    }
  }

  async deleteBySalesOrderId(
    salesOrderId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrderItem)
        : this.repository;
      return await repo.delete({ salesOrderId });
    } catch (error) {
      logger.error({ message: `Error deleting items for sales order ${salesOrderId}`, error });
      throw new ServerError('Error deleting items for sales order.');
    }
  }
}
