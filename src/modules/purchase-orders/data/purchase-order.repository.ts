import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { PurchaseReception } from '@/modules/purchase-receptions';
import { SupplierInvoicePurchaseOrderLink } from '@/modules/supplier-invoices';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { PurchaseOrder } from '../models/purchase-order.entity';

interface FindAllPurchaseOrdersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<PurchaseOrder> | FindOptionsWhere<PurchaseOrder>[];
  order?: FindManyOptions<PurchaseOrder>['order'];
  relations?: string[];
}

export class PurchaseOrderRepository {
  private readonly repository: Repository<PurchaseOrder>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(PurchaseOrder);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'supplier',
      'currency',
      'shippingAddress',
      'warehouseForDelivery',
      'shopForDelivery',
      'items',
      'items.product',
      'items.productVariant',
      'createdByUser',
      'approvedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['supplier', 'currency', 'createdByUser'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<PurchaseOrder | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined
            ? this.getDefaultRelationsForFindOne()
            : options.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding purchase order with id ${id}`, error },
        'PurchaseOrderRepository.findById',
      );
      throw new ServerError(`Error finding purchase order with id ${id}.`);
    }
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    try {
      return await this.repository.findOne({
        where: { orderNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding purchase order by number '${orderNumber}'`, error },
        'PurchaseOrderRepository.findByOrderNumber',
      );
      throw new ServerError(`Error finding purchase order by number '${orderNumber}'.`);
    }
  }

  async findLastOrderNumber(prefix: string): Promise<string | null> {
    try {
      const lastOrder = await this.repository
        .createQueryBuilder('po')
        .select('MAX(po.orderNumber)', 'maxOrderNumber')
        .where('po.orderNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastOrder?.maxOrderNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last purchase order number', error, prefix });
      throw new ServerError('Could not fetch last purchase order number.');
    }
  }

  async findAll(
    options: FindAllPurchaseOrdersOptions = {},
  ): Promise<{ orders: PurchaseOrder[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<PurchaseOrder> = {
        where,
        order: options.order ?? { orderDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [orders, count] = await this.repository.findAndCount(findOptions);
      return { orders, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all purchase orders`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'PurchaseOrderRepository.findAll',
      );
      throw new ServerError(`Error finding all purchase orders.`);
    }
  }

  create(dto: Partial<PurchaseOrder>): PurchaseOrder {
    return this.repository.create(dto);
  }

  async save(order: PurchaseOrder): Promise<PurchaseOrder> {
    try {
      return await this.repository.save(order);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_po_order_number')) {
          throw new BadRequestError(
            `Purchase order with number '${order.orderNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving purchase order ${order.id || order.orderNumber}`, error },
        'PurchaseOrderRepository.save',
      );
      throw new ServerError(`Error saving purchase order.`);
    }
  }

  async update(id: number, dto: Partial<PurchaseOrder>): Promise<UpdateResult> {
    try {
      const { items, ...headerDto } = dto;
      return await this.repository.update({ id, deletedAt: IsNull() }, headerDto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating purchase order with id ${id}`, error },
        'PurchaseOrderRepository.update',
      );
      throw new ServerError(`Error updating purchase order with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting purchase order with id ${id}`, error },
        'PurchaseOrderRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting purchase order with id ${id}.`);
    }
  }

  async isPurchaseOrderLinkedToReceptionOrInvoice(orderId: number): Promise<boolean> {
    try {
      const receptionRepo = this.repository.manager.getRepository(PurchaseReception);
      const receptionCount = await receptionRepo.count({
        where: { purchaseOrderId: orderId, deletedAt: IsNull() },
      });
      if (receptionCount > 0) return true;

      const invoiceLinkRepo = this.repository.manager.getRepository(
        SupplierInvoicePurchaseOrderLink,
      );
      const invoiceLinkCount = await invoiceLinkRepo.count({
        where: { purchaseOrderId: orderId },
      });

      return invoiceLinkCount > 0;
    } catch (error) {
      throw new ServerError(
        `Error checking if purchase order ${orderId} is linked to reception or invoice. ${error}`,
      );
    }
  }
}
