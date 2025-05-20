import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '../../../common/models/Model';
import { Shop } from '../../shops/models/shop.entity';
import { Currency, CurrencyApiResponse } from '../../currencies/models/currency.entity';

// DTO simplifié pour Shop (si besoin d'être embarqué)
type EmbeddedShopApiResponse = {
  id: number;
  name: string;
  code: string | null;
};

// Zod Schema for validation
const cashRegisterSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Cash register name is required.' }).max(255),
  shopId: z.number().int().positive().nullable().optional(),
  currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
  // currentBalance est généralement calculé, pas un champ d'input direct à la création/màj via ce DTO
  isActive: z.boolean().optional().default(true),
});

// Type for creating a cash register
export type CreateCashRegisterInput = {
  name: string;
  shopId?: number | null;
  currencyId: number;
  // initialBalance might be set implicitly to 0 or via a specific "open session" operation
  isActive?: boolean;
};

// Type for updating a cash register
export type UpdateCashRegisterInput = Partial<Omit<CreateCashRegisterInput, 'currencyId'>>; // On ne change généralement pas la devise d'une caisse existante

// Type for API response (DTO)
export type CashRegisterApiResponse = {
  id: number;
  name: string;
  shopId: number | null;
  shop?: EmbeddedShopApiResponse | null; // Populated
  currencyId: number;
  currency?: CurrencyApiResponse | null; // Populated
  currentBalance: number; // Calculé et stocké
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const cashRegisterValidationInputErrors: string[] = [];

@Entity({ name: 'cash_registers' })
@Unique('uq_cash_register_name', ['name'])
export class CashRegister extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int', name: 'shop_id', nullable: true })
  shopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'SET NULL', nullable: true }) // Si la boutique est supprimée, la caisse n'est plus liée
  @JoinColumn({ name: 'shop_id' })
  shop: Shop | null = null;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' }) // Une caisse doit avoir une devise valide
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0.0, name: 'current_balance' })
  currentBalance: number = 0; // Mis à jour par les sessions de caisse et transactions

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean = true;

  // createdByUserId, updatedByUserId pourraient être ajoutés si nécessaire pour l'audit

  toApi(): CashRegisterApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      shopId: this.shopId,
      shop: this.shop
        ? {
            id: this.shop.id,
            name: this.shop.name,
            code: this.shop.code,
          }
        : null,
      currencyId: this.currencyId,
      currency: this.currency ? this.currency.toApi() : null,
      currentBalance: Number(this.currentBalance),
      isActive: this.isActive,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = cashRegisterSchemaValidation.safeParse(this);
    cashRegisterValidationInputErrors.length = 0;

    if (!result.success) {
      cashRegisterValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
