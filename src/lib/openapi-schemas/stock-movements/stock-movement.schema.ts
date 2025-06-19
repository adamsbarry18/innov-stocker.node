// Assuming EmbeddedUserDTO is defined globally

import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';

// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };

export const stockMovementSchemas = {
  CreateStockMovementInput: {
    // Principalement pour les ajustements manuels via API directe
    type: 'object',
    required: ['productId', 'movementType', 'quantity', 'userId'], // warehouseId ou shopId requis par logique métier
    properties: {
      productId: { type: 'integer', description: 'ID of the product.' },
      productVariantId: {
        type: 'integer',
        nullable: true,
        description: 'ID of the product variant, if applicable.',
      },
      warehouseId: {
        type: 'integer',
        nullable: true,
        description: 'ID of the warehouse. Required if shopId is not provided.',
      },
      shopId: {
        type: 'integer',
        nullable: true,
        description: 'ID of the shop. Required if warehouseId is not provided.',
      },
      movementType: {
        type: 'string',
        enum: [StockMovementType.MANUAL_ENTRY_IN, StockMovementType.MANUAL_ENTRY_OUT], // Pour cet endpoint
        description: "Type of stock movement, e.g., 'manual_entry_in', 'manual_entry_out'.",
      },
      quantity: {
        type: 'number',
        format: 'double',
        description: 'Quantity of the movement. Positive for IN, negative for OUT. Cannot be zero.',
      },
      movementDate: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Date of the movement (ISO 8601). Defaults to now if not provided.',
      },
      unitCostAtMovement: {
        type: 'number',
        format: 'double',
        minimum: 0,
        nullable: true,
        description: 'Unit cost at the time of movement, for valuation.',
      },
      userId: {
        type: 'integer',
        description:
          'ID of the user performing or responsible for the movement (auto-filled for logged-in user).',
      },
      referenceDocumentType: {
        type: 'string',
        maxLength: 50,
        nullable: true,
        example: 'manual_adjustment',
        description:
          'Type of document this movement refers to (e.g., inventory_sheet, manual_note).',
      },
      referenceDocumentId: {
        type: 'string',
        maxLength: 100,
        nullable: true,
        example: 'ADJ-2025-001',
        description: 'ID of the reference document.',
      },
      notes: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        example: 'Correction suite à erreur de comptage.',
      },
    },
  },
  StockMovementApiResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: '123456789012345',
        description: 'Movement ID (BIGINT as string)',
      },
      productId: { type: 'integer' },
      productSku: { type: 'string', nullable: true },
      productName: { type: 'string', nullable: true },
      productVariantId: { type: 'integer', nullable: true },
      productVariantSku: { type: 'string', nullable: true },
      productVariantName: { type: 'string', nullable: true },
      warehouseId: { type: 'integer', nullable: true },
      warehouseName: { type: 'string', nullable: true },
      shopId: { type: 'integer', nullable: true },
      shopName: { type: 'string', nullable: true },
      movementType: { type: 'string', enum: Object.values(StockMovementType) },
      quantity: { type: 'number', format: 'double' },
      movementDate: { type: 'string', format: 'date-time', nullable: true },
      unitCostAtMovement: { type: 'number', format: 'double', nullable: true },
      userId: { type: 'integer' },
      user: { allOf: [EmbeddedUserDTORef], nullable: true },
      referenceDocumentType: { type: 'string', nullable: true },
      referenceDocumentId: { type: ['string', 'number'], nullable: true },
      notes: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
