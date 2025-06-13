import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SupplierInvoice } from './supplier-invoice.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';

@Entity({ name: 'supplier_invoice_purchase_order_links' })
export class SupplierInvoicePurchaseOrderLink {
  @PrimaryColumn({ type: 'int', name: 'supplier_invoice_id' })
  supplierInvoiceId!: number;

  @ManyToOne(() => SupplierInvoice, (invoice) => invoice.purchaseOrderLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'supplier_invoice_id' })
  supplierInvoice!: SupplierInvoice;

  @PrimaryColumn({ type: 'int', name: 'purchase_order_id' })
  purchaseOrderId!: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.supplierInvoiceLinks, { onDelete: 'CASCADE' }) // Suppose que PO aura une relation inverse
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;
}
