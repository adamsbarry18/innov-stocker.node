import {
  type DataSource,
  type Repository,
  IsNull,
  type FindOptionsWhere,
  type UpdateResult,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { CompositeProductItem } from '../models/composite-product-item.entity';

export class CompositeProductItemRepository {
  private readonly repository: Repository<CompositeProductItem>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CompositeProductItem);
  }

  private getDefaultRelations(): string[] {
    return ['compositeProduct', 'componentProduct', 'componentVariant', 'componentVariant.image'];
  }

  async findById(id: number): Promise<CompositeProductItem | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error({ message: `Error finding composite item by id ${id}`, error });
      throw new ServerError('Error finding composite item.');
    }
  }

  async findByCompositeProductId(compositeProductId: number): Promise<CompositeProductItem[]> {
    try {
      return await this.repository.find({
        where: { compositeProductId, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
        order: { createdAt: 'ASC' }, // Or other logical order
      });
    } catch (error) {
      logger.error({
        message: `Error finding components for composite product ${compositeProductId}`,
        error,
      });
      throw new ServerError('Error finding composite product components.');
    }
  }

  async findByComponent(
    componentProductId: number,
    componentVariantId?: number | null,
  ): Promise<CompositeProductItem[]> {
    try {
      const where: FindOptionsWhere<CompositeProductItem> = {
        componentProductId,
        deletedAt: IsNull(),
      };
      if (componentVariantId !== undefined) {
        // Handles null explicitly
        where.componentVariantId = componentVariantId === null ? IsNull() : componentVariantId;
      }
      return await this.repository.find({ where, relations: this.getDefaultRelations() });
    } catch (error) {
      logger.error({
        message: `Error finding composite items by component`,
        error,
        componentProductId,
        componentVariantId,
      });
      throw new ServerError('Error finding composite items by component.');
    }
  }

  async findSpecificItem(
    compositeProductId: number,
    componentProductId: number,
    componentVariantId: number | null,
  ): Promise<CompositeProductItem | null> {
    try {
      return await this.repository.findOne({
        where: {
          compositeProductId,
          componentProductId,
          componentVariantId: componentVariantId === null ? IsNull() : componentVariantId,
          deletedAt: IsNull(),
        },
      });
    } catch (error) {
      logger.error({ message: 'Error finding specific composite item', error });
      throw new ServerError('Error finding specific composite item.');
    }
  }

  create(dto: Partial<CompositeProductItem>): CompositeProductItem {
    return this.repository.create(dto);
  }

  async save(item: CompositeProductItem): Promise<CompositeProductItem> {
    try {
      return await this.repository.save(item);
    } catch (error: any) {
      // The SQL schema has a UNIQUE KEY on (composite_product_id, component_product_id, component_variant_id) implicitly via PRIMARY KEY
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('cpi_unique_item')
      ) {
        throw new BadRequestError('This component is already part of this composite product.');
      }
      logger.error({ message: 'Error saving composite product item', error, item });
      throw new ServerError('Error saving composite product item.');
    }
  }

  async update(id: number, dto: Partial<CompositeProductItem>): Promise<UpdateResult> {
    // Typically only quantity is updated for an existing component link
    try {
      return await this.repository.update(
        { id, deletedAt: IsNull() },
        { quantity: dto.quantity /*, updatedByUserId: ...*/ },
      );
    } catch (error) {
      logger.error({ message: `Error updating composite item ${id}`, error, dto });
      throw new ServerError('Error updating composite item.');
    }
  }

  async removeByEntityId(id: number): Promise<UpdateResult> {
    // Assuming soft delete
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error removing composite item ${id}`, error });
      throw new ServerError('Error removing composite item.');
    }
  }

  async removeByCompositeAndComponent(
    compositeProductId: number,
    componentProductId: number,
    componentVariantId: number | null,
  ): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete({
        compositeProductId,
        componentProductId,
        componentVariantId: componentVariantId === null ? IsNull() : componentVariantId,
      });
    } catch (error) {
      logger.error({ message: `Error removing specific composite item link`, error });
      throw new ServerError('Error removing specific composite item link.');
    }
  }
}
