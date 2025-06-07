import { WarehouseRepository } from '../data/warehouse.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { UserRepository } from '../../users/data/users.repository';
import {
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
  type WarehouseApiResponse,
  Warehouse,
  warehouseValidationInputErrors,
} from '../models/warehouse.entity';
import { Address } from '../../addresses/models/address.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { appDataSource } from '@/database/data-source';

let instance: WarehouseService | null = null;

export class WarehouseService {
  private readonly warehouseRepository: WarehouseRepository;
  private readonly addressRepository: AddressRepository;
  private readonly userRepository: UserRepository;

  constructor(
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.warehouseRepository = warehouseRepository;
    this.addressRepository = addressRepository;
    this.userRepository = userRepository;
  }

  mapToApiResponse(warehouse: Warehouse | null): WarehouseApiResponse | null {
    if (!warehouse) return null;
    return warehouse.toApi();
  }

  async findById(id: number): Promise<WarehouseApiResponse> {
    try {
      const warehouse = await this.warehouseRepository.findById(id);
      if (!warehouse) throw new NotFoundError(`Warehouse with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(warehouse);
      if (!apiResponse) throw new ServerError(`Failed to map warehouse ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding warehouse by id ${id}`, error },
        'WarehouseService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding warehouse by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Warehouse>;
    sort?: FindManyOptions<Warehouse>['order'];
    searchTerm?: string;
  }): Promise<{ warehouses: WarehouseApiResponse[]; total: number }> {
    try {
      const whereClause: FindOptionsWhere<Warehouse> | FindOptionsWhere<Warehouse>[] =
        options?.filters ? { ...options.filters } : {};
      if (options?.searchTerm) {
        logger.warn(
          'Search term functionality for warehouses is basic. Consider full-text search or QueryBuilder for complex OR logic.',
        );
        // This is a simplified search. For proper OR across multiple fields, QueryBuilder is better.
        // For now, this will likely only work if the DB/TypeORM setup supports it directly on a simple where.
        // A more robust approach would be to build an array of OR conditions.
        // Example:
        // whereClause = [
        //   { ...options.filters, name: ILike(`%${options.searchTerm}%`), deletedAt: IsNull() },
        //   { ...options.filters, code: ILike(`%${options.searchTerm}%`), deletedAt: IsNull() },
        // ];
        // However, this structure might conflict if options.filters already has name/code.
        // For now, let's assume the filterable decorator or buildTypeORMCriteria handles 'q' into specific fields.
        // If not, this needs to be implemented more robustly.
      }

      const { warehouses, count } = await this.warehouseRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
      });
      const apiWarehouses = warehouses
        .map((w) => this.mapToApiResponse(w))
        .filter(Boolean) as WarehouseApiResponse[];
      return { warehouses: apiWarehouses, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all warehouses`, error, options },
        'WarehouseService.findAll',
      );
      throw new ServerError('Error finding all warehouses.');
    }
  }

  async create(
    input: CreateWarehouseInput,
    createdByUserId: number,
  ): Promise<WarehouseApiResponse> {
    const existingByName = await this.warehouseRepository.findByName(input.name);
    if (existingByName) {
      throw new BadRequestError(`Warehouse with name '${input.name}' already exists.`);
    }
    if (input.code) {
      const existingByCode = await this.warehouseRepository.findByCode(input.code);
      if (existingByCode) {
        throw new BadRequestError(`Warehouse with code '${input.code}' already exists.`);
      }
    }
    if (input.managerId) {
      const manager = await this.userRepository.findById(input.managerId);
      if (!manager)
        throw new BadRequestError(`Manager (User) with ID ${input.managerId} not found.`);
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const warehouseRepoTx = transactionalEntityManager.getRepository(Warehouse);
      const addressRepoTx = transactionalEntityManager.getRepository(Address);

      const { newAddress, addressId: inputAddressId, ...warehouseData } = input;

      let finalAddressId = inputAddressId;
      if (newAddress) {
        if (inputAddressId) {
          throw new BadRequestError(
            'Provide either addressId or newAddress for warehouse, not both.',
          );
        }
        const addressEntity = addressRepoTx.create(newAddress);
        const savedAddress = await addressRepoTx.save(addressEntity);
        finalAddressId = savedAddress.id;
      } else if (inputAddressId) {
        const address = await this.addressRepository.findById(inputAddressId);
        if (!address) throw new BadRequestError(`Address with ID ${inputAddressId} not found.`);
      } else {
        throw new BadRequestError('Either addressId or newAddress is required for warehouse.');
      }
      if (!finalAddressId) throw new ServerError('Could not determine address ID for warehouse.');

      const warehouseEntity = warehouseRepoTx.create({
        ...warehouseData,
        addressId: finalAddressId,
        createdByUserId: createdByUserId,
        updatedByUserId: createdByUserId,
      });

      const tempWarehouseForValidation = this.warehouseRepository.create(warehouseEntity);
      if (!tempWarehouseForValidation.isValid()) {
        throw new BadRequestError(
          `Warehouse data is invalid. Errors: ${warehouseValidationInputErrors.join(', ')}`,
        );
      }

      const savedWarehouse = await warehouseRepoTx.save(warehouseEntity);
      const populatedWarehouse = await warehouseRepoTx.findOne({
        where: { id: savedWarehouse.id },
        relations: ['address', 'manager'],
      });
      const apiResponse = this.mapToApiResponse(populatedWarehouse);
      if (!apiResponse)
        throw new ServerError(`Failed to map newly created warehouse ${savedWarehouse.id}.`);
      return apiResponse;
    });
  }

  async update(
    id: number,
    input: UpdateWarehouseInput,
    updatedByUserId: number,
  ): Promise<WarehouseApiResponse> {
    const warehouseToUpdate = await this.warehouseRepository.findById(id);
    if (!warehouseToUpdate) throw new NotFoundError(`Warehouse with id ${id} not found.`);

    if (input.name && input.name !== warehouseToUpdate.name) {
      const existingByName = await this.warehouseRepository.findByName(input.name);
      if (existingByName && existingByName.id !== id) {
        throw new BadRequestError(`Another warehouse with name '${input.name}' already exists.`);
      }
    }
    if (input.code && input.code !== warehouseToUpdate.code) {
      const existingByCode = await this.warehouseRepository.findByCode(input.code);
      if (existingByCode && existingByCode.id !== id) {
        throw new BadRequestError(`Another warehouse with code '${input.code}' already exists.`);
      }
    }
    if (input.addressId && input.addressId !== warehouseToUpdate.addressId) {
      const address = await this.addressRepository.findById(input.addressId);
      if (!address) throw new BadRequestError(`New address with ID ${input.addressId} not found.`);
    }
    if (input.hasOwnProperty('managerId')) {
      if (input.managerId !== null) {
        if (input.managerId !== warehouseToUpdate.managerId) {
          const manager = await this.userRepository.findById(input.managerId as number);
          if (!manager)
            throw new BadRequestError(`New manager (User) with ID ${input.managerId} not found.`);
        }
      }
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const warehouseRepoTx = transactionalEntityManager.getRepository(Warehouse);

      const tempWarehouseData = { ...warehouseToUpdate, ...input };
      const tempWarehouseForValidation = this.warehouseRepository.create(tempWarehouseData);
      if (!tempWarehouseForValidation.isValid()) {
        throw new BadRequestError(
          `Updated warehouse data is invalid. Errors: ${warehouseValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Warehouse> = { ...input, updatedByUserId };
      if (input.hasOwnProperty('code') && input.code === null) updatePayload.code = null;
      if (input.hasOwnProperty('managerId') && input.managerId === null)
        updatePayload.managerId = null;
      if (input.hasOwnProperty('capacityNotes') && input.capacityNotes === null)
        updatePayload.capacityNotes = null;

      let hasChanges = false;
      for (const key in input) {
        if (input.hasOwnProperty(key) && (input as any)[key] !== (warehouseToUpdate as any)[key]) {
          hasChanges = true;
          break;
        }
      }
      if (
        !hasChanges &&
        Object.keys(updatePayload).length === 1 &&
        updatePayload.updatedByUserId !== undefined
      ) {
        return this.mapToApiResponse(warehouseToUpdate) as WarehouseApiResponse;
      }

      const result = await warehouseRepoTx.update(id, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.warehouseRepository.findById(id);
        if (!stillExists)
          throw new NotFoundError(`Warehouse with id ${id} not found during update.`);
      }

      const updatedWarehouse = await warehouseRepoTx.findOne({
        where: { id },
        relations: ['address', 'manager'],
      });
      if (!updatedWarehouse) throw new ServerError('Failed to re-fetch warehouse after update.');

      const apiResponse = this.mapToApiResponse(updatedWarehouse);
      if (!apiResponse) throw new ServerError(`Failed to map updated warehouse ${id}.`);
      return apiResponse;
    });
  }

  async delete(id: number, deletedByUserId: number): Promise<void> {
    try {
      const warehouse = await this.warehouseRepository.findById(id);
      if (!warehouse) throw new NotFoundError(`Warehouse with id ${id} not found.`);

      /*const isInUse = await this.warehouseRepository.isWarehouseInUse(id);
      if (isInUse) {
        throw new BadRequestError(
          `Warehouse '${warehouse.name}' is in use and cannot be deleted. Please reassign associated records first.`,
        );
      }*/

      // await this.warehouseRepository.update(id, { updatedByUserId: deletedByUserId }); // Optional audit before delete
      await this.warehouseRepository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error deleting warehouse ${id}`, error }, 'WarehouseService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting warehouse ${id}.`);
    }
  }

  static getInstance(): WarehouseService {
    instance ??= new WarehouseService();
    return instance;
  }
}
