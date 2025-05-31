// src/modules/suppliers/data/supplier.repository.ts
import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Supplier } from '../models/supplier.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllSuppliersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Supplier>;
  order?: FindManyOptions<Supplier>['order'];
  relations?: string[];
}

export class SupplierRepository {
  private readonly _repository: Repository<Supplier>;

  constructor(dataSource: DataSource = appDataSource) {
    this._repository = dataSource.getRepository(Supplier);
  }

  public get repository(): Repository<Supplier> {
    return this._repository;
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Supplier | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations || [
          'address',
          'defaultCurrency' /*, 'createdByUser', 'updatedByUser'*/,
        ],
      });
    } catch (error) {
      logger.error(
        { message: `Error finding supplier with id ${id}`, error },
        'SupplierRepository.findById',
      );
      throw new ServerError(`Error finding supplier with id ${id}.`);
    }
  }

  async findByEmail(email: string): Promise<Supplier | null> {
    if (!email) return null;
    try {
      return await this.repository.findOne({
        where: { email: email.toLowerCase().trim(), deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error(
        { message: `Error finding supplier by email '${email}'`, error },
        'SupplierRepository.findByEmail',
      );
      throw new ServerError(`Error finding supplier by email '${email}'.`);
    }
  }

  async findByName(name: string): Promise<Supplier | null> {
    // Note: Name is not set as unique in the DB schema provided earlier.
    // This method can be used to check if a supplier with a similar name exists if needed.
    try {
      return await this.repository.findOne({
        where: { name, deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error(
        { message: `Error finding supplier by name '${name}'`, error },
        'SupplierRepository.findByName',
      );
      throw new ServerError(`Error finding supplier by name '${name}'.`);
    }
  }

  async findAll(
    options: FindAllSuppliersOptions = {},
  ): Promise<{ suppliers: Supplier[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<Supplier> = {
        where,
        order: options.order || { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations || ['address', 'defaultCurrency'],
      };
      const [suppliers, count] = await this.repository.findAndCount(findOptions);
      return { suppliers, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all suppliers`, error, options },
        'SupplierRepository.findAll',
      );
      throw new ServerError(`Error finding all suppliers.`);
    }
  }

  create(dto: Partial<Supplier>): Supplier {
    const supplier = this.repository.create(dto);
    if (supplier.email) {
      supplier.email = supplier.email.toLowerCase().trim();
    }
    return supplier;
  }

  async save(supplier: Supplier): Promise<Supplier> {
    try {
      if (supplier.email) {
        supplier.email = supplier.email.toLowerCase().trim();
      }
      return await this.repository.save(supplier);
    } catch (error: any) {
      // ER_DUP_ENTRY for MySQL, UNIQUE constraint failed for SQLite
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          error.message?.includes('email_unique_if_not_null') ||
          error.message?.includes('suppliers.email')
        ) {
          throw new BadRequestError(`Supplier with email '${supplier.email}' already exists.`);
        }
        // Add other unique constraint checks if necessary
      }
      logger.error(
        { message: `Error saving supplier ${supplier.id || supplier.name}`, error },
        'SupplierRepository.save',
      );
      throw new ServerError(`Error saving supplier.`);
    }
  }

  async update(id: number, dto: Partial<Supplier>): Promise<UpdateResult> {
    try {
      if (dto.email) {
        dto.email = dto.email.toLowerCase().trim();
      }
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          dto.email &&
          (error.message?.includes('email_unique_if_not_null') ||
            error.message?.includes('suppliers.email'))
        ) {
          throw new BadRequestError(
            `Cannot update: Supplier with email '${dto.email}' may already exist for another record.`,
          );
        }
      }
      logger.error(
        { message: `Error updating supplier with id ${id}`, error },
        'SupplierRepository.update',
      );
      throw new ServerError(`Error updating supplier with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // Dependency checks (e.g., on purchase orders) should be in the service layer
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting supplier with id ${id}`, error },
        'SupplierRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting supplier with id ${id}.`);
    }
  }

  // TODO: Dépendance - Implementer cette méthode avec PurchaseOrderRepository, ProductSupplierRepository, etc.
  async isSupplierInUse(supplierId: number): Promise<boolean> {
    logger.warn('SupplierRepository.isSupplierInUse is a placeholder and should be implemented.');
    // Example:
    // const poCount = await this.repository.manager.getRepository(PurchaseOrder).count({where: {supplierId}});
    // const psCount = await this.repository.manager.getRepository(ProductSupplier).count({where: {supplierId}});
    // return poCount > 0 || psCount > 0;
    return false;
  }
}
