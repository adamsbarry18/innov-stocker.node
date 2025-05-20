import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager, // Import EntityManager
} from 'typeorm';
import { Address } from '../models/address.entity';
import { appDataSource } from '@/database/data-source';

// Options for listing addresses
interface FindAllAddressesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Address>;
  order?: FindManyOptions<Address>['order'];
}

export class AddressRepository {
  private readonly repository: Repository<Address>;

  // Accept optional EntityManager
  constructor(dataSource: DataSource | EntityManager = appDataSource) {
    this.repository = dataSource.getRepository(Address);
  }

  /**
   * Finds an active address by its ID.
   */
  async findById(id: number): Promise<Address | null> {
    return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
  }

  /**
   * Lists all active addresses with pagination and filtering.
   */
  async findAll(
    options: FindAllAddressesOptions = {},
  ): Promise<{ addresses: Address[]; count: number }> {
    const where = { ...options.where, deletedAt: IsNull() };
    const [addresses, count] = await this.repository.findAndCount({
      where,
      order: options.order || { createdAt: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
    return { addresses, count };
  }

  /**
   * Creates a new address instance (without saving).
   */
  create(dto: Partial<Address>): Address {
    return this.repository.create(dto);
  }

  /**
   * Saves an address entity to the database.
   */
  async save(address: Address): Promise<Address> {
    return await this.repository.save(address);
  }

  /**
   * Updates an active address based on criteria.
   */
  async update(id: number, dto: Partial<Address>): Promise<UpdateResult> {
    return await this.repository.update({ id, deletedAt: IsNull() }, dto);
  }

  /**
   * Soft deletes an active address by setting deletedAt.
   */
  async softDelete(id: number): Promise<UpdateResult> {
    return await this.repository.softDelete(id);
  }

  /**
   * Restores a soft-deleted address.
   */
  async restore(id: number): Promise<UpdateResult> {
    return await this.repository.restore(id);
  }

  /**
   * Checks if an active address exists based on the given criteria.
   */
  async exists(where: FindOptionsWhere<Address>): Promise<boolean> {
    return await this.repository.exists({
      where: { ...where, deletedAt: IsNull() },
    });
  }
}
