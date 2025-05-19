export const productCategorySchemas = {
  CreateProductCategoryInput: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, example: 'Nouveaux Arrivages' },
      description: {
        type: 'string',
        nullable: true,
        example: 'Les derniers produits ajoutés à notre catalogue.',
      },
      imageUrl: {
        type: 'string',
        format: 'url',
        maxLength: 2048,
        nullable: true,
        example: 'https://example.com/images/new-arrivals.png',
      },
      parentCategoryId: {
        type: 'integer',
        nullable: true,
        example: 1,
        description: 'ID of the parent category if this is a sub-category.',
      },
    },
  },
  UpdateProductCategoryInput: {
    type: 'object',
    properties: {
      // All fields are optional for update
      name: { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', nullable: true },
      imageUrl: { type: 'string', format: 'url', maxLength: 2048, nullable: true },
      parentCategoryId: {
        type: 'integer',
        nullable: true,
        description: 'Set to null to make it a root category.',
      },
    },
  },
  ProductCategoryApiResponse: {
    // Base response, children handled by ProductCategoryTreeApiResponse or embedded
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Électronique' },
      description: {
        type: 'string',
        nullable: true,
        example: 'Appareils électroniques et gadgets',
      },
      imageUrl: {
        type: 'string',
        format: 'url',
        nullable: true,
        example: 'https://example.com/images/electronics.png',
      },
      parentCategoryId: { type: 'integer', nullable: true, example: null },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
      // 'children' could be added here if always returning a shallow tree
      // children: {
      //   type: 'array',
      //   items: { '$ref': '#/components/schemas/ProductCategoryApiResponse' }, // Recursive, but careful with depth
      //   nullable: true,
      // },
    },
  },
  // Specific schema for tree response items if different or to explicitly show recursion
  ProductCategoryTreeApiResponse: {
    allOf: [
      // Extends the base response
      { $ref: '#/components/schemas/ProductCategoryApiResponse' },
      {
        type: 'object',
        properties: {
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProductCategoryTreeApiResponse' }, // Recursive definition
            nullable: true,
            description: 'Nested child categories.',
          },
        },
      },
    ],
  },
};
