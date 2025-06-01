import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CustomerInvoice } from './customer-invoice.entity';

@Entity({ name: 'customer_invoice_sales_order_links' })
export class CustomerInvoiceSalesOrderLink {
  @PrimaryColumn({ type: 'int', name: 'customer_invoice_id' })
  customerInvoiceId!: number;

  @ManyToOne(() => CustomerInvoice, (invoice) => invoice.salesOrderLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_invoice_id' })
  customerInvoice!: CustomerInvoice;

  @PrimaryColumn({ type: 'int', name: 'sales_order_id' })
  salesOrderId!: number;

  @ManyToOne(() => SalesOrder, (so) => so.customerInvoiceLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder!: SalesOrder;
}
