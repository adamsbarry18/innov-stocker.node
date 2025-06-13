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
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { BankAccount } from '../models/bank-account.entity';
import { Payment } from '@/modules/payments/models/payment.entity';

interface FindAllBankAccountsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<BankAccount>;
  order?: FindManyOptions<BankAccount>['order'];
  relations?: string[];
}

export class BankAccountRepository {
  private readonly repository: Repository<BankAccount>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(BankAccount);
  }

  private getDefaultRelations(): string[] {
    return ['currency'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<BankAccount | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding bank account with id ${id}`, error },
        'BankAccountRepository.findById',
      );
      throw new ServerError(`Error finding bank account with id ${id}.`);
    }
  }

  async findByAccountName(accountName: string): Promise<BankAccount | null> {
    try {
      return await this.repository.findOne({ where: { accountName, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding bank account by name '${accountName}'`, error },
        'BankAccountRepository.findByAccountName',
      );
      throw new ServerError(`Error finding bank account by name '${accountName}'.`);
    }
  }

  async findByIban(iban: string): Promise<BankAccount | null> {
    if (!iban) return null;
    try {
      return await this.repository.findOne({ where: { iban, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding bank account by IBAN '${iban}'`, error },
        'BankAccountRepository.findByIban',
      );
      throw new ServerError(`Error finding bank account by IBAN '${iban}'.`);
    }
  }

  async findAll(
    options: FindAllBankAccountsOptions = {},
  ): Promise<{ accounts: BankAccount[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<BankAccount> = {
        where,
        order: options.order ?? { accountName: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelations() : options.relations,
      };
      const [accounts, count] = await this.repository.findAndCount(findOptions);
      return { accounts, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all bank accounts`, error, options },
        'BankAccountRepository.findAll',
      );
      throw new ServerError(`Error finding all bank accounts.`);
    }
  }

  create(dto: Partial<BankAccount>): BankAccount {
    return this.repository.create(dto);
  }

  async save(account: BankAccount): Promise<BankAccount> {
    try {
      return await this.repository.save(account);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_bank_account_name')) {
          throw new BadRequestError(
            `Bank account with name '${account.accountName}' already exists.`,
          );
        }
        if (account.iban && error.message?.includes('uq_bank_account_iban')) {
          throw new BadRequestError(`Bank account with IBAN '${account.iban}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving bank account ${account.id || account.accountName}`, error },
        'BankAccountRepository.save',
      );
      throw new ServerError(`Error saving bank account.`);
    }
  }

  async update(id: number, dto: Partial<BankAccount>): Promise<UpdateResult> {
    try {
      // currentBalance should be updated via specific transaction services, not directly here.
      const { currentBalance, ...updateDto } = dto;
      if (currentBalance !== undefined) {
        logger.warn(
          `Attempted to update currentBalance directly for bank account ${id}. This should be handled by transactions.`,
        );
      }
      return await this.repository.update({ id, deletedAt: IsNull() }, updateDto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.accountName && error.message?.includes('uq_bank_account_name')) {
          throw new BadRequestError(
            `Cannot update: Bank account with name '${dto.accountName}' may already exist.`,
          );
        }
        if (dto.iban && error.message?.includes('uq_bank_account_iban')) {
          throw new BadRequestError(
            `Cannot update: Bank account with IBAN '${dto.iban}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating bank account with id ${id}`, error },
        'BankAccountRepository.update',
      );
      throw new ServerError(`Error updating bank account with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting bank account with id ${id}`, error },
        'BankAccountRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting bank account with id ${id}.`);
    }
  }

  async isBankAccountInUse(accountId: number): Promise<boolean> {
    const paymentRepo = this.repository.manager.getRepository(Payment);
    const count = await paymentRepo.count({ where: { bankAccountId: accountId } });
    return count > 0;
  }

  async updateBalance(
    accountId: number,
    amountChange: number,
    manager: EntityManager,
  ): Promise<void> {
    try {
      await manager.increment(BankAccount, { id: accountId }, 'currentBalance', amountChange);
      // For decrement, amountChange would be negative:
      // await manager.decrement(BankAccount, { id: accountId }, "currentBalance", Math.abs(amountChange));
    } catch (error) {
      logger.error(
        { message: `Error updating balance for bank account ${accountId}`, error, amountChange },
        'BankAccountRepository.updateBalance',
      );
      throw new ServerError('Error updating bank account balance.');
    }
  }
}
