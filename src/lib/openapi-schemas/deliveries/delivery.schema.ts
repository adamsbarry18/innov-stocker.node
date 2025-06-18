// src/libs/openapi-schemas/deliveries/delivery.schema.ts
import { DeliveryStatus } from '../../../modules/deliveries/models/delivery.entity';

// Références globales (à définir si ce n'est pas déjà fait)
const embeddedSalesOrderDtoRef = { $ref: '#/components/schemas/EmbeddedSalesOrderDTO' }; // Définir ce DTO
const embeddedAddressDtoRef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };
const embeddedWarehouseDtoRef = { $ref: '#/components/schemas/EmbeddedWarehouseDTO' };
const embeddedShopDtoRef = { $ref: '#/components/schemas/EmbeddedShopDTO' };
const embeddedUserDtoRef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

// --- DeliveryItem Schemas ---
const createDeliveryItemInputSchema = {
  type: 'object',
  required: ['salesOrderItemId', 'quantityShipped'],
  properties: {
    salesOrderItemId: {
      type: 'integer',
      description: 'ID of the Sales Order Item being delivered.',
    },
    // productId & productVariantId are inferred by the service from salesOrderItemId for consistency
    quantityShipped: {
      type: 'number',
      format: 'double',
      minimum: 0.001,
      example: 5,
      description: 'Quantity of this item being shipped in this delivery.',
    },
  },
};

const updateDeliveryItemInputSchema = {
  type: 'object',
  properties: {
    // Usually only quantity is updatable if delivery is not shipped
    quantityShipped: { type: 'number', format: 'double', minimum: 0.001 },
  },
  description:
    'Updates the quantity shipped for a delivery item. Only allowed if delivery is in an editable state.',
};

const deliveryItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    deliveryId: { type: 'integer' },
    salesOrderItemId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    quantityShipped: { type: 'number', format: 'double' },
    quantityOrderedFromSo: {
      type: 'number',
      format: 'double',
      nullable: true,
      description: 'Original quantity ordered on the sales order item for reference.',
    },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- Delivery Schemas ---
export const deliverySchemas = {
  CreateDeliveryItemInput: createDeliveryItemInputSchema,
  UpdateDeliveryItemInput: updateDeliveryItemInputSchema,
  DeliveryItemApiResponse: deliveryItemApiResponseSchema,

  CreateDeliveryInput: {
    type: 'object',
    required: ['salesOrderId', 'deliveryDate', 'items'], // Dispatch location & shipping address required by service
    properties: {
      salesOrderId: {
        type: 'integer',
        example: 1,
        description: 'ID of the Sales Order to fulfill.',
      },
      deliveryDate: {
        type: 'string',
        format: 'date',
        example: '2025-07-01',
        description: 'Proposed or actual date of shipment.',
      },
      shippingAddressId: {
        type: 'integer',
        nullable: true,
        example: 5,
        description: 'ID of the shipping address. If null, SO shipping address is used.',
      },
      dispatchWarehouseId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the dispatch warehouse. Required if dispatchShopId is not set.',
      },
      dispatchShopId: {
        type: 'integer',
        nullable: true,
        example: null,
        description: 'ID of the dispatch shop. Required if dispatchWarehouseId is not set.',
      },
      carrierName: { type: 'string', maxLength: 255, nullable: true, example: 'Chronopost' },
      trackingNumber: { type: 'string', maxLength: 100, nullable: true, example: 'TRK123456789' },
      notes: { type: 'string', nullable: true, example: 'Handle with care.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateDeliveryItemInput' },
        minItems: 1,
        description: 'List of items and quantities being shipped in this delivery.',
      },
      // status is usually set by the system, not by client on creation.
    },
  },
  UpdateDeliveryInput: {
    // For PUT /deliveries/{id} - typically header info
    type: 'object',
    properties: {
      deliveryDate: { type: 'string', format: 'date' },
      shippingAddressId: { type: 'integer', nullable: true },
      dispatchWarehouseId: { type: 'integer', nullable: true },
      dispatchShopId: { type: 'integer', nullable: true },
      carrierName: { type: 'string', maxLength: 255, nullable: true },
      trackingNumber: { type: 'string', maxLength: 100, nullable: true },
      notes: { type: 'string', nullable: true },
      // Items are generally not updated via this main PUT for simplicity; use item sub-routes if delivery is editable.
    },
  },
  PatchDeliveryShipInput: {
    // For PATCH /deliveries/{id}/ship
    type: 'object',
    properties: {
      actualShipDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Actual date of shipment. Defaults to now if not provided.',
      },
      carrierName: { type: 'string', maxLength: 255, nullable: true },
      trackingNumber: { type: 'string', maxLength: 100, nullable: true },
    },
  },
  // No specific input for PATCH /deliver, action itself is sufficient.

  // Simplified Embedded Sales Order DTO for DeliveryApiResponse
  embeddedSalesOrderDtoExample: {
    // Define this globally
    type: 'object',
    properties: {
      id: { type: 'integer' },
      orderNumber: { type: 'string' },
    },
  },

  DeliveryApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      deliveryNumber: { type: 'string', example: 'DL-20250701-00001' },
      salesOrderId: { type: 'integer', example: 1 },
      salesOrder: { allOf: [embeddedSalesOrderDtoRef], nullable: true },
      deliveryDate: { type: 'string', format: 'date-time', nullable: true },
      status: { type: 'string', enum: Object.values(DeliveryStatus), example: 'shipped' },
      shippingAddressId: { type: 'integer' },
      shippingAddress: { allOf: [embeddedAddressDtoRef], nullable: true },
      carrierName: { type: 'string', nullable: true },
      trackingNumber: { type: 'string', nullable: true },
      dispatchWarehouseId: { type: 'integer', nullable: true },
      dispatchWarehouse: { allOf: [embeddedWarehouseDtoRef], nullable: true },
      dispatchShopId: { type: 'integer', nullable: true },
      dispatchShop: { allOf: [embeddedShopDtoRef], nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/DeliveryItemApiResponse' },
        nullable: true,
      },
      shippedByUserId: { type: 'integer', nullable: true },
      shippedByUser: { allOf: [embeddedUserDtoRef], nullable: true },
      createdByUserId: { type: 'integer', nullable: true }, // If added to entity
      // createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
