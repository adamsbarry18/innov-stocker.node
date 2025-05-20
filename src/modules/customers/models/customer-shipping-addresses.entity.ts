import { Model } from '@/common/models/Model';
import { Address } from '@/modules/addresses/models/address.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { z } from 'zod';
import { Customer } from './customer.entity';

const shippingAddressSchemaValidation = z.object({
  customerId: z.number().int().positive(),
  addressId: z.number().int().positive(),
  addressLabel: z.string().min(1, { message: 'Address label is required.' }).max(255),
  isDefault: z.boolean().optional(),
});

export type CreateCustomerShippingAddressInput = {
  // customerId will be from path param
  addressId: number;
  addressLabel: string;
  isDefault?: boolean;
  // If creating a new address on the fly:
  newAddress?: {
    // Corresponds to CreateAddressInput from address module
    streetLine1: string;
    streetLine2?: string | null;
    city: string;
    postalCode: string;
    stateProvince?: string | null;
    country: string;
    notes?: string | null;
  };
};

export type UpdateCustomerShippingAddressInput = Partial<
  Omit<CreateCustomerShippingAddressInput, 'newAddress' | 'addressId'>
> & {
  addressId?: number; // Allow changing the linked address
};

export type CustomerShippingAddressApiResponse = {
  id: number;
  customerId: number;
  addressId: number;
  address?: {
    // Simplified Address DTO
    id: number;
    streetLine1: string;
    streetLine2: string | null;
    city: string;
    postalCode: string;
    stateProvince: string | null;
    country: string;
  } | null;
  addressLabel: string;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerShippingAddressValidationInputErrors: string[] = [];

@Entity({ name: 'customer_shipping_addresses' })
@Unique(['customerId', 'addressId']) // A customer cannot have the same address linked twice
@Unique(['customerId', 'addressLabel']) // A customer cannot have two shipping addresses with the same label
export class CustomerShippingAddress extends Model {
  @Column({ type: 'int', name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer, (customer) => customer.shippingAddresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'int', name: 'address_id' })
  addressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'CASCADE' }) // Eager load address details
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
            // Map address to a simplified DTO
            id: this.address.id,
            streetLine1: this.address.streetLine1,
            streetLine2: this.address.streetLine2,
            city: this.address.city,
            postalCode: this.address.postalCode,
            stateProvince: this.address.stateProvince,
            country: this.address.country,
          }
        : null,
      addressLabel: this.addressLabel,
      isDefault: this.isDefault,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    // Basic validation, more complex logic in service
    const result = shippingAddressSchemaValidation.safeParse(this);
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
