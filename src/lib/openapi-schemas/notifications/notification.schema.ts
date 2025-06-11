import { NotificationType } from '@/modules/notifications/models/notification.entity';

export const notificationSchemas = {
  UnreadCountResponse: {
    type: 'object',
    properties: {
      unreadCount: {
        type: 'integer',
        example: 5,
        description: 'The number of unread notifications for the user.',
      },
    },
  },

  NotificationApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 101 },
      userId: {
        type: 'integer',
        example: 1,
        description: 'The ID of the user this notification belongs to.',
      },
      message: { type: 'string', example: 'Your order SO-20250720-00123 has been shipped.' },
      type: { type: 'string', enum: Object.values(NotificationType), example: 'success' },
      isRead: { type: 'boolean', example: false },
      entityType: {
        type: 'string',
        nullable: true,
        example: 'sales_order',
        description: 'The type of entity this notification relates to.',
      },
      entityId: {
        type: ['string', 'number'],
        nullable: true,
        example: 56,
        description: 'The ID of the related entity.',
      },
      link: {
        type: 'string',
        nullable: true,
        example: '/sales-orders/56',
        description: 'A suggested frontend navigation link for this notification.',
      },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  CreateNotificationInput: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Your order has been approved.' },
      type: { type: 'string', enum: Object.values(NotificationType), example: 'approval_request' },
      entityType: { type: 'string', nullable: true, example: 'purchase_order' },
      entityId: { type: ['string', 'number'], nullable: true, example: 123 },
    },
    required: ['message'],
  },
};
