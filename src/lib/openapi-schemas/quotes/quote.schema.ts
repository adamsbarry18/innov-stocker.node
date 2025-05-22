import { QuoteStatus } from '../../../modules/quotes/models/quote.entity';

// Références (supposons qu'ils sont définis globalement ou importés)
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCustomerDTORef = { $ref: '#/components/schemas/EmbeddedCustomerDTO' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };
const ProductApiResponseRef = { $ref: '#/components/schemas/ProductApiResponse' };
const ProductVariantApiResponseRef = { $ref: '#/components/schemas/ProductVariantApiResponse' };

// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateQuoteItemInputSchema = {
  type: 'object',
  required: ['productId', 'quantity', 'unitPriceHt'],
  properties: {
    productId: { type: 'integer', description: 'ID of the product.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    description: {
      type: 'string',
      maxLength: 1000,
      nullable: true,
      description: 'Custom description for this line item, overrides product/variant name.',
    },
    quantity: { type: 'number', format: 'double', minimum: 0.001, example: 2 },
    unitPriceHt: {
      type: 'number',
      format: 'double',
      minimum: 0,
      example: 99.99,
      description: 'Price per unit before tax and discount.',
    },
    discountPercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      default: 0,
      example: 10.0,
    },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
      example: 20.0,
      description: 'Specific VAT rate for this item, if different from default.',
    },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateQuoteItemInputSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'integer',
      description: 'ID of the existing quote item to update. Omit for new items.',
    },
    productId: { type: 'integer', description: 'ID of the product.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    description: { type: 'string', maxLength: 1000, nullable: true },
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
    _delete: {
      type: 'boolean',
      description: 'Set to true to mark this item for deletion during quote update.',
    }, // Custom flag for deletion
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const QuoteItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    quoteId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    quantity: { type: 'number', format: 'double' },
    unitPriceHt: { type: 'number', format: 'double' },
    discountPercentage: { type: 'number', format: 'float' },
    vatRatePercentage: { type: 'number', format: 'float', nullable: true },
    totalLineAmountHt: { type: 'number', format: 'double' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const quoteSchemas = {
  CreateQuoteItemInput: CreateQuoteItemInputSchema,
  UpdateQuoteItemInput: UpdateQuoteItemInputSchema,
  QuoteItemApiResponse: QuoteItemApiResponseSchema,

  CreateQuoteInput: {
    type: 'object',
    required: ['customerId', 'issueDate', 'currencyId', 'billingAddressId', 'items'],
    properties: {
      customerId: { type: 'integer', example: 1 },
      issueDate: { type: 'string', format: 'date', example: '2025-06-01' },
      expiryDate: { type: 'string', format: 'date', nullable: true, example: '2025-07-01' },
      status: {
        type: 'string',
        enum: Object.values(QuoteStatus),
        default: 'draft',
        example: 'draft',
      },
      currencyId: { type: 'integer', example: 1 },
      shippingAddressId: { type: 'integer', nullable: true, example: 5 },
      billingAddressId: { type: 'integer', example: 4 },
      notes: { type: 'string', nullable: true, example: 'Devis urgent.' },
      termsAndConditions: { type: 'string', nullable: true, example: 'Paiement à 30 jours net.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateQuoteItemInput' },
        minItems: 1,
      },
    },
  },
  UpdateQuoteInput: {
    type: 'object',
    properties: {
      // All fields optional, customerId not updatable
      issueDate: { type: 'string', format: 'date' },
      expiryDate: { type: 'string', format: 'date', nullable: true },
      status: { type: 'string', enum: Object.values(QuoteStatus) },
      currencyId: { type: 'integer' },
      shippingAddressId: { type: 'integer', nullable: true },
      billingAddressId: { type: 'integer' },
      notes: { type: 'string', nullable: true },
      termsAndConditions: { type: 'string', nullable: true },
      items: {
        // Allows adding new, updating existing, or marking for deletion
        type: 'array',
        items: { $ref: '#/components/schemas/UpdateQuoteItemInput' },
      },
    },
  },
  QuoteApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      quoteNumber: { type: 'string', example: 'QT-20250601-0001' },
      customerId: { type: 'integer', example: 1 },
      customer: { allOf: [EmbeddedCustomerDTORef], nullable: true },
      issueDate: { type: 'string', format: 'date-time', nullable: true },
      expiryDate: { type: 'string', format: 'date-time', nullable: true },
      status: { type: 'string', enum: Object.values(QuoteStatus), example: 'sent' },
      currencyId: { type: 'integer', example: 1 },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      shippingAddressId: { type: 'integer', nullable: true },
      shippingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      billingAddressId: { type: 'integer' },
      billingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      totalAmountHt: { type: 'number', format: 'double' },
      totalVatAmount: { type: 'number', format: 'double' },
      totalAmountTtc: { type: 'number', format: 'double' },
      notes: { type: 'string', nullable: true },
      termsAndConditions: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/QuoteItemApiResponse' },
        nullable: true,
      },
      createdByUserId: { type: 'integer', nullable: true },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      // updatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
