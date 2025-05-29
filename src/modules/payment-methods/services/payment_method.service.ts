import { PaymentMethodRepository } from '../data/payment_method.repository';
// TODO: Importer PaymentRepository pour la vérification des dépendances
// import { PaymentRepository } from '../../payments/data/payment.repository';
import {
  type CreatePaymentMethodInput,
  type UpdatePaymentMethodInput,
  type PaymentMethodApiResponse,
  type PaymentMethod,
  paymentMethodValidationInputErrors,
} from '../models/payment-method.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';

let instance: PaymentMethodService | null = null;

export class PaymentMethodService {
  private readonly methodRepository: PaymentMethodRepository;
  // TODO: private readonly paymentRepository: PaymentRepository;

  constructor(
    methodRepository: PaymentMethodRepository = new PaymentMethodRepository(),
    // paymentRepository: PaymentRepository = new PaymentRepository()
  ) {
    this.methodRepository = methodRepository;
    // TODO: this.paymentRepository = paymentRepository;
  }

  mapToApiResponse(method: PaymentMethod | null): PaymentMethodApiResponse | null {
    if (!method) return null;
    return method.toApi();
  }

  async findById(id: number): Promise<PaymentMethodApiResponse> {
    try {
      const method = await this.methodRepository.findById(id);
      if (!method) throw new NotFoundError(`Payment method with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(method);
      if (!apiResponse)
        throw new ServerError(`Failed to map payment method ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding payment method by id ${id}`, error },
        'PaymentMethodService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding payment method by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<PaymentMethod>;
    sort?: FindManyOptions<PaymentMethod>['order'];
  }): Promise<{ methods: PaymentMethodApiResponse[]; total: number }> {
    try {
      const { methods, count } = await this.methodRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' },
      });
      const apiMethods = methods
        .map((m) => this.mapToApiResponse(m))
        .filter(Boolean) as PaymentMethodApiResponse[];
      return { methods: apiMethods, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all payment methods`, error, options },
        'PaymentMethodService.findAll',
      );
      throw new ServerError('Error finding all payment methods.');
    }
  }

  async create(
    input: CreatePaymentMethodInput,
    createdByUserId?: number,
  ): Promise<PaymentMethodApiResponse> {
    const existingMethod = await this.methodRepository.findByName(input.name);
    if (existingMethod) {
      throw new BadRequestError(`Payment method with name '${input.name}' already exists.`);
    }

    const methodEntity = this.methodRepository.create({
      ...input,
      // createdByUserId: createdByUserId, // Si audit
    });

    if (!methodEntity.isValid()) {
      throw new BadRequestError(
        `Payment method data is invalid. Errors: ${paymentMethodValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedMethod = await this.methodRepository.save(methodEntity);

      const apiResponse = this.mapToApiResponse(savedMethod);
      if (!apiResponse)
        throw new ServerError(
          `Failed to map newly created payment method ${savedMethod.id} to API response.`,
        );
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error creating payment method`, error, input },
        'PaymentMethodService.create',
      );
      if (error instanceof BadRequestError) throw error;
      throw new ServerError('Failed to create payment method.');
    }
  }

  async update(
    id: number,
    input: UpdatePaymentMethodInput,
    updatedByUserId?: number,
  ): Promise<PaymentMethodApiResponse> {
    try {
      const method = await this.methodRepository.findById(id);
      if (!method) throw new NotFoundError(`Payment method with id ${id} not found.`);

      if (input.name && input.name !== method.name) {
        const existingMethod = await this.methodRepository.findByName(input.name);
        if (existingMethod && existingMethod.id !== id) {
          throw new BadRequestError(
            `Another payment method with name '${input.name}' already exists.`,
          );
        }
      }

      const tempMethodData = { ...method, ...input };
      const tempMethod = this.methodRepository.create(tempMethodData);
      if (!tempMethod.isValid()) {
        throw new BadRequestError(
          `Updated payment method data is invalid. Errors: ${paymentMethodValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<PaymentMethod> = { ...input };
      // updatePayload.updatedByUserId = updatedByUserId; // Si audit

      if (Object.keys(updatePayload).length === 0) {
        return this.mapToApiResponse(method) as PaymentMethodApiResponse;
      }

      const result = await this.methodRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Payment method with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedMethod = await this.methodRepository.findById(id);
      if (!updatedMethod) throw new ServerError('Failed to re-fetch payment method after update.');

      const apiResponse = this.mapToApiResponse(updatedMethod);
      if (!apiResponse)
        throw new ServerError(`Failed to map updated method ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating payment method ${id}`, error, input },
        'PaymentMethodService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update payment method ${id}.`);
    }
  }

  async delete(id: number, deletedByUserId?: number): Promise<void> {
    try {
      const method = await this.methodRepository.findById(id);
      if (!method) throw new NotFoundError(`Payment method with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si la méthode de paiement est utilisée dans des transactions (Payments table)
      // const isUsed = await this.paymentRepository.count({ where: { paymentMethodId: id } });
      // if (isUsed > 0) {
      //   throw new BadRequestError(`Payment method '${method.name}' is in use and cannot be deleted.`);
      // }
      // Utilisation du placeholder du repository pour l'instant
      const isPaymentMethodInUse = await this.methodRepository.isPaymentMethodInUse(id);
      if (isPaymentMethodInUse) {
        throw new BadRequestError(
          `Payment method '${method.name}' is in use and cannot be deleted.`,
        );
      }

      await this.methodRepository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error deleting payment method ${id}`, error },
        'PaymentMethodService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting payment method ${id}.`);
    }
  }

  static getInstance(): PaymentMethodService {
    if (!instance) {
      instance = new PaymentMethodService();
    }
    return instance;
  }
}
