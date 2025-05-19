export const addressSchemas = {
  CreateAddressInput: {
    type: 'object',
    required: ['streetLine1', 'city', 'postalCode', 'country'],
    properties: {
      streetLine1: { type: 'string', minLength: 1, maxLength: 255, example: '123 Rue Principale' },
      streetLine2: { type: 'string', maxLength: 255, nullable: true, example: 'Appartement 4B' },
      city: { type: 'string', minLength: 1, maxLength: 255, example: 'Paris' },
      postalCode: { type: 'string', minLength: 1, maxLength: 20, example: '75001' },
      stateProvince: { type: 'string', maxLength: 255, nullable: true, example: 'Île-de-France' },
      country: { type: 'string', minLength: 1, maxLength: 255, example: 'France' },
      notes: { type: 'string', nullable: true, example: 'Entrée par la cour' },
    },
  },
  UpdateAddressInput: {
    type: 'object',
    properties: {
      streetLine1: { type: 'string', minLength: 1, maxLength: 255 },
      streetLine2: { type: 'string', maxLength: 255, nullable: true },
      city: { type: 'string', minLength: 1, maxLength: 255 },
      postalCode: { type: 'string', minLength: 1, maxLength: 20 },
      stateProvince: { type: 'string', maxLength: 255, nullable: true },
      country: { type: 'string', minLength: 1, maxLength: 255 },
      notes: { type: 'string', nullable: true },
    },
  },
  AddressApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      streetLine1: { type: 'string', example: '123 Rue Principale' },
      streetLine2: { type: 'string', nullable: true, example: 'Appartement 4B' },
      city: { type: 'string', example: 'Paris' },
      postalCode: { type: 'string', example: '75001' },
      stateProvince: { type: 'string', nullable: true, example: 'Île-de-France' },
      country: { type: 'string', example: 'France' },
      notes: { type: 'string', nullable: true, example: 'Entrée par la cour' },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  // Vous devrez ajouter ces références de paramètres communs à votre fichier OpenAPI principal
  // si ce n'est pas déjà fait, pour que $ref fonctionne dans les routes.
  // CommonParameterRefs: { // Juste pour l'exemple, à placer dans un fichier central de schémas
  //   PageQueryParam: {
  //     name: 'page',
  //     in: 'query',
  //     schema: { type: 'integer', default: 1 },
  //     description: 'Page number for pagination',
  //   },
  //   LimitQueryParam: {
  //     name: 'limit',
  //     in: 'query',
  //     schema: { type: 'integer', default: 20 },
  //     description: 'Number of items per page',
  //   },
  //   SortByQueryParam: {
  //     name: 'sortBy',
  //     in: 'query',
  //     schema: { type: 'string' },
  //     description: 'Field to sort by (e.g., "createdAt")',
  //   },
  //   OrderQueryParam: {
  //     name: 'order',
  //     in: 'query',
  //     schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  //     description: 'Sort order',
  //   },
  // },
};
