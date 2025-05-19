// src/libs/openapi-schemas/customers/customer.schema.ts

// Re-using from supplier.schema.ts for brevity, or define them centrally
const EmbeddedAddressDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    streetLine1: { type: 'string' },
    streetLine2: { type: 'string', nullable: true },
    city: { type: 'string' },
    postalCode: { type: 'string' },
    stateProvince: { type: 'string', nullable: true },
    country: { type: 'string' },
    // notes: { type: 'string', nullable: true }, // From Address entity
    // createdAt: { type: 'string', format: 'date-time', nullable: true },
    // updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};
const EmbeddedCurrencyDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    code: { type: 'string' },
    name: { type: 'string' },
    symbol: { type: 'string' },
  },
};
const EmbeddedCustomerGroupDTOSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    discountPercentage: { type: 'number', format: 'float', nullable: true },
  },
};

const CreateAddressInputSchema = {
  // Simplified from address module for inline creation
  type: 'object',
  required: ['streetLine1', 'city', 'postalCode', 'country'],
  properties: {
    streetLine1: { type: 'string', minLength: 1, example: '123 Rue de Rivoli' },
    streetLine2: { type: 'string', nullable: true },
    city: { type: 'string', minLength: 1, example: 'Paris' },
    postalCode: { type: 'string', minLength: 1, example: '75001' },
    stateProvince: { type: 'string', nullable: true, example: 'Île-de-France' },
    country: { type: 'string', minLength: 1, example: 'France' },
    notes: { type: 'string', nullable: true },
  },
};

const CreateCustomerShippingAddressInputSchema = {
  type: 'object',
  required: ['addressLabel'],
  properties: {
    addressId: { type: 'integer', description: 'ID of an existing address to link.' },
    addressLabel: { type: 'string', minLength: 1, example: 'Maison' },
    isDefault: { type: 'boolean', default: false },
    newAddress: {
      $ref: '#/components/schemas/CreateAddressInput',
      description:
        'Provide if creating a new address instead of linking an existing one via addressId.',
    },
  },
  description: 'Either addressId or newAddress must be provided.',
  // Need to express oneOf logic or rely on service validation for (addressId XOR newAddress)
};

const UpdateCustomerShippingAddressInputSchema = {
  type: 'object',
  properties: {
    addressId: {
      type: 'integer',
      description: 'ID of an existing address to link (can be used to change the linked address).',
    },
    addressLabel: { type: 'string', minLength: 1, example: 'Bureau' },
    isDefault: { type: 'boolean' },
  },
};

const CustomerShippingAddressApiResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    customerId: { type: 'integer' },
    addressId: { type: 'integer' },
    address: { $ref: '#/components/schemas/EmbeddedAddressDTO', nullable: true },
    addressLabel: { type: 'string' },
    isDefault: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const customerSchemas = {
  CreateAddressInput: CreateAddressInputSchema, // Export if needed by other modules
  CreateCustomerShippingAddressInput: CreateCustomerShippingAddressInputSchema,
  UpdateCustomerShippingAddressInput: UpdateCustomerShippingAddressInputSchema,
  CustomerShippingAddressApiResponse: CustomerShippingAddressApiResponseSchema,
  EmbeddedAddressDTO: EmbeddedAddressDTOSchema, // Export if needed elsewhere
  EmbeddedCurrencyDTO: EmbeddedCurrencyDTOSchema,
  EmbeddedCustomerGroupDTO: EmbeddedCustomerGroupDTOSchema,

  CreateCustomerInput: {
    type: 'object',
    required: ['email', 'defaultCurrencyId', 'billingAddressId'],
    properties: {
      email: { type: 'string', format: 'email', example: 'client@example.com' },
      firstName: { type: 'string', nullable: true, example: 'Jean' },
      lastName: { type: 'string', nullable: true, example: 'Dupont' },
      companyName: { type: 'string', nullable: true, example: 'Ma Petite Entreprise' },
      phoneNumber: { type: 'string', nullable: true, example: '0102030405' },
      vatNumber: { type: 'string', nullable: true, example: 'FRXX123456789' },
      siretNumber: { type: 'string', nullable: true, example: '12345678900010' },
      defaultCurrencyId: { type: 'integer', example: 1, description: 'ID of an existing currency' },
      defaultPaymentTermsDays: { type: 'integer', minimum: 0, nullable: true, example: 30 },
      creditLimit: { type: 'number', format: 'float', minimum: 0, nullable: true, example: 1000.0 },
      customerGroupId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of an existing customer group',
      },
      billingAddressId: {
        type: 'integer',
        example: 1,
        description: 'ID of an existing address for billing',
      },
      newBillingAddress: {
        $ref: '#/components/schemas/CreateAddressInput',
        description: 'Provide to create a new billing address instead of using billingAddressId.',
      },
      defaultShippingAddressId: {
        type: 'integer',
        nullable: true,
        example: 2,
        description: 'ID of an existing address for default shipping',
      },
      newDefaultShippingAddress: {
        $ref: '#/components/schemas/CreateAddressInput',
        description:
          'Provide to create a new default shipping address instead of using defaultShippingAddressId.',
      },
      notes: { type: 'string', nullable: true },
      shippingAddresses: {
        type: 'array',
        items: { $ref: '#/components/schemas/CreateCustomerShippingAddressInput' },
        nullable: true,
        description: 'Array of initial shipping addresses to create and link.',
      },
    },
    description:
      'Either companyName or (firstName AND lastName) must be provided. Either billingAddressId or newBillingAddress must be provided. Similarly for default shipping address if specified.',
  },
  UpdateCustomerInput: {
    type: 'object',
    properties: {
      // All fields optional
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string', nullable: true },
      lastName: { type: 'string', nullable: true },
      companyName: { type: 'string', nullable: true },
      phoneNumber: { type: 'string', nullable: true },
      vatNumber: { type: 'string', nullable: true },
      siretNumber: { type: 'string', nullable: true },
      defaultCurrencyId: { type: 'integer' },
      defaultPaymentTermsDays: { type: 'integer', minimum: 0, nullable: true },
      creditLimit: { type: 'number', format: 'float', minimum: 0, nullable: true },
      customerGroupId: { type: 'integer', nullable: true },
      billingAddressId: { type: 'integer' },
      defaultShippingAddressId: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
    },
  },
  CustomerApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      email: { type: 'string', format: 'email', example: 'client@example.com' },
      firstName: { type: 'string', nullable: true, example: 'Jean' },
      lastName: { type: 'string', nullable: true, example: 'Dupont' },
      companyName: { type: 'string', nullable: true, example: 'Ma Petite Entreprise' },
      displayName: { type: 'string', example: 'Ma Petite Entreprise' },
      phoneNumber: { type: 'string', nullable: true, example: '0102030405' },
      vatNumber: { type: 'string', nullable: true, example: 'FRXX123456789' },
      siretNumber: { type: 'string', nullable: true, example: '12345678900010' },
      defaultCurrencyId: { type: 'integer', example: 1 },
      defaultCurrency: { $ref: '#/components/schemas/EmbeddedCurrencyDTO', nullable: true },
      defaultPaymentTermsDays: { type: 'integer', nullable: true, example: 30 },
      creditLimit: { type: 'number', format: 'float', nullable: true, example: 1000.0 },
      customerGroupId: { type: 'integer', nullable: true, example: 1 },
      customerGroup: { $ref: '#/components/schemas/EmbeddedCustomerGroupDTO', nullable: true },
      billingAddressId: { type: 'integer', example: 1 },
      billingAddress: { $ref: '#/components/schemas/EmbeddedAddressDTO', nullable: true },
      defaultShippingAddressId: { type: 'integer', nullable: true, example: 2 },
      defaultShippingAddress: { $ref: '#/components/schemas/EmbeddedAddressDTO', nullable: true },
      shippingAddresses: {
        type: 'array',
        items: { $ref: '#/components/schemas/CustomerShippingAddressApiResponse' },
        nullable: true,
      },
      notes: { type: 'string', nullable: true },
      createdByUserId: { type: 'integer', nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
