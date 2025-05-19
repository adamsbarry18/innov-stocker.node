import { type Repository, type DataSource, IsNull, type UpdateResult, Not } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { CustomerShippingAddress } from '../models/customer-shipping-addresses.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class CustomerShippingAddressRepository {
  private readonly repository: Repository<CustomerShippingAddress>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerShippingAddress);
  }

  async findById(id: number): Promise<CustomerShippingAddress | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: ['address', 'customer'],
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer shipping address with id ${id}`, error },
        'CustomerShippingAddressRepository.findById',
      );
      throw new ServerError(`Error finding customer shipping address with id ${id}.`);
    }
  }

  async findByCustomerId(customerId: number): Promise<CustomerShippingAddress[]> {
    try {
      return await this.repository.find({
        where: { customerId, deletedAt: IsNull() },
        relations: ['address'],
        order: { isDefault: 'DESC', addressLabel: 'ASC' },
      });
    } catch (error) {
      logger.error(
        { message: `Error finding shipping addresses for customer ${customerId}`, error },
        'CustomerShippingAddressRepository.findByCustomerId',
      );
      throw new ServerError(`Error finding shipping addresses for customer ${customerId}.`);
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
        if (error.message?.includes('customerId_addressId_unique')) {
          throw new BadRequestError(`This address is already linked to this customer.`);
        }
        if (error.message?.includes('customerId_addressLabel_unique')) {
          throw new BadRequestError(
            `This customer already has a shipping address with label '${shippingAddress.addressLabel}'.`,
          );
        }
      }
      logger.error(
        { message: `Error saving customer shipping address`, error },
        'CustomerShippingAddressRepository.save',
      );
      throw new ServerError('Error saving customer shipping address.');
    }
  }

  async update(id: number, dto: Partial<CustomerShippingAddress>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.addressLabel && error.message?.includes('customerId_addressLabel_unique')) {
          throw new BadRequestError(
            `This customer already has a shipping address with label '${dto.addressLabel}'.`,
          );
        }
      }
      logger.error(
        { message: `Error updating customer shipping address ${id}`, error },
        'CustomerShippingAddressRepository.update',
      );
      throw new ServerError('Error updating customer shipping address.');
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting customer shipping address ${id}`, error },
        'CustomerShippingAddressRepository.softDelete',
      );
      throw new ServerError('Error soft-deleting customer shipping address.');
    }
  }

  async unsetOtherDefaults(customerId: number, currentShippingAddressId: number): Promise<void> {
    try {
      await this.repository.update(
        {
          customerId,
          isDefault: true,
          id: Not(currentShippingAddressId),
          deletedAt: IsNull(),
        },
        { isDefault: false },
      );
    } catch (error) {
      logger.error(
        {
          message: `Error unsetting other default shipping addresses for customer ${customerId}`,
          error,
        },
        'CustomerShippingAddressRepository.unsetOtherDefaults',
      );
      throw new ServerError('Error updating default shipping addresses.');
    }
  }
}
