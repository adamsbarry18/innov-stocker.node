import { Model } from '@/common/models/Model';
import { Address } from '@/modules/addresses/models/address.entity';
import { Customer } from '@/modules/customers/models/customer.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { z } from 'zod';

const baseCustomerShippingAddressSchema = z.object({
  customerId: z
    .number()
    .int()
    .positive({ message: 'Customer ID is required and must be a positive integer.' }),
  addressLabel: z.string().min(1, { message: 'Address label is required.' }).max(255),
  isDefault: z.boolean().optional().default(false),
});

export const createCustomerShippingAddressSchema = baseCustomerShippingAddressSchema.and(
  z.union([
    z.object({
      addressId: z.number().int().positive({ message: 'Address ID must be a positive integer.' }),
      newAddress: z.undefined().optional(),
    }),
    z.object({
      addressId: z.undefined().optional(),
      newAddress: z.object({
        streetLine1: z.string().min(1).max(255),
        streetLine2: z.string().max(255).nullable().optional(),
        city: z.string().min(1).max(255),
        postalCode: z.string().min(1).max(20),
        stateProvince: z.string().max(255).nullable().optional(),
        country: z.string().min(1).max(255),
        notes: z.string().nullable().optional(),
      }),
    }),
  ]),
);

export const updateCustomerShippingAddressSchema = z.object({
  addressId: z.number().int().positive().optional(),
  addressLabel: z
    .string()
    .min(1, { message: 'Address label is required if provided.' })
    .max(255)
    .optional(),
  isDefault: z.boolean().optional(),
});

export type CreateCustomerShippingAddressInput = z.infer<
  typeof createCustomerShippingAddressSchema
>;
export type UpdateCustomerShippingAddressInput = z.infer<
  typeof updateCustomerShippingAddressSchema
>;

export type EmbeddedAddressApiResponse = {
  id: number;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
  stateProvince: string | null;
  country: string;
  notes: string | null;
};

export type CustomerShippingAddressApiResponse = {
  id: number;
  customerId: number;
  addressId: number;
  address?: EmbeddedAddressApiResponse | null;
  addressLabel: string;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerShippingAddressValidationInputErrors: string[] = [];

@Entity({ name: 'customer_shipping_addresses' })
@Unique('uq_customer_address_link', ['customerId', 'addressId'])
@Unique('uq_customer_address_label', ['customerId', 'addressLabel'])
export class CustomerShippingAddress extends Model {
  @Column({ type: 'int', name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'int', name: 'address_id' })
  addressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'address_id' })
  address!: Address;

  @Column({ type: 'varchar', length: 255, name: 'address_label' })
  addressLabel!: string;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean = false;

  toApi(): CustomerShippingAddressApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      customerId: this.customerId,
      addressId: this.addressId,
      address: this.address
        ? {
            id: this.address.id,
            streetLine1: this.address.streetLine1,
            streetLine2: this.address.streetLine2,
            city: this.address.city,
            postalCode: this.address.postalCode,
            stateProvince: this.address.stateProvince,
            country: this.address.country,
            notes: this.address.notes,
          }
        : null,
      addressLabel: this.addressLabel,
      isDefault: this.isDefault,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const entityDataForValidation = {
      customerId: this.customerId,
      addressId: this.addressId,
      addressLabel: this.addressLabel,
      isDefault: this.isDefault,
    };

    const result = z
      .object({
        customerId: z.number().int().positive(),
        addressId: z.number().int().positive(),
        addressLabel: z.string().min(1).max(255),
        isDefault: z.boolean(),
      })
      .safeParse(entityDataForValidation);

    customerShippingAddressValidationInputErrors.length = 0;
    if (!result.success) {
      customerShippingAddressValidationInputErrors.push(
        ...result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
      return false;
    }
    return true;
  }
}
