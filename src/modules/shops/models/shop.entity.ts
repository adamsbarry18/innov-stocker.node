import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import {
  Address,
  type CreateAddressInput as BaseCreateAddressInput,
  type AddressApiResponse,
} from '../../addresses/models/address.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';

// Zod Schema for validation
const shopSchemaValidation = z.object({
  name: z.string().min(1, { message: 'Shop name is required.' }).max(255),
  code: z.string().max(50).nullable().optional(),
  addressId: z.number().int().positive({ message: 'Address ID is required.' }),
  managerId: z.number().int().positive().nullable().optional(),
  openingHoursNotes: z.string().nullable().optional(),
});

// Type for creating a shop
export type CreateShopInput = {
  name: string;
  code?: string | null;
  addressId: number; // ID of an existing address
  newAddress?: BaseCreateAddressInput; // Optional: For creating address on the fly
  managerId?: number | null;
  openingHoursNotes?: string | null;
};

// Type for updating a shop
export type UpdateShopInput = Partial<Omit<CreateShopInput, 'newAddress'>>;

// Type for API response (DTO)
export type ShopApiResponse = {
  id: number;
  name: string;
  code: string | null;
  addressId: number;
  address?: AddressApiResponse | null;
  managerId: number | null;
  manager?: UserApiResponse | null;
  openingHoursNotes: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const shopValidationInputErrors: string[] = [];

@Entity({ name: 'shops' })
@Unique('uq_shop_name', ['name'])
@Unique('uq_shop_code', ['code']) // Assuming code should also be unique if provided
@Index(['managerId'])
export class Shop extends Model {
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

  @Column({ type: 'text', nullable: true, name: 'opening_hours_notes' })
  openingHoursNotes: string | null = null;

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

  toApi(): ShopApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      name: this.name,
      code: this.code,
      addressId: this.addressId,
      address: this.address ? this.address.toApi() : null,
      managerId: this.managerId,
      manager: this.manager ? this.manager.toApi() : null,
      openingHoursNotes: this.openingHoursNotes,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const result = shopSchemaValidation.safeParse({
      name: this.name,
      code: this.code,
      addressId: this.addressId,
      managerId: this.managerId,
      openingHoursNotes: this.openingHoursNotes,
    });
    shopValidationInputErrors.length = 0;

    if (!result.success) {
      shopValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    return true;
  }
}
