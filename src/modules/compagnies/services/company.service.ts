import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import {
  Company,
  CompanyRepository,
  type UpdateCompanyInput,
  type CompanyApiResponse,
  companyValidationInputErrors,
} from '../index';
import { AddressRepository } from '@/modules/addresses/data/address.repository';
import { CurrencyRepository } from '@/modules/currencies/data/currency.repository';
import logger from '@/lib/logger';

let instance: CompanyService | null = null;

export class CompanyService {
  private readonly companyRepository: CompanyRepository;
  private readonly addressRepository: AddressRepository;
  private readonly currencyRepository: CurrencyRepository;

  constructor(
    companyRepository: CompanyRepository = new CompanyRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
  ) {
    this.companyRepository = companyRepository;
    this.addressRepository = addressRepository;
    this.currencyRepository = currencyRepository;
  }

  /**
   * Maps a Company entity to a CompanyApiResponse.
   * @param company The Company entity to map.
   * @returns The mapped CompanyApiResponse, or null if the input is null.
   */
  mapToApiResponse(company: Company | null): CompanyApiResponse | null {
    if (!company) return null;
    return company.toApi();
  }

  /**
   * Retrieves a company by its ID.
   * @param id The ID of the company to retrieve.
   * @returns The company API response.
   */
  async getCompanyDetails(id: number): Promise<CompanyApiResponse> {
    try {
      const company = await this.companyRepository.findCompanyById(id);
      if (!company) {
        throw new NotFoundError(`Company with ID ${id} not found.`);
      }
      const apiResponse = this.mapToApiResponse(company);
      if (!apiResponse) {
        throw new ServerError('Failed to map company details to API response.');
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error fetching company details for ID ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      if (error instanceof BadRequestError) throw error;
      throw new ServerError(`Error fetching company details for ID ${id}.`);
    }
  }

  /**
   * Retrieves all companies.
   * @returns A list of company API responses.
   */
  async getAllCompanies(): Promise<CompanyApiResponse[]> {
    try {
      const companies = await this.companyRepository.getAllCompanies();
      return companies
        .map((company) => this.mapToApiResponse(company))
        .filter((c): c is CompanyApiResponse => c !== null);
    } catch (error) {
      logger.error(`Error fetching all companies: ${error}`);
      if (error instanceof NotFoundError) throw error;
      if (error instanceof BadRequestError) throw error;
      throw new ServerError(`Error fetching all companies.`);
    }
  }

  /**
   * Updates a company record.
   * @param id The ID of the company to update.
   * @param input The update data.
   * @returns The updated company API response.
   */
  async updateCompanyDetails(id: number, input: UpdateCompanyInput): Promise<CompanyApiResponse> {
    // Validation des ID d'adresse et de devise (vérifier leur existence)
    const address = await this.addressRepository.findById(input.addressId);
    if (!address) throw new BadRequestError(`Address with ID ${input.addressId} not found.`);

    const currency = await this.currencyRepository.findById(input.defaultCurrencyId);
    if (!currency) throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    try {
      const companyToUpdate = await this.companyRepository.findCompanyById(id);
      if (!companyToUpdate) {
        throw new NotFoundError(`Company with ID ${id} not found.`);
      }

      // Ne mettre à jour que les champs scalaires autorisés, préserver les relations existantes
      const updatableFields = {
        name: input.name,
        tradingName: input.tradingName,
        addressId: input.addressId,
        vatNumber: input.vatNumber,
        siretNumber: input.siretNumber,
        registrationNumber: input.registrationNumber,
        email: input.email,
        phoneNumber: input.phoneNumber,
        website: input.website,
        logoUrl: input.logoUrl,
        defaultCurrencyId: input.defaultCurrencyId,
        defaultVatRatePercentage: input.defaultVatRatePercentage,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        fiscalYearStartDay: input.fiscalYearStartDay,
        timezone: input.timezone,
        termsAndConditionsDefaultPurchase: input.termsAndConditionsDefaultPurchase,
        termsAndConditionsDefaultSale: input.termsAndConditionsDefaultSale,
        bankAccountDetailsForInvoices: input.bankAccountDetailsForInvoices,
      };

      const companyInstance = new Company();
      Object.assign(companyInstance, updatableFields, { id });

      if (!companyInstance.isValid()) {
        throw new BadRequestError(
          `Company data is invalid. Errors: ${companyValidationInputErrors.join(', ')}`,
        );
      }

      const savedCompany = await this.companyRepository.saveCompany({
        ...companyToUpdate,
        ...updatableFields,
        id: id,
      } as Partial<Company>);

      const fullSavedCompany = await this.companyRepository.findCompanyById(savedCompany.id);
      if (!fullSavedCompany) throw new ServerError('Failed to re-fetch company after update.');

      const apiResponse = this.mapToApiResponse(fullSavedCompany);
      if (!apiResponse) {
        throw new ServerError('Failed to map updated company details to API response.');
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error updating company details for ID ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error updating company details for ID ${id}.`);
    }
  }

  /**
   * Deletes a company by its ID, after checking dependencies.
   * @param id The ID of the company to delete.
   */
  async delete(id: number): Promise<void> {
    try {
      const company = await this.companyRepository.findCompanyById(id);
      if (!company) {
        throw new NotFoundError(`Company with ID ${id} not found.`);
      }

      await this.companyRepository.softDelete(id);
    } catch (error) {
      logger.error(`Error deleting company ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting company ${id}.`);
    }
  }

  /**
   * Returns the singleton instance of CompanyService.
   * @returns The CompanyService instance.
   */
  static getInstance(): CompanyService {
    instance ??= new CompanyService();

    return instance;
  }
}
