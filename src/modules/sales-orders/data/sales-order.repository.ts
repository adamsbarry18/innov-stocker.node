import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  ILike,
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
  searchTerm?: string;
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
      // Lighter set for lists
      'customer',
      'currency',
      'createdByUser',
      'items', // Added to load sales order items
      'items.product', // Added to load product details for items
      'items.productVariant', // Added to load product variant details for items
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
        relations:
          options?.relations === undefined
            ? this.getDefaultRelationsForFindOne()
            : options.relations,
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
      const lastOrder = await this.repository
        .createQueryBuilder('so')
        .select('MAX(so.orderNumber)', 'maxOrderNumber')
        .where('so.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastOrder?.maxOrderNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last sales order number', error, prefix });
      throw new ServerError('Could not fetch last sales order number.');
    }
  }

  async findAll(
    options: FindAllSalesOrdersOptions = {},
  ): Promise<{ orders: SalesOrder[]; count: number }> {
    try {
      let whereConditions: FindOptionsWhere<SalesOrder> | FindOptionsWhere<SalesOrder>[] =
        options.where
          ? Array.isArray(options.where)
            ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
            : { ...options.where, deletedAt: IsNull() }
          : { deletedAt: IsNull() };

      // Note: Searching on joined customer fields (customer.name, etc.) via options.searchTerm
      // would require QueryBuilder for OR conditions.
      if (options.searchTerm) {
        const searchPattern = ILike(`%${options.searchTerm}%`);
        const searchSpecific: FindOptionsWhere<SalesOrder> = {
          orderNumber: searchPattern,
          deletedAt: IsNull(),
        };
        if (Array.isArray(whereConditions)) {
          whereConditions = whereConditions.map((wc) => ({ ...wc, ...searchSpecific }));
        } else {
          whereConditions = { ...whereConditions, ...searchSpecific };
        }
      }

      const findOptions: FindManyOptions<SalesOrder> = {
        where: whereConditions,
        order: options.order || { orderDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations:
          options.relations === undefined
            ? this.getDefaultRelationsForFindAll()
            : options.relations,
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
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_so_order_number')) {
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
    } catch (error: any) {
      logger.error(
        { message: `Error updating sales order with id ${id}`, error },
        'SalesOrderRepository.update',
      );
      throw new ServerError(`Error updating sales order with id ${id}.`);
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

  /* TODO: Dépendance - Implémenter avec DeliveryRepository, CustomerInvoiceRepository
  async isSalesOrderLinkedToDeliveryOrInvoice(orderId: number): Promise<boolean> {
    logger.warn('SalesOrderRepository.isSalesOrderLinkedToDeliveryOrInvoice is a placeholder.');
    return false;
  }*/
}
