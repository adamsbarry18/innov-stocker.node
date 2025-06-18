import { ImportEntityType, ImportStatus } from '@/modules/imports/models/import.entity';

const CreateProductInputRef = { $ref: '#/components/schemas/CreateProductInput' };
const CreateProductCategoryInputRef = { $ref: '#/components/schemas/CreateProductCategoryInput' };
const CreateCustomerInputRef = { $ref: '#/components/schemas/CreateCustomerInput' };
const CreateSupplierInputRef = { $ref: '#/components/schemas/CreateSupplierInput' };
const CreateSalesOrderInputRef = { $ref: '#/components/schemas/CreateSalesOrderInput' };
const CreatePurchaseOrderInputRef = { $ref: '#/components/schemas/CreatePurchaseOrderInput' };
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

// ===== SCHÉMAS D'INPUT =====
const BaseImportInputSchema = {
  type: 'object',
  required: ['data'],
  properties: {
    originalFileName: { type: 'string', nullable: true, example: 'my_data.csv' },
  },
};

const ImportOpeningStockItemSchema = {
  type: 'object',
  required: ['productId', 'locationId', 'locationType', 'quantity', 'unitCost'],
  properties: {
    productId: { type: 'integer' },
    productVariantId: { type: 'integer', nullable: true },
    locationId: { type: 'integer', description: 'ID of the warehouse or shop.' },
    locationType: { type: 'string', enum: ['warehouse', 'shop'] },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
    unitCost: {
      type: 'number',
      format: 'double',
      minimum: 0,
      description: 'Cost of the item for stock valuation.',
    },
  },
};

export const importSchemas = {
  ImportProductsInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreateProductInputRef },
    },
  },
  ImportProductCategoriesInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreateProductCategoryInputRef },
    },
  },
  ImportCustomersInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreateCustomerInputRef },
    },
  },
  ImportSuppliersInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreateSupplierInputRef },
    },
  },
  ImportSalesOrdersInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreateSalesOrderInputRef },
    },
  },
  ImportPurchaseOrdersInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: CreatePurchaseOrderInputRef },
    },
  },
  ImportOpeningStockInput: {
    ...BaseImportInputSchema,
    properties: {
      ...BaseImportInputSchema.properties,
      data: { type: 'array', items: ImportOpeningStockItemSchema },
    },
  },

  // ===== SCHÉMAS DE RÉPONSE =====
  ImportSummaryResponseContent: {
    type: 'object',
    properties: {
      totalRows: { type: 'integer', example: 52 },
      successfullyImported: { type: 'integer', example: 50 },
      failedRowsCount: { type: 'integer', example: 2 },
    },
  },
  FailedRowDetail: {
    type: 'object',
    properties: {
      row: { type: 'integer', example: 5 },
      data: {
        type: 'object',
        additionalProperties: true,
        description: 'The original data for the failed row.',
      },
      error: { type: 'string', example: "SKU 'ABC-123' already exists." },
    },
  },
  ImportBatchApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1, description: 'The ID of the import batch job.' },
      entityType: { type: 'string', enum: Object.values(ImportEntityType), example: 'product' },
      status: { type: 'string', enum: Object.values(ImportStatus), example: 'processing' },
      summary: {
        allOf: [{ $ref: '#/components/schemas/ImportSummaryResponseContent' }],
        nullable: true,
      },
      errorDetails: {
        type: 'array',
        nullable: true,
        items: { $ref: '#/components/schemas/FailedRowDetail' },
      },
      criticalError: {
        type: 'string',
        nullable: true,
        description: 'A system-level error message if the entire batch failed unexpectedly.',
      },
      originalFileName: { type: 'string', nullable: true },
      initiatedByUserId: { type: 'integer' },
      initiatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
};
