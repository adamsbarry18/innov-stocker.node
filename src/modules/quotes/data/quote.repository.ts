import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Quote } from '../models/quote.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { SalesOrder } from '@/modules/sales-orders';

interface FindAllQuotesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Quote> | FindOptionsWhere<Quote>[];
  order?: FindManyOptions<Quote>['order'];
  relations?: string[];
}

export class QuoteRepository {
  private readonly repository: Repository<Quote>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Quote);
  }

  private getDefaultRelations(): string[] {
    return [
      'customer',
      'currency',
      'shippingAddress',
      'billingAddress',
      'items',
      'items.product',
      'items.productVariant',
      'createdByUser',
      'updatedByUser',
    ];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Quote | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding quote with id ${id}`, error },
        'QuoteRepository.findById',
      );
      throw new ServerError(`Error finding quote with id ${id}.`);
    }
  }

  async findByQuoteNumber(quoteNumber: string): Promise<Quote | null> {
    try {
      return await this.repository.findOne({
        where: { quoteNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding quote by number '${quoteNumber}'`, error },
        'QuoteRepository.findByQuoteNumber',
      );
      throw new ServerError(`Error finding quote by number '${quoteNumber}'.`);
    }
  }

  async findLastQuoteNumber(prefix: string): Promise<string | null> {
    try {
      const lastQuote = await this.repository
        .createQueryBuilder('quote')
        .select('MAX(quote.quoteNumber)', 'maxQuoteNumber')
        .where('quote.quoteNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastQuote?.maxQuoteNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last quote number', error, prefix });
      throw new ServerError('Could not fetch last quote number.');
    }
  }

  async findAll(options: FindAllQuotesOptions = {}): Promise<{ quotes: Quote[]; count: number }> {
    try {
      const where = options.where
        ? Array.isArray(options.where)
          ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
          : { ...options.where, deletedAt: IsNull() }
        : { deletedAt: IsNull() };

      const findOptions: FindManyOptions<Quote> = {
        where,
        order: options.order ?? { issueDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations
          ? ['customer', 'currency', 'createdByUser']
          : options.relations,
      };
      const [quotes, count] = await this.repository.findAndCount(findOptions);
      return { quotes, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all quotes`, error, options },
        'QuoteRepository.findAll',
      );
      throw new ServerError(`Error finding all quotes.`);
    }
  }

  create(dto: Partial<Quote>): Quote {
    return this.repository.create(dto);
  }

  async save(quote: Quote): Promise<Quote> {
    try {
      return await this.repository.save(quote);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('quote_number_unique')) {
          throw new BadRequestError(`Quote with number '${quote.quoteNumber}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving quote ${quote.id || quote.quoteNumber}`, error },
        'QuoteRepository.save',
      );
      throw new ServerError(`Error saving quote.`);
    }
  }

  async update(id: number, dto: Partial<Quote>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating quote with id ${id}`, error },
        'QuoteRepository.update',
      );
      throw new ServerError(`Error updating quote with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting quote with id ${id}`, error },
        'QuoteRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting quote with id ${id}.`);
    }
  }

  async isQuoteConvertedToOrder(quoteId: number): Promise<boolean> {
    const salesOrderRepo = this.repository.manager.getRepository(SalesOrder);
    const count = await salesOrderRepo.count({ where: { quoteId: quoteId, deletedAt: IsNull() } });
    return count > 0;
  }
}
