import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { z } from 'zod';
import { Address } from '../../addresses/models/address.entity';
import { Currency } from '../../currencies/models/currency.entity';
import { AddressApiResponse } from '../../addresses/models/address.entity';
import { CurrencyApiResponse } from '../../currencies/models/currency.entity';
import { Model } from '@/common/models/Model';

// DTO pour la mise à jour (pas de création directe pour une entité mono-enregistrement)
export type UpdateCompanyInput = {
  name: string;
  tradingName?: string | null;
  addressId: number;
  vatNumber?: string | null;
  siretNumber?: string | null;
  registrationNumber?: string | null;
  email: string;
  phoneNumber?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  defaultCurrencyId: number;
  defaultVatRatePercentage?: number | null;
  fiscalYearStartMonth?: number | null;
  fiscalYearStartDay?: number | null;
  timezone: string;
  termsAndConditionsDefaultPurchase?: string | null;
  termsAndConditionsDefaultSale?: string | null;
  bankAccountDetailsForInvoices?: string | null;
};

// DTO pour la réponse API
export type CompanyApiResponse = {
  id: number;
  name: string;
  tradingName: string | null;
  address: AddressApiResponse | null;
  vatNumber: string | null;
  siretNumber: string | null;
  registrationNumber: string | null;
  email: string;
  phoneNumber: string | null;
  website: string | null;
  logoUrl: string | null;
  defaultCurrency: CurrencyApiResponse | null;
  defaultVatRatePercentage: number | null;
  fiscalYearStartMonth: number | null;
  fiscalYearStartDay: number | null;
  timezone: string;
  termsAndConditionsDefaultPurchase: string | null;
  termsAndConditionsDefaultSale: string | null;
  bankAccountDetailsForInvoices: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const companyValidationInputErrors: string[] = [];

@Entity({ name: 'company' })
export class Company extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'trading_name' })
  tradingName: string | null = null;

  @Column({ type: 'int', name: 'address_id' })
  addressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' }) // eager: true pour charger l'adresse automatiquement
  @JoinColumn({ name: 'address_id' })
  address!: Address;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'vat_number' })
  vatNumber: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'siret_number' })
  siretNumber: string | null = null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'registration_number' })
  registrationNumber: string | null = null;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'phone_number' })
  phoneNumber: string | null = null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website: string | null = null;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'logo_url' })
  logoUrl: string | null = null;

  @Column({ type: 'int', name: 'default_currency_id' })
  defaultCurrencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'default_currency_id' })
  defaultCurrency!: Currency;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'default_vat_rate_percentage',
  })
  defaultVatRatePercentage: number | null = null;

  @Column({ type: 'int', nullable: true, name: 'fiscal_year_start_month' })
  fiscalYearStartMonth: number | null = null;

  @Column({ type: 'int', nullable: true, name: 'fiscal_year_start_day' })
  fiscalYearStartDay: number | null = null;

  @Column({ type: 'varchar', length: 100, default: 'Europe/Paris' })
  timezone!: string;

  @Column({ type: 'text', nullable: true, name: 'terms_and_conditions_default_purchase' })
  termsAndConditionsDefaultPurchase: string | null = null;

  @Column({ type: 'text', nullable: true, name: 'terms_and_conditions_default_sale' })
  termsAndConditionsDefaultSale: string | null = null;

  @Column({ type: 'text', nullable: true, name: 'bank_account_details_for_invoices' })
  bankAccountDetailsForInvoices: string | null = null;

  toApi(): CompanyApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      tradingName: this.tradingName,
      address: this.address ? this.address.toApi() : null,
      vatNumber: this.vatNumber,
      siretNumber: this.siretNumber,
      registrationNumber: this.registrationNumber,
      email: this.email,
      phoneNumber: this.phoneNumber,
      website: this.website,
      logoUrl: this.logoUrl,
      defaultCurrency: this.defaultCurrency ? this.defaultCurrency.toApi() : null,
      defaultVatRatePercentage: this.defaultVatRatePercentage,
      fiscalYearStartMonth: this.fiscalYearStartMonth,
      fiscalYearStartDay: this.fiscalYearStartDay,
      timezone: this.timezone,
      termsAndConditionsDefaultPurchase: this.termsAndConditionsDefaultPurchase,
      termsAndConditionsDefaultSale: this.termsAndConditionsDefaultSale,
      bankAccountDetailsForInvoices: this.bankAccountDetailsForInvoices,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const companyValidationSchema = z.object({
      name: z.string().min(1, { message: 'Company name is required.' }),
      email: z.string().email({ message: 'Invalid email address for company.' }),
      addressId: z.number().int().positive({ message: 'Address ID is required.' }),
      defaultCurrencyId: z.number().int().positive({ message: 'Default Currency ID is required.' }),
      timezone: z.string().min(1, { message: 'Timezone is required.' }),
      defaultVatRatePercentage: z.number().min(0).max(100).nullable().optional(),
      fiscalYearStartMonth: z.number().int().min(1).max(12).nullable().optional(),
      fiscalYearStartDay: z.number().int().min(1).max(31).nullable().optional(),
    });

    const result = companyValidationSchema.safeParse({
      name: this.name,
      email: this.email,
      addressId: this.addressId,
      defaultCurrencyId: this.defaultCurrencyId,
      timezone: this.timezone,
      defaultVatRatePercentage: this.defaultVatRatePercentage,
      fiscalYearStartMonth: this.fiscalYearStartMonth,
      fiscalYearStartDay: this.fiscalYearStartDay,
    });

    companyValidationInputErrors.length = 0;
    if (!result.success) {
      companyValidationInputErrors.push(
        ...result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
      return false;
    }
    return true;
  }
}
