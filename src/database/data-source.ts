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
import { CompositeProductItem } from '@/modules/composite-product-items/models/composite-product-item.entity';
import { ProductSupplier } from '@/modules/product-suppliers/models/product-supplier.entity';
import { Quote } from '@/modules/quotes/models/quote.entity';
import { QuoteItem } from '@/modules/quote-items/models/quote-item.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import { PurchaseOrderItem } from '@/modules/purchase-order-items/models/purchase-order-item.entity';
import { PurchaseReception } from '@/modules/purchase-receptions/models/purchase-reception.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-reception-items/models/purchase-reception-item.entity';

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
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReception,
    PurchaseReceptionItem,
  ],
  migrations: [],
  subscribers: [],
};

export const appDataSource = new DataSource(appDataSourceOptions);
