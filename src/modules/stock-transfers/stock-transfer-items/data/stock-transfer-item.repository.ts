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
import { StockTransferItem } from '../models/stock-transfer-item.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class StockTransferItemRepository {
  private readonly repository: Repository<StockTransferItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(StockTransferItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'stockTransfer'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<StockTransferItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding stock transfer item by id ${id}`, error });
      throw new ServerError('Error finding stock transfer item.');
    }
  }

  async findByStockTransferId(
    stockTransferId: number,
    options?: FindManyOptions<StockTransferItem>,
  ): Promise<StockTransferItem[]> {
    try {
      return await this.repository.find({
        where: { stockTransferId, deletedAt: IsNull(), ...(options?.where ?? {}) },
        relations: options?.relations ? ['product', 'productVariant'] : options?.relations,
        order: options?.order ?? { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding items for stock transfer ${stockTransferId}`, error });
      throw new ServerError('Error finding stock transfer items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<StockTransferItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<StockTransferItem | null> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.findOne({
        where: { ...where, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding stock transfer item by criteria`, error, where });
      throw new ServerError('Error finding stock transfer item.');
    }
  }

  create(
    dto: Partial<StockTransferItem>,
    transactionalEntityManager?: EntityManager,
  ): StockTransferItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(StockTransferItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: StockTransferItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<StockTransferItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.save(item);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string)?.includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_stock_transfer_item_product')) {
          throw new BadRequestError(`This product/variant is already part of this stock transfer.`);
        }
      }
      logger.error({ message: 'Error saving stock transfer item', error, item });
      throw new ServerError('Error saving stock transfer item.');
    }
  }

  async saveMany(
    items: StockTransferItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<StockTransferItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple stock transfer items', error });
      throw new ServerError('Error saving stock transfer items.');
    }
  }

  async update(
    id: number,
    dto: Partial<StockTransferItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error({ message: `Error updating stock transfer item ${id}`, error, dto });
      throw new ServerError(`Error updating stock transfer item ${id}.`);
    }
  }

  async softDelete(id: string, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting stock transfer item ${id}`, error });
      throw new ServerError('Error soft-deleting stock transfer item.');
    }
  }

  async deleteByStockTransferId(
    stockTransferId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransferItem)
        : this.repository;
      // Usually hard delete items if parent transfer is hard deleted or cancelled before processing
      return await repo.delete({ stockTransferId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for stock transfer ${stockTransferId}`,
        error,
      });
      throw new ServerError('Error deleting items for stock transfer.');
    }
  }
}
