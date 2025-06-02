import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import logger from '@/lib/logger';
import { Warehouse, WarehouseApiResponse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '@/modules/shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import {
  InventorySessionItem,
  InventorySessionItemApiResponse,
} from '../inventory-session-items/models/inventory-session-item.entity';

export enum InventorySessionStatus {
  PENDING = 'pending', // Créée, en attente de démarrage effectif du comptage
  IN_PROGRESS = 'in_progress', // Comptage en cours
  COMPLETED = 'completed', // Comptage terminé, écarts calculés, validée (mouvements de stock créés)
  CANCELLED = 'cancelled', // Annulée avant complétion
}

const inventorySessionSchemaValidation = z
  .object({
    warehouseId: z.number().int().positive().nullable().optional(),
    shopId: z.number().int().positive().nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullable().optional(),
    status: z.nativeEnum(InventorySessionStatus).optional().default(InventorySessionStatus.PENDING),
    validatedByUserId: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => data.warehouseId || data.shopId, {
    message: 'Either warehouseId or shopId must be provided for the inventory session.',
    path: ['warehouseId'],
  })
  .refine((data) => !(data.warehouseId && data.shopId), {
    message: 'Provide either warehouseId or shopId, not both.',
    path: ['warehouseId'],
  });

export type CreateInventorySessionInput = {
  warehouseId?: number | null;
  shopId?: number | null;
  startDate?: string | Date;
  endDate?: string | Date | null;
  notes?: string | null;
  // Items are not part of initial creation DTO; they are added/discovered during the session
};

export type UpdateInventorySessionInput = Partial<
  Pick<CreateInventorySessionInput, 'notes' | 'startDate' | 'endDate' | 'warehouseId' | 'shopId'>
> & {
  status?: InventorySessionStatus; // Status changes are specific actions (e.g., complete, cancel)
};

export type CompleteInventorySessionInput = {
  notes?: string | null;
  // validatedByUserId will be the authenticated user performing the action
};

export type InventorySessionApiResponse = {
  id: number;
  warehouseId: number | null;
  warehouse?: WarehouseApiResponse | null;
  shopId: number | null;
  shop?: ShopApiResponse | null;
  startDate: string | null;
  endDate: string | null;
  status: InventorySessionStatus;
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  validatedByUserId: number | null;
  validatedByUser?: UserApiResponse | null;
  notes: string | null;
  items?: InventorySessionItemApiResponse[];
  createdAt: string | null;
  updatedAt: string | null;
};

export const inventorySessionValidationInputErrors: string[] = [];

@Entity({ name: 'inventory_sessions' })
@Index(['warehouseId', 'status', 'startDate'])
@Index(['shopId', 'status', 'startDate'])
export class InventorySession extends Model {
  @Column({ type: 'int', name: 'warehouse_id', nullable: true })
  warehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'shop_id', nullable: true })
  shopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop | null = null;

  @Column({ type: 'timestamp', name: 'start_date', default: () => 'CURRENT_TIMESTAMP' })
  startDate!: Date;

  @Column({ type: 'timestamp', name: 'end_date', nullable: true })
  endDate: Date | null = null;

  @Column({
    type: 'varchar',
    length: 20,
    enum: InventorySessionStatus,
    default: InventorySessionStatus.PENDING,
  })
  status!: InventorySessionStatus;

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null = null;

  @Column({ type: 'int', name: 'validated_by_user_id', nullable: true })
  validatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'validated_by_user_id' })
  validatedByUser: User | null = null;

  // updatedByUserId for Model pattern
  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id', referencedColumnName: 'id' })
  updatedByUser?: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => InventorySessionItem, (item) => item.inventorySession, {
    cascade: ['insert', 'update', 'remove'],
    eager: false,
  }) // Eager false, load explicitly
  items?: InventorySessionItem[];

  toApi(includeItems: boolean = false): InventorySessionApiResponse {
    const base = super.toApi();
    const response: InventorySessionApiResponse = {
      ...base,
      id: this.id,
      warehouseId: this.warehouseId,
      warehouse: this.warehouse
        ? ({
            id: this.warehouse.id,
            name: this.warehouse.name,
            code: this.warehouse.code,
          } as WarehouseApiResponse)
        : null,
      shopId: this.shopId,
      shop: this.shop
        ? ({
            id: this.shop.id,
            name: this.shop.name,
            code: this.shop.code,
          } as ShopApiResponse)
        : null,
      startDate: Model.formatISODate(this.startDate),
      endDate: Model.formatISODate(this.endDate),
      status: this.status,
      createdByUserId: this.createdByUserId,
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      validatedByUserId: this.validatedByUserId,
      validatedByUser: this.validatedByUser ? this.validatedByUser.toApi() : null,
      notes: this.notes,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
    if (includeItems && this.items) {
      response.items = this.items.map((item) => item.toApi());
    }
    return response;
  }

  isValid(): boolean {
    const dataToValidate = {
      warehouseId: this.warehouseId,
      shopId: this.shopId,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      validatedByUserId: this.validatedByUserId,
      notes: this.notes,
    };
    const result = inventorySessionSchemaValidation.safeParse(dataToValidate);
    inventorySessionValidationInputErrors.length = 0;
    if (!result.success) {
      inventorySessionValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      logger.warn({
        message: 'InventorySession entity basic validation failed',
        errors: inventorySessionValidationInputErrors,
        data: dataToValidate,
      });
      return false;
    }
    if (this.endDate && this.startDate > this.endDate) {
      inventorySessionValidationInputErrors.push('End date cannot be before start date.');
      return false;
    }
    if (
      this.status === InventorySessionStatus.COMPLETED &&
      (!this.endDate || !this.validatedByUserId)
    ) {
      inventorySessionValidationInputErrors.push(
        'Completed session must have an end date and validating user.',
      );
      return false;
    }
    return true;
  }
}
