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
import { PurchaseOrderItem } from '../models/purchase-order-item.entity';

export class PurchaseOrderItemRepository {
  private readonly repository: Repository<PurchaseOrderItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(PurchaseOrderItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'purchaseOrder'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<PurchaseOrderItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(PurchaseOrderItem)
        : this.repository;
      return await repo.findOne({
        where: { id },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding purchase order item by id ${id}`, error });
      throw new ServerError('Error finding purchase order item.');
    }
  }

  async findByPurchaseOrderId(
    purchaseOrderId: number,
    options?: FindManyOptions<PurchaseOrderItem>,
  ): Promise<PurchaseOrderItem[]> {
    try {
      return await this.repository.find({
        where: { purchaseOrderId, ...(options?.where || {}) },
        relations:
          options?.relations === undefined ? ['product', 'productVariant'] : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding items for purchase order ${purchaseOrderId}`, error });
      throw new ServerError('Error finding purchase order items.');
    }
  }

  async findOneBy(where: FindOptionsWhere<PurchaseOrderItem>): Promise<PurchaseOrderItem | null> {
    try {
      return await this.repository.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding purchase order item by criteria`, error, where });
      throw new ServerError('Error finding purchase order item.');
    }
  }

  create(dto: Partial<PurchaseOrderItem>): PurchaseOrderItem {
    return this.repository.create(dto);
  }

  async save(item: PurchaseOrderItem): Promise<PurchaseOrderItem> {
    try {
      return await this.repository.save(item);
    } catch (error: any) {
      logger.error({ message: 'Error saving purchase order item', error, item });
      throw new ServerError('Error saving purchase order item.');
    }
  }

  async saveMany(items: PurchaseOrderItem[]): Promise<PurchaseOrderItem[]> {
    try {
      return await this.repository.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple purchase order items', error });
      throw new ServerError('Error saving purchase order items.');
    }
  }

  async remove(item: PurchaseOrderItem): Promise<PurchaseOrderItem> {
    try {
      return await this.repository.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing purchase order item ${item.id}`, error });
      throw new ServerError('Error removing purchase order item.');
    }
  }

  async removeMany(items: PurchaseOrderItem[]): Promise<PurchaseOrderItem[]> {
    try {
      return await this.repository.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple purchase order items', error });
      throw new ServerError('Error removing purchase order items.');
    }
  }

  async deleteById(id: number): Promise<DeleteResult> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting purchase order item by id ${id}`, error });
      throw new ServerError('Error deleting purchase order item.');
    }
  }

  async deleteByPurchaseOrderId(purchaseOrderId: number): Promise<DeleteResult> {
    try {
      return await this.repository.delete({ purchaseOrderId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for purchase order ${purchaseOrderId}`,
        error,
      });
      throw new ServerError('Error deleting items for purchase order.');
    }
  }
}
