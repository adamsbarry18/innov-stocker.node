import { v4 as uuidv4 } from 'uuid';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServerError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere, IsNull, type EntityManager } from 'typeorm';
import { CustomerInvoiceRepository } from '../data/customer-invoice.repository';
import { CustomerRepository } from '@/modules/customers/data/customer.repository';
import { CurrencyRepository } from '@/modules/currencies/data/currency.repository';
import { AddressRepository } from '@/modules/addresses/data/address.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { UserRepository } from '@/modules/users';
import { SalesOrderRepository } from '@/modules/sales-orders/data/sales-order.repository';
import { SalesOrderItemRepository } from '@/modules/sales-orders/sales-order-items/data/sales-order-item.repository';
import { DeliveryItemRepository } from '@/modules/deliveries/delivery-items/data/delivery-item.repository';
import {
  CustomerInvoice,
  CustomerInvoiceStatus,
  customerInvoiceValidationInputErrors,
  type CreateCustomerInvoiceInput,
  type CustomerInvoiceApiResponse,
  type UpdateCustomerInvoiceInput,
} from '../models/customer-invoice.entity';
import { appDataSource } from '@/database/data-source';
import { Customer } from '@/modules/customers/models/customer.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { Address } from '@/modules/addresses/models/address.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { SalesOrderItem } from '@/modules/sales-orders/sales-order-items/models/sales-order-item.entity';
import { DeliveryItem } from '@/modules/deliveries/delivery-items/models/delivery-item.entity';
import { SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import dayjs from 'dayjs';
import {
  CustomerInvoiceItem,
  customerInvoiceItemValidationInputErrors,
  type CreateCustomerInvoiceItemInput,
} from '../customer-invoice-items/models/customer-invoice-item.entity';
import { CustomerInvoiceSalesOrderLink } from '../models/customer-invoice-sales-order-link.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

interface ValidationContext {
  isUpdate: boolean;
  invoiceId?: number;
  transactionalEntityManager?: EntityManager;
}

const FLOAT_TOLERANCE = 0.005;
const UPDATABLE_FIELDS_FOR_PAID_INVOICE = [
  'notes',
  'termsAndConditions',
  'fileAttachmentUrl',
] as const;

let instance: CustomerInvoiceService | null = null;

export class CustomerInvoiceService {
  /**
   * Constructs an instance of CustomerInvoiceService.
   * @param invoiceRepository - Repository for customer invoices.
   * @param linkRepository - Repository for customer invoice sales order links.
   * @param customerRepository - Repository for customers.
   * @param currencyRepository - Repository for currencies.
   * @param addressRepository - Repository for addresses.
   * @param productRepository - Repository for products.
   * @param variantRepository - Repository for product variants.
   * @param userRepository - Repository for users.
   * @param soRepository - Repository for sales orders.
   * @param soItemRepository - Repository for sales order items.
   * @param deliveryRepository - Repository for deliveries.
   * @param deliveryItemRepository - Repository for delivery items.
   */
  constructor(
    private readonly invoiceRepository: CustomerInvoiceRepository = new CustomerInvoiceRepository(),
    private readonly customerRepository: CustomerRepository = new CustomerRepository(),
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository(),
    private readonly addressRepository: AddressRepository = new AddressRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly soRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly soItemRepository: SalesOrderItemRepository = new SalesOrderItemRepository(),
    private readonly deliveryItemRepository: DeliveryItemRepository = new DeliveryItemRepository(),
  ) {}

  // Public API Methods
  /**
   * Creates a new customer invoice.
   * @param input - The data for creating the customer invoice.
   * @param createdByUserId - The ID of the user creating the invoice.
   * @returns The created customer invoice API response.
   */
  async createCustomerInvoice(
    input: CreateCustomerInvoiceInput,
    createdByUserId?: number | null,
  ): Promise<CustomerInvoiceApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        await this.validateInvoiceInput(input, {
          isUpdate: false,
          transactionalEntityManager: manager,
        });
        if (createdByUserId) {
          await this.validateUser(createdByUserId);
        }

        const invoiceHeader = await this.createInvoiceHeader(
          input,
          createdByUserId ?? null,
          manager,
        );
        await this.createInvoiceItems(input.items, invoiceHeader.id, manager);
        await this.updateInvoiceTotals(invoiceHeader, manager);

        if (input.salesOrderIds && input.salesOrderIds.length > 0) {
          await this.createSalesOrderLinks(input.salesOrderIds, invoiceHeader.id, manager);
        }

        const response = await this.getPopulatedInvoiceResponse(invoiceHeader.id, manager);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.CREATE,
          EntityType.FINANCIAL_TRANSACTION,
          invoiceHeader.id.toString(),
          { invoiceNumber: invoiceHeader.invoiceNumber },
        );

        return response;
      } catch (error: any) {
        logger.error(
          `[createCustomerInvoice] Erreur lors de la création de la facture client: ${error.message || JSON.stringify(error)}`,
          { error },
        );
        throw error;
      }
    });
  }

  /**
   * Finds a customer invoice by its ID.
   * @param id - The ID of the customer invoice.
   * @param requestingUserId - The ID of the user requesting the invoice.
   * @returns The customer invoice API response.
   */
  async findCustomerInvoiceById(id: number): Promise<CustomerInvoiceApiResponse> {
    try {
      if (isNaN(id) || id <= 0) {
        throw new BadRequestError(`Invalid customer invoice ID format: ${id}.`);
      }

      const invoice = await this.invoiceRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });

      if (!invoice) {
        throw new NotFoundError(`Customer invoice with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(invoice);
      if (!apiResponse) {
        throw new ServerError(`Failed to map customer invoice ${id}.`);
      }

      return apiResponse;
    } catch (error: any) {
      logger.error('findById', error, { id });
      throw error;
    }
  }

  /**
   * Finds all customer invoices based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of customer invoice API responses and the total count.
   */
  async findAllCustomerInvoices(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CustomerInvoice>;
    sort?: FindManyOptions<CustomerInvoice>['order'];
  }): Promise<{ invoices: CustomerInvoiceApiResponse[]; total: number }> {
    try {
      const { invoices, count } = await this.invoiceRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { invoiceDate: 'DESC', createdAt: 'DESC' },
      });

      const apiInvoices = invoices
        .map((inv) => this.mapToApiResponse(inv))
        .filter(Boolean) as CustomerInvoiceApiResponse[];

      return { invoices: apiInvoices, total: count };
    } catch (error: any) {
      logger.error(`Error finding all customer invoices: ${JSON.stringify(error)}`);
      throw new ServerError('Error finding all customer invoices.');
    }
  }

  /**
   * Updates an existing customer invoice.
   * @param id - The ID of the customer invoice to update.
   * @param input - The data for updating the customer invoice.
   * @param updatedByUserId - The ID of the user updating the invoice.
   * @returns The updated customer invoice API response.
   */
  async updateCustomerInvoice(
    id: number,
    input: UpdateCustomerInvoiceInput,
    updatedByUserId: number,
  ): Promise<CustomerInvoiceApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const invoice = await this.getInvoiceForUpdate(id);
      const sanitizedInput = this.sanitizeUpdateInput(input, invoice.status);

      await this.validateInvoiceInput(sanitizedInput, {
        isUpdate: true,
        invoiceId: id,
        transactionalEntityManager: manager,
      });

      await this.updateInvoiceHeader(id, sanitizedInput, updatedByUserId, manager);

      if (this.canUpdateItems(invoice.status) && sanitizedInput.items) {
        await this.updateInvoiceItems(id, sanitizedInput.items, manager);
      }

      if (this.canUpdateLinks(invoice.status) && sanitizedInput.salesOrderIds) {
        await this.updateSalesOrderLinks(id, sanitizedInput.salesOrderIds, manager);
      }

      await this.recalculateAndUpdateTotals(id, updatedByUserId, manager);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.FINANCIAL_TRANSACTION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return this.getPopulatedInvoiceResponse(id, manager);
    });
  }

  /**
   * Updates the status of a customer invoice.
   * @param id - The ID of the customer invoice to update.
   * @param status - The new status for the invoice.
   * @param updatedByUserId - The ID of the user updating the status.
   * @returns The updated customer invoice API response.
   */
  async updateCustomerInvoiceStatus(
    id: number,
    status: CustomerInvoiceStatus,
    updatedByUserId: number,
  ): Promise<CustomerInvoiceApiResponse> {
    const invoice = await this.getExistingInvoice(id);

    this.validateStatusTransition(invoice, status);
    await this.validatePaidStatusTransition(invoice, status);

    await this.invoiceRepository.update(id, { status, updatedByUserId });

    return this.getPopulatedInvoiceResponse(id);
  }

  /**
   * Deletes a customer invoice (soft delete).
   * @param id - The ID of the customer invoice to delete.
   */
  async deleteCustomerInvoice(id: number): Promise<void> {
    try {
      const invoice = await this.getExistingInvoice(id);

      this.validateDeletion(invoice);
      await this.validateNoPendingPayments(id);

      await this.invoiceRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.FINANCIAL_TRANSACTION,
        id.toString(),
      );
    } catch (error: any) {
      logger.error(
        `[deleteCustomerInvoice] Error deleting customer invoice: ${JSON.stringify(error)}`,
        { id },
      );
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error deleting customer invoice ${id}.`);
    }
  }

  /**
   * Validates the input data for creating or updating a customer invoice.
   * @param input - The input data for the invoice.
   * @param context - The validation context, including whether it's an update and the invoice ID.
   */
  private async validateInvoiceInput(
    input: CreateCustomerInvoiceInput | UpdateCustomerInvoiceInput,
    context: ValidationContext,
  ): Promise<void> {
    const { isUpdate, invoiceId, transactionalEntityManager } = context;

    const customerId = 'customerId' in input ? input.customerId : undefined;

    if ('customerId' in input) {
      await this.validateCustomer(customerId, isUpdate, transactionalEntityManager);
    } else if (!isUpdate) {
      throw new BadRequestError('Customer ID is required for creating an invoice.');
    }

    if ('currencyId' in input) {
      await this.validateCurrency(input.currencyId, isUpdate, transactionalEntityManager);
    } else if (!isUpdate) {
      throw new BadRequestError('Currency ID is required for creating an invoice.');
    }

    if ('billingAddressId' in input) {
      await this.validateAddress(
        input.billingAddressId ?? undefined,
        true,
        'billing',
        transactionalEntityManager,
      );
    } else if (!isUpdate) {
      throw new BadRequestError('Billing address ID is required.');
    }

    if ('shippingAddressId' in input) {
      await this.validateAddress(
        input.shippingAddressId ?? undefined,
        false,
        'shipping',
        transactionalEntityManager,
      );
    }

    await this.validateInvoiceNumber(input, isUpdate, invoiceId);

    if ('items' in input && input.items) {
      await this.validateItems(input.items, isUpdate, transactionalEntityManager);
    }

    if ('salesOrderIds' in input && input.salesOrderIds) {
      await this.validateSalesOrders(input.salesOrderIds, customerId, transactionalEntityManager);
    }
  }

  /**
   * Validates the customer ID.
   * @param customerId - The ID of the customer.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCustomer(
    customerId: number | undefined,
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    if (customerId) {
      let customer;
      if (manager) {
        const repo = manager.getRepository(Customer);
        customer = await repo.findOneBy({ id: customerId, deletedAt: IsNull() });
      } else {
        customer = await this.customerRepository.findById(customerId);
      }
      if (!customer) {
        throw new BadRequestError(`Customer with ID ${customerId} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Customer ID is required for creating an invoice.');
    }
  }

  /**
   * Validates the currency ID.
   * @param currencyId - The ID of the currency.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCurrency(
    currencyId: number | undefined,
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    if (currencyId) {
      let currency;
      if (manager) {
        const repo = manager.getRepository(Currency);
        currency = await repo.findOneBy({ id: currencyId, isActive: true, deletedAt: IsNull() });
      } else {
        currency = await this.currencyRepository.findById(currencyId);
        if (currency && !currency.isActive) {
          currency = null;
        }
      }
      if (!currency) {
        throw new BadRequestError(`Active currency with ID ${currencyId} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Currency ID is required for creating an invoice.');
    }
  }

  /**
   * Validates an address ID.
   * @param addressId - The ID of the address.
   * @param isRequired - Indicates if the address is required.
   * @param type - The type of address ('billing' or 'shipping').
   * @param manager - The entity manager for transactional operations.
   */
  private async validateAddress(
    addressId: number | undefined,
    isRequired: boolean,
    type: 'billing' | 'shipping',
    manager?: EntityManager,
  ): Promise<void> {
    if (addressId) {
      let address;
      if (manager) {
        const repo = manager.getRepository(Address);
        address = await repo.findOneBy({ id: addressId, deletedAt: IsNull() });
      } else {
        address = await this.addressRepository.findById(addressId);
      }
      if (!address) {
        throw new BadRequestError(
          `${type === 'billing' ? 'Billing' : 'Shipping'} address with ID ${addressId} not found.`,
        );
      }
    } else if (isRequired) {
      throw new BadRequestError(
        `${type === 'billing' ? 'Billing' : 'Shipping'} address ID is required.`,
      );
    }
  }

  /**
   * Validates the invoice number.
   * @param input - The input data for the invoice.
   * @param isUpdate - Indicates if the operation is an update.
   * @param invoiceId - The ID of the invoice (if updating).
   */
  private async validateInvoiceNumber(
    input: CreateCustomerInvoiceInput | UpdateCustomerInvoiceInput,
    isUpdate: boolean,
    invoiceId?: number,
  ): Promise<void> {
    if (!isUpdate && !input.invoiceNumber) {
      return;
    }

    if (input.invoiceNumber && 'customerId' in input && input.customerId !== undefined) {
      const existing = await this.invoiceRepository.findByInvoiceNumberAndCustomer(
        input.invoiceNumber,
        input.customerId,
      );

      if (existing && (!isUpdate || existing.id !== invoiceId)) {
        throw new BadRequestError(
          `Invoice number '${input.invoiceNumber}' already exists for customer ID ${input.customerId}.`,
        );
      }
    }
  }

  /**
   * Validates a list of invoice items.
   * @param items - The array of invoice items to validate.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateItems(
    items: any[],
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    for (const item of items) {
      if (item.deletedAt && isUpdate) {
        continue;
      }
      await this.validateSingleItem(item, manager);
    }
  }

  /**
   * Validates a single invoice item.
   * @param item - The invoice item to validate.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSingleItem(item: any, manager?: EntityManager): Promise<void> {
    if (item.productId) {
      await this.validateItemProduct(item, manager);
    } else if (!item.description && !item.id) {
      throw new BadRequestError('Item description is required if no product is specified.');
    }

    if (item.salesOrderItemId) {
      await this.validateSalesOrderItem(item.salesOrderItemId, manager);
    }

    if (item.deliveryItemId) {
      await this.validateDeliveryItem(item.deliveryItemId, manager);
    }

    if (item.quantity <= 0) {
      throw new BadRequestError('Item quantity must be positive.');
    }

    if (item.unitPriceHt < 0) {
      throw new BadRequestError('Item unit price cannot be negative.');
    }
  }

  /**
   * Validates the product and product variant for an invoice item.
   * @param item - The invoice item containing product information.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateItemProduct(item: any, manager?: EntityManager): Promise<void> {
    let product;
    if (manager) {
      const repo = manager.getRepository(Product);
      product = await repo.findOneBy({ id: item.productId, deletedAt: IsNull() });
    } else {
      product = await this.productRepository.findById(item.productId);
    }

    if (!product) {
      throw new BadRequestError(`Product ID ${item.productId} not found for an item.`);
    }

    if (item.productVariantId) {
      let variant;
      if (manager) {
        const repo = manager.getRepository(ProductVariant);
        variant = await repo.findOneBy({
          id: item.productVariantId,
          productId: item.productId,
          deletedAt: IsNull(),
        });
      } else {
        variant = await this.variantRepository.findById(item.productVariantId);
        if (variant && variant.productId !== item.productId) {
          variant = null;
        }
      }

      if (!variant) {
        throw new BadRequestError(
          `Variant ID ${item.productVariantId} not valid for product ${item.productId}.`,
        );
      }
    }
  }

  /**
   * Validates a sales order item ID.
   * @param salesOrderItemId - The ID of the sales order item.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSalesOrderItem(
    salesOrderItemId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let item;
    if (manager) {
      const repo = manager.getRepository(SalesOrderItem);
      item = await repo.findOneBy({ id: salesOrderItemId });
    } else {
      item = await this.soItemRepository.findById(salesOrderItemId);
    }

    if (!item) {
      throw new BadRequestError(`Sales Order Item ID ${salesOrderItemId} not found.`);
    }
  }

  /**
   * Validates a delivery item ID.
   * @param deliveryItemId - The ID of the delivery item.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateDeliveryItem(
    deliveryItemId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let item;
    if (manager) {
      const repo = manager.getRepository(DeliveryItem);
      item = await repo.findOneBy({ id: deliveryItemId });
    } else {
      item = await this.deliveryItemRepository.findById(deliveryItemId);
    }

    if (!item) {
      throw new BadRequestError(`Delivery Item ID ${deliveryItemId} not found.`);
    }
  }

  /**
   * Validates a list of sales order IDs.
   * @param salesOrderIds - An array of sales order IDs.
   * @param customerId - The ID of the customer associated with the sales orders.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSalesOrders(
    salesOrderIds: number[],
    customerId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    for (const soId of salesOrderIds) {
      let so;
      if (manager) {
        const repo = manager.getRepository(SalesOrder);
        so = await repo.findOneBy({ id: soId, deletedAt: IsNull() });
      } else {
        so = await this.soRepository.findById(soId);
      }

      if (!so) {
        throw new BadRequestError(`Sales Order ID ${soId} not found.`);
      }

      if (customerId && so.customerId !== customerId) {
        throw new BadRequestError(
          `Sales Order ID ${soId} does not belong to customer ID ${customerId}.`,
        );
      }
    }
  }

  /**
   * Validates a user ID.
   * @param userId - The ID of the user.
   */
  private async validateUser(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestError(`User ID ${userId} not found.`);
    }
  }

  /**
   * Creates the header for a new customer invoice.
   * @param input - The input data for the invoice.
   * @param createdByUserId - The ID of the user creating the invoice.
   * @param manager - The entity manager for transactional operations.
   * @returns The created CustomerInvoice entity.
   */
  private async createInvoiceHeader(
    input: CreateCustomerInvoiceInput,
    createdByUserId: number | null,
    manager: EntityManager,
  ): Promise<CustomerInvoice> {
    const repo = manager.getRepository(CustomerInvoice);

    const { items, salesOrderIds, ...headerInput } = input;
    const invoiceData: Partial<CustomerInvoice> = {
      ...headerInput,
      invoiceNumber: input.invoiceNumber ?? this.generateInvoiceNumber(),
      invoiceDate: dayjs(input.invoiceDate).toDate(),
      dueDate: input.dueDate ? dayjs(input.dueDate).toDate() : null,
      status: input.status ?? CustomerInvoiceStatus.DRAFT,
      amountPaid: 0,
      createdByUserId,
      updatedByUserId: createdByUserId,
    };

    const invoice = repo.create(invoiceData);
    this.validateInvoiceEntity(invoice);

    const savedInvoice = await repo.save(invoice);
    return savedInvoice;
  }

  /**
   * Creates items for a customer invoice.
   * @param itemInputs - An array of input data for invoice items.
   * @param invoiceId - The ID of the customer invoice.
   * @param manager - The entity manager for transactional operations.
   * @returns An array of created CustomerInvoiceItem entities.
   */
  private async createInvoiceItems(
    itemInputs: CreateCustomerInvoiceItemInput[],
    invoiceId: number,
    manager: EntityManager,
  ): Promise<CustomerInvoiceItem[]> {
    const repo = manager.getRepository(CustomerInvoiceItem);
    const items: CustomerInvoiceItem[] = [];

    if (!itemInputs || itemInputs.length === 0) {
      return [];
    }

    for (const itemInput of itemInputs) {
      const item = repo.create({
        ...itemInput,
        customerInvoiceId: invoiceId,
        totalLineAmountHt: this.calculateLineTotal(
          itemInput.quantity,
          itemInput.unitPriceHt,
          itemInput.discountPercentage,
        ),
      });

      if (!item.isValid()) {
        logger.error(
          `[createInvoiceItems] Validation échouée pour l'élément de facture (Product ID: ${itemInput.productId || 'N/A'}). Erreurs: ${customerInvoiceItemValidationInputErrors.join('; ')}`,
        );
        throw new BadRequestError(
          `Invalid data for invoice item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${customerInvoiceItemValidationInputErrors.join('; ')}`,
        );
      }

      items.push(item);
    }

    const savedItems = await repo.save(items);
    return savedItems;
  }

  /**
   * Updates the total amounts for a customer invoice.
   * @param invoice - The CustomerInvoice entity to update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceTotals(
    invoice: CustomerInvoice,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerInvoice);
    invoice.calculateTotals();
    await repo.save(invoice);
  }

  /**
   * Creates links between a customer invoice and sales orders.
   * @param salesOrderIds - An array of sales order IDs to link.
   * @param invoiceId - The ID of the customer invoice.
   * @param manager - The entity manager for transactional operations.
   */
  private async createSalesOrderLinks(
    salesOrderIds: number[] | undefined,
    invoiceId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!salesOrderIds?.length) {
      return;
    }

    const repo = manager.getRepository(CustomerInvoiceSalesOrderLink);
    const links = salesOrderIds.map((soId) =>
      repo.create({ customerInvoiceId: invoiceId, salesOrderId: soId }),
    );

    await repo.save(links);
  }

  /**
   * Sanitizes the update input based on the invoice status.
   * Restricts fields that can be updated if the invoice is paid or cancelled.
   * @param input - The update input data.
   * @param status - The current status of the invoice.
   * @returns The sanitized update input.
   */
  private sanitizeUpdateInput(
    input: UpdateCustomerInvoiceInput,
    status: CustomerInvoiceStatus,
  ): UpdateCustomerInvoiceInput {
    if (this.isInvoicePaidOrCancelled(status)) {
      return this.restrictUpdateFieldsForPaidInvoice(input);
    }
    return input;
  }

  /**
   * Checks if the invoice status is paid, cancelled, or voided.
   * @param status - The status of the invoice.
   * @returns True if the invoice is paid, cancelled, or voided, false otherwise.
   */
  private isInvoicePaidOrCancelled(status: CustomerInvoiceStatus): boolean {
    return (
      status === CustomerInvoiceStatus.PAID ||
      status === CustomerInvoiceStatus.CANCELLED ||
      status === CustomerInvoiceStatus.VOIDED
    );
  }

  /**
   * Restricts the fields that can be updated for a paid, cancelled, or voided invoice.
   * @param input - The update input data.
   * @returns The restricted update input.
   */
  private restrictUpdateFieldsForPaidInvoice(
    input: UpdateCustomerInvoiceInput,
  ): UpdateCustomerInvoiceInput {
    const allowedFields = UPDATABLE_FIELDS_FOR_PAID_INVOICE;
    const restrictedInput: Partial<UpdateCustomerInvoiceInput> = {};

    allowedFields.forEach((field) => {
      if (input.hasOwnProperty(field)) {
        (restrictedInput as any)[field] = (input as any)[field];
      }
    });

    const hasDisallowedFields = Object.keys(input).some(
      (key) =>
        ![...allowedFields, 'status', 'items', 'salesOrderIds'].includes(key as any) &&
        input.hasOwnProperty(key),
    );

    if (hasDisallowedFields) {
      throw new ForbiddenError(
        `Cannot update most fields of a customer invoice in status 'PAID', 'CANCELLED', or 'VOIDED'.`,
      );
    }

    return restrictedInput;
  }

  /**
   * Checks if invoice items can be updated based on the invoice status.
   * @param status - The current status of the invoice.
   * @returns True if items can be updated, false otherwise.
   */
  private canUpdateItems(status: CustomerInvoiceStatus): boolean {
    return status === CustomerInvoiceStatus.DRAFT;
  }

  /**
   * Checks if sales order links can be updated based on the invoice status.
   * @param status - The current status of the invoice.
   * @returns True if links can be updated, false otherwise.
   */
  private canUpdateLinks(status: CustomerInvoiceStatus): boolean {
    return status === CustomerInvoiceStatus.DRAFT;
  }

  /**
   * Validates a status transition for a customer invoice.
   * @param invoice - The current customer invoice.
   * @param newStatus - The new status to transition to.
   */
  private validateStatusTransition(
    invoice: CustomerInvoice,
    newStatus: CustomerInvoiceStatus,
  ): void {
    if (!Object.values(CustomerInvoiceStatus).includes(newStatus)) {
      throw new BadRequestError(`Invalid status: '${newStatus}'.`);
    }

    const restrictedStatuses = [
      CustomerInvoiceStatus.PAID,
      CustomerInvoiceStatus.VOIDED,
      CustomerInvoiceStatus.CANCELLED,
    ];

    if (restrictedStatuses.includes(invoice.status) && newStatus !== invoice.status) {
      throw new ForbiddenError(
        `Cannot change status of a ${invoice.status} invoice (ID: ${invoice.id}).`,
      );
    }

    if (
      newStatus === CustomerInvoiceStatus.SENT &&
      invoice.status !== CustomerInvoiceStatus.DRAFT
    ) {
      throw new BadRequestError(
        `Invoice must be in DRAFT status to be marked as SENT. Current: ${invoice.status}`,
      );
    }
  }

  /**
   * Validates the transition to 'PAID' status, checking if the amount paid matches the total.
   * @param invoice - The customer invoice.
   * @param newStatus - The new status to transition to.
   */
  private async validatePaidStatusTransition(
    invoice: CustomerInvoice,
    newStatus: CustomerInvoiceStatus,
  ): Promise<void> {
    if (newStatus !== CustomerInvoiceStatus.PAID) return;

    const amountPaid = await this.invoiceRepository.getAmountPaidForInvoice(invoice.id);
    const totalAmount = Number(invoice.totalAmountTtc);

    if (Math.abs(totalAmount - amountPaid) > FLOAT_TOLERANCE) {
      logger.warn(
        `Invoice ${invoice.id} marked as PAID, but amountPaid (${amountPaid}) differs from totalTtc (${totalAmount}).`,
      );
    }
  }

  /**
   * Validates if a customer invoice can be deleted.
   * @param invoice - The customer invoice to validate.
   */
  private validateDeletion(invoice: CustomerInvoice): void {
    const deletableStatuses = [CustomerInvoiceStatus.DRAFT, CustomerInvoiceStatus.CANCELLED];

    if (!deletableStatuses.includes(invoice.status)) {
      throw new BadRequestError(
        `Customer invoice in status '${invoice.status}' cannot be deleted. Consider voiding it instead.`,
      );
    }
  }

  /**
   * Validates that there are no pending payments for an invoice before deletion.
   * @param invoiceId - The ID of the invoice to validate.
   */
  private async validateNoPendingPayments(invoiceId: number): Promise<void> {
    const amountPaid = await this.invoiceRepository.getAmountPaidForInvoice(invoiceId);
    if (amountPaid > 0) {
      throw new BadRequestError(
        `Cannot delete invoice ${invoiceId} as payments have been recorded.`,
      );
    }
  }

  /**
   * Generates a unique invoice number.
   * @returns A promise that resolves to a unique invoice number string.
   */
  private generateInvoiceNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `INV-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Calculates the total amount for a single line item.
   * @param quantity - The quantity of the item.
   * @param unitPrice - The unit price of the item (HT).
   * @param discountPercentage - The discount percentage (default is 0).
   * @returns The total line amount (HT).
   */
  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discountPercentage: number = 0,
  ): number {
    const subtotal = Number(quantity) * Number(unitPrice);
    const discount = subtotal * (Number(discountPercentage) / 100);
    return parseFloat((subtotal - discount).toFixed(4));
  }

  /**
   * Validates the integrity of a CustomerInvoice entity.
   * @param invoice - The CustomerInvoice entity to validate.
   */
  private validateInvoiceEntity(invoice: CustomerInvoice): void {
    if (!invoice.isValid()) {
      throw new BadRequestError(
        `Customer invoice data invalid: ${customerInvoiceValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Maps a CustomerInvoice entity to a CustomerInvoiceApiResponse.
   * @param invoice - The CustomerInvoice entity.
   * @returns The mapped CustomerInvoiceApiResponse or null if the input invoice is null.
   */
  private mapToApiResponse(invoice: CustomerInvoice | null): CustomerInvoiceApiResponse | null {
    if (!invoice) {
      return null;
    }
    return invoice.toApi();
  }

  /**
   * Returns an array of relations to be loaded with a customer invoice for detailed responses.
   * @returns An array of relation strings.
   */
  private getDetailedRelations(): string[] {
    return [
      'customer',
      'currency',
      'billingAddress',
      'shippingAddress',
      'items',
      'items.product',
      'items.productVariant',
      'items.salesOrderItem',
      'items.deliveryItem',
      'salesOrderLinks',
      'salesOrderLinks.salesOrder',
      'createdByUser',
      'updatedByUser',
    ];
  }

  /**
   * Retrieves an existing customer invoice by ID.
   * @param id - The ID of the customer invoice.
   * @returns The CustomerInvoice entity.
   */
  private async getExistingInvoice(id: number): Promise<CustomerInvoice> {
    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError(`Customer invoice with id ${id} not found.`);
    }
    return invoice;
  }

  /**
   * Retrieves a customer invoice for update operations, including its items and sales order links.
   * @param id - The ID of the customer invoice.
   * @returns The CustomerInvoice entity with relations.
   */
  private async getInvoiceForUpdate(id: number): Promise<CustomerInvoice> {
    const invoice = await this.invoiceRepository.findById(id, {
      relations: ['items', 'salesOrderLinks'],
    });
    if (!invoice) {
      throw new NotFoundError(`Customer invoice with ID ${id} not found.`);
    }
    return invoice;
  }

  /**
   * Retrieves a populated customer invoice response, including all detailed relations.
   * @param id - The ID of the customer invoice.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CustomerInvoiceApiResponse.
   */
  private async getPopulatedInvoiceResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<CustomerInvoiceApiResponse> {
    let invoice;
    if (manager) {
      const repo = manager.getRepository(CustomerInvoice);
      invoice = await repo.findOne({
        where: { id },
        relations: this.getDetailedRelations(),
      });
    } else {
      invoice = await this.invoiceRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
    }

    const apiResponse = this.mapToApiResponse(invoice);
    if (!apiResponse) {
      logger.error(
        `[getPopulatedInvoiceResponse] mapToApiResponse returned null for invoice ID ${id}.`,
      );
      throw new ServerError(`Failed to map customer invoice to API response: invoice is null.`);
    }
    return apiResponse;
  }

  /**
   * Updates the header information of a customer invoice.
   * @param id - The ID of the customer invoice to update.
   * @param input - The update input data.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceHeader(
    id: number,
    input: UpdateCustomerInvoiceInput,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerInvoice);
    const { ...headerInput } = input;

    const updateData = {
      ...headerInput,
      updatedByUserId: userId,
      ...(input.invoiceDate && { invoiceDate: dayjs(input.invoiceDate).toDate() }),
      ...(input.hasOwnProperty('dueDate') && {
        dueDate: input.dueDate ? dayjs(input.dueDate).toDate() : null,
      }),
    };

    await repo.update(id, updateData);
  }

  /**
   * Updates the items associated with a customer invoice.
   * This method deletes existing items and recreates them based on the provided input.
   * @param invoiceId - The ID of the customer invoice.
   * @param items - An array of invoice item data.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceItems(
    invoiceId: number,
    items: any[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerInvoiceItem);

    await repo.delete({ customerInvoiceId: invoiceId });
    const newItems: CustomerInvoiceItem[] = [];
    for (const itemInput of items.filter((item) => !item._delete)) {
      const item: any = repo.create({
        ...itemInput,
        customerInvoiceId: invoiceId,
        totalLineAmountHt: this.calculateLineTotal(
          itemInput.quantity,
          itemInput.unitPriceHt,
          itemInput.discountPercentage,
        ),
      });
      newItems.push(item);
    }

    if (newItems.length > 0) {
      await repo.save(newItems);
    }
  }

  /**
   * Updates the sales order links associated with a customer invoice.
   * This method deletes existing links and recreates them based on the provided input.
   * @param invoiceId - The ID of the customer invoice.
   * @param salesOrderIds - An array of sales order IDs to link.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateSalesOrderLinks(
    invoiceId: number,
    salesOrderIds: number[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerInvoiceSalesOrderLink);

    await repo.delete({ customerInvoiceId: invoiceId });
    if (salesOrderIds.length > 0) {
      const links = salesOrderIds.map((soId) =>
        repo.create({ customerInvoiceId: invoiceId, salesOrderId: soId }),
      );
      await repo.save(links);
    }
  }

  /**
   * Recalculates and updates the total amounts for a customer invoice.
   * @param invoiceId - The ID of the customer invoice.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async recalculateAndUpdateTotals(
    invoiceId: number,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerInvoice);
    const invoice = await repo.findOne({
      where: { id: invoiceId },
      relations: ['items'],
    });

    if (!invoice) {
      logger.error(`[recalculateAndUpdateTotals] Invoice not found for invoiceId=${invoiceId}`);
      throw new ServerError('Failed to re-fetch invoice for total calculation.');
    }

    invoice.calculateTotals();
    invoice.updatedByUserId = userId;
    await repo.save(invoice);
  }

  /**
   * Sends an invoice reminder. This is a stub method.
   * @param invoiceId - The ID of the invoice to send a reminder for.
   * @param sentByUserId - The ID of the user sending the reminder.
   */
  async sendInvoiceReminder(invoiceId: number): Promise<void> {
    logger.warn(`sendInvoiceReminder for CI ${invoiceId} is a STUB.`);
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found for sending reminder.');
    if (
      invoice.status !== CustomerInvoiceStatus.SENT &&
      invoice.status !== CustomerInvoiceStatus.PARTIALLY_PAID &&
      invoice.status !== CustomerInvoiceStatus.OVERDUE
    ) {
      throw new BadRequestError(`Cannot send reminder for invoice in status '${invoice.status}'.`);
    }
    logger.info(`Reminder for invoice ${invoice.invoiceNumber} would be sent here.`);
  }

  /**
   * Returns a singleton instance of CustomerInvoiceService.
   * @returns The singleton instance of CustomerInvoiceService.
   */
  static getInstance(): CustomerInvoiceService {
    instance ??= new CustomerInvoiceService();

    return instance;
  }

  /**
   * Updates the status and paid amount of an invoice.
   * Designed to be called by PaymentService within a transaction.
   * @param invoiceId The ID of the invoice to update.
   * @param paymentAmount The amount of the payment to apply (negative for a reversal).
   * @param updatedByUserId The ID of the user performing the action.
   * @param manager The EntityManager of the current transaction.
   */
  async updatePaymentStatus(
    invoiceId: number,
    paymentAmount: number,
    updatedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const invoice = await this.invoiceRepository.findById(invoiceId, {
      transactionalEntityManager: manager,
    });

    if (!invoice) {
      logger.warn(
        `Customer Invoice ID ${invoiceId} not found during payment application. Payment recorded, but invoice status not updated.`,
      );
      return;
    }

    invoice.amountPaid = parseFloat(
      (Number(invoice.amountPaid) + Number(paymentAmount)).toFixed(4),
    );

    const balanceDue = Number(invoice.totalAmountTtc) - invoice.amountPaid;
    if (balanceDue <= FLOAT_TOLERANCE) {
      invoice.status = CustomerInvoiceStatus.PAID;
      invoice.amountPaid = Number(invoice.totalAmountTtc);
    } else if (invoice.amountPaid > 0) {
      invoice.status = CustomerInvoiceStatus.PARTIALLY_PAID;
    } else {
      invoice.status = CustomerInvoiceStatus.SENT;
      invoice.amountPaid = 0;
    }

    invoice.updatedByUserId = updatedByUserId;
    await this.invoiceRepository.save(invoice, manager);
    logger.info(
      `Payment status updated for Customer Invoice ${invoice.invoiceNumber}. New status: ${invoice.status}, Amount paid: ${invoice.amountPaid}.`,
    );
  }
}
