import { type FindManyOptions, type FindOptionsWhere, IsNull } from 'typeorm';
import { CustomerRepository } from '../data/customer.repository';
import { CustomerShippingAddressService } from './customer-shipping-address.service';
import { AddressRepository } from '../../addresses/data/address.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
// TODO: Importer les repositories nécessaires pour la vérification des dépendances à la suppression.
// import { SalesOrderRepository } from '../../sales_orders/data/sales_order.repository';

import {
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerApiResponse,
  Customer,
  customerValidationInputErrors,
} from '../models/customer.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { appDataSource } from '@/database/data-source';
import { CustomerGroupRepository } from '@/modules/customer-groups/data/customer-group.repository';
import { Address } from '@/modules/addresses/models/address.entity';
import { CustomerShippingAddress } from '../models/customer-shipping-addresses.entity';

let instance: CustomerService | null = null;

export class CustomerService {
  private readonly customerRepository: CustomerRepository;
  private readonly addressRepository: AddressRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly customerGroupRepository: CustomerGroupRepository;
  private readonly customerShippingAddressService: CustomerShippingAddressService;
  // TODO: private readonly salesOrderRepository: SalesOrderRepository;

  constructor(
    customerRepository: CustomerRepository = new CustomerRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    customerGroupRepository: CustomerGroupRepository = new CustomerGroupRepository(),
    customerShippingAddressService: CustomerShippingAddressService = new CustomerShippingAddressService(),
    // salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
  ) {
    this.customerRepository = customerRepository;
    this.addressRepository = addressRepository;
    this.currencyRepository = currencyRepository;
    this.customerGroupRepository = customerGroupRepository;
    this.customerShippingAddressService = customerShippingAddressService;
    // TODO: this.salesOrderRepository = salesOrderRepository;
  }

  mapToApiResponse(customer: Customer | null): CustomerApiResponse | null {
    if (!customer) return null;
    return customer.toApi();
  }

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

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Customer>;
    sort?: FindManyOptions<Customer>['order'];
    searchTerm?: string;
  }): Promise<{ customers: CustomerApiResponse[]; total: number }> {
    try {
      let whereClause = options?.filters ? { ...options.filters } : {};
      if (options?.searchTerm) {
        // TODO: Améliorer la recherche pour TypeORM (ex: QueryBuilder avec OR sur plusieurs champs)
        // Ceci est une recherche simple, insensible à la casse sur le nom/email/companyName
        // whereClause = [
        //     { ...whereClause, firstName: ILike(`%${options.searchTerm}%`) },
        //     { ...whereClause, lastName: ILike(`%${options.searchTerm}%`) },
        //     { ...whereClause, companyName: ILike(`%${options.searchTerm}%`) },
        //     { ...whereClause, email: ILike(`%${options.searchTerm}%`) },
        // ];
        logger.warn(
          'Search term functionality for customers is basic. Consider full-text search for production.',
        );
      }

      const { customers, count } = await this.customerRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { companyName: 'ASC', lastName: 'ASC' },
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

  async create(input: CreateCustomerInput, createdByUserId: number): Promise<CustomerApiResponse> {
    // TODO: Dépendance - Valider l'existence de input.defaultCurrencyId
    const currency = await this.currencyRepository.findById(input.defaultCurrencyId);
    if (!currency)
      throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    // TODO: Dépendance - Valider l'existence de input.customerGroupId si fourni
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

    // Gestion de la création d'adresses "à la volée"
    let billingAddressId = input.billingAddressId;
    if (input.newBillingAddress && !input.billingAddressId) {
      const createdBillingAddress = await this.addressRepository.save(
        this.addressRepository.create(input.newBillingAddress),
      );
      billingAddressId = createdBillingAddress.id;
    } else if (!input.billingAddressId && !input.newBillingAddress) {
      throw new BadRequestError(
        'Billing address information (billingAddressId or newBillingAddress) is required.',
      );
    } else if (input.billingAddressId) {
      // TODO: Dépendance - Valider l'existence de input.billingAddressId
      const address = await this.addressRepository.findById(input.billingAddressId);
      if (!address)
        throw new BadRequestError(`Billing Address with ID ${input.billingAddressId} not found.`);
    }

    let defaultShippingAddressId = input.defaultShippingAddressId;
    if (input.newDefaultShippingAddress && !input.defaultShippingAddressId) {
      const createdShippingAddress = await this.addressRepository.save(
        this.addressRepository.create(input.newDefaultShippingAddress),
      );
      defaultShippingAddressId = createdShippingAddress.id;
    } else if (input.defaultShippingAddressId) {
      // TODO: Dépendance - Valider l'existence de input.defaultShippingAddressId
      const address = await this.addressRepository.findById(input.defaultShippingAddressId);
      if (!address)
        throw new BadRequestError(
          `Default Shipping Address with ID ${input.defaultShippingAddressId} not found.`,
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
      billingAddressId: billingAddressId, // Utiliser l'ID résolu
      defaultShippingAddressId: defaultShippingAddressId || null, // Utiliser l'ID résolu
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
      const addressRepo = transactionalEntityManager.getRepository(Address);

      const savedCustomer = await this.customerRepository.save(customerEntity);

      if (input.shippingAddresses && input.shippingAddresses.length > 0) {
        for (const saInput of input.shippingAddresses) {
          let addressIdToLink = saInput.addressId;
          if (saInput.newAddress && !saInput.addressId) {
            const newAddr = await addressRepo.save(addressRepo.create(saInput.newAddress));
            addressIdToLink = newAddr.id;
          } else if (!saInput.addressId && !saInput.newAddress) {
            throw new BadRequestError(
              'Shipping address information (addressId or newAddress) is required for each entry.',
            );
          } else if (saInput.addressId) {
            const addr = await addressRepo.findOneBy({ id: saInput.addressId });
            if (!addr)
              throw new BadRequestError(`Shipping address with ID ${saInput.addressId} not found.`);
          }

          const newShippingAddress = shippingAddressRepo.create({
            customerId: savedCustomer.id,
            addressId: addressIdToLink,
            addressLabel: saInput.addressLabel,
            isDefault: saInput.isDefault || false,
          });
          await shippingAddressRepo.save(newShippingAddress);
          // Si c'est l'adresse par défaut, mettre à jour le client principal
          if (newShippingAddress.isDefault) {
            savedCustomer.defaultShippingAddressId = newShippingAddress.addressId;
            // Mettre à jour aussi l'entité defaultShippingAddress si elle est chargée
            if (newShippingAddress.address)
              savedCustomer.defaultShippingAddress = newShippingAddress.address;
            await customerRepo.save(savedCustomer); // Sauvegarder la mise à jour du defaultShippingAddressId
          }
        }
      }

      logger.info(
        `Customer '${savedCustomer.getDisplayName()}' (ID: ${savedCustomer.id}) created successfully.`,
      );
      // Re-fetch avec toutes les relations pour la réponse
      const fullCustomer = await this.customerRepository.findById(savedCustomer.id);
      const apiResponse = this.mapToApiResponse(fullCustomer);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created customer ${savedCustomer.id} to API response.`,
        );
      }
      return apiResponse;
    });
  }

  async update(
    id: number,
    input: UpdateCustomerInput,
    updatedByUserId: number,
  ): Promise<CustomerApiResponse> {
    // Transaction pour gérer les mises à jour d'adresses et du client de manière atomique
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const customerRepo = transactionalEntityManager.getRepository(Customer);
      const addressRepo = transactionalEntityManager.getRepository(Address); // Pour valider/créer adresses

      const customer = await this.customerRepository.findById(id); // findById charge les relations par défaut
      if (!customer) throw new NotFoundError(`Customer with id ${id} not found.`);

      // TODO: Dépendance - Valider les FKs si elles sont modifiées (currency, group, addresses)
      if (input.defaultCurrencyId && input.defaultCurrencyId !== customer.defaultCurrencyId) {
        const currency = await this.currencyRepository.findById(input.defaultCurrencyId); // Utiliser this. car hors transaction
        if (!currency)
          throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);
      }
      if (input.customerGroupId && input.customerGroupId !== customer.customerGroupId) {
        if (input.customerGroupId === null) {
          // Autoriser la suppression du groupe
          // Pas de validation nécessaire si on enlève le groupe
        } else {
          const group = await this.customerGroupRepository.findById(input.customerGroupId); // Utiliser this.
          if (!group)
            throw new BadRequestError(`Customer group with ID ${input.customerGroupId} not found.`);
        }
      }
      if (input.billingAddressId && input.billingAddressId !== customer.billingAddressId) {
        const address = await this.addressRepository.findById(input.billingAddressId); // Utiliser this.
        if (!address)
          throw new BadRequestError(`Billing Address with ID ${input.billingAddressId} not found.`);
      }
      if (input.hasOwnProperty('defaultShippingAddressId')) {
        // Si on veut modifier/supprimer l'adresse de livraison par défaut
        if (input.defaultShippingAddressId === null) {
          // OK, on supprime l'adresse par défaut direct
        } else if (
          input.defaultShippingAddressId &&
          input.defaultShippingAddressId !== customer.defaultShippingAddressId
        ) {
          const address = await this.addressRepository.findById(input.defaultShippingAddressId); // Utiliser this.
          if (!address)
            throw new BadRequestError(
              `Default Shipping Address with ID ${input.defaultShippingAddressId} not found.`,
            );
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
      // Si defaultShippingAddressId est explicitement null dans l'input, on le passe
      if (
        input.hasOwnProperty('defaultShippingAddressId') &&
        input.defaultShippingAddressId === null
      ) {
        updatePayload.defaultShippingAddressId = null;
      }

      if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
        return this.mapToApiResponse(customer) as CustomerApiResponse;
      }

      const result = await this.customerRepository.update(id, updatePayload); // Utiliser customerRepo transactionnel
      if (result.affected === 0) {
        throw new NotFoundError(
          `Customer with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedCustomer = await this.customerRepository.findById(id);
      if (!updatedCustomer) throw new ServerError('Failed to re-fetch customer after update.');

      logger.info(
        `Customer '${updatedCustomer.getDisplayName()}' (ID: ${id}) updated successfully.`,
      );
      const apiResponse = this.mapToApiResponse(updatedCustomer);
      if (!apiResponse)
        throw new ServerError(`Failed to map updated customer ${id} to API response.`);
      return apiResponse;
    });
  }

  async delete(id: number, deletedByUserId: number): Promise<void> {
    try {
      const customer = await this.customerRepository.findById(id);
      if (!customer) throw new NotFoundError(`Customer with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si le client est utilisé (SalesOrders, Invoices, etc.)
      // const isUsed = await this.customerRepository.isCustomerInUse(id);
      // if (isUsed) {
      //   throw new BadRequestError(`Customer '${customer.getDisplayName()}' has associated orders/invoices and cannot be deleted.`);
      // }

      await this.customerRepository.softDelete(id);
      logger.info(
        `Customer '${customer.getDisplayName()}' (ID: ${id}) successfully soft-deleted by user ${deletedByUserId}.`,
      );
    } catch (error) {
      logger.error({ message: `Error deleting customer ${id}`, error }, 'CustomerService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting customer ${id}.`);
    }
  }

  static getInstance(): CustomerService {
    if (!instance) {
      instance = new CustomerService();
    }
    return instance;
  }
}
