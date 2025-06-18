import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ImportBatch } from '../models/import.entity';

interface FindAllBatchesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<ImportBatch> | FindOptionsWhere<ImportBatch>[];
  order?: FindManyOptions<ImportBatch>['order'];
}

export class ImportBatchRepository {
  private readonly repository: Repository<ImportBatch>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ImportBatch);
  }

  private getDefaultRelations(): string[] {
    return ['createdByUser'];
  }

  async findById(
    id: number,
    options?: { transactionalEntityManager?: EntityManager },
  ): Promise<ImportBatch | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(ImportBatch)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding import batch with id ${id}`, error });
      throw new ServerError('Error finding import batch.');
    }
  }

  async findAll(
    options: FindAllBatchesOptions = {},
  ): Promise<{ batches: ImportBatch[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const [batches, count] = await this.repository.findAndCount({
        where,
        order: options.order ?? { createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: this.getDefaultRelations(),
      });
      return { batches, count };
    } catch (error) {
      logger.error({ message: `Error finding all import batches`, error, options });
      throw new ServerError('Error finding all import batches.');
    }
  }

  create(dto: Partial<ImportBatch>, transactionalEntityManager?: EntityManager): ImportBatch {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(ImportBatch)
      : this.repository;
    return repo.create(dto);
  }

  async save(batch: ImportBatch, transactionalEntityManager?: EntityManager): Promise<ImportBatch> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(ImportBatch)
        : this.repository;
      return await repo.save(batch);
    } catch (error: any) {
      logger.error({ message: `Error saving import batch ${batch.id || 'new'}`, error });
      throw new ServerError('Error saving import batch.');
    }
  }
}
