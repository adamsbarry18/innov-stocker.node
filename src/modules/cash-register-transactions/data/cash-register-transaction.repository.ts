import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { CashRegisterTransaction } from '../models/cash-register-transaction.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllCRTransactionsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CashRegisterTransaction> | FindOptionsWhere<CashRegisterTransaction>[];
  order?: FindManyOptions<CashRegisterTransaction>['order'];
  relations?: string[];
}

export class CashRegisterTransactionRepository {
  private readonly repository: Repository<CashRegisterTransaction>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CashRegisterTransaction);
  }

  private getDefaultRelations(): string[] {
    return ['cashRegisterSession', 'paymentMethod', 'relatedSalesOrder', 'user'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<CashRegisterTransaction | null> {
    try {
      const repo =
        options?.transactionalEntityManager?.getRepository(CashRegisterTransaction) ||
        this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding cash register transaction with id ${id}`, error });
      throw new ServerError(`Error finding cash register transaction with id ${id}.`);
    }
  }

  async findAll(
    options: FindAllCRTransactionsOptions = {},
  ): Promise<{ transactions: CashRegisterTransaction[]; count: number }> {
    try {
      const where = options.where
        ? Array.isArray(options.where)
          ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
          : { ...options.where, deletedAt: IsNull() }
        : { deletedAt: IsNull() };

      const findOptions: FindManyOptions<CashRegisterTransaction> = {
        where,
        order: options.order || { transactionTimestamp: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations === undefined ? this.getDefaultRelations() : options.relations,
      };
      const [transactions, count] = await this.repository.findAndCount(findOptions);
      return { transactions, count };
    } catch (error) {
      logger.error({ message: `Error finding all cash register transactions`, error, options });
      throw new ServerError(`Error finding all cash register transactions.`);
    }
  }

  async findBySessionId(
    cashRegisterSessionId: number,
    options?: FindManyOptions<CashRegisterTransaction>,
  ): Promise<CashRegisterTransaction[]> {
    try {
      return await this.repository.find({
        where: { cashRegisterSessionId, deletedAt: IsNull(), ...(options?.where || {}) },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
        order: options?.order || { transactionTimestamp: 'ASC', createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding transactions for session ${cashRegisterSessionId}`,
        error,
      });
      throw new ServerError(`Error finding transactions for session ${cashRegisterSessionId}.`);
    }
  }

  // Calculate sum of transaction amounts for a session (useful for theoretical balance)
  async getTransactionSumForSession(
    cashRegisterSessionId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo =
        transactionalEntityManager?.getRepository(CashRegisterTransaction) || this.repository;
      const qb = repo
        .createQueryBuilder('crt')
        .select(
          "SUM(CASE WHEN crt.type LIKE 'cash_in_%' OR crt.type = 'opening_float' OR crt.type = 'cash_withdrawal_from_bank' THEN crt.amount ELSE -crt.amount END)",
          'totalAmount',
        )
        .where('crt.cashRegisterSessionId = :sessionId', { sessionId: cashRegisterSessionId })
        .andWhere('crt.deletedAt IS NULL');

      const result = await qb.getRawOne();
      return Number(result?.totalAmount || 0);
    } catch (error) {
      logger.error({
        message: `Error calculating transaction sum for session ${cashRegisterSessionId}`,
        error,
      });
      throw new ServerError('Error calculating transaction sum for session.');
    }
  }

  create(
    dto: Partial<CashRegisterTransaction>,
    transactionalEntityManager?: EntityManager,
  ): CashRegisterTransaction {
    const repo =
      transactionalEntityManager?.getRepository(CashRegisterTransaction) || this.repository;
    return repo.create(dto);
  }

  async save(
    transaction: CashRegisterTransaction,
    transactionalEntityManager?: EntityManager,
  ): Promise<CashRegisterTransaction> {
    try {
      const repo =
        transactionalEntityManager?.getRepository(CashRegisterTransaction) || this.repository;
      return await repo.save(transaction);
    } catch (error: any) {
      logger.error({ message: `Error saving cash register transaction`, error, transaction });
      throw new ServerError('Error saving cash register transaction.');
    }
  }

  // Transactions are typically immutable. No update or direct delete.
  // If deletion is needed for reversal, it should be a specific service action.
}
