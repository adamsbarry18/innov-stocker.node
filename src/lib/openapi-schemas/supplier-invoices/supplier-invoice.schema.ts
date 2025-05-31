import { SupplierInvoiceStatus } from '@/modules/supplier-invoices/models/supplier-invoice.entity';

// Assuming these are defined globally or imported
const EmbeddedSupplierDTORef = { $ref: '#/components/schemas/EmbeddedSupplierDTO' };
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

const CreateSupplierInvoiceItemInputSchema = {
  type: 'object',
  required: ['description', 'quantity', 'unitPriceHt'],
  properties: {
    productId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product, if directly invoicing a product.',
    },
    productVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the product variant, if applicable.',
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      example: 'Item Fournisseur XYZ - réf ABC',
    },
    quantity: { type: 'number', format: 'double', minimum: 0.001, example: 10 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0, example: 15.75 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
      example: 20.0,
    },
    purchaseReceptionItemId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the purchase reception item being invoiced, for 3-way matching.',
    },
  },
};

const UpdateSupplierInvoiceItemInputSchema = {
  type: 'object',
  properties: {
    // productId, productVariantId, purchaseReceptionItemId are generally not changed for an existing line.
    description: { type: 'string', minLength: 1, maxLength: 1000 },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
  },
  description: 'At least one field should be provided for update.',
};

const SupplierInvoiceItemApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    supplierInvoiceId: { type: 'integer' },
    productId: { type: 'integer', nullable: true },
    productSku: { type: 'string', nullable: true },
    productName: { type: 'string', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    productVariantSku: { type: 'string', nullable: true },
    productVariantName: { type: 'string', nullable: true },
    description: { type: 'string' },
    quantity: { type: 'number', format: 'double' },
    unitPriceHt: { type: 'number', format: 'double' },
    vatRatePercentage: { type: 'number', format: 'float', nullable: true },
    totalLineAmountHt: {
      type: 'number',
      format: 'double',
      description: 'Calculated: quantity * unitPriceHt',
    },
    purchaseReceptionItemId: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// For updating a Supplier Invoice header and potentially its items
const UpdateSupplierInvoiceItemsArrayInputSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID of existing item to update. Omit for new items.' },
    // Properties from CreateSupplierInvoiceItemInput for new/updated items
    productId: { type: 'integer', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    description: { type: 'string', minLength: 1, maxLength: 1000 },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitPriceHt: { type: 'number', format: 'double', minimum: 0 },
    vatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
    },
    purchaseReceptionItemId: { type: 'integer', nullable: true },
    _delete: { type: 'boolean', description: 'Set to true to mark this item for deletion.' },
  },
};

export const supplierInvoiceSchemas = {
  CreateSupplierInvoiceItemInput: CreateSupplierInvoiceItemInputSchema,
  UpdateSupplierInvoiceItemInput: UpdateSupplierInvoiceItemInputSchema,
  SupplierInvoiceItemApiResponse: SupplierInvoiceItemApiResponseSchema,

  CreateSupplierInvoiceInput: {
    type: 'object',
    required: ['invoiceNumber', 'supplierId', 'invoiceDate', 'currencyId', 'items'],
    properties: {
      invoiceNumber: { type: 'string', minLength: 1, maxLength: 100, example: 'INV-2025-1050' },
      supplierId: { type: 'integer', example: 1 },
      invoiceDate: { type: 'string', format: 'date', example: '2025-06-20' },
      dueDate: { type: 'string', format: 'date', nullable: true, example: '2025-07-20' },
      currencyId: { type: 'integer', example: 1 },
      status: {
        type: 'string',
        enum: Object.values(SupplierInvoiceStatus),
        default: 'pending_payment',
        example: 'pending_payment',
      },
      notes: { type: 'string', nullable: true, example: 'Facture pour la commande PO-XYZ.' },
      fileAttachmentUrl: {
        type: 'string',
        format: 'url',
        maxLength: 2048,
        nullable: true,
        example: 'https://example.com/invoices/inv-2025-1050.pdf',
      },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateSupplierInvoiceItemInput' },
        minItems: 1,
      },
      purchaseOrderIds: {
        type: 'array',
        items: { type: 'integer' },
        nullable: true,
        example: [1, 2],
        description: 'Array of Purchase Order IDs this invoice relates to.',
      },
    },
  },
  UpdateSupplierInvoiceInput: {
    type: 'object',
    properties: {
      invoiceNumber: { type: 'string', minLength: 1, maxLength: 100 },
      invoiceDate: { type: 'string', format: 'date' },
      dueDate: { type: 'string', format: 'date', nullable: true },
      currencyId: { type: 'integer' }, // Usually not changed if items/totals exist
      status: { type: 'string', enum: Object.values(SupplierInvoiceStatus) }, // Better via dedicated status endpoint
      notes: { type: 'string', nullable: true },
      fileAttachmentUrl: { type: 'string', format: 'url', maxLength: 2048, nullable: true },
      items: {
        type: 'array',
        items: UpdateSupplierInvoiceItemsArrayInputSchema,
        description:
          'Array of items. Allows adding, updating, or deleting items if invoice is in DRAFT status.',
      },
      purchaseOrderIds: {
        // To update linked POs
        type: 'array',
        items: { type: 'integer' },
        nullable: true,
      },
    },
  },
  SupplierInvoiceApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      invoiceNumber: { type: 'string', example: 'INV-2025-1050' },
      supplierId: { type: 'integer', example: 1 },
      supplier: { allOf: [EmbeddedSupplierDTORef], nullable: true },
      invoiceDate: { type: 'string', format: 'date-time', nullable: true },
      dueDate: { type: 'string', format: 'date-time', nullable: true },
      currencyId: { type: 'integer', example: 1 },
      currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
      totalAmountHt: { type: 'number', format: 'double' },
      totalVatAmount: { type: 'number', format: 'double' },
      totalAmountTtc: { type: 'number', format: 'double' },
      amountPaid: { type: 'number', format: 'double', default: 0 },
      status: {
        type: 'string',
        enum: Object.values(SupplierInvoiceStatus),
        example: 'pending_payment',
      },
      notes: { type: 'string', nullable: true },
      fileAttachmentUrl: { type: 'string', format: 'url', nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/SupplierInvoiceItemApiResponse' },
        nullable: true,
      },
      purchaseOrderLinks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            purchaseOrderId: { type: 'integer' },
            purchaseOrderNumber: { type: 'string', nullable: true },
          },
        },
        nullable: true,
      },
      createdByUserId: { type: 'integer', nullable: true },
      createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
