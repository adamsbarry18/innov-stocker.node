import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Currency, CurrencyApiResponse } from '../../currencies/models/currency.entity';
// Zod Schema for validation
const bankAccountSchemaValidation = z.object({
  accountName: z.string().min(1, { message: 'Account name is required.' }).max(255),
  bankName: z.string().min(1, { message: 'Bank name is required.' }).max(255),
  accountNumber: z.string().max(100).nullable().optional(),
  iban: z.string().max(50).nullable().optional(),
  swiftBic: z.string().max(20).nullable().optional(),
  currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
  initialBalance: z.number().optional().default(0),
});

// Type for creating a bank account
export type CreateBankAccountInput = {
  accountName: string;
  bankName: string;
  accountNumber?: string | null;
  iban?: string | null;
  swiftBic?: string | null;
  currencyId: number;
  initialBalance?: number; // Peut être 0 par défaut
};

// Type for updating a bank account
export type UpdateBankAccountInput = Partial<Omit<CreateBankAccountInput, 'initialBalance'>>;

// Type for API response (DTO)
export type BankAccountApiResponse = {
  id: number;
  accountName: string;
  bankName: string;
  accountNumber: string | null;
  iban: string | null;
  swiftBic: string | null;
  currencyId: number;
  currency?: CurrencyApiResponse | null; // Populated
  initialBalance: number;
  currentBalance: number; // Calculé et stocké
  createdAt: string | null;
  updatedAt: string | null;
};

export const bankAccountValidationInputErrors: string[] = [];

@Entity({ name: 'bank_accounts' })
@Unique('uq_bank_account_name', ['accountName'])
@Unique('uq_bank_account_iban', ['iban'])
export class BankAccount extends Model {
  @Column({ type: 'varchar', length: 255, name: 'account_name' })
  accountName!: string;

  @Column({ type: 'varchar', length: 255, name: 'bank_name' })
  bankName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'account_number' })
  accountNumber: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  iban: string | null = null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'swift_bic' })
  swiftBic: string | null = null;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0.0, name: 'initial_balance' })
  initialBalance: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0.0, name: 'current_balance' })
  currentBalance: number = 0; // Sera mis à jour par des transactions/logique applicative

  // createdByUserId, updatedByUserId pourraient être ajoutés si nécessaire pour l'audit
  // @Column({ type: 'int', nullable: true, name: 'created_by_user_id' })
  // createdByUserId: number | null = null;
  // @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  // @JoinColumn({ name: 'created_by_user_id' })
  // createdByUser?: User | null;

  toApi(): BankAccountApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      accountName: this.accountName,
      bankName: this.bankName,
      accountNumber: this.accountNumber,
      iban: this.iban,
      swiftBic: this.swiftBic,
      currencyId: this.currencyId,
      currency: this.currency?.toApi(),
      initialBalance: Number(this.initialBalance),
      currentBalance: Number(this.currentBalance),
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = bankAccountSchemaValidation.safeParse(this);
    bankAccountValidationInputErrors.length = 0;

    if (!result.success) {
      bankAccountValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.iban && this.accountNumber && this.iban === this.accountNumber) {
      bankAccountValidationInputErrors.push(
        'IBAN and Account Number should not be identical unless intended.',
      );
    }
    return true;
  }
}
