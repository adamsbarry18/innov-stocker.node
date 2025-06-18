import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';

import config from '@/config';
import { User } from '@/modules/users';
import { Company } from '@/modules/compagnies';
import { Address } from '@/modules/addresses';
import { Currency } from '@/modules/currencies';
import { ProductCategory } from '@/modules/product-categories';
import { CustomerGroup } from '@/modules/customer-groups';
import { Supplier } from '@/modules/suppliers';
import { Customer, CustomerShippingAddress } from '@/modules/customers';
import { PaymentMethod } from '@/modules/payment-methods';
import { Warehouse } from '@/modules/warehouses';
import { Product, CompositeProductItem } from '@/modules/products';
import { Quote, QuoteItem } from '@/modules/quotes';
import { PurchaseOrder, PurchaseOrderItem } from '@/modules/purchase-orders';
import { PurchaseReception, PurchaseReceptionItem } from '@/modules/purchase-receptions';
import { StockMovement } from '@/modules/stock-movements';
import { SalesOrder, SalesOrderItem } from '@/modules/sales-orders';
import { Delivery, DeliveryItem } from '@/modules/deliveries';
import {
  SupplierInvoice,
  SupplierInvoiceItem,
  SupplierInvoicePurchaseOrderLink,
} from '@/modules/supplier-invoices';
import {
  CustomerInvoice,
  CustomerInvoiceItem,
  CustomerInvoiceSalesOrderLink,
} from '@/modules/customer-invoices';
import { CustomerReturn, CustomerReturnItem } from '@/modules/customer-returns';
import { InventorySession, InventorySessionItem } from '@/modules/inventory-sessions';
import { StockTransfer, StockTransferItem } from '@/modules/stock-transfers';
import { Payment } from '@/modules/payments';
import { CashRegisterTransaction } from '@/modules/cash-register-transactions';
import { SupplierReturn, SupplierReturnItem } from '@/modules/supplier-returns';
import { UserActivityLog } from '@/modules/user-activity-logs';
import { Notification } from '@/modules/notifications';
import { Shop } from '@/modules/shops';
import { BankAccount } from '@/modules/bank-accounts';
import { CashRegister } from '@/modules/cash-registers';
import { CashRegisterSession } from '@/modules/cash-register-sessions';
import { ProductImage } from '@/modules/product-images';
import { ProductVariant } from '@/modules/product-variants';
import { ProductSupplier } from '@/modules/product-suppliers';
import { ImportBatch } from '@/modules/imports/models/import.entity';

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
    CustomerReturn,
    CustomerReturnItem,
    InventorySession,
    InventorySessionItem,
    StockTransfer,
    StockTransferItem,
    CashRegisterTransaction,
    SupplierReturn,
    SupplierReturnItem,
    UserActivityLog,
    Notification,
    ImportBatch,
  ],
  migrations: [],
  subscribers: [],
};

export const appDataSource = new DataSource(appDataSourceOptions);
