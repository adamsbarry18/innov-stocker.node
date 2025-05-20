// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateAddressInputRef = { $ref: '#/components/schemas/CreateAddressInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };

export const customerShippingAddressSchemas = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _CreateAddressInput_example: {
    type: 'object',
    required: ['streetLine1', 'city', 'postalCode', 'country'],
    properties: {
      streetLine1: { type: 'string', example: '123 Rue Example' },
      streetLine2: { type: 'string', nullable: true },
      city: { type: 'string', example: 'VilleExemple' },
      postalCode: { type: 'string', example: '75000' },
      stateProvince: { type: 'string', nullable: true },
      country: { type: 'string', example: 'France' },
      notes: { type: 'string', nullable: true },
    },
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _EmbeddedAddressDTO_example: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      streetLine1: { type: 'string' },
      streetLine2: { type: 'string', nullable: true },
      city: { type: 'string' },
      postalCode: { type: 'string' },
      stateProvince: { type: 'string', nullable: true },
      country: { type: 'string' },
      notes: { type: 'string', nullable: true },
    },
  },

  CreateCustomerShippingAddressInput: {
    type: 'object',
    required: ['customerId', 'addressLabel'],
    properties: {
      customerId: { type: 'integer', description: 'ID of the customer this address belongs to.' },
      addressId: {
        type: 'integer',
        nullable: true,
        description: 'ID of an existing address to link. Omit if providing newAddress.',
      },
      addressLabel: { type: 'string', minLength: 1, example: 'Maison Principale' },
      isDefault: { type: 'boolean', default: false, example: false },
      newAddress: {
        allOf: [CreateAddressInputRef],
        description: 'Provide if creating a new address instead of linking via addressId.',
      },
    },
    description:
      'Links an address to a customer. Either addressId (for existing address) or newAddress (to create one) must be provided.',
  },
  UpdateCustomerShippingAddressInput: {
    type: 'object',
    properties: {
      addressId: {
        type: 'integer',
        nullable: true,
        description: 'ID of an existing address to change the link to.',
      },
      addressLabel: { type: 'string', minLength: 1, example: 'Bureau' },
      isDefault: { type: 'boolean', example: true },
    },
    description:
      'At least one field should be provided for update. Updating addressId re-links to a different physical address.',
  },
  CustomerShippingAddressApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 101 },
      customerId: { type: 'integer', example: 1 },
      addressId: { type: 'integer', example: 5 },
      address: {
        allOf: [EmbeddedAddressDTORef],
        nullable: true,
      },
      addressLabel: { type: 'string', example: 'Maison Principale' },
      isDefault: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
