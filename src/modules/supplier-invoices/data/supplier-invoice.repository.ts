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
import { SupplierInvoice } from '../models/supplier-invoice.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { Payment } from '@/modules/payments/models/payment.entity';

interface FindAllSupplierInvoicesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<SupplierInvoice> | FindOptionsWhere<SupplierInvoice>[];
  order?: FindManyOptions<SupplierInvoice>['order'];
  relations?: string[];
  searchTerm?: string;
}

export class SupplierInvoiceRepository {
  private readonly repository: Repository<SupplierInvoice>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SupplierInvoice);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'supplier',
      'currency',
      'items',
      'items.product',
      'items.productVariant',
      'items.purchaseReceptionItem',
      'purchaseOrderLinks',
      'purchaseOrderLinks.purchaseOrder',
      'createdByUser',
      'updatedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['supplier', 'currency', 'createdByUser'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SupplierInvoice | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SupplierInvoice)
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
        { message: `Error finding supplier invoice with id ${id}`, error },
        'SupplierInvoiceRepository.findById',
      );
      throw new ServerError(`Error finding supplier invoice with id ${id}.`);
    }
  }

  async findByInvoiceNumberAndSupplier(
    invoiceNumber: string,
    supplierId: number,
  ): Promise<SupplierInvoice | null> {
    try {
      return await this.repository.findOne({
        where: { invoiceNumber, supplierId, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        {
          message: `Error finding supplier invoice by number '${invoiceNumber}' for supplier ${supplierId}`,
          error,
        },
        'SupplierInvoiceRepository.findByInvoiceNumberAndSupplier',
      );
      throw new ServerError(`Error finding supplier invoice by number and supplier.`);
    }
  }

  /*async findLastInvoiceNumber(prefix: string, supplierId: number): Promise<string | null> {
    // Supplier invoice numbers are external, so this might not be needed unless you generate internal reference
    logger.warn(
      'findLastInvoiceNumber for supplier invoices might not be relevant as numbers are external.',
    );
    return null;
  }*/

  async findAll(
    options: FindAllSupplierInvoicesOptions = {},
  ): Promise<{ invoices: SupplierInvoice[]; count: number }> {
    try {
      let whereConditions: FindOptionsWhere<SupplierInvoice> | FindOptionsWhere<SupplierInvoice>[] =
        options.where
          ? Array.isArray(options.where)
            ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
            : { ...options.where, deletedAt: IsNull() }
          : { deletedAt: IsNull() };

      if (options.searchTerm) {
        const searchPattern = ILike(`%${options.searchTerm}%`);
        const searchSpecific: FindOptionsWhere<SupplierInvoice> = {
          invoiceNumber: searchPattern,
          deletedAt: IsNull(),
        };
        // TODO: Add search on supplier name (requires join or complex QueryBuilder)
        if (Array.isArray(whereConditions)) {
          whereConditions = whereConditions.map((wc) => ({ ...wc, ...searchSpecific }));
        } else {
          whereConditions = { ...whereConditions, ...searchSpecific };
        }
      }

      const findOptions: FindManyOptions<SupplierInvoice> = {
        where: whereConditions,
        order: options.order || { invoiceDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations:
          options.relations === undefined
            ? this.getDefaultRelationsForFindAll()
            : options.relations,
      };
      const [invoices, count] = await this.repository.findAndCount(findOptions);
      return { invoices, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all supplier invoices`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'SupplierInvoiceRepository.findAll',
      );
      throw new ServerError(`Error finding all supplier invoices.`);
    }
  }

  create(
    dto: Partial<SupplierInvoice>,
    transactionalEntityManager?: EntityManager,
  ): SupplierInvoice {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SupplierInvoice)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    invoice: SupplierInvoice,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoice> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoice)
        : this.repository;
      // Cascade will save items and links if configured
      return await repo.save(invoice);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_supplier_invoice_number')) {
          throw new BadRequestError(
            `Supplier invoice with number '${invoice.invoiceNumber}' for supplier ID ${invoice.supplierId} already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving supplier invoice ${invoice.id || invoice.invoiceNumber}`, error },
        'SupplierInvoiceRepository.save',
      );
      throw new ServerError(`Error saving supplier invoice.`);
    }
  }

  async update(
    id: number,
    dto: Partial<SupplierInvoice>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoice)
        : this.repository;
      const { items, purchaseOrderLinks, ...headerDto } = dto; // Items and links managed via service logic
      return await repo.update({ id, deletedAt: IsNull() }, headerDto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          dto.invoiceNumber &&
          dto.supplierId &&
          error.message?.includes('uq_supplier_invoice_number')
        ) {
          throw new BadRequestError(
            `Cannot update: Supplier invoice with number '${dto.invoiceNumber}' for supplier ID ${dto.supplierId} may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating supplier invoice with id ${id}`, error },
        'SupplierInvoiceRepository.update',
      );
      throw new ServerError(`Error updating supplier invoice with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoice)
        : this.repository;
      // TODO: Service layer should check if payments applied before allowing soft delete / cancel.
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting supplier invoice with id ${id}`, error },
        'SupplierInvoiceRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting supplier invoice with id ${id}.`);
    }
  }
  async getAmountPaidForInvoice(invoiceId: number): Promise<number> {
    logger.warn('SupplierInvoiceRepository.getAmountPaidForInvoice is a placeholder.');
    const paymentRepo = this.repository.manager.getRepository(Payment);
    const result = await paymentRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'totalPaid')
      .where('payment.supplierInvoiceId = :invoiceId', { invoiceId })
      .andWhere("payment.direction = 'outbound'")
      .getRawOne();
    return Number(result?.totalPaid || 0);
    return 0;
  }
}
