import { type DataSource, type Repository, type EntityManager } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { CustomerInvoiceSalesOrderLink } from '../models/customer-invoice-sales-order-link.entity';

export class CustomerInvoiceSalesOrderLinkRepository {
  private readonly repository: Repository<CustomerInvoiceSalesOrderLink>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerInvoiceSalesOrderLink);
  }

  create(
    dto: Partial<CustomerInvoiceSalesOrderLink>,
    transactionalEntityManager?: EntityManager,
  ): CustomerInvoiceSalesOrderLink {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    link: CustomerInvoiceSalesOrderLink,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceSalesOrderLink> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.save(link);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('PRIMARY')
      ) {
        throw new BadRequestError(
          `Link between Customer Invoice ID ${link.customerInvoiceId} and Sales Order ID ${link.salesOrderId} already exists.`,
        );
      }
      logger.error({ message: 'Error saving customer invoice SO link', error, link });
      throw new ServerError('Error saving customer invoice SO link.');
    }
  }

  async saveMany(
    links: CustomerInvoiceSalesOrderLink[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceSalesOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.save(links);
    } catch (error) {
      logger.error({ message: 'Error saving multiple customer invoice SO links', error });
      throw new ServerError('Error saving customer invoice SO links.');
    }
  }

  async findByCustomerInvoiceId(
    customerInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceSalesOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.find({ where: { customerInvoiceId }, relations: ['salesOrder'] });
    } catch (error) {
      logger.error({
        message: `Error finding SO links for customer invoice ${customerInvoiceId}`,
        error,
      });
      throw new ServerError('Error finding SO links for customer invoice.');
    }
  }

  async findBySalesOrderId(
    salesOrderId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoiceSalesOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.find({ where: { salesOrderId }, relations: ['customerInvoice'] });
    } catch (error) {
      logger.error({ message: `Error finding invoice links for SO ${salesOrderId}`, error });
      throw new ServerError('Error finding invoice links for SO.');
    }
  }

  async removeByInvoiceId(
    customerInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<import('typeorm').DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.delete({ customerInvoiceId });
    } catch (error) {
      logger.error({
        message: `Error removing SO links for customer invoice ${customerInvoiceId}`,
        error,
      });
      throw new ServerError('Error removing SO links for customer invoice.');
    }
  }

  async removeBySalesOrderId(
    salesOrderId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<import('typeorm').DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerInvoiceSalesOrderLink)
        : this.repository;
      return await repo.delete({ salesOrderId });
    } catch (error) {
      logger.error({ message: `Error removing invoice links for SO ${salesOrderId}`, error });
      throw new ServerError('Error removing invoice links for SO.');
    }
  }
}
