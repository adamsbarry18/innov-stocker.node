import { Model } from '@/common/models/Model';
import { Address } from '@/modules/addresses/models/address.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { User } from '@/modules/users/models/users.entity';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';

const supplierSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Supplier name is required.' }).max(255),
  contactPersonName: z.string().max(255).nullable().optional(),
  email: z.string().email({ message: 'Invalid email address.' }).max(255).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  website: z.string().url({ message: 'Invalid URL format.' }).max(2048).nullable().optional(),
  vatNumber: z.string().max(50).nullable().optional(),
  siretNumber: z.string().max(50).nullable().optional(),
  defaultCurrencyId: z.number().int().positive({ message: 'Default currency ID is required.' }),
  defaultPaymentTermsDays: z.number().int().min(0).nullable().optional(),
  addressId: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateSupplierInput = {
  name: string;
  contactPersonName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  siretNumber?: string | null;
  defaultCurrencyId: number;
  defaultPaymentTermsDays?: number | null;
  addressId?: number | null;
  notes?: string | null;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export type SupplierApiResponse = {
  id: number;
  name: string;
  contactPersonName: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  vatNumber: string | null;
  siretNumber: string | null;
  defaultCurrencyId: number;
  defaultCurrency?: CurrencyApiResponse | null;
  defaultPaymentTermsDays: number | null;
  addressId: number | null;
  address?: AddressApiResponse | null;
  notes: string | null;
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CurrencyApiResponse = {
  id: number;
  code: string;
  name: string;
  symbol: string;
};

type AddressApiResponse = {
  id: number;
  streetLine1: string;
  city: string;
  postalCode: string;
  country: string;
};

export const supplierValidationInputErrors: string[] = [];

@Entity({ name: 'suppliers' })
@Index(['email'], { where: '"email" IS NOT NULL', unique: true })
export class Supplier extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'contact_person_name' })
  contactPersonName: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'phone_number' })
  phoneNumber: string | null = null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'vat_number' })
  vatNumber: string | null = null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'siret_number' })
  siretNumber: string | null = null;

  @Column({ type: 'int', name: 'default_currency_id' })
  defaultCurrencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'default_currency_id' })
  defaultCurrency!: Currency;

  @Column({ type: 'int', nullable: true, name: 'default_payment_terms_days' })
  defaultPaymentTermsDays: number | null = null;

  @Column({ type: 'int', nullable: true, name: 'address_id' })
  addressId: number | null = null;

  @ManyToOne(() => Address, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'int', nullable: true, name: 'created_by_user_id' })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @Column({ type: 'int', nullable: true, name: 'updated_by_user_id' })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  toApi(): SupplierApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      contactPersonName: this.contactPersonName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      website: this.website,
      vatNumber: this.vatNumber,
      siretNumber: this.siretNumber,
      defaultCurrencyId: this.defaultCurrencyId,
      defaultCurrency: this.defaultCurrency
        ? {
            id: this.defaultCurrency.id,
            code: this.defaultCurrency.code,
            name: this.defaultCurrency.name,
            symbol: this.defaultCurrency.symbol,
          }
        : null,
      defaultPaymentTermsDays: this.defaultPaymentTermsDays,
      addressId: this.addressId,
      address: this.address
        ? {
            id: this.address.id,
            streetLine1: this.address.streetLine1,
            city: this.address.city,
            postalCode: this.address.postalCode,
            country: this.address.country,
          }
        : null,
      notes: this.notes,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
    const result = supplierSchemaValidation.safeParse(this);
    supplierValidationInputErrors.length = 0;

    if (!result.success) {
      supplierValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
