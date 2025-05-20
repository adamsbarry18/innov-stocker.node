import { Model } from '@/common/models/Model';
import { Entity, Column, Unique } from 'typeorm';
import { z } from 'zod';

// Zod Schema for validation
const customerGroupSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Group name is required.' }).max(255),
  description: z.string().nullable().optional(),
  discountPercentage: z
    .number()
    .min(0, { message: 'Discount percentage cannot be negative.' })
    .max(100, { message: 'Discount percentage cannot exceed 100.' })
    .nullable()
    .optional(),
});

// Type for creating a customer group
export type CreateCustomerGroupInput = {
  name: string;
  description?: string | null;
  discountPercentage?: number | null;
};

// Type for updating a customer group (all fields optional)
export type UpdateCustomerGroupInput = Partial<CreateCustomerGroupInput>;

// Type for API response (DTO)
export type CustomerGroupApiResponse = {
  id: number;
  name: string;
  description: string | null;
  discountPercentage: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerGroupValidationInputErrors: string[] = [];

@Entity({ name: 'customer_groups' })
@Unique(['name']) // Name must be unique
export class CustomerGroup extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null = null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'discount_percentage',
    nullable: true,
    default: 0.0,
  })
  discountPercentage: number | null = 0.0;

  /**
   * Formats the entity for an API response.
   * @returns The formatted object for API.
   */
  toApi(): CustomerGroupApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      description: this.description,
      discountPercentage: this.discountPercentage !== null ? Number(this.discountPercentage) : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  /**
   * Validates the entity's attributes using Zod.
   * @returns True if valid, false otherwise. Errors are stored in customerGroupValidationInputErrors.
   */
  isValid(): boolean {
    const result = customerGroupSchemaValidation.safeParse(this);
    customerGroupValidationInputErrors.length = 0;

    if (!result.success) {
      customerGroupValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
