import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Warehouse } from '../models/warehouse.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllWarehousesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Warehouse>;
  order?: FindManyOptions<Warehouse>['order'];
  relations?: string[];
}

export class WarehouseRepository {
  private readonly repository: Repository<Warehouse>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Warehouse);
  }

  private getDefaultRelations(): string[] {
    return ['address', 'manager' /* 'createdByUser', 'updatedByUser' */];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Warehouse | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding warehouse with id ${id}`, error },
        'WarehouseRepository.findById',
      );
      throw new ServerError(`Error finding warehouse with id ${id}.`);
    }
  }

  async findByName(name: string): Promise<Warehouse | null> {
    try {
      return await this.repository.findOne({ where: { name, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding warehouse by name '${name}'`, error },
        'WarehouseRepository.findByName',
      );
      throw new ServerError(`Error finding warehouse by name '${name}'.`);
    }
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    if (!code) return null;
    try {
      return await this.repository.findOne({ where: { code, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding warehouse by code '${code}'`, error },
        'WarehouseRepository.findByCode',
      );
      throw new ServerError(`Error finding warehouse by code '${code}'.`);
    }
  }

  async findAll(
    options: FindAllWarehousesOptions = {},
  ): Promise<{ warehouses: Warehouse[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<Warehouse> = {
        where,
        order: options.order || { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations === undefined ? this.getDefaultRelations() : options.relations,
      };
      const [warehouses, count] = await this.repository.findAndCount(findOptions);
      return { warehouses, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all warehouses`, error, options },
        'WarehouseRepository.findAll',
      );
      throw new ServerError(`Error finding all warehouses.`);
    }
  }

  create(dto: Partial<Warehouse>): Warehouse {
    return this.repository.create(dto);
  }

  async save(warehouse: Warehouse): Promise<Warehouse> {
    try {
      return await this.repository.save(warehouse);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_warehouse_name')) {
          throw new BadRequestError(`Warehouse with name '${warehouse.name}' already exists.`);
        }
        if (warehouse.code && error.message?.includes('uq_warehouse_code')) {
          throw new BadRequestError(`Warehouse with code '${warehouse.code}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving warehouse ${warehouse.id || warehouse.name}`, error },
        'WarehouseRepository.save',
      );
      throw new ServerError(`Error saving warehouse.`);
    }
  }

  async update(id: number, dto: Partial<Warehouse>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.name && error.message?.includes('uq_warehouse_name')) {
          throw new BadRequestError(
            `Cannot update: Warehouse with name '${dto.name}' may already exist.`,
          );
        }
        if (dto.code && error.message?.includes('uq_warehouse_code')) {
          throw new BadRequestError(
            `Cannot update: Warehouse with code '${dto.code}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating warehouse with id ${id}`, error },
        'WarehouseRepository.update',
      );
      throw new ServerError(`Error updating warehouse with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // Dependency checks (e.g., stock_levels, purchase_orders) should be in the service layer.
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting warehouse with id ${id}`, error },
        'WarehouseRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting warehouse with id ${id}.`);
    }
  }

  /* TODO: Dépendance - Implémenter cette méthode avec les repositories pertinents (StockMovement, InventorySession, etc.)
  async isWarehouseInUse(warehouseId: number): Promise<boolean> {
    logger.warn('WarehouseRepository.isWarehouseInUse is a placeholder.');
    // Example:
    // const stockMovementRepo = this.repository.manager.getRepository(StockMovement);
    // const count = await stockMovementRepo.count({where: [{warehouseId: warehouseId}, {shopId: warehouseId}]}); // if shopId can reference warehouseId
    // return count > 0;
    return false;
  }*/
}
