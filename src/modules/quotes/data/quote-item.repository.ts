import { type DataSource, type Repository } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { QuoteItem } from '../models/quote-item.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class QuoteItemRepository {
  private readonly repository: Repository<QuoteItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(QuoteItem);
  }

  async findById(id: number): Promise<QuoteItem | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['product', 'productVariant'],
      });
    } catch (error) {
      logger.error({ message: `Error finding quote item by id ${id}`, error });
      throw new ServerError('Error finding quote item.');
    }
  }

  async findByQuoteId(quoteId: number): Promise<QuoteItem[]> {
    try {
      return await this.repository.find({
        where: { quoteId },
        relations: ['product', 'productVariant'],
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding items for quote ${quoteId}`, error });
      throw new ServerError('Error finding quote items.');
    }
  }

  create(dto: Partial<QuoteItem>): QuoteItem {
    return this.repository.create(dto);
  }

  async save(item: QuoteItem): Promise<QuoteItem> {
    try {
      return await this.repository.save(item);
    } catch (error) {
      logger.error({ message: 'Error saving quote item', error, item });
      throw new ServerError('Error saving quote item.');
    }
  }

  async saveMany(items: QuoteItem[]): Promise<QuoteItem[]> {
    try {
      return await this.repository.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple quote items', error });
      throw new ServerError('Error saving quote items.');
    }
  }

  async remove(item: QuoteItem): Promise<QuoteItem> {
    try {
      return await this.repository.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing quote item ${item.id}`, error });
      throw new ServerError('Error removing quote item.');
    }
  }

  async removeMany(items: QuoteItem[]): Promise<QuoteItem[]> {
    try {
      return await this.repository.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple quote items', error });
      throw new ServerError('Error removing quote items.');
    }
  }
}
