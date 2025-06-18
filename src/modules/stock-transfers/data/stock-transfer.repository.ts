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
import { StockTransfer } from '../models/stock-transfer.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllStockTransfersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<StockTransfer> | FindOptionsWhere<StockTransfer>[];
  order?: FindManyOptions<StockTransfer>['order'];
  relations?: string[];
}

export class StockTransferRepository {
  private readonly repository: Repository<StockTransfer>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(StockTransfer);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'sourceWarehouse',
      'sourceShop',
      'destinationWarehouse',
      'destinationShop',
      'items',
      'items.product',
      'items.productVariant',
      'requestedByUser',
      'shippedByUser',
      'receivedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return [
      'sourceWarehouse',
      'sourceShop',
      'destinationWarehouse',
      'destinationShop',
      'requestedByUser',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<StockTransfer | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(StockTransfer)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding stock transfer with id ${id}`, error },
        'StockTransferRepository.findById',
      );
      throw new ServerError(`Error finding stock transfer with id ${id}.`);
    }
  }

  async findByTransferNumber(transferNumber: string): Promise<StockTransfer | null> {
    try {
      return await this.repository.findOne({
        where: { transferNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding stock transfer by number '${transferNumber}'`, error },
        'StockTransferRepository.findByTransferNumber',
      );
      throw new ServerError(`Error finding stock transfer by number '${transferNumber}'.`);
    }
  }

  async findLastTransferNumber(prefix: string): Promise<string | null> {
    try {
      const lastTransfer: { maxTransferNumber: string | null } | undefined = await this.repository
        .createQueryBuilder('st')
        .select('MAX(st.transferNumber)', 'maxTransferNumber')
        .where('st.transferNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastTransfer?.maxTransferNumber ?? null;
    } catch (error) {
      logger.error({ message: 'Error fetching last stock transfer number', error, prefix });
      throw new ServerError('Could not fetch last stock transfer number.');
    }
  }

  async findAll(
    options: FindAllStockTransfersOptions = {},
  ): Promise<{ transfers: StockTransfer[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<StockTransfer> = {
        where,
        order: options.order ?? { requestDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [transfers, count] = await this.repository.findAndCount(findOptions);
      return { transfers, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all stock transfers`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'StockTransferRepository.findAll',
      );
      throw new ServerError(`Error finding all stock transfers.`);
    }
  }

  create(dto: Partial<StockTransfer>, transactionalEntityManager?: EntityManager): StockTransfer {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(StockTransfer)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    transfer: StockTransfer,
    transactionalEntityManager?: EntityManager,
  ): Promise<StockTransfer> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransfer)
        : this.repository;
      return await repo.save(transfer);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_stock_transfer_number')) {
          throw new BadRequestError(
            `Stock transfer with number '${transfer.transferNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving stock transfer ${transfer.id || transfer.transferNumber}`, error },
        'StockTransferRepository.save',
      );
      throw new ServerError(`Error saving stock transfer.`);
    }
  }

  async update(
    id: number,
    dto: Partial<StockTransfer>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransfer)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating stock transfer with id ${id}`, error },
        'StockTransferRepository.update',
      );
      throw new ServerError(`Error updating stock transfer with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockTransfer)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting stock transfer with id ${id}`, error },
        'StockTransferRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting stock transfer with id ${id}.`);
    }
  }
}
