import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import logger from '@/lib/logger';
import {
  CreateStockTransferItemInput,
  StockTransferItem,
  StockTransferItemApiResponse,
} from '../stock-transfer-items/models/stock-transfer-item.entity';
import { Warehouse, WarehouseApiResponse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '@/modules/shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';

export enum StockTransferStatus {
  PENDING = 'pending', // Demande créée, en attente d'expédition
  IN_TRANSIT = 'in_transit', // Marchandises expédiées du lieu source
  PARTIALLY_RECEIVED = 'partially_received', // Partiellement reçu au lieu de destination
  RECEIVED = 'received', // Totalement reçu au lieu de destination
  CANCELLED = 'cancelled', // Annulé avant expédition
}

// Zod Schema for validation
const stockTransferSchemaValidation = z
  .object({
    sourceWarehouseId: z.number().int().positive().nullable().optional(),
    sourceShopId: z.number().int().positive().nullable().optional(),
    destinationWarehouseId: z.number().int().positive().nullable().optional(),
    destinationShopId: z.number().int().positive().nullable().optional(),
    requestDate: z.coerce.date({ required_error: 'Request date is required.' }),
    shipDate: z.coerce.date().nullable().optional(),
    receiveDate: z.coerce.date().nullable().optional(),
    status: z.nativeEnum(StockTransferStatus).optional().default(StockTransferStatus.PENDING),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => data.sourceWarehouseId || data.sourceShopId, {
    message: 'Either sourceWarehouseId or sourceShopId must be provided.',
    path: ['sourceWarehouseId'],
  })
  .refine((data) => !(data.sourceWarehouseId && data.sourceShopId), {
    message: 'Provide either sourceWarehouseId or sourceShopId, not both, for the source.',
    path: ['sourceWarehouseId'],
  })
  .refine((data) => data.destinationWarehouseId || data.destinationShopId, {
    message: 'Either destinationWarehouseId or destinationShopId must be provided.',
    path: ['destinationWarehouseId'],
  })
  .refine((data) => !(data.destinationWarehouseId && data.destinationShopId), {
    message:
      'Provide either destinationWarehouseId or destinationShopId, not both, for the destination.',
    path: ['destinationWarehouseId'],
  })
  .refine(
    (data) =>
      data.sourceWarehouseId !== data.destinationWarehouseId ||
      data.sourceShopId !== data.destinationShopId,
    {
      message: 'Source and destination locations cannot be identical.',
      path: ['destinationWarehouseId'],
    },
  );

export type CreateStockTransferInput = {
  sourceWarehouseId?: number | null;
  sourceShopId?: number | null;
  destinationWarehouseId?: number | null;
  destinationShopId?: number | null;
  requestDate: string | Date;
  notes?: string | null;
  items: CreateStockTransferItemInput[];
};

export type UpdateStockTransferInput = Partial<
  Pick<
    CreateStockTransferInput,
    | 'requestDate'
    | 'notes'
    | 'sourceWarehouseId'
    | 'sourceShopId'
    | 'destinationWarehouseId'
    | 'destinationShopId'
  >
> & {
  status?: StockTransferStatus;
  items?: Array<Partial<CreateStockTransferItemInput>>;
};

export type ShipStockTransferInput = {
  shipDate?: string | Date | null;
  notes?: string | null;
  items: Array<{
    stockTransferItemId: number;
    quantityShipped: number;
  }>;
};

export type ReceiveStockTransferInput = {
  receiveDate?: string | Date | null;
  notes?: string | null;
  items: Array<{
    stockTransferItemId: number;
    quantityReceived: number;
  }>;
};

export type StockTransferApiResponse = {
  id: number;
  transferNumber: string;
  sourceWarehouseId: number | null;
  sourceWarehouse?: WarehouseApiResponse | null;
  sourceShopId: number | null;
  sourceShop?: ShopApiResponse | null;
  destinationWarehouseId: number | null;
  destinationWarehouse?: WarehouseApiResponse | null;
  destinationShopId: number | null;
  destinationShop?: ShopApiResponse | null;
  status: StockTransferStatus;
  requestDate: string | null;
  shipDate: string | null;
  receiveDate: string | null;
  notes: string | null;
  items?: StockTransferItemApiResponse[];
  requestedByUserId: number;
  requestedByUser?: UserApiResponse | null;
  shippedByUserId: number | null;
  shippedByUser?: UserApiResponse | null;
  receivedByUserId: number | null;
  receivedByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const stockTransferValidationInputErrors: string[] = [];

@Entity({ name: 'stock_transfers' })
@Unique('uq_stock_transfer_number', ['transferNumber'])
@Index(['status', 'requestDate'])
export class StockTransfer extends Model {
  @Column({ type: 'varchar', length: 50, name: 'transfer_number', unique: true })
  transferNumber!: string; // Auto-généré

  @Column({ type: 'int', name: 'source_warehouse_id', nullable: true })
  sourceWarehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'source_shop_id', nullable: true })
  sourceShopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'source_shop_id' })
  sourceShop: Shop | null = null;

  @Column({ type: 'int', name: 'destination_warehouse_id', nullable: true })
  destinationWarehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'destination_shop_id', nullable: true })
  destinationShopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'destination_shop_id' })
  destinationShop: Shop | null = null;

  @Column({
    type: 'varchar',
    length: 25,
    enum: StockTransferStatus,
    default: StockTransferStatus.PENDING,
  })
  status!: StockTransferStatus;

  @Column({ type: 'int', name: 'requested_by_user_id' })
  requestedByUserId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser!: User;

  @Column({ type: 'int', name: 'shipped_by_user_id', nullable: true })
  shippedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shipped_by_user_id' })
  shippedByUser: User | null = null;

  @Column({ type: 'int', name: 'received_by_user_id', nullable: true })
  receivedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedByUser: User | null = null;

  // SQL has created_by_user_id, updated_by_user_id via Model
  // The SQL DDL uses 'requested_by_user_id' instead of 'created_by_user_id' for this table.
  // We'll map createdByUserId from Model to requested_by_user_id if necessary or have duplicate info.
  // For now, Model handles its own audit fields (created_time, updated_time). Let's use SQL specific names.

  @Column({ type: 'date', name: 'request_date' })
  requestDate!: Date;

  @Column({ type: 'date', name: 'ship_date', nullable: true })
  shipDate: Date | null = null;

  @Column({ type: 'date', name: 'receive_date', nullable: true })
  receiveDate: Date | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => StockTransferItem, (item) => item.stockTransfer, {
    cascade: ['insert', 'update', 'remove'],
    eager: false,
  }) // Eager false by default for items
  items!: StockTransferItem[];

  toApi(includeItems: boolean = false): StockTransferApiResponse {
    const base = super.toApi();
    const response: StockTransferApiResponse = {
      ...base,
      id: this.id,
      transferNumber: this.transferNumber,
      sourceWarehouseId: this.sourceWarehouseId,
      sourceWarehouse: this.sourceWarehouse
        ? ({
            id: this.sourceWarehouse.id,
            name: this.sourceWarehouse.name,
            code: this.sourceWarehouse.code,
          } as WarehouseApiResponse)
        : null,
      sourceShopId: this.sourceShopId,
      sourceShop: this.sourceShop
        ? ({
            id: this.sourceShop.id,
            name: this.sourceShop.name,
            code: this.sourceShop.code,
          } as ShopApiResponse)
        : null,
      destinationWarehouseId: this.destinationWarehouseId,
      destinationWarehouse: this.destinationWarehouse
        ? ({
            id: this.destinationWarehouse.id,
            name: this.destinationWarehouse.name,
            code: this.destinationWarehouse.code,
          } as WarehouseApiResponse)
        : null,
      destinationShopId: this.destinationShopId,
      destinationShop: this.destinationShop
        ? ({
            id: this.destinationShop.id,
            name: this.destinationShop.name,
            code: this.destinationShop.code,
          } as ShopApiResponse)
        : null,
      status: this.status,
      requestDate: Model.formatISODate(this.requestDate),
      shipDate: Model.formatISODate(this.shipDate),
      receiveDate: Model.formatISODate(this.receiveDate),
      notes: this.notes,
      requestedByUserId: this.requestedByUserId,
      requestedByUser: this.requestedByUser ? this.requestedByUser.toApi() : null,
      shippedByUserId: this.shippedByUserId,
      shippedByUser: this.shippedByUser ? this.shippedByUser.toApi() : null,
      receivedByUserId: this.receivedByUserId,
      receivedByUser: this.receivedByUser ? this.receivedByUser.toApi() : null,
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
      sourceWarehouseId: this.sourceWarehouseId,
      sourceShopId: this.sourceShopId,
      destinationWarehouseId: this.destinationWarehouseId,
      destinationShopId: this.destinationShopId,
      requestDate: this.requestDate,
      shipDate: this.shipDate,
      receiveDate: this.receiveDate,
      status: this.status,
      notes: this.notes,
    };
    const result = stockTransferSchemaValidation.safeParse(dataToValidate);
    stockTransferValidationInputErrors.length = 0;
    if (!result.success) {
      stockTransferValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      logger.warn({
        message: 'StockTransfer entity basic validation failed',
        errors: stockTransferValidationInputErrors,
        data: dataToValidate,
      });
      return false;
    }
    if (this.shipDate && this.requestDate > this.shipDate) {
      stockTransferValidationInputErrors.push('Ship date cannot be before request date.');
      return false;
    }
    if (this.receiveDate && this.shipDate && this.shipDate > this.receiveDate) {
      stockTransferValidationInputErrors.push('Receive date cannot be before ship date.');
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          stockTransferValidationInputErrors.push(
            `Invalid item data for product ID ${item.productId}.`,
          );
          return false;
        }
      }
    } else if (
      this.status !== StockTransferStatus.PENDING &&
      this.status !== StockTransferStatus.CANCELLED
    ) {
      stockTransferValidationInputErrors.push('Items: An active transfer should have items.');
      return false;
    }
    return true;
  }
}
