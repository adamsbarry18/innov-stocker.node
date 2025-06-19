const embeddedShopDTORef = { $ref: '#/components/schemas/CreateShopInput' };
const embeddedCurrencyDTORef = { $ref: '#/components/schemas/CreateCurrencyInput' };

export const cashRegisterSchemas = {
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
        allOf: [embeddedShopDTORef],
        nullable: true,
      },
      currencyId: { type: 'integer', example: 1 },
      currency: {
        allOf: [embeddedCurrencyDTORef],
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
