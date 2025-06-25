import {
  CashRegister,
  CreateCashRegisterInput,
  UpdateCashRegisterInput,
  CashRegisterRepository,
  cashRegisterValidationInputErrors,
  CashRegisterApiResponse,
} from '@/modules/cash-registers';

import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { ActionType, EntityType, UserActivityLogService } from '@/modules/user-activity-logs';
import { ShopRepository } from '@/modules/shops';
import { CurrencyRepository } from '@/modules/currencies';

let instance: CashRegisterService | null = null;

/**
 * Service for managing cash registers.
 * This service handles operations such as creating, updating, deleting, and retrieving cash registers.
 */
export class CashRegisterService {
  private readonly registerRepository: CashRegisterRepository;
  private readonly shopRepository: ShopRepository;
  private readonly currencyRepository: CurrencyRepository;

  /**
   * Creates an instance of CashRegisterService.
   * @param registerRepository - The repository for cash registers.
   * @param shopRepository - The repository for shops.
   * @param currencyRepository - The repository for currencies.
   */
  constructor(
    registerRepository: CashRegisterRepository = new CashRegisterRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
  ) {
    this.registerRepository = registerRepository;
    this.shopRepository = shopRepository;
    this.currencyRepository = currencyRepository;
  }

  /**
   * Maps a CashRegister entity to a CashRegisterApiResponse.
   * @param register - The cash register entity.
   * @returns The API response representation of the cash register, or null if the input is null.
   */
  mapToApiResponse(register: CashRegister | null): CashRegisterApiResponse | null {
    if (!register) return null;
    return register.toApi();
  }

  /**
   * Finds a cash register by its ID.
   * @param id - The ID of the cash register.
   * @returns A promise that resolves to the API response of the cash register.
   */
  async findById(id: number): Promise<CashRegisterApiResponse> {
    try {
      const register = await this.registerRepository.findById(id);
      if (!register) throw new NotFoundError(`Cash register with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(register);
      if (!apiResponse) throw new ServerError(`Failed to map cash register ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding cash register by id ${id}`, error },
        'CashRegisterService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding cash register by id ${id}.`);
    }
  }

  /**
   * Finds all cash registers based on provided options.
   * @param options - Options for filtering, pagination, and sorting.
   * @param options.limit - The maximum number of registers to return.
   * @param options.offset - The number of registers to skip.
   * @param options.filters - Filters to apply to the query.
   * @param options.sort - Sorting options.
   * @returns A promise that resolves to an object containing an array of cash registers and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CashRegister>;
    sort?: FindManyOptions<CashRegister>['order'];
  }): Promise<{ registers: CashRegisterApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};
      const { registers, count } = await this.registerRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
      });
      const apiRegisters = registers
        .map((reg) => this.mapToApiResponse(reg))
        .filter(Boolean) as CashRegisterApiResponse[];
      return { registers: apiRegisters, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all cash registers`, error, options },
        'CashRegisterService.findAll',
      );
      throw new ServerError('Error finding all cash registers.');
    }
  }

  /**
   * Creates a new cash register.
   * @param input - The input data for creating the cash register.
   * @returns A promise that resolves to the API response of the newly created cash register.
   */
  async create(input: CreateCashRegisterInput): Promise<CashRegisterApiResponse> {
    if (input.shopId) {
      const shop = await this.shopRepository.findById(input.shopId);
      if (!shop) throw new BadRequestError(`Shop with ID ${input.shopId} not found.`);
    }
    const currency = await this.currencyRepository.findById(input.currencyId);
    if (!currency) {
      throw new BadRequestError(`Currency with ID ${input.currencyId} not found.`);
    }

    const existingByName = await this.registerRepository.findByName(input.name);
    if (existingByName) {
      throw new BadRequestError(`Cash register with name '${input.name}' already exists.`);
    }

    const registerEntity = this.registerRepository.create({
      ...input,
      currentBalance: 0,
    });

    if (!registerEntity.isValid()) {
      throw new BadRequestError(
        `Cash register data is invalid. Errors: ${cashRegisterValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedRegister = await this.registerRepository.save(registerEntity);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.FINANCIAL_TRANSACTION,
        savedRegister.id.toString(),
        { name: savedRegister.name, currencyId: savedRegister.currencyId },
      );

      const populatedRegister = await this.registerRepository.findById(savedRegister.id);
      const apiResponse = this.mapToApiResponse(populatedRegister);
      if (!apiResponse)
        throw new ServerError(`Failed to map newly created cash register ${savedRegister.id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error creating cash register`, error, input },
        'CashRegisterService.create',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create cash register.');
    }
  }

  /**
   * Updates an existing cash register.
   * @param id - The ID of the cash register to update.
   * @param input - The input data for updating the cash register.
   * @returns A promise that resolves to the API response of the updated cash register.
   */
  async update(id: number, input: UpdateCashRegisterInput): Promise<CashRegisterApiResponse> {
    try {
      const register = await this.registerRepository.findById(id);
      if (!register) throw new NotFoundError(`Cash register with id ${id} not found.`);

      if (input.name && input.name !== register.name) {
        const existingByName = await this.registerRepository.findByName(input.name);
        if (existingByName && existingByName.id !== id) {
          throw new BadRequestError(
            `Another cash register with name '${input.name}' already exists.`,
          );
        }
      }
      if (input.shopId !== undefined && input.shopId !== register.shopId) {
        // Handles setting to null
        if (input.shopId === null) {
          /* ok */
        } else {
          const shop = await this.shopRepository.findById(input.shopId);
          if (!shop) throw new BadRequestError(`New shop with ID ${input.shopId} not found.`);
        }
      }
      // CurrencyId is generally not updatable for a cash register.

      const tempRegisterData = { ...register, ...input };
      const tempRegister = this.registerRepository.create(tempRegisterData);
      if (!tempRegister.isValid()) {
        throw new BadRequestError(
          `Updated cash register data is invalid. Errors: ${cashRegisterValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<CashRegister> = { ...input };
      // updatePayload.updatedByUserId = updatedByUserId; // Si audit

      if (Object.keys(updatePayload).length === 0) {
        return this.mapToApiResponse(register) as CashRegisterApiResponse;
      }

      const result = await this.registerRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Cash register with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedRegister = await this.registerRepository.findById(id);
      if (!updatedRegister) throw new ServerError('Failed to re-fetch cash register after update.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.FINANCIAL_TRANSACTION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      const apiResponse = this.mapToApiResponse(updatedRegister);
      if (!apiResponse) throw new ServerError(`Failed to map updated cash register ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating cash register ${id}`, error, input },
        'CashRegisterService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update cash register ${id}.`);
    }
  }

  /**
   * Deletes a cash register by its ID.
   * @param id - The ID of the cash register to delete.
   * @returns A promise that resolves when the cash register is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    try {
      const register = await this.registerRepository.findById(id);
      if (!register) throw new NotFoundError(`Cash register with id ${id} not found.`);

      if (Math.abs(Number(register.currentBalance)) > Number.EPSILON) {
        throw new BadRequestError(
          `Cash register '${register.name}' has a non-zero balance (${register.currentBalance}) and cannot be deleted. Please close all sessions and ensure balance is zero.`,
        );
      }
      const isInUse = await this.registerRepository.isCashRegisterInUse(id);
      if (isInUse) {
        throw new BadRequestError(
          `Cash register '${register.name}' has active sessions or transactions and cannot be deleted.`,
        );
      }

      await this.registerRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.FINANCIAL_TRANSACTION,
        id.toString(),
      );
    } catch (error) {
      logger.error(
        { message: `Error deleting cash register ${id}`, error },
        'CashRegisterService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting cash register ${id}.`);
    }
  }

  /**
   * Returns a singleton instance of CashRegisterService.
   * @returns The singleton instance of CashRegisterService.
   */
  static getInstance(): CashRegisterService {
    instance ??= new CashRegisterService();
    return instance;
  }
}
