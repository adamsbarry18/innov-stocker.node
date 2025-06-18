import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { CustomerReturn } from '../models/customer-return.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllCustomerReturnsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CustomerReturn> | FindOptionsWhere<CustomerReturn>[];
  order?: FindManyOptions<CustomerReturn>['order'];
  relations?: string[];
}

export class CustomerReturnRepository {
  private readonly repository: Repository<CustomerReturn>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CustomerReturn);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'customer',
      'salesOrder',
      'customerInvoice',
      'warehouse',
      'shop',
      'items',
      'items.product',
      'items.productVariant',
      'createdByUser',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['customer', 'salesOrder', 'customerInvoice', 'warehouse', 'shop', 'createdByUser']; // Ajout des relations warehouse et shop
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<CustomerReturn | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(CustomerReturn)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer return with id ${id}`, error },
        'CustomerReturnRepository.findById',
      );
      throw new ServerError(`Error finding customer return with id ${id}.`);
    }
  }

  async findByReturnNumber(returnNumber: string): Promise<CustomerReturn | null> {
    try {
      return await this.repository.findOne({
        where: { returnNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding customer return by number '${returnNumber}'`, error },
        'CustomerReturnRepository.findByReturnNumber',
      );
      throw new ServerError(`Error finding customer return by number '${returnNumber}'.`);
    }
  }

  async findLastReturnNumber(prefix: string): Promise<string | null> {
    try {
      const lastReturn: { maxReturnNumber: string | null } = (await this.repository
        .createQueryBuilder('cr')
        .select('MAX(cr.returnNumber)', 'maxReturnNumber')
        .where('cr.returnNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne()) ?? { maxReturnNumber: null };
      return lastReturn?.maxReturnNumber ?? null;
    } catch (error) {
      logger.error({ message: 'Error fetching last customer return number', error, prefix });
      throw new ServerError('Could not fetch last customer return number.');
    }
  }

  async findAll(
    options: FindAllCustomerReturnsOptions = {},
  ): Promise<{ returns: CustomerReturn[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<CustomerReturn> = {
        where,
        order: options.order ?? { returnDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelationsForFindAll() : options.relations,
      };
      const [returns, count] = await this.repository.findAndCount(findOptions);
      return { returns, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all customer returns`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'CustomerReturnRepository.findAll',
      );
      throw new ServerError(`Error finding all customer returns.`);
    }
  }

  create(dto: Partial<CustomerReturn>, transactionalEntityManager?: EntityManager): CustomerReturn {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(CustomerReturn)
      : this.repository;
    return repo.create(dto);
  }

  async save(
    cr: CustomerReturn,
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerReturn> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturn)
        : this.repository;
      return await repo.save(cr);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        (error.message as string).includes('UNIQUE constraint failed')
      ) {
        if ((error.message as string).includes('uq_cr_return_number')) {
          throw new BadRequestError(
            `Customer return with number '${cr.returnNumber}' already exists.`,
          );
        }
      }
      logger.error(
        { message: `Error saving customer return ${cr.id || cr.returnNumber}`, error },
        'CustomerReturnRepository.save',
      );
      throw new ServerError(`Error saving customer return.`);
    }
  }

  async update(
    id: number,
    dto: Partial<CustomerReturn>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturn)
        : this.repository;
      return await repo.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating customer return with id ${id}`, error },
        'CustomerReturnRepository.update',
      );
      throw new ServerError(`Error updating customer return with id ${id}.`);
    }
  }

  async softDelete(id: number, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(CustomerReturn)
        : this.repository;
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting customer return with id ${id}`, error },
        'CustomerReturnRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting customer return with id ${id}.`);
    }
  }

  async isReturnProcessedForRefundOrExchange(returnId: number): Promise<boolean> {
    try {
      const paymentCount = await this.repository
        .createQueryBuilder('cr')
        .innerJoin('payments', 'p', 'p.related_return_id = cr.id')
        .where('cr.id = :returnId', { returnId })
        .andWhere('p.direction = :direction', { direction: 'inbound' })
        .andWhere('p.deleted_time IS NULL')
        .getCount();

      return paymentCount > 0;
    } catch (error) {
      logger.error(
        {
          message: `Error checking if return ${returnId} is processed for refund/exchange`,
          error,
        },
        'CustomerReturnRepository.isReturnProcessedForRefundOrExchange',
      );
      throw new ServerError(
        `Error checking if return ${returnId} is processed for refund/exchange.`,
      );
    }
  }
}
