import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Supplier, SupplierApiResponse } from '../../suppliers/models/supplier.entity';
import { Currency, CurrencyApiResponse } from '../../currencies/models/currency.entity';
import { Address, AddressApiResponse } from '../../addresses/models/address.entity';
import { Warehouse, WarehouseApiResponse } from '../../warehouses/models/warehouse.entity';
import { Shop, ShopApiResponse } from '../../shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import logger from '@/lib/logger';
import { SupplierInvoicePurchaseOrderLink } from '@/modules/supplier-invoices/models/supplier-invoice-purchse-order-link.entity';
import {
  CreatePurchaseOrderItemInput,
  PurchaseOrderItem,
  PurchaseOrderItemApiResponse,
} from '../purchase-order-items/models/purchase-order-item.entity';

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
  CANCELLED = 'cancelled',
}

const purchaseOrderSchemaValidation = z
  .object({
    supplierId: z.number().int().positive({ message: 'Supplier ID is required.' }),
    orderDate: z.coerce.date({ required_error: 'Order date is required.' }),
    expectedDeliveryDate: z.coerce.date().nullable().optional(),
    status: z.nativeEnum(PurchaseOrderStatus).optional().default(PurchaseOrderStatus.DRAFT),
    currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
    shippingAddressId: z.number().int().positive().nullable().optional(),
    warehouseIdForDelivery: z.number().int().positive().nullable().optional(),
    shopIdForDelivery: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => data.warehouseIdForDelivery || data.shopIdForDelivery || data.shippingAddressId,
    {
      message:
        'At least one delivery destination (warehouse, shop, or specific shipping address) must be provided.',
      path: ['warehouseIdForDelivery'],
    },
  );

export type CreatePurchaseOrderInput = {
  supplierId: number;
  orderDate: string | Date;
  expectedDeliveryDate?: string | Date | null;
  status?: PurchaseOrderStatus;
  currencyId: number;
  shippingAddressId?: number | null;
  warehouseIdForDelivery?: number | null;
  shopIdForDelivery?: number | null;
  notes?: string | null;
  items: CreatePurchaseOrderItemInput[];
};

export type UpdatePurchaseOrderInput = Partial<
  Omit<CreatePurchaseOrderInput, 'items'> // Removed 'supplierId' from Omit
> & {
  items?: Array<Partial<CreatePurchaseOrderItemInput> & { id?: number; _delete?: boolean }>;
};

export type PurchaseOrderApiResponse = {
  id: number;
  orderNumber: string;
  supplierId: number;
  supplier?: SupplierApiResponse | null;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  status: PurchaseOrderStatus;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  totalAmountHt: number;
  totalVatAmount: number;
  totalAmountTtc: number;
  shippingAddressId: number | null;
  shippingAddress?: AddressApiResponse | null;
  warehouseIdForDelivery: number | null;
  warehouseForDelivery?: WarehouseApiResponse | null;
  shopIdForDelivery: number | null;
  shopForDelivery?: ShopApiResponse | null;
  notes: string | null;
  items?: PurchaseOrderItemApiResponse[];
  createdByUserId: number;
  createdByUser?: UserApiResponse | null;
  approvedByUserId: number | null;
  approvedByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const purchaseOrderValidationInputErrors: string[] = [];

@Entity({ name: 'purchase_orders' })
@Unique('uq_po_order_number', ['orderNumber'])
@Index(['supplierId', 'status'])
@Index(['orderDate'])
export class PurchaseOrder extends Model {
  @Column({ type: 'varchar', length: 50, name: 'order_number' })
  orderNumber!: string; // Auto-generated

  @Column({ type: 'int', name: 'supplier_id' })
  supplierId!: number;

  @ManyToOne(() => Supplier, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ type: 'date', name: 'order_date' })
  orderDate!: Date;

  @Column({ type: 'date', name: 'expected_delivery_date', nullable: true })
  expectedDeliveryDate: Date | null = null;

  @Column({
    type: 'varchar',
    length: 30,
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status!: PurchaseOrderStatus;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;

  @ManyToOne(() => Currency, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_amount_ht', default: 0.0 })
  totalAmountHt: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_vat_amount', default: 0.0 })
  totalVatAmount: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_amount_ttc', default: 0.0 })
  totalAmountTtc: number = 0;

  @Column({ type: 'int', name: 'shipping_address_id', nullable: true })
  shippingAddressId: number | null = null;

  @ManyToOne(() => Address, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shipping_address_id' })
  shippingAddress: Address | null = null;

  @Column({ type: 'int', name: 'warehouse_id_for_delivery', nullable: true })
  warehouseIdForDelivery: number | null = null;

  @ManyToOne(() => Warehouse, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'warehouse_id_for_delivery' })
  warehouseForDelivery: Warehouse | null = null;

  @Column({ type: 'int', name: 'shop_id_for_delivery', nullable: true })
  shopIdForDelivery: number | null = null;

  @ManyToOne(() => Shop, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shop_id_for_delivery' })
  shopForDelivery: Shop | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: ['insert', 'update', 'remove'],
    eager: false,
  })
  items!: PurchaseOrderItem[];

  @OneToMany(() => SupplierInvoicePurchaseOrderLink, (link) => link.purchaseOrder)
  supplierInvoiceLinks!: SupplierInvoicePurchaseOrderLink[];

  @Column({ type: 'int', name: 'created_by_user_id' })
  createdByUserId!: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User;

  @Column({ type: 'int', name: 'approved_by_user_id', nullable: true })
  approvedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser: User | null = null;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true }) // Not in SQL, but good for Model pattern
  updatedByUserId: number | null = null;
  // Note: SQL schema doesn't have updated_by_user_id for purchase_orders, but Model expects it.
  // If you add it to SQL:
  // @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  // @JoinColumn({ name: 'updated_by_user_id' })
  // updatedByUser: User | null = null;

  calculateTotals(): void {
    this.totalAmountHt = 0;
    this.totalVatAmount = 0;
    if (this.items && this.items.length > 0) {
      this.items.forEach((item) => {
        const quantity = Number(item.quantity);
        const unitPriceHt = Number(item.unitPriceHt);

        if (isNaN(quantity) || isNaN(unitPriceHt)) {
          logger.error(
            { item, quantity, unitPriceHt },
            'Invalid quantity or unitPriceHt in calculateTotals',
          );
          // Optionally throw an error or handle this case, for now, skip this item's calculation
          return;
        }

        const lineTotalHt = quantity * unitPriceHt;
        this.totalAmountHt += lineTotalHt;
        if (item.vatRatePercentage !== null && !isNaN(Number(item.vatRatePercentage))) {
          this.totalVatAmount += lineTotalHt * (Number(item.vatRatePercentage) / 100);
        }
        // TODO: Gérer la TVA par défaut du produit/fournisseur/entreprise si item.vatRatePercentage est null
      });
    }
    this.totalAmountHt = parseFloat(this.totalAmountHt.toFixed(4));
    this.totalVatAmount = parseFloat(this.totalVatAmount.toFixed(4));
    this.totalAmountTtc = parseFloat((this.totalAmountHt + this.totalVatAmount).toFixed(4));
  }

  toApi(): PurchaseOrderApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      orderNumber: this.orderNumber,
      supplierId: this.supplierId,
      supplier: this.supplier
        ? ({
            id: this.supplier.id,
            name: this.supplier.name,
            email: this.supplier.email,
          } as SupplierApiResponse)
        : null,
      orderDate: Model.formatISODate(this.orderDate),
      expectedDeliveryDate: Model.formatISODate(this.expectedDeliveryDate),
      status: this.status,
      currencyId: this.currencyId,
      currency: this.currency ? this.currency?.toApi() : null,
      totalAmountHt: Number(this.totalAmountHt),
      totalVatAmount: Number(this.totalVatAmount),
      totalAmountTtc: Number(this.totalAmountTtc),
      shippingAddressId: this.shippingAddressId,
      shippingAddress: this.shippingAddress ? this.shippingAddress.toApi() : null,
      warehouseIdForDelivery: this.warehouseIdForDelivery,
      warehouseForDelivery: this.warehouseForDelivery
        ? ({
            id: this.warehouseForDelivery.id,
            name: this.warehouseForDelivery.name,
            code: this.warehouseForDelivery.code,
          } as WarehouseApiResponse)
        : null,
      shopIdForDelivery: this.shopIdForDelivery,
      shopForDelivery: this.shopForDelivery
        ? ({
            id: this.shopForDelivery.id,
            name: this.shopForDelivery.name,
            code: this.shopForDelivery.code,
          } as ShopApiResponse)
        : null,
      notes: this.notes,
      items: this.items?.map((item) => item.toApi()),
      createdByUserId: this.createdByUserId,
      createdByUser: this.createdByUser ? this.createdByUser?.toApi() : null,
      approvedByUserId: this.approvedByUserId,
      approvedByUser: this.approvedByUser ? this.approvedByUser.toApi() : null,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      supplierId: this.supplierId,
      orderDate: this.orderDate,
      expectedDeliveryDate: this.expectedDeliveryDate,
      status: this.status,
      currencyId: this.currencyId,
      shippingAddressId: this.shippingAddressId,
      warehouseIdForDelivery: this.warehouseIdForDelivery,
      shopIdForDelivery: this.shopIdForDelivery,
      notes: this.notes,
    };
    const result = purchaseOrderSchemaValidation.safeParse(dataToValidate);
    purchaseOrderValidationInputErrors.length = 0;
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
      );
      purchaseOrderValidationInputErrors.push(...errors);
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          purchaseOrderValidationInputErrors.push(
            `Invalid item data for product ID ${item.productId}.`,
          );
          return false;
        }
      }
    } else if (this.status !== PurchaseOrderStatus.DRAFT) {
      purchaseOrderValidationInputErrors.push(
        'Items: A non-draft purchase order should have items.',
      );
      // return false; // Can be too strict
    }
    return true;
  }
}
