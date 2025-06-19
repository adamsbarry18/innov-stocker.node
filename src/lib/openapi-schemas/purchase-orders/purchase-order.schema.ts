import { PurchaseOrderStatus } from '@/modules/purchase-orders/models/purchase-order.entity';

// Assuming these are defined globally or imported from other schema files
// eslint-disable-next-line @typescript-eslint/naming-convention
// Assuming these are defined globally or imported
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedSupplierDTORef = { $ref: '#/components/schemas/CreateSupplierInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/CreateCurrencyInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/CreateAddressInput' };

const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/CreateWarehouseInput' };
const EmbeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

// eslint-disable-next-line @typescript-eslint/naming-convention
const CreatePurchaseOrderItemInputSchema = {
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
    quantity: { type: 'number', format: 'double', minimum: 0.001, example: 10 },
    unitPriceHt: {
      type: 'number',
      format: 'double',
      minimum: 0,
      example: 25.5,
      description: 'Agreed price per unit with supplier.',
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
const UpdatePurchaseOrderItemInputSchema = {
  type: 'object',
  // For PUT on /items/{itemId}, all fields are effectively optional for partial update
  // productId and productVariantId are not changed for an existing item line.
  properties: {
    description: { type: 'string', maxLength: 1000, nullable: true },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    // discountPercentage: { type: 'number', format: 'float', minimum: 0, maximum: 100 }, // Not on POItem in current model
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
  },
  description:
    'At least one field should be provided for update. Product/Variant cannot be changed on an existing item line (delete and re-add for that).',
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const PurchaseOrderItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    purchaseOrderId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    quantity: { type: 'number', format: 'double' },
    unitPriceHt: { type: 'number', format: 'double' },
    vatRatePercentage: { type: 'number', format: 'float', nullable: true },
    totalLineAmountHt: {
      type: 'number',
      format: 'double',
      description: 'Calculated: quantity * unitPriceHt',
    },
    quantityReceived: { type: 'number', format: 'double' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// UpdatePurchaseOrderInput for the main PO update, including items
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdatePurchaseOrderItemsArrayInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID of existing item to update. Omit for new items.' },
    productId: { type: 'integer', description: 'Required for new items.' }, // Required if no ID
    productVariantId: { type: 'integer', nullable: true },
    description: { type: 'string', maxLength: 1000, nullable: true },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
    _delete: {
      type: 'boolean',
      description: 'Set to true to mark this item for deletion during PO update.',
    },
  },
};

export const purchaseOrderSchemas = {
  CreatePurchaseOrderItemInput: CreatePurchaseOrderItemInputSchema,
  UpdatePurchaseOrderItemInput: UpdatePurchaseOrderItemInputSchema,
  PurchaseOrderItemApiResponse: PurchaseOrderItemApiResponseSchema,

  CreatePurchaseOrderInput: {
    type: 'object',
    required: ['supplierId', 'orderDate', 'currencyId', 'items'],
    properties: {
      supplierId: { type: 'integer', example: 1 },
      orderDate: { type: 'string', format: 'date', example: '2025-06-10' },
      expectedDeliveryDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2025-06-25',
      },
      status: {
        type: 'string',
        enum: Object.values(PurchaseOrderStatus),
        default: 'draft',
        example: 'pending_approval',
      },
      currencyId: { type: 'integer', example: 1 },
      shippingAddressId: { type: 'integer', nullable: true, example: 7 },
      warehouseIdForDelivery: { type: 'integer', nullable: true, example: 1 },
      shopIdForDelivery: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true, example: 'Urgent re-stock.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreatePurchaseOrderItemInput' },
        minItems: 1,
      },
    },
  },
  UpdatePurchaseOrderInput: {
    type: 'object',
    properties: {
      orderDate: { type: 'string', format: 'date' },
      expectedDeliveryDate: { type: 'string', format: 'date', nullable: true },
      status: { type: 'string', enum: Object.values(PurchaseOrderStatus) },
      currencyId: { type: 'integer' },
      shippingAddressId: { type: 'integer', nullable: true },
      warehouseIdForDelivery: { type: 'integer', nullable: true },
      shopIdForDelivery: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: UpdatePurchaseOrderItemsArrayInputSchema,
        description:
          'Array of items. For updates, include item ID. For new items, omit ID. To delete, include ID and _delete:true.',
      },
    },
  },
  PurchaseOrderApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      orderNumber: { type: 'string', example: 'PO-20250610-00001' },
      supplierId: { type: 'integer', example: 1 },
      supplier: { allOf: [EmbeddedSupplierDTORef], nullable: true },
      orderDate: { type: 'string', format: 'date-time', nullable: true },
      expectedDeliveryDate: { type: 'string', format: 'date-time', nullable: true },
      status: { type: 'string', enum: Object.values(PurchaseOrderStatus), example: 'approved' },
      currencyId: { type: 'integer', example: 1 },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      totalAmountHt: { type: 'number', format: 'double' },
      totalVatAmount: { type: 'number', format: 'double' },
      totalAmountTtc: { type: 'number', format: 'double' },
      shippingAddressId: { type: 'integer', nullable: true },
      shippingAddress: { allOf: [EmbeddedAddressDTORef], nullable: true },
      warehouseIdForDelivery: { type: 'integer', nullable: true },
      warehouseForDelivery: {
        allOf: [{ $ref: '#/components/schemas/CreateWarehouseInput' }],
        nullable: true,
      },
      shopIdForDelivery: { type: 'integer', nullable: true },
      shopForDelivery: {
        allOf: [{ $ref: '#/components/schemas/CreateShopInput' }],
        nullable: true,
      },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/PurchaseOrderItemApiResponse' },
        nullable: true,
      },
      createdByUserId: { type: 'integer' },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      approvedByUserId: { type: 'integer', nullable: true },
      approvedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
