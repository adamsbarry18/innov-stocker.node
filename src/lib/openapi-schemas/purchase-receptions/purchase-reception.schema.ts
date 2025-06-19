import { PurchaseReceptionStatus } from '@/modules/purchase-receptions/models/purchase-reception.entity';

// Assuming these are defined globally or imported
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedSupplierDTORef = { $ref: '#/components/schemas/CreateSupplierInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/CreateWarehouseInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

// const CreateAddressInputRef = { '$ref': '#/components/schemas/CreateAddressInput' };

// eslint-disable-next-line @typescript-eslint/naming-convention
const CreatePurchaseReceptionItemInputSchema = {
  type: 'object',
  required: ['productId', 'quantityReceived'],
  properties: {
    purchaseOrderItemId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the original PO item being received.',
    },
    productId: { type: 'integer', description: 'ID of the product received.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant received, if applicable.',
    },
    quantityOrdered: {
      type: 'number',
      format: 'double',
      minimum: 0,
      nullable: true,
      description: 'Quantity ordered on the PO line (for reference).',
    },
    quantityReceived: {
      type: 'number',
      format: 'double',
      minimum: 0,
      example: 10,
      description: 'Quantity actually received.',
    },
    lotNumber: { type: 'string', maxLength: 100, nullable: true, example: 'LOT202505A' },
    expiryDate: { type: 'string', format: 'date', nullable: true, example: '2026-12-31' },
    notes: { type: 'string', maxLength: 1000, nullable: true },
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdatePurchaseReceptionItemInputSchema = {
  // For PUT on /items/{itemId}
  type: 'object',
  properties: {
    // Product/Variant/POItemLink are not changed on an existing reception line
    quantityReceived: { type: 'number', format: 'double', minimum: 0 },
    lotNumber: { type: 'string', maxLength: 100, nullable: true },
    expiryDate: { type: 'string', format: 'date', nullable: true },
    notes: { type: 'string', maxLength: 1000, nullable: true },
  },
  description:
    'At least one field should be provided for update. Product/Variant and PO Item link are fixed.',
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const PurchaseReceptionItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    purchaseReceptionId: { type: 'integer' },
    purchaseOrderItemId: { type: 'integer', nullable: true },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    quantityOrdered: { type: 'number', format: 'double', nullable: true },
    quantityReceived: { type: 'number', format: 'double' },
    lotNumber: { type: 'string', nullable: true },
    expiryDate: { type: 'string', format: 'date-time', nullable: true }, // DB is DATE, API can be full date-time or date
    notes: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// For updating a Purchase Reception header and potentially its items
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdatePurchaseReceptionItemsArrayInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID of existing item to update. Omit for new items.' },
    // Fields from CreatePurchaseReceptionItemInput for new/updated items
    purchaseOrderItemId: { type: 'integer', nullable: true },
    productId: { type: 'integer', description: 'Required for new items.' },
    productVariantId: { type: 'integer', nullable: true },
    quantityOrdered: { type: 'number', format: 'double', minimum: 0, nullable: true },
    quantityReceived: { type: 'number', format: 'double', minimum: 0 },
    lotNumber: { type: 'string', maxLength: 100, nullable: true },
    expiryDate: { type: 'string', format: 'date', nullable: true },
    notes: { type: 'string', maxLength: 1000, nullable: true },
    _delete: {
      type: 'boolean',
      description: 'Set to true to mark this item for deletion during reception update.',
    },
  },
};

export const purchaseReceptionSchemas = {
  CreatePurchaseReceptionItemInput: CreatePurchaseReceptionItemInputSchema,
  UpdatePurchaseReceptionItemInput: UpdatePurchaseReceptionItemInputSchema,
  PurchaseReceptionItemApiResponse: PurchaseReceptionItemApiResponseSchema,

  CreatePurchaseReceptionInput: {
    type: 'object',
    required: ['supplierId', 'receptionDate', 'items'],
    properties: {
      purchaseOrderId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the PO if this reception is linked.',
      },
      supplierId: {
        type: 'integer',
        example: 1,
        description: 'ID of the supplier. Required if PO not linked.',
      },
      receptionDate: { type: 'string', format: 'date', example: '2025-06-15' },
      warehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the warehouse where goods are received.',
      },
      shopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the shop where goods are received.',
      },
      status: {
        type: 'string',
        enum: Object.values(PurchaseReceptionStatus),
        default: 'pending_quality_check',
        example: 'pending_quality_check',
      },
      notes: { type: 'string', nullable: true, example: 'Partial delivery. Backorder expected.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreatePurchaseReceptionItemInput' },
        minItems: 1,
        description: 'List of items received.',
      },
    },
  },
  UpdatePurchaseReceptionInput: {
    type: 'object',
    properties: {
      receptionDate: { type: 'string', format: 'date' },
      warehouseId: { type: 'integer', nullable: true },
      shopId: { type: 'integer', nullable: true },
      status: {
        type: 'string',
        enum: Object.values(PurchaseReceptionStatus),
        description:
          'Careful: changing status might have side effects not handled by this generic update. Use PATCH /validate for processing.',
      },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: UpdatePurchaseReceptionItemsArrayInputSchema,
        description:
          'Array of items. Replaces existing items if reception is in PENDING_QUALITY_CHECK status.',
      },
    },
  },
  PurchaseReceptionApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      receptionNumber: { type: 'string', example: 'REC-20250615-00001' },
      purchaseOrderId: { type: 'integer', nullable: true, example: 1 },
      purchaseOrder: {
        type: 'object',
        nullable: true,
        properties: { id: { type: 'integer' }, orderNumber: { type: 'string' } },
      }, // Simplified PO
      supplierId: { type: 'integer', example: 1 },
      supplier: { allOf: [EmbeddedSupplierDTORef], nullable: true },
      receptionDate: { type: 'string', format: 'date-time', nullable: true },
      warehouseId: { type: 'integer', nullable: true },
      warehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      shopId: { type: 'integer', nullable: true },
      shop: { allOf: [EmbeddedShopDTORef], nullable: true },
      status: { type: 'string', enum: Object.values(PurchaseReceptionStatus), example: 'complete' },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/PurchaseReceptionItemApiResponse' },
        nullable: true,
      },
      receivedByUserId: { type: 'integer' },
      receivedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
