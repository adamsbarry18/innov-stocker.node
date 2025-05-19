export const companySchemas = {
  UpdateCompanyInput: {
    type: 'object',
    required: ['name', 'addressId', 'email', 'defaultCurrencyId', 'timezone'],
    properties: {
      name: { type: 'string', minLength: 1 },
      tradingName: { type: 'string', nullable: true },
      addressId: { type: 'integer', description: 'ID of an existing address record' },
      vatNumber: { type: 'string', nullable: true },
      siretNumber: { type: 'string', nullable: true },
      registrationNumber: { type: 'string', nullable: true },
      email: { type: 'string', format: 'email' },
      phoneNumber: { type: 'string', nullable: true },
      website: { type: 'string', format: 'url', nullable: true },
      logoUrl: { type: 'string', format: 'url', nullable: true },
      defaultCurrencyId: { type: 'integer', description: 'ID of an existing currency record' },
      defaultVatRatePercentage: {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 100,
        nullable: true,
      },
      fiscalYearStartMonth: { type: 'integer', minimum: 1, maximum: 12, nullable: true },
      fiscalYearStartDay: { type: 'integer', minimum: 1, maximum: 31, nullable: true },
      timezone: { type: 'string', minLength: 1 },
      termsAndConditionsDefaultPurchase: { type: 'string', nullable: true },
      termsAndConditionsDefaultSale: { type: 'string', nullable: true },
      bankAccountDetailsForInvoices: { type: 'string', nullable: true },
    },
  },
  CompanyApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string' },
      tradingName: { type: 'string', nullable: true },
      address: {
        type: 'object',
        nullable: true,
        description:
          'Full address object or null' /* $ref: '#/components/schemas/AddressApiResponse' */,
      }, // Référencez si AddressApiResponse est défini
      vatNumber: { type: 'string', nullable: true },
      siretNumber: { type: 'string', nullable: true },
      registrationNumber: { type: 'string', nullable: true },
      email: { type: 'string', format: 'email' },
      phoneNumber: { type: 'string', nullable: true },
      website: { type: 'string', format: 'url', nullable: true },
      logoUrl: { type: 'string', format: 'url', nullable: true },
      defaultCurrency: {
        type: 'object',
        nullable: true,
        description:
          'Full currency object or null' /* $ref: '#/components/schemas/CurrencyApiResponse' */,
      }, // Référencez
      defaultVatRatePercentage: { type: 'number', format: 'float', nullable: true },
      fiscalYearStartMonth: { type: 'integer', nullable: true },
      fiscalYearStartDay: { type: 'integer', nullable: true },
      timezone: { type: 'string' },
      termsAndConditionsDefaultPurchase: { type: 'string', nullable: true },
      termsAndConditionsDefaultSale: { type: 'string', nullable: true },
      bankAccountDetailsForInvoices: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
