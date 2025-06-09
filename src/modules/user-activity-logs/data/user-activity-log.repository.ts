import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  type FindManyOptions,
  ILike,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { UserActivityLog } from '../models/user-activity-log.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllLogsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<UserActivityLog> | FindOptionsWhere<UserActivityLog>[];
  order?: FindManyOptions<UserActivityLog>['order'];
  relations?: string[];
  searchTerm?: string;
}

export class UserActivityLogRepository {
  private readonly repository: Repository<UserActivityLog>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(UserActivityLog);
  }

  private getDefaultRelations(): string[] {
    return ['user'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<UserActivityLog | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(UserActivityLog)
        : this.repository;
      return await repo.findOne({
        where: { id },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding activity log with id ${id}`, error },
        'UserActivityLogRepository.findById',
      );
      throw new ServerError(`Error finding activity log with id ${id}.`);
    }
  }

  async findAll(
    options: FindAllLogsOptions = {},
  ): Promise<{ logs: UserActivityLog[]; count: number }> {
    try {
      const whereConditions = options.where ?? {};

      const findOptions: FindManyOptions<UserActivityLog> = {
        where: whereConditions,
        order: options.order ?? { timestamp: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelations() : options.relations,
      };
      const [logs, count] = await this.repository.findAndCount(findOptions);
      return { logs, count };
    } catch (error) {
      logger.error(`Error finding all activity logs ${JSON.stringify(error)}`);
      throw new ServerError(`Error finding all activity logs.`);
    }
  }

  create(
    dto: Partial<UserActivityLog>,
    transactionalEntityManager?: EntityManager,
  ): UserActivityLog {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(UserActivityLog)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    log: UserActivityLog,
    transactionalEntityManager?: EntityManager,
  ): Promise<UserActivityLog> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(UserActivityLog)
        : this.repository;
      return await repo.save(log);
    } catch (error: any) {
      logger.error({ message: `Error saving activity log`, error, log });
      throw new ServerError('Error saving activity log.');
    }
  }
}
