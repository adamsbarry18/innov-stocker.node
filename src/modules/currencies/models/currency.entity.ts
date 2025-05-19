import { Model } from '@/common/models/Model';
import { Entity, Column, Unique } from 'typeorm';
import { z } from 'zod';

// Zod Schema for validation
const currencySchemaValidation = z.object({
  code: z.string().length(3, { message: 'Currency code must be 3 characters long.' }).toUpperCase(),
  name: z.string().min(1, { message: 'Currency name is required.' }).max(255),
  symbol: z.string().min(1, { message: 'Currency symbol is required.' }).max(10),
  exchangeRateToCompanyDefault: z
    .number({
      invalid_type_error: 'Exchange rate must be a number.',
    })
    .positive({ message: 'Exchange rate must be positive.' })
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

// Type for creating a currency
export type CreateCurrencyInput = z.infer<typeof currencySchemaValidation>;

// Type for updating a currency (all fields optional)
export type UpdateCurrencyInput = Partial<CreateCurrencyInput>;

// Type for API response (DTO)
export type CurrencyApiResponse = {
  id: number;
  code: string;
  name: string;
  symbol: string;
  exchangeRateToCompanyDefault: number | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const currencyValidationInputErrors: string[] = [];

@Entity({ name: 'currencies' })
@Unique(['code'])
export class Currency extends Model {
  @Column({ type: 'varchar', length: 3 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 10 })
  symbol!: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 6,
    name: 'exchange_rate_to_company_default',
    nullable: true,
  })
  exchangeRateToCompanyDefault: number | null = 1.0;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean = true;

  /**
   * Formats the entity for an API response.
   * @returns The formatted currency object for API.
   */
  toApi(): CurrencyApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      code: this.code,
      name: this.name,
      symbol: this.symbol,
      exchangeRateToCompanyDefault:
        this.exchangeRateToCompanyDefault !== null
          ? Number(this.exchangeRateToCompanyDefault)
          : null,
      isActive: this.isActive,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  /**
   * Validates the entity's attributes using Zod.
   * @returns True if valid, false otherwise. Errors are stored in currencyValidationInputErrors.
   */
  isValid(): boolean {
    if (this.code) {
      this.code = this.code.toUpperCase();
    }
    const result = currencySchemaValidation.safeParse(this);
    currencyValidationInputErrors.length = 0;

    if (!result.success) {
      currencyValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
