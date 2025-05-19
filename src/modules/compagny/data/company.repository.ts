import { type Repository, type DataSource, IsNull } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Company } from '../models/company.entity';

export class CompanyRepository {
  private readonly repository: Repository<Company>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Company);
  }

  /**
   * Retrieves a company by its ID.
   * Loads relations for address and defaultCurrency.
   */
  async findCompanyById(id: number): Promise<Company | null> {
    return await this.repository.findOne({
      relations: ['address', 'defaultCurrency'],
      where: { id, deletedAt: IsNull() },
    });
  }

  /**
   * Retrieves all companies.
   * Loads relations for address and defaultCurrency.
   */
  async getAllCompanies(): Promise<Company[]> {
    return await this.repository.find({
      relations: ['address', 'defaultCurrency'],
      where: { deletedAt: IsNull() },
    });
  }

  /**
   * Saves (creates or updates) a company record.
   * @param companyData The company data to save.
   */
  async saveCompany(companyData: Partial<Company>): Promise<Company> {
    const company = this.repository.create(companyData);
    return await this.repository.save(company);
  }

  /**
   * Retrieves the company settings (assuming a single company record).
   * Loads relations for address and defaultCurrency.
   */
  async getCompanySettings(): Promise<Company | null> {
    return await this.repository.findOne({
      relations: ['address', 'defaultCurrency'],
      where: { deletedAt: IsNull() }, // Assuming the main company record is not soft-deleted
    });
  }
}
