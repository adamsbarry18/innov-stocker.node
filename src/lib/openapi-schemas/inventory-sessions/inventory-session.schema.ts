import { InventorySessionStatus } from '@/modules/inventory-sessions/models/inventory-session.entity';

// Assuming these are defined globally or imported
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/CreateWarehouseInput' };
const EmbeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

// --- InventorySessionItem Schemas ---
const CreateOrUpdateInventorySessionItemInputSchema = {
  type: 'object',
  required: ['productId', 'counted_quantity'],
  properties: {
    productId: { type: 'integer', description: 'ID of the product being counted.' },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    counted_quantity: {
      type: 'number',
      format: 'double',
      minimum: 0,
      example: 105.5,
      description: 'The physically counted quantity.',
    },
    notes: { type: 'string', maxLength: 1000, nullable: true, example: 'Found in back corner.' },
    // theoretical_quantity and unit_cost_at_inventory are typically determined by the service
  },
};

const InventorySessionItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'BIGINT as string' },
    inventorySessionId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    theoreticalQuantity: {
      type: 'number',
      format: 'double',
      description: 'Stock quantity at the start of the session.',
    },
    countedQuantity: { type: 'number', format: 'double' },
    varianceQuantity: {
      type: 'number',
      format: 'double',
      description: 'Calculated: counted - theoretical',
    },
    unitCostAtInventory: {
      type: 'number',
      format: 'double',
      nullable: true,
      description: 'Unit cost of the item at the time of inventory.',
    },
    notes: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const inventorySessionSchemas = {
  CreateOrUpdateInventorySessionItemInput: CreateOrUpdateInventorySessionItemInputSchema, // For POST /sessions/:id/items
  InventorySessionItemApiResponse: InventorySessionItemApiResponseSchema,

  CreateInventorySessionInput: {
    type: 'object',
    // warehouseId or shopId is logically required by the service
    properties: {
      warehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the warehouse for the inventory count. Required if shopId is not set.',
      },
      shopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the shop for the inventory count. Required if warehouseId is not set.',
      },
      startDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        example: '2025-07-15',
        description: 'Date the inventory session starts. Defaults to current date if not provided.',
      },
      notes: { type: 'string', nullable: true, example: 'Annual stock take for main warehouse.' },
    },
  },
  UpdateInventorySessionInput: {
    // For PUT /inventory-sessions/{id}
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        format: 'date',
        description: 'Can only be updated if session is PENDING.',
      },
      endDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'End date of the session (can be set when completing).',
      },
      notes: { type: 'string', nullable: true },
      status: {
        type: 'string',
        enum: Object.values(InventorySessionStatus),
        description:
          'Limited status changes allowed here (e.g., to IN_PROGRESS or CANCELLED). Use /complete for COMPLETED.',
      },
    },
  },
  CompleteInventorySessionInput: {
    type: 'object',
    properties: {
      notes: {
        type: 'string',
        nullable: true,
        description: 'Final notes for the completed session.',
      },
    },
  },
  InventorySessionApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      warehouseId: { type: 'integer', nullable: true },
      warehouse: { allOf: [EmbeddedWarehouseDTORef], nullable: true },
      shopId: { type: 'integer', nullable: true },
      shop: { allOf: [EmbeddedShopDTORef], nullable: true },
      startDate: { type: 'string', format: 'date-time', nullable: true },
      endDate: { type: 'string', format: 'date-time', nullable: true },
      status: {
        type: 'string',
        enum: Object.values(InventorySessionStatus),
        example: 'in_progress',
      },
      createdByUserId: { type: 'integer', nullable: true }, // Mapped from createdByUserId
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      validatedByUserId: { type: 'integer', nullable: true },
      validatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/InventorySessionItemApiResponse' },
        nullable: true,
        description: "Included when fetching a single session's details with includeItems=true.",
      },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
