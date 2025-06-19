import { Address, CreateAddressInput } from '@/modules/addresses/models/address.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { CustomerGroup } from '@/modules/customer-groups/models/customer-group.entity';
import { User } from '@/modules/users';
import {
  CreateCustomerShippingAddressInput,
  CustomerShippingAddress,
  CustomerShippingAddressApiResponse,
} from '@/modules/customer-shipping-address';
// Zod Schema for validation
const customerSchemaValidation = z
  .object({
    email: z.string().email({ message: 'Invalid email address.' }).max(255),
    firstName: z.string().max(255).nullable().optional(),
    lastName: z.string().max(255).nullable().optional(),
    companyName: z.string().max(255).nullable().optional(),
    phoneNumber: z.string().max(50).nullable().optional(),
    vatNumber: z.string().max(50).nullable().optional(),
    siretNumber: z.string().max(50).nullable().optional(),
    defaultCurrencyId: z.number().int().positive({ message: 'Default currency ID is required.' }),
    defaultPaymentTermsDays: z.number().int().min(0).nullable().optional(),
    creditLimit: z.number().min(0).nullable().optional(),
    customerGroupId: z.number().int().positive().nullable().optional(),
    billingAddressId: z.number().int().positive({ message: 'Billing address ID is required.' }),
    defaultShippingAddressId: z.number().int().positive().nullable().optional(), // Points to an Address.id
    notes: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.companyName && (!data.firstName || !data.lastName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either company name or both first name and last name are required.',
        path: ['companyName'], // Or relevant path
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either company name or both first name and last name are required.',
        path: ['firstName'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either company name or both first name and last name are required.',
        path: ['lastName'],
      });
    }
  });

export type CreateCustomerInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  phoneNumber?: string | null;
  vatNumber?: string | null;
  siretNumber?: string | null;
  defaultCurrencyId: number;
  defaultPaymentTermsDays?: number | null;
  creditLimit?: number | null;
  customerGroupId?: number | null;
  billingAddressId: number;
  newBillingAddress?: CreateAddressInput;
  defaultShippingAddressId?: number | null;
  newDefaultShippingAddress?: CreateAddressInput;
  notes?: string | null;
  shippingAddresses?: Array<Omit<CreateCustomerShippingAddressInput, 'customerId'>>;
};

export type UpdateCustomerInput = Partial<
  Omit<CreateCustomerInput, 'newBillingAddress' | 'newDefaultShippingAddress' | 'shippingAddresses'>
>;

type EmbeddedCurrencyApiResponse = { id: number; code: string; symbol: string; name: string };
type EmbeddedAddressApiResponse = {
  id: number;
  streetLine1: string;
  city: string;
  postalCode: string;
  country: string;
  streetLine2: string | null;
  stateProvince: string | null;
  notes: string | null;
};
type EmbeddedCustomerGroupApiResponse = {
  id: number;
  name: string;
  discountPercentage: number | null;
};

export type CustomerApiResponse = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  displayName: string;
  phoneNumber: string | null;
  vatNumber: string | null;
  siretNumber: string | null;
  defaultCurrencyId: number;
  defaultCurrency?: EmbeddedCurrencyApiResponse | null;
  defaultPaymentTermsDays: number | null;
  creditLimit: number | null;
  customerGroupId: number | null;
  customerGroup?: EmbeddedCustomerGroupApiResponse | null;
  billingAddressId: number;
  billingAddress?: EmbeddedAddressApiResponse | null;
  defaultShippingAddressId: number | null;
  defaultShippingAddress?: EmbeddedAddressApiResponse | null;
  shippingAddresses?: CustomerShippingAddressApiResponse[];
  notes: string | null;
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerValidationInputErrors: string[] = [];

@Entity({ name: 'customers' })
@Index(['email'], { unique: true, where: '"deleted_time" IS NULL' })
export class Customer extends Model {
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'first_name' })
  firstName: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'last_name' })
  lastName: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_name' })
  companyName: string | null = null;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'phone_number' })
  phoneNumber: string | null = null;

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

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'credit_limit' })
  creditLimit: number | null = null;

  @Column({ type: 'int', nullable: true, name: 'customer_group_id' })
  customerGroupId: number | null = null;

  @ManyToOne(() => CustomerGroup, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_group_id' })
  customerGroup: CustomerGroup | null = null;

  @Column({ type: 'int', name: 'billing_address_id' })
  billingAddressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_address_id' })
  billingAddress!: Address;

  @Column({ type: 'int', nullable: true, name: 'default_shipping_address_id' })
  defaultShippingAddressId: number | null = null;

  @ManyToOne(() => Address, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'default_shipping_address_id' })
  defaultShippingAddress: Address | null = null;

  @OneToMany(() => CustomerShippingAddress, (shippingAddress) => shippingAddress.customer, {
    cascade: ['insert', 'update'],
  })
  shippingAddresses?: CustomerShippingAddress[];

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

  getDisplayName(): string {
    if (this.companyName) {
      return this.companyName;
    }
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.lastName) {
      return this.lastName;
    }
    return this.email;
  }

  toApi(): CustomerApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      companyName: this.companyName,
      displayName: this.getDisplayName(),
      phoneNumber: this.phoneNumber,
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
      creditLimit: this.creditLimit !== null ? Number(this.creditLimit) : null,
      customerGroupId: this.customerGroupId,
      customerGroup: this.customerGroup
        ? {
            id: this.customerGroup.id,
            name: this.customerGroup.name,
            discountPercentage:
              this.customerGroup.discountPercentage !== null
                ? Number(this.customerGroup.discountPercentage)
                : null,
          }
        : null,
      billingAddressId: this.billingAddressId,
      billingAddress: this.billingAddress ? this.billingAddress : null,
      defaultShippingAddressId: this.defaultShippingAddressId,
      shippingAddresses: this.shippingAddresses
        ? this.shippingAddresses.map((sa) => sa.toApi())
        : [],
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
    const result = customerSchemaValidation.safeParse(this);
    customerValidationInputErrors.length = 0;

    if (!result.success) {
      customerValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
