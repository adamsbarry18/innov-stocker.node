import { PaymentDirection } from '@/modules/payments/models/payment.entity';

// Assuming these DTOs are defined globally or imported
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };
const EmbeddedPaymentMethodDTORef = { $ref: '#/components/schemas/EmbeddedPaymentMethodDTO' }; // Define this
const EmbeddedCustomerDTORef = { $ref: '#/components/schemas/EmbeddedCustomerDTO' };
const EmbeddedSupplierDTORef = { $ref: '#/components/schemas/EmbeddedSupplierDTO' };
const EmbeddedInvoiceDTORef = { $ref: '#/components/schemas/EmbeddedInvoiceDTO' }; // Define a generic one
const EmbeddedOrderDTORef = { $ref: '#/components/schemas/EmbeddedOrderDTO' }; // Define a generic one
const EmbeddedBankAccountDTORef = { $ref: '#/components/schemas/EmbeddedBankAccountDTO' }; // Define this
const EmbeddedCashRegisterSessionDTORef = {
  $ref: '#/components/schemas/EmbeddedCashRegisterSessionDTO',
}; // Define this
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

export const paymentSchemas = {
  // Example for EmbeddedPaymentMethodDTO (define globally or import)
  _EmbeddedPaymentMethodDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      type: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'check', 'other'] },
    },
  },
  _EmbeddedBankAccountDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      accountName: { type: 'string' },
      bankName: { type: 'string' },
    },
  },
  _EmbeddedCashRegisterSessionDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      openingTimestamp: { type: 'string', format: 'date-time', nullable: true },
      // Potentially cashRegisterId or cashRegisterName
    },
  },
  _EmbeddedInvoiceDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      invoiceNumber: { type: 'string' },
    },
  },
  _EmbeddedOrderDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      orderNumber: { type: 'string' },
    },
  },

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
  // No UpdatePaymentInput schema as payments are typically immutable.
  PaymentApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '1', description: 'Payment ID (BIGINT as string)' },
      paymentDate: { type: 'string', format: 'date-time', nullable: true },
      amount: { type: 'number', format: 'double' },
      currencyId: { type: 'integer' },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      paymentMethodId: { type: 'integer' },
      paymentMethod: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedPaymentMethodDTO' }],
        nullable: true,
      },
      direction: { type: 'string', enum: Object.values(PaymentDirection) },
      customerId: { type: 'integer', nullable: true },
      customer: { allOf: [EmbeddedCustomerDTORef], nullable: true },
      supplierId: { type: 'integer', nullable: true },
      supplier: { allOf: [EmbeddedSupplierDTORef], nullable: true },
      customerInvoiceId: { type: 'integer', nullable: true },
      customerInvoice: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedInvoiceDTO' }],
        nullable: true,
      },
      supplierInvoiceId: { type: 'integer', nullable: true },
      supplierInvoice: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedInvoiceDTO' }],
        nullable: true,
      },
      salesOrderId: { type: 'integer', nullable: true },
      salesOrder: { allOf: [{ $ref: '#/components/schemas/EmbeddedOrderDTO' }], nullable: true },
      purchaseOrderId: { type: 'integer', nullable: true },
      purchaseOrder: { allOf: [{ $ref: '#/components/schemas/EmbeddedOrderDTO' }], nullable: true },
      bankAccountId: { type: 'integer', nullable: true },
      bankAccount: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedBankAccountDTO' }],
        nullable: true,
      },
      cashRegisterSessionId: { type: 'integer', nullable: true },
      cashRegisterSession: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedCashRegisterSessionDTO' }],
        nullable: true,
      },
      referenceNumber: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      recordedByUserId: { type: 'integer' },
      recordedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};

// N'oubliez pas d'ajouter `paymentSchemas` et les schémas référencés
// à votre configuration OpenAPI globale `components.schemas`.
