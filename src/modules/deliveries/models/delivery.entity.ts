import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import {
  CreateDeliveryItemInput,
  DeliveryItem,
  DeliveryItemApiResponse,
} from '@/modules/delivery-items/models/delivery-item.entity';
import { Address, AddressApiResponse } from '@/modules/addresses/models/address.entity';
import { Warehouse, WarehouseApiResponse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '@/modules/shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  IN_PREPARATION = 'in_preparation',
  READY_TO_SHIP = 'ready_to_ship',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  FAILED_DELIVERY = 'failed_delivery',
}

// Zod Schema for validation
const deliverySchemaValidation = z
  .object({
    salesOrderId: z.number().int().positive({ message: 'Sales Order ID is required.' }),
    deliveryDate: z.coerce.date({ required_error: 'Delivery date is required.' }),
    status: z.nativeEnum(DeliveryStatus).optional().default(DeliveryStatus.PENDING),
    shippingAddressId: z.number().int().positive({ message: 'Shipping Address ID is required.' }),
    carrierName: z.string().max(255).nullable().optional(),
    trackingNumber: z.string().max(100).nullable().optional(),
    dispatchWarehouseId: z.number().int().positive().nullable().optional(),
    dispatchShopId: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => data.dispatchWarehouseId || data.dispatchShopId, {
    message: 'Either dispatchWarehouseId or dispatchShopId must be provided.',
    path: ['dispatchWarehouseId'],
  });

export type CreateDeliveryInput = {
  salesOrderId: number;
  deliveryDate: string | Date;
  shippingAddressId?: number;
  dispatchWarehouseId?: number | null;
  dispatchShopId?: number | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  items: Array<Omit<CreateDeliveryItemInput, 'deliveryId'>>;
};

export type UpdateDeliveryInput = Partial<
  Pick<
    CreateDeliveryInput,
    | 'deliveryDate'
    | 'shippingAddressId'
    | 'carrierName'
    | 'trackingNumber'
    | 'notes'
    | 'dispatchWarehouseId'
    | 'dispatchShopId'
  >
> & {
  items?: Array<Omit<CreateDeliveryItemInput, 'deliveryId'> & { id?: number; _delete?: boolean }>;
};

type EmbeddedSalesOrderApiResponse = {
  id: number;
  orderNumber: string;
  // customerId: number; // Potentially add customer info
};

export type DeliveryApiResponse = {
  id: number;
  deliveryNumber: string;
  salesOrderId: number;
  salesOrder?: EmbeddedSalesOrderApiResponse | null;
  deliveryDate: string | null;
  status: DeliveryStatus;
  shippingAddressId: number;
  shippingAddress?: AddressApiResponse | null;
  carrierName: string | null;
  trackingNumber: string | null;
  dispatchWarehouseId: number | null;
  dispatchWarehouse?: WarehouseApiResponse | null;
  dispatchShopId: number | null;
  dispatchShop?: ShopApiResponse | null;
  notes: string | null;
  items?: DeliveryItemApiResponse[];
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  // deliveredByUserId: number | null; // User who marked as delivered (if tracked)
  createdAt: string | null;
  updatedAt: string | null;
};

export const deliveryValidationInputErrors: string[] = [];

@Entity({ name: 'deliveries' })
@Unique('uq_delivery_number', ['deliveryNumber'])
@Index(['salesOrderId', 'status'])
@Index(['deliveryDate'])
export class Delivery extends Model {
  @Column({ type: 'varchar', length: 50, name: 'delivery_number', unique: true })
  deliveryNumber!: string;

  @Column({ type: 'int', name: 'sales_order_id' })
  salesOrderId!: number;

  @ManyToOne(() => SalesOrder, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder!: SalesOrder;

  @Column({ type: 'date', name: 'delivery_date' })
  deliveryDate!: Date;

  @Column({
    type: 'varchar',
    length: 30,
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status!: DeliveryStatus;

  @Column({ type: 'int', name: 'shipping_address_id' })
  shippingAddressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipping_address_id' })
  shippingAddress!: Address;

  @Column({ type: 'varchar', length: 255, name: 'carrier_name', nullable: true })
  carrierName: string | null = null;

  @Column({ type: 'varchar', length: 100, name: 'tracking_number', nullable: true })
  trackingNumber: string | null = null;

  @Column({ type: 'int', name: 'dispatch_warehouse_id', nullable: true })
  dispatchWarehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'dispatch_warehouse_id' })
  dispatchWarehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'dispatch_shop_id', nullable: true })
  dispatchShopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'dispatch_shop_id' })
  dispatchShop: Shop | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => DeliveryItem, (item) => item.delivery, {
    cascade: ['insert', 'update', 'remove'],
    eager: true,
  })
  items!: DeliveryItem[];

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', referencedColumnName: 'id' })
  createdByUser!: User;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id', referencedColumnName: 'id' })
  updatedByUser?: User | null;

  toApi(): DeliveryApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      deliveryNumber: this.deliveryNumber,
      salesOrderId: this.salesOrderId,
      salesOrder: this.salesOrder
        ? {
            id: this.salesOrder.id,
            orderNumber: this.salesOrder.orderNumber,
          }
        : undefined,
      deliveryDate: Model.formatISODate(this.deliveryDate),
      status: this.status,
      shippingAddressId: this.shippingAddressId,
      shippingAddress: this.shippingAddress
        ? (this.shippingAddress.toApi() as AddressApiResponse)
        : null,
      carrierName: this.carrierName,
      trackingNumber: this.trackingNumber,
      dispatchWarehouseId: this.dispatchWarehouseId,
      dispatchWarehouse: this.dispatchWarehouse
        ? ({
            id: this.dispatchWarehouse.id,
            name: this.dispatchWarehouse.name,
            code: this.dispatchWarehouse.code,
          } as WarehouseApiResponse)
        : null,
      dispatchShopId: this.dispatchShopId,
      dispatchShop: this.dispatchShop
        ? ({
            id: this.dispatchShop.id,
            name: this.dispatchShop.name,
            code: this.dispatchShop.code,
          } as ShopApiResponse)
        : null,
      notes: this.notes,
      items: this.items?.map((item) => item.toApi()),
      createdByUserId: this.createdByUserId,
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      salesOrderId: this.salesOrderId,
      deliveryDate: this.deliveryDate,
      status: this.status,
      shippingAddressId: this.shippingAddressId,
      carrierName: this.carrierName,
      trackingNumber: this.trackingNumber,
      dispatchWarehouseId: this.dispatchWarehouseId,
      dispatchShopId: this.dispatchShopId,
      notes: this.notes,
    };
    const result = deliverySchemaValidation.safeParse(dataToValidate);
    deliveryValidationInputErrors.length = 0;
    if (!result.success) {
      deliveryValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          deliveryValidationInputErrors.push(`Invalid item data for product ID ${item.productId}.`);
          return false;
        }
      }
    } else if (this.status !== DeliveryStatus.PENDING && this.status !== DeliveryStatus.CANCELLED) {
      deliveryValidationInputErrors.push('Items: An active delivery should have items.');
      return false;
    }
    return true;
  }
}
