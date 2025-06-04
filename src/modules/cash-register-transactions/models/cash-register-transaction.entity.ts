import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import {
  CashRegisterSession,
  CashRegisterSessionApiResponse,
} from '@/modules/cash-register-sessions/models/cash-register-session.entity';
import {
  PaymentMethod,
  PaymentMethodApiResponse,
} from '@/modules/payment-methods/models/payment-method.entity';
import {
  SalesOrder,
  SalesOrderApiResponse,
} from '@/modules/sales-orders/models/sales-order.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';

export enum CashRegisterTransactionType {
  CASH_IN_POS_SALE = 'cash_in_pos_sale', // Encaissement vente TPV
  CASH_OUT_EXPENSE = 'cash_out_expense', // Décaissement dépense
  CASH_IN_OTHER = 'cash_in_other', // Encaissement divers
  CASH_OUT_OTHER = 'cash_out_other', // Décaissement divers
  CASH_DEPOSIT_TO_BANK = 'cash_deposit_to_bank', // Sortie pour dépôt en banque
  CASH_WITHDRAWAL_FROM_BANK = 'cash_withdrawal_from_bank', // Entrée depuis retrait bancaire (fond de caisse)
  OPENING_FLOAT = 'opening_float', // Fond de caisse initial (ajouté à l'ouverture de session)
  CLOSING_REMOVAL = 'closing_removal', // Retrait de caisse à la clôture
}

// Zod Schema for validation (pour la création via DTO / service)
export const createCashRegisterTransactionSchema = z.object({
  cashRegisterSessionId: z.number().int().positive(),
  transactionTimestamp: z.coerce.date().optional(),
  type: z.nativeEnum(CashRegisterTransactionType),
  amount: z.number().positive({ message: 'Amount must be positive.' }),
  description: z.string().min(1, { message: 'Description is required.' }).max(1000),
  paymentMethodId: z.number().int().positive().nullable().optional(),
  relatedSalesOrderId: z.number().int().positive().nullable().optional(),
  userId: z.number().int().positive({ message: 'User ID for the transaction is required.' }),
});

export type CreateCashRegisterTransactionInput = z.infer<
  typeof createCashRegisterTransactionSchema
>;
// Les transactions de caisse sont généralement immuables. Pas de DTO de mise à jour directe.

export type CashRegisterTransactionApiResponse = {
  id: number;
  cashRegisterSessionId: number;
  cashRegisterSession?: CashRegisterSessionApiResponse | null;
  transactionTimestamp: string | null;
  type: CashRegisterTransactionType;
  amount: number;
  description: string;
  paymentMethodId: number | null;
  paymentMethod?: PaymentMethodApiResponse | null;
  relatedSalesOrderId: number | null;
  relatedSalesOrder?: SalesOrderApiResponse | null;
  userId: number;
  user?: UserApiResponse | null;
  createdAt: string | null;
  // Pas d'updatedAt car immuable (ou si Model l'impose)
};

@Entity({ name: 'cash_register_transactions' })
@Index(['cashRegisterSessionId', 'transactionTimestamp'])
@Index(['type'])
@Index(['relatedSalesOrderId'])
export class CashRegisterTransaction extends Model {
  @Column({ type: 'int', name: 'cash_register_session_id' })
  cashRegisterSessionId!: number;

  @ManyToOne(() => CashRegisterSession, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_register_session_id' })
  cashRegisterSession!: CashRegisterSession;

  @Column({ type: 'timestamp', name: 'transaction_timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transactionTimestamp!: Date;

  @Column({
    type: 'varchar',
    length: 30,
    enum: CashRegisterTransactionType,
    name: 'type',
  })
  type!: CashRegisterTransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  amount!: number;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int', name: 'payment_method_id', nullable: true })
  paymentMethodId: number | null = null;

  @ManyToOne(() => PaymentMethod, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod | null = null;

  @Column({ type: 'int', name: 'related_sales_order_id', nullable: true })
  relatedSalesOrderId: number | null = null;

  @ManyToOne(() => SalesOrder, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'related_sales_order_id' })
  relatedSalesOrder?: SalesOrder | null;

  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  toApi(): CashRegisterTransactionApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      cashRegisterSessionId: this.cashRegisterSessionId,
      cashRegisterSession: this.cashRegisterSession ? this.cashRegisterSession.toApi() : null,
      transactionTimestamp: Model.formatISODate(this.transactionTimestamp),
      type: this.type,
      amount: Number(this.amount),
      description: this.description,
      paymentMethodId: this.paymentMethodId,
      paymentMethod: this.paymentMethod ? this.paymentMethod.toApi() : null,
      relatedSalesOrderId: this.relatedSalesOrderId,
      relatedSalesOrder: this.relatedSalesOrder ? this.relatedSalesOrder.toApi() : null,
      userId: this.userId,
      user: this.user ? this.user.toApi() : null,
      createdAt: Model.formatISODate(this.createdAt),
      // updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValidBasic(): boolean {
    if (this.amount <= 0) return false;
    if (!this.description || this.description.trim() === '') return false;
    return true;
  }
}
