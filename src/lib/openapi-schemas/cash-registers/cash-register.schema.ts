// src/libs/openapi-schemas/cash-registers/cash_register.schema.ts

// Assuming EmbeddedShopDTO and EmbeddedCurrencyDTO are defined globally or imported
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedShopDTORef = { $ref: '#/components/schemas/EmbeddedShopDTO' }; // Define this if not already
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };

export const cashRegisterSchemas = {
  // Example for EmbeddedShopDTO (define globally or import from shops.schema.ts)
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _EmbeddedShopDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Boutique du Centre' },
      code: { type: 'string', nullable: true, example: 'SHOP-CTR' },
    },
  },
  CreateCashRegisterInput: {
    type: 'object',
    required: ['name', 'currencyId'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        example: 'Caisse Principale - Boutique Centre',
      },
      shopId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of an existing shop. Can be null if not tied to a specific shop.',
      },
      currencyId: {
        type: 'integer',
        example: 1,
        description: 'ID of an existing currency for this cash register.',
      },
      isActive: { type: 'boolean', default: true, example: true },
    },
  },
  UpdateCashRegisterInput: {
    type: 'object',
    properties: {
      // All fields optional
      name: { type: 'string', minLength: 1, maxLength: 255 },
      shopId: {
        type: 'integer',
        nullable: true,
        description: 'ID of an existing shop. Set to null to unassign.',
      },
      // currencyId is typically not changed for an existing cash register
      isActive: { type: 'boolean' },
    },
  },
  CashRegisterApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Caisse Principale - Boutique Centre' },
      shopId: { type: 'integer', nullable: true, example: 1 },
      shop: {
        allOf: [EmbeddedShopDTORef],
        nullable: true,
      },
      currencyId: { type: 'integer', example: 1 },
      currency: {
        allOf: [EmbeddedCurrencyDTORef],
        nullable: true,
      },
      currentBalance: {
        type: 'number',
        format: 'double',
        example: 150.75,
        description: 'Current calculated balance.',
      },
      isActive: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
