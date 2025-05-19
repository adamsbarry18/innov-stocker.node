export const currencySchemas = {
  CreateCurrencyInput: {
    type: 'object',
    required: ['code', 'name', 'symbol'],
    properties: {
      code: {
        type: 'string',
        length: 3,
        description: 'ISO 4217 currency code (e.g., EUR, USD)',
        example: 'EUR',
      },
      name: { type: 'string', minLength: 1, maxLength: 255, example: 'Euro' },
      symbol: { type: 'string', minLength: 1, maxLength: 10, example: '€' },
      exchangeRateToCompanyDefault: {
        type: 'number',
        format: 'float',
        minimum: 0,
        nullable: true,
        example: 1.0,
        description:
          'Exchange rate relative to the company default currency. If this IS the default, it should be 1.',
      },
      isActive: { type: 'boolean', default: true },
    },
  },
  UpdateCurrencyInput: {
    type: 'object',
    properties: {
      code: { type: 'string', length: 3, description: 'ISO 4217 currency code' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      symbol: { type: 'string', minLength: 1, maxLength: 10 },
      exchangeRateToCompanyDefault: { type: 'number', format: 'float', minimum: 0, nullable: true },
      isActive: { type: 'boolean' },
    },
  },
  CurrencyApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      code: { type: 'string', example: 'EUR' },
      name: { type: 'string', example: 'Euro' },
      symbol: { type: 'string', example: '€' },
      exchangeRateToCompanyDefault: {
        type: 'number',
        format: 'float',
        nullable: true,
        example: 1.0,
      },
      isActive: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
