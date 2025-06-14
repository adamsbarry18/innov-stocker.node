import { appDataSource } from '@/database/data-source';
import { IsNull, type EntityManager, type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { PaymentRepository } from '../data/payment.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import { PaymentMethodRepository } from '../../payment-methods/data/payment_method.repository';
import { CustomerRepository } from '../../customers/data/customer.repository';
import { SupplierRepository } from '../../suppliers/data/supplier.repository';
import { UserRepository } from '../../users/data/users.repository';

import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';

import { CustomerInvoiceRepository } from '@/modules/customer-invoices/data/customer-invoice.repository';
import { SupplierInvoiceRepository } from '@/modules/supplier-invoices/data/supplier-invoice.repository';
import { SalesOrderRepository } from '@/modules/sales-orders/data/sales-order.repository';
import { PurchaseOrderRepository } from '@/modules/purchase-orders/data/purchase-order.repository';
import { BankAccountRepository } from '@/modules/bank-accounts/data/bank-account.repository';
import { CashRegisterRepository } from '@/modules/cash-registers/data/cash-register.repository';
import { CashRegisterSessionRepository } from '@/modules/cash-register-sessions/data/cash-register-session.repository';

import {
  Payment,
  type CreatePaymentInput,
  type PaymentApiResponse,
  PaymentDirection,
  type CreateRefundPaymentInput,
} from '../models/payment.entity';
import { CustomerReturn } from '@/modules/customer-returns/models/customer-return.entity';

import {
  CustomerInvoice,
  CustomerInvoiceStatus,
} from '@/modules/customer-invoices/models/customer-invoice.entity';
import {
  SupplierInvoice,
  SupplierInvoiceStatus,
} from '@/modules/supplier-invoices/models/supplier-invoice.entity';
import {
  CashRegisterSession,
  CashRegisterSessionStatus,
} from '@/modules/cash-register-sessions/models/cash-register-session.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { PaymentMethod } from '@/modules/payment-methods/models/payment-method.entity';
import { Customer } from '@/modules/customers/models/customer.entity';
import { Supplier } from '@/modules/suppliers/models/supplier.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import { BankAccount } from '@/modules/bank-accounts/models/bank-account.entity';
import { User } from '@/modules/users';
import { CashRegisterTransactionService } from '@/modules/cash-register-transactions/services/cash-register-transaction.service';
import { CustomerInvoiceService } from '@/modules/customer-invoices/services/customer-invoice.service';
import { SupplierInvoiceService } from '@/modules/supplier-invoices/services/supplier-invoice.service';
import { createPaymentSchema } from '../models/payment.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: PaymentService | null = null;

export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository = new PaymentRepository(),
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository(),
    private readonly paymentMethodRepository: PaymentMethodRepository = new PaymentMethodRepository(),
    private readonly customerRepository: CustomerRepository = new CustomerRepository(),
    private readonly supplierRepository: SupplierRepository = new SupplierRepository(),
    private readonly customerInvoiceRepository: CustomerInvoiceRepository = new CustomerInvoiceRepository(),
    private readonly supplierInvoiceRepository: SupplierInvoiceRepository = new SupplierInvoiceRepository(),
    private readonly salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly purchaseOrderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly bankAccountRepository: BankAccountRepository = new BankAccountRepository(),
    private readonly cashRegisterRepository: CashRegisterRepository = new CashRegisterRepository(),
    private readonly cashRegisterSessionRepository: CashRegisterSessionRepository = new CashRegisterSessionRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly cashRegisterTransactionService: CashRegisterTransactionService = CashRegisterTransactionService.getInstance(),
    private readonly customerInvoiceService: CustomerInvoiceService = CustomerInvoiceService.getInstance(),
    private readonly supplierInvoiceService: SupplierInvoiceService = SupplierInvoiceService.getInstance(),
  ) {}

  /**
   * Records a new payment.
   * @param input - The data for creating the payment.
   * @param recordedByUserId - The ID of the user recording the payment.
   * @returns The created payment API response.
   */
  async recordPayment(
    input: CreatePaymentInput,
    recordedByUserId: number,
  ): Promise<PaymentApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      try {
        await this.validatePaymentInput(input, transactionalEntityManager);
        await this.validateUser(recordedByUserId, transactionalEntityManager);

        const paymentEntity = this.paymentRepository.create(
          {
            ...input,
            recordedByUserId,
            paymentDate: dayjs(input.paymentDate).toDate(),
          },
          transactionalEntityManager,
        );
        const savedPayment = await this.paymentRepository.save(
          paymentEntity,
          transactionalEntityManager,
        );

        await this.applyPaymentToInvoices(
          savedPayment,
          recordedByUserId,
          transactionalEntityManager,
        );

        await this.updateFinancialAccountBalances(savedPayment, transactionalEntityManager);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.CREATE,
          EntityType.FINANCIAL_TRANSACTION,
          savedPayment.id.toString(),
          {
            amount: savedPayment.amount,
            direction: savedPayment.direction,
            paymentMethod: savedPayment.paymentMethod?.name,
          },
        );

        return this.mapToApiResponse(savedPayment) as PaymentApiResponse;
      } catch (error: any) {
        logger.error(
          `[recordPayment] Error recording payment: ${error.message ?? JSON.stringify(error)}`,
          { error },
        );
        throw error;
      }
    });
  }

  /**
   * Finds a payment by its ID.
   * @param id - The ID of the payment.
   * @returns The payment API response.
   */
  async findPaymentById(id: number): Promise<PaymentApiResponse> {
    try {
      const payment = await this.paymentRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
      if (!payment) {
        throw new NotFoundError(`Payment with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(payment);
      if (!apiResponse) {
        throw new ServerError(`Failed to map payment ${id}.`);
      }
      return apiResponse;
    } catch (error: any) {
      logger.error(
        `[findPaymentById] Error finding payment by id ${id}: ${error.message ?? JSON.stringify(error)}`,
        { id },
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding payment by id ${id}.`);
    }
  }

  /**
   * Finds all payments based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of payment API responses and the total count.
   */
  async findAllPayments(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Payment> | FindOptionsWhere<Payment>[];
    sort?: FindManyOptions<Payment>['order'];
  }): Promise<{ payments: PaymentApiResponse[]; total: number }> {
    try {
      const { payments, count } = await this.paymentRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { paymentDate: 'DESC', createdAt: 'DESC' },
        relations: this.getDetailedRelations(),
      });
      const apiPayments = payments
        .map((p) => this.mapToApiResponse(p))
        .filter(Boolean) as PaymentApiResponse[];
      return { payments: apiPayments, total: count };
    } catch (error: any) {
      logger.error(
        `[findAllPayments] Error finding all payments: ${error.message ?? JSON.stringify(error)}`,
        { options },
      );
      throw new ServerError('Error finding all payments.');
    }
  }

  /**
   * Deletes a payment (soft delete and reversal of financial impacts).
   * @param id - The ID of the payment to delete.
   * @param deletedByUserId - The ID of the user deleting the payment.
   */
  async deletePayment(id: number, deletedByUserId: number): Promise<void> {
    logger.warn(`Attempting to delete/reverse payment ID ${id}. This is a sensitive operation.`);

    return appDataSource.transaction(async (manager) => {
      try {
        const payment = await this.getExistingPayment(id, manager);

        await this.reversePaymentOnInvoices(payment, deletedByUserId, manager);

        await this.reverseFinancialAccountBalances(payment, manager);

        await manager.getRepository(Payment).softDelete(id);
        await manager.getRepository(Payment).update(id, {
          notes: `[REVERSED by User ${deletedByUserId} on ${dayjs().toISOString()}] ${payment.notes ?? ''}`,
          deletedAt: new Date(),
        });

        logger.info(
          `Payment ID ${id} (Amount: ${payment.amount}) soft-deleted/reversed by user ${deletedByUserId}.`,
        );

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.DELETE,
          EntityType.FINANCIAL_TRANSACTION,
          id.toString(),
          {
            amount: payment.amount,
            direction: payment.direction,
            paymentMethod: payment.paymentMethod?.name,
          },
        );
      } catch (error: any) {
        logger.error(
          `[deletePayment] Error deleting/reversing payment ${id}: ${error.message ?? JSON.stringify(error)}`,
          { id },
        );
        if (
          error instanceof BadRequestError ||
          error instanceof NotFoundError ||
          error instanceof ForbiddenError
        ) {
          throw error;
        }
        throw new ServerError(`Error deleting payment ${id}.`);
      }
    });
  }

  /**
   * Creates a refund payment for a customer return.
   * This method is specifically for refunds originating from customer returns.
   * @param input - The refund payment input data.
   * @param manager - The entity manager for transactional operations.
   * @returns The created payment API response.
   */
  async createRefundPayment(
    input: CreateRefundPaymentInput,
    manager: EntityManager,
  ): Promise<PaymentApiResponse> {
    if (input.relatedReturnId === null || input.relatedReturnId === undefined) {
      throw new BadRequestError('Related Return ID is required for refund payment.');
    }

    await this.validateCustomer(input.customerId, manager);
    const customerReturn = await manager
      .getRepository(CustomerReturn)
      .findOneBy({ id: input.relatedReturnId, deletedAt: IsNull() });
    if (!customerReturn) {
      throw new BadRequestError(`Customer Return with ID ${input.relatedReturnId} not found.`);
    }

    const defaultCurrencyId = input.currencyId ?? 1;
    const defaultPaymentMethodId = input.paymentMethodId ?? 1;
    const defaultBankAccountId = input.bankAccountId ?? 1;
    const defaultCashRegisterSessionId = input.cashRegisterSessionId ?? null;

    const paymentInput: CreatePaymentInput = {
      paymentDate: new Date(),
      amount: input.amount,
      currencyId: defaultCurrencyId,
      paymentMethodId: defaultPaymentMethodId,
      direction: PaymentDirection.OUTBOUND,
      customerId: input.customerId,
      relatedReturnId: input.relatedReturnId,
      bankAccountId: defaultBankAccountId,
      cashRegisterSessionId: defaultCashRegisterSessionId,
      notes: input.notes ?? `Refund for Customer Return ID: ${input.relatedReturnId}`,
    };

    try {
      await this.validatePaymentInput(paymentInput, manager);

      const recordedByUserId = customerReturn.updatedByUserId ?? 1;

      const paymentEntity = manager.getRepository(Payment).create({
        ...paymentInput,
        recordedByUserId: recordedByUserId,
      });
      const savedPayment = await manager.getRepository(Payment).save(paymentEntity);

      await this.updateFinancialAccountBalances(savedPayment, manager);

      logger.info(
        `Refund payment created for Customer Return ID ${input.relatedReturnId}. Payment ID: ${savedPayment.id}`,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.FINANCIAL_TRANSACTION,
        savedPayment.id.toString(),
        { amount: savedPayment.amount, relatedReturnId: savedPayment.relatedReturnId },
      );

      return this.mapToApiResponse(savedPayment) as PaymentApiResponse;
    } catch (error: any) {
      logger.error(
        `[createRefundPayment] Error creating refund payment for return ${input.relatedReturnId}: ${error.message ?? JSON.stringify(error)}`,
        { error },
      );
      throw error;
    }
  }

  /**
   * Validates the input data for creating a payment.
   * @param input - The input data for the payment.
   * @param context - The validation context, including the transactional entity manager.
   */
  private async validatePaymentInput(
    input: CreatePaymentInput,
    manager: EntityManager,
  ): Promise<void> {
    const validationResult = createPaymentSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid payment data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    await this.validateCurrency(validatedInput.currencyId, manager);
    await this.validatePaymentMethod(validatedInput.paymentMethodId, manager);

    if (validatedInput.customerId) {
      await this.validateCustomer(validatedInput.customerId, manager);
    }
    if (validatedInput.supplierId) {
      await this.validateSupplier(validatedInput.supplierId, manager);
    }

    if (validatedInput.customerInvoiceId) {
      await this.validateCustomerInvoice(
        validatedInput.customerInvoiceId,
        validatedInput.currencyId,
        manager,
      );
    }
    if (validatedInput.supplierInvoiceId) {
      await this.validateSupplierInvoice(
        validatedInput.supplierInvoiceId,
        validatedInput.currencyId,
        manager,
      );
    }

    if (validatedInput.salesOrderId) {
      await this.validateSalesOrder(validatedInput.salesOrderId, manager);
    }
    if (validatedInput.purchaseOrderId) {
      await this.validatePurchaseOrder(validatedInput.purchaseOrderId, manager);
    }

    if (validatedInput.bankAccountId) {
      await this.validateBankAccount(validatedInput.bankAccountId, manager);
    }
    if (validatedInput.cashRegisterSessionId) {
      await this.validateCashRegisterSession(
        validatedInput.cashRegisterSessionId,
        validatedInput.currencyId,
        validatedInput.direction,
        manager,
      );
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
      user = await repo.findOneBy({ id: userId, deletedAt: IsNull() });
    } else {
      user = await this.userRepository.findById(userId);
    }
    if (!user) {
      throw new BadRequestError(`User with ID ${userId} not found.`);
    }
  }

  /**
   * Validates the currency ID.
   * @param currencyId - The ID of the currency.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCurrency(currencyId: number, manager?: EntityManager): Promise<void> {
    let currency;
    if (manager) {
      const repo = manager.getRepository(Currency);
      currency = await repo.findOneBy({ id: currencyId, isActive: true, deletedAt: IsNull() });
    } else {
      currency = await this.currencyRepository.findById(currencyId);
      if (currency && !currency.isActive) {
        currency = null;
      }
    }
    if (!currency) {
      throw new BadRequestError(`Active currency with ID ${currencyId} not found.`);
    }
  }

  /**
   * Validates the payment method ID.
   * @param paymentMethodId - The ID of the payment method.
   * @param manager - The entity manager for transactional operations.
   */
  private async validatePaymentMethod(
    paymentMethodId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let paymentMethod;
    if (manager) {
      const repo = manager.getRepository(PaymentMethod);
      paymentMethod = await repo.findOneBy({
        id: paymentMethodId,
        isActive: true,
        deletedAt: IsNull(),
      });
    } else {
      paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);
      if (paymentMethod && !paymentMethod.isActive) {
        paymentMethod = null;
      }
    }
    if (!paymentMethod) {
      throw new BadRequestError(`Active payment method with ID ${paymentMethodId} not found.`);
    }
  }

  /**
   * Validates the customer ID.
   * @param customerId - The ID of the customer.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCustomer(
    customerId: number | null | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    if (customerId === null || customerId === undefined) {
      return;
    }
    let customer;
    if (manager) {
      const repo = manager.getRepository(Customer);
      customer = await repo.findOneBy({ id: customerId, deletedAt: IsNull() });
    } else {
      customer = await this.customerRepository.findById(customerId);
    }
    if (!customer) {
      throw new BadRequestError(`Customer with ID ${customerId} not found.`);
    }
  }

  /**
   * Validates the supplier ID.
   * @param supplierId - The ID of the supplier.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSupplier(supplierId: number, manager?: EntityManager): Promise<void> {
    let supplier;
    if (manager) {
      const repo = manager.getRepository(Supplier);
      supplier = await repo.findOneBy({ id: supplierId, deletedAt: IsNull() });
    } else {
      supplier = await this.supplierRepository.findById(supplierId);
    }
    if (!supplier) {
      throw new BadRequestError(`Supplier with ID ${supplierId} not found.`);
    }
  }

  /**
   * Validates a customer invoice.
   * @param invoiceId - The ID of the customer invoice.
   * @param paymentCurrencyId - The currency ID of the payment.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCustomerInvoice(
    invoiceId: number,
    paymentCurrencyId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let invoice;
    if (manager) {
      const repo = manager.getRepository(CustomerInvoice);
      invoice = await repo.findOneBy({ id: invoiceId, deletedAt: IsNull() });
    } else {
      invoice = await this.customerInvoiceRepository.findById(invoiceId);
    }
    if (!invoice) {
      throw new BadRequestError(`Customer Invoice ID ${invoiceId} not found.`);
    }
    if (
      invoice.status === CustomerInvoiceStatus.PAID ||
      invoice.status === CustomerInvoiceStatus.VOIDED ||
      invoice.status === CustomerInvoiceStatus.CANCELLED
    ) {
      throw new BadRequestError(
        `Customer Invoice ${invoice.invoiceNumber} is already ${invoice.status} and cannot receive further payments.`,
      );
    }
    if (invoice.currencyId !== paymentCurrencyId) {
      throw new BadRequestError(
        `Payment currency (ID ${paymentCurrencyId}) does not match invoice currency (ID ${invoice.currencyId}).`,
      );
    }
  }

  /**
   * Validates a supplier invoice.
   * @param invoiceId - The ID of the supplier invoice.
   * @param paymentCurrencyId - The currency ID of the payment.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSupplierInvoice(
    invoiceId: number,
    paymentCurrencyId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let invoice;
    if (manager) {
      const repo = manager.getRepository(SupplierInvoice);
      invoice = await repo.findOneBy({ id: invoiceId, deletedAt: IsNull() });
    } else {
      invoice = await this.supplierInvoiceRepository.findById(invoiceId);
    }
    if (!invoice) {
      throw new BadRequestError(`Supplier Invoice ID ${invoiceId} not found.`);
    }
    if (
      invoice.status === SupplierInvoiceStatus.PAID ||
      invoice.status === SupplierInvoiceStatus.CANCELLED
    ) {
      throw new BadRequestError(
        `Supplier Invoice ${invoice.invoiceNumber} is already ${invoice.status} and cannot be paid further.`,
      );
    }
    if (invoice.currencyId !== paymentCurrencyId) {
      throw new BadRequestError(
        `Payment currency (ID ${paymentCurrencyId}) does not match invoice currency (ID ${invoice.currencyId}).`,
      );
    }
  }

  /**
   * Validates a sales order.
   * @param salesOrderId - The ID of the sales order.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSalesOrder(salesOrderId: number, manager?: EntityManager): Promise<void> {
    let salesOrder;
    if (manager) {
      const repo = manager.getRepository(SalesOrder);
      salesOrder = await repo.findOneBy({ id: salesOrderId, deletedAt: IsNull() });
    } else {
      salesOrder = await this.salesOrderRepository.findById(salesOrderId);
    }
    if (!salesOrder) {
      throw new BadRequestError(`Sales Order ID ${salesOrderId} not found.`);
    }
  }

  /**
   * Validates a purchase order.
   * @param purchaseOrderId - The ID of the purchase order.
   * @param manager - The entity manager for transactional operations.
   */
  private async validatePurchaseOrder(
    purchaseOrderId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let purchaseOrder;
    if (manager) {
      const repo = manager.getRepository(PurchaseOrder);
      purchaseOrder = await repo.findOneBy({ id: purchaseOrderId, deletedAt: IsNull() });
    } else {
      purchaseOrder = await this.purchaseOrderRepository.findById(purchaseOrderId);
    }
    if (!purchaseOrder) {
      throw new BadRequestError(`Purchase Order ID ${purchaseOrderId} not found.`);
    }
  }

  /**
   * Validates a bank account.
   * @param bankAccountId - The ID of the bank account.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateBankAccount(bankAccountId: number, manager?: EntityManager): Promise<void> {
    let bankAccount;
    if (manager) {
      const repo = manager.getRepository(BankAccount);
      bankAccount = await repo.findOneBy({ id: bankAccountId, deletedAt: IsNull() });
    } else {
      bankAccount = await this.bankAccountRepository.findById(bankAccountId);
    }
    if (!bankAccount) {
      throw new BadRequestError(`Bank Account ID ${bankAccountId} not found.`);
    }
  }

  /**
   * Validates a cash register session.
   * @param sessionId - The ID of the cash register session.
   * @param paymentCurrencyId - The currency ID of the payment.
   * @param paymentDirection - The direction of the payment (inbound/outbound).
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCashRegisterSession(
    sessionId: number,
    paymentCurrencyId: number,
    paymentDirection: PaymentDirection,
    manager?: EntityManager,
  ): Promise<void> {
    let session;
    if (manager) {
      const repo = manager.getRepository(CashRegisterSession);
      session = await repo.findOne({
        where: { id: sessionId, deletedAt: IsNull() },
        relations: ['cashRegister', 'cashRegister.currency'],
      });
    } else {
      session = await this.cashRegisterSessionRepository.findById(sessionId, {
        relations: ['cashRegister', 'cashRegister.currency'],
      });
    }

    if (!session) {
      throw new BadRequestError(`Cash Register Session ID ${sessionId} not found.`);
    }
    if (session.status !== CashRegisterSessionStatus.OPEN) {
      throw new BadRequestError(`Cash Register Session ID ${sessionId} is not open.`);
    }
    if (
      session.cashRegister?.currencyId !== paymentCurrencyId &&
      paymentDirection === PaymentDirection.INBOUND
    ) {
      throw new BadRequestError(
        `Payment currency (ID: ${paymentCurrencyId}) must match cash register currency (ID: ${session.cashRegister?.currencyId}) for inbound cash payments.`,
      );
    }
  }

  /**
   * Applies payment to linked invoices.
   */
  private async applyPaymentToInvoices(
    payment: Payment,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (payment.customerInvoiceId) {
      await this.customerInvoiceService.updatePaymentStatus(
        payment.customerInvoiceId,
        payment.amount,
        userId,
        manager,
      );
    }
    if (payment.supplierInvoiceId) {
      await this.supplierInvoiceService.updatePaymentStatus(
        payment.supplierInvoiceId,
        payment.amount,
        userId,
        manager,
      );
    }
  }

  /**
   * Updates financial account balances (bank or cash register) and creates a cash register transaction if applicable.
   */
  private async updateFinancialAccountBalances(
    payment: Payment,
    manager: EntityManager,
  ): Promise<void> {
    const amountForBalanceUpdate =
      payment.direction === PaymentDirection.INBOUND
        ? Number(payment.amount)
        : -Math.abs(Number(payment.amount));

    if (payment.bankAccountId) {
      await this.bankAccountRepository.updateBalance(
        payment.bankAccountId,
        amountForBalanceUpdate,
        manager,
      );
    } else if (payment.cashRegisterSessionId) {
      const session = await manager
        .getRepository(CashRegisterSession)
        .findOne({ where: { id: payment.cashRegisterSessionId }, relations: ['cashRegister'] });
      if (session?.cashRegister) {
        await this.cashRegisterRepository.updateBalance(
          session.cashRegister.id,
          amountForBalanceUpdate,
          manager,
        );

        await this.cashRegisterTransactionService.createTransactionFromPayment(payment, manager);
      } else {
        logger.error(
          `Cash register or session not found for payment ${payment.id} during balance update. This should ideally not happen if validatePaymentInput passed.`,
        );
      }
    }
  }

  /**
   * Reverses payment impact on linked invoices.
   */
  private async reversePaymentOnInvoices(
    payment: Payment,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const reversalAmount = -Math.abs(Number(payment.amount));
    if (payment.customerInvoiceId) {
      await this.customerInvoiceService.updatePaymentStatus(
        payment.customerInvoiceId,
        reversalAmount,
        userId,
        manager,
      );
    }
    if (payment.supplierInvoiceId) {
      await this.supplierInvoiceService.updatePaymentStatus(
        payment.supplierInvoiceId,
        reversalAmount,
        userId,
        manager,
      );
    }
  }

  /**
   * Reverses financial account balances.
   */
  private async reverseFinancialAccountBalances(
    payment: Payment,
    manager: EntityManager,
  ): Promise<void> {
    const amountToReverse =
      payment.direction === PaymentDirection.INBOUND
        ? -Math.abs(Number(payment.amount))
        : Math.abs(Number(payment.amount));
    if (payment.bankAccountId) {
      await this.bankAccountRepository.updateBalance(
        payment.bankAccountId,
        amountToReverse,
        manager,
      );
    } else if (payment.cashRegisterSessionId && payment.cashRegisterSession?.cashRegisterId) {
      await this.cashRegisterRepository.updateBalance(
        payment.cashRegisterSession.cashRegisterId,
        amountToReverse,
        manager,
      );
    } else {
      logger.error(
        `Cash register or session not found for payment ${payment.id} during balance reversal. This should ideally not happen if validatePaymentInput passed.`,
      );
    }
  }

  /**
   * Maps a Payment entity to a PaymentApiResponse.
   * @param payment - The Payment entity.
   * @returns The mapped PaymentApiResponse or null if the input payment is null.
   */
  private mapToApiResponse(payment: Payment | null): PaymentApiResponse | null {
    if (!payment) {
      return null;
    }
    return payment.toApi();
  }

  /**
   * Returns an array of relations to be loaded with a payment for detailed responses.
   * @returns An array of relation strings.
   */
  private getDetailedRelations(): string[] {
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
      'cashRegisterSession.cashRegister',
      'cashRegisterSession.cashRegister.currency',
      'recordedByUser',
    ];
  }

  /**
   * Retrieves an existing payment by ID.
   * @param id - The ID of the payment.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The Payment entity.
   */
  private async getExistingPayment(id: number, manager?: EntityManager): Promise<Payment> {
    let payment;
    if (manager) {
      const repo = manager.getRepository(Payment);
      payment = await repo.findOne({
        where: { id },
        relations: this.getDetailedRelations(),
      });
    } else {
      payment = await this.paymentRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
    }

    if (!payment) {
      throw new NotFoundError(`Payment with id ${id} not found.`);
    }
    return payment;
  }

  /**
   * Returns a singleton instance of PaymentService.
   * @returns The singleton instance of PaymentService.
   */
  static getInstance(): PaymentService {
    instance ??= new PaymentService();

    return instance;
  }
}
