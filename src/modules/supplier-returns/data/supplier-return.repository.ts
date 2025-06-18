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
import { SupplierReturn } from '../models/supplier-return.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllSupplierReturnsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<SupplierReturn> | FindOptionsWhere<SupplierReturn>[];
  order?: FindManyOptions<SupplierReturn>['order'];
  relations?: string[];
}

export class SupplierReturnRepository {
  private readonly repository: Repository<SupplierReturn>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(SupplierReturn);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'supplier',
      'items',
      'items.product',
      'items.productVariant',
      'items.purchaseReceptionItem',
      'createdByUser',
      'shippedByUser',
      'updatedByUser',
      'sourceWarehouse',
      'sourceShop',
      'processedByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['supplier', 'createdByUser', 'sourceWarehouse', 'sourceShop', 'processedByUser'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<SupplierReturn | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(SupplierReturn)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding supplier return with id ${id}`, error },
        'SupplierReturnRepository.findById',
      );
      throw new ServerError(`Error finding supplier return with id ${id}.`);
    }
  }

  async findByReturnNumber(returnNumber: string): Promise<SupplierReturn | null> {
    try {
      return await this.repository.findOne({
        where: { returnNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding supplier return by number '${returnNumber}'`, error },
        'SupplierReturnRepository.findByReturnNumber',
      );
      throw new ServerError(`Error finding supplier return by number '${returnNumber}'.`);
    }
  }

  async findLastReturnNumber(prefix: string): Promise<string | null> {
    try {
      const lastReturn: { maxReturnNumber: string | null } = (await this.repository
        .createQueryBuilder('sr')
        .select('MAX(sr.returnNumber)', 'maxReturnNumber')
        .where('sr.returnNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne()) ?? { maxReturnNumber: null };
      return lastReturn?.maxReturnNumber ?? null;
    } catch (error) {
      logger.error({ message: 'Error fetching last supplier return number', error, prefix });
      throw new ServerError('Could not fetch last supplier return number.');
    }
  }

  async findAll(
    options: FindAllSupplierReturnsOptions = {},
  ): Promise<{ returns: SupplierReturn[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };

      const findOptions: FindManyOptions<SupplierReturn> = {
        where,
        order: options.order ?? { returnDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [returns, count] = await this.repository.findAndCount(findOptions);
      return { returns, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all supplier returns`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'SupplierReturnRepository.findAll',
      );
      throw new ServerError(`Error finding all supplier returns.`);
    }
  }

  create(dto: Partial<SupplierReturn>, transactionalEntityManager?: EntityManager): SupplierReturn {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(SupplierReturn)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    sr: SupplierReturn,
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierReturn> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturn)
        : this.repository;
      return await repo.save(sr);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_sr_return_number')) {
          throw new BadRequestError(
            `Supplier return with number '${sr.returnNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving supplier return ${sr.id || sr.returnNumber}`, error },
        'SupplierReturnRepository.save',
      );
      throw new ServerError(`Error saving supplier return.`);
    }
  }

  async update(
    id: number,
    dto: Partial<SupplierReturn>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturn)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating supplier return with id ${id}`, error },
        'SupplierReturnRepository.update',
      );
      throw new ServerError(`Error updating supplier return with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(SupplierReturn)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting supplier return with id ${id}`, error },
        'SupplierReturnRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting supplier return with id ${id}.`);
    }
  }

  async isReturnProcessedForCreditOrRefund(returnId: number): Promise<boolean> {
    try {
      const paymentCount = await this.repository.manager
        .createQueryBuilder()
        .select('COUNT(*)')
        .from('payments', 'p')
        .where('p.related_return_id = :returnId', { returnId })
        .andWhere('p.deleted_time IS NULL')
        .getCount();

      return paymentCount > 0;
    } catch (error) {
      logger.error(
        {
          message: `Error checking if supplier return ${returnId} is processed for credit/refund`,
          error,
        },
        'SupplierReturnRepository.isReturnProcessedForCreditOrRefund',
      );
      throw new ServerError(
        `Error checking if supplier return ${returnId} is processed for credit/refund.`,
      );
    }
  }
}
