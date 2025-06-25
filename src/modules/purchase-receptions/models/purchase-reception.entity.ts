import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Supplier, SupplierApiResponse } from '../../suppliers/models/supplier.entity';
import { Warehouse, WarehouseApiResponse } from '../../warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '../../shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import {
  CreatePurchaseReceptionItemInput,
  PurchaseReceptionItem,
  PurchaseReceptionItemApiResponse,
} from '../purchase-reception-items/models/purchase-reception-item.entity';

export enum PurchaseReceptionStatus {
  PENDING_QUALITY_CHECK = 'pending_quality_check',
  PARTIAL = 'partial',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
}

const purchaseReceptionSchemaValidation = z
  .object({
    purchaseOrderId: z.number().int().positive().nullable().optional(),
    supplierId: z.number().int().positive({ message: 'Supplier ID is required.' }),
    receptionDate: z.coerce.date({ required_error: 'Reception date is required.' }),
    warehouseId: z.number().int().positive().nullable().optional(),
    shopId: z.number().int().positive().nullable().optional(),
    status: z
      .nativeEnum(PurchaseReceptionStatus)
      .optional()
      .default(PurchaseReceptionStatus.PENDING_QUALITY_CHECK),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => data.warehouseId ?? data.shopId, {
    message: 'Either warehouseId or shopId must be provided as reception location.',
    path: ['warehouseId'],
  });

export type CreatePurchaseReceptionInput = {
  purchaseOrderId?: number | null;
  supplierId: number;
  receptionDate: string | Date;
  warehouseId?: number | null;
  shopId?: number | null;
  status?: PurchaseReceptionStatus;
  notes?: string | null;
  items: Array<Omit<CreatePurchaseReceptionItemInput, 'purchaseReceptionId'>>;
};

export type UpdatePurchaseReceptionInput = Partial<
  Omit<CreatePurchaseReceptionInput, 'items' | 'supplierId' | 'purchaseOrderId'>
> & {
  items?: Array<Partial<CreatePurchaseReceptionItemInput> & { id?: number; _delete?: boolean }>;
};

type EmbeddedPurchaseOrderApiResponse = {
  id: number;
  orderNumber: string;
};

export type PurchaseReceptionApiResponse = {
  id: number;
  receptionNumber: string;
  purchaseOrderId: number | null;
  purchaseOrder?: EmbeddedPurchaseOrderApiResponse | null;
  supplierId: number;
  supplier?: SupplierApiResponse | null;
  receptionDate: string | null;
  warehouseId: number | null;
  warehouse?: WarehouseApiResponse | null;
  shopId: number | null;
  shop?: ShopApiResponse | null;
  status: PurchaseReceptionStatus;
  notes: string | null;
  items?: PurchaseReceptionItemApiResponse[];
  receivedByUserId: number;
  receivedByUser?: UserApiResponse | null;
  updatedByUserId?: number | null;
  updatedByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const purchaseReceptionValidationInputErrors: string[] = [];

@Entity({ name: 'purchase_receptions' })
@Unique('uq_pr_reception_number', ['receptionNumber'])
@Index(['supplierId', 'status'])
@Index(['receptionDate'])
@Index(['purchaseOrderId'])
export class PurchaseReception extends Model {
  @Column({ type: 'varchar', length: 50, name: 'reception_number' })
  receptionNumber!: string;

  @Column({ type: 'int', name: 'purchase_order_id', nullable: true })
  purchaseOrderId: number | null = null;

  @ManyToOne(() => PurchaseOrder, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder | null;

  @Column({ type: 'int', name: 'supplier_id' })
  supplierId!: number;

  @ManyToOne(() => Supplier, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ type: 'date', name: 'reception_date' })
  receptionDate!: Date;

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

  @Column({
    type: 'enum',
    enum: PurchaseReceptionStatus,
    default: PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
  })
  status!: PurchaseReceptionStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => PurchaseReceptionItem, (item) => item.purchaseReception, {
    cascade: ['insert', 'update', 'remove'],
    eager: true,
  })
  items!: PurchaseReceptionItem[];

  @Column({ type: 'int', name: 'received_by_user_id' })
  receivedByUserId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedByUser!: User;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId?: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  toApi(): PurchaseReceptionApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      receptionNumber: this.receptionNumber,
      purchaseOrderId: this.purchaseOrderId,
      purchaseOrder: this.purchaseOrder
        ? {
            id: this.purchaseOrder.id,
            orderNumber: this.purchaseOrder.orderNumber,
          }
        : null,
      supplierId: this.supplierId,
      supplier: this.supplier
        ? ({
            id: this.supplier.id,
            name: this.supplier.name,
            email: this.supplier.email,
          } as SupplierApiResponse)
        : null,
      receptionDate: Model.formatISODate(this.receptionDate),
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
      status: this.status,
      notes: this.notes,
      items: this.items?.map((item) => item.toApi()),
      receivedByUserId: this.receivedByUserId,
      receivedByUser: this.receivedByUser ? this.receivedByUser.toApi() : null,
      updatedByUserId: this.updatedByUserId,
      updatedByUser: this.updatedByUser ? this.updatedByUser.toApi() : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      purchaseOrderId: this.purchaseOrderId,
      supplierId: this.supplierId,
      receptionDate: this.receptionDate,
      warehouseId: this.warehouseId,
      shopId: this.shopId,
      status: this.status,
      notes: this.notes,
    };
    const result = purchaseReceptionSchemaValidation.safeParse(dataToValidate);
    purchaseReceptionValidationInputErrors.length = 0;
    if (!result.success) {
      purchaseReceptionValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          purchaseReceptionValidationInputErrors.push(
            `Invalid item data for product ID ${item.productId}.`,
          );
          return false;
        }
      }
    } else if (this.status !== PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
      purchaseReceptionValidationInputErrors.push(
        'Items: A non-pending reception should have items.',
      );
      return false;
    }
    return true;
  }
}
