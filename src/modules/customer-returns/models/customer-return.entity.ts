import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { z } from 'zod';
import {
  CreateCustomerReturnItemInput,
  CustomerReturnItem,
  CustomerReturnItemApiResponse,
  customerReturnItemValidationInputErrors,
  ReturnedItemCondition,
  ReturnItemActionTaken,
} from '../customer-return-items/models/customer-return-item.entity';
import { Customer, CustomerApiResponse } from '@/modules/customers/models/customer.entity';
import {
  SalesOrder,
  SalesOrderApiResponse,
} from '@/modules/sales-orders/models/sales-order.entity';
import {
  CustomerInvoice,
  CustomerInvoiceApiResponse,
} from '@/modules/customer-invoices/models/customer-invoice.entity';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Model } from '@/common/models/Model';
import { Warehouse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop } from '@/modules/shops/models/shop.entity';

export enum CustomerReturnStatus {
  REQUESTED = 'requested', // Demande de retour initiée par le client/staff
  APPROVED = 'approved', // Demande de retour approuvée
  REJECTED = 'rejected', // Demande de retour refusée
  PENDING_RECEPTION = 'pending_reception', // En attente de réception physique des articles
  RECEIVED_PARTIAL = 'received_partial', // Articles partiellement reçus
  RECEIVED_COMPLETE = 'received_complete', // Tous les articles attendus reçus
  INSPECTED = 'inspected', // Articles inspectés, actions (restock, etc.) déterminées
  REFUND_PENDING = 'refund_pending', // En attente de remboursement
  EXCHANGE_PENDING = 'exchange_pending', // En attente d'échange
  CREDIT_NOTE_ISSUED = 'credit_note_issued', // Avoir émis
  REFUNDED = 'refunded', // Remboursement effectué
  EXCHANGED = 'exchanged', // Échange effectué
  COMPLETED = 'completed', // Processus de retour terminé
  CANCELLED = 'cancelled', // Annulé avant traitement significatif
}

const customerReturnSchemaValidation = z.object({
  customerId: z.number().int().positive({ message: 'Customer ID is required.' }),
  salesOrderId: z.number().int().positive().nullable().optional(),
  customerInvoiceId: z.number().int().positive().nullable().optional(),
  warehouseId: z.number().int().positive().nullable().optional(),
  shopId: z.number().int().positive().nullable().optional(),
  returnDate: z.coerce.date({
    required_error: 'Return date (date of request or physical return) is required.',
  }),
  status: z.nativeEnum(CustomerReturnStatus).optional().default(CustomerReturnStatus.REQUESTED),
  reason: z.string().max(1000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateCustomerReturnInput = {
  customerId: number;
  salesOrderId?: number | null;
  customerInvoiceId?: number | null;
  warehouseId?: number | null;
  shopId?: number | null;
  returnDate: string | Date;
  status?: CustomerReturnStatus;
  reason?: string | null;
  notes?: string | null;
  items: CreateCustomerReturnItemInput[];
};

export type UpdateCustomerReturnInput = Partial<
  Omit<CreateCustomerReturnInput, 'items' | 'customerId' | 'salesOrderId' | 'customerInvoiceId'>
> & {
  status?: CustomerReturnStatus;
  items?: Array<Partial<CreateCustomerReturnItemInput>>;
};

// For PATCH actions
export type ApproveReturnInput = { notes?: string | null };
export type ReceiveReturnInput = {
  receivedDate?: string | Date | null;
  notes?: string | null;
  items: Array<{
    id: number;
    quantityReceived?: number;
    condition?: ReturnedItemCondition;
    actionTaken?: ReturnItemActionTaken;
    itemNotes?: string | null;
  }>;
};
export type CompleteReturnInput = {
  completionDate?: string | Date | null;
  resolutionNotes?: string | null;
};

export type CustomerReturnApiResponse = {
  id: number;
  returnNumber: string;
  customerId: number;
  customer?: CustomerApiResponse | null;
  salesOrderId: number | null;
  salesOrder?: SalesOrderApiResponse | null;
  customerInvoiceId: number | null;
  customerInvoice?: CustomerInvoiceApiResponse | null;
  returnDate: string | null;
  status: CustomerReturnStatus;
  reason: string | null;
  notes: string | null;
  items?: CustomerReturnItemApiResponse[];
  createdByUserId: number | null;
  createdByUser?: UserApiResponse | null;
  updatedByUserId: number | null;
  updatedByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const customerReturnValidationInputErrors: string[] = [];

@Entity({ name: 'customer_returns' })
@Unique('uq_cr_return_number', ['returnNumber'])
@Index(['customerId', 'status'])
@Index(['returnDate'])
export class CustomerReturn extends Model {
  @Column({ type: 'varchar', length: 50, name: 'return_number', unique: true })
  returnNumber!: string; // Auto-généré

  @Column({ type: 'int', name: 'customer_id' })
  customerId!: number;

  @Column({ type: 'int', name: 'warehouse_id', nullable: true })
  warehouseId: number | null = null;

  @ManyToOne(() => Warehouse, { eager: false, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse?: Warehouse | null;

  @Column({ type: 'int', name: 'shop_id', nullable: true })
  shopId: number | null = null;

  @ManyToOne(() => Shop, { eager: false, onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'shop_id' })
  shop?: Shop | null;

  @ManyToOne(() => Customer, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'int', name: 'sales_order_id', nullable: true })
  salesOrderId: number | null = null;

  @ManyToOne(() => SalesOrder, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder?: SalesOrder | null;

  @Column({ type: 'int', name: 'customer_invoice_id', nullable: true })
  customerInvoiceId: number | null = null;

  @ManyToOne(() => CustomerInvoice, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_invoice_id' })
  customerInvoice?: CustomerInvoice | null;

  @Column({ type: 'date', name: 'return_date' })
  returnDate!: Date;

  @Column({
    type: 'enum',
    enum: CustomerReturnStatus,
    default: CustomerReturnStatus.REQUESTED,
  })
  status!: CustomerReturnStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null = null;

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

  @Column({ type: 'text', nullable: true })
  notes: string | null = null;

  @OneToMany(() => CustomerReturnItem, (item) => item.customerReturn, {
    cascade: ['insert', 'update', 'remove'],
    eager: false,
  }) // Load items explicitly
  items!: CustomerReturnItem[];

  toApi(includeItems: boolean = false): CustomerReturnApiResponse {
    const base = super.toApi();
    const response: CustomerReturnApiResponse = {
      ...base,
      id: this.id,
      returnNumber: this.returnNumber,
      customerId: this.customerId,
      customer: this.customer
        ? ({
            id: this.customer.id,
            displayName: this.customer.getDisplayName(),
            email: this.customer.email,
          } as CustomerApiResponse)
        : null,
      salesOrderId: this.salesOrderId,
      salesOrder: this.salesOrder ? this.salesOrder.toApi() : null,
      customerInvoiceId: this.customerInvoiceId,
      customerInvoice: this.customerInvoice ? this.customerInvoice.toApi() : null,
      returnDate: Model.formatISODate(this.returnDate),
      status: this.status,
      reason: this.reason,
      notes: this.notes,
      createdByUserId: this.createdByUserId,
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      updatedByUserId: this.updatedByUserId,
      updatedByUser: this.updatedByUser ? this.updatedByUser.toApi() : null,
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
      customerId: this.customerId,
      salesOrderId: this.salesOrderId,
      customerInvoiceId: this.customerInvoiceId,
      warehouseId: this.warehouseId,
      shopId: this.shopId,
      returnDate: this.returnDate,
      status: this.status,
      reason: this.reason,
      notes: this.notes,
    };
    const result = customerReturnSchemaValidation.safeParse(dataToValidate);
    customerReturnValidationInputErrors.length = 0;
    if (!result.success) {
      customerReturnValidationInputErrors.push(
        ...result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`,
        ),
      );
      return false;
    }
    if (this.items) {
      for (const item of this.items) {
        if (!item.isValid()) {
          customerReturnValidationInputErrors.push(
            `Invalid item data (ProdID: ${item.productId}). Errors: ${customerReturnItemValidationInputErrors.join('; ')}`,
          );
          return false;
        }
      }
    } else if (
      this.status !== CustomerReturnStatus.REQUESTED &&
      this.status !== CustomerReturnStatus.CANCELLED
    ) {
      // customerReturnValidationInputErrors.push('Items: An active return should have items.');
      // return false; // Might be too strict depending on workflow
    }
    return true;
  }
}
