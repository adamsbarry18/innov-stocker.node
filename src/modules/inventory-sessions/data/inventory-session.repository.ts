import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  ILike,
  type EntityManager,
  In,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { InventorySession, InventorySessionStatus } from '../models/inventory-session.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllInventorySessionsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<InventorySession> | FindOptionsWhere<InventorySession>[];
  order?: FindManyOptions<InventorySession>['order'];
  relations?: string[];
  searchTerm?: string;
}

export class InventorySessionRepository {
  private readonly repository: Repository<InventorySession>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(InventorySession);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'warehouse',
      'shop',
      'createdByUser',
      'validatedByUser',
      'updatedByUser',
      'items',
      'items.product',
      'items.productVariant',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['warehouse', 'shop', 'createdByUser', 'validatedByUser'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<InventorySession | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(InventorySession)
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
        { message: `Error finding inventory session with id ${id}`, error },
        'InventorySessionRepository.findById',
      );
      throw new ServerError(`Error finding inventory session with id ${id}.`);
    }
  }

  async findActiveSessionForLocation(location: {
    warehouseId?: number | null;
    shopId?: number | null;
  }): Promise<InventorySession | null> {
    try {
      const where: FindOptionsWhere<InventorySession> = {
        status: In([InventorySessionStatus.PENDING, InventorySessionStatus.IN_PROGRESS]),
        deletedAt: IsNull(),
      };
      if (location.warehouseId) where.warehouseId = location.warehouseId;
      else if (location.shopId) where.shopId = location.shopId;
      else return null;

      return await this.repository.findOne({
        where,
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error({
        message: `Error finding active inventory session for location`,
        error,
        location,
      });
      throw new ServerError('Error finding active inventory session.');
    }
  }

  async findAll(
    options: FindAllInventorySessionsOptions = {},
  ): Promise<{ sessions: InventorySession[]; count: number }> {
    try {
      let whereConditions:
        | FindOptionsWhere<InventorySession>
        | FindOptionsWhere<InventorySession>[] = options.where
        ? Array.isArray(options.where)
          ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
          : { ...options.where, deletedAt: IsNull() }
        : { deletedAt: IsNull() };

      if (options.searchTerm) {
        const searchPattern = ILike(`%${options.searchTerm}%`);
        const searchSpecific: FindOptionsWhere<InventorySession> = {
          notes: searchPattern,
          deletedAt: IsNull(),
        };
        if (Array.isArray(whereConditions)) {
          whereConditions = whereConditions.map((wc) => ({ ...wc, ...searchSpecific }));
        } else {
          whereConditions = { ...whereConditions, ...searchSpecific };
        }
      }

      const findOptions: FindManyOptions<InventorySession> = {
        where: whereConditions,
        order: options.order || { startDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations:
          options.relations === undefined
            ? this.getDefaultRelationsForFindAll()
            : options.relations,
      };
      const [sessions, count] = await this.repository.findAndCount(findOptions);
      return { sessions, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all inventory sessions`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'InventorySessionRepository.findAll',
      );
      throw new ServerError(`Error finding all inventory sessions.`);
    }
  }

  create(
    dto: Partial<InventorySession>,
    transactionalEntityManager?: EntityManager,
  ): InventorySession {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(InventorySession)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    session: InventorySession,
    transactionalEntityManager?: EntityManager,
  ): Promise<InventorySession> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySession)
        : this.repository;
      // Cascade will save items if configured and items are part of the 'session' entity instance
      return await repo.save(session);
    } catch (error: any) {
      // Handle potential unique constraints if any (e.g., active session per location)
      logger.error(
        { message: `Error saving inventory session ${session.id || 'new'}`, error },
        'InventorySessionRepository.save',
      );
      throw new ServerError(`Error saving inventory session.`);
    }
  }

  async update(
    id: number,
    dto: Partial<InventorySession>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySession)
        : this.repository;
      const { items, ...headerDto } = dto;
      return await repo.update({ id, deletedAt: IsNull() }, headerDto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating inventory session with id ${id}`, error },
        'InventorySessionRepository.update',
      );
      throw new ServerError(`Error updating inventory session with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySession)
        : this.repository;
      // Service should ensure session status allows deletion (e.g., not COMPLETED)
      return await repo.softDelete(id); // This should cascade to items if relation is set
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting inventory session with id ${id}`, error },
        'InventorySessionRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting inventory session with id ${id}.`);
    }
  }
}
