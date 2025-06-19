import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { Currency } from '../models/currency.entity';
import { appDataSource } from '@/database/data-source';
import { Company } from '@/modules/compagnies';
import { Customer } from '@/modules/customers';
import { Supplier } from '@/modules/suppliers';
import { ProductSupplier } from '@/modules/product-suppliers';
import { PurchaseOrder } from '@/modules/purchase-orders';
import { SupplierInvoice } from '@/modules/supplier-invoices';
import { Quote } from '@/modules/quotes';
import { SalesOrder } from '@/modules/sales-orders';
import { CustomerInvoice } from '@/modules/customer-invoices';
import { Payment } from '@/modules/payments';
import { BankAccount } from '@/modules/bank-accounts';
import { CashRegister } from '@/modules/cash-registers';

interface FindAllCurrenciesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Currency>;
  order?: FindManyOptions<Currency>['order'];
}

export class CurrencyRepository {
  private readonly repository: Repository<Currency>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Currency);
  }

  async findById(id: number): Promise<Currency | null> {
    return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async findByCode(code: string): Promise<Currency | null> {
    return await this.repository.findOne({
      where: { code: code.toUpperCase(), deletedAt: IsNull() },
    });
  }

  async findAll(
    options: FindAllCurrenciesOptions = {},
  ): Promise<{ currencies: Currency[]; count: number }> {
    const where = { ...options.where, deletedAt: IsNull() };
    const [currencies, count] = await this.repository.findAndCount({
      where,
      order: options.order || { code: 'ASC' },
      skip: options.skip,
      take: options.take,
    });
    return { currencies, count };
  }

  create(dto: Partial<Currency>): Currency {
    const currency = this.repository.create(dto);
    if (currency.code) {
      currency.code = currency.code.toUpperCase();
    }
    return currency;
  }

  async save(currency: Currency): Promise<Currency> {
    if (currency.code) {
      currency.code = currency.code.toUpperCase();
    }
    return await this.repository.save(currency);
  }

  async update(id: number, dto: Partial<Currency>): Promise<UpdateResult> {
    if (dto.code) {
      dto.code = dto.code.toUpperCase();
    }
    return await this.repository.update({ id, deletedAt: IsNull() }, dto);
  }

  async softDelete(id: number): Promise<UpdateResult> {
    return await this.repository.softDelete(id);
  }

  async exists(where: FindOptionsWhere<Currency>): Promise<boolean> {
    if (where.code && typeof where.code === 'string') {
      where.code = where.code.toUpperCase();
    }
    return await this.repository.exists({
      where: { ...where, deletedAt: IsNull() },
    });
  }

  async isCurrencyInUse(currencyId: number): Promise<boolean> {
    const manager = this.repository.manager;

    // Check Company
    const companyCount = await manager
      .getRepository(Company)
      .count({ where: { defaultCurrencyId: currencyId, deletedAt: IsNull() } });
    if (companyCount > 0) return true;

    // Check Customers
    const customerCount = await manager
      .getRepository(Customer)
      .count({ where: { defaultCurrencyId: currencyId, deletedAt: IsNull() } });
    if (customerCount > 0) return true;

    // Check Suppliers
    const supplierCount = await manager
      .getRepository(Supplier)
      .count({ where: { defaultCurrencyId: currencyId, deletedAt: IsNull() } });
    if (supplierCount > 0) return true;

    // Check ProductSuppliers
    const productSupplierCount = await manager
      .getRepository(ProductSupplier)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (productSupplierCount > 0) return true;

    // Check PurchaseOrders
    const purchaseOrderCount = await manager
      .getRepository(PurchaseOrder)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (purchaseOrderCount > 0) return true;

    // Check SupplierInvoices
    const supplierInvoiceCount = await manager
      .getRepository(SupplierInvoice)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (supplierInvoiceCount > 0) return true;

    // Check Quotes
    const quoteCount = await manager
      .getRepository(Quote)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (quoteCount > 0) return true;

    // Check SalesOrders
    const salesOrderCount = await manager
      .getRepository(SalesOrder)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (salesOrderCount > 0) return true;

    // Check CustomerInvoices
    const customerInvoiceCount = await manager
      .getRepository(CustomerInvoice)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (customerInvoiceCount > 0) return true;

    // Check Payments
    const paymentCount = await manager
      .getRepository(Payment)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (paymentCount > 0) return true;

    // Check BankAccounts
    const bankAccountCount = await manager
      .getRepository(BankAccount)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (bankAccountCount > 0) return true;

    // Check CashRegisters
    const cashRegisterCount = await manager
      .getRepository(CashRegister)
      .count({ where: { currencyId, deletedAt: IsNull() } });
    if (cashRegisterCount > 0) return true;

    return false;
  }
}
