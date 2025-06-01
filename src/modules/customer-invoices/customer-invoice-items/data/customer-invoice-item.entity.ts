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
import { CustomerInvoiceItem } from '../models/customer-invoice-item.entity';

export class CustomerInvoiceItemRepository {
  private readonly repository: Repository<CustomerInvoiceItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerInvoiceItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'customerInvoice', 'salesOrderItem', 'deliveryItem'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<CustomerInvoiceItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.findOne({
        where: { id },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding customer invoice item by id ${id}`, error });
      throw new ServerError('Error finding customer invoice item.');
    }
  }

  async findByCustomerInvoiceId(
    customerInvoiceId: number,
    options?: FindManyOptions<CustomerInvoiceItem>,
  ): Promise<CustomerInvoiceItem[]> {
    try {
      return await this.repository.find({
        where: { customerInvoiceId, ...(options?.where || {}) },
        relations:
          options?.relations === undefined
            ? ['product', 'productVariant', 'salesOrderItem', 'deliveryItem']
            : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for customer invoice ${customerInvoiceId}`,
        error,
      });
      throw new ServerError('Error finding customer invoice items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<CustomerInvoiceItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding customer invoice item by criteria`, error, where });
      throw new ServerError('Error finding customer invoice item.');
    }
  }

  create(
    dto: Partial<CustomerInvoiceItem>,
    transactionalEntityManager?: EntityManager,
  ): CustomerInvoiceItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: CustomerInvoiceItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      // Ensure totalLineAmountHt is calculated before save
      item.totalLineAmountHt = item.calculateTotalLineAmountHt();
      return await repo.save(item);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          error.message?.includes(
            'customerInvoiceId_productId_productVariantId_salesOrderItemId_deliveryItemId_unique',
          )
        ) {
          // Adjust to actual constraint name
          throw new BadRequestError(
            `This product/variant from this source (SO/Delivery item) has already been invoiced on this invoice.`,
          );
        }
      }
      logger.error({ message: 'Error saving customer invoice item', error, item });
      throw new ServerError('Error saving customer invoice item.');
    }
  }

  async saveMany(
    items: CustomerInvoiceItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      for (const item of items) {
        item.totalLineAmountHt = item.calculateTotalLineAmountHt();
      }
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple customer invoice items', error });
      throw new ServerError('Error saving customer invoice items.');
    }
  }

  async remove(
    item: CustomerInvoiceItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceItem> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing customer invoice item ${item.id}`, error });
      throw new ServerError('Error removing customer invoice item.');
    }
  }

  async removeMany(
    items: CustomerInvoiceItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceItem[]> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple customer invoice items', error });
      throw new ServerError('Error removing customer invoice items.');
    }
  }

  async deleteById(id: number, transactionalEntityManager?: EntityManager): Promise<DeleteResult> {
    // Hard delete by ID
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting customer invoice item by id ${id}`, error });
      throw new ServerError('Error deleting customer invoice item.');
    }
  }

  async deleteByCustomerInvoiceId(
    customerInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceItem)
        : this.repository;
      return await repo.delete({ customerInvoiceId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for customer invoice ${customerInvoiceId}`,
        error,
      });
      throw new ServerError('Error deleting items for customer invoice.');
    }
  }
}
