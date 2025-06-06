import { SupplierReturnStatus } from '@/modules/supplier-returns/models/supplier-return.entity';

// Assuming these are defined globally or imported
const EmbeddedSupplierDTORef = { $ref: '#/components/schemas/EmbeddedSupplierDTO' };
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/EmbeddedWarehouseDTO' };
const EmbeddedShopDTORef = { $ref: '#/components/schemas/EmbeddedShopDTO' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };
const ProductApiResponseRef = { $ref: '#/components/schemas/ProductApiResponse' }; // Or a simplified version
const ProductVariantApiResponseRef = { $ref: '#/components/schemas/ProductVariantApiResponse' }; // Or a simplified version

// --- SupplierReturnItem Schemas ---
const CreateSupplierReturnItemInputSchema = {
  type: 'object',
  required: ['productId', 'quantity'],
  properties: {
    productId: { type: 'integer', description: 'ID of the product being returned.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    quantity: {
      type: 'number',
      format: 'double',
      minimum: 0.001,
      example: 2,
      description: 'Quantity of this item being returned.',
    },
    unitPriceAtReturn: {
      type: 'number',
      format: 'double',
      minimum: 0,
      nullable: true,
      example: 50.25,
      description: 'Original purchase price for credit/refund reference.',
    },
    purchaseReceptionItemId: {
      type: 'integer',
      nullable: true,
      description:
        'ID of the Purchase Reception Item this return line refers to, for traceability.',
    },
    // condition and actionTaken are usually set during processing, not initial creation of return request.
  },
};

const UpdateSupplierReturnItemInputSchema = {
  type: 'object',
  properties: {
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceAtReturn: { type: 'number', format: 'double', minimum: 0, nullable: true },
    // These fields are typically updated by specific actions in the service (e.g., during shipping or receiving process)
    // quantityShipped: { type: 'number', format: 'double', minimum: 0 },
    // quantityReceived: { type: 'number', format: 'double', minimum: 0 },
    // condition: { type: 'string', enum: Object.values(ReturnedItemCondition), nullable: true },
    // actionTaken: { type: 'string', enum: Object.values(ReturnItemActionTaken) },
  },
  description:
    'Updates details of an item in a supplier return, typically quantity if status is PENDING/APPROVED.',
};

const SupplierReturnItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'BIGINT as string' },
    supplierReturnId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    quantity: { type: 'number', format: 'double', description: 'Originally quantityRequested' },
    unitPriceAtReturn: { type: 'number', format: 'double', nullable: true },
    quantityShipped: { type: 'number', format: 'double', default: 0 },
    quantityReceived: {
      type: 'number',
      format: 'double',
      default: 0,
      description: 'Quantity confirmed received by supplier',
    },
    purchaseReceptionItemId: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- SupplierReturn Schemas ---
export const supplierReturnSchemas = {
  CreateSupplierReturnItemInput: CreateSupplierReturnItemInputSchema,
  UpdateSupplierReturnItemInput: UpdateSupplierReturnItemInputSchema,
  SupplierReturnItemApiResponse: SupplierReturnItemApiResponseSchema,

  CreateSupplierReturnInput: {
    type: 'object',
    required: ['supplierId', 'returnDate', 'items'], // source location required by service logic
    properties: {
      supplierId: { type: 'integer', example: 1 },
      returnDate: {
        type: 'string',
        format: 'date',
        example: '2025-08-01',
        description: 'Date the return is requested or initiated.',
      },
      reason: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        example: 'Articles défectueux à la réception.',
      },
      notes: { type: 'string', nullable: true, example: 'Attente instructions du fournisseur.' },
      sourceWarehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the warehouse items are returned from.',
      },
      sourceShopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the shop items are returned from.',
      },
      supplierRmaNumber: {
        type: 'string',
        maxLength: 100,
        nullable: true,
        example: 'RMA-SUP-12345',
      },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateSupplierReturnItemInput' },
        minItems: 1,
      },
    },
  },
  UpdateSupplierReturnInput: {
    // For PUT /supplier-returns/{id}
    type: 'object',
    properties: {
      returnDate: { type: 'string', format: 'date' },
      reason: { type: 'string', maxLength: 1000, nullable: true },
      notes: { type: 'string', nullable: true },
      sourceWarehouseId: { type: 'integer', nullable: true },
      sourceShopId: { type: 'integer', nullable: true },
      supplierRmaNumber: { type: 'string', maxLength: 100, nullable: true },
      // Status is updated via specific PATCH actions
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID of existing item to update. Omit for new.' },
            productId: { type: 'integer', description: 'Required for new items.' },
            productVariantId: { type: 'integer', nullable: true },
            quantity: { type: 'number', format: 'double', minimum: 0.001 },
            unitPriceAtReturn: { type: 'number', format: 'double', minimum: 0, nullable: true },
            purchaseReceptionItemId: { type: 'integer', nullable: true },
            _delete: { type: 'boolean', description: 'Set to true to mark for deletion.' },
          },
        },
        description: 'Full list of items for the return if status is PENDING/REQUESTED.',
      },
    },
  },
  ShipSupplierReturnInput: {
    type: 'object',
    required: ['items'],
    properties: {
      shipDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Actual shipment date. Defaults to now if not provided.',
      },
      carrierName: { type: 'string', maxLength: 255, nullable: true, example: 'DHL Express' },
      trackingNumber: { type: 'string', maxLength: 100, nullable: true, example: 'DHL123456XYZ' },
      notes: { type: 'string', nullable: true, description: 'Notes specific to the shipment.' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'quantityShipped'],
          properties: {
            id: { type: 'string', description: 'ID of the SupplierReturnItem being shipped.' },
            quantityShipped: {
              type: 'number',
              format: 'double',
              minimum: 0,
              description: 'Quantity of this item being shipped now.',
            },
          },
        },
      },
    },
  },
  CompleteSupplierReturnInput: {
    type: 'object',
    properties: {
      completionDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Date the return process was finalized. Defaults to now.',
      },
      resolutionNotes: {
        type: 'string',
        nullable: true,
        description: 'Notes on how the return was resolved (e.g., credit note ID, refund details).',
      },
    },
  },
  SupplierReturnApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      returnNumber: { type: 'string', example: 'SRA-20250801-0001' },
      supplierId: { type: 'integer', example: 1 },
      supplier: { allOf: [EmbeddedSupplierDTORef], nullable: true },
      returnDate: { type: 'string', format: 'date-time', nullable: true },
      status: {
        type: 'string',
        enum: Object.values(SupplierReturnStatus),
        example: 'shipped_to_supplier',
      },
      reason: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      sourceWarehouseId: { type: 'integer', nullable: true },
      sourceWarehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      sourceShopId: { type: 'integer', nullable: true },
      sourceShop: { allOf: [EmbeddedShopDTORef], nullable: true },
      supplierRmaNumber: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/SupplierReturnItemApiResponse' },
        nullable: true,
      },
      createdByUserId: { type: 'integer', nullable: true },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      shippedByUserId: { type: 'integer', nullable: true },
      shippedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      // processedByUserId: { type: 'integer', nullable: true },
      // processedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
