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

export const appDataSourceOptions: DataSourceOptions = {
  type: config.DB_TYPE,
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USERNAME,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  synchronize: false,
  logging: ['error'],
  // Use glob pattern to automatically find all entities
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
  ],
  migrations: [],
  subscribers: [],
  // namingStrategy: new SnakeNamingStrategy(), // Si besoin
};

export const appDataSource = new DataSource(appDataSourceOptions);
