import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { CustomerGroup } from '../models/customer-group.entity';
import { appDataSource } from '@/database/data-source';
import logger from '@/lib/logger';
import { BadRequestError, ServerError } from '@/common/errors/httpErrors';

interface FindAllCustomerGroupsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CustomerGroup>;
  order?: FindManyOptions<CustomerGroup>['order'];
}

export class CustomerGroupRepository {
  private readonly repository: Repository<CustomerGroup>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerGroup);
  }

  async findById(id: number): Promise<CustomerGroup | null> {
    try {
      return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding customer group with id ${id}`, error },
        'CustomerGroupRepository.findById',
      );
      throw new ServerError(`Error finding customer group with id ${id}.`);
    }
  }

  async findByName(name: string): Promise<CustomerGroup | null> {
    try {
      return await this.repository.findOne({ where: { name, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding customer group by name '${name}'`, error },
        'CustomerGroupRepository.findByName',
      );
      throw new ServerError(`Error finding customer group by name '${name}'.`);
    }
  }

  async findAll(
    options: FindAllCustomerGroupsOptions = {},
  ): Promise<{ groups: CustomerGroup[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<CustomerGroup> = {
        where,
        order: options.order || { name: 'ASC' },
        skip: options.skip,
        take: options.take,
      };
      const [groups, count] = await this.repository.findAndCount(findOptions);
      return { groups, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all customer groups`, error, options },
        'CustomerGroupRepository.findAll',
      );
      throw new ServerError(`Error finding all customer groups.`);
    }
  }

  create(dto: Partial<CustomerGroup>): CustomerGroup {
    return this.repository.create(dto);
  }

  async save(group: CustomerGroup): Promise<CustomerGroup> {
    try {
      return await this.repository.save(group);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique')
      ) {
        throw new BadRequestError(`Customer group with name '${group.name}' already exists.`);
      }
      logger.error(
        { message: `Error saving customer group ${group.id || group.name}`, error },
        'CustomerGroupRepository.save',
      );
      throw new ServerError(`Error saving customer group.`);
    }
  }

  async update(id: number, dto: Partial<CustomerGroup>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique')
      ) {
        throw new BadRequestError(
          `Cannot update: Customer group with name '${dto.name}' may already exist.`,
        );
      }
      logger.error(
        { message: `Error updating customer group with id ${id}`, error },
        'CustomerGroupRepository.update',
      );
      throw new ServerError(`Error updating customer group with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // Dependency check for customers using this group should be in the service layer
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting customer group with id ${id}`, error },
        'CustomerGroupRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting customer group with id ${id}.`);
    }
  }

  // Placeholder for dependency check - to be implemented properly with CustomerRepository
  async isGroupUsedByCustomers(groupId: number): Promise<boolean> {
    logger.warn(
      'CustomerGroupRepository.isGroupUsedByCustomers is a placeholder and should be implemented using CustomerRepository or a direct query.',
    );
    // Example (requires Customer entity and repository):
    // try {
    //   const customerRepository = this.repository.manager.getRepository(Customer); // Customer entity needs to be defined/imported
    //   const count = await customerRepository.count({ where: { customerGroupId: groupId, deletedAt: IsNull() }});
    //   return count > 0;
    // } catch (error) {
    //   logger.error({ message: `Error checking if group ${groupId} is used by customers`, error }, 'CustomerGroupRepository.isGroupUsedByCustomers');
    //   throw new ServerError('Error checking customer group usage.');
    // }
    return false;
  }
}
