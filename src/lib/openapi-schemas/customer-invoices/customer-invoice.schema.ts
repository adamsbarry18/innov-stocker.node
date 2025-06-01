import { CustomerInvoiceStatus } from '@/modules/customer-invoices/models/customer-invoice.entity';

// Assuming these are defined globally or imported
const EmbeddedCustomerDTORef = { $ref: '#/components/schemas/EmbeddedCustomerDTO' };
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };
const EmbeddedSalesOrderDTORef = { $ref: '#/components/schemas/EmbeddedSalesOrderDTO' }; // Define this

const CreateCustomerInvoiceItemInputSchema = {
  type: 'object',
  required: ['description', 'quantity', 'unitPriceHt'], // productId is optional if description is very specific
  properties: {
    productId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product, if invoicing a standard product.',
    },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      example: 'Service de Consultation - Projet X',
    },
    quantity: { type: 'number', format: 'double', minimum: 0.001, example: 10 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0, example: 75.0 },
    discountPercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      default: 0,
      example: 0.0,
    },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
      example: 20.0,
    },
    salesOrderItemId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the original Sales Order Item, for linking.',
    },
    deliveryItemId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the Delivery Item being invoiced, for linking.',
    },
  },
};

const UpdateCustomerInvoiceItemInputSchema = {
  type: 'object',
  properties: {
    // Product/Variant/Source links are not changed on an existing invoice line
    description: { type: 'string', minLength: 1, maxLength: 1000 },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    discountPercentage: { type: 'number', format: 'float', minimum: 0, maximum: 100 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
  },
  description: 'At least one field should be provided for update.',
};

const CustomerInvoiceItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    customerInvoiceId: { type: 'integer' },
    productId: { type: 'integer', nullable: true },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    description: { type: 'string' },
    quantity: { type: 'number', format: 'double' },
    unitPriceHt: { type: 'number', format: 'double' },
    discountPercentage: { type: 'number', format: 'float' },
    vatRatePercentage: { type: 'number', format: 'float', nullable: true },
    totalLineAmountHt: { type: 'number', format: 'double' },
    salesOrderItemId: { type: 'integer', nullable: true },
    deliveryItemId: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const UpdateCustomerInvoiceItemsArrayInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID of existing item to update. Omit for new items.' },
    // All fields from CreateCustomerInvoiceItemInput can be here for new/updated items
    productId: { type: 'integer', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    description: { type: 'string', minLength: 1, maxLength: 1000 },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    discountPercentage: { type: 'number', format: 'float', minimum: 0, maximum: 100 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
    salesOrderItemId: { type: 'integer', nullable: true },
    deliveryItemId: { type: 'integer', nullable: true },
    _delete: { type: 'boolean', description: 'Set to true to mark this item for deletion.' },
  },
};

export const customerInvoiceSchemas = {
  CreateCustomerInvoiceItemInput: CreateCustomerInvoiceItemInputSchema,
  UpdateCustomerInvoiceItemInput: UpdateCustomerInvoiceItemInputSchema,
  CustomerInvoiceItemApiResponse: CustomerInvoiceItemApiResponseSchema,

  CreateCustomerInvoiceInput: {
    type: 'object',
    required: ['customerId', 'invoiceDate', 'currencyId', 'billingAddressId', 'items'],
    properties: {
      customerId: { type: 'integer', example: 1 },
      invoiceDate: { type: 'string', format: 'date', example: '2025-07-10' },
      dueDate: { type: 'string', format: 'date', nullable: true, example: '2025-08-09' },
      currencyId: { type: 'integer', example: 1 },
      status: {
        type: 'string',
        enum: Object.values(CustomerInvoiceStatus),
        default: 'draft',
        example: 'draft',
      },
      billingAddressId: { type: 'integer', example: 4, description: 'ID of the billing address.' },
      shippingAddressId: {
        type: 'integer',
        nullable: true,
        example: 5,
        description: 'ID of the shipping address (if different from billing or for reference).',
      },
      notes: { type: 'string', nullable: true, example: 'Facture pour services rendus.' },
      termsAndConditions: { type: 'string', nullable: true, example: 'Paiement sous 30 jours.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateCustomerInvoiceItemInput' },
        minItems: 1,
      },
      salesOrderIds: {
        type: 'array',
        items: { type: 'integer' },
        nullable: true,
        example: [101, 102],
        description: 'Array of Sales Order IDs this invoice relates to.',
      },
      // deliveryIds: { type: 'array', items: { type: 'integer' }, nullable: true, description: 'IDs of deliveries covered by this invoice.'}
    },
  },
  UpdateCustomerInvoiceInput: {
    type: 'object',
    properties: {
      invoiceDate: { type: 'string', format: 'date' },
      dueDate: { type: 'string', format: 'date', nullable: true },
      currencyId: { type: 'integer' }, // Changing currency of an existing invoice can be complex
      status: { type: 'string', enum: Object.values(CustomerInvoiceStatus) }, // Best managed via PATCH /status
      billingAddressId: { type: 'integer' },
      shippingAddressId: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
      termsAndConditions: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: UpdateCustomerInvoiceItemsArrayInputSchema,
        description:
          'Array of items. For updates, include item ID. For new items, omit ID. To delete, include ID and _delete:true. (Allowed only if DRAFT)',
      },
      salesOrderIds: {
        // To update linked Sales Orders
        type: 'array',
        items: { type: 'integer' },
        nullable: true,
      },
    },
  },
  // Define EmbeddedSalesOrderDTO if not globally available
  _EmbeddedSalesOrderDTO_example: {
    type: 'object',
    properties: {
      salesOrderId: { type: 'integer', example: 101 },
      salesOrderNumber: { type: 'string', example: 'SO-20250701-001', nullable: true },
    },
  },
  CustomerInvoiceApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      invoiceNumber: { type: 'string', example: 'INV-CUST-202507-0001' },
      customerId: { type: 'integer', example: 1 },
      customer: { allOf: [EmbeddedCustomerDTORef], nullable: true },
      invoiceDate: { type: 'string', format: 'date-time', nullable: true },
      dueDate: { type: 'string', format: 'date-time', nullable: true },
      currencyId: { type: 'integer', example: 1 },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      totalAmountHt: { type: 'number', format: 'double' },
      totalVatAmount: { type: 'number', format: 'double' },
      totalAmountTtc: { type: 'number', format: 'double' },
      amountPaid: { type: 'number', format: 'double', default: 0.0 },
      status: { type: 'string', enum: Object.values(CustomerInvoiceStatus), example: 'sent' },
      billingAddressId: { type: 'integer' },
      billingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      shippingAddressId: { type: 'integer', nullable: true },
      shippingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      notes: { type: 'string', nullable: true },
      termsAndConditions: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CustomerInvoiceItemApiResponse' },
        nullable: true,
      },
      salesOrderLinks: {
        type: 'array',
        items: { $ref: '#/components/schemas/_EmbeddedSalesOrderDTO_example' }, // Use the example or the actual reference
        nullable: true,
      },
      createdByUserId: { type: 'integer', nullable: true },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
