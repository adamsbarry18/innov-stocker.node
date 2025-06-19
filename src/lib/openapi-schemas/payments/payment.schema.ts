import { PaymentDirection } from '@/modules/payments/models/payment.entity';

const embeddedCurrencyDTORef = { $ref: '#/components/schemas/CreateCurrencyInput' };
const embeddedCustomerDTORef = { $ref: '#/components/schemas/CreateCustomerInput' };
const embeddedSupplierDTORef = { $ref: '#/components/schemas/CreateSupplierInput' };
const embeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

export const paymentSchemas = {
  CreatePaymentInput: {
    type: 'object',
    required: ['paymentDate', 'amount', 'currencyId', 'paymentMethodId', 'direction'],
    properties: {
      paymentDate: {
        type: 'string',
        format: 'date',
        example: '2025-07-15',
        description: 'Date the payment was made/received.',
      },
      amount: {
        type: 'number',
        format: 'double',
        minimum: 0.01,
        example: 150.75,
        description: 'Positive amount of the payment.',
      },
      currencyId: {
        type: 'integer',
        example: 1,
        description: 'ID of the currency for the payment amount.',
      },
      paymentMethodId: {
        type: 'integer',
        example: 2,
        description: 'ID of the payment method used.',
      },
      direction: {
        type: 'string',
        enum: Object.values(PaymentDirection),
        example: 'inbound',
        description: "'inbound' for payments received, 'outbound' for payments made.",
      },

      customerId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description:
          'ID of the customer, if applicable (e.g., direct payment not against invoice).',
      },
      supplierId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the supplier, if applicable.',
      },

      customerInvoiceId: {
        type: 'integer',
        nullable: true,
        example: 101,
        description: 'ID of the customer invoice this payment applies to.',
      },
      supplierInvoiceId: {
        type: 'integer',
        nullable: true,
        example: 201,
        description: 'ID of the supplier invoice this payment settles.',
      },
      salesOrderId: {
        type: 'integer',
        nullable: true,
        example: 51,
        description: 'ID of the sales order, for pre-payments or deposits.',
      },
      purchaseOrderId: {
        type: 'integer',
        nullable: true,
        example: 71,
        description: 'ID of the purchase order, for pre-payments or deposits.',
      },

      bankAccountId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description:
          'ID of the bank account affected. Required if cashRegisterSessionId is not set.',
      },
      cashRegisterSessionId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description:
          'ID of the cash register session if payment via POS. Required if bankAccountId is not set.',
      },

      referenceNumber: {
        type: 'string',
        maxLength: 255,
        nullable: true,
        example: 'CHEQUE-12345 / TXN-ABCDEF',
        description: 'Transaction reference, check number, etc.',
      },
      notes: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        example: 'Payment for INV-001 and INV-002.',
      },
    },
    description:
      'One of (bankAccountId or cashRegisterSessionId) must be provided. Also, relevant link (customerId, supplierId, invoiceId, orderId) based on direction must be provided.',
  },
  PaymentApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '1', description: 'Payment ID (BIGINT as string)' },
      paymentDate: { type: 'string', format: 'date-time', nullable: true },
      amount: { type: 'number', format: 'double' },
      currencyId: { type: 'integer' },
      currency: { allOf: [embeddedCurrencyDTORef], nullable: true },
      paymentMethodId: { type: 'integer' },
      paymentMethod: {
        allOf: [{ $ref: '#/components/schemas/CreatePaymentInput' }],
        nullable: true,
      },
      direction: { type: 'string', enum: Object.values(PaymentDirection) },
      customerId: { type: 'integer', nullable: true },
      customer: { allOf: [embeddedCustomerDTORef], nullable: true },
      supplierId: { type: 'integer', nullable: true },
      supplier: { allOf: [embeddedSupplierDTORef], nullable: true },
      customerInvoiceId: { type: 'integer', nullable: true },
      customerInvoice: {
        allOf: [{ $ref: '#/components/schemas/CreateCustomerInvoiceInput' }],
        nullable: true,
      },
      supplierInvoiceId: { type: 'integer', nullable: true },
      supplierInvoice: {
        allOf: [{ $ref: '#/components/schemas/CreateCustomerInvoiceInput' }],
        nullable: true,
      },
      salesOrderId: { type: 'integer', nullable: true },
      salesOrder: {
        allOf: [{ $ref: '#/components/schemas/CreatePurchaseOrderInput' }],
        nullable: true,
      },
      purchaseOrderId: { type: 'integer', nullable: true },
      purchaseOrder: {
        allOf: [{ $ref: '#/components/schemas/CreatePurchaseOrderInput' }],
        nullable: true,
      },
      bankAccountId: { type: 'integer', nullable: true },
      bankAccount: {
        allOf: [{ $ref: '#/components/schemas/CreateBankAccountInput' }],
        nullable: true,
      },
      cashRegisterSessionId: { type: 'integer', nullable: true },
      cashRegisterSession: {
        allOf: [{ $ref: '#/components/schemas/CreateCashRegisterTransactionInput' }],
        nullable: true,
      },
      referenceNumber: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      recordedByUserId: { type: 'integer' },
      recordedByUser: { allOf: [embeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
