// TODO: Importer CustomerRepository une fois qu'il sera créé.
// import { CustomerRepository } from '../../customers/data/customer.repository';
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

let instance: CustomerGroupService | null = null;

export class CustomerGroupService {
  private readonly groupRepository: CustomerGroupRepository;
  // TODO: private readonly customerRepository: CustomerRepository;

  constructor(
    groupRepository: CustomerGroupRepository = new CustomerGroupRepository(),
    // customerRepository: CustomerRepository = new CustomerRepository() // Décommenter quand disponible
  ) {
    this.groupRepository = groupRepository;
    // TODO: this.customerRepository = customerRepository;
  }

  mapToApiResponse(group: CustomerGroup | null): CustomerGroupApiResponse | null {
    if (!group) return null;
    return group.toApi();
  }

  async findById(id: number): Promise<CustomerGroupApiResponse> {
    try {
      const group = await this.groupRepository.findById(id);
      if (!group) throw new NotFoundError(`Customer group with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(group);
      if (!apiResponse) {
        throw new ServerError(`Failed to map customer group ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding customer group by id ${id}`, error },
        'CustomerGroupService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding customer group by id ${id}.`);
    }
  }

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
        order: options?.sort || { name: 'ASC' },
      });
      const apiGroups = groups
        .map((g) => this.mapToApiResponse(g))
        .filter(Boolean) as CustomerGroupApiResponse[];
      return { groups: apiGroups, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all customer groups`, error, options },
        'CustomerGroupService.findAll',
      );
      throw new ServerError('Error finding all customer groups.');
    }
  }

  async create(
    input: CreateCustomerGroupInput,
    createdByUserId?: number,
  ): Promise<CustomerGroupApiResponse> {
    const existingGroup = await this.groupRepository.findByName(input.name);
    if (existingGroup) {
      throw new BadRequestError(`Customer group with name '${input.name}' already exists.`);
    }

    const groupEntity = this.groupRepository.create({
      ...input,
      // createdByUserId: createdByUserId, // Si audit sur cette entité
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
    } catch (error) {
      logger.error(
        { message: `Error creating customer group`, error, input },
        'CustomerGroupService.create',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create customer group.');
    }
  }

  async update(
    id: number,
    input: UpdateCustomerGroupInput,
    updatedByUserId?: number,
  ): Promise<CustomerGroupApiResponse> {
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
      // updatePayload.updatedByUserId = updatedByUserId; // Si audit

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
    } catch (error) {
      logger.error(
        { message: `Error updating customer group ${id}`, error, input },
        'CustomerGroupService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update customer group ${id}.`);
    }
  }

  async delete(id: number, deletedByUserId?: number): Promise<void> {
    try {
      const group = await this.groupRepository.findById(id);
      if (!group) throw new NotFoundError(`Customer group with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si le groupe est utilisé par des clients
      // const isUsed = await this.customerRepository.count({ where: { customerGroupId: id, deletedAt: IsNull() }});
      // if (isUsed > 0) {
      //   throw new BadRequestError(`Customer group '${group.name}' is in use by customers and cannot be deleted.`);
      // }
      // Utilisation du placeholder du repository pour l'instant
      const isUsedByCustomers = await this.groupRepository.isGroupUsedByCustomers(id);
      if (isUsedByCustomers) {
        throw new BadRequestError(
          `Customer group '${group.name}' is in use and cannot be deleted. Please reassign customers first.`,
        );
      }

      await this.groupRepository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error deleting customer group ${id}`, error },
        'CustomerGroupService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting customer group ${id}.`);
    }
  }

  static getInstance(): CustomerGroupService {
    if (!instance) {
      instance = new CustomerGroupService();
    }
    return instance;
  }
}
