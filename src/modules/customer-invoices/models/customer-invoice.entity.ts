import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import {
  CreateCustomerInvoiceItemInput,
  CustomerInvoiceItem,
  CustomerInvoiceItemApiResponse,
  customerInvoiceItemValidationInputErrors,
} from '../customer-invoice-items/models/customer-invoice-item.entity';
import { Customer, CustomerApiResponse } from '@/modules/customers/models/customer.entity';
import { Currency, CurrencyApiResponse } from '@/modules/currencies/models/currency.entity';
import { Address, AddressApiResponse } from '@/modules/addresses/models/address.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { CustomerInvoiceSalesOrderLink } from './customer-invoice-sales-order-link.entity';

export enum CustomerInvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOIDED = 'voided',
  CANCELLED = 'cancelled',
}

const customerInvoiceSchemaValidation = z.object({
  customerId: z.number().int().positive({ message: 'Customer ID is required.' }),
  invoiceDate: z.coerce.date({ required_error: 'Invoice date is required.' }),
  dueDate: z.coerce.date().nullable().optional(),
  currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
  status: z.nativeEnum(CustomerInvoiceStatus).optional().default(CustomerInvoiceStatus.DRAFT),
  billingAddressId: z.number().int().positive({ message: 'Billing Address ID is required.' }),
  shippingAddressId: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
});

export type CreateCustomerInvoiceInput = {
  invoiceNumber?: string;
  customerId: number;
  invoiceDate: string | Date;
  dueDate?: string | Date | null;
  currencyId: number;
  status?: CustomerInvoiceStatus;
  billingAddressId: number;
  shippingAddressId?: number | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  items: CreateCustomerInvoiceItemInput[];
  salesOrderIds?: number[];
};

export type UpdateCustomerInvoiceInput = Partial<
  Omit<CreateCustomerInvoiceInput, 'items' | 'customerId'>
> & {
  items?: Array<Partial<CreateCustomerInvoiceItemInput> & { id?: number; _delete?: boolean }>;
  salesOrderIds?: number[];
};

export type SalesOrderLinkApiResponse = {
  salesOrderId: number;
  salesOrderNumber?: string;
};

export type CustomerInvoiceApiResponse = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customer?: CustomerApiResponse | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  totalAmountHt: number;
  totalVatAmount: number;
  totalAmountTtc: number;
  amountPaid: number;
  status: CustomerInvoiceStatus;
  billingAddressId: number;
  billingAddress?: AddressApiResponse | null;
  shippingAddressId: number | null;
  shippingAddress?: AddressApiResponse | null;
  notes: string | null;
  termsAndConditions: string | null;
  items?: CustomerInvoiceItemApiResponse[];
  salesOrderLinks?: SalesOrderLinkApiResponse[];
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerInvoiceValidationInputErrors: string[] = [];

@Entity({ name: 'customer_invoices' })
@Unique('uq_ci_invoice_number', ['invoiceNumber'])
@Index(['customerId', 'status'])
@Index(['invoiceDate', 'dueDate'])
export class CustomerInvoice extends Model {
  @Column({ type: 'varchar', length: 50, name: 'invoice_number', unique: true })
  invoiceNumber!: string; // Auto-généré

  @Column({ type: 'int', name: 'customer_id' })
  customerId!: number;

  @ManyToOne(() => Customer, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'date', name: 'invoice_date' })
  invoiceDate!: Date;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: Date | null = null;

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

  @Column({ type: 'decimal', precision: 15, scale: 4, name: 'amount_paid', default: 0.0 })
  amountPaid: number = 0; // Géré par le module Payments

  @Column({
    type: 'enum',
    enum: CustomerInvoiceStatus,
    default: CustomerInvoiceStatus.DRAFT,
  })
  status!: CustomerInvoiceStatus;

  @Column({ type: 'int', name: 'billing_address_id' })
  billingAddressId!: number;

  @ManyToOne(() => Address, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_address_id' })
  billingAddress!: Address;

  @Column({ type: 'int', name: 'shipping_address_id', nullable: true })
  shippingAddressId: number | null = null;

  @ManyToOne(() => Address, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shipping_address_id' })
  shippingAddress: Address | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'text', nullable: true, name: 'terms_and_conditions' })
  termsAndConditions: string | null = null;

  @OneToMany(() => CustomerInvoiceItem, (item) => item.customerInvoice, {
    cascade: ['insert', 'update', 'remove'],
    eager: true,
  })
  items!: CustomerInvoiceItem[];

  @OneToMany(() => CustomerInvoiceSalesOrderLink, (link) => link.customerInvoice, {
    cascade: ['insert', 'remove'],
    eager: false,
  }) // Load on demand
  salesOrderLinks?: CustomerInvoiceSalesOrderLink[];

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true }) // User who created this invoice
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null = null;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  calculateTotals(): void {
    this.totalAmountHt = 0;
    this.totalVatAmount = 0;
    if (this.items && this.items.length > 0) {
      this.items.forEach((item) => {
        item.totalLineAmountHt = item.calculateTotalLineAmountHt();
        this.totalAmountHt += Number(item.totalLineAmountHt);
        if (item.vatRatePercentage !== null) {
          this.totalVatAmount +=
            Number(item.totalLineAmountHt) * (Number(item.vatRatePercentage) / 100);
        }
      });
    }
    this.totalAmountHt = parseFloat(this.totalAmountHt.toFixed(4));
    this.totalVatAmount = parseFloat(this.totalVatAmount.toFixed(4));
    this.totalAmountTtc = parseFloat((this.totalAmountHt + this.totalVatAmount).toFixed(4));
  }

  toApi(): CustomerInvoiceApiResponse {
    const base = super.toApi();
    const soLinks =
      this.salesOrderLinks?.map((link) => ({
        salesOrderId: link.salesOrderId,
        salesOrderNumber: link.salesOrder?.orderNumber,
      })) ?? undefined;

    return {
      ...base,
      id: this.id,
      invoiceNumber: this.invoiceNumber,
      customerId: this.customerId,
      customer: this.customer
        ? ({
            id: this.customer.id,
            displayName: this.customer.getDisplayName(),
            email: this.customer.email,
          } as CustomerApiResponse)
        : null,
      invoiceDate: Model.formatISODate(this.invoiceDate),
      dueDate: Model.formatISODate(this.dueDate),
      currencyId: this.currencyId,
      currency: this.currency ? this.currency.toApi() : null,
      totalAmountHt: Number(this.totalAmountHt),
      totalVatAmount: Number(this.totalVatAmount),
      totalAmountTtc: Number(this.totalAmountTtc),
      amountPaid: Number(this.amountPaid),
      status: this.status,
      billingAddressId: this.billingAddressId,
      billingAddress: this.billingAddress ? this.billingAddress.toApi() : null,
      shippingAddressId: this.shippingAddressId,
      shippingAddress: this.shippingAddress ? this.shippingAddress.toApi() : null,
      notes: this.notes,
      termsAndConditions: this.termsAndConditions,
      items: this.items?.map((item) => item.toApi()),
      salesOrderLinks: soLinks,
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
      invoiceDate: this.invoiceDate,
      dueDate: this.dueDate,
      currencyId: this.currencyId,
      status: this.status,
      billingAddressId: this.billingAddressId,
      shippingAddressId: this.shippingAddressId,
      notes: this.notes,
      termsAndConditions: this.termsAndConditions,
    };
    const result = customerInvoiceSchemaValidation.safeParse(dataToValidate);
    customerInvoiceValidationInputErrors.length = 0;
    if (!result.success) {
      customerInvoiceValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          customerInvoiceValidationInputErrors.push(
            `Invalid item data (ProdID: ${item.productId ?? 'N/A'}). Errors: ${customerInvoiceItemValidationInputErrors.join('; ')}`,
          );
          return false;
        }
      }
    } else if (this.status !== CustomerInvoiceStatus.DRAFT) {
      customerInvoiceValidationInputErrors.push(
        'Items: A non-draft customer invoice should have items.',
      );
      return false;
    }
    return true;
  }
}
