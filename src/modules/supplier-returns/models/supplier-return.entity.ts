import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import logger from '@/lib/logger';
import {
  CreateSupplierReturnItemInput,
  SupplierReturnItem,
  SupplierReturnItemApiResponse,
  supplierReturnItemValidationInputErrors,
} from '../supplier-return-items/models/supplier-return-item.entity';
import { Supplier, SupplierApiResponse } from '@/modules/suppliers/models/supplier.entity';
import { Warehouse, WarehouseApiResponse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '@/modules/shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';

export enum SupplierReturnStatus {
  REQUESTED = 'requested', // Demande de retour initiée
  APPROVED_BY_SUPPLIER = 'approved_by_supplier', // Autorisation de retour du fournisseur (RMA number may be provided)
  PENDING_SHIPMENT = 'pending_shipment', // Prêt à être expédié au fournisseur
  SHIPPED_TO_SUPPLIER = 'shipped_to_supplier', // Marchandises expédiées
  RECEIVED_BY_SUPPLIER = 'received_by_supplier', // Confirmé reçu par le fournisseur
  CREDIT_EXPECTED = 'credit_expected', // Avoir/Remboursement attendu
  REFUNDED = 'refunded', // Remboursement reçu
  CREDIT_NOTE_RECEIVED = 'credit_note_received', // Avoir reçu
  COMPLETED = 'completed', // Processus de retour terminé
  REJECTED_BY_SUPPLIER = 'rejected_by_supplier', // Retour refusé par le fournisseur
  CANCELLED = 'cancelled', // Annulé avant expédition
}

// Zod Schema for validation
const supplierReturnSchemaValidation = z
  .object({
    supplierId: z.number().int().positive({ message: 'Supplier ID is required.' }),
    returnDate: z.coerce.date({
      required_error: 'Return date (date of request/shipment) is required.',
    }),
    status: z.nativeEnum(SupplierReturnStatus).optional().default(SupplierReturnStatus.REQUESTED),
    reason: z.string().max(1000).nullable().optional(),
    notes: z.string().nullable().optional(),
    // For tracking where items are being returned from
    sourceWarehouseId: z.number().int().positive().nullable().optional(),
    sourceShopId: z.number().int().positive().nullable().optional(),
    supplierRmaNumber: z.string().max(100).nullable().optional(), // RMA number from supplier
  })
  .refine((data) => data.sourceWarehouseId || data.sourceShopId, {
    message:
      'Either sourceWarehouseId or sourceShopId must be provided (where items are returned from).',
    path: ['sourceWarehouseId'],
  });

export type CreateSupplierReturnInput = {
  supplierId: number;
  returnDate: string | Date;
  reason?: string | null;
  notes?: string | null;
  sourceWarehouseId?: number | null;
  sourceShopId?: number | null;
  supplierRmaNumber?: string | null;
  items?: CreateSupplierReturnItemInput[];
};

export type UpdateSupplierReturnInput = Partial<
  Omit<CreateSupplierReturnInput, 'items' | 'supplierId'>
> & {
  status?: SupplierReturnStatus;
  items?: Array<Partial<CreateSupplierReturnItemInput> & { id?: string; _delete?: boolean }>;
};

// Input for shipping action
export type ShipSupplierReturnInput = {
  shipDate?: string | Date | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  items: Array<{
    id: number;
    quantityShipped: number;
  }>;
};

export type CompleteSupplierReturnInput = {
  completionDate?: string | Date | null;
  resolutionNotes?: string | null;
};

export type SupplierReturnApiResponse = {
  id: number;
  returnNumber: string;
  supplierId: number;
  supplier?: SupplierApiResponse | null;
  returnDate: string | null;
  status: SupplierReturnStatus;
  reason: string | null;
  notes: string | null;
  sourceWarehouseId: number | null;
  sourceWarehouse?: WarehouseApiResponse | null;
  sourceShopId: number | null;
  sourceShop?: ShopApiResponse | null;
  supplierRmaNumber: string | null;
  items?: SupplierReturnItemApiResponse[];
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  shippedByUserId?: number | null;
  shippedByUser?: UserApiResponse | null;
  processedByUserId?: number | null;
  processedByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const supplierReturnValidationInputErrors: string[] = [];

@Entity({ name: 'supplier_returns' })
@Unique('uq_sr_return_number', ['returnNumber'])
@Index(['supplierId', 'status'])
@Index(['returnDate'])
export class SupplierReturn extends Model {
  @Column({ type: 'varchar', length: 50, name: 'return_number', unique: true })
  returnNumber!: string;

  @Column({ type: 'int', name: 'supplier_id' })
  supplierId!: number;

  @ManyToOne(() => Supplier, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ type: 'date', name: 'return_date' })
  returnDate!: Date;

  @Column({
    type: 'varchar',
    length: 30,
    enum: SupplierReturnStatus,
    default: SupplierReturnStatus.REQUESTED,
  })
  status!: SupplierReturnStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null = null;

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true }) // As per SQL DDL
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null = null;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true }) // From Model
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  @Column({ type: 'int', name: 'source_warehouse_id', nullable: true })
  sourceWarehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse: Warehouse | null = null;

  @Column({ type: 'int', name: 'source_shop_id', nullable: true })
  sourceShopId: number | null = null;

  @ManyToOne(() => Shop, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'source_shop_id' })
  sourceShop: Shop | null = null;

  @Column({ type: 'varchar', length: 100, name: 'supplier_rma_number', nullable: true })
  supplierRmaNumber: string | null = null;

  @Column({ type: 'int', name: 'shipped_by_user_id', nullable: true })
  shippedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shipped_by_user_id' })
  shippedByUser: User | null = null;

  // This field `received_by_user_id` is not in the SQL for `supplier_returns`, but `validated_by_user_id` might be used for completion
  // Let's assume a generic "processed_by_user_id" for the user who finalizes the return (refund/credit note processing)
  // For now, will use validated_by_user_id logic from inventory_sessions as an example.
  // The SQL has no direct "processed_by_user_id". `validated_by_user_id` on `inventory_sessions` is a good analogy.

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => SupplierReturnItem, (item) => item.supplierReturn, {
    cascade: ['insert', 'update', 'remove'],
    eager: false,
  })
  items!: SupplierReturnItem[];

  toApi(includeItems: boolean = false): SupplierReturnApiResponse {
    const base = super.toApi();
    const response: SupplierReturnApiResponse = {
      ...base,
      id: this.id,
      returnNumber: this.returnNumber,
      supplierId: this.supplierId,
      supplier: this.supplier
        ? ({
            id: this.supplier.id,
            name: this.supplier.name,
            email: this.supplier.email,
          } as SupplierApiResponse)
        : null,
      returnDate: Model.formatISODate(this.returnDate),
      status: this.status,
      reason: this.reason,
      notes: this.notes,
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
      supplierRmaNumber: this.supplierRmaNumber,
      createdByUserId: this.createdByUserId,
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      shippedByUserId: this.shippedByUserId,
      shippedByUser: this.shippedByUser ? this.shippedByUser.toApi() : null,
      updatedByUserId: this.updatedByUserId,
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
      supplierId: this.supplierId,
      returnDate: this.returnDate,
      status: this.status,
      reason: this.reason,
      notes: this.notes,
      sourceWarehouseId: this.sourceWarehouseId,
      sourceShopId: this.sourceShopId,
      supplierRmaNumber: this.supplierRmaNumber,
    };
    // Remove invoiceNumber from validation as it's auto-generated
    const result = supplierReturnSchemaValidation.safeParse(dataToValidate);
    supplierReturnValidationInputErrors.length = 0;
    if (!result.success) {
      supplierReturnValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      logger.warn({
        message: 'SupplierReturn entity basic validation failed',
        errors: supplierReturnValidationInputErrors,
        data: dataToValidate,
      });
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          supplierReturnValidationInputErrors.push(
            `Invalid item data (ProdID: ${item.productId}). Errors: ${supplierReturnItemValidationInputErrors.join('; ')}`,
          );
          return false;
        }
      }
    } else if (
      this.status !== SupplierReturnStatus.REQUESTED &&
      this.status !== SupplierReturnStatus.CANCELLED
    ) {
      // supplierReturnValidationInputErrors.push('Items: An active return should have items.');
      // return false;
    }
    return true;
  }
}
