import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { Address } from '../models/address.entity';
import { appDataSource } from '@/database/data-source';
import { Customer } from '@/modules/customers';
import { Company } from '@/modules/compagnies';
import { Warehouse } from '@/modules/warehouses';
import { Shop } from '@/modules/shops';
import { Quote } from '@/modules/quotes';
import { SalesOrder } from '@/modules/sales-orders';
import { Delivery } from '@/modules/deliveries';
import { CustomerInvoice } from '@/modules/customer-invoices';
import { Supplier } from '@/modules/suppliers';
import { PurchaseOrder } from '@/modules/purchase-orders';

interface FindAllAddressesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Address>;
  order?: FindManyOptions<Address>['order'];
}

export class AddressRepository {
  private readonly repository: Repository<Address>;

  constructor(dataSource: DataSource | EntityManager = appDataSource) {
    this.repository = dataSource.getRepository(Address);
  }

  /**
   * Finds an active address by its ID.
   */
  async findById(id: number): Promise<Address | null> {
    return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
  }

  /**
   * Lists all active addresses with pagination and filtering.
   */
  async findAll(
    options: FindAllAddressesOptions = {},
  ): Promise<{ addresses: Address[]; count: number }> {
    const where = { ...options.where, deletedAt: IsNull() };
    const [addresses, count] = await this.repository.findAndCount({
      where,
      order: options.order ?? { createdAt: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
    return { addresses, count };
  }

  /**
   * Creates a new address instance (without saving).
   */
  create(dto: Partial<Address>): Address {
    return this.repository.create(dto);
  }

  /**
   * Saves an address entity to the database.
   */
  async save(address: Address): Promise<Address> {
    return await this.repository.save(address);
  }

  /**
   * Updates an active address based on criteria.
   */
  async update(id: number, dto: Partial<Address>): Promise<UpdateResult> {
    return await this.repository.update({ id, deletedAt: IsNull() }, dto);
  }

  /**
   * Soft deletes an active address by setting deletedAt.
   */
  async softDelete(id: number): Promise<UpdateResult> {
    return await this.repository.softDelete(id);
  }

  /**
   * Restores a soft-deleted address.
   */
  async restore(id: number): Promise<UpdateResult> {
    return await this.repository.restore(id);
  }

  /**
   * Checks if an active address exists based on the given criteria.
   */
  async exists(where: FindOptionsWhere<Address>): Promise<boolean> {
    return await this.repository.exists({
      where: { ...where, deletedAt: IsNull() },
    });
  }

  async isAddressInUse(addressId: number): Promise<boolean> {
    const manager = this.repository.manager;

    const companyCount = await manager
      .getRepository(Company)
      .count({ where: { addressId, deletedAt: IsNull() } });
    if (companyCount > 0) return true;

    const customerBillingCount = await manager
      .getRepository(Customer)
      .count({ where: { billingAddressId: addressId, deletedAt: IsNull() } });
    if (customerBillingCount > 0) return true;

    const customerDefaultShippingCount = await manager
      .getRepository(Customer)
      .count({ where: { defaultShippingAddressId: addressId, deletedAt: IsNull() } });
    if (customerDefaultShippingCount > 0) return true;

    const warehouseCount = await manager
      .getRepository(Warehouse)
      .count({ where: { addressId, deletedAt: IsNull() } });
    if (warehouseCount > 0) return true;

    const shopCount = await manager
      .getRepository(Shop)
      .count({ where: { addressId, deletedAt: IsNull() } });
    if (shopCount > 0) return true;

    const quoteBillingCount = await manager
      .getRepository(Quote)
      .count({ where: { billingAddressId: addressId, deletedAt: IsNull() } });
    if (quoteBillingCount > 0) return true;

    const quoteShippingCount = await manager
      .getRepository(Quote)
      .count({ where: { shippingAddressId: addressId, deletedAt: IsNull() } });
    if (quoteShippingCount > 0) return true;

    const salesOrderBillingCount = await manager
      .getRepository(SalesOrder)
      .count({ where: { billingAddressId: addressId, deletedAt: IsNull() } });
    if (salesOrderBillingCount > 0) return true;

    const salesOrderShippingCount = await manager
      .getRepository(SalesOrder)
      .count({ where: { shippingAddressId: addressId, deletedAt: IsNull() } });
    if (salesOrderShippingCount > 0) return true;

    const deliveryShippingCount = await manager
      .getRepository(Delivery)
      .count({ where: { shippingAddressId: addressId, deletedAt: IsNull() } });
    if (deliveryShippingCount > 0) return true;

    const customerInvoiceBillingCount = await manager
      .getRepository(CustomerInvoice)
      .count({ where: { billingAddressId: addressId, deletedAt: IsNull() } });
    if (customerInvoiceBillingCount > 0) return true;

    const customerInvoiceShippingCount = await manager
      .getRepository(CustomerInvoice)
      .count({ where: { shippingAddressId: addressId, deletedAt: IsNull() } });
    if (customerInvoiceShippingCount > 0) return true;

    const supplierCount = await manager
      .getRepository(Supplier)
      .count({ where: { addressId, deletedAt: IsNull() } });
    if (supplierCount > 0) return true;

    const purchaseOrderShippingCount = await manager
      .getRepository(PurchaseOrder)
      .count({ where: { shippingAddressId: addressId, deletedAt: IsNull() } });
    if (purchaseOrderShippingCount > 0) return true;

    return false;
  }
}
