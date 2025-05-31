import { type DataSource, type Repository, type EntityManager, type DeleteResult } from 'typeorm';
import { appDataSource } from '../../../database/data-source';
import { ServerError, BadRequestError } from '../../../common/errors/httpErrors';
import logger from '../../../lib/logger';
import { SupplierInvoicePurchaseOrderLink } from '../models/supplier-invoice-purchse-order-link.entity';

export class SupplierInvoicePurchaseOrderLinkRepository {
  private readonly repository: Repository<SupplierInvoicePurchaseOrderLink>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SupplierInvoicePurchaseOrderLink);
  }

  create(
    dto: Partial<SupplierInvoicePurchaseOrderLink>,
    transactionalEntityManager?: EntityManager,
  ): SupplierInvoicePurchaseOrderLink {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    link: SupplierInvoicePurchaseOrderLink,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoicePurchaseOrderLink> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
        : this.repository;
      return await repo.save(link);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('PRIMARY')
      ) {
        // PRIMARY for composite PK
        throw new BadRequestError(
          `Link between Supplier Invoice ID ${link.supplierInvoiceId} and Purchase Order ID ${link.purchaseOrderId} already exists.`,
        );
      }
      logger.error({ message: 'Error saving supplier invoice PO link', error, link });
      throw new ServerError('Error saving supplier invoice PO link.');
    }
  }

  async saveMany(
    links: SupplierInvoicePurchaseOrderLink[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoicePurchaseOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
        : this.repository;
      return await repo.save(links);
    } catch (error) {
      logger.error({ message: 'Error saving multiple supplier invoice PO links', error });
      throw new ServerError('Error saving supplier invoice PO links.');
    }
  }

  async findBySupplierInvoiceId(
    supplierInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoicePurchaseOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
        : this.repository;
      return await repo.find({ where: { supplierInvoiceId }, relations: ['purchaseOrder'] });
    } catch (error) {
      logger.error({
        message: `Error finding PO links for supplier invoice ${supplierInvoiceId}`,
        error,
      });
      throw new ServerError('Error finding PO links for supplier invoice.');
    }
  }

  async findByPurchaseOrderId(
    purchaseOrderId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoicePurchaseOrderLink[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
        : this.repository;
      return await repo.find({ where: { purchaseOrderId }, relations: ['supplierInvoice'] });
    } catch (error) {
      logger.error({ message: `Error finding invoice links for PO ${purchaseOrderId}`, error });
      throw new ServerError('Error finding invoice links for PO.');
    }
  }

  async removeByInvoiceId(
    supplierInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoicePurchaseOrderLink)
        : this.repository;
      return await repo.delete({ supplierInvoiceId });
    } catch (error) {
      logger.error({
        message: `Error removing PO links for supplier invoice ${supplierInvoiceId}`,
        error,
      });
      throw new ServerError('Error removing PO links for supplier invoice.');
    }
  }
}
