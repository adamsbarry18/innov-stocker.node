// src/libs/openapi-schemas/bank-accounts/bank_account.schema.ts

// Assuming EmbeddedCurrencyDTO is defined globally or imported
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedCurrencyDTORef = { $ref: '#/components/schemas/EmbeddedCurrencyDTO' };

export const bankAccountSchemas = {
  CreateBankAccountInput: {
    type: 'object',
    required: ['accountName', 'bankName', 'currencyId'],
    properties: {
      accountName: { type: 'string', minLength: 1, maxLength: 255, example: 'Compte Principal SG' },
      bankName: { type: 'string', minLength: 1, maxLength: 255, example: 'Société Générale' },
      accountNumber: { type: 'string', maxLength: 100, nullable: true, example: '00123456789' },
      iban: {
        type: 'string',
        maxLength: 50,
        nullable: true,
        example: 'FR7630004000001234567890143',
      },
      swiftBic: { type: 'string', maxLength: 20, nullable: true, example: 'SOGEFRPP' },
      currencyId: { type: 'integer', example: 1, description: 'ID of an existing currency' },
      initialBalance: {
        type: 'number',
        format: 'double',
        default: 0,
        example: 10000.5,
        description: 'Initial balance of the account.',
      },
    },
  },
  UpdateBankAccountInput: {
    type: 'object',
    properties: {
      accountName: { type: 'string', minLength: 1, maxLength: 255 },
      bankName: { type: 'string', minLength: 1, maxLength: 255 },
      accountNumber: { type: 'string', maxLength: 100, nullable: true },
      iban: { type: 'string', maxLength: 50, nullable: true },
      swiftBic: { type: 'string', maxLength: 20, nullable: true },
      currencyId: {
        type: 'integer',
        description:
          'ID of an existing currency. Changing this for an existing account might have financial implications.',
      },
    },
  },
  BankAccountApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      accountName: { type: 'string', example: 'Compte Principal SG' },
      bankName: { type: 'string', example: 'Société Générale' },
      accountNumber: { type: 'string', nullable: true, example: '00123456789' },
      iban: { type: 'string', nullable: true, example: 'FR7630004000001234567890143' },
      swiftBic: { type: 'string', nullable: true, example: 'SOGEFRPP' },
      currencyId: { type: 'integer', example: 1 },
      currency: {
        allOf: [EmbeddedCurrencyDTORef],
        nullable: true,
      },
      initialBalance: { type: 'number', format: 'double', example: 10000.5 },
      currentBalance: {
        type: 'number',
        format: 'double',
        example: 12500.75,
        description: 'Current calculated balance.',
      },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
