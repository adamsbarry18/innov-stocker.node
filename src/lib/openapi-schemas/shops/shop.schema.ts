// Assuming CreateAddressInput, EmbeddedAddressDTO, EmbeddedUserDTO are defined globally
// or imported if they are in their respective schema files.
// eslint-disable-next-line @typescript-eslint/naming-convention
const CreateAddressInputRef = { $ref: '#/components/schemas/CreateAddressInput' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedAddressDTORef = { $ref: '#/components/schemas/EmbeddedAddressDTO' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

export const shopSchemas = {
  CreateShopInput: {
    type: 'object',
    required: ['name'], // addressId or newAddress logic handled in service
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, example: 'Boutique du Centre Ville' },
      code: { type: 'string', maxLength: 50, nullable: true, example: 'SHOP-CTR-01' },
      addressId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of an existing address. Required if newAddress is not provided.',
      },
      newAddress: {
        allOf: [CreateAddressInputRef],
        description:
          'Provide to create a new address for the shop. Required if addressId is not provided.',
      },
      managerId: {
        type: 'integer',
        nullable: true,
        example: 2,
        description: 'ID of the user managing this shop.',
      },
      openingHoursNotes: { type: 'string', nullable: true, example: 'Lun-Sam: 9h-19h, Dim: Fermé' },
    },
  },
  UpdateShopInput: {
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
      managerId: {
        type: 'integer',
        nullable: true,
        description: 'ID of the new manager. Set to null to remove manager.',
      },
      openingHoursNotes: { type: 'string', nullable: true },
    },
  },
  ShopApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Boutique du Centre Ville' },
      code: { type: 'string', nullable: true, example: 'SHOP-CTR-01' },
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
      openingHoursNotes: { type: 'string', nullable: true, example: 'Lun-Sam: 9h-19h, Dim: Fermé' },
      createdByUserId: { type: 'integer', nullable: true },
      updatedByUserId: { type: 'integer', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
