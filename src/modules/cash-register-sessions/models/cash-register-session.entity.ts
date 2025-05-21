import { Model } from '@/common/models/Model';
import { CashRegister } from '@/modules/cash-registers/models/cash-register.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';

export enum CashRegisterSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

// Zod Schema for validation
const cashRegisterSessionSchemaValidation = z.object({
  cashRegisterId: z.number().int().positive({ message: 'Cash register ID is required.' }),
  openedByUserId: z.number().int().positive({ message: 'Opening user ID is required.' }),
  closedByUserId: z.number().int().positive().nullable().optional(),
  openingTimestamp: z.date({ required_error: 'Opening timestamp is required.' }),
  closingTimestamp: z.date().nullable().optional(),
  openingBalance: z.number().min(0, { message: 'Opening balance cannot be negative.' }),
  closingBalanceTheoretical: z.number().nullable().optional(),
  closingBalanceActual: z.number().nullable().optional(),
  status: z.nativeEnum(CashRegisterSessionStatus),
  notes: z.string().nullable().optional(),
});

// Type for creating a session (opening a cash register)
export type OpenCashRegisterSessionInput = {
  cashRegisterId: number;
  openingBalance: number;
  notes?: string | null;
};

// Type for closing a session
export type CloseCashRegisterSessionInput = {
  closingBalanceActual: number;
  notes?: string | null;
};

// Type for API response (DTO)
export type CashRegisterSessionApiResponse = {
  id: number;
  cashRegisterId: number;
  cashRegisterName?: string;
  openedByUserId: number;
  openedByUser?: UserApiResponse | null;
  closedByUserId: number | null;
  closedByUser?: UserApiResponse | null;
  openingTimestamp: string | null;
  closingTimestamp: string | null;
  openingBalance: number;
  closingBalanceTheoretical: number | null;
  closingBalanceActual: number | null;
  differenceAmount: number | null;
  status: CashRegisterSessionStatus;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const cashRegisterSessionValidationInputErrors: string[] = [];

@Entity({ name: 'cash_register_sessions' })
@Index(['cashRegisterId', 'status'])
export class CashRegisterSession extends Model {
  @Column({ type: 'int', name: 'cash_register_id' })
  cashRegisterId!: number;

  @ManyToOne(() => CashRegister, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_register_id' })
  cashRegister!: CashRegister;

  @Column({ type: 'int', name: 'opened_by_user_id' })
  openedByUserId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opened_by_user_id' })
  openedByUser!: User;

  @Column({ type: 'int', name: 'closed_by_user_id', nullable: true })
  closedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'closed_by_user_id' })
  closedByUser: User | null = null;

  @Column({ type: 'timestamp', name: 'opening_timestamp', default: () => 'CURRENT_TIMESTAMP' })
  openingTimestamp!: Date;

  @Column({ type: 'timestamp', name: 'closing_timestamp', nullable: true })
  closingTimestamp: Date | null = null;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'opening_balance' })
  openingBalance!: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'closing_balance_theoretical',
    nullable: true,
  })
  closingBalanceTheoretical: number | null = null; // Calculé par le service

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'closing_balance_actual',
    nullable: true,
  })
  closingBalanceActual: number | null = null;

  // La colonne SQL a `GENERATED ALWAYS AS (IFNULL(closing_balance_actual,0) - IFNULL(closing_balance_theoretical,0)) STORED`
  // TypeORM ne gère pas bien les colonnes générées pour les opérations d'écriture directes.
  // Nous allons le calculer dans le service et le stocker si la DB ne le fait pas, ou le lire si elle le fait.
  // Pour la lecture, si c'est `STORED`, il sera là. Si `VIRTUAL`, il faut le calculer.
  // On va supposer que la DB le stocke ou que le service le met à jour après calcul.
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    name: 'difference_amount',
    nullable: true, // Peut être null si non applicable ou non calculé
    // generatedType: 'STORED', // Si la base le gère. Non standardisé pour TypeORM.
    // asExpression: 'IFNULL(closing_balance_actual,0) - IFNULL(closing_balance_theoretical,0)'
  })
  differenceAmount: number | null = null;

  @Column({
    type: 'varchar', // Ou 'enum'
    length: 10,
    enum: CashRegisterSessionStatus,
    default: CashRegisterSessionStatus.OPEN,
  })
  status!: CashRegisterSessionStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  toApi(): CashRegisterSessionApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      cashRegisterId: this.cashRegisterId,
      cashRegisterName: this.cashRegister?.name,
      openedByUserId: this.openedByUserId,
      openedByUser: this.openedByUser?.toApi(),
      closedByUserId: this.closedByUserId,
      closedByUser: this.closedByUser?.toApi(),
      openingTimestamp: Model.formatISODate(this.openingTimestamp),
      closingTimestamp: Model.formatISODate(this.closingTimestamp),
      openingBalance: Number(this.openingBalance),
      closingBalanceTheoretical:
        this.closingBalanceTheoretical !== null ? Number(this.closingBalanceTheoretical) : null,
      closingBalanceActual:
        this.closingBalanceActual !== null ? Number(this.closingBalanceActual) : null,
      differenceAmount: this.differenceAmount !== null ? Number(this.differenceAmount) : null,
      status: this.status,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = cashRegisterSessionSchemaValidation.safeParse({
      cashRegisterId: this.cashRegisterId,
      openedByUserId: this.openedByUserId,
      closedByUserId: this.closedByUserId,
      openingTimestamp: this.openingTimestamp,
      closingTimestamp: this.closingTimestamp,
      openingBalance: this.openingBalance,
      closingBalanceTheoretical: this.closingBalanceTheoretical,
      closingBalanceActual: this.closingBalanceActual,
      status: this.status,
      notes: this.notes,
    });
    cashRegisterSessionValidationInputErrors.length = 0;

    if (!result.success) {
      cashRegisterSessionValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.closingTimestamp && this.openingTimestamp > this.closingTimestamp) {
      cashRegisterSessionValidationInputErrors.push(
        'closingTimestamp: Closing timestamp cannot be before opening timestamp.',
      );
      return false;
    }
    if (
      this.status === CashRegisterSessionStatus.CLOSED &&
      (!this.closingTimestamp || this.closedByUserId === null || this.closingBalanceActual === null)
    ) {
      cashRegisterSessionValidationInputErrors.push(
        'status: For a closed session, closing timestamp, closing user, and actual closing balance are required.',
      );
      return false;
    }
    return true;
  }
}
