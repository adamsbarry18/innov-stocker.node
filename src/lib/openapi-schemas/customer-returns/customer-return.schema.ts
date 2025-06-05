import {
  ReturnedItemCondition,
  ReturnItemActionTaken,
} from '@/modules/customer-returns/customer-return-items/models/customer-return-item.entity';
import { CustomerReturnStatus } from '@/modules/customer-returns/models/customer-return.entity';

// Assuming these are defined globally or imported
const EmbeddedCustomerDTORef = { $ref: '#/components/schemas/EmbeddedCustomerDTO' };
const EmbeddedSalesOrderDTORef = { $ref: '#/components/schemas/EmbeddedSalesOrderDTO' };
const EmbeddedCustomerInvoiceDTORef = { $ref: '#/components/schemas/EmbeddedCustomerInvoiceDTO' }; // Définir ce DTO
const EmbeddedWarehouseDTORef = { $ref: '#/components/schemas/EmbeddedWarehouseDTO' };
const EmbeddedShopDTORef = { $ref: '#/components/schemas/EmbeddedShopDTO' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

// --- CustomerReturnItem Schemas ---
const CreateCustomerReturnItemInputSchema = {
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
      example: 1,
      description: 'Quantity of this item being returned.',
    },
    unitPriceAtReturn: {
      type: 'number',
      format: 'double',
      minimum: 0,
      nullable: true,
      example: 99.99,
      description: 'Original sale price, for refund calculation context.',
    },
    condition: {
      type: 'string',
      enum: Object.values(ReturnedItemCondition),
      nullable: true,
      default: 'new',
      example: 'new',
    },
    actionTaken: {
      type: 'string',
      enum: Object.values(ReturnItemActionTaken),
      default: 'pending_inspection',
      example: 'pending_inspection',
    },
    // salesOrderItemId: { type: 'integer', nullable: true, description: "Original SO item ID for traceability" },
    // deliveryItemId: { type: 'integer', nullable: true, description: "Original Delivery item ID for traceability" },
  },
};

const UpdateCustomerReturnItemInputSchema = {
  type: 'object',
  properties: {
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceAtReturn: { type: 'number', format: 'double', minimum: 0, nullable: true },
    condition: { type: 'string', enum: Object.values(ReturnedItemCondition), nullable: true },
    actionTaken: { type: 'string', enum: Object.values(ReturnItemActionTaken) },
    notes: { type: 'string', maxLength: 1000, nullable: true },
  },
  description:
    'Updates details of an item in a return, typically its condition or action after inspection.',
};

const CustomerReturnItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'BIGINT as string' },
    customerReturnId: { type: 'integer' },
    productId: { type: 'integer' },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    quantity: { type: 'number', format: 'double' },
    unitPriceAtReturn: { type: 'number', format: 'double', nullable: true },
    condition: { type: 'string', enum: Object.values(ReturnedItemCondition), nullable: true },
    actionTaken: { type: 'string', enum: Object.values(ReturnItemActionTaken) },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- CustomerReturn Schemas ---
export const customerReturnSchemas = {
  CreateCustomerReturnItemInput: CreateCustomerReturnItemInputSchema,
  UpdateCustomerReturnItemInput: UpdateCustomerReturnItemInputSchema,
  CustomerReturnItemApiResponse: CustomerReturnItemApiResponseSchema,

  CreateCustomerReturnInput: {
    type: 'object',
    required: ['customerId', 'returnDate', 'items'],
    properties: {
      customerId: { type: 'integer', example: 1 },
      salesOrderId: {
        type: 'integer',
        nullable: true,
        example: 101,
        description: 'ID of the original sales order, if known.',
      },
      customerInvoiceId: {
        type: 'integer',
        nullable: true,
        example: 201,
        description: 'ID of the related customer invoice, if known.',
      },
      returnDate: {
        type: 'string',
        format: 'date',
        example: '2025-07-25',
        description: 'Date the return was requested or initiated.',
      },
      status: {
        type: 'string',
        enum: Object.values(CustomerReturnStatus),
        default: 'requested',
        example: 'requested',
      },
      reason: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        example: 'Produit défectueux à la livraison.',
      },
      notes: { type: 'string', nullable: true, example: 'Le client souhaite un échange.' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateCustomerReturnItemInput' },
        minItems: 1,
      },
    },
  },
  UpdateCustomerReturnInput: {
    // For PUT /customer-returns/{id}
    type: 'object',
    properties: {
      returnDate: { type: 'string', format: 'date' },
      // status: { type: 'string', enum: Object.values(CustomerReturnStatus) }, // Status updated via PATCH actions
      reason: { type: 'string', maxLength: 1000, nullable: true },
      notes: { type: 'string', nullable: true },
      // Items are managed via sub-route or specific logic in PUT if status allows
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID of existing item to update. Omit for new.' },
            // ...fields from CreateCustomerReturnItemInput...
            productId: { type: 'integer' },
            productVariantId: { type: 'integer', nullable: true },
            quantity: { type: 'number', format: 'double', minimum: 0.001 },
            unitPriceAtReturn: { type: 'number', format: 'double', minimum: 0, nullable: true },
            condition: {
              type: 'string',
              enum: Object.values(ReturnedItemCondition),
              nullable: true,
            },
            actionTaken: { type: 'string', enum: Object.values(ReturnItemActionTaken) },
            _delete: { type: 'boolean', description: 'Set to true to mark for deletion.' },
          },
        },
        description: 'Full list of items if updating items on a DRAFT/REQUESTED return.',
      },
    },
  },
  ApproveReturnInput: {
    type: 'object',
    properties: {
      notes: { type: 'string', nullable: true, description: 'Optional notes for approval.' },
    },
  },
  ReceiveReturnInput: {
    type: 'object',
    required: ['items'],
    properties: {
      receivedDate: {
        type: 'string',
        format: 'date',
        nullable: true,
        description: 'Actual date items were received. Defaults to now if not provided.',
      },
      notes: {
        type: 'string',
        nullable: true,
        description: 'Notes specific to the reception of items.',
      },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'quantityReceived'],
          properties: {
            id: { type: 'string', description: 'ID of the CustomerReturnItem being received.' },
            quantityReceived: {
              type: 'number',
              format: 'double',
              minimum: 0,
              description: 'Quantity actually received for this item.',
            },
            condition: {
              type: 'string',
              enum: Object.values(ReturnedItemCondition),
              nullable: true,
              description: 'Condition of the received item.',
            },
            actionTaken: {
              type: 'string',
              enum: Object.values(ReturnItemActionTaken),
              nullable: true,
              description: 'Initial action proposed or taken upon reception.',
            },
            itemNotes: {
              type: 'string',
              nullable: true,
              description: 'Notes specific to this received item.',
            },
          },
        },
      },
    },
  },
  CompleteReturnInput: {
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
        description: 'Notes on how the return was resolved (e.g., refund ID, exchange SO number).',
      },
    },
  },
  // Define Embedded DTOs if not already global
  _EmbeddedCustomerInvoiceDTO_example: {
    type: 'object',
    properties: { id: { type: 'integer' }, invoiceNumber: { type: 'string' } },
  },

  CustomerReturnApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      returnNumber: { type: 'string', example: 'RMA-20250720-0001' },
      customerId: { type: 'integer', example: 1 },
      customer: { allOf: [EmbeddedCustomerDTORef], nullable: true },
      salesOrderId: { type: 'integer', nullable: true, example: 101 },
      salesOrder: { allOf: [EmbeddedSalesOrderDTORef], nullable: true },
      customerInvoiceId: { type: 'integer', nullable: true, example: 201 },
      customerInvoice: {
        allOf: [{ $ref: '#/components/schemas/EmbeddedCustomerInvoiceDTO' }],
        nullable: true,
      },
      returnDate: { type: 'string', format: 'date-time', nullable: true },
      status: { type: 'string', enum: Object.values(CustomerReturnStatus), example: 'approved' },
      reason: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CustomerReturnItemApiResponse' },
        nullable: true,
      },
      createdByUserId: { type: 'integer', nullable: true },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      validatedByUserId: {
        type: 'integer',
        nullable: true,
        description: 'User who approved/validated the return outcome.',
      },
      validatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
