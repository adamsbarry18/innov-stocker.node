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
import { CustomerInvoice } from '../models/customer-invoice.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { Payment } from '@/modules/payments/models/payment.entity';

interface FindAllCustomerInvoicesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CustomerInvoice> | FindOptionsWhere<CustomerInvoice>[];
  order?: FindManyOptions<CustomerInvoice>['order'];
  relations?: string[];
}

export class CustomerInvoiceRepository {
  private readonly repository: Repository<CustomerInvoice>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerInvoice);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'customer',
      'currency',
      'billingAddress',
      'shippingAddress',
      'items',
      'items.product',
      'items.productVariant',
      'items.salesOrderItem',
      'items.deliveryItem',
      'salesOrderLinks',
      'salesOrderLinks.salesOrder',
      'createdByUser',
      'updatedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['customer', 'currency', 'createdByUser'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<CustomerInvoice | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(CustomerInvoice)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer invoice with id ${id}`, error },
        'CustomerInvoiceRepository.findById',
      );
      throw new ServerError(`Error finding customer invoice with id ${id}.`);
    }
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<CustomerInvoice | null> {
    try {
      return await this.repository.findOne({
        where: { invoiceNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer invoice by number '${invoiceNumber}'`, error },
        'CustomerInvoiceRepository.findByInvoiceNumber',
      );
      throw new ServerError(`Error finding customer invoice by number '${invoiceNumber}'.`);
    }
  }

  async findByInvoiceNumberAndCustomer(
    invoiceNumber: string,
    customerId: number,
  ): Promise<CustomerInvoice | null> {
    try {
      return await this.repository.findOne({
        where: { invoiceNumber, customerId, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        {
          message: `Error finding customer invoice by number '${invoiceNumber}' for customer ${customerId}`,
          error,
        },
        'CustomerInvoiceRepository.findByInvoiceNumberAndCustomer',
      );
      throw new ServerError(
        `Error finding customer invoice by number '${invoiceNumber}' for customer ${customerId}.`,
      );
    }
  }

  async findLastInvoiceNumber(prefix: string): Promise<string | null> {
    try {
      const lastInvoice = await this.repository
        .createQueryBuilder('ci')
        .select('MAX(ci.invoiceNumber)', 'maxInvoiceNumber')
        .where('ci.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastInvoice?.maxInvoiceNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last customer invoice number', error, prefix });
      throw new ServerError('Could not fetch last customer invoice number.');
    }
  }

  async findAll(
    options: FindAllCustomerInvoicesOptions = {},
  ): Promise<{ invoices: CustomerInvoice[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<CustomerInvoice> = {
        where,
        order: options.order ?? { invoiceDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [invoices, count] = await this.repository.findAndCount(findOptions);
      return { invoices, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all customer invoices`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'CustomerInvoiceRepository.findAll',
      );
      throw new ServerError(`Error finding all customer invoices.`);
    }
  }

  create(
    dto: Partial<CustomerInvoice>,
    transactionalEntityManager?: EntityManager,
  ): CustomerInvoice {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(CustomerInvoice)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    invoice: CustomerInvoice,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoice> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoice)
        : this.repository;
      return await repo.save(invoice);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_ci_invoice_number')) {
          throw new BadRequestError(
            `Customer invoice with number '${invoice.invoiceNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving customer invoice ${invoice.id || invoice.invoiceNumber}`, error },
        'CustomerInvoiceRepository.save',
      );
      throw new ServerError(`Error saving customer invoice.`);
    }
  }

  async update(
    id: number,
    dto: Partial<CustomerInvoice>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoice)
        : this.repository;
      const { items, salesOrderLinks, amountPaid, ...headerDto } = dto;
      if (amountPaid !== undefined) {
        logger.warn(
          `Attempt to update amountPaid directly on customer invoice ${id}. This should be handled by PaymentService.`,
        );
      }
      return await repo.update({ id, deletedAt: IsNull() }, headerDto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.invoiceNumber && error.message?.includes('uq_ci_invoice_number')) {
          throw new BadRequestError(
            `Cannot update: Customer invoice with number '${dto.invoiceNumber}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating customer invoice with id ${id}`, error },
        'CustomerInvoiceRepository.update',
      );
      throw new ServerError(`Error updating customer invoice with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoice)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting customer invoice with id ${id}`, error },
        'CustomerInvoiceRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting customer invoice with id ${id}.`);
    }
  }

  async getAmountPaidForInvoice(
    invoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<number> {
    const paymentRepo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(Payment)
      : this.repository.manager.getRepository(Payment);
    const result = await paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'totalPaid')
      .where('payment.customerInvoiceId = :invoiceId', { invoiceId })
      .andWhere("payment.direction = 'inbound'")
      .getRawOne();
    return Number(result?.totalPaid ?? 0);
  }
}
