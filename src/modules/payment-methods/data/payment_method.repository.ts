import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { PaymentMethod } from '../models/payment-method.entity';
import { Payment } from '@/modules/payments/models/payment.entity';

interface FindAllPaymentMethodsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<PaymentMethod>;
  order?: FindManyOptions<PaymentMethod>['order'];
}

export class PaymentMethodRepository {
  private readonly repository: Repository<PaymentMethod>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(PaymentMethod);
  }

  async findById(id: number): Promise<PaymentMethod | null> {
    try {
      return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding payment method with id ${id}`, error },
        'PaymentMethodRepository.findById',
      );
      throw new ServerError(`Error finding payment method with id ${id}.`);
    }
  }

  async findByName(name: string): Promise<PaymentMethod | null> {
    try {
      return await this.repository.findOne({ where: { name, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding payment method by name '${name}'`, error },
        'PaymentMethodRepository.findByName',
      );
      throw new ServerError(`Error finding payment method by name '${name}'.`);
    }
  }

  async findAll(
    options: FindAllPaymentMethodsOptions = {},
  ): Promise<{ methods: PaymentMethod[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<PaymentMethod> = {
        where,
        order: options.order ?? { name: 'ASC' },
        skip: options.skip,
        take: options.take,
      };
      const [methods, count] = await this.repository.findAndCount(findOptions);
      return { methods, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all payment methods`, error, options },
        'PaymentMethodRepository.findAll',
      );
      throw new ServerError(`Error finding all payment methods.`);
    }
  }

  create(dto: Partial<PaymentMethod>): PaymentMethod {
    return this.repository.create(dto);
  }

  async save(method: PaymentMethod): Promise<PaymentMethod> {
    try {
      return await this.repository.save(method);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique')
      ) {
        throw new BadRequestError(`Payment method with name '${method.name}' already exists.`);
      }
      logger.error(
        { message: `Error saving payment method ${method.id || method.name}`, error },
        'PaymentMethodRepository.save',
      );
      throw new ServerError(`Error saving payment method.`);
    }
  }

  async update(id: number, dto: Partial<PaymentMethod>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique')
      ) {
        throw new BadRequestError(
          `Cannot update: Payment method with name '${dto.name}' may already exist.`,
        );
      }
      logger.error(
        { message: `Error updating payment method with id ${id}`, error },
        'PaymentMethodRepository.update',
      );
      throw new ServerError(`Error updating payment method with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting payment method with id ${id}`, error },
        'PaymentMethodRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting payment method with id ${id}.`);
    }
  }

  async isPaymentMethodInUse(methodId: number): Promise<boolean> {
    logger.warn('PaymentMethodRepository.isPaymentMethodInUse is a placeholder.');
    const paymentRepository = this.repository.manager.getRepository(Payment);
    const count = await paymentRepository.count({ where: { paymentMethodId: methodId } });
    return count > 0;
  }
}
