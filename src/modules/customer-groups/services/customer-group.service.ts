import logger from '@/lib/logger';
import { CustomerGroupRepository } from '../data/customer-group.repository';
import {
  type CreateCustomerGroupInput,
  type UpdateCustomerGroupInput,
  type CustomerGroupApiResponse,
  type CustomerGroup,
  customerGroupValidationInputErrors,
} from '../models/customer-group.entity';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import { CustomerRepository } from '@/modules/customers/data/customer.repository';

let instance: CustomerGroupService | null = null;

/**
 * Service for managing customer groups.
 * This service handles operations such as creating, updating, deleting, and retrieving customer groups.
 */
export class CustomerGroupService {
  private readonly groupRepository: CustomerGroupRepository;
  private readonly customerRepository: CustomerRepository;

  /**
   * Creates an instance of CustomerGroupService.
   * @param groupRepository - The repository for customer groups.
   * @param customerRepository - The repository for customers.
   */
  constructor(
    groupRepository: CustomerGroupRepository = new CustomerGroupRepository(),
    customerRepository: CustomerRepository = new CustomerRepository(),
  ) {
    this.groupRepository = groupRepository;
    this.customerRepository = customerRepository;
  }

  /**
   * Maps a CustomerGroup entity to a CustomerGroupApiResponse.
   * @param group - The customer group entity.
   * @returns The API response representation of the group, or null if the input is null.
   */
  mapToApiResponse(group: CustomerGroup | null): CustomerGroupApiResponse | null {
    if (!group) return null;
    return group.toApi();
  }

  /**
   * Finds a customer group by its ID.
   * @param id - The ID of the customer group.
   * @returns A promise that resolves to the API response of the customer group.
   */
  async findById(id: number): Promise<CustomerGroupApiResponse> {
    try {
      const group = await this.groupRepository.findById(id);
      if (!group) throw new NotFoundError(`Customer group with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(group);
      if (!apiResponse) {
        throw new ServerError(`Failed to map customer group ${id} to API response.`);
      }
      return apiResponse;
    } catch (error: unknown) {
      logger.error(
        { message: `Error finding customer group by id ${id}`, error: (error as Error).message },
        'CustomerGroupService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding customer group by id ${id}.`);
    }
  }

  /**
   * Finds all customer groups based on provided options.
   * @param options - Options for filtering, pagination, and sorting.
   * @param options.limit - The maximum number of groups to return.
   * @param options.offset - The number of groups to skip.
   * @param options.filters - Filters to apply to the query.
   * @param options.sort - Sorting options.
   * @returns A promise that resolves to an object containing an array of customer groups and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CustomerGroup>;
    sort?: FindManyOptions<CustomerGroup>['order'];
  }): Promise<{ groups: CustomerGroupApiResponse[]; total: number }> {
    try {
      const { groups, count } = await this.groupRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
      });
      const apiGroups = groups
        .map((g) => this.mapToApiResponse(g))
        .filter(Boolean) as CustomerGroupApiResponse[];
      return { groups: apiGroups, total: count };
    } catch (error: unknown) {
      logger.error(
        { message: `Error finding all customer groups`, error: (error as Error).message, options },
        'CustomerGroupService.findAll',
      );
      throw new ServerError('Error finding all customer groups.');
    }
  }

  /**
   * Creates a new customer group.
   * @param input - The input data for creating the customer group.
   * @returns A promise that resolves to the API response of the newly created customer group.
   */
  async create(input: CreateCustomerGroupInput): Promise<CustomerGroupApiResponse> {
    const existingGroup = await this.groupRepository.findByName(input.name);
    if (existingGroup) {
      throw new BadRequestError(`Customer group with name '${input.name}' already exists.`);
    }

    const groupEntity = this.groupRepository.create({
      ...input,
    });

    if (!groupEntity.isValid()) {
      throw new BadRequestError(
        `Customer group data is invalid. Errors: ${customerGroupValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedGroup = await this.groupRepository.save(groupEntity);
      const apiResponse = this.mapToApiResponse(savedGroup);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created customer group ${savedGroup.id} to API response.`,
        );
      }
      return apiResponse;
    } catch (error: unknown) {
      logger.error(
        { message: `Error creating customer group`, error: (error as Error).message, input },
        'CustomerGroupService.create',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create customer group.');
    }
  }

  /**
   * Updates an existing customer group.
   * @param id - The ID of the customer group to update.
   * @param input - The input data for updating the customer group.
   * @returns A promise that resolves to the API response of the updated customer group.
   */
  async update(id: number, input: UpdateCustomerGroupInput): Promise<CustomerGroupApiResponse> {
    try {
      const group = await this.groupRepository.findById(id);
      if (!group) throw new NotFoundError(`Customer group with id ${id} not found.`);

      if (input.name && input.name !== group.name) {
        const existingGroup = await this.groupRepository.findByName(input.name);
        if (existingGroup && existingGroup.id !== id) {
          throw new BadRequestError(
            `Another customer group with name '${input.name}' already exists.`,
          );
        }
      }

      const tempGroupData = { ...group, ...input };
      const tempGroup = this.groupRepository.create(tempGroupData);
      if (!tempGroup.isValid()) {
        throw new BadRequestError(
          `Updated customer group data is invalid. Errors: ${customerGroupValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<CustomerGroup> = { ...input };

      if (Object.keys(updatePayload).length === 0) {
        return this.mapToApiResponse(group) as CustomerGroupApiResponse;
      }

      const result = await this.groupRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Customer group with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedGroup = await this.groupRepository.findById(id);
      if (!updatedGroup) throw new ServerError('Failed to re-fetch customer group after update.');

      const apiResponse = this.mapToApiResponse(updatedGroup);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated group ${id} to API response.`);
      }
      return apiResponse;
    } catch (error: unknown) {
      logger.error(
        { message: `Error updating customer group ${id}`, error: (error as Error).message, input },
        'CustomerGroupService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update customer group ${id}.`);
    }
  }

  /**
   * Deletes a customer group by its ID.
   * @param id - The ID of the customer group to delete.
   * @returns A promise that resolves when the customer group is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    try {
      const group = await this.groupRepository.findById(id);
      if (!group) throw new NotFoundError(`Customer group with id ${id} not found.`);

      const isUsedByCustomers = await this.groupRepository.isGroupUsedByCustomers(id);
      if (isUsedByCustomers) {
        throw new BadRequestError(
          `Customer group '${group.name}' is in use and cannot be deleted. Please reassign customers first.`,
        );
      }

      await this.groupRepository.softDelete(id);
    } catch (error: unknown) {
      logger.error(
        { message: `Error deleting customer group ${id}`, error: (error as Error).message },
        'CustomerGroupService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting customer group ${id}.`);
    }
  }

  /**
   * Returns a singleton instance of CustomerGroupService.
   * @returns The singleton instance of CustomerGroupService.
   */
  static getInstance(): CustomerGroupService {
    instance ??= new CustomerGroupService();

    return instance;
  }
}
