import {
  type DataSource,
  type Repository,
  IsNull,
  type FindManyOptions,
  type FindOptionsWhere,
  type DeleteResult,
  type EntityManager,
  type UpdateResult,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { InventorySessionItem } from '../models/inventory-session-item.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class InventorySessionItemRepository {
  private readonly repository: Repository<InventorySessionItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(InventorySessionItem);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'inventorySession'];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<InventorySessionItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding inventory session item by id ${id}`, error });
      throw new ServerError('Error finding inventory session item.');
    }
  }

  async findBySessionId(
    inventorySessionId: number,
    options?: FindManyOptions<InventorySessionItem>,
  ): Promise<InventorySessionItem[]> {
    try {
      return await this.repository.find({
        where: { inventorySessionId, deletedAt: IsNull(), ...(options?.where ?? {}) },
        relations: options?.relations ? ['product', 'productVariant'] : options?.relations,
        order: options?.order ?? { createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({
        message: `Error finding items for inventory session ${inventorySessionId}`,
        error,
      });
      throw new ServerError('Error finding inventory session items.');
    }
  }

  async findOneByWhere(
    where: FindOptionsWhere<InventorySessionItem>,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<InventorySessionItem | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      return await repo.findOne({
        where: { ...where, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding inventory session item by criteria`, error, where });
      throw new ServerError('Error finding inventory session item.');
    }
  }

  create(
    dto: Partial<InventorySessionItem>,
    transactionalEntityManager?: EntityManager,
  ): InventorySessionItem {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(InventorySessionItem)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    item: InventorySessionItem,
    transactionalEntityManager?: EntityManager,
  ): Promise<InventorySessionItem> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      item.calculateVariance(); // Ensure variance is calculated before save
      return await repo.save(item);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('inventory_item_unique')) {
          throw new BadRequestError(
            `This product/variant is already part of this inventory session.`,
          );
        }
      }
      logger.error({ message: 'Error saving inventory session item', error, item });
      throw new ServerError('Error saving inventory session item.');
    }
  }

  async saveMany(
    items: InventorySessionItem[],
    transactionalEntityManager?: EntityManager,
  ): Promise<InventorySessionItem[]> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      for (const item of items) {
        item.calculateVariance();
      }
      return await repo.save(items);
    } catch (error) {
      logger.error({ message: 'Error saving multiple inventory session items', error });
      throw new ServerError('Error saving inventory session items.');
    }
  }

  async update(
    id: number,
    dto: Partial<InventorySessionItem>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      if (dto.countedQuantity !== undefined && dto.theoreticalQuantity !== undefined) {
        dto.varianceQuantity = parseFloat(
          (Number(dto.countedQuantity) - Number(dto.theoreticalQuantity)).toFixed(3),
        );
      } else if (dto.countedQuantity !== undefined) {
        const currentItem = await repo.findOneBy({ id });
        if (currentItem) {
          dto.varianceQuantity = parseFloat(
            (Number(dto.countedQuantity) - Number(currentItem.theoreticalQuantity)).toFixed(3),
          );
        }
      }
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error({ message: `Error updating inventory session item ${id}`, error, dto });
      throw new ServerError(`Error updating inventory session item ${id}.`);
    }
  }

  async softDelete(id: string, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting inventory session item ${id}`, error });
      throw new ServerError('Error soft-deleting inventory session item.');
    }
  }

  async deleteBySessionId(
    inventorySessionId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<DeleteResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(InventorySessionItem)
        : this.repository;
      return await repo.delete({ inventorySessionId });
    } catch (error) {
      logger.error({
        message: `Error deleting items for inventory session ${inventorySessionId}`,
        error,
      });
      throw new ServerError('Error deleting items for inventory session.');
    }
  }
}
