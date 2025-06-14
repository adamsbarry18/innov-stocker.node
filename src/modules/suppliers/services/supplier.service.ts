import { SupplierRepository } from '../data/supplier.repository';

import { AddressRepository } from '../../addresses/data/address.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';

import {
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierApiResponse,
  type Supplier,
  supplierValidationInputErrors,
} from '../models/supplier.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: SupplierService | null = null;

export class SupplierService {
  private readonly supplierRepository: SupplierRepository;
  private readonly addressRepository: AddressRepository;
  private readonly currencyRepository: CurrencyRepository;

  /**
   * Constructs a new SupplierService instance.
   * @param supplierRepository - The repository for supplier data.
   * @param addressRepository - The repository for address data.
   * @param currencyRepository - The repository for currency data.
   * @param purchaseOrderRepository - The repository for purchase order data.
   */
  constructor(
    supplierRepository: SupplierRepository = new SupplierRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
  ) {
    this.supplierRepository = supplierRepository;
    this.addressRepository = addressRepository;
    this.currencyRepository = currencyRepository;
  }

  /**
   * Maps a Supplier entity to a SupplierApiResponse.
   * @param supplier - The supplier entity to map.
   * @returns The API response representation of the supplier, or null if the input is null.
   */
  mapToApiResponse(supplier: Supplier | null): SupplierApiResponse | null {
    if (!supplier) return null;
    return supplier.toApi();
  }

  /**
   * Finds a supplier by its unique ID.
   * @param id - The ID of the supplier to find.
   * @returns A promise that resolves to the API response of the found supplier.
   */
  async findById(id: number): Promise<SupplierApiResponse> {
    try {
      const supplier = await this.supplierRepository.findById(id, {
        relations: ['address', 'defaultCurrency'],
      });
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(supplier);
      if (!apiResponse) {
        throw new ServerError(`Failed to map supplier ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding supplier by id ${id}`, error },
        'SupplierService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding supplier by id ${id}.`);
    }
  }

  /**
   * Retrieves all suppliers based on provided options.
   * @param options - An object containing limit, offset, filters, and sort.
   * @returns A promise that resolves to an object containing an array of supplier API responses and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Supplier>;
    sort?: FindManyOptions<Supplier>['order'];
  }): Promise<{ suppliers: SupplierApiResponse[]; total: number }> {
    try {
      const { suppliers, count } = await this.supplierRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
        relations: ['address', 'defaultCurrency'],
      });
      const apiSuppliers = suppliers
        .map((s) => this.mapToApiResponse(s))
        .filter(Boolean) as SupplierApiResponse[];
      return { suppliers: apiSuppliers, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all suppliers`, error, options },
        'SupplierService.findAll',
      );
      throw new ServerError('Error finding all suppliers.');
    }
  }

  /**
   * Creates a new supplier.
   * @param input - The data for creating the supplier.
   * @param createdByUserId - The ID of the user creating the supplier.
   * @returns A promise that resolves to the API response of the newly created supplier.
   */
  async create(input: CreateSupplierInput, createdByUserId: number): Promise<SupplierApiResponse> {
    if (input.addressId) {
      const addressExists = await this.addressRepository.findById(input.addressId);
      if (!addressExists)
        throw new BadRequestError(`Address with ID ${input.addressId} not found.`);
    }
    const currencyExists = await this.currencyRepository.findById(input.defaultCurrencyId);
    if (!currencyExists)
      throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    if (input.email) {
      const existingByEmail = await this.supplierRepository.findByEmail(input.email);
      if (existingByEmail) {
        throw new BadRequestError(`Supplier with email '${input.email}' already exists.`);
      }
    }

    const supplierEntity = this.supplierRepository.create({
      ...input,
      createdByUserId: createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!supplierEntity.isValid()) {
      throw new BadRequestError(
        `Supplier data is invalid. Errors: ${supplierValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedSupplier = await this.supplierRepository.save(supplierEntity);

      const populatedSupplier = await this.supplierRepository.findById(savedSupplier.id);
      const apiResponse = this.mapToApiResponse(populatedSupplier);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created supplier ${savedSupplier.id} to API response.`,
        );
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.EXTERNAL_PARTY,
        savedSupplier.id.toString(),
        { supplierName: savedSupplier.name, supplierEmail: savedSupplier.email },
      );

      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error creating supplier`, error, input }, 'SupplierService.create');
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create supplier.');
    }
  }

  /**
   * Updates an existing supplier.
   * @param id - The ID of the supplier to update.
   * @param input - The data for updating the supplier.
   * @param updatedByUserId - The ID of the user updating the supplier.
   * @returns A promise that resolves to the API response of the updated supplier.
   */
  async update(
    id: number,
    input: UpdateSupplierInput,
    updatedByUserId: number,
  ): Promise<SupplierApiResponse> {
    try {
      const supplier = await this.supplierRepository.findById(id);
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      if (input.addressId && input.addressId !== supplier.addressId) {
        const addressExists = await this.addressRepository.findById(input.addressId);
        if (!addressExists)
          throw new BadRequestError(`New address with ID ${input.addressId} not found.`);
      }
      if (input.defaultCurrencyId && input.defaultCurrencyId !== supplier.defaultCurrencyId) {
        const currencyExists = await this.currencyRepository.findById(input.defaultCurrencyId);
        if (!currencyExists)
          throw new BadRequestError(`New currency with ID ${input.defaultCurrencyId} not found.`);
      }

      if (input.email && input.email !== supplier.email) {
        const existingByEmail = await this.supplierRepository.findByEmail(input.email);
        if (existingByEmail && existingByEmail.id !== id) {
          throw new BadRequestError(`Another supplier with email '${input.email}' already exists.`);
        }
      }

      const tempSupplierData = { ...supplier, ...input };
      const tempSupplier = this.supplierRepository.create(tempSupplierData);
      if (!tempSupplier.isValid()) {
        throw new BadRequestError(
          `Updated supplier data is invalid. Errors: ${supplierValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Supplier> = {
        ...input,
        updatedByUserId: updatedByUserId,
      };

      if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
        const currentSupplier = await this.supplierRepository.findById(id);
        return this.mapToApiResponse(currentSupplier) as SupplierApiResponse;
      }

      const result = await this.supplierRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Supplier with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedSupplier = await this.supplierRepository.findById(id); // Re-fetch to get populated relations
      if (!updatedSupplier) throw new ServerError('Failed to re-fetch supplier after update.');

      const apiResponse = this.mapToApiResponse(updatedSupplier);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated supplier ${id} to API response.`);
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.EXTERNAL_PARTY,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating supplier ${id}`, error, input },
        'SupplierService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update supplier ${id}.`);
    }
  }

  /**
   * Deletes a supplier by its unique ID.
   * @param id - The ID of the supplier to delete.
   * @returns A promise that resolves when the supplier is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    try {
      const supplier = await this.supplierRepository.findById(id);
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si le fournisseur est utilisé
      // (ex: PurchaseOrders, ProductSuppliers) avant la suppression.
      // const isUsed = await this.supplierRepository.isSupplierInUse(id); // Méthode à implémenter dans le repo
      // if (isUsed) {
      //   throw new BadRequestError(`Supplier '${supplier.name}' is in use and cannot be deleted. Please reassign associated records first.`);
      // }

      await this.supplierRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.EXTERNAL_PARTY,
        id.toString(),
      );
    } catch (error) {
      logger.error({ message: `Error deleting supplier ${id}`, error }, 'SupplierService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting supplier ${id}.`);
    }
  }

  /**
   * Returns a singleton instance of the SupplierService.
   * @returns The singleton instance of SupplierService.
   */
  static getInstance(): SupplierService {
    instance ??= new SupplierService();
    return instance;
  }
}
