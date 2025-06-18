import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { SalesOrder } from '../models/sales-order.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllSalesOrdersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<SalesOrder> | FindOptionsWhere<SalesOrder>[];
  order?: FindManyOptions<SalesOrder>['order'];
  relations?: string[];
}

export class SalesOrderRepository {
  private readonly repository: Repository<SalesOrder>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SalesOrder);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'customer',
      'customer.billingAddress',
      'customer.defaultShippingAddress',
      'quote',
      'currency',
      'shippingAddress',
      'billingAddress',
      'dispatchWarehouse',
      'dispatchShop',
      'items',
      'items.product',
      'items.productVariant',
      'createdByUser',
      'updatedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return [
      'customer',
      'currency',
      'createdByUser',
      'items',
      'items.product',
      'items.productVariant',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SalesOrder | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SalesOrder)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ?? this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding sales order with id ${id}`, error },
        'SalesOrderRepository.findById',
      );
      throw new ServerError(`Error finding sales order with id ${id}.`);
    }
  }

  async findByOrderNumber(orderNumber: string): Promise<SalesOrder | null> {
    try {
      return await this.repository.findOne({
        where: { orderNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding sales order by number '${orderNumber}'`, error },
        'SalesOrderRepository.findByOrderNumber',
      );
      throw new ServerError(`Error finding sales order by number '${orderNumber}'.`);
    }
  }

  async findLastOrderNumber(prefix: string): Promise<string | null> {
    try {
      const lastOrder: { maxOrderNumber?: string } | undefined = await this.repository
        .createQueryBuilder('so')
        .select('MAX(so.orderNumber)', 'maxOrderNumber')
        .where('so.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastOrder?.maxOrderNumber ?? null;
    } catch (error) {
      logger.error({ message: 'Error fetching last sales order number', error, prefix });
      throw new ServerError('Could not fetch last sales order number.');
    }
  }

  async findAll(
    options: FindAllSalesOrdersOptions = {},
  ): Promise<{ orders: SalesOrder[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<SalesOrder> = {
        where,
        order: options.order ?? { orderDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ?? this.getDefaultRelationsForFindAll(),
      };
      const [orders, count] = await this.repository.findAndCount(findOptions);
      return { orders, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all sales orders`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'SalesOrderRepository.findAll',
      );
      throw new ServerError(`Error finding all sales orders.`);
    }
  }

  create(dto: Partial<SalesOrder>, transactionalEntityManager?: EntityManager): SalesOrder {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SalesOrder)
      : this.repository;
    return repo.create(dto);
  }

  async save(order: SalesOrder, transactionalEntityManager?: EntityManager): Promise<SalesOrder> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrder)
        : this.repository;
      return await repo.save(order);
    } catch (error: unknown) {
      if (
        (error instanceof Error && 'code' in error && (error as any).code === 'ER_DUP_ENTRY') ||
        (error instanceof Error && error.message?.includes('UNIQUE constraint failed'))
      ) {
        if (error instanceof Error && error.message?.includes('uq_so_order_number')) {
          throw new BadRequestError(
            `Sales order with number '${order.orderNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving sales order ${order.id || order.orderNumber}`, error },
        'SalesOrderRepository.save',
      );
      throw new ServerError(`Error saving sales order.`);
    }
  }

  async update(
    id: number,
    dto: Partial<SalesOrder>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrder)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error) {
      throw new ServerError(`Error updating sales order with id ${id}. ${error}`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SalesOrder)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting sales order with id ${id}`, error },
        'SalesOrderRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting sales order with id ${id}.`);
    }
  }
}
