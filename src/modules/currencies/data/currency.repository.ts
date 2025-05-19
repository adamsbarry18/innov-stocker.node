import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { Currency } from '../models/currency.entity';
import { appDataSource } from '@/database/data-source';

interface FindAllCurrenciesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Currency>;
  order?: FindManyOptions<Currency>['order'];
}

export class CurrencyRepository {
  private readonly repository: Repository<Currency>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Currency);
  }

  async findById(id: number): Promise<Currency | null> {
    return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async findByCode(code: string): Promise<Currency | null> {
    return await this.repository.findOne({
      where: { code: code.toUpperCase(), deletedAt: IsNull() },
    });
  }

  async findAll(
    options: FindAllCurrenciesOptions = {},
  ): Promise<{ currencies: Currency[]; count: number }> {
    const where = { ...options.where, deletedAt: IsNull() };
    const [currencies, count] = await this.repository.findAndCount({
      where,
      order: options.order || { code: 'ASC' },
      skip: options.skip,
      take: options.take,
    });
    return { currencies, count };
  }

  create(dto: Partial<Currency>): Currency {
    const currency = this.repository.create(dto);
    if (currency.code) {
      currency.code = currency.code.toUpperCase();
    }
    return currency;
  }

  async save(currency: Currency): Promise<Currency> {
    if (currency.code) {
      currency.code = currency.code.toUpperCase();
    }
    return await this.repository.save(currency);
  }

  async update(id: number, dto: Partial<Currency>): Promise<UpdateResult> {
    if (dto.code) {
      dto.code = dto.code.toUpperCase();
    }
    return await this.repository.update({ id, deletedAt: IsNull() }, dto);
  }

  async softDelete(id: number): Promise<UpdateResult> {
    return await this.repository.softDelete(id);
  }

  async exists(where: FindOptionsWhere<Currency>): Promise<boolean> {
    if (where.code && typeof where.code === 'string') {
      where.code = where.code.toUpperCase();
    }
    return await this.repository.exists({
      where: { ...where, deletedAt: IsNull() },
    });
  }
}
