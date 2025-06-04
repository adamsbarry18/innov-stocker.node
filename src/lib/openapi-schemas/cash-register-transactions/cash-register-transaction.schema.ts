import { CashRegisterTransactionType } from '@/modules/cash-register-transactions/models/cash-register-transaction.entity';

// Assuming these are defined globally or imported
const EmbeddedCashRegisterSessionDTORef = {
  $ref: '#/components/schemas/EmbeddedCashRegisterSessionDTO',
};
const EmbeddedPaymentMethodDTORef = { $ref: '#/components/schemas/EmbeddedPaymentMethodDTO' };
const EmbeddedSalesOrderDTORef = { $ref: '#/components/schemas/EmbeddedSalesOrderDTO' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

export const cashRegisterTransactionSchemas = {
  CreateCashRegisterTransactionInput: {
    type: 'object',
    required: ['cashRegisterSessionId', 'type', 'amount', 'description'], // userId is from authenticated user
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
      cashRegisterSession: { allOf: [EmbeddedCashRegisterSessionDTORef], nullable: true },
      transactionTimestamp: { type: 'string', format: 'date-time', nullable: true },
      type: { type: 'string', enum: Object.values(CashRegisterTransactionType) },
      amount: {
        type: 'number',
        format: 'double',
        description: 'Absolute amount of the transaction.',
      },
      description: { type: 'string' },
      paymentMethodId: { type: 'integer', nullable: true },
      paymentMethod: { allOf: [EmbeddedPaymentMethodDTORef], nullable: true },
      relatedSalesOrderId: { type: 'integer', nullable: true },
      relatedSalesOrder: { allOf: [EmbeddedSalesOrderDTORef], nullable: true },
      userId: { type: 'integer' },
      user: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      // updatedAt: { type: 'string', format: 'date-time', nullable: true }, // Less relevant
    },
  },
};
