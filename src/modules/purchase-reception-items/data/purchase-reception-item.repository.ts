import {
  type DataSource,
  type Repository,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type UpdateResult,
  type SelectQueryBuilder,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import { PurchaseReceptionItem } from '../models/purchase-reception-item.entity';
import logger from '@/lib/logger';

export class PurchaseReceptionItemRepository {
  private readonly repository: Repository<PurchaseReceptionItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(PurchaseReceptionItem);
  }

  private getDefaultRelations(): string[] {
    return [
      'product',
      'productVariant',
      'purchaseReception',
      'purchaseOrderItem',
      'purchaseOrderItem.product',
      'purchaseOrderItem.productVariant',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[] },
  ): Promise<PurchaseReceptionItem | null> {
    try {
      return await this.repository.findOne({
        where: { id }, // Assuming soft delete handled by Model or cascade from PurchaseReception
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding purchase reception item by id ${id}`, error });
      throw new ServerError('Error finding purchase reception item.');
    }
  }

  public createSumQuantityReceivedQuery(
    purchaseOrderItemId: number,
    excludeReceptionId: number = -1,
  ): SelectQueryBuilder<PurchaseReceptionItem> {
    const query = this.repository
      .createQueryBuilder('item')
      .select('SUM(item.quantityReceived)', 'total')
      .where('item.purchaseOrderItemId = :purchaseOrderItemId', { purchaseOrderItemId })
      .andWhere('item.deletedAt IS NULL');
    if (excludeReceptionId !== -1) {
      query.andWhere('item.purchaseReceptionId != :excludeReceptionId', { excludeReceptionId });
    }
    return query;
  }

  async findByReceptionId(
    purchaseReceptionId: number,
    options?: FindManyOptions<PurchaseReceptionItem>,
  ): Promise<PurchaseReceptionItem[]> {
    try {
      return await this.repository.find({
        where: { purchaseReceptionId, ...(options?.where || {}) },
        relations:
          options?.relations === undefined
            ? ['product', 'productVariant', 'purchaseOrderItem']
            : options.relations,
        order: options?.order || { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for purchase reception ${purchaseReceptionId}`,
        error,
      });
      throw new ServerError('Error finding purchase reception items.');
    }
  }

  async findOneBy(
    where: FindOptionsWhere<PurchaseReceptionItem>,
  ): Promise<PurchaseReceptionItem | null> {
    try {
      return await this.repository.findOne({
        where,
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding purchase reception item by criteria`, error, where });
      throw new ServerError('Error finding purchase reception item.');
    }
  }

  create(dto: Partial<PurchaseReceptionItem>): PurchaseReceptionItem {
    return this.repository.create(dto);
  }

  async save(item: PurchaseReceptionItem): Promise<PurchaseReceptionItem> {
    try {
      return await this.repository.save(item);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          error.message?.includes(
            'purchaseReceptionId_productId_productVariantId_purchaseOrderItemId_unique',
          )
        ) {
          throw new BadRequestError(
            `This product/variant from this PO line has already been recorded in this reception.`,
          );
        }
      }
      logger.error({ message: 'Error saving purchase reception item', error, item });
      throw new ServerError('Error saving purchase reception item.');
    }
  }

  async saveMany(items: PurchaseReceptionItem[]): Promise<PurchaseReceptionItem[]> {
    try {
      return await this.repository.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple purchase reception items', error });
      throw new ServerError('Error saving purchase reception items.');
    }
  }

  async update(id: number, dto: Partial<PurchaseReceptionItem>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id }, dto);
    } catch (error: any) {
      logger.error({ message: `Error updating purchase reception item ${id}`, error, dto });
      throw new ServerError(`Error updating purchase reception item ${id}.`);
    }
  }

  async remove(item: PurchaseReceptionItem): Promise<PurchaseReceptionItem> {
    // Hard delete
    try {
      return await this.repository.remove(item);
    } catch (error) {
      logger.error({ message: `Error removing purchase reception item ${item.id}`, error });
      throw new ServerError('Error removing purchase reception item.');
    }
  }

  async removeMany(items: PurchaseReceptionItem[]): Promise<PurchaseReceptionItem[]> {
    // Hard delete
    try {
      return await this.repository.remove(items);
    } catch (error) {
      logger.error({ message: 'Error removing multiple purchase reception items', error });
      throw new ServerError('Error removing purchase reception items.');
    }
  }

  async deleteById(id: number): Promise<DeleteResult> {
    // Hard delete by ID
    try {
      return await this.repository.delete(id);
    } catch (error) {
      logger.error({ message: `Error deleting purchase reception item by id ${id}`, error });
      throw new ServerError('Error deleting purchase reception item.');
    }
  }

  async deleteByReceptionId(purchaseReceptionId: number): Promise<DeleteResult> {
    try {
      return await this.repository.delete({ purchaseReceptionId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for purchase reception ${purchaseReceptionId}`,
        error,
      });
      throw new ServerError('Error deleting items for purchase reception.');
    }
  }
}
