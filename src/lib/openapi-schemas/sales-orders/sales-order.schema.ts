import { SalesOrderStatus } from '@/modules/sales-orders/models/sales-order.entity';

// Références (supposons qu'ils sont définis globalement ou importés)
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCustomerDTORef = { $ref: '#/components/schemas/CreateCustomerInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/CreateCurrencyInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/CreateAddressInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/CreateWarehouseInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

const QuoteApiResponseRef = { $ref: '#/components/schemas/QuoteApiResponse' }; // Pour référence du devis lié
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateSalesOrderItemInputSchema = {
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
      description: 'Custom description, overrides product/variant name.',
    },
    quantity: { type: 'number', format: 'double', minimum: 0.001, example: 1 },
    unitPriceHt: {
      type: 'number',
      format: 'double',
      minimum: 0,
      example: 199.99,
      description: 'Price per unit before tax and discount.',
    },
    discountPercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      default: 0,
      example: 5.0,
    },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
      example: 20.0,
    },
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateSalesOrderItemInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID of existing item to update. Omit for new items.' },
    // ProductId/VariantId typically not changed on existing line
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
      description: 'Set to true to mark this item for deletion during SO update.',
    },
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const SalesOrderItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    salesOrderId: { type: 'integer' },
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
    totalLineAmountHt: {
      type: 'number',
      format: 'double',
      description: 'Calculated: quantity * unitPriceHt * (1-discount/100)',
    },
    quantityShipped: { type: 'number', format: 'double' },
    quantityInvoiced: { type: 'number', format: 'double' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const salesOrderSchemas = {
  CreateSalesOrderItemInput: CreateSalesOrderItemInputSchema,
  UpdateSalesOrderItemInput: UpdateSalesOrderItemInputSchema, // Pour la mise à jour des items dans le payload de UpdateSalesOrderInput
  SalesOrderItemApiResponse: SalesOrderItemApiResponseSchema,

  CreateSalesOrderInput: {
    type: 'object',
    required: [
      'customerId',
      'orderDate',
      'currencyId',
      'shippingAddressId',
      'billingAddressId',
      'items',
    ], // Dispatch location required by service logic
    properties: {
      customerId: { type: 'integer', example: 1 },
      quoteId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the accepted quote this order is based on, if any.',
      },
      orderDate: { type: 'string', format: 'date', example: '2025-06-20' },
      status: {
        type: 'string',
        enum: Object.values(SalesOrderStatus),
        default: 'draft',
        example: 'approved',
      },
      currencyId: { type: 'integer', example: 1 },
      shippingFeesHt: { type: 'number', format: 'double', minimum: 0, default: 0, example: 15.0 },
      shippingAddressId: {
        type: 'integer',
        example: 5,
        description: 'ID of an existing shipping address.',
      },
      billingAddressId: {
        type: 'integer',
        example: 4,
        description: 'ID of an existing billing address.',
      },
      dispatchWarehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the warehouse for dispatch. Required if dispatchShopId is not set.',
      },
      dispatchShopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the shop for dispatch. Required if dispatchWarehouseId is not set.',
      },
      notes: { type: 'string', nullable: true, example: 'Client demande livraison rapide.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateSalesOrderItemInput' },
        minItems: 1,
      },
    },
  },
  UpdateSalesOrderInput: {
    type: 'object',
    properties: {
      // CustomerId and quoteId are not typically updatable
      orderDate: { type: 'string', format: 'date' },
      status: { type: 'string', enum: Object.values(SalesOrderStatus) }, // Status updates better via dedicated PATCH
      currencyId: { type: 'integer' },
      shippingFeesHt: { type: 'number', format: 'double', minimum: 0 },
      shippingAddressId: { type: 'integer' },
      billingAddressId: { type: 'integer' },
      dispatchWarehouseId: { type: 'integer', nullable: true },
      dispatchShopId: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/UpdateSalesOrderItemInput' }, // Utilise le schéma pour la mise à jour des items
        description:
          'Array of items. For updates, include item ID. For new items, omit ID. To delete, include ID and _delete:true.',
      },
    },
  },
  SalesOrderApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      orderNumber: { type: 'string', example: 'SO-20250620-00001' },
      customerId: { type: 'integer', example: 1 },
      customer: { allOf: [EmbeddedCustomerDTORef], nullable: true },
      quoteId: { type: 'integer', nullable: true, example: 1 },
      quoteNumber: { type: 'string', nullable: true, example: 'QT-20250601-0001' },
      orderDate: { type: 'string', format: 'date-time', nullable: true },
      status: { type: 'string', enum: Object.values(SalesOrderStatus), example: 'approved' },
      currencyId: { type: 'integer', example: 1 },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      totalAmountHt: { type: 'number', format: 'double' },
      totalVatAmount: { type: 'number', format: 'double' },
      totalAmountTtc: { type: 'number', format: 'double' },
      shippingFeesHt: { type: 'number', format: 'double' },
      shippingAddressId: { type: 'integer' },
      shippingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      billingAddressId: { type: 'integer' },
      billingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      dispatchWarehouseId: { type: 'integer', nullable: true },
      dispatchWarehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      dispatchShopId: { type: 'integer', nullable: true },
      dispatchShop: { allOf: [EmbeddedShopDTORef], nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/SalesOrderItemApiResponse' },
        nullable: true,
      },
      createdByUserId: { type: 'integer' },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
