import { ProductStatus } from '@/modules/products/models/product.entity';

// Références (supposons qu'ils sont définis globalement ou importés d'autres fichiers schema)
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/UserInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/CreateCurrencyInput' };

// --- ProductImage Schemas ---
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductImageInput = {
  type: 'object',
  required: ['imageUrl'],
  properties: {
    imageUrl: {
      type: 'string',
      format: 'url',
      example: 'https://example.com/image.jpg',
      description: 'URL of the uploaded image',
    },
    altText: { type: 'string', nullable: true, maxLength: 255, example: 'Primary product view' },
    isPrimary: { type: 'boolean', default: false, example: true },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateProductImageInput = {
  type: 'object',
  properties: {
    altText: { type: 'string', nullable: true, maxLength: 255 },
    isPrimary: { type: 'boolean' },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const ProductImageApiResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    productId: { type: 'integer' },
    imageUrl: { type: 'string', format: 'url' },
    altText: { type: 'string', nullable: true },
    isPrimary: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- ProductVariant Schemas ---
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductVariantInput = {
  type: 'object',
  required: ['skuVariant', 'nameVariant', 'attributes'],
  properties: {
    skuVariant: { type: 'string', minLength: 1, maxLength: 150, example: 'PROD-001-RED-XL' },
    nameVariant: { type: 'string', minLength: 1, maxLength: 255, example: 'T-Shirt Rouge XL' },
    attributes: {
      type: 'object',
      additionalProperties: true,
      example: { couleur: 'Rouge', taille: 'XL' },
    },
    purchasePrice: { type: 'number', format: 'double', minimum: 0, nullable: true },
    sellingPriceHt: { type: 'number', format: 'double', minimum: 0, nullable: true },
    barcodeQrCodeVariant: { type: 'string', maxLength: 255, nullable: true },
    minStockLevelVariant: { type: 'integer', minimum: 0, default: 0 },
    maxStockLevelVariant: { type: 'integer', minimum: 0, nullable: true },
    weightVariant: { type: 'number', format: 'double', minimum: 0, nullable: true },
    imageId: {
      type: 'integer',
      nullable: true,
      description:
        'ID of an existing product images record to associate specifically with this variant',
    },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateProductVariantInput = {
  type: 'object',
  properties: CreateProductVariantInput.properties,
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const ProductVariantApiResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    productId: { type: 'integer' },
    skuVariant: { type: 'string' },
    nameVariant: { type: 'string' },
    attributes: { type: 'object', additionalProperties: true },
    purchasePrice: { type: 'number', format: 'double', nullable: true },
    sellingPriceHt: { type: 'number', format: 'double', nullable: true },
    barcodeQrCodeVariant: { type: 'string', nullable: true },
    minStockLevelVariant: { type: 'integer' },
    maxStockLevelVariant: { type: 'integer', nullable: true },
    weightVariant: { type: 'number', format: 'double', nullable: true },
    imageId: { type: 'integer', nullable: true },
    image: { allOf: [ProductImageApiResponse], nullable: true }, // Use ProductImageApiResponse
    // productSuppliers: { type: 'array', items: { '$ref': '\#/components/schemas/ProductSupplierApiResponse' }, nullable: true}, // If including suppliers directly in variant
    createdByUserId: { type: 'integer', nullable: true },
    updatedByUserId: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- CompositeProductItem Schemas ---
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateCompositeProductItemInput = {
  type: 'object',
  required: ['componentProductId', 'quantity'],
  properties: {
    componentProductId: { type: 'integer', description: 'ID of the product that is a component' },
    componentVariantId: {
      type: 'integer',
      nullable: true,
      description: 'ID of the variant if the component is a specific variant',
    },
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateCompositeProductItemInput = {
  // Only quantity updatable usually
  type: 'object',
  required: ['quantity'],
  properties: {
    quantity: { type: 'number', format: 'double', minimum: 0.001 },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const CompositeProductItemApiResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    compositeProductId: { type: 'integer' },
    componentProductId: { type: 'integer' },
    componentProductName: { type: 'string', nullable: true },
    componentVariantId: { type: 'integer', nullable: true },
    componentVariantName: { type: 'string', nullable: true },
    quantity: { type: 'number', format: 'double' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- ProductSupplier Schemas ---
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductSupplierInput = {
  // Base, used by more specific inputs
  type: 'object',
  required: ['supplierId', 'purchasePrice', 'currencyId'],
  properties: {
    supplierId: { type: 'integer' },
    supplierProductCode: { type: 'string', maxLength: 100, nullable: true },
    purchasePrice: { type: 'number', format: 'double', minimum: 0 },
    currencyId: { type: 'integer' },
    isDefaultSupplier: { type: 'boolean', default: false },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductSupplierForProductInput = {
  allOf: [
    { $ref: '#/components/schemas/CreateProductSupplierInput' },
    { type: 'object', required: ['productId'], properties: { productId: { type: 'integer' } } },
  ],
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductSupplierForVariantInput = {
  allOf: [
    { $ref: '#/components/schemas/CreateProductSupplierInput' },
    {
      type: 'object',
      required: ['productVariantId'],
      properties: { productVariantId: { type: 'integer' } },
    },
  ],
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateProductSupplierInput = {
  type: 'object',
  properties: {
    // supplierId, productId, variantId are not updatable on link record
    supplierProductCode: { type: 'string', maxLength: 100, nullable: true },
    purchasePrice: { type: 'number', format: 'double', minimum: 0 },
    currencyId: { type: 'integer' },
    isDefaultSupplier: { type: 'boolean' },
  },
};
// Simplified Embedded DTOs
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedSupplierDTOSchema = {
  type: 'object',
  properties: { id: { type: 'integer' }, name: { type: 'string' } },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const ProductSupplierApiResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    productId: { type: 'integer', nullable: true },
    productVariantId: { type: 'integer', nullable: true },
    supplierId: { type: 'integer' },
    supplier: { allOf: [EmbeddedSupplierDTOSchema], nullable: true },
    supplierProductCode: { type: 'string', nullable: true },
    purchasePrice: { type: 'number', format: 'double' },
    currencyId: { type: 'integer' },
    currency: { allOf: [EmbeddedCurrencyDTORef], nullable: true },
    isDefaultSupplier: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

// --- Product Core Schemas ---
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateProductInput = {
  type: 'object',
  required: ['sku', 'name', 'productCategoryId', 'unitOfMeasure'],
  properties: {
    sku: { type: 'string', minLength: 1, maxLength: 100, example: 'SKU001' },
    name: { type: 'string', minLength: 1, maxLength: 255, example: 'Super Produit X' },
    description: {
      type: 'string',
      nullable: true,
      example: 'Description détaillée du super produit.',
    },
    productCategoryId: {
      type: 'integer',
      example: 1,
      description: 'ID of an existing product category',
    },
    unitOfMeasure: { type: 'string', minLength: 1, maxLength: 50, example: 'pièce' },
    weight: { type: 'number', format: 'double', minimum: 0, nullable: true, example: 1.5 },
    weightUnit: { type: 'string', maxLength: 10, nullable: true, example: 'kg' },
    length: { type: 'number', format: 'double', minimum: 0, nullable: true, example: 10.0 },
    width: { type: 'number', format: 'double', minimum: 0, nullable: true, example: 5.0 },
    height: { type: 'number', format: 'double', minimum: 0, nullable: true, example: 2.0 },
    dimensionUnit: { type: 'string', maxLength: 10, nullable: true, example: 'cm' },
    barcodeQrCode: { type: 'string', maxLength: 255, nullable: true, example: '1234567890123' },
    minStockLevel: { type: 'integer', minimum: 0, default: 0, example: 10 },
    maxStockLevel: { type: 'integer', minimum: 0, nullable: true, example: 100 },
    defaultPurchasePrice: {
      type: 'number',
      format: 'double',
      minimum: 0,
      nullable: true,
      example: 50.75,
    },
    defaultSellingPriceHt: {
      type: 'number',
      format: 'double',
      minimum: 0,
      nullable: true,
      example: 99.99,
    },
    defaultVatRatePercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      nullable: true,
      example: 20.0,
    },
    status: {
      type: 'string',
      enum: Object.values(ProductStatus),
      default: 'active',
      example: 'active',
    },
    isCompositeProduct: { type: 'boolean', default: false, example: false },
    notes: { type: 'string', nullable: true },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const UpdateProductInput = { type: 'object', properties: CreateProductInput.properties };

// Simplified Category DTO for embedding
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedProductCategoryDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    parentCategoryId: { type: 'integer', nullable: true },
  },
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const ProductApiResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    sku: { type: 'string', example: 'SKU001' },
    name: { type: 'string', example: 'Super Produit X' },
    description: { type: 'string', nullable: true },
    productCategoryId: { type: 'integer', example: 1 },
    productCategory: { allOf: [EmbeddedProductCategoryDTOSchema], nullable: true },
    unitOfMeasure: { type: 'string', example: 'pièce' },
    weight: { type: 'number', format: 'double', nullable: true },
    weightUnit: { type: 'string', nullable: true },
    length: { type: 'number', format: 'double', nullable: true },
    width: { type: 'number', format: 'double', nullable: true },
    height: { type: 'number', format: 'double', nullable: true },
    dimensionUnit: { type: 'string', nullable: true },
    barcodeQrCode: { type: 'string', nullable: true },
    minStockLevel: { type: 'integer' },
    maxStockLevel: { type: 'integer', nullable: true },
    defaultPurchasePrice: { type: 'number', format: 'double', nullable: true },
    defaultSellingPriceHt: { type: 'number', format: 'double', nullable: true },
    defaultVatRatePercentage: { type: 'number', format: 'float', nullable: true },
    status: { type: 'string', enum: Object.values(ProductStatus) },
    isCompositeProduct: { type: 'boolean' },
    notes: { type: 'string', nullable: true },
    images: {
      type: 'array',
      items: { $ref: '#/components/schemas/ProductImageApiResponse' },
      nullable: true,
    },
    variants: {
      type: 'array',
      items: { $ref: '#/components/schemas/ProductVariantApiResponse' },
      nullable: true,
    },
    productSuppliers: {
      type: 'array',
      items: { $ref: '#/components/schemas/ProductSupplierApiResponse' },
      nullable: true,
    },
    components: {
      type: 'array',
      items: { $ref: '#/components/schemas/CompositeProductItemApiResponse' },
      nullable: true,
    },
    createdByUserId: { type: 'integer', nullable: true },
    createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
    updatedByUserId: { type: 'integer', nullable: true },
    updatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const productSchemas = {
  CreateProductInput,
  UpdateProductInput,
  ProductApiResponse,
  CreateProductImageInput,
  UpdateProductImageInput,
  ProductImageApiResponse,
  CreateProductVariantInput,
  UpdateProductVariantInput,
  ProductVariantApiResponse,
  CreateCompositeProductItemInput,
  UpdateCompositeProductItemInput,
  CompositeProductItemApiResponse,
  CreateProductSupplierInput, // Base
  CreateProductSupplierForProductInput,
  CreateProductSupplierForVariantInput,
  UpdateProductSupplierInput,
  ProductSupplierApiResponse,
  // For referencing in other schemas if needed:
  _EmbeddedProductCategoryDTO: EmbeddedProductCategoryDTOSchema,
  _EmbeddedSupplierDTO: EmbeddedSupplierDTOSchema,
};
