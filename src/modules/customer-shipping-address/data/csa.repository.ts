import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  Not,
  type EntityManager, // Import EntityManager
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { CustomerShippingAddress } from '../models/csa.entity';

interface FindAllCSAsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CustomerShippingAddress>;
  order?: FindManyOptions<CustomerShippingAddress>['order'];
  relations?: string[];
}

export class CustomerShippingAddressRepository {
  private readonly repository: Repository<CustomerShippingAddress>;

  // Accept optional EntityManager
  constructor(dataSource: DataSource | EntityManager = appDataSource) {
    this.repository = dataSource.getRepository(CustomerShippingAddress);
  }

  private getDefaultRelations(): string[] {
    return ['address', 'customer'];
  }

  async findById(
    id: number,
    options?: { relations?: string[] },
  ): Promise<CustomerShippingAddress | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations || ['address'], // Load address by default
      });
    } catch (error) {
      logger.error({ message: `Error finding CSA with id ${id}`, error }, 'CSARepository.findById');
      throw new ServerError(`Error finding CSA with id ${id}.`);
    }
  }

  async findAll(
    options: FindAllCSAsOptions = {},
  ): Promise<{ shippingAddresses: CustomerShippingAddress[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<CustomerShippingAddress> = {
        where,
        order: options.order || { customerId: 'ASC', isDefault: 'DESC', addressLabel: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations || ['address'], // Default to loading address part
      };
      const [shippingAddresses, count] = await this.repository.findAndCount(findOptions);
      return { shippingAddresses, count };
    } catch (error) {
      logger.error({ message: `Error finding all CSAs`, error, options }, 'CSARepository.findAll');
      throw new ServerError(`Error finding all CSAs.`);
    }
  }

  async findByCustomerId(
    customerId: number,
    options?: { relations?: string[] },
  ): Promise<CustomerShippingAddress[]> {
    try {
      return await this.repository.find({
        where: { customerId, deletedAt: IsNull() },
        relations: options?.relations || ['address'],
        order: { isDefault: 'DESC', addressLabel: 'ASC' },
      });
    } catch (error) {
      logger.error(
        { message: `Error finding shipping addresses for customer ${customerId}`, error },
        'CSARepository.findByCustomerId',
      );
      throw new ServerError(`Error finding shipping addresses for customer ${customerId}.`);
    }
  }

  async findDefaultByCustomerId(customerId: number): Promise<CustomerShippingAddress | null> {
    try {
      return await this.repository.findOne({
        where: { customerId, isDefault: true, deletedAt: IsNull() },
        relations: ['address'],
      });
    } catch (error) {
      logger.error(
        { message: `Error finding default shipping address for customer ${customerId}`, error },
        'CSARepository.findDefaultByCustomerId',
      );
      throw new ServerError(`Error finding default shipping address.`);
    }
  }

  async findByCustomerAndAddress(
    customerId: number,
    addressId: number,
  ): Promise<CustomerShippingAddress | null> {
    try {
      return await this.repository.findOne({
        where: { customerId, addressId, deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error({
        message: `Error finding CSA by customer ${customerId} and address ${addressId}`,
        error,
      });
      throw new ServerError('Error finding specific CSA link.');
    }
  }

  async findByCustomerAndLabel(
    customerId: number,
    addressLabel: string,
  ): Promise<CustomerShippingAddress | null> {
    try {
      return await this.repository.findOne({
        where: { customerId, addressLabel, deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error({
        message: `Error finding CSA by customer ${customerId} and label '${addressLabel}'`,
        error,
      });
      throw new ServerError('Error finding specific CSA link by label.');
    }
  }

  create(dto: Partial<CustomerShippingAddress>): CustomerShippingAddress {
    return this.repository.create(dto);
  }

  async save(shippingAddress: CustomerShippingAddress): Promise<CustomerShippingAddress> {
    try {
      return await this.repository.save(shippingAddress);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_customer_address_link')) {
          throw new BadRequestError(
            `This address (ID: ${shippingAddress.addressId}) is already linked as a shipping address for customer ID ${shippingAddress.customerId}.`,
          );
        }
        if (error.message?.includes('uq_customer_address_label')) {
          throw new BadRequestError(
            `Customer ID ${shippingAddress.customerId} already has a shipping address with label '${shippingAddress.addressLabel}'.`,
          );
        }
      }
      logger.error({ message: `Error saving CSA`, error, shippingAddress }, 'CSARepository.save');
      throw new ServerError('Error saving customer shipping address.');
    }
  }

  async update(id: number, dto: Partial<CustomerShippingAddress>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.addressLabel && error.message?.includes('uq_customer_address_label')) {
          throw new BadRequestError(
            `Cannot update: Customer ID ${dto.customerId || 'unknown'} already has another shipping address with label '${dto.addressLabel}'.`,
          );
        }
        // uq_customer_address_link check if addressId or customerId changes
      }
      logger.error({ message: `Error updating CSA ${id}`, error }, 'CSARepository.update');
      throw new ServerError(`Error updating CSA ${id}.`);
    }
  }

  async unsetDefaultForOthers(
    customerId: number,
    excludeShippingAddressId: number,
  ): Promise<UpdateResult> {
    try {
      return await this.repository.update(
        { customerId, id: Not(excludeShippingAddressId), isDefault: true, deletedAt: IsNull() },
        { isDefault: false },
      );
    } catch (error) {
      logger.error({
        message: `Error unsetting default for other shipping addresses of customer ${customerId}`,
        error,
      });
      throw new ServerError('Error updating default shipping address status.');
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting CSA ${id}`, error }, 'CSARepository.softDelete');
      throw new ServerError(`Error soft-deleting CSA ${id}.`);
    }
  }
}
