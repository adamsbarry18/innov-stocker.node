import { Model } from '@/common/models/Model';
import { Address, AddressApiResponse } from '@/modules/addresses/models/address.entity';
import { Currency, CurrencyApiResponse } from '@/modules/currencies/models/currency.entity';
import { Customer, CustomerApiResponse } from '@/modules/customers/models/customer.entity';
import { Quote } from '@/modules/quotes/models/quote.entity';
import { Shop, ShopApiResponse } from '@/modules/shops/models/shop.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Warehouse, WarehouseApiResponse } from '@/modules/warehouses/models/warehouse.entity';
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import {
  CreateSalesOrderItemInput,
  SalesOrderItem,
  SalesOrderItemApiResponse,
} from '../sales-order-items/models/sales-order-item.entity';
import { CustomerInvoiceSalesOrderLink } from '@/modules/customer-invoices/models/customer-invoice-sales-order-link.entity';

export enum SalesOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval', // Attente validation interne
  APPROVED = 'approved', // Prêt pour paiement / préparation
  PAYMENT_PENDING = 'payment_pending', // En attente de paiement
  PAYMENT_RECEIVED = 'payment_received', // Paiement reçu (total ou partiel suffisant)
  IN_PREPARATION = 'in_preparation', // Préparation de la commande en cours
  PARTIALLY_SHIPPED = 'partially_shipped', // Partiellement expédiée
  FULLY_SHIPPED = 'fully_shipped', // Totalement expédiée
  INVOICED = 'invoiced', // Facturée (totalement ou partiellement)
  COMPLETED = 'completed', // Commande terminée et clôturée (shipped & invoiced)
  CANCELLED = 'cancelled',
}

const salesOrderSchemaValidation = z
  .object({
    customerId: z.number().int().positive().optional(),
    quoteId: z.number().int().positive().nullable().optional(),
    orderDate: z.coerce.date().optional(),
    status: z.nativeEnum(SalesOrderStatus).optional().default(SalesOrderStatus.DRAFT),
    currencyId: z.number().int().positive().optional(),
    shippingFeesHt: z.number().min(0).optional().default(0),
    shippingAddressId: z.number().int().positive().optional(),
    billingAddressId: z.number().int().positive().optional(),
    dispatchWarehouseId: z.number().int().positive().nullable().optional(),
    dispatchShopId: z.number().int().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((data) => data.dispatchWarehouseId || data.dispatchShopId, {
    // Au moins un lieu d'expédition
    message: 'Either dispatchWarehouseId or dispatchShopId must be provided.',
    path: ['dispatchWarehouseId'],
  });

export type CreateSalesOrderInput = {
  customerId: number;
  quoteId?: number | null;
  orderDate: string | Date;
  status?: SalesOrderStatus;
  currencyId: number;
  shippingFeesHt?: number;
  shippingAddressId: number;
  billingAddressId: number;
  dispatchWarehouseId?: number | null;
  dispatchShopId?: number | null;
  notes?: string | null;
  items: CreateSalesOrderItemInput[];
};

export type UpdateSalesOrderInput = Partial<
  Omit<CreateSalesOrderInput, 'items' | 'customerId' | 'quoteId'>
> & {
  items?: Array<Partial<CreateSalesOrderItemInput> & { id?: number; _delete?: boolean }>;
};

export type SalesOrderApiResponse = {
  id: number;
  orderNumber: string;
  customerId: number;
  customer?: CustomerApiResponse | null;
  quoteId: number | null;
  quoteNumber?: string | null; // Populated from quote
  orderDate: string | null;
  status: SalesOrderStatus;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  totalAmountHt: number;
  totalVatAmount: number;
  totalAmountTtc: number;
  shippingFeesHt: number;
  shippingAddressId: number;
  shippingAddress?: AddressApiResponse | null;
  billingAddressId: number;
  billingAddress?: AddressApiResponse | null;
  dispatchWarehouseId: number | null;
  dispatchWarehouse?: WarehouseApiResponse | null;
  dispatchShopId: number | null;
  dispatchShop?: ShopApiResponse | null;
  notes: string | null;
  items?: SalesOrderItemApiResponse[];
  createdByUserId: number;
  createdByUser?: UserApiResponse | null;
  // approvedByUserId, etc. si vous ajoutez des champs d'audit spécifiques aux statuts
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const salesOrderValidationInputErrors: string[] = [];

@Entity({ name: 'sales_orders' })
@Unique('uq_so_order_number', ['orderNumber'])
@Index(['customerId', 'status'])
@Index(['orderDate'])
export class SalesOrder extends Model {
  @Column({ type: 'varchar', length: 50, name: 'order_number', unique: true })
  orderNumber!: string; // Auto-generated

  @Column({ type: 'int', name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'int', name: 'quote_id', nullable: true })
  quoteId: number | null = null;

  @ManyToOne(() => Quote, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote?: Quote | null;

  @Column({ type: 'date', name: 'order_date' })
  orderDate!: Date;

  @Column({
    type: 'varchar',
    length: 30,
    enum: SalesOrderStatus,
    default: SalesOrderStatus.DRAFT,
  })
  status!: SalesOrderStatus;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;

  @ManyToOne(() => Currency, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_amount_ht', default: 0.0 })
  totalAmountHt: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_vat_amount', default: 0.0 })
  totalVatAmount: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'total_amount_ttc', default: 0.0 })
  totalAmountTtc: number = 0;

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'shipping_fees_ht', default: 0.0 })
  shippingFeesHt: number = 0;

  @Column({ type: 'int', name: 'shipping_address_id' })
  shippingAddressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipping_address_id' })
  shippingAddress!: Address;

  @Column({ type: 'int', name: 'billing_address_id' })
  billingAddressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_address_id' })
  billingAddress!: Address;

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

  @OneToMany(() => SalesOrderItem, (item) => item.salesOrder, {
    cascade: ['insert', 'update', 'remove'],
    eager: false, // Changed to false
  })
  items!: SalesOrderItem[];

  @Column({ type: 'int', name: 'created_by_user_id' })
  createdByUserId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  @OneToMany(() => CustomerInvoiceSalesOrderLink, (link) => link.salesOrder)
  customerInvoiceLinks!: CustomerInvoiceSalesOrderLink[];

  calculateTotals(): void {
    this.totalAmountHt = 0;
    this.totalVatAmount = 0;
    if (this.items && this.items.length > 0) {
      this.items.forEach((item) => {
        const lineTotalHt = Number(item.totalLineAmountHt);
        this.totalAmountHt += lineTotalHt;
        if (item.vatRatePercentage !== null) {
          this.totalVatAmount += lineTotalHt * (Number(item.vatRatePercentage) / 100);
        }
      });
    }
    this.totalAmountHt = parseFloat(this.totalAmountHt.toFixed(4));
    this.totalVatAmount = parseFloat(this.totalVatAmount.toFixed(4));
    const totalHtWithShipping = this.totalAmountHt + Number(this.shippingFeesHt || 0);
    this.totalAmountTtc = parseFloat((totalHtWithShipping + this.totalVatAmount).toFixed(4));
  }

  toApi(): SalesOrderApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      customer: this.customer
        ? ({
            id: this.customer.id,
            displayName: this.customer.getDisplayName(),
            email: this.customer.email,
          } as CustomerApiResponse)
        : null,
      quoteId: this.quoteId,
      quoteNumber: this.quote?.quoteNumber, // Nécessite de charger la relation 'quote'
      orderDate: Model.formatISODate(this.orderDate),
      status: this.status,
      currencyId: this.currencyId,
      currency: this.currency ? this.currency.toApi() : null,
      totalAmountHt: Number(this.totalAmountHt),
      totalVatAmount: Number(this.totalVatAmount),
      totalAmountTtc: Number(this.totalAmountTtc),
      shippingFeesHt: Number(this.shippingFeesHt || 0),
      shippingAddressId: this.shippingAddressId,
      shippingAddress: this.shippingAddress ? this.shippingAddress.toApi() : null,
      billingAddressId: this.billingAddressId,
      billingAddress: this.billingAddress ? this.billingAddress.toApi() : null,
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
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      customerId: this.customerId,
      quoteId: this.quoteId,
      orderDate: this.orderDate,
      status: this.status,
      currencyId: this.currencyId,
      shippingFeesHt: this.shippingFeesHt,
      shippingAddressId: this.shippingAddressId,
      billingAddressId: this.billingAddressId,
      dispatchWarehouseId: this.dispatchWarehouseId,
      dispatchShopId: this.dispatchShopId,
      notes: this.notes,
    };
    const result = salesOrderSchemaValidation.safeParse(dataToValidate);
    salesOrderValidationInputErrors.length = 0;
    if (!result.success) {
      salesOrderValidationInputErrors.push(
        ...result.error.issues.map(
          (issue: z.ZodIssue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items && this.items.length > 0) {
      for (const item of this.items) {
        if (!item.isValid()) {
          salesOrderValidationInputErrors.push(
            `Invalid item data for product ID ${item.productId}.`,
          );
          return false;
        }
      }
    } else if (this.status !== SalesOrderStatus.DRAFT) {
      salesOrderValidationInputErrors.push('Items: A non-draft sales order should have items.');
      return false;
    }
    return true;
  }
}
