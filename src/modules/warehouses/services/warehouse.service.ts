import { WarehouseRepository } from '../index';
import { AddressRepository } from '../../addresses/data/address.repository';
import { UserRepository } from '../../users/data/users.repository';
import {
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
  type WarehouseApiResponse,
  Warehouse,
  warehouseValidationInputErrors,
} from '../index';
import { Address } from '../../addresses/models/address.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: WarehouseService | null = null;

export class WarehouseService {
  private readonly warehouseRepository: WarehouseRepository;
  private readonly addressRepository: AddressRepository;
  private readonly userRepository: UserRepository;

  /**
   * Constructs a new WarehouseService instance.
   * @param warehouseRepository - The repository for warehouse data.
   * @param addressRepository - The repository for address data.
   * @param userRepository - The repository for user data.
   */
  constructor(
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.warehouseRepository = warehouseRepository;
    this.addressRepository = addressRepository;
    this.userRepository = userRepository;
  }

  /**
   * Maps a Warehouse entity to a WarehouseApiResponse.
   * @param warehouse - The warehouse entity to map.
   * @returns The API response representation of the warehouse, or null if the input is null.
   */
  mapToApiResponse(warehouse: Warehouse | null): WarehouseApiResponse | null {
    if (!warehouse) return null;
    return warehouse.toApi();
  }

  /**
   * Finds a warehouse by its unique ID.
   * @param id - The ID of the warehouse to find.
   * @returns A promise that resolves to the API response of the found warehouse.
   */
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

  /**
   * Retrieves all warehouses based on provided options.
   * @param options - An object containing limit, offset, filters, and sort.
   * @returns A promise that resolves to an object containing an array of warehouse API responses and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Warehouse>;
    sort?: FindManyOptions<Warehouse>['order'];
  }): Promise<{ warehouses: WarehouseApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};
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

  /**
   * Creates a new warehouse.
   * @param input - The data for creating the warehouse.
   * @param createdByUserId - The ID of the user creating the warehouse.
   * @returns A promise that resolves to the API response of the newly created warehouse.
   */
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

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PHYSICAL_LOCATION,
        savedWarehouse.id.toString(),
        { warehouseName: savedWarehouse.name, warehouseCode: savedWarehouse.code },
      );

      return apiResponse;
    });
  }

  /**
   * Updates an existing warehouse.
   * @param id - The ID of the warehouse to update.
   * @param input - The data for updating the warehouse.
   * @param updatedByUserId - The ID of the user updating the warehouse.
   * @returns A promise that resolves to the API response of the updated warehouse.
   */
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

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PHYSICAL_LOCATION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    });
  }

  /**
   * Deletes a warehouse by its unique ID.
   * @param id - The ID of the warehouse to delete.
   * @returns A promise that resolves when the warehouse is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    try {
      const warehouse = await this.warehouseRepository.findById(id);
      if (!warehouse) throw new NotFoundError(`Warehouse with id ${id} not found.`);

      /*const isInUse = await this.warehouseRepository.isWarehouseInUse(id);
      if (isInUse) {
        throw new BadRequestError(
          `Warehouse '${warehouse.name}' is in use and cannot be deleted. Please reassign associated records first.`,
        );
      }*/

      await this.warehouseRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PHYSICAL_LOCATION,
        id.toString(),
      );
    } catch (error) {
      logger.error({ message: `Error deleting warehouse ${id}`, error }, 'WarehouseService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting warehouse ${id}.`);
    }
  }

  /**
   * Returns a singleton instance of the WarehouseService.
   * @returns The singleton instance of WarehouseService.
   */
  static getInstance(): WarehouseService {
    instance ??= new WarehouseService();
    return instance;
  }
}
