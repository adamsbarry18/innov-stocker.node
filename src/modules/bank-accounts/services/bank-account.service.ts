import { CurrencyRepository } from '../../currencies/data/currency.repository';
import {
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
  type BankAccountApiResponse,
  type BankAccount,
  bankAccountValidationInputErrors,
} from '../models/bank-account.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { BankAccountRepository } from '../data/bank-account.repository';

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
      let whereClause = options?.filters ? { ...options.filters } : {};
      const { accounts, count } = await this.bankAccountRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { accountName: 'ASC' },
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

  async create(
    input: CreateBankAccountInput,
    createdByUserId?: number,
  ): Promise<BankAccountApiResponse> {
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
      currentBalance: input.initialBalance || 0, // currentBalance starts as initialBalance
      // createdByUserId: createdByUserId, // Si audit
    });

    if (!accountEntity.isValid()) {
      throw new BadRequestError(
        `Bank account data is invalid. Errors: ${bankAccountValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedAccount = await this.bankAccountRepository.save(accountEntity);
      logger.info(
        `Bank account '${savedAccount.accountName}' (ID: ${savedAccount.id}) created successfully.`,
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

  async update(
    id: number,
    input: UpdateBankAccountInput,
    updatedByUserId?: number,
  ): Promise<BankAccountApiResponse> {
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
      // updatePayload.updatedByUserId = updatedByUserId; // Si audit

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

      logger.info(`Bank account '${updatedAccount.accountName}' (ID: ${id}) updated successfully.`);
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

  async delete(id: number, deletedByUserId?: number): Promise<void> {
    try {
      const account = await this.bankAccountRepository.findById(id);
      if (!account) throw new NotFoundError(`Bank account with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si le compte bancaire est utilisé (Payments)
      // Et si currentBalance est non nul (généralement on ne supprime pas un compte avec un solde)
      // Check if currentBalance is strictly zero (handle potential decimal string)
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
      logger.info(`Bank account '${account.accountName}' (ID: ${id}) successfully soft-deleted.`);
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
    if (!instance) {
      instance = new BankAccountService();
    }
    return instance;
  }
}
