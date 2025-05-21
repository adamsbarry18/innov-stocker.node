import { CashRegisterSessionStatus } from '@/modules/cash-register-sessions/models/cash-register-session.entity';

// Assumes EmbeddedUserDTO is defined globally
// eslint-disable-next-line @typescript-eslint/naming-convention
const EmbeddedUserDTORef = { $ref: '#/components/schemas/EmbeddedUserDTO' };

export const cashRegisterSessionSchemas = {
  OpenCashRegisterSessionInput: {
    type: 'object',
    required: ['cashRegisterId', 'openingBalance'],
    properties: {
      cashRegisterId: {
        type: 'integer',
        example: 1,
        description: 'ID of the cash register to open a session for.',
      },
      openingBalance: {
        type: 'number',
        format: 'double',
        minimum: 0,
        example: 100.0,
        description: 'The initial cash amount in the register.',
      },
      notes: { type: 'string', nullable: true, example: 'Session de début de journée' },
    },
  },
  CloseCashRegisterSessionInput: {
    type: 'object',
    required: ['closingBalanceActual'],
    properties: {
      closingBalanceActual: {
        type: 'number',
        format: 'double',
        minimum: 0,
        example: 575.5,
        description: 'The actual cash amount counted at closing.',
      },
      notes: {
        type: 'string',
        nullable: true,
        example: 'Clôture de fin de journée, écart de -0.50 constaté.',
      },
    },
  },
  CashRegisterSessionApiResponse: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      cashRegisterId: { type: 'integer', example: 1 },
      cashRegisterName: { type: 'string', example: 'Caisse Principale', nullable: true },
      openedByUserId: { type: 'integer', example: 1 },
      openedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      closedByUserId: { type: 'integer', nullable: true, example: 1 },
      closedByUser: { allOf: [EmbeddedUserDTORef], nullable: true },
      openingTimestamp: { type: 'string', format: 'date-time', example: '2025-05-21T09:00:00Z' },
      closingTimestamp: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        example: '2025-05-21T18:00:00Z',
      },
      openingBalance: { type: 'number', format: 'double', example: 100.0 },
      closingBalanceTheoretical: {
        type: 'number',
        format: 'double',
        nullable: true,
        example: 576.0,
        description: 'Calculated: opening + cash_in - cash_out',
      },
      closingBalanceActual: { type: 'number', format: 'double', nullable: true, example: 575.5 },
      differenceAmount: {
        type: 'number',
        format: 'double',
        nullable: true,
        example: -0.5,
        description: 'Calculated: actual - theoretical',
      },
      status: { type: 'string', enum: Object.values(CashRegisterSessionStatus), example: 'closed' },
      notes: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
};
