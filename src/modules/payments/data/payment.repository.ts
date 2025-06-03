import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  ILike,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import logger from '@/lib/logger';
import { Payment } from '../models/payment.entity';
import { ServerError } from '@/common/errors/httpErrors';

interface FindAllPaymentsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Payment> | FindOptionsWhere<Payment>[];
  order?: FindManyOptions<Payment>['order'];
  relations?: string[];
  searchTerm?: string; // For referenceNumber or notes
}

export class PaymentRepository {
  private readonly repository: Repository<Payment>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Payment);
  }

  private getDefaultRelations(): string[] {
    return [
      'currency',
      'paymentMethod',
      'customer',
      'supplier',
      'customerInvoice',
      'supplierInvoice',
      'salesOrder',
      'purchaseOrder',
      'bankAccount',
      'cashRegisterSession',
      'recordedByUser',
    ];
  }

  async findById(
    id: number,
    options?: { relations?: string[]; transactionalEntityManager?: EntityManager },
  ): Promise<Payment | null> {
    try {
      const repo = options?.transactionalEntityManager
        ? options.transactionalEntityManager.getRepository(Payment)
        : this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error({ message: `Error finding payment with id ${id}`, error });
      throw new ServerError(`Error finding payment with id ${id}.`);
    }
  }

  async findAll(
    options: FindAllPaymentsOptions = {},
  ): Promise<{ payments: Payment[]; count: number }> {
    try {
      let whereConditions: FindOptionsWhere<Payment> | FindOptionsWhere<Payment>[] = options.where
        ? Array.isArray(options.where)
          ? options.where.map((w) => ({ ...w, deletedAt: IsNull() }))
          : { ...options.where, deletedAt: IsNull() }
        : { deletedAt: IsNull() };

      if (options.searchTerm) {
        const searchPattern = ILike(`%${options.searchTerm}%`);
        const searchSpecific: FindOptionsWhere<Payment>[] = [
          // Search in multiple fields
          { referenceNumber: searchPattern, deletedAt: IsNull() },
          { notes: searchPattern, deletedAt: IsNull() },
        ];

        if (Array.isArray(whereConditions) && whereConditions.length > 0) {
          // If whereConditions is already an array (OR conditions), this becomes complex.
          // For simplicity, if searchTerm exists, it might override or be ANDed with simple filters.
          // A more robust solution uses QueryBuilder for complex AND/OR combinations.
          logger.warn(
            'Search term with complex existing filters might require QueryBuilder for precise OR logic.',
          );
          const combinedSearch: FindOptionsWhere<Payment>[] = [];
          whereConditions.forEach((wc) => {
            searchSpecific.forEach((sc) => {
              combinedSearch.push({ ...wc, ...sc });
            });
          });
          whereConditions = combinedSearch.length > 0 ? combinedSearch : searchSpecific;
        } else if (
          Object.keys(whereConditions).length > 1 ||
          (Object.keys(whereConditions).length === 1 &&
            !(whereConditions as FindOptionsWhere<Payment>).deletedAt)
        ) {
          // If there are existing AND filters, combine them with OR search conditions
          whereConditions = searchSpecific.map((sc) => ({
            ...(whereConditions as FindOptionsWhere<Payment>),
            ...sc,
          }));
        } else {
          // Only deletedAt or no filters
          whereConditions = searchSpecific;
        }
      }

      const findOptions: FindManyOptions<Payment> = {
        where: whereConditions,
        order: options.order || { paymentDate: 'DESC', createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations === undefined ? this.getDefaultRelations() : options.relations,
      };
      const [payments, count] = await this.repository.findAndCount(findOptions);
      return { payments, count };
    } catch (error) {
      logger.error(
        {
          message: `Error finding all payments`,
          error,
          options: { ...options, where: JSON.stringify(options.where) },
        },
        'PaymentRepository.findAll',
      );
      throw new ServerError(`Error finding all payments.`);
    }
  }

  create(dto: Partial<Payment>, transactionalEntityManager?: EntityManager): Payment {
    const repo = transactionalEntityManager
      ? transactionalEntityManager.getRepository(Payment)
      : this.repository;
    return repo.create(dto);
  }

  async save(payment: Payment, transactionalEntityManager?: EntityManager): Promise<Payment> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Payment)
        : this.repository;
      return await repo.save(payment);
    } catch (error: any) {
      // No specific unique constraints defined in the SQL other than primary key
      logger.error(
        { message: `Error saving payment ${payment.id || 'new'}`, error },
        'PaymentRepository.save',
      );
      throw new ServerError(`Error saving payment.`);
    }
  }

  // Payments are generally immutable. Update might be restricted to notes or status if applicable.
  async update(
    id: number,
    dto: Partial<Payment>,
    transactionalEntityManager?: EntityManager,
  ): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Payment)
        : this.repository;
      // Exclude fields that should not be updated directly
      const {
        amount,
        direction,
        currencyId,
        paymentMethodId,
        customerId,
        supplierId,
        /*...fk_ids...*/ ...updatableDto
      } = dto;
      if (
        Object.keys(dto).some((k) =>
          ['amount', 'direction', 'currencyId', 'paymentMethodId'].includes(k),
        )
      ) {
        logger.warn(
          `Attempt to update critical payment fields for ID ${id}. This is generally disallowed.`,
        );
        // throw new BadRequestError('Core payment details like amount, direction, currency, method cannot be changed. Create a reversal instead.');
      }
      return await repo.update({ id, deletedAt: IsNull() }, updatableDto);
    } catch (error: any) {
      logger.error(
        { message: `Error updating payment with id ${id}`, error },
        'PaymentRepository.update',
      );
      throw new ServerError(`Error updating payment with id ${id}.`);
    }
  }

  async softDelete(id: string, transactionalEntityManager?: EntityManager): Promise<UpdateResult> {
    try {
      const repo = transactionalEntityManager
        ? transactionalEntityManager.getRepository(Payment)
        : this.repository;
      // Service layer should handle reversal of financial impacts before soft deleting.
      return await repo.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting payment with id ${id}`, error },
        'PaymentRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting payment with id ${id}.`);
    }
  }
}
