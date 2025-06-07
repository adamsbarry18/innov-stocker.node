// src/modules/cash-registers/services/cash_register.service.ts
import { CashRegisterRepository } from '../data/cash-register.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
// TODO: Dépendance - Importer CashRegisterSessionRepository pour isCashRegisterInUse
import {
  type CreateCashRegisterInput,
  type UpdateCashRegisterInput,
  type CashRegisterApiResponse,
  type CashRegister,
  cashRegisterValidationInputErrors,
} from '../models/cash-register.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';

let instance: CashRegisterService | null = null;

export class CashRegisterService {
  private readonly registerRepository: CashRegisterRepository;
  private readonly shopRepository: ShopRepository;
  private readonly currencyRepository: CurrencyRepository;
  // TODO: Dépendance - private readonly sessionRepository: CashRegisterSessionRepository;

  constructor(
    registerRepository: CashRegisterRepository = new CashRegisterRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    // sessionRepository: CashRegisterSessionRepository = new CashRegisterSessionRepository(),
  ) {
    this.registerRepository = registerRepository;
    this.shopRepository = shopRepository;
    this.currencyRepository = currencyRepository;
    // TODO: this.sessionRepository = sessionRepository;
  }

  mapToApiResponse(register: CashRegister | null): CashRegisterApiResponse | null {
    if (!register) return null;
    return register.toApi();
  }

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

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CashRegister>;
    sort?: FindManyOptions<CashRegister>['order'];
    searchTerm?: string;
  }): Promise<{ registers: CashRegisterApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};
      const { registers, count } = await this.registerRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' },
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

  async create(
    input: CreateCashRegisterInput,
    createdByUserId?: number,
  ): Promise<CashRegisterApiResponse> {
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
      currentBalance: 0, // Initial balance is 0, managed by opening session
      // createdByUserId: createdByUserId, // Si audit
    });

    if (!registerEntity.isValid()) {
      throw new BadRequestError(
        `Cash register data is invalid. Errors: ${cashRegisterValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedRegister = await this.registerRepository.save(registerEntity);
      const populatedRegister = await this.registerRepository.findById(savedRegister.id); // Re-fetch with relations
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

  async update(
    id: number,
    input: UpdateCashRegisterInput,
    updatedByUserId?: number,
  ): Promise<CashRegisterApiResponse> {
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

  async delete(id: number, deletedByUserId?: number): Promise<void> {
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
    } catch (error) {
      logger.error(
        { message: `Error deleting cash register ${id}`, error },
        'CashRegisterService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting cash register ${id}.`);
    }
  }

  static getInstance(): CashRegisterService {
    if (!instance) {
      instance = new CashRegisterService();
    }
    return instance;
  }
}
