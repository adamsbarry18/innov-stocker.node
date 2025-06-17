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
import { Delivery } from '../models/delivery.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllDeliveriesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Delivery> | FindOptionsWhere<Delivery>[];
  order?: FindManyOptions<Delivery>['order'];
  relations?: string[];
  searchTerm?: string;
}

export class DeliveryRepository {
  private readonly repository: Repository<Delivery>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Delivery);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'salesOrder',
      'salesOrder.customer',
      'shippingAddress',
      'dispatchWarehouse',
      'dispatchShop',
      'items',
      'items.product',
      'items.productVariant',
      'items.salesOrderItem',
      'createdByUser',
      'updatedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return [
      'salesOrder',
      'salesOrder.customer',
      'shippingAddress',
      'createdByUser',
      'createdByUser',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<Delivery | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(Delivery)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding delivery with id ${id}`, error },
        'DeliveryRepository.findById',
      );
      throw new ServerError(`Error finding delivery with id ${id}.`);
    }
  }

  async findByDeliveryNumber(deliveryNumber: string): Promise<Delivery | null> {
    try {
      return await this.repository.findOne({
        where: { deliveryNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding delivery by number '${deliveryNumber}'`, error },
        'DeliveryRepository.findByDeliveryNumber',
      );
      throw new ServerError(`Error finding delivery by number '${deliveryNumber}'.`);
    }
  }

  async findLastDeliveryNumber(prefix: string): Promise<string | null> {
    try {
      const lastDelivery = await this.repository
        .createQueryBuilder('delivery')
        .select('MAX(delivery.deliveryNumber)', 'maxDeliveryNumber')
        .where('delivery.deliveryNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastDelivery?.maxDeliveryNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last delivery number', error, prefix });
      throw new ServerError('Could not fetch last delivery number.');
    }
  }

  async findAll(
    options: FindAllDeliveriesOptions = {},
  ): Promise<{ deliveries: Delivery[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<Delivery> = {
        where,
        order: options.order ?? { deliveryDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [deliveries, count] = await this.repository.findAndCount(findOptions);
      return { deliveries, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all deliveries`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'DeliveryRepository.findAll',
      );
      throw new ServerError(`Error finding all deliveries.`);
    }
  }

  async findBySalesOrderId(
    salesOrderId: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<Delivery[]> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(Delivery)
        : this.repository;
      return await repo.find({
        where: { salesOrderId, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindAll() : options?.relations,
        order: { deliveryDate: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding deliveries for Sales Order ${salesOrderId}`, error });
      throw new ServerError(`Error finding deliveries for Sales Order.`);
    }
  }

  create(dto: Partial<Delivery>, transactionalEntityManager?: EntityManager): Delivery {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(Delivery)
      : this.repository;
    return repo.create(dto);
  }

  async save(delivery: Delivery, transactionalEntityManager?: EntityManager): Promise<Delivery> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Delivery)
        : this.repository;
      return await repo.save(delivery);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_delivery_number')) {
          throw new BadRequestError(
            `Delivery with number '${delivery.deliveryNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving delivery ${delivery.id || delivery.deliveryNumber}`, error },
        'DeliveryRepository.save',
      );
      throw new ServerError(`Error saving delivery.`);
    }
  }

  async update(
    id: number,
    dto: Partial<Delivery>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Delivery)
        : this.repository;
      const { items, ...headerDto } = dto;
      return await repo.update({ id, deletedAt: IsNull() }, headerDto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating delivery with id ${id}`, error },
        'DeliveryRepository.update',
      );
      throw new ServerError(`Error updating delivery with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Delivery)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting delivery with id ${id}`, error },
        'DeliveryRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting delivery with id ${id}.`);
    }
  }

  async isDeliveryLinkedToInvoice(deliveryId: number): Promise<boolean> {
    try {
      const count = await this.repository.manager
        .createQueryBuilder()
        .select('COUNT(cii.id)')
        .from('customer_invoice_items', 'cii')
        .innerJoin('delivery_items', 'di', 'cii.delivery_item_id = di.id')
        .where('di.delivery_id = :deliveryId', { deliveryId })
        .andWhere('cii.deleted_time IS NULL')
        .andWhere('di.deleted_time IS NULL')
        .getCount();

      return count > 0;
    } catch (error) {
      logger.error(
        { message: `Error checking if delivery ${deliveryId} is linked to an invoice`, error },
        'DeliveryRepository.isDeliveryLinkedToInvoice',
      );
      throw new ServerError(`Error checking if delivery ${deliveryId} is linked to an invoice.`);
    }
  }
}
