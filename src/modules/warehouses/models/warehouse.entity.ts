import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Address } from '../../addresses/models/address.entity';
import { User } from '@/modules/users/models/users.entity';

// Zod Schema for validation
const warehouseSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Warehouse name is required.' }).max(255),
  code: z.string().max(50).nullable().optional(),
  addressId: z.number().int().positive({ message: 'Address ID is required.' }),
  managerId: z.number().int().positive().nullable().optional(),
  capacityNotes: z.string().nullable().optional(),
});

// Type for creating a warehouse
export type CreateWarehouseInput = {
  name: string;
  code?: string | null;
  addressId: number; // ID of an existing address
  newAddress?: CreateAddressInput; // Optional: For creating address on the fly (type from addresses module)
  managerId?: number | null;
  capacityNotes?: string | null;
};

// Type for updating a warehouse
export type UpdateWarehouseInput = Partial<Omit<CreateWarehouseInput, 'newAddress'>>;

// DTO for Address to be embedded (simplified, assuming it's defined globally or in address module schema)
type EmbeddedAddressApiResponse = {
  id: number;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  postalCode: string;
  stateProvince: string | null;
  country: string;
  notes: string | null;
};

// DTO for User to be embedded (simplified, for manager)
type EmbeddedUserApiResponse = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

// Type for API response (DTO)
export type WarehouseApiResponse = {
  id: number;
  name: string;
  code: string | null;
  addressId: number;
  address?: EmbeddedAddressApiResponse | null;
  managerId: number | null;
  manager?: EmbeddedUserApiResponse | null;
  capacityNotes: string | null;
  createdByUserId: number | null;
  // createdByUser?: EmbeddedUserApiResponse | null;
  updatedByUserId: number | null;
  // updatedByUser?: EmbeddedUserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// Re-import or define CreateAddressInput if not globally available for Zod schema in service
import { type CreateAddressInput as BaseCreateAddressInput } from '../../addresses/models/address.entity';
export type CreateAddressInput = BaseCreateAddressInput;

export const warehouseValidationInputErrors: string[] = [];

@Entity({ name: 'warehouses' })
@Unique('uq_warehouse_name', ['name'])
@Unique('uq_warehouse_code', ['code']) // Assuming code should also be unique if provided
@Index(['managerId'])
export class Warehouse extends Model {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null = null;

  @Column({ type: 'int', name: 'address_id' })
  addressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address!: Address;

  @Column({ type: 'int', nullable: true, name: 'manager_id' })
  managerId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User | null = null;

  @Column({ type: 'text', nullable: true, name: 'capacity_notes' })
  capacityNotes: string | null = null;

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

  toApi(): WarehouseApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      code: this.code,
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
            notes: this.address.notes,
          }
        : null,
      managerId: this.managerId,
      manager: this.manager
        ? {
            // Map manager to a simplified DTO
            id: this.manager.id,
            firstName: this.manager.firstName,
            lastName: this.manager.lastName,
            email: this.manager.email,
          }
        : null,
      capacityNotes: this.capacityNotes,
      createdByUserId: this.createdByUserId,
      // createdByUser: this.createdByUser ? { id: this.createdByUser.id, firstName: this.createdByUser.firstName, email: this.createdByUser.email } : null,
      updatedByUserId: this.updatedByUserId,
      // updatedByUser: this.updatedByUser ? { id: this.updatedByUser.id, firstName: this.updatedByUser.firstName, email: this.updatedByUser.email } : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = warehouseSchemaValidation.safeParse({
      name: this.name,
      code: this.code,
      addressId: this.addressId,
      managerId: this.managerId,
      capacityNotes: this.capacityNotes,
    });
    warehouseValidationInputErrors.length = 0;

    if (!result.success) {
      warehouseValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
