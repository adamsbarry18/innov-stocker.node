import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager, // Import EntityManager
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Customer } from '../models/customer.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllCustomersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Customer>;
  order?: FindManyOptions<Customer>['order'];
  relations?: string[];
}

export class CustomerRepository {
  private readonly repository: Repository<Customer>;

  // Accept optional EntityManager
  constructor(dataSource: DataSource | EntityManager = appDataSource) {
    this.repository = dataSource.getRepository(Customer);
  }

  private getDefaultRelations(): string[] {
    return [
      'defaultCurrency',
      'customerGroup',
      'billingAddress',
      'defaultShippingAddress',
      'shippingAddresses',
      'shippingAddresses.address',
    ];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Customer | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations || this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer with id ${id}`, error },
        'CustomerRepository.findById',
      );
      throw new ServerError(`Error finding customer with id ${id}.`);
    }
  }

  async findByEmail(email: string): Promise<Customer | null> {
    if (!email) return null;
    try {
      return await this.repository.findOne({
        where: { email: email.toLowerCase().trim(), deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer by email '${email}'`, error },
        'CustomerRepository.findByEmail',
      );
      throw new ServerError(`Error finding customer by email '${email}'.`);
    }
  }

  async findAll(
    options: FindAllCustomersOptions = {},
  ): Promise<{ customers: Customer[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<Customer> = {
        where,
        order: options.order || { companyName: 'ASC', lastName: 'ASC', firstName: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations || this.getDefaultRelations(),
      };
      const [customers, count] = await this.repository.findAndCount(findOptions);
      return { customers, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all customers`, error, options },
        'CustomerRepository.findAll',
      );
      throw new ServerError(`Error finding all customers.`);
    }
  }

  /**
   * Finds a customer by a specific criterion.
   */
  async findOneBy(where: FindOptionsWhere<Customer>): Promise<Customer | null> {
    try {
      return await this.repository.findOne({
        where: { ...where, deletedAt: IsNull() },
        relations: this.getDefaultRelations(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer by criteria`, error, where },
        'CustomerRepository.findOneBy',
      );
      throw new ServerError(`Error finding customer by criteria.`);
    }
  }

  create(dto: Partial<Customer>): Customer {
    const customer = this.repository.create(dto);
    if (customer.email) {
      customer.email = customer.email.toLowerCase().trim();
    }
    return customer;
  }

  async save(customer: Customer): Promise<Customer> {
    try {
      if (customer.email) {
        customer.email = customer.email.toLowerCase().trim();
      }
      // TypeORM will handle saving cascaded shippingAddresses if cascade is set on relation
      return await this.repository.save(customer);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('email_unique') || error.message?.includes('customers.email')) {
          throw new BadRequestError(`Customer with email '${customer.email}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving customer ${customer.id || customer.email}`, error },
        'CustomerRepository.save',
      );
      throw new ServerError(`Error saving customer.`);
    }
  }

  async update(id: number, dto: Partial<Customer>): Promise<UpdateResult> {
    try {
      if (dto.email) {
        dto.email = dto.email.toLowerCase().trim();
      }
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (
          dto.email &&
          (error.message?.includes('email_unique') || error.message?.includes('customers.email'))
        ) {
          throw new BadRequestError(
            `Cannot update: Customer with email '${dto.email}' may already exist for another record.`,
          );
        }
      }
      logger.error(
        { message: `Error updating customer with id ${id}`, error },
        'CustomerRepository.update',
      );
      throw new ServerError(`Error updating customer with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // Dependency checks (e.g., on orders, invoices) should be in the service layer
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting customer with id ${id}`, error },
        'CustomerRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting customer with id ${id}.`);
    }
  }

  // TODO: Implement isCustomerInUse with necessary repositories
  async isCustomerInUse(customerId: number): Promise<boolean> {
    logger.warn('CustomerRepository.isCustomerInUse is a placeholder.');
    // Example:
    // const salesOrderCount = await this.repository.manager.getRepository(SalesOrder).count({where: {customerId}});
    // const quoteCount = await this.repository.manager.getRepository(Quote).count({where: {customerId}});
    // return salesOrderCount > 0 || quoteCount > 0;
    return false;
  }
}
