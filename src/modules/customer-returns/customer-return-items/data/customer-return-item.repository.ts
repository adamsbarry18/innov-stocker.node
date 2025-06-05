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
import { CustomerReturnItem } from '../models/customer-return-item.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class CustomerReturnItemRepository {
  private readonly repository: Repository<CustomerReturnItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerReturnItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'customerReturn'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<CustomerReturnItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding customer return item by id ${id}`, error });
      throw new ServerError('Error finding customer return item.');
    }
  }

  async findByCustomerReturnId(
    customerReturnId: number,
    options?: FindManyOptions<CustomerReturnItem>,
  ): Promise<CustomerReturnItem[]> {
    try {
      return await this.repository.find({
        where: { customerReturnId, deletedAt: IsNull(), ...(options?.where || {}) },
        relations:
          options?.relations === undefined ? ['product', 'productVariant'] : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for customer return ${customerReturnId}`,
        error,
      });
      throw new ServerError('Error finding customer return items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<CustomerReturnItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerReturnItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.findOne({
        where: { ...where, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding customer return item by criteria`, error, where });
      throw new ServerError('Error finding customer return item.');
    }
  }

  create(
    dto: Partial<CustomerReturnItem>,
    transactionalEntityManager?: EntityManager,
  ): CustomerReturnItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(CustomerReturnItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: CustomerReturnItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerReturnItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.save(item);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('customer_return_item_unique')) {
          // From SQL schema
          throw new BadRequestError(
            `This product/variant is already part of this customer return.`,
          );
        }
      }
      logger.error({ message: 'Error saving customer return item', error, item });
      throw new ServerError('Error saving customer return item.');
    }
  }

  async saveMany(
    items: CustomerReturnItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerReturnItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple customer return items', error });
      throw new ServerError('Error saving customer return items.');
    }
  }

  async update(
    id: number,
    dto: Partial<CustomerReturnItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error({ message: `Error updating customer return item ${id}`, error, dto });
      throw new ServerError(`Error updating customer return item ${id}.`);
    }
  }

  async softDelete(id: string, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting customer return item ${id}`, error });
      throw new ServerError('Error soft-deleting customer return item.');
    }
  }

  async deleteByCustomerReturnId(
    customerReturnId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturnItem)
        : this.repository;
      // Items are usually hard deleted if parent return is cancelled before processing or hard deleted
      return await repo.delete({ customerReturnId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for customer return ${customerReturnId}`,
        error,
      });
      throw new ServerError('Error deleting items for customer return.');
    }
  }
}
