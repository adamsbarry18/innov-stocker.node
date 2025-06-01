import {
  type DataSource,
  type Repository,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { DeliveryItem } from '../models/delivery-item.entity';

export class DeliveryItemRepository {
  private readonly repository: Repository<DeliveryItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(DeliveryItem);
  }

  private getDefaultRelations(): string[] {
    return [
      'product',
      'productVariant',
      'delivery',
      'salesOrderItem',
      'salesOrderItem.product',
      'salesOrderItem.productVariant',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<DeliveryItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.findOne({
        where: { id },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding delivery item by id ${id}`, error });
      throw new ServerError('Error finding delivery item.');
    }
  }

  async findByDeliveryId(
    deliveryId: number,
    options?: FindManyOptions<DeliveryItem>,
  ): Promise<DeliveryItem[]> {
    try {
      return await this.repository.find({
        where: { deliveryId, ...(options?.where || {}) },
        relations:
          options?.relations === undefined
            ? ['product', 'productVariant', 'salesOrderItem']
            : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding items for delivery ${deliveryId}`, error });
      throw new ServerError('Error finding delivery items.');
    }
  }

  async findBySalesOrderItemId(
    salesOrderItemId: number,
    options?: { transactionalEntityManager?: EntityManager },
  ): Promise<DeliveryItem[]> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.find({
        where: {
          salesOrderItemId,
          // Assuming soft delete on DeliveryItem is handled by a global scope or explicit column
          // If 'deletedAt' is a column, ensure it's IsNull()
          // deletedAt: IsNull(),
        },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({
        message: `Error finding delivery items by sales order item id ${salesOrderItemId}`,
        error,
      });
      throw new ServerError('Error finding delivery items by sales order item.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<DeliveryItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeliveryItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding delivery item by criteria`, error, where });
      throw new ServerError('Error finding delivery item.');
    }
  }

  create(dto: Partial<DeliveryItem>, transactionalEntityManager?: EntityManager): DeliveryItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(DeliveryItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: DeliveryItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeliveryItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.save(item);
    } catch (error: any) {
      // Check for specific unique constraints if any (e.g., deliveryId + salesOrderItemId)
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('deliveryId_salesOrderItemId_unique')) {
          // Adjust to actual constraint name
          throw new BadRequestError(
            `This sales order item (ID: ${item.salesOrderItemId}) is already part of this delivery (ID: ${item.deliveryId}).`,
          );
        }
      }
      logger.error({ message: 'Error saving delivery item', error, item });
      throw new ServerError('Error saving delivery item.');
    }
  }

  async saveMany(
    items: DeliveryItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<DeliveryItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple delivery items', error });
      throw new ServerError('Error saving delivery items.');
    }
  }

  async remove(
    item: DeliveryItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeliveryItem> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing delivery item ${item.id}`, error });
      throw new ServerError('Error removing delivery item.');
    }
  }

  async removeMany(
    items: DeliveryItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<DeliveryItem[]> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple delivery items', error });
      throw new ServerError('Error removing delivery items.');
    }
  }

  async deleteById(id: number, transactionalEntityManager?: EntityManager): Promise<DeleteResult> {
    // Hard delete by ID
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting delivery item by id ${id}`, error });
      throw new ServerError('Error deleting delivery item.');
    }
  }

  async deleteByDeliveryId(
    deliveryId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(DeliveryItem)
        : this.repository;
      return await repo.delete({ deliveryId });
    } catch (error) {
      logger.error({ message: `Error deleting items for delivery ${deliveryId}`, error });
      throw new ServerError('Error deleting items for delivery.');
    }
  }
}
