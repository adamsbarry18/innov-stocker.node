import { StockTransferStatus } from '@/modules/stock-transfers/models/stock-transfer.entity';

// Assuming these are defined globally or imported
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/CreateWarehouseInput' };
const EmbeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

// --- StockTransferItem Schemas ---
const CreateStockTransferItemInputSchema = {
  type: 'object',
  required: ['productId', 'quantityRequested'],
  properties: {
    productId: { type: 'integer', description: 'ID of the product to transfer.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    quantityRequested: {
      type: 'number',
      format: 'double',
      minimum: 0.001,
      example: 10,
      description: 'Quantity requested for transfer.',
    },
  },
};

const UpdateStockTransferItemInputSchema = {
  // For PUT /items/{itemId} or in PUT /transfers/{id}
  type: 'object',
  properties: {
    quantityRequested: {
      type: 'number',
      format: 'double',
      minimum: 0.001,
      description: 'Can be updated if transfer is PENDING.',
    },
    // quantityShipped and quantityReceived are typically updated via /ship and /receive actions on parent transfer.
    // However, an admin might need to correct these if a transfer is still PENDING/IN_TRANSIT.
    quantityShipped: {
      type: 'number',
      format: 'double',
      minimum: 0,
      description: 'Corrective update if status allows.',
    },
    quantityReceived: {
      type: 'number',
      format: 'double',
      minimum: 0,
      description: 'Corrective update if status allows.',
    },
  },
};

const StockTransferItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'BIGINT as string' },
    stockTransferId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    quantityRequested: { type: 'number', format: 'double' },
    quantityShipped: { type: 'number', format: 'double' },
    quantityReceived: { type: 'number', format: 'double' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- StockTransfer Schemas ---
export const stockTransferSchemas = {
  CreateStockTransferItemInput: CreateStockTransferItemInputSchema,
  UpdateStockTransferItemInput: UpdateStockTransferItemInputSchema,
  StockTransferItemApiResponse: StockTransferItemApiResponseSchema,

  CreateStockTransferInput: {
    type: 'object',
    required: ['requestDate', 'items'], // Source & Dest location logic in service
    properties: {
      sourceWarehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the source warehouse. Required if sourceShopId is not set.',
      },
      sourceShopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the source shop. Required if sourceWarehouseId is not set.',
      },
      destinationWarehouseId: {
        type: 'integer',
        nullable: true,
        example: 2,
        description: 'ID of the destination warehouse. Required if destinationShopId is not set.',
      },
      destinationShopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the destination shop. Required if destinationWarehouseId is not set.',
      },
      requestDate: {
        type: 'string',
        format: 'date',
        example: '2025-07-20',
        description: 'Date the transfer is requested.',
      },
      notes: { type: 'string', nullable: true, example: 'Transfer for restocking event.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateStockTransferItemInput' },
        minItems: 1,
      },
    },
  },
  UpdateStockTransferInput: {
    // For PUT /stock-transfers/{id} - header and items if PENDING
    type: 'object',
    properties: {
      sourceWarehouseId: { type: 'integer', nullable: true },
      sourceShopId: { type: 'integer', nullable: true },
      destinationWarehouseId: { type: 'integer', nullable: true },
      destinationShopId: { type: 'integer', nullable: true },
      requestDate: { type: 'string', format: 'date' },
      notes: { type: 'string', nullable: true },
      // Status is changed via specific PATCH actions
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID of existing item to update. Omit for new.' },
            productId: { type: 'integer', description: 'Required for new items.' },
            productVariantId: { type: 'integer', nullable: true },
            quantityRequested: { type: 'number', format: 'double', minimum: 0.001 },
            _delete: { type: 'boolean', description: 'Set to true to mark for deletion.' },
          },
        },
        description:
          'Full list of items for the transfer if status is PENDING. Supports add/update/delete.',
      },
    },
  },
  ShipStockTransferInput: {
    type: 'object',
    required: ['items'],
    properties: {
      shipDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Actual shipment date. Defaults to now if not provided.',
      },
      notes: { type: 'string', nullable: true, description: 'Shipping notes.' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'quantityShipped'],
          properties: {
            id: { type: 'string', description: 'ID of the StockTransferItem being shipped.' },
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
  ReceiveStockTransferInput: {
    type: 'object',
    required: ['items'],
    properties: {
      receiveDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Actual reception date. Defaults to now if not provided.',
      },
      notes: { type: 'string', nullable: true, description: 'Reception notes.' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'quantityReceived'],
          properties: {
            id: { type: 'string', description: 'ID of the StockTransferItem being received.' },
            quantityReceived: {
              type: 'number',
              format: 'double',
              minimum: 0,
              description: 'Quantity of this item being received now.',
            },
          },
        },
      },
    },
  },
  StockTransferApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      transferNumber: { type: 'string', example: 'TRF-20250720-00001' },
      sourceWarehouseId: { type: 'integer', nullable: true },
      sourceWarehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      sourceShopId: { type: 'integer', nullable: true },
      sourceShop: { allOf: [EmbeddedShopDTORef], nullable: true },
      destinationWarehouseId: { type: 'integer', nullable: true },
      destinationWarehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      destinationShopId: { type: 'integer', nullable: true },
      destinationShop: { allOf: [EmbeddedShopDTORef], nullable: true },
      status: { type: 'string', enum: Object.values(StockTransferStatus), example: 'in_transit' },
      requestDate: { type: 'string', format: 'date-time', nullable: true },
      shipDate: { type: 'string', format: 'date-time', nullable: true },
      receiveDate: { type: 'string', format: 'date-time', nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/StockTransferItemApiResponse' },
        nullable: true,
      },
      requestedByUserId: { type: 'integer' },
      requestedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      shippedByUserId: { type: 'integer', nullable: true },
      shippedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      receivedByUserId: { type: 'integer', nullable: true },
      receivedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
