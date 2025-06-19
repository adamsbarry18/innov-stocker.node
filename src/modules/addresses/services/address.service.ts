import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import logger from '@/lib/logger';
import {
  AddressRepository,
  type AddressApiResponse,
  type Address,
  type CreateAddressInput,
  addressValidationInputErrors,
  type UpdateAddressInput,
} from '@/modules/addresses';
import { UserActivityLogService, ActionType, EntityType } from '@/modules/user-activity-logs';
let instance: AddressService | null = null;

export class AddressService {
  private readonly addressRepository: AddressRepository;

  constructor(addressRepository: AddressRepository = new AddressRepository()) {
    this.addressRepository = addressRepository;
  }

  /**
   * Maps an Address entity to an AddressApiResponse.
   * @param address The Address entity to map.
   * @returns The mapped AddressApiResponse, or null if the input is null.
   */
  mapToApiResponse(address: Address | null): AddressApiResponse | null {
    if (!address) return null;
    return address.toApi();
  }

  /**
   * Finds an address by its ID.
   * @param id The ID of the address to find.
   * @returns The AddressApiResponse for the found address.
   */
  async findById(id: number): Promise<AddressApiResponse> {
    try {
      const address = await this.addressRepository.findById(id);
      if (!address) throw new NotFoundError(`Address with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(address);
      if (!apiResponse) {
        throw new ServerError(`Failed to map found address with id ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error finding address with id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding address with id ${id}.`);
    }
  }

  /**
   * Finds all addresses based on provided options.
   * @param options Options for filtering, pagination, and sorting.
   * @returns An object containing an array of AddressApiResponse and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Address>;
    sort?: FindManyOptions<Address>['order'];
  }): Promise<{ addresses: AddressApiResponse[]; total: number }> {
    try {
      const { addresses, count } = await this.addressRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort,
      });
      const apiAddresses = addresses
        .map((addr) => this.mapToApiResponse(addr))
        .filter(Boolean) as AddressApiResponse[];
      return { addresses: apiAddresses, total: count };
    } catch (error) {
      logger.error(`Error finding all addresses: ${error}`);
      throw new ServerError('Error finding all addresses.');
    }
  }

  /**
   * Creates a new address.
   * @param input The data for creating the address.
   * @returns The AddressApiResponse for the newly created address.
   */
  async create(input: CreateAddressInput): Promise<AddressApiResponse> {
    const addressEntity = this.addressRepository.create({
      ...input,
    });

    if (!addressEntity.isValid()) {
      throw new BadRequestError(
        `Address data is invalid. Errors: ${addressValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedAddress = await this.addressRepository.save(addressEntity);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.SYSTEM_CONFIGURATION,
        savedAddress.id.toString(),
        { addressId: savedAddress.id, street: savedAddress.streetLine1, city: savedAddress.city },
      );

      const apiResponse = this.mapToApiResponse(savedAddress);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created address ${savedAddress.id} to API response.`,
        );
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error creating address: ${error}`);
      throw new ServerError('Failed to create address.');
    }
  }

  /**
   * Updates an existing address.
   * @param id The ID of the address to update.
   * @param input The data for updating the address.
   * @returns The AddressApiResponse for the updated address.
   */
  async update(id: number, input: UpdateAddressInput): Promise<AddressApiResponse> {
    try {
      const address = await this.addressRepository.findById(id);
      if (!address) throw new NotFoundError(`Address with id ${id} not found.`);

      const tempAddress = this.addressRepository.create({ ...address, ...input });
      if (!tempAddress.isValid()) {
        throw new BadRequestError(
          `Updated address data is invalid. Errors: ${addressValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Address> = {
        ...input,
      };

      const result = await this.addressRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Address with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedAddress = await this.addressRepository.findById(id);
      if (!updatedAddress) throw new ServerError('Failed to re-fetch address after update.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SYSTEM_CONFIGURATION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      const apiResponse = this.mapToApiResponse(updatedAddress);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated address ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error updating address ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update address ${id}.`);
    }
  }

  /**
   * Deletes an address by its ID.
   * @param id The ID of the address to delete.
   */
  async delete(id: number): Promise<void> {
    try {
      const address = await this.addressRepository.findById(id);
      if (!address) throw new NotFoundError(`Address with id ${id} not found.`);

      const isUsed = await this.addressRepository.isAddressInUse(id);
      if (isUsed) {
        throw new BadRequestError(
          `Address with ID ${id} is currently in use by other entities and cannot be deleted.`,
        );
      }

      await this.addressRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.SYSTEM_CONFIGURATION,
        id.toString(),
      );
    } catch (error) {
      logger.error(`Error deleting address ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting address ${id}.`);
    }
  }

  /**
   * Returns the singleton instance of AddressService.
   * @returns The AddressService instance.
   */
  static getInstance(): AddressService {
    instance ??= new AddressService();
    return instance;
  }
}
