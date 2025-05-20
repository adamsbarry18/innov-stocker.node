// Assumes CreateAddressInput, EmbeddedAddressDTO, EmbeddedUserDTO are defined globally
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateAddressInputRef = { $ref: '#/components/schemas/CreateAddressInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' }; // User DTO (id, name, email)

export const warehouseSchemas = {
  CreateWarehouseInput: {
    type: 'object',
    required: ['name'], // addressId or newAddress will be required by service logic
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, example: 'Entrepôt Central Paris' },
      code: { type: 'string', maxLength: 50, nullable: true, example: 'WHS-PAR-001' },
      addressId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of an existing address. Required if newAddress is not provided.',
      },
      newAddress: {
        allOf: [CreateAddressInputRef],
        description:
          'Provide to create a new address for the warehouse. Required if addressId is not provided.',
      },
      managerId: {
        type: 'integer',
        nullable: true,
        example: 2,
        description: 'ID of the user managing this warehouse.',
      },
      capacityNotes: {
        type: 'string',
        nullable: true,
        example: 'Capacité: 500 palettes, 2 quais de chargement.',
      },
    },
  },
  UpdateWarehouseInput: {
    type: 'object',
    properties: {
      // All fields optional
      name: { type: 'string', minLength: 1, maxLength: 255 },
      code: { type: 'string', maxLength: 50, nullable: true },
      addressId: {
        type: 'integer',
        nullable: true,
        description: 'ID of an existing address to change to.',
      },
      // newAddress is not typically part of an update DTO for an existing warehouse, address update is separate
      managerId: {
        type: 'integer',
        nullable: true,
        description: 'ID of the new manager. Set to null to remove manager.',
      },
      capacityNotes: { type: 'string', nullable: true },
    },
  },
  WarehouseApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Entrepôt Central Paris' },
      code: { type: 'string', nullable: true, example: 'WHS-PAR-001' },
      addressId: { type: 'integer', example: 1 },
      address: {
        allOf: [EmbeddedAddressDTORef],
        nullable: true,
      },
      managerId: { type: 'integer', nullable: true, example: 2 },
      manager: {
        allOf: [EmbeddedUserDTORef],
        nullable: true,
      },
      capacityNotes: {
        type: 'string',
        nullable: true,
        example: 'Capacité: 500 palettes, 2 quais de chargement.',
      },
      createdByUserId: { type: 'integer', nullable: true },
      // createdByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      // updatedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
