export const customerGroupSchemas = {
  CreateCustomerGroupInput: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, example: 'Clients VIP' },
      description: {
        type: 'string',
        nullable: true,
        example: "Clients avec un volume d'achat élevé.",
      },
      discountPercentage: {
        type: 'number',
        format: 'float', // Ou double, selon votre spec
        minimum: 0,
        maximum: 100,
        nullable: true,
        default: 0.0,
        example: 10.5,
        description: 'Pourcentage de réduction appliqué à ce groupe.',
      },
    },
  },
  UpdateCustomerGroupInput: {
    type: 'object',
    properties: {
      // All fields are optional for update
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', nullable: true },
      discountPercentage: {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 100,
        nullable: true,
      },
    },
  },
  CustomerGroupApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Clients VIP' },
      description: {
        type: 'string',
        nullable: true,
        example: "Clients avec un volume d'achat élevé.",
      },
      discountPercentage: { type: 'number', format: 'float', nullable: true, example: 10.5 },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
