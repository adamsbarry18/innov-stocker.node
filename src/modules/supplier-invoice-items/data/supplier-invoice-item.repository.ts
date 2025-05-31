import {
  type DataSource,
  type Repository,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '../../../database/data-source';
import { SupplierInvoiceItem } from '../models/supplier-invoice-item.entity';
import { ServerError } from '../../../common/errors/httpErrors';
import logger from '../../../lib/logger';

export class SupplierInvoiceItemRepository {
  private readonly repository: Repository<SupplierInvoiceItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SupplierInvoiceItem);
  }

  private getDefaultRelations(): string[] {
    return [
      'product',
      'productVariant',
      'supplierInvoice',
      'purchaseReceptionItem',
      'purchaseReceptionItem.product',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SupplierInvoiceItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.findOne({
        where: { id }, // Assuming soft delete handled by Model or not applicable if items are hard deleted with invoice
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding supplier invoice item by id ${id}`, error });
      throw new ServerError('Error finding supplier invoice item.');
    }
  }

  async findBySupplierInvoiceId(
    supplierInvoiceId: number,
    options?: FindManyOptions<SupplierInvoiceItem>,
  ): Promise<SupplierInvoiceItem[]> {
    try {
      return await this.repository.find({
        where: { supplierInvoiceId, ...(options?.where || {}) },
        relations:
          options?.relations === undefined
            ? ['product', 'productVariant', 'purchaseReceptionItem']
            : options.relations,
        order: options?.order || { createdAt: 'ASC' }, // Ou un autre ordre logique
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for supplier invoice ${supplierInvoiceId}`,
        error,
      });
      throw new ServerError('Error finding supplier invoice items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<SupplierInvoiceItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoiceItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding supplier invoice item by criteria`, error, where });
      throw new ServerError('Error finding supplier invoice item.');
    }
  }

  create(
    dto: Partial<SupplierInvoiceItem>,
    transactionalEntityManager?: EntityManager,
  ): SupplierInvoiceItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: SupplierInvoiceItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoiceItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      // Ensure totalLineAmountHt is calculated before save if not DB generated
      if (item.quantity !== undefined && item.unitPriceHt !== undefined) {
        item.totalLineAmountHt = parseFloat(
          (Number(item.quantity) * Number(item.unitPriceHt)).toFixed(4),
        );
      }
      return await repo.save(item);
    } catch (error: any) {
      // Check for specific unique constraints if any
      logger.error({ message: 'Error saving supplier invoice item', error, item });
      throw new ServerError('Error saving supplier invoice item.');
    }
  }

  async saveMany(
    items: SupplierInvoiceItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoiceItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      for (const item of items) {
        if (item.quantity !== undefined && item.unitPriceHt !== undefined) {
          item.totalLineAmountHt = parseFloat(
            (Number(item.quantity) * Number(item.unitPriceHt)).toFixed(4),
          );
        }
      }
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple supplier invoice items', error });
      throw new ServerError('Error saving supplier invoice items.');
    }
  }

  async remove(
    item: SupplierInvoiceItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoiceItem> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing supplier invoice item ${item.id}`, error });
      throw new ServerError('Error removing supplier invoice item.');
    }
  }

  async removeMany(
    items: SupplierInvoiceItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoiceItem[]> {
    // Hard delete
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple supplier invoice items', error });
      throw new ServerError('Error removing supplier invoice items.');
    }
  }

  async deleteById(id: number, transactionalEntityManager?: EntityManager): Promise<DeleteResult> {
    // Hard delete by ID
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting supplier invoice item by id ${id}`, error });
      throw new ServerError('Error deleting supplier invoice item.');
    }
  }

  async deleteBySupplierInvoiceId(
    supplierInvoiceId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierInvoiceItem)
        : this.repository;
      return await repo.delete({ supplierInvoiceId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for supplier invoice ${supplierInvoiceId}`,
        error,
      });
      throw new ServerError('Error deleting items for supplier invoice.');
    }
  }
}
