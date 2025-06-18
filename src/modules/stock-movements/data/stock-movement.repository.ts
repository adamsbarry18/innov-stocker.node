import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { StockMovement } from '../models/stock-movement.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllStockMovementsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<StockMovement> | FindOptionsWhere<StockMovement>[];
  order?: FindManyOptions<StockMovement>['order'];
  relations?: string[];
}

export class StockMovementRepository {
  private readonly repository: Repository<StockMovement>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(StockMovement);
  }

  private getDefaultRelations(): string[] {
    return ['product', 'productVariant', 'warehouse', 'shop', 'user'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<StockMovement | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding stock movement with id ${id}`, error });
      throw new ServerError(`Error finding stock movement with id ${id}.`);
    }
  }

  async findAll(
    options: FindAllStockMovementsOptions = {},
  ): Promise<{ movements: StockMovement[]; count: number }> {
    try {
      // No deletedAt filter for StockMovement
      const where = options.where ?? {};
      const findOptions: FindManyOptions<StockMovement> = {
        where,
        order: options.order ?? { movementDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ?? this.getDefaultRelations(),
      };
      const [movements, count] = await this.repository.findAndCount(findOptions);
      return { movements, count };
    } catch (error) {
      logger.error({ message: `Error finding all stock movements`, error, options });
      throw new ServerError(`Error finding all stock movements.`);
    }
  }

  // Calculate current stock for a product/variant at a specific location
  async getCurrentStockLevel(
    productId: number,
    productVariantId: number | undefined,
    location: { warehouseId?: number | undefined; shopId?: number | undefined },
  ): Promise<number> {
    try {
      const qb = this.repository
        .createQueryBuilder('sm')
        .select('SUM(sm.quantity)', 'currentStock')
        .where('sm.productId = :productId', { productId });

      if (productVariantId !== undefined) {
        qb.andWhere('sm.productVariantId = :productVariantId', { productVariantId });
      }

      if (location.warehouseId) {
        qb.andWhere('sm.warehouseId = :warehouseId', { warehouseId: location.warehouseId });
      } else if (location.shopId) {
        qb.andWhere('sm.shopId = :shopId', { shopId: location.shopId });
      } else {
        throw new ServerError('WarehouseId or ShopId must be provided to get stock level.');
      }

      const result = await qb.getRawOne();
      return Number(result?.currentStock ?? 0);
    } catch (error) {
      logger.error({
        message: `Error calculating stock level`,
        productId,
        productVariantId,
        location,
        error,
      });
      throw new ServerError('Error calculating stock level.');
    }
  }

  create(dto: Partial<StockMovement>): StockMovement {
    return this.repository.create(dto);
  }

  async save(movement: StockMovement): Promise<StockMovement> {
    try {
      return await this.repository.save(movement);
    } catch (error: any) {
      logger.error({ message: `Error saving stock movement`, error, movement });
      throw new ServerError('Error saving stock movement.');
    }
  }
}
