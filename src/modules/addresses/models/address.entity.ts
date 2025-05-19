import { Model } from '@/common/models/Model';
import { Entity, Column } from 'typeorm';
import { z } from 'zod';

// Zod Schema for validation
const addressSchemaValidation = z.object({
  streetLine1: z.string().min(1, { message: 'Street line 1 is required.' }).max(255),
  streetLine2: z.string().max(255).nullable().optional(),
  city: z.string().min(1, { message: 'City is required.' }).max(255),
  postalCode: z.string().min(1, { message: 'Postal code is required.' }).max(20),
  stateProvince: z.string().max(255).nullable().optional(),
  country: z.string().min(1, { message: 'Country is required.' }).max(255),
  notes: z.string().nullable().optional(),
});

// Type for creating an address
export type CreateAddressInput = z.infer<typeof addressSchemaValidation>;

// Type for updating an address (all fields optional)
export type UpdateAddressInput = Partial<CreateAddressInput>;

// Type for API response (DTO)
export type AddressApiResponse = {
  id: number;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
  stateProvince: string | null;
  country: string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const addressValidationInputErrors: string[] = [];

@Entity({ name: 'addresses' })
export class Address extends Model {
  @Column({ type: 'varchar', length: 255, name: 'street_line1' })
  streetLine1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'street_line2' })
  streetLine2: string | null = null;

  @Column({ type: 'varchar', length: 255 })
  city!: string;

  @Column({ type: 'varchar', length: 20, name: 'postal_code' })
  postalCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'state_province' })
  stateProvince: string | null = null;

  @Column({ type: 'varchar', length: 255 })
  country!: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  /**
   * Formats the entity for an API response.
   * @returns The formatted address object for API.
   */
  toApi(): AddressApiResponse {
    const base = super.toApi(); // Gets id, createdAt, updatedAt
    return {
      ...base,
      id: this.id, // Explicitly ensure id is present
      streetLine1: this.streetLine1,
      streetLine2: this.streetLine2,
      city: this.city,
      postalCode: this.postalCode,
      stateProvince: this.stateProvince,
      country: this.country,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  /**
   * Validates the entity's attributes using Zod.
   * @returns True if valid, false otherwise. Errors are stored in addressValidationInputErrors.
   */
  isValid(): boolean {
    const result = addressSchemaValidation.safeParse(this);
    addressValidationInputErrors.length = 0; // Clear previous errors

    if (!result.success) {
      addressValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
