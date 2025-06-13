import { AddressRepository } from '../../addresses/data/address.repository';
import { type CreateAddressInput } from '../../addresses/models/address.entity';
import { CustomerRepository } from '../../customers/data/customer.repository';
import { type z } from 'zod';

import {
  type CreateCustomerShippingAddressInput,
  type UpdateCustomerShippingAddressInput,
  type CustomerShippingAddressApiResponse,
  type CustomerShippingAddress,
  createCustomerShippingAddressSchema,
  updateCustomerShippingAddressSchema,
} from '../models/csa.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { appDataSource } from '@/database/data-source';
import { type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';
import { CustomerShippingAddressRepository } from '../data/csa.repository';

let instance: CustomerShippingAddressService | null = null;

export class CustomerShippingAddressService {
  private readonly shippingAddressRepository: CustomerShippingAddressRepository;
  private readonly customerRepository: CustomerRepository;

  /**
   * Creates an instance of CustomerShippingAddressService.
   * @param shippingAddressRepository - The repository for customer shipping addresses.
   * @param addressRepository - The repository for addresses.
   * @param customerRepository - The repository for customers.
   */
  constructor(
    shippingAddressRepository: CustomerShippingAddressRepository = new CustomerShippingAddressRepository(),
    customerRepository: CustomerRepository = new CustomerRepository(),
  ) {
    this.shippingAddressRepository = shippingAddressRepository;
    this.customerRepository = customerRepository;
  }

  /**
   * Maps a CustomerShippingAddress entity to a CustomerShippingAddressApiResponse.
   * @param sa - The CustomerShippingAddress entity.
   * @returns The API response object or null if the input is null.
   */
  mapToApiResponse(sa: CustomerShippingAddress | null): CustomerShippingAddressApiResponse | null {
    if (!sa) return null;
    return sa.toApi();
  }

  /**
   * Finds a customer shipping address by its ID.
   * @param id - The ID of the customer shipping address.
   * @returns A promise that resolves to the customer shipping address API response.
   */
  async findById(id: number): Promise<CustomerShippingAddressApiResponse> {
    try {
      const shippingAddress = await this.shippingAddressRepository.findById(id, {
        relations: ['address'],
      });
      if (!shippingAddress)
        throw new NotFoundError(`Customer shipping address link with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(shippingAddress);
      if (!apiResponse)
        throw new ServerError('Failed to map shipping address link to API response.');
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error finding CSA by id ${id}`, error }, 'CSAService.findById');
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding CSA by id ${id}.`);
    }
  }

  /**
   * Finds all customer shipping addresses based on provided options.
   * @param options - Options for filtering, pagination, and sorting.
   * @returns A promise that resolves to an object containing an array of customer shipping address API responses and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CustomerShippingAddress>;
    sort?: FindManyOptions<CustomerShippingAddress>['order'];
  }): Promise<{ shippingAddresses: CustomerShippingAddressApiResponse[]; total: number }> {
    if (options?.filters?.customerId) {
      const customerId = options.filters.customerId as number;
      const customerExists = await this.customerRepository.findById(customerId);
      if (!customerExists) throw new NotFoundError(`Customer with ID ${customerId} not found.`);
    }
    try {
      const { shippingAddresses, count } = await this.shippingAddressRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { customerId: 'ASC', isDefault: 'DESC', addressLabel: 'ASC' },
        relations: ['address'],
      });
      const apiSAs = shippingAddresses
        .map((sa) => this.mapToApiResponse(sa))
        .filter(Boolean) as CustomerShippingAddressApiResponse[];
      return { shippingAddresses: apiSAs, total: count };
    } catch (error) {
      logger.error({ message: `Error finding all CSAs`, error, options }, 'CSAService.findAll');
      throw new ServerError('Error finding all CSAs.');
    }
  }

  /**
   * Creates a new customer shipping address.
   * @param input - The input data for creating the customer shipping address.
   * @returns A promise that resolves to the created customer shipping address API response.
   */
  async create(
    input: CreateCustomerShippingAddressInput,
  ): Promise<CustomerShippingAddressApiResponse> {
    const validationResult = createCustomerShippingAddressSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid input for shipping address. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    const customer = await this.customerRepository.findById(validatedInput.customerId);
    if (!customer)
      throw new NotFoundError(`Customer with ID ${validatedInput.customerId} not found.`);

    return appDataSource.transaction(async (transactionalEntityManager: EntityManager) => {
      const shippingAddressRepo = new CustomerShippingAddressRepository(transactionalEntityManager);
      const addressRepo = new AddressRepository(transactionalEntityManager);
      const customerRepo = new CustomerRepository(transactionalEntityManager);

      let addressIdToLink = validatedInput.addressId;

      if (validatedInput.newAddress) {
        const newAddressEntity = addressRepo.create(
          validatedInput.newAddress as CreateAddressInput,
        );
        const savedNewAddress = await addressRepo.save(newAddressEntity);
        addressIdToLink = savedNewAddress.id;
      } else if (validatedInput.addressId) {
        const existingAddress = await addressRepo.findById(validatedInput.addressId);
        if (!existingAddress)
          throw new BadRequestError(`Address with ID ${validatedInput.addressId} not found.`);
      } else {
        throw new BadRequestError('Either existing addressId or newAddress data must be provided.');
      }
      if (!addressIdToLink) throw new ServerError('Could not determine address ID to link.');

      const existingByLabel = await shippingAddressRepo.findByCustomerAndLabel(
        validatedInput.customerId,
        validatedInput.addressLabel,
      );
      if (existingByLabel) {
        throw new BadRequestError(
          `Customer already has a shipping address with label '${validatedInput.addressLabel}'.`,
        );
      }
      const existingLink = await shippingAddressRepo.findByCustomerAndAddress(
        validatedInput.customerId,
        addressIdToLink,
      );
      if (existingLink) {
        throw new BadRequestError(
          `This address (ID: ${addressIdToLink}) is already linked for this customer.`,
        );
      }

      const shippingAddressEntity = shippingAddressRepo.create({
        customerId: validatedInput.customerId,
        addressId: addressIdToLink,
        addressLabel: validatedInput.addressLabel,
        isDefault: validatedInput.isDefault || false,
      });

      const savedShippingAddress = await shippingAddressRepo.save(shippingAddressEntity);

      if (savedShippingAddress.isDefault) {
        await shippingAddressRepo.unsetDefaultForOthers(
          validatedInput.customerId,
          savedShippingAddress.id,
        );
        const customerToUpdate = await customerRepo.findOneBy({ id: validatedInput.customerId });
        if (customerToUpdate) {
          customerToUpdate.defaultShippingAddressId = savedShippingAddress.addressId;
          await customerRepo.save(customerToUpdate);
        }
      }
      const populatedSA = await shippingAddressRepo.findById(savedShippingAddress.id, {
        relations: ['address'],
      });
      const apiResponse = this.mapToApiResponse(populatedSA);
      if (!apiResponse)
        throw new ServerError('Failed to map new shipping address to API response.');
      return apiResponse;
    });
  }

  /**
   * Updates an existing customer shipping address.
   * @param id - The ID of the customer shipping address to update.
   * @param input - The input data for updating the customer shipping address.
   * @returns A promise that resolves to the updated customer shipping address API response.
   */
  async update(
    id: number,
    input: UpdateCustomerShippingAddressInput,
  ): Promise<CustomerShippingAddressApiResponse> {
    const validationResult = updateCustomerShippingAddressSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(
        `Invalid input for updating shipping address. Errors: ${errors.join(', ')}`,
      );
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager: EntityManager) => {
      const shippingAddressRepo = new CustomerShippingAddressRepository(transactionalEntityManager);
      const addressRepo = new AddressRepository(transactionalEntityManager);
      const customerRepo = new CustomerRepository(transactionalEntityManager);

      const shippingAddress = await shippingAddressRepo.findById(id, { relations: ['address'] });
      if (!shippingAddress) {
        throw new NotFoundError(`Customer shipping address link with id ${id} not found.`);
      }
      const customerId = shippingAddress.customerId;

      const updatePayload: Partial<CustomerShippingAddress> = {};

      if (validatedInput.addressLabel !== undefined) {
        if (validatedInput.addressLabel !== shippingAddress.addressLabel) {
          const existingByLabel = await shippingAddressRepo.findByCustomerAndLabel(
            customerId,
            validatedInput.addressLabel,
          );
          if (existingByLabel && existingByLabel.id !== id) {
            throw new BadRequestError(
              `Customer already has another shipping address with label '${validatedInput.addressLabel}'.`,
            );
          }
        }
        updatePayload.addressLabel = validatedInput.addressLabel;
      }

      if (
        validatedInput.addressId !== undefined &&
        validatedInput.addressId !== shippingAddress.addressId
      ) {
        const newAddress = await addressRepo.findById(validatedInput.addressId);
        if (!newAddress)
          throw new BadRequestError(`New address with ID ${validatedInput.addressId} not found.`);

        const existingLink = await shippingAddressRepo.findByCustomerAndAddress(
          customerId,
          validatedInput.addressId,
        );
        if (existingLink && existingLink.id !== id) {
          throw new BadRequestError(
            `This new address (ID: ${validatedInput.addressId}) is already linked as another shipping address for this customer.`,
          );
        }
        updatePayload.addressId = validatedInput.addressId;
      }

      let defaultStatusChanged = false;
      if (
        validatedInput.isDefault !== undefined &&
        validatedInput.isDefault !== shippingAddress.isDefault
      ) {
        updatePayload.isDefault = validatedInput.isDefault;
        defaultStatusChanged = true;
      }

      if (Object.keys(updatePayload).length === 0) {
        return this.mapToApiResponse(shippingAddress) as CustomerShippingAddressApiResponse;
      }

      const result = await shippingAddressRepo.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(`Shipping address link with id ${id} not found during update.`);
      }

      const updatedSA = await shippingAddressRepo.findById(id, { relations: ['address'] });
      if (!updatedSA) throw new ServerError('Failed to re-fetch shipping address after update.');

      if (defaultStatusChanged && updatedSA.isDefault === true) {
        await shippingAddressRepo.unsetDefaultForOthers(customerId, id);
        const customerToUpdate = await customerRepo.findOneBy({ id: customerId });
        if (customerToUpdate) {
          customerToUpdate.defaultShippingAddressId = updatedSA.addressId;
          await customerRepo.save(customerToUpdate);
        }
      } else if (defaultStatusChanged && updatedSA.isDefault === false) {
        const customerToUpdate = await customerRepo.findOneBy({ id: customerId });
        if (customerToUpdate && customerToUpdate.defaultShippingAddressId === updatedSA.addressId) {
          customerToUpdate.defaultShippingAddressId = null;
          await customerRepo.save(customerToUpdate);
        }
      }

      const apiResponse = this.mapToApiResponse(updatedSA);
      if (!apiResponse)
        throw new ServerError('Failed to map updated shipping address to API response.');
      return apiResponse;
    });
  }

  /**
   * Deletes a customer shipping address by its ID.
   * @param id - The ID of the customer shipping address to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async delete(id: number): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager: EntityManager) => {
      const shippingAddressRepo = new CustomerShippingAddressRepository(transactionalEntityManager);
      const customerRepo = new CustomerRepository(transactionalEntityManager);

      const shippingAddress = await shippingAddressRepo.findById(id, { relations: ['customer'] });
      if (!shippingAddress) {
        throw new NotFoundError(`Customer shipping address link with id ${id} not found.`);
      }
      const customerId = shippingAddress.customerId;
      const wasDefault = shippingAddress.isDefault;
      const addressIdOfDeleted = shippingAddress.addressId;

      await shippingAddressRepo.softDelete(id);

      if (wasDefault) {
        const customerToUpdate = await customerRepo.findOneBy({ id: customerId });
        if (customerToUpdate && customerToUpdate.defaultShippingAddressId === addressIdOfDeleted) {
          customerToUpdate.defaultShippingAddressId = null;
          const remainingAddresses = await shippingAddressRepo.findByCustomerId(customerId);
          if (remainingAddresses.length > 0) {
            const newDefault =
              remainingAddresses.find((sa) => !sa.deletedAt) ?? remainingAddresses[0];
            if (newDefault) {
              newDefault.isDefault = true;
              await shippingAddressRepo.save(newDefault);
              customerToUpdate.defaultShippingAddressId = newDefault.addressId;
            }
          }
          await customerRepo.save(customerToUpdate);
        }
      }
    });
  }

  /**
   * Sets a customer shipping address as the default for the customer.
   * @param id - The ID of the customer shipping address to set as default.
   * @returns A promise that resolves to the updated customer shipping address API response.
   */
  async setAsDefault(id: number): Promise<CustomerShippingAddressApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager: EntityManager) => {
      const shippingAddressRepo = new CustomerShippingAddressRepository(transactionalEntityManager);
      const customerRepo = new CustomerRepository(transactionalEntityManager);

      const shippingAddressToSetDefault = await shippingAddressRepo.findById(id, {
        relations: ['customer'],
      });
      if (!shippingAddressToSetDefault) {
        throw new NotFoundError(`Customer shipping address link with id ${id} not found.`);
      }
      const customerId = shippingAddressToSetDefault.customerId;

      if (shippingAddressToSetDefault.isDefault) {
        const populatedSA = await shippingAddressRepo.findById(id, { relations: ['address'] });
        return this.mapToApiResponse(populatedSA) as CustomerShippingAddressApiResponse;
      }

      await shippingAddressRepo.unsetDefaultForOthers(customerId, id);

      shippingAddressToSetDefault.isDefault = true;
      await shippingAddressRepo.save(shippingAddressToSetDefault);

      const customerToUpdate = await customerRepo.findOneBy({ id: customerId });
      if (customerToUpdate) {
        customerToUpdate.defaultShippingAddressId = shippingAddressToSetDefault.addressId;
        await customerRepo.save(customerToUpdate);
      }

      const populatedSAWithAddress = await shippingAddressRepo.findById(id, {
        relations: ['address'],
      });
      const apiResponse = this.mapToApiResponse(populatedSAWithAddress);
      if (!apiResponse) throw new ServerError('Failed to map new default shipping address.');
      return apiResponse;
    });
  }

  /**
   * Returns the singleton instance of CustomerShippingAddressService.
   * @returns The singleton instance.
   */
  static getInstance(): CustomerShippingAddressService {
    instance ??= new CustomerShippingAddressService();
    return instance;
  }
}
