import {
  BankAccount,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  BankAccountRepository,
  bankAccountValidationInputErrors,
  BankAccountApiResponse,
} from '@/modules/bank-accounts';

import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { ActionType, EntityType, UserActivityLogService } from '@/modules/user-activity-logs';
import { CurrencyRepository } from '@/modules/currencies';

let instance: BankAccountService | null = null;

export class BankAccountService {
  private readonly bankAccountRepository: BankAccountRepository;
  private readonly currencyRepository: CurrencyRepository;

  constructor(
    bankAccountRepository: BankAccountRepository = new BankAccountRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
  ) {
    this.bankAccountRepository = bankAccountRepository;
    this.currencyRepository = currencyRepository;
  }

  mapToApiResponse(account: BankAccount | null): BankAccountApiResponse | null {
    if (!account) return null;
    return account.toApi();
  }

  async findById(id: number): Promise<BankAccountApiResponse> {
    try {
      const account = await this.bankAccountRepository.findById(id);
      if (!account) throw new NotFoundError(`Bank account with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(account);
      if (!apiResponse) throw new ServerError(`Failed to map bank account ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding bank account by id ${id}`, error },
        'BankAccountService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding bank account by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<BankAccount>;
    sort?: FindManyOptions<BankAccount>['order'];
    searchTerm?: string;
  }): Promise<{ accounts: BankAccountApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};
      const { accounts, count } = await this.bankAccountRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { accountName: 'ASC' },
      });
      const apiAccounts = accounts
        .map((acc) => this.mapToApiResponse(acc))
        .filter(Boolean) as BankAccountApiResponse[];
      return { accounts: apiAccounts, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all bank accounts`, error, options },
        'BankAccountService.findAll',
      );
      throw new ServerError('Error finding all bank accounts.');
    }
  }

  async create(input: CreateBankAccountInput): Promise<BankAccountApiResponse> {
    const currency = await this.currencyRepository.findById(input.currencyId);
    if (!currency) {
      throw new BadRequestError(`Currency with ID ${input.currencyId} not found.`);
    }

    const existingByName = await this.bankAccountRepository.findByAccountName(input.accountName);
    if (existingByName) {
      throw new BadRequestError(`Bank account with name '${input.accountName}' already exists.`);
    }
    if (input.iban) {
      const existingByIban = await this.bankAccountRepository.findByIban(input.iban);
      if (existingByIban) {
        throw new BadRequestError(`Bank account with IBAN '${input.iban}' already exists.`);
      }
    }

    const accountEntity = this.bankAccountRepository.create({
      ...input,
      currentBalance: input.initialBalance ?? 0,
    });

    if (!accountEntity.isValid()) {
      throw new BadRequestError(
        `Bank account data is invalid. Errors: ${bankAccountValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedAccount = await this.bankAccountRepository.save(accountEntity);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.SYSTEM_CONFIGURATION,
        savedAccount.id.toString(),
        { accountName: savedAccount.accountName, currencyId: savedAccount.currencyId },
      );

      const populatedAccount = await this.bankAccountRepository.findById(savedAccount.id);
      const apiResponse = this.mapToApiResponse(populatedAccount);
      if (!apiResponse)
        throw new ServerError(`Failed to map newly created bank account ${savedAccount.id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error creating bank account`, error, input },
        'BankAccountService.create',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create bank account.');
    }
  }

  async update(id: number, input: UpdateBankAccountInput): Promise<BankAccountApiResponse> {
    try {
      const account = await this.bankAccountRepository.findById(id);
      if (!account) throw new NotFoundError(`Bank account with id ${id} not found.`);

      if (input.accountName && input.accountName !== account.accountName) {
        const existingByName = await this.bankAccountRepository.findByAccountName(
          input.accountName,
        );
        if (existingByName && existingByName.id !== id) {
          throw new BadRequestError(
            `Another bank account with name '${input.accountName}' already exists.`,
          );
        }
      }
      if (input.iban && input.iban !== account.iban) {
        const existingByIban = await this.bankAccountRepository.findByIban(input.iban);
        if (existingByIban && existingByIban.id !== id) {
          throw new BadRequestError(
            `Another bank account with IBAN '${input.iban}' already exists.`,
          );
        }
      }
      if (input.currencyId && input.currencyId !== account.currencyId) {
        const currency = await this.currencyRepository.findById(input.currencyId);
        if (!currency) {
          throw new BadRequestError(`New currency with ID ${input.currencyId} not found.`);
        }
        logger.warn(
          `Currency for bank account ${id} is being changed. Ensure this is intended and handle balance implications if any.`,
        );
      }

      const updateData = { ...input };
      const tempAccountData = {
        ...account,
        initialBalance: Number(account.initialBalance),
        ...updateData,
      };
      const tempAccount = this.bankAccountRepository.create(tempAccountData);
      if (!tempAccount.isValid()) {
        throw new BadRequestError(
          `Updated bank account data is invalid. Errors: ${bankAccountValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<BankAccount> = { ...updateData };

      if (Object.keys(updatePayload).length === 0) {
        return this.mapToApiResponse(account) as BankAccountApiResponse;
      }

      const result = await this.bankAccountRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Bank account with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedAccount = await this.bankAccountRepository.findById(id);
      if (!updatedAccount) throw new ServerError('Failed to re-fetch bank account after update.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SYSTEM_CONFIGURATION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      const apiResponse = this.mapToApiResponse(updatedAccount);
      if (!apiResponse) throw new ServerError(`Failed to map updated bank account ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating bank account ${id}`, error, input },
        'BankAccountService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update bank account ${id}.`);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      const account = await this.bankAccountRepository.findById(id);
      if (!account) throw new NotFoundError(`Bank account with id ${id} not found.`);

      if (Number(account.currentBalance) !== 0) {
        throw new BadRequestError(
          `Bank account '${account.accountName}' has a non-zero balance (${account.currentBalance}) and cannot be deleted.`,
        );
      }
      const isInUse = await this.bankAccountRepository.isBankAccountInUse(id);
      if (isInUse) {
        throw new BadRequestError(
          `Bank account '${account.accountName}' has associated transactions and cannot be deleted.`,
        );
      }

      await this.bankAccountRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.SYSTEM_CONFIGURATION,
        id.toString(),
      );
    } catch (error) {
      logger.error(
        { message: `Error deleting bank account ${id}`, error },
        'BankAccountService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting bank account ${id}.`);
    }
  }

  static getInstance(): BankAccountService {
    instance ??= new BankAccountService();

    return instance;
  }
}
