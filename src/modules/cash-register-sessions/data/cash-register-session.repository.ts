import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import {
  CashRegisterSession,
  CashRegisterSessionStatus,
} from '../models/cash-register-session.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllSessionsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CashRegisterSession>;
  order?: FindManyOptions<CashRegisterSession>['order'];
  relations?: string[];
}

export class CashRegisterSessionRepository {
  private readonly repository: Repository<CashRegisterSession>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CashRegisterSession);
  }

  private getDefaultRelations(): string[] {
    return ['cashRegister', 'openedByUser', 'closedByUser', 'cashRegister.currency'];
  }

  async findById(
    id: number,
    options?: { relations?: string[] },
  ): Promise<CashRegisterSession | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding cash register session with id ${id}`, error },
        'CRSessionRepository.findById',
      );
      throw new ServerError(`Error finding cash register session with id ${id}.`);
    }
  }

  async findActiveSessionByRegisterId(cashRegisterId: number): Promise<CashRegisterSession | null> {
    try {
      return await this.repository.findOne({
        where: {
          cashRegisterId,
          status: CashRegisterSessionStatus.OPEN,
          deletedAt: IsNull(),
        },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding active session for cash register ${cashRegisterId}`, error },
        'CRSessionRepository.findActiveSessionByRegisterId',
      );
      throw new ServerError(`Error finding active session for cash register ${cashRegisterId}.`);
    }
  }

  async findAll(
    options: FindAllSessionsOptions = {},
  ): Promise<{ sessions: CashRegisterSession[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<CashRegisterSession> = {
        where,
        order: options.order ?? { openingTimestamp: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelations() : options.relations,
      };
      const [sessions, count] = await this.repository.findAndCount(findOptions);
      return { sessions, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all cash register sessions`, error, options },
        'CRSessionRepository.findAll',
      );
      throw new ServerError(`Error finding all cash register sessions.`);
    }
  }

  create(dto: Partial<CashRegisterSession>): CashRegisterSession {
    return this.repository.create(dto);
  }

  async save(session: CashRegisterSession): Promise<CashRegisterSession> {
    try {
      return await this.repository.save(session);
    } catch (error: any) {
      logger.error(
        { message: `Error saving cash register session ${session.id || 'new'}`, error },
        'CRSessionRepository.save',
      );
      throw new ServerError(`Error saving cash register session.`);
    }
  }

  async update(id: number, dto: Partial<CashRegisterSession>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating cash register session with id ${id}`, error },
        'CRSessionRepository.update',
      );
      throw new ServerError(`Error updating cash register session with id ${id}.`);
    }
  }
}
