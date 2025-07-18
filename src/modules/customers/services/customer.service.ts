import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { CustomerRepository, Customer } from '../index';
import { AddressRepository } from '@/modules/addresses';
import { CurrencyRepository } from '@/modules/currencies';

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerApiResponse,
} from '../models/customer.entity';
import { customerValidationInputErrors } from '../models/customer.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { appDataSource } from '@/database/data-source';
import { CustomerGroupRepository } from '@/modules/customer-groups';
import { type CreateAddressInput } from '@/modules/addresses/models/address.entity';
import { UserActivityLogService, ActionType, EntityType } from '@/modules/user-activity-logs';
import { CustomerShippingAddress } from '@/modules/customer-shipping-address';

let instance: CustomerService | null = null;

export class CustomerService {
  private readonly customerRepository: CustomerRepository;
  private readonly addressRepository: AddressRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly customerGroupRepository: CustomerGroupRepository;

  constructor(
    customerRepository: CustomerRepository = new CustomerRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    customerGroupRepository: CustomerGroupRepository = new CustomerGroupRepository(),
  ) {
    this.customerRepository = customerRepository;
    this.addressRepository = addressRepository;
    this.currencyRepository = currencyRepository;
    this.customerGroupRepository = customerGroupRepository;
  }

  /**
   * Maps a Customer entity to a CustomerApiResponse.
   * @param customer The customer entity to map.
   * @returns The API response representation of the customer, or null if the input is null.
   */
  mapToApiResponse(customer: Customer | null): CustomerApiResponse | null {
    if (!customer) return null;
    return customer.toApi();
  }

  /**
   * Finds a customer by their ID.
   * @param id The ID of the customer to find.
   * @returns A promise that resolves to the customer API response.
   */
  async findById(id: number): Promise<CustomerApiResponse> {
    try {
      const customer = await this.customerRepository.findById(id);
      if (!customer) throw new NotFoundError(`Customer with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(customer);
      if (!apiResponse) throw new ServerError(`Failed to map customer ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding customer by id ${id}`, error },
        'CustomerService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding customer by id ${id}.`);
    }
  }

  /**
   * Retrieves all customers based on provided options.
   * @param options Options for filtering, pagination, and sorting.
   * @returns A promise that resolves to an object containing an array of customer API responses and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Customer>;
    sort?: FindManyOptions<Customer>['order'];
  }): Promise<{ customers: CustomerApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};

      const { customers, count } = await this.customerRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { companyName: 'ASC', lastName: 'ASC' },
      });
      const apiCustomers = customers
        .map((c) => this.mapToApiResponse(c))
        .filter(Boolean) as CustomerApiResponse[];
      return { customers: apiCustomers, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all customers`, error, options },
        'CustomerService.findAll',
      );
      throw new ServerError('Error finding all customers.');
    }
  }

  /**
   * Creates a new customer.
   * @param input The input data for creating the customer.
   * @param createdByUserId The ID of the user who created the customer.
   * @returns A promise that resolves to the created customer API response.
   */
  async create(input: CreateCustomerInput, createdByUserId: number): Promise<CustomerApiResponse> {
    const currency = await this.currencyRepository.findById(input.defaultCurrencyId);
    if (!currency)
      throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    if (input.customerGroupId) {
      const group = await this.customerGroupRepository.findById(input.customerGroupId);
      if (!group)
        throw new BadRequestError(`Customer group with ID ${input.customerGroupId} not found.`);
    }

    if (input.email) {
      const existingByEmail = await this.customerRepository.findByEmail(input.email);
      if (existingByEmail) {
        throw new BadRequestError(`Customer with email '${input.email}' already exists.`);
      }
    }

    const billingAddressId = await this._resolveAddressId(
      input.newBillingAddress,
      input.billingAddressId,
      'Billing Address',
      this.addressRepository,
    );

    let defaultShippingAddressId: number | null = null;
    if (input.newDefaultShippingAddress || input.defaultShippingAddressId) {
      defaultShippingAddressId = await this._resolveAddressId(
        input.newDefaultShippingAddress,
        input.defaultShippingAddressId,
        'Default Shipping Address',
        this.addressRepository,
      );
    }

    const customerEntity = this.customerRepository.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.companyName,
      phoneNumber: input.phoneNumber,
      vatNumber: input.vatNumber,
      siretNumber: input.siretNumber,
      defaultCurrencyId: input.defaultCurrencyId,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays,
      creditLimit: input.creditLimit,
      customerGroupId: input.customerGroupId,
      billingAddressId: billingAddressId,
      defaultShippingAddressId: defaultShippingAddressId ?? null,
      notes: input.notes,
      createdByUserId: createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!customerEntity.isValid()) {
      throw new BadRequestError(
        `Customer data is invalid. Errors: ${customerValidationInputErrors.join(', ')}`,
      );
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const shippingAddressRepo = transactionalEntityManager.getRepository(CustomerShippingAddress);
      const transactionalAddressRepo = new AddressRepository(transactionalEntityManager);

      const savedCustomer = await this.customerRepository.save(customerEntity);

      if (input.shippingAddresses && input.shippingAddresses.length > 0) {
        for (const saInput of input.shippingAddresses) {
          const addressIdToLink = await this._resolveAddressId(
            saInput.newAddress,
            saInput.addressId,
            `Shipping Address with label '${saInput.addressLabel}'`,
            transactionalAddressRepo,
          );

          const newShippingAddress = shippingAddressRepo.create({
            customerId: savedCustomer.id,
            addressId: addressIdToLink,
            addressLabel: saInput.addressLabel,
            isDefault: saInput.isDefault ?? false,
          });
          await shippingAddressRepo.save(newShippingAddress);
          if (newShippingAddress.isDefault) {
            savedCustomer.defaultShippingAddressId = newShippingAddress.addressId;
            await customerRepo.save(savedCustomer);
          }
        }
      }

      const fullCustomer = await this.customerRepository.findById(savedCustomer.id);
      const apiResponse = this.mapToApiResponse(fullCustomer);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created customer ${savedCustomer.id} to API response.`,
        );
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.EXTERNAL_PARTY,
        savedCustomer.id.toString(),
        { customerName: savedCustomer.getDisplayName() },
      );

      return apiResponse;
    });
  }

  /**
   * Updates an existing customer.
   * @param id The ID of the customer to update.
   * @param input The input data for updating the customer.
   * @param updatedByUserId The ID of the user who updated the customer.
   * @returns A promise that resolves to the updated customer API response.
   */
  async update(
    id: number,
    input: UpdateCustomerInput,
    updatedByUserId: number,
  ): Promise<CustomerApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);

      const customer = await this.customerRepository.findById(id);
      if (!customer) throw new NotFoundError(`Customer with id ${id} not found.`);
      if (input.defaultCurrencyId && input.defaultCurrencyId !== customer.defaultCurrencyId) {
        const currency = await this.currencyRepository.findById(input.defaultCurrencyId);
        if (!currency)
          throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);
      }
      if (input.customerGroupId && input.customerGroupId !== customer.customerGroupId) {
        if (input.customerGroupId !== null) {
          const group = await this.customerGroupRepository.findById(input.customerGroupId);
          if (!group)
            throw new BadRequestError(`Customer group with ID ${input.customerGroupId} not found.`);
        }
      }
      if (input.billingAddressId && input.billingAddressId !== customer.billingAddressId) {
        const address = await this.addressRepository.findById(input.billingAddressId);
        if (!address)
          throw new BadRequestError(`Billing Address with ID ${input.billingAddressId} not found.`);
      }
      if (input.hasOwnProperty('defaultShippingAddressId')) {
        if (input.defaultShippingAddressId !== null) {
          if (
            input.defaultShippingAddressId &&
            input.defaultShippingAddressId !== customer.defaultShippingAddressId
          ) {
            const address = await this.addressRepository.findById(input.defaultShippingAddressId);
            if (!address)
              throw new BadRequestError(
                `Default Shipping Address with ID ${input.defaultShippingAddressId} not found.`,
              );
          }
        }
      }

      if (input.email && input.email !== customer.email) {
        const existingByEmail = await this.customerRepository.findByEmail(input.email);
        if (existingByEmail && existingByEmail.id !== id) {
          throw new BadRequestError(`Another customer with email '${input.email}' already exists.`);
        }
      }

      const tempCustomerData = { ...customer, ...input };
      const tempCustomer = customerRepo.create(tempCustomerData);
      if (!tempCustomer.isValid()) {
        throw new BadRequestError(
          `Updated customer data is invalid. Errors: ${customerValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Customer> = {
        ...input,
        updatedByUserId: updatedByUserId,
      };
      if (
        input.hasOwnProperty('defaultShippingAddressId') &&
        input.defaultShippingAddressId === null
      ) {
        updatePayload.defaultShippingAddressId = null;
      }

      if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
        return this.mapToApiResponse(customer) as CustomerApiResponse;
      }

      const result = await this.customerRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Customer with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedCustomer = await this.customerRepository.findById(id);
      if (!updatedCustomer) throw new ServerError('Failed to re-fetch customer after update.');
      const apiResponse = this.mapToApiResponse(updatedCustomer);
      if (!apiResponse)
        throw new ServerError(`Failed to map updated customer ${id} to API response.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.EXTERNAL_PARTY,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    });
  }

  async delete(id: number): Promise<void> {
    try {
      const customer = await this.customerRepository.findById(id);
      if (!customer) throw new NotFoundError(`Customer with id ${id} not found.`);

      const isUsed = await this.customerRepository.isCustomerInUse(id);
      if (isUsed) {
        throw new BadRequestError(
          `Customer '${customer.getDisplayName()}' has associated orders/invoices and cannot be deleted.`,
        );
      }

      await this.customerRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.EXTERNAL_PARTY,
        id.toString(),
      );
    } catch (error) {
      logger.error({ message: `Error deleting customer ${id}`, error }, 'CustomerService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting customer ${id}.`);
    }
  }

  /**
   * Helper method to resolve an address ID, either by creating a new address
   * or validating an existing one using the provided AddressRepository.
   * This method ensures that the AddressRepository's `save` and `findById` methods are used.
   * @param addressInput Input for creating a new address.
   * @param addressId ID of an existing address.
   * @param addressType A descriptive string for the address (e.g., 'Billing Address').
   * @param addressRepo The AddressRepository instance to use.
   * @returns The resolved address ID.
   * @throws BadRequestError if address information is invalid or not found.
   */
  private async _resolveAddressId(
    addressInput: CreateAddressInput | undefined,
    addressId: number | null | undefined,
    addressType: string,
    addressRepo: AddressRepository,
  ): Promise<number> {
    if (addressInput && (addressId === undefined || addressId === null)) {
      const createdAddress = await addressRepo.save(addressRepo.create(addressInput));
      return createdAddress.id;
    } else if (addressId !== undefined && addressId !== null) {
      const address = await addressRepo.findById(addressId);
      if (!address) {
        throw new BadRequestError(`${addressType} with ID ${addressId} not found.`);
      }
      return addressId;
    } else {
      throw new BadRequestError(`${addressType} information (ID or new address data) is required.`);
    }
  }

  static getInstance(): CustomerService {
    instance ??= new CustomerService();

    return instance;
  }
}
