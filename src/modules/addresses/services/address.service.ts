import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import { AddressRepository } from '../data/address.repository';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import logger from '@/lib/logger';
import {
  type AddressApiResponse,
  type Address,
  type CreateAddressInput,
  addressValidationInputErrors,
  type UpdateAddressInput,
} from '../models/address.entity';

let instance: AddressService | null = null;

export class AddressService {
  private readonly addressRepository: AddressRepository;

  constructor(addressRepository: AddressRepository = new AddressRepository()) {
    this.addressRepository = addressRepository;
  }

  mapToApiResponse(address: Address | null): AddressApiResponse | null {
    if (!address) return null;
    return address.toApi();
  }

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
      logger.info(`Address ${savedAddress.id} created successfully.`);

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

      logger.info(`Address ${id} updated successfully.`);
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

  async delete(id: number): Promise<void> {
    try {
      const address = await this.addressRepository.findById(id);
      if (!address) throw new NotFoundError(`Address with id ${id} not found.`);

      // Ici, vous pourriez vouloir vérifier si l'adresse est utilisée par d'autres entités
      // avant de permettre la suppression, selon les règles métier.
      // Par exemple:
      // const isUsed = await this.companyRepository.exists({ where: { addressId: id }});
      // if (isUsed) throw new BadRequestError('Address is in use and cannot be deleted.');

      await this.addressRepository.softDelete(id);
      // Optionnellement, logguer qui a fait la suppression
      // await this.auditLogService.logAction(deletedByUserId, 'delete', 'address', id);
      logger.info(`Address ${id} successfully soft-deleted.`);
    } catch (error) {
      logger.error(`Error deleting address ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting address ${id}.`);
    }
  }

  static getInstance(): AddressService {
    if (!instance) {
      instance = new AddressService();
    }
    return instance;
  }
}
