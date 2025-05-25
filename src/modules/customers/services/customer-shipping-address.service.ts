import { IsNull } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { CustomerRepository } from '../data/customer.repository';
import { CustomerShippingAddressRepository } from '../data/customer-shipping-address.repository';
import { AddressRepository } from '@/modules/addresses/data/address.repository';
import {
  type CreateCustomerShippingAddressInput,
  type CustomerShippingAddressApiResponse,
  type UpdateCustomerShippingAddressInput,
  CustomerShippingAddress,
} from '../models/customer-shipping-addresses.entity';
import { Address } from '@/modules/addresses/models/address.entity';
import { Customer } from '../models/customer.entity'; // Import Customer entity for transactional repo

export class CustomerShippingAddressService {
  private readonly customerRepository: CustomerRepository;
  private readonly customerShippingAddressRepository: CustomerShippingAddressRepository;
  private readonly addressRepository: AddressRepository;

  constructor(
    customerRepository: CustomerRepository = new CustomerRepository(),
    customerShippingAddressRepository: CustomerShippingAddressRepository = new CustomerShippingAddressRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
  ) {
    this.customerRepository = customerRepository;
    this.customerShippingAddressRepository = customerShippingAddressRepository;
    this.addressRepository = addressRepository;
  }

  async getCustomerShippingAddresses(
    customerId: number,
  ): Promise<CustomerShippingAddressApiResponse[]> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);

    const shippingAddresses =
      await this.customerShippingAddressRepository.findByCustomerId(customerId);
    return shippingAddresses.map((sa) => sa.toApi());
  }

  async addShippingAddress(
    customerId: number,
    input: CreateCustomerShippingAddressInput,
    addedByUserId: number,
  ): Promise<CustomerShippingAddressApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const shippingAddressRepo = transactionalEntityManager.getRepository(CustomerShippingAddress);
      const addressRepo = transactionalEntityManager.getRepository(Address);

      const customer = await customerRepo.findOne({
        where: { id: customerId, deletedAt: IsNull() },
      }); // Use transactional repo
      if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);

      let addressIdToLink = input.addressId;
      if (input.newAddress && !input.addressId) {
        const newAddrEntity = addressRepo.create(input.newAddress);
        // TODO: Valider newAddrEntity ici si Address a une méthode isValid()
        const savedAddr = await addressRepo.save(newAddrEntity);
        addressIdToLink = savedAddr.id;
      } else if (!input.addressId && !input.newAddress) {
        throw new BadRequestError(
          'Either addressId or newAddress must be provided for shipping address.',
        );
      } else if (input.addressId) {
        const existingAddr = await addressRepo.findOneBy({ id: input.addressId });
        if (!existingAddr)
          throw new BadRequestError(`Address with ID ${input.addressId} not found.`);
      }
      if (!addressIdToLink)
        throw new ServerError('Could not determine addressId for shipping address.');

      const newShippingAddressEntity = shippingAddressRepo.create({
        customerId,
        addressId: addressIdToLink,
        addressLabel: input.addressLabel,
        isDefault: input.isDefault || false,
      });

      if (!newShippingAddressEntity.isValid()) {
        // Assuming isValid on CustomerShippingAddress
        throw new BadRequestError(`Shipping address data is invalid.`);
      }

      const savedShippingAddress = await shippingAddressRepo.save(newShippingAddressEntity);

      if (savedShippingAddress.isDefault) {
        // Unset other shipping addresses for this customer as default
        if (savedShippingAddress.id) {
          await this.customerShippingAddressRepository.unsetOtherDefaults(
            customerId,
            savedShippingAddress.id,
          );
        } else {
          const otherAddresses =
            await this.customerShippingAddressRepository.findByCustomerId(customerId);
          for (const addr of otherAddresses) {
            if (addr.id !== savedShippingAddress.id && addr.isDefault) {
              addr.isDefault = false;
              await shippingAddressRepo.save(addr);
            }
          }
        }

        // Update the customer's default shipping address ID using the transactional repo
        customer.defaultShippingAddressId = savedShippingAddress.addressId;
        customer.defaultShippingAddress = await addressRepo.findOneBy({
          id: savedShippingAddress.addressId,
        });
        await customerRepo.save(customer);
      }

      const populatedSA = await shippingAddressRepo.findOne({
        where: { id: savedShippingAddress.id },
        relations: ['address'],
      });
      const apiResponse = populatedSA ? populatedSA.toApi() : null;
      if (!apiResponse)
        throw new ServerError('Failed to map new shipping address to API response.');
      return apiResponse;
    });
  }

  async updateShippingAddress(
    customerId: number,
    customerShippingAddressId: number,
    input: UpdateCustomerShippingAddressInput,
    updatedByUserId: number,
  ): Promise<CustomerShippingAddressApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const shippingAddressRepo = transactionalEntityManager.getRepository(CustomerShippingAddress);
      const addressRepo = transactionalEntityManager.getRepository(Address);

      const customer = await customerRepo.findOne({
        where: { id: customerId, deletedAt: IsNull() },
      }); // Use transactional repo
      if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);

      const shippingAddress = await shippingAddressRepo.findOne({
        where: { id: customerShippingAddressId, customerId, deletedAt: IsNull() },
      });
      if (!shippingAddress)
        throw new NotFoundError(
          `Shipping address with ID ${customerShippingAddressId} for customer ${customerId} not found.`,
        );

      const updatePayload: Partial<CustomerShippingAddress> = {};
      if (input.addressLabel !== undefined) updatePayload.addressLabel = input.addressLabel;
      if (input.addressId !== undefined && input.addressId !== shippingAddress.addressId) {
        const newAddr = await addressRepo.findOneBy({ id: input.addressId });
        if (!newAddr)
          throw new BadRequestError(`New address with ID ${input.addressId} not found.`);
        updatePayload.addressId = input.addressId;
      }
      if (input.isDefault !== undefined) updatePayload.isDefault = input.isDefault;

      Object.assign(shippingAddress, updatePayload);
      if (!shippingAddress.isValid()) {
        throw new BadRequestError(`Shipping address data is invalid.`);
      }

      await shippingAddressRepo.save(shippingAddress); // Save the merged entity

      if (shippingAddress.isDefault) {
        // Unset other shipping addresses for this customer as default
        if (shippingAddress.id) {
          await this.customerShippingAddressRepository.unsetOtherDefaults(
            customerId,
            shippingAddress.id,
          );
        } else {
          const otherAddresses =
            await this.customerShippingAddressRepository.findByCustomerId(customerId);
          for (const addr of otherAddresses) {
            if (addr.id !== shippingAddress.id && addr.isDefault) {
              addr.isDefault = false;
              await shippingAddressRepo.save(addr);
            }
          }
        }

        // Update the customer's default shipping address ID using the transactional repo
        customer.defaultShippingAddressId = shippingAddress.addressId;
        customer.defaultShippingAddress = await addressRepo.findOneBy({
          id: shippingAddress.addressId,
        });
        await customerRepo.save(customer);
      } else {
        // If this was the default and is now not, clear it from customer if it matches
        if (customer.defaultShippingAddressId === shippingAddress.addressId) {
          customer.defaultShippingAddressId = null;
          customer.defaultShippingAddress = null;
          await customerRepo.save(customer);
        }
      }

      const populatedSA = await shippingAddressRepo.findOne({
        where: { id: customerShippingAddressId },
        relations: ['address'],
      });
      const apiResponse = populatedSA ? populatedSA.toApi() : null;
      if (!apiResponse)
        throw new ServerError('Failed to map updated shipping address to API response.');
      return apiResponse;
    });
  }

  async removeShippingAddress(
    customerId: number,
    customerShippingAddressId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const shippingAddressRepo = transactionalEntityManager.getRepository(CustomerShippingAddress);

      const customer = await customerRepo.findOne({
        where: { id: customerId, deletedAt: IsNull() },
      }); // Use transactional repo
      if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);

      const shippingAddress = await shippingAddressRepo.findOne({
        where: { id: customerShippingAddressId, customerId, deletedAt: IsNull() },
      });
      if (!shippingAddress)
        throw new NotFoundError(
          `Shipping address with ID ${customerShippingAddressId} for customer ${customerId} not found.`,
        );

      const wasDefault = shippingAddress.isDefault;
      const addressIdOfDeleted = shippingAddress.addressId;

      await shippingAddressRepo.softDelete(customerShippingAddressId); // Soft delete

      if (wasDefault && customer.defaultShippingAddressId === addressIdOfDeleted) {
        customer.defaultShippingAddressId = null;
        customer.defaultShippingAddress = null;
        // Try to set another shipping address as default, if any remain
        const remainingAddresses = await shippingAddressRepo.find({
          where: { customerId, deletedAt: IsNull() },
          order: { createdAt: 'ASC' },
        });
        if (remainingAddresses.length > 0) {
          remainingAddresses[0].isDefault = true;
          await shippingAddressRepo.save(remainingAddresses[0]);
          customer.defaultShippingAddressId = remainingAddresses[0].addressId;
          // Re-fetch the address entity if needed for the customer object
          customer.defaultShippingAddress = await transactionalEntityManager
            .getRepository(Address)
            .findOneBy({
              id: remainingAddresses[0].addressId,
            });
        }
        await customerRepo.save(customer);
      }
      logger.info(
        `Customer shipping address ${customerShippingAddressId} for customer ${customerId} soft-deleted.`,
      );
    });
  }

  async setDefaultShippingAddress(
    customerId: number,
    customerShippingAddressId: number,
    setByUserId: number,
  ): Promise<CustomerShippingAddressApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const shippingAddressRepo = transactionalEntityManager.getRepository(CustomerShippingAddress);
      const addressRepo = transactionalEntityManager.getRepository(Address);

      const customer = await customerRepo.findOne({
        where: { id: customerId, deletedAt: IsNull() },
      }); // Use transactional repo
      if (!customer) throw new NotFoundError(`Customer with ID ${customerId} not found.`);

      const shippingAddressToSetDefault = await shippingAddressRepo.findOne({
        where: { id: customerShippingAddressId, customerId, deletedAt: IsNull() },
      });
      if (!shippingAddressToSetDefault)
        throw new NotFoundError(
          `Shipping address with ID ${customerShippingAddressId} for customer ${customerId} not found.`,
        );

      if (shippingAddressToSetDefault.isDefault) {
        // Already default
        const populatedSA = await shippingAddressRepo.findOne({
          where: { id: customerShippingAddressId },
          relations: ['address'],
        });
        const apiResponse = populatedSA ? populatedSA.toApi() : null;
        if (!apiResponse) throw new ServerError('Failed to map shipping address to API response.');
        return apiResponse;
      }

      // Unset current default if any, excluding the one being set as default
      if (shippingAddressToSetDefault.id) {
        await this.customerShippingAddressRepository.unsetOtherDefaults(
          customerId,
          shippingAddressToSetDefault.id,
        );
      } else {
        const currentDefaults =
          await this.customerShippingAddressRepository.findByCustomerId(customerId);
        for (const addr of currentDefaults) {
          if (addr.id !== shippingAddressToSetDefault.id && addr.isDefault) {
            addr.isDefault = false;
            await shippingAddressRepo.save(addr);
          }
        }
      }

      shippingAddressToSetDefault.isDefault = true;
      await shippingAddressRepo.save(shippingAddressToSetDefault);

      // Update the customer's default shipping address ID using the transactional repo
      customer.defaultShippingAddressId = shippingAddressToSetDefault.addressId;
      customer.defaultShippingAddress = await addressRepo.findOneBy({
        id: shippingAddressToSetDefault.addressId,
      });
      await customerRepo.save(customer);

      const populatedSA = await shippingAddressRepo.findOne({
        where: { id: customerShippingAddressId },
        relations: ['address'],
      });
      const apiResponse = populatedSA ? populatedSA.toApi() : null;
      if (!apiResponse)
        throw new ServerError(
          'Failed to map shipping address to API response after setting default.',
        );
      return apiResponse;
    });
  }
}
