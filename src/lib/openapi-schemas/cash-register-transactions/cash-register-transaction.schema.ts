import { CashRegisterTransactionType } from '@/modules/cash-register-transactions/models/cash-register-transaction.entity';

const embeddedCashRegisterSessionDtoRef = {
  $ref: '#/components/schemas/CreateCashRegisterTransactionInput',
};
const embeddedPaymentMethodDtoRef = { $ref: '#/components/schemas/CreatePaymentInput' };
const embeddedSalesOrderDtoRef = { $ref: '#/components/schemas/CreateSalesOrderInput' };
const embeddedUserDtoRef = { $ref: '#/components/schemas/UserInput' };

export const cashRegisterTransactionSchemas = {
  CreateCashRegisterTransactionInput: {
    type: 'object',
    required: ['cashRegisterSessionId', 'type', 'amount', 'description'],
    properties: {
      cashRegisterSessionId: {
        type: 'integer',
        description: 'ID of the active cash register session.',
      },
      transactionTimestamp: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Timestamp of the transaction. Defaults to now if not provided.',
      },
      type: {
        type: 'string',
        enum: Object.values(CashRegisterTransactionType),
        example: CashRegisterTransactionType.CASH_OUT_EXPENSE,
        description: 'Type of cash transaction.',
      },
      amount: {
        type: 'number',
        format: 'double',
        minimum: 0.01,
        example: 25.5,
        description: 'Absolute amount of the transaction. Type determines inflow/outflow.',
      },
      description: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        example: 'Achat de fournitures de bureau.',
      },
      paymentMethodId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description:
          'Payment method used, if applicable (e.g., for cash_out_expense if paid from till but by card - less common).',
      },
      relatedSalesOrderId: {
        type: 'integer',
        nullable: true,
        example: 101,
        description: 'ID of the sales order if this transaction is related to a POS sale.',
      },
      userId: {
        type: 'integer',
        description:
          'ID of the user performing/recording the transaction (usually the authenticated user).',
      },
    },
  },
  // No Update DTO as transactions are immutable

  CashRegisterTransactionApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '1', description: 'Transaction ID (BIGINT as string)' },
      cashRegisterSessionId: { type: 'integer' },
      cashRegisterSession: { allOf: [embeddedCashRegisterSessionDtoRef], nullable: true },
      transactionTimestamp: { type: 'string', format: 'date-time', nullable: true },
      type: { type: 'string', enum: Object.values(CashRegisterTransactionType) },
      amount: {
        type: 'number',
        format: 'double',
        description: 'Absolute amount of the transaction.',
      },
      description: { type: 'string' },
      paymentMethodId: { type: 'integer', nullable: true },
      paymentMethod: { allOf: [embeddedPaymentMethodDtoRef], nullable: true },
      relatedSalesOrderId: { type: 'integer', nullable: true },
      relatedSalesOrder: { allOf: [embeddedSalesOrderDtoRef], nullable: true },
      userId: { type: 'integer' },
      user: { allOf: [embeddedUserDtoRef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
