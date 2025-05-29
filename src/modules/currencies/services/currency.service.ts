import { CompanyRepository } from '@/modules/compagnies/data/company.repository';
import { CurrencyRepository } from '../data/currency.repository';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import {
  type CurrencyApiResponse,
  type Currency,
  type CreateCurrencyInput,
  currencyValidationInputErrors,
  type UpdateCurrencyInput,
} from '../models/currency.entity';
import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type CompanyApiResponse } from '@/modules/compagnies/models/company.entity';

let instance: CurrencyService | null = null;

export class CurrencyService {
  private readonly currencyRepository: CurrencyRepository;
  private readonly companyRepository: CompanyRepository;

  constructor(
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    companyRepository: CompanyRepository = new CompanyRepository(),
  ) {
    this.currencyRepository = currencyRepository;
    this.companyRepository = companyRepository;
  }

  mapToApiResponse(currency: Currency | null): CurrencyApiResponse | null {
    if (!currency) return null;
    return currency.toApi();
  }

  async findById(id: number): Promise<CurrencyApiResponse> {
    try {
      const currency = await this.currencyRepository.findById(id);
      if (!currency) throw new NotFoundError(`Currency with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(currency);
      if (!apiResponse) {
        throw new ServerError(`Failed to map currency with id ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error finding currency by id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding currency by id ${id}.`);
    }
  }

  async findByCode(code: string): Promise<CurrencyApiResponse> {
    try {
      const currency = await this.currencyRepository.findByCode(code);
      if (!currency) throw new NotFoundError(`Currency with code ${code} not found.`);

      const apiResponse = this.mapToApiResponse(currency);
      if (!apiResponse) {
        throw new ServerError(`Failed to map currency with code ${code} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error finding currency by code ${code}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding currency by code ${code}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Currency>;
    sort?: FindManyOptions<Currency>['order'];
  }): Promise<{ currencies: CurrencyApiResponse[]; total: number }> {
    try {
      // Normalize code filter if present
      const filters = options?.filters ? { ...options.filters } : {};
      if (filters.code && typeof filters.code === 'string') {
        filters.code = filters.code.toUpperCase();
      }

      const { currencies, count } = await this.currencyRepository.findAll({
        where: filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort,
      });
      const apiCurrencies = currencies
        .map((curr) => this.mapToApiResponse(curr))
        .filter(Boolean) as CurrencyApiResponse[];
      return { currencies: apiCurrencies, total: count };
    } catch (error) {
      logger.error(`Error finding all currencies: ${error}`);
      throw new ServerError('Error finding all currencies.');
    }
  }

  async create(input: CreateCurrencyInput): Promise<CurrencyApiResponse> {
    const currencyEntity = this.currencyRepository.create({
      ...input,
    });

    if (!currencyEntity.isValid()) {
      throw new BadRequestError(
        `Currency data is invalid. Errors: ${currencyValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedCurrency = await this.currencyRepository.save(currencyEntity);

      const apiResponse = this.mapToApiResponse(savedCurrency);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created currency ${savedCurrency.code} to API response.`,
        );
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error creating currency: ${error}`);
      if (error instanceof ServerError && error.message.includes('already exists')) {
        throw new BadRequestError(error.message);
      }
      throw new ServerError('Failed to create currency.');
    }
  }

  async update(id: number, input: UpdateCurrencyInput): Promise<CurrencyApiResponse> {
    try {
      const currency = await this.currencyRepository.findById(id);
      if (!currency) throw new NotFoundError(`Currency with id ${id} not found.`);

      const tempCurrency = this.currencyRepository.create({ ...currency, ...input });
      if (input.code) tempCurrency.code = input.code.toUpperCase(); // Ensure code is uppercase for validation

      if (!tempCurrency.isValid()) {
        throw new BadRequestError(
          `Updated currency data is invalid. Errors: ${currencyValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Currency> = { ...input };
      if (input.code) {
        updatePayload.code = input.code.toUpperCase();
      }
      // updatePayload.updatedByUserId = updatedByUserId; // Si audit

      const result = await this.currencyRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Currency with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedCurrency = await this.currencyRepository.findById(id);
      if (!updatedCurrency) throw new ServerError('Failed to re-fetch currency after update.');

      const apiResponse = this.mapToApiResponse(updatedCurrency);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated currency ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error updating currency ${id}: ${error}`);
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        (error instanceof ServerError && error.message.includes('already exist'))
      ) {
        throw error;
      }
      throw new ServerError(`Failed to update currency ${id}.`);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      const currency = await this.currencyRepository.findById(id);
      if (!currency) throw new NotFoundError(`Currency with id ${id} not found.`);

      const companySettings = await this.companyRepository.getCompanySettings();
      if (companySettings?.defaultCurrencyId === id) {
        throw new BadRequestError(
          `Cannot delete currency '${currency.code}' as it is the default company currency. Please set a different default currency first.`,
        );
      }

      await this.currencyRepository.softDelete(id);
    } catch (error) {
      logger.error(`Error deleting currency ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting currency ${id}.`);
    }
  }

  async setDefaultCompanyCurrency(currencyId: number): Promise<CompanyApiResponse> {
    const currencyToSetDefault = await this.currencyRepository.findById(currencyId);
    if (!currencyToSetDefault) {
      throw new NotFoundError(`Currency with id ${currencyId} not found.`);
    }
    if (!currencyToSetDefault.isActive) {
      throw new BadRequestError(
        `Currency '${currencyToSetDefault.code}' is not active and cannot be set as default.`,
      );
    }

    const company = await this.companyRepository.getCompanySettings();
    if (!company) {
      throw new ServerError('Company settings not found. Cannot set default currency.');
    }

    if (company.defaultCurrencyId === currencyId) {
      const currentCompany = await this.companyRepository.getCompanySettings();
      if (!currentCompany) throw new ServerError('Failed to fetch company details.');
      const apiResponse = currentCompany.toApi();
      if (
        !(apiResponse as any).defaultCurrency ||
        (apiResponse as any).defaultCurrency.id !== currencyId
      ) {
        (apiResponse as any).defaultCurrency = currencyToSetDefault.toApi();
      }
      return apiResponse as CompanyApiResponse;
    }

    company.defaultCurrencyId = currencyId;

    try {
      await this.companyRepository.saveCompany(company);

      if (currencyToSetDefault.exchangeRateToCompanyDefault !== 1.0) {
        currencyToSetDefault.exchangeRateToCompanyDefault = 1.0;
        await this.currencyRepository.save(currencyToSetDefault);
      }

      const updatedCompany = await this.companyRepository.getCompanySettings();
      if (!updatedCompany) throw new ServerError('Failed to fetch company details after update.');

      const apiResponse = updatedCompany.toApi();
      (apiResponse as any).defaultCurrency = currencyToSetDefault.toApi();
      return apiResponse as CompanyApiResponse;
    } catch (error) {
      logger.error(`Error setting default company currency: ${error}`);
      throw new ServerError('Failed to set default company currency.');
    }
  }

  static getInstance(): CurrencyService {
    if (!instance) {
      instance = new CurrencyService();
    }
    return instance;
  }
}
