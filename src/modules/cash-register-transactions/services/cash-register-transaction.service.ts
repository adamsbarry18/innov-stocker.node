import { appDataSource } from '@/database/data-source';
import { type EntityManager, type FindManyOptions, type FindOptionsWhere } from 'typeorm';

import {
  CashRegisterTransaction,
  type CreateCashRegisterTransactionInput,
  type CashRegisterTransactionApiResponse,
  CashRegisterTransactionType,
  createCashRegisterTransactionSchema,
} from '../models/cash-register-transaction.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { CashRegisterTransactionRepository } from '../data/cash-register-transaction.repository';
import { CashRegisterSessionRepository } from '@/modules/cash-register-sessions/data/cash-register-session.repository';
import { PaymentMethodRepository } from '@/modules/payment-methods/data/payment_method.repository';
import { SalesOrderRepository } from '@/modules/sales-orders/data/sales-order.repository';
import { User, UserRepository } from '@/modules/users';
import { CashRegisterRepository } from '@/modules/cash-registers/data/cash-register.repository';
import {
  CashRegisterSession,
  CashRegisterSessionStatus,
} from '@/modules/cash-register-sessions/models/cash-register-session.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { PaymentMethod } from '@/modules/payment-methods/models/payment-method.entity';
import { type Payment, PaymentDirection } from '@/modules/payments/models/payment.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

interface ValidationContext {
  transactionalEntityManager?: EntityManager;
}

let instance: CashRegisterTransactionService | null = null;

export class CashRegisterTransactionService {
  constructor(
    private readonly transactionRepository: CashRegisterTransactionRepository = new CashRegisterTransactionRepository(),
    private readonly sessionRepository: CashRegisterSessionRepository = new CashRegisterSessionRepository(),
    private readonly paymentMethodRepository: PaymentMethodRepository = new PaymentMethodRepository(),
    private readonly salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly cashRegisterRepository: CashRegisterRepository = new CashRegisterRepository(),
  ) {}

  private mapToApiResponse(
    transaction: CashRegisterTransaction | null,
  ): CashRegisterTransactionApiResponse | null {
    if (!transaction) return null;
    return transaction.toApi();
  }

  /**
   * Validates the input data for creating a cash register transaction.
   * @param input - The input data for the transaction.
   * @param context - The validation context, including the transactional entity manager.
   * @returns The validated cash register session.
   */
  private async validateTransactionInput(
    input: CreateCashRegisterTransactionInput,
    context: ValidationContext,
  ): Promise<CashRegisterSession> {
    const { transactionalEntityManager: manager } = context;

    const validationResult = createCashRegisterTransactionSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid transaction data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    const session = await this.validateSession(validatedInput.cashRegisterSessionId, manager);
    await this.validatePaymentMethod(validatedInput.paymentMethodId ?? null, manager); // Fix: Pass null explicitly
    await this.validateSalesOrder(validatedInput.relatedSalesOrderId ?? null, manager); // Fix: Pass null explicitly

    if (validatedInput.amount <= 0) {
      throw new BadRequestError('Transaction amount must be a positive number.');
    }

    return session;
  }

  /**
   * Validates the cash register session.
   * @param sessionId - The ID of the cash register session.
   * @param manager - The entity manager for transactional operations.
   * @returns The validated CashRegisterSession entity.
   */
  private async validateSession(
    sessionId: number,
    manager?: EntityManager,
  ): Promise<CashRegisterSession> {
    let session;
    if (manager) {
      const repo = manager.getRepository(CashRegisterSession);
      session = await repo.findOne({
        where: { id: sessionId },
        relations: ['cashRegister', 'cashRegister.currency'],
      });
    } else {
      session = await this.sessionRepository.findById(sessionId, {
        relations: ['cashRegister', 'cashRegister.currency'],
      });
    }

    if (!session) {
      throw new NotFoundError(`Cash Register Session ID ${sessionId} not found.`);
    }
    if (session.status !== CashRegisterSessionStatus.OPEN) {
      throw new ForbiddenError(
        `Cash Register Session ${sessionId} is not open. Current status: ${session.status}.`,
      );
    }
    return session;
  }

  /**
   * Validates the payment method ID.
   * @param paymentMethodId - The ID of the payment method.
   * @param manager - The entity manager for transactional operations.
   */
  private async validatePaymentMethod(
    paymentMethodId: number | null | undefined, // Fix: Accept null
    manager?: EntityManager,
  ): Promise<void> {
    if (paymentMethodId) {
      let paymentMethod;
      if (manager) {
        const repo = manager.getRepository(PaymentMethod);
        paymentMethod = await repo.findOneBy({ id: paymentMethodId });
      } else {
        paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
      }
      if (!paymentMethod) {
        throw new BadRequestError(`Payment Method ID ${paymentMethodId} not found.`);
      }
    }
  }

  /**
   * Validates the sales order ID.
   * @param salesOrderId - The ID of the sales order.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSalesOrder(
    salesOrderId: number | null | undefined, // Fix: Accept null
    manager?: EntityManager,
  ): Promise<void> {
    if (salesOrderId) {
      let salesOrder;
      if (manager) {
        const repo = manager.getRepository(SalesOrder);
        salesOrder = await repo.findOneBy({ id: salesOrderId });
      } else {
        salesOrder = await this.salesOrderRepository.findById(salesOrderId);
      }
      if (!salesOrder) {
        throw new BadRequestError(`Sales Order ID ${salesOrderId} not found.`);
      }
    }
  }

  /**
   * Validates a user ID.
   * @param userId - The ID of the user.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateUser(userId: number, manager?: EntityManager): Promise<void> {
    let user;
    if (manager) {
      const repo = manager.getRepository(User);
      user = await repo.findOneBy({ id: userId });
    } else {
      user = await this.userRepository.findById(userId);
    }
    if (!user) {
      throw new BadRequestError(`User with ID ${userId} not found.`);
    }
  }

  private determineAmountSign(type: CashRegisterTransactionType, amount: number): number {
    switch (type) {
      case CashRegisterTransactionType.CASH_IN_POS_SALE:
      case CashRegisterTransactionType.CASH_IN_OTHER:
      case CashRegisterTransactionType.CASH_WITHDRAWAL_FROM_BANK:
      case CashRegisterTransactionType.OPENING_FLOAT:
        return Math.abs(amount);
      case CashRegisterTransactionType.CASH_OUT_EXPENSE:
      case CashRegisterTransactionType.CASH_OUT_OTHER:
      case CashRegisterTransactionType.CASH_DEPOSIT_TO_BANK:
      case CashRegisterTransactionType.CLOSING_REMOVAL:
        return -Math.abs(amount);
      default:
        logger.warn(`Unknown transaction type for amount sign determination: ${type}`);
        return amount; // Or throw error
    }
  }

  /**
   * Creates the cash register transaction entity.
   * @param input - The input data for the transaction.
   * @param manager - The entity manager for transactional operations.
   * @returns The created CashRegisterTransaction entity.
   */
  private async createTransactionEntity(
    input: CreateCashRegisterTransactionInput,
    manager: EntityManager,
  ): Promise<CashRegisterTransaction> {
    const repo = manager.getRepository(CashRegisterTransaction);

    const transactionEntity = repo.create({
      ...input,
      transactionTimestamp: input.transactionTimestamp
        ? dayjs(input.transactionTimestamp).toDate()
        : new Date(),
      amount: Math.abs(input.amount),
    });

    if (!transactionEntity.isValidBasic()) {
      throw new BadRequestError('Internal transaction entity state invalid.');
    }

    const savedTransaction = await repo.save(transactionEntity);
    return savedTransaction;
  }

  /**
   * Updates the cash register balance.
   * @param cashRegisterId - The ID of the cash register.
   * @param amountChange - The amount to change the balance by.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateCashRegisterBalance(
    cashRegisterId: number,
    amountChange: number,
    manager: EntityManager,
  ): Promise<void> {
    // Directly call the updateBalance method on the cashRegisterRepository instance, passing the transactional manager.
    await this.cashRegisterRepository.updateBalance(cashRegisterId, amountChange, manager);
  }

  /**
   * Retrieves a populated cash register transaction response.
   * @param id - The ID of the cash register transaction.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CashRegisterTransactionApiResponse.
   */
  private async getPopulatedTransactionResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<CashRegisterTransactionApiResponse> {
    let transaction;
    if (manager) {
      const repo = manager.getRepository(CashRegisterTransaction);
      transaction = await repo.findOne({
        where: { id },
        relations: this.transactionRepository['getDefaultRelations'](),
      });
    } else {
      transaction = await this.transactionRepository.findById(id, {
        relations: this.transactionRepository['getDefaultRelations'](),
      });
    }

    const apiResponse = this.mapToApiResponse(transaction);
    if (!apiResponse) {
      logger.error(
        `[getPopulatedTransactionResponse] mapToApiResponse returned null for transaction ID ${id}.`,
      );
      throw new ServerError(
        `Failed to map cash register transaction to API response: transaction is null.`,
      );
    }
    return apiResponse;
  }

  async createTransactionFromPayment(
    payment: Payment,
    manager: EntityManager,
  ): Promise<CashRegisterTransactionApiResponse> {
    if (!payment.cashRegisterSessionId) {
      logger.warn(
        `Payment ${payment.id} has no cash register session ID, skipping cash transaction creation.`,
      );
      throw new BadRequestError(
        `Payment ${payment.id} requires a cash register session to create a transaction.`,
      );
    }

    const type =
      payment.direction === PaymentDirection.INBOUND
        ? CashRegisterTransactionType.CASH_IN_POS_SALE
        : CashRegisterTransactionType.CASH_OUT_OTHER;

    let description = `Payment for `;
    if (payment.customerInvoiceId) {
      description += `Invoice #${payment.customerInvoiceId}`;
    } else if (payment.salesOrderId) {
      description += `Sales Order #${payment.salesOrderId}`;
    } else if (payment.customerId) {
      description += `Customer #${payment.customerId}`;
    } else {
      description = 'Payment received';
    }

    const transactionInput: CreateCashRegisterTransactionInput = {
      cashRegisterSessionId: payment.cashRegisterSessionId,
      transactionTimestamp: payment.paymentDate,
      type: type,
      amount: payment.amount,
      description: description,
      paymentMethodId: payment.paymentMethodId,
      relatedSalesOrderId: payment.salesOrderId,
      userId: payment.recordedByUserId,
    };

    const transaction = await this.createTransaction(transactionInput, manager);

    return transaction;
  }

  /**
   * Creates a new cash register transaction.
   * This method is responsible for validating input, saving the transaction,
   * and updating the associated cash register's current balance.
   * It should be called within a database transaction if part of a larger operation (e.g., a Payment).
   * If called directly (e.g. for manual cash in/out), it initiates its own transaction.
   * @param input - The data for creating the cash register transaction.
   * @param transactionalEntityManager - Optional entity manager for transactional operations.
   * @returns The created cash register transaction API response.
   */
  async createTransaction(
    input: CreateCashRegisterTransactionInput,
    transactionalEntityManager?: EntityManager,
  ): Promise<CashRegisterTransactionApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        await this.validateUser(input.userId, manager);
        const session = await this.validateTransactionInput(input, {
          transactionalEntityManager: manager,
        });
        if (!session.cashRegister) {
          throw new ServerError('Cash register not found for the session.');
        }

        const savedTransaction = await this.createTransactionEntity(input, manager);

        const amountChangeForBalance = this.determineAmountSign(
          savedTransaction.type,
          savedTransaction.amount,
        );
        await this.updateCashRegisterBalance(
          session.cashRegisterId,
          amountChangeForBalance,
          manager,
        );

        logger.info(
          `Cash Register Transaction ID ${savedTransaction.id} (Type: ${savedTransaction.type}, Amount: ${savedTransaction.amount}) created for session ${input.cashRegisterSessionId}.`,
        );

        const response = await this.getPopulatedTransactionResponse(savedTransaction.id, manager);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.CREATE,
          EntityType.FINANCIAL_TRANSACTION,
          savedTransaction.id.toString(),
          {
            type: savedTransaction.type,
            amount: savedTransaction.amount,
            sessionId: savedTransaction.cashRegisterSessionId,
          },
        );

        return response;
      } catch (error: any) {
        logger.error(
          `[createTransaction] Erreur lors de la création de la transaction de caisse: ${error.message || JSON.stringify(error)}`,
          { error },
        );
        throw error;
      }
    });
  }

  /**
   * Finds a cash register transaction by its ID.
   * @param id - The ID of the cash register transaction.
   * @param requestingUserId - The ID of the user requesting the transaction.
   * @returns The cash register transaction API response.
   */
  async findTransactionById(id: number): Promise<CashRegisterTransactionApiResponse> {
    try {
      const transaction = await this.transactionRepository.findById(id, {
        relations: this.transactionRepository['getDefaultRelations'](),
      });
      if (!transaction) {
        throw new NotFoundError(`Cash register transaction with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(transaction);
      if (!apiResponse) {
        throw new ServerError(`Failed to map transaction ${id}.`);
      }
      return apiResponse;
    } catch (error: any) {
      logger.error(
        `[findTransactionById] Error finding transaction by id ${id}: ${error.message || JSON.stringify(error)}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * Finds all cash register transactions based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of cash register transaction API responses and the total count.
   */
  async findAllTransactions(options?: {
    limit?: number;
    offset?: number;
    filters?:
      | FindOptionsWhere<CashRegisterTransaction>
      | FindOptionsWhere<CashRegisterTransaction>[];
    sort?: FindManyOptions<CashRegisterTransaction>['order'];
  }): Promise<{ transactions: CashRegisterTransactionApiResponse[]; total: number }> {
    try {
      const { transactions, count } = await this.transactionRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { transactionTimestamp: 'DESC', createdAt: 'DESC' },
        relations: this.transactionRepository['getDefaultRelations'](),
      });
      const apiTransactions = transactions
        .map((t) => this.mapToApiResponse(t))
        .filter(Boolean) as CashRegisterTransactionApiResponse[];
      return { transactions: apiTransactions, total: count };
    } catch (error: any) {
      logger.error(
        `[findAllTransactions] Error finding all transactions: ${error.message ?? JSON.stringify(error)}`,
        { error, options },
      );
      throw new ServerError('Error finding all transactions.');
    }
  }

  static getInstance(): CashRegisterTransactionService {
    instance ??= new CashRegisterTransactionService();

    return instance;
  }
}
