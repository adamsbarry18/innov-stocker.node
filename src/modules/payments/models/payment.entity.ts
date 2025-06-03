import { Model } from '@/common/models/Model';
import {
  BankAccount,
  BankAccountApiResponse,
} from '@/modules/bank-accounts/models/bank-account.entity';
import {
  CashRegisterSession,
  CashRegisterSessionApiResponse,
} from '@/modules/cash-register-sessions/models/cash-register-session.entity';
import { Currency, CurrencyApiResponse } from '@/modules/currencies/models/currency.entity';
import {
  CustomerInvoice,
  CustomerInvoiceApiResponse,
} from '@/modules/customer-invoices/models/customer-invoice.entity';
import { Customer, CustomerApiResponse } from '@/modules/customers/models/customer.entity';
import {
  PaymentMethod,
  PaymentMethodApiResponse,
} from '@/modules/payment-methods/models/payment-method.entity';
import {
  PurchaseOrder,
  PurchaseOrderApiResponse,
} from '@/modules/purchase-orders/models/purchase-order.entity';
import {
  SalesOrder,
  SalesOrderApiResponse,
} from '@/modules/sales-orders/models/sales-order.entity';
import {
  SupplierInvoice,
  SupplierInvoiceApiResponse,
} from '@/modules/supplier-invoices/models/supplier-invoice.entity';
import { Supplier, SupplierApiResponse } from '@/modules/suppliers/models/supplier.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';

export enum PaymentDirection {
  INBOUND = 'inbound', // Paiement reçu (ex: d'un client)
  OUTBOUND = 'outbound', // Paiement effectué (ex: à un fournisseur)
}

// Zod Schema for validation
export const createPaymentSchema = z
  .object({
    paymentDate: z.coerce.date({ required_error: 'Payment date is required.' }),
    amount: z.number().positive({ message: 'Payment amount must be positive.' }),
    currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
    paymentMethodId: z.number().int().positive({ message: 'Payment method ID is required.' }),
    direction: z.nativeEnum(PaymentDirection),

    customerId: z.number().int().positive().nullable().optional(),
    supplierId: z.number().int().positive().nullable().optional(),

    customerInvoiceId: z.number().int().positive().nullable().optional(),
    supplierInvoiceId: z.number().int().positive().nullable().optional(),
    salesOrderId: z.number().int().positive().nullable().optional(), // For pre-payments/deposits
    purchaseOrderId: z.number().int().positive().nullable().optional(), // For pre-payments/deposits

    bankAccountId: z.number().int().positive().nullable().optional(),
    cashRegisterSessionId: z.number().int().positive().nullable().optional(), // If payment through POS

    referenceNumber: z.string().max(255).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => data.bankAccountId || data.cashRegisterSessionId, {
    message: 'Payment must be associated with either a bank account or a cash register session.',
    path: ['bankAccountId'], // Or a general path
  })
  .refine((data) => !(data.bankAccountId && data.cashRegisterSessionId), {
    message: 'Payment cannot be associated with both a bank account and a cash register session.',
    path: ['bankAccountId'],
  })
  .refine(
    (data) => {
      if (data.direction === PaymentDirection.INBOUND) {
        return data.customerId || data.customerInvoiceId || data.salesOrderId;
      }
      if (data.direction === PaymentDirection.OUTBOUND) {
        return data.supplierId || data.supplierInvoiceId || data.purchaseOrderId;
      }
      return false;
    },
    {
      message:
        'Payment must be linked to a customer/invoice/order for inbound, or supplier/invoice/order for outbound.',
    },
  );

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export type PaymentApiResponse = {
  id: number;
  paymentDate: string | null;
  amount: number;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  paymentMethodId: number;
  paymentMethod?: PaymentMethodApiResponse | null;
  direction: PaymentDirection;
  customerId: number | null;
  customer?: CustomerApiResponse | null;
  supplierId: number | null;
  supplier?: SupplierApiResponse | null;
  customerInvoiceId: number | null;
  customerInvoice?: CustomerInvoiceApiResponse | null;
  supplierInvoiceId: number | null;
  supplierInvoice?: SupplierInvoiceApiResponse | null;
  salesOrderId: number | null;
  salesOrder?: SalesOrderApiResponse | null;
  purchaseOrderId: number | null;
  purchaseOrder?: PurchaseOrderApiResponse | null;
  bankAccountId: number | null;
  bankAccount?: BankAccountApiResponse | null;
  cashRegisterSessionId: number | null;
  cashRegisterSession?: CashRegisterSessionApiResponse | null;
  referenceNumber: string | null;
  notes: string | null;
  recordedByUserId: number;
  recordedByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};
@Entity({ name: 'payments' })
@Index(['paymentDate', 'direction'])
@Index(['customerId', 'customerInvoiceId'])
@Index(['supplierId', 'supplierInvoiceId'])
@Index(['paymentMethodId'])
export class Payment extends Model {
  @Column({ type: 'date', name: 'payment_date' })
  paymentDate!: Date;

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  amount!: number;

  @Column({ type: 'int', name: 'currency_id' })
  currencyId!: number;
  @ManyToOne(() => Currency, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency;

  @Column({ type: 'int', name: 'payment_method_id' })
  paymentMethodId!: number;
  @ManyToOne(() => PaymentMethod, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', length: 10, enum: PaymentDirection })
  direction!: PaymentDirection;

  @Column({ type: 'int', name: 'customer_id', nullable: true })
  customerId: number | null = null;
  @ManyToOne(() => Customer, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null = null;

  @Column({ type: 'int', name: 'supplier_id', nullable: true })
  supplierId: number | null = null;
  @ManyToOne(() => Supplier, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null = null;

  @Column({ type: 'int', name: 'customer_invoice_id', nullable: true })
  customerInvoiceId: number | null = null;
  @ManyToOne(() => CustomerInvoice, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'customer_invoice_id' })
  customerInvoice?: CustomerInvoice | null;

  @Column({ type: 'int', name: 'supplier_invoice_id', nullable: true })
  supplierInvoiceId: number | null = null;
  @ManyToOne(() => SupplierInvoice, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'supplier_invoice_id' })
  supplierInvoice?: SupplierInvoice | null;

  @Column({ type: 'int', name: 'sales_order_id', nullable: true })
  salesOrderId: number | null = null;
  @ManyToOne(() => SalesOrder, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder?: SalesOrder | null;

  @Column({ type: 'int', name: 'purchase_order_id', nullable: true })
  purchaseOrderId: number | null = null;
  @ManyToOne(() => PurchaseOrder, { eager: false, onDelete: 'SET NULL', nullable: true }) // Eager false
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder | null;

  @Column({ type: 'int', name: 'bank_account_id', nullable: true })
  bankAccountId: number | null = null;
  @ManyToOne(() => BankAccount, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: BankAccount | null = null;

  @Column({ type: 'int', name: 'cash_register_session_id', nullable: true })
  cashRegisterSessionId: number | null = null;
  @ManyToOne(() => CashRegisterSession, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cash_register_session_id' })
  cashRegisterSession: CashRegisterSession | null = null;

  @Column({ type: 'varchar', length: 255, name: 'reference_number', nullable: true })
  referenceNumber: string | null = null;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'int', name: 'recorded_by_user_id' })
  recordedByUserId!: number;
  @ManyToOne(() => User, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recorded_by_user_id' })
  recordedByUser!: User;

  // deletedAt is inherited from Model for soft delete

  toApi(): PaymentApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      paymentDate: Model.formatISODate(this.paymentDate),
      amount: Number(this.amount),
      currencyId: this.currencyId,
      currency: this.currency ? this.currency.toApi() : null,
      paymentMethodId: this.paymentMethodId,
      paymentMethod: this.paymentMethod ? this.paymentMethod.toApi() : null,
      direction: this.direction,
      customerId: this.customerId,
      customer: this.customer
        ? ({
            id: this.customer.id,
            displayName: this.customer.getDisplayName(),
            email: this.customer.email,
          } as CustomerApiResponse)
        : null,
      supplierId: this.supplierId,
      supplier: this.supplier
        ? ({
            id: this.supplier.id,
            name: this.supplier.name,
            email: this.supplier.email,
          } as SupplierApiResponse)
        : null,
      customerInvoiceId: this.customerInvoiceId,
      customerInvoice: this.customerInvoice ? this.customerInvoice.toApi() : null,
      supplierInvoiceId: this.supplierInvoiceId,
      supplierInvoice: this.supplierInvoice ? this.supplierInvoice.toApi() : null,
      salesOrderId: this.salesOrderId,
      salesOrder: this.salesOrder ? this.salesOrder.toApi() : null,
      purchaseOrderId: this.purchaseOrderId,
      purchaseOrder: this.purchaseOrder ? this.purchaseOrder.toApi() : null,
      bankAccountId: this.bankAccountId,
      bankAccount: this.bankAccount ? this.bankAccount.toApi() : null,
      cashRegisterSessionId: this.cashRegisterSessionId,
      cashRegisterSession: this.cashRegisterSession ? this.cashRegisterSession.toApi() : null,
      referenceNumber: this.referenceNumber,
      notes: this.notes,
      recordedByUserId: this.recordedByUserId,
      recordedByUser: this.recordedByUser ? this.recordedByUser.toApi() : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  // isValid() can be basic, Zod schema in service for DTO is more comprehensive
  isValidBasic(): boolean {
    if (this.amount <= 0) return false;
    if (!this.bankAccountId && !this.cashRegisterSessionId) return false;
    if (this.bankAccountId && this.cashRegisterSessionId) return false;
    return true;
  }
}
