import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { Supplier, SupplierApiResponse } from '@/modules/suppliers/models/supplier.entity';
import { Currency, CurrencyApiResponse } from '@/modules/currencies/models/currency.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { SupplierInvoicePurchaseOrderLink } from './supplier-invoice-purchse-order-link.entity';
import {
  CreateSupplierInvoiceItemInput,
  SupplierInvoiceItem,
  SupplierInvoiceItemApiResponse,
} from '../supplier-invoice-items/models/supplier-invoice-item.entity';

export enum SupplierInvoiceStatus {
  DRAFT = 'draft',
  PENDING_PAYMENT = 'pending_payment',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  OIDED = 'voided',
}

const supplierInvoiceSchemaValidation = z.object({
  invoiceNumber: z.string().min(1, { message: "Supplier's invoice number is required." }).max(100),
  supplierId: z.number().int().positive({ message: 'Supplier ID is required.' }),
  invoiceDate: z.coerce.date({ required_error: 'Invoice date is required.' }),
  dueDate: z.coerce.date().nullable().optional(),
  currencyId: z.number().int().positive({ message: 'Currency ID is required.' }),
  status: z
    .nativeEnum(SupplierInvoiceStatus)
    .optional()
    .default(SupplierInvoiceStatus.PENDING_PAYMENT),
  notes: z.string().nullable().optional(),
  fileAttachmentUrl: z
    .string()
    .url({ message: 'Invalid URL format for attachment' })
    .max(2048)
    .nullable()
    .optional(),
});

export type CreateSupplierInvoiceInput = {
  invoiceNumber: string;
  supplierId: number;
  invoiceDate: string | Date;
  dueDate?: string | Date | null;
  currencyId: number;
  status?: SupplierInvoiceStatus;
  notes?: string | null;
  fileAttachmentUrl?: string | null;
  items: CreateSupplierInvoiceItemInput[];
  purchaseOrderIds?: number[];
};

export type UpdateSupplierInvoiceInput = Partial<
  Omit<CreateSupplierInvoiceInput, 'items' | 'supplierId'>
> & {
  items?: Array<Partial<CreateSupplierInvoiceItemInput> & { id?: number; _delete?: boolean }>;
};

export type SupplierInvoiceApiResponse = {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  supplier?: SupplierApiResponse | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currencyId: number;
  currency?: CurrencyApiResponse | null;
  totalAmountHt: number;
  totalVatAmount: number;
  totalAmountTtc: number;
  amountPaid?: number;
  status: SupplierInvoiceStatus;
  notes: string | null;
  fileAttachmentUrl: string | null;
  items?: SupplierInvoiceItemApiResponse[];
  purchaseOrderLinks?: { purchaseOrderId: number; purchaseOrderNumber?: string | null }[];
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const supplierInvoiceValidationInputErrors: string[] = [];

@Entity({ name: 'supplier_invoices' })
@Unique('uq_supplier_invoice_number', ['supplierId', 'invoiceNumber'])
@Index(['supplierId', 'status'])
@Index(['invoiceDate', 'dueDate'])
export class SupplierInvoice extends Model {
  @Column({ type: 'varchar', length: 100, name: 'invoice_number' })
  invoiceNumber!: string;

  @Column({ type: 'int', name: 'supplier_id' })
  supplierId!: number;

  @ManyToOne(() => Supplier, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

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
  amountPaid: number = 0;

  @Column({
    type: 'varchar',
    length: 25,
    enum: SupplierInvoiceStatus,
    default: SupplierInvoiceStatus.PENDING_PAYMENT,
  })
  status!: SupplierInvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @Column({ type: 'varchar', length: 2048, name: 'file_attachment_url', nullable: true })
  fileAttachmentUrl: string | null = null;

  @OneToMany(() => SupplierInvoiceItem, (item) => item.supplierInvoice, {
    cascade: ['insert', 'update', 'remove'],
    eager: true,
  })
  items!: SupplierInvoiceItem[];

  @OneToMany(() => SupplierInvoicePurchaseOrderLink, (link) => link.supplierInvoice, {
    cascade: ['insert', 'remove'],
    eager: false,
  })
  purchaseOrderLinks?: SupplierInvoicePurchaseOrderLink[];

  @Column({ type: 'int', name: 'created_by_user_id', nullable: true })
  createdByUserId: number | null = null;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null = null;

  @Column({ type: 'int', name: 'updated_by_user_id', nullable: true })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  calculateTotals(): void {
    this.totalAmountHt = 0;
    this.totalVatAmount = 0;
    if (this.items && this.items.length > 0) {
      this.items.forEach((item) => {
        const quantity = Number(item.quantity);
        const unitPriceHt = Number(item.unitPriceHt);
        const lineTotalHt = parseFloat((quantity * unitPriceHt).toFixed(4));
        item.totalLineAmountHt = lineTotalHt;

        this.totalAmountHt += lineTotalHt;
        if (item.vatRatePercentage !== null) {
          this.totalVatAmount += lineTotalHt * (Number(item.vatRatePercentage) / 100);
        }
      });
    }
    this.totalAmountHt = parseFloat(this.totalAmountHt.toFixed(4));
    this.totalVatAmount = parseFloat(this.totalVatAmount.toFixed(4));
    this.totalAmountTtc = parseFloat((this.totalAmountHt + this.totalVatAmount).toFixed(4));
  }

  toApi(): SupplierInvoiceApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      invoiceNumber: this.invoiceNumber,
      supplierId: this.supplierId,
      invoiceDate: Model.formatISODate(this.invoiceDate),
      dueDate: Model.formatISODate(this.dueDate),
      currencyId: this.currencyId,
      totalAmountHt: Number(this.totalAmountHt),
      totalVatAmount: Number(this.totalVatAmount),
      totalAmountTtc: Number(this.totalAmountTtc),
      amountPaid: Number(this.amountPaid),
      status: this.status,
      notes: this.notes,
      fileAttachmentUrl: this.fileAttachmentUrl,
      supplier: this.supplier ? this.supplier.toApi() : null,
      currency: this.currency ? this.currency.toApi() : null,
      items: this.items?.map((item) => item.toApi()) || [],
      purchaseOrderLinks: Array.isArray(this.purchaseOrderLinks) ? this.purchaseOrderLinks : [],
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }

  isValid(): boolean {
    const dataToValidate = {
      invoiceNumber: this.invoiceNumber,
      supplierId: this.supplierId,
      invoiceDate: this.invoiceDate,
      dueDate: this.dueDate,
      currencyId: this.currencyId,
      status: this.status,
      notes: this.notes,
      fileAttachmentUrl: this.fileAttachmentUrl,
    };
    const result = supplierInvoiceSchemaValidation.safeParse(dataToValidate);
    supplierInvoiceValidationInputErrors.length = 0;
    if (!result.success) {
      supplierInvoiceValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          supplierInvoiceValidationInputErrors.push(
            `Invalid item data for product ID ${item.productId ?? 'N/A'}.`,
          );
          return false;
        }
      }
    } else if (
      this.status !== SupplierInvoiceStatus.DRAFT &&
      this.status !== SupplierInvoiceStatus.PENDING_PAYMENT
    ) {
      supplierInvoiceValidationInputErrors.push(
        'Items: A non-draft supplier invoice should have items.',
      );
      return false;
    }
    return true;
  }
}
