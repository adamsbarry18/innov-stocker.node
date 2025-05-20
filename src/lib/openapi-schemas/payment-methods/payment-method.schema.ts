import { PaymentMethodType } from '@/modules/payment-methods/models/payment-method.entity';

export const paymentMethodSchemas = {
  CreatePaymentMethodInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100, example: 'Carte de Crédit Visa' },
      type: {
        type: 'string',
        enum: Object.values(PaymentMethodType), // Utilise l'enum pour les valeurs possibles
        example: PaymentMethodType.CARD,
      },
      isActive: { type: 'boolean', default: true, example: true },
    },
  },
  UpdatePaymentMethodInput: {
    type: 'object',
    properties: {
      // All fields optional
      name: { type: 'string', minLength: 1, maxLength: 100 },
      type: {
        type: 'string',
        enum: Object.values(PaymentMethodType),
      },
      isActive: { type: 'boolean' },
    },
  },
  PaymentMethodApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'Carte de Crédit Visa' },
      type: {
        type: 'string',
        enum: Object.values(PaymentMethodType),
        example: PaymentMethodType.CARD,
      },
      isActive: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
