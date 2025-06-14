import { UserActionType } from '@/modules/users/models/users.entity';

// Assuming EmbeddedUserDTO is defined globally
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

export const userActivityLogSchemas = {
  CreateUserActivityLogInput: {
    type: 'object',
    required: ['userId', 'UserActionType', 'entityType'],
    properties: {
      userId: { type: 'integer', description: 'ID of the user performing the action.' },
      UserActionType: {
        type: 'string',
        enum: Object.values(UserActionType),
        description: 'The type of action performed.',
      },
      entityType: {
        type: 'string',
        maxLength: 100,
        example: 'Product',
        description: 'The type of entity that was affected.',
      },
      entityId: {
        type: 'string',
        maxLength: 100,
        nullable: true,
        example: '123',
        description: 'The ID of the entity that was affected.',
      },
      details: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
        example: { oldStatus: 'draft', newStatus: 'approved', changedFields: ['status'] },
        description: 'A JSON object containing details about the change (e.g., old/new values).',
      },
      ipAddress: {
        type: 'string',
        format: 'ipv4',
        nullable: true,
        example: '192.168.1.100',
        description: 'The IP address from which the action was performed.',
      },
    },
  },

  UserActivityLogApiResponse: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        example: 9876543210,
        description: 'Log entry ID (BIGINT).',
      },
      userId: { type: 'integer', example: 1 },
      user: { allOf: [EmbeddedUserDTORef], nullable: true },
      UserActionType: { type: 'string', enum: Object.values(UserActionType), example: 'update' },
      entityType: { type: 'string', example: 'SalesOrder' },
      entityId: { type: 'string', nullable: true, example: 'SO-20250620-00001' },
      details: {
        type: 'object',
        additionalProperties: true,
        nullable: true,
        example: { field: 'status', oldValue: 'draft', newValue: 'approved' },
      },
      ipAddress: { type: 'string', format: 'ipv4', nullable: true },
      timestamp: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Timestamp when the action was logged.',
      },
    },
  },
};
