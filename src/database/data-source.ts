import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';

import config from '@/config';
import { User } from '@/modules/users/models/users.entity';
import { Company } from '@/modules/compagnies/models/company.entity';
import { Address } from '@/modules/addresses/models/address.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { ProductCategory } from '@/modules/product-categories/models/product-category.entity';
import { CustomerGroup } from '@/modules/customer-groups/models/customer-group.entity';
import { Supplier } from '@/modules/suppliers/models/supplier.entity';
import { Customer } from '@/modules/customers/models/customer.entity';
import { CustomerShippingAddress } from '@/modules/customers/models/customer-shipping-addresses.entity';
import { PaymentMethod } from '@/modules/payment-methods/models/payment-method.entity';
import { Warehouse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop } from '@/modules/shops/models/shop.entity';
import { BankAccount } from '@/modules/bank-accounts/models/bank-account.entity';
import { CashRegister } from '@/modules/cash-registers/models/cash-register.entity';
import { CashRegisterSession } from '@/modules/cash-register-sessions/models/cash-register-session.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductImage } from '@/modules/product-images/models/product-image.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { ProductSupplier } from '@/modules/product-suppliers/models/product-supplier.entity';
import { Quote } from '@/modules/quotes/models/quote.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import { PurchaseReception } from '@/modules/purchase-receptions/models/purchase-reception.entity';
import { StockMovement } from '@/modules/stock-movements/models/stock-movement.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { Delivery } from '@/modules/deliveries/models/delivery.entity';
import { SupplierInvoice } from '@/modules/supplier-invoices/models/supplier-invoice.entity';
import { SupplierInvoicePurchaseOrderLink } from '@/modules/supplier-invoices/models/supplier-invoice-purchse-order-link.entity';
import { CompositeProductItem } from '@/modules/products/composite-product-items/models/composite-product-item.entity';
import { QuoteItem } from '@/modules/quotes/quote-items/models/quote-item.entity';
import { PurchaseOrderItem } from '@/modules/purchase-orders/purchase-order-items/models/purchase-order-item.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions/purchase-reception-items/models/purchase-reception-item.entity';
import { SalesOrderItem } from '@/modules/sales-orders/sales-order-items/models/sales-order-item.entity';
import { DeliveryItem } from '@/modules/deliveries/delivery-items/models/delivery-item.entity';
import { SupplierInvoiceItem } from '@/modules/supplier-invoices/supplier-invoice-items/models/supplier-invoice-item.entity';
import { CustomerInvoice } from '@/modules/customer-invoices/models/customer-invoice.entity';
import { CustomerInvoiceItem } from '@/modules/customer-invoices/customer-invoice-items/models/customer-invoice-item.entity';
import { CustomerInvoiceSalesOrderLink } from '../modules/customer-invoices/models/customer-invoice-sales-order-link.entity';
import { InventorySession } from '@/modules/inventory-sessions/models/inventory-session.entity';
import { InventorySessionItem } from '@/modules/inventory-sessions/inventory-session-items/models/inventory-session-item.entity';
import { StockTransfer } from '@/modules/stock-transfers/models/stock-transfer.entity';
import { StockTransferItem } from '@/modules/stock-transfers/stock-transfer-items/models/stock-transfer-item.entity';
import { Payment } from '@/modules/payments/models/payment.entity';

export const appDataSourceOptions: DataSourceOptions = {
  type: config.DB_TYPE,
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USERNAME,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  synchronize: false, // Schema is managed by SQL scripts (1-schema.sql) for tests
  logging: ['error'],
  entities: [
    User,
    Company,
    Address,
    Currency,
    ProductCategory,
    CustomerGroup,
    Supplier,
    Customer,
    CustomerShippingAddress,
    PaymentMethod,
    Warehouse,
    Shop,
    BankAccount,
    CashRegister,
    CashRegisterSession,
    Product,
    ProductImage,
    ProductVariant,
    CompositeProductItem,
    ProductSupplier,
    QuoteItem,
    Quote,
    Payment,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReception,
    PurchaseReceptionItem,
    StockMovement,
    SalesOrderItem,
    SalesOrder,
    Delivery,
    DeliveryItem,
    SupplierInvoice,
    SupplierInvoiceItem,
    SupplierInvoicePurchaseOrderLink,
    CustomerInvoice,
    CustomerInvoiceItem,
    CustomerInvoiceSalesOrderLink,
    InventorySession,
    InventorySessionItem,
    StockTransfer,
    StockTransferItem,
  ],
  migrations: [],
  subscribers: [],
};

export const appDataSource = new DataSource(appDataSourceOptions);
