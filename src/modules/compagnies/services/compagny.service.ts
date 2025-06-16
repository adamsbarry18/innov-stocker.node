import {
  BadRequestError,
  NotFoundError,
  ServerError,
  DependencyError,
} from '@/common/errors/httpErrors';
import {
  Company,
  CompanyRepository,
  UpdateCompanyInput,
  CompanyApiResponse,
  companyValidationInputErrors,
} from '../index';
import logger from '@/lib/logger';
import { Service, ResourcesKeys, DependentWrapper, dependency } from '@/common/utils/Service';

let instance: CompanyService | null = null;

@dependency(ResourcesKeys.COMPANY, [ResourcesKeys.ADDRESSES, ResourcesKeys.CURRENCIES])
export class CompanyService extends Service {
  private readonly companyRepository: CompanyRepository;

  constructor(companyRepository: CompanyRepository = new CompanyRepository()) {
    super();
    this.companyRepository = companyRepository;
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
    // Exemple :
    // const addressExists = await this.addressRepository.exists({ where: { id: input.addressId }});
    // if (!addressExists) throw new BadRequestError(`Address with ID ${input.addressId} not found.`);
    // const currencyExists = await this.currencyRepository.exists({ where: { id: input.defaultCurrencyId }});
    // if (!currencyExists) throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    const companyInstance = new Company();
    Object.assign(companyInstance, {
      ...input,
      id: id,
    });

    if (!companyInstance.isValid()) {
      throw new BadRequestError(
        `Company data is invalid. Errors: ${companyValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const companyToUpdate = await this.companyRepository.findCompanyById(id);
      if (!companyToUpdate) {
        throw new NotFoundError(`Company with ID ${id} not found.`);
      }

      const savedCompany = await this.companyRepository.saveCompany({
        ...companyToUpdate,
        ...input,
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
   * Implements dependency checking for the COMPANY resource.
   * Checks if any companies use the specified address.
   * @param dependentResourceKey The key of the dependent resource (must be ResourcesKeys.ADDRESSES)
   * @param dependentResourceId The ID of the dependent resource (the address ID)
   * @returns An array of DependentWrapper for dependent companies.
   */
  async getDependentEntities(
    dependentResourceKey: ResourcesKeys,
    dependentResourceId: number,
  ): Promise<DependentWrapper[]> {
    if (dependentResourceKey === ResourcesKeys.ADDRESSES) {
      const companies = await this.companyRepository.findByAddressId(dependentResourceId);
      return companies.map(
        (company) => new DependentWrapper(ResourcesKeys.COMPANY, company.id.toString(), true),
      );
    } else if (dependentResourceKey === ResourcesKeys.CURRENCIES) {
      // Check if any company uses this currency as default
      const companies = await this.companyRepository.getAllCompanies();
      return companies
        .filter((company) => company.defaultCurrencyId === dependentResourceId)
        .map((company) => new DependentWrapper(ResourcesKeys.COMPANY, company.id.toString(), true));
    }
    return [];
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

      await this.checkAndDelete(id, async () => {
        await this.companyRepository.softDelete(id);
      });
    } catch (error) {
      logger.error(`Error deleting company ${id}: ${error}`);
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof DependencyError
      )
        throw error;
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
