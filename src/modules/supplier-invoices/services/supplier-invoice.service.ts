import { appDataSource } from '@/database/data-source';
import { IsNull, type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';
import {
  SupplierInvoice,
  type CreateSupplierInvoiceInput,
  type UpdateSupplierInvoiceInput,
  type SupplierInvoiceApiResponse,
  SupplierInvoiceStatus,
  supplierInvoiceValidationInputErrors,
} from '../models/supplier-invoice.entity';
import { SupplierInvoicePurchaseOrderLink } from '../models/supplier-invoice-purchse-order-link.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';

// Repositories
import { SupplierInvoiceRepository } from '../data/supplier-invoice.repository';
import { SupplierInvoicePurchaseOrderLinkRepository } from '../data/supplier-invoice-purchase-order-link.repo';
import { SupplierRepository } from '@/modules/suppliers/data/supplier.repository';
import { CurrencyRepository } from '@/modules/currencies/data/currency.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { UserRepository } from '@/modules/users';
import { PurchaseOrderRepository } from '@/modules/purchase-orders/data/purchase-order.repository';

// Entities for transactional access
import { Supplier } from '@/modules/suppliers/models/supplier.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import { SupplierInvoiceItemRepository } from '../supplier-invoice-items/data/supplier-invoice-item.repository';
import { PurchaseReceptionItemRepository } from '@/modules/purchase-receptions/purchase-reception-items/data/purchase-reception-item.repository';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions/purchase-reception-items/models/purchase-reception-item.entity';
import {
  type CreateSupplierInvoiceItemInput,
  SupplierInvoiceItem,
} from '../supplier-invoice-items/models/supplier-invoice-item.entity';

interface ValidationContext {
  isUpdate: boolean;
  invoiceId?: number;
  transactionalEntityManager?: EntityManager;
}

const FLOAT_TOLERANCE = 0.001;
const UPDATABLE_FIELDS_FOR_PAID_INVOICE = ['notes', 'fileAttachmentUrl'] as const;

let instance: SupplierInvoiceService | null = null;

export class SupplierInvoiceService {
  /**
   * Constructs an instance of SupplierInvoiceService.
   * @param invoiceRepository - Repository for supplier invoices.
   * @param itemRepository - Repository for supplier invoice items.
   * @param linkRepository - Repository for supplier invoice purchase order links.
   * @param supplierRepository - Repository for suppliers.
   * @param currencyRepository - Repository for currencies.
   * @param productRepository - Repository for products.
   * @param variantRepository - Repository for product variants.
   * @param userRepository - Repository for users.
   * @param poRepository - Repository for purchase orders.
   * @param receptionItemRepository - Repository for purchase reception items.
   */
  constructor(
    private readonly invoiceRepository: SupplierInvoiceRepository = new SupplierInvoiceRepository(),
    private readonly itemRepository: SupplierInvoiceItemRepository = new SupplierInvoiceItemRepository(),
    private readonly linkRepository: SupplierInvoicePurchaseOrderLinkRepository = new SupplierInvoicePurchaseOrderLinkRepository(),
    private readonly supplierRepository: SupplierRepository = new SupplierRepository(),
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly poRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
  ) {}

  // Public API Methods
  /**
   * Creates a new supplier invoice.
   * @param input - The data for creating the supplier invoice.
   * @param createdByUserId - The ID of the user creating the invoice.
   * @returns The created supplier invoice API response.
   */
  async createSupplierInvoice(
    input: CreateSupplierInvoiceInput,
    createdByUserId: number,
  ): Promise<SupplierInvoiceApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        await this.validateInvoiceInput(input, {
          isUpdate: false,
          transactionalEntityManager: manager,
        });
        await this.validateUser(createdByUserId);

        const invoiceHeader = await this.createInvoiceHeader(input, createdByUserId, manager);
        await this.createInvoiceItems(input.items, invoiceHeader.id, manager);
        await this.updateInvoiceTotals(invoiceHeader, manager);
        if (input.purchaseOrderIds && input.purchaseOrderIds.length > 0) {
          await this.createPurchaseOrderLinks(input.purchaseOrderIds, invoiceHeader.id, manager);
        }

        const response = await this.getPopulatedInvoiceResponse(invoiceHeader.id, manager);
        return response;
      } catch (error) {
        throw error;
      }
    });
  }

  /**
   * Finds a supplier invoice by its ID.
   * @param id - The ID of the supplier invoice.
   * @param requestingUserId - The ID of the user requesting the invoice.
   * @returns The supplier invoice API response.
   */
  async findSupplierInvoiceById(
    id: number,
    requestingUserId: number,
  ): Promise<SupplierInvoiceApiResponse> {
    try {
      const invoice = await this.invoiceRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });

      if (!invoice) {
        throw new NotFoundError(`Supplier invoice with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(invoice);
      if (!apiResponse) {
        throw new ServerError(`Failed to map supplier invoice ${id}.`);
      }

      return apiResponse;
    } catch (error: any) {
      logger.error('findById', error, { id });
      throw error;
    }
  }
  /**
   * Finds all supplier invoices based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of supplier invoice API responses and the total count.
   */
  async findAllSupplierInvoices(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<SupplierInvoice>;
    sort?: FindManyOptions<SupplierInvoice>['order'];
  }): Promise<{ invoices: SupplierInvoiceApiResponse[]; total: number }> {
    try {
      const { invoices, count } = await this.invoiceRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort,
      });
      const apiInvoices = invoices
        .map((inv) => this.mapToApiResponse(inv))
        .filter(Boolean) as SupplierInvoiceApiResponse[];
      return { invoices: apiInvoices, total: count };
    } catch (error: any) {
      logger.error(`Error finding all supplier invoives: ${JSON.stringify(error)}`);
      throw new ServerError('Error finding all supplier invoives.');
    }
  }

  /**
   * Updates an existing supplier invoice.
   * @param id - The ID of the supplier invoice to update.
   * @param input - The data for updating the supplier invoice.
   * @param updatedByUserId - The ID of the user updating the invoice.
   * @returns The updated supplier invoice API response.
   */
  async updateSupplierInvoice(
    id: number,
    input: UpdateSupplierInvoiceInput,
    updatedByUserId: number,
  ): Promise<SupplierInvoiceApiResponse> {
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

      if (this.canUpdateLinks(invoice.status) && sanitizedInput.purchaseOrderIds) {
        await this.updatePurchaseOrderLinks(id, sanitizedInput.purchaseOrderIds, manager);
      }

      await this.recalculateAndUpdateTotals(id, updatedByUserId, manager);

      return this.getPopulatedInvoiceResponse(id, manager);
    });
  }

  /**
   * Updates the status of a supplier invoice.
   * @param id - The ID of the supplier invoice to update.
   * @param status - The new status for the invoice.
   * @param updatedByUserId - The ID of the user updating the status.
   * @returns The updated supplier invoice API response.
   */
  async updateSupplierInvoiceStatus(
    id: number,
    status: SupplierInvoiceStatus,
    updatedByUserId: number,
  ): Promise<SupplierInvoiceApiResponse> {
    const invoice = await this.getExistingInvoice(id);

    this.validateStatusTransition(invoice, status);
    await this.validatePaidStatusTransition(invoice, status);

    await this.invoiceRepository.update(id, { status, updatedByUserId });

    return this.getPopulatedInvoiceResponse(id);
  }

  /**
   * Deletes a supplier invoice (soft delete).
   * @param id - The ID of the supplier invoice to delete.
   * @param deletedByUserId - The ID of the user deleting the invoice.
   */
  async deleteSupplierInvoice(id: number, deletedByUserId: number): Promise<void> {
    try {
      const invoice = await this.getExistingInvoice(id);

      this.validateDeletion(invoice);
      await this.validateNoPendingPayments(id);

      await this.invoiceRepository.softDelete(id);
    } catch (error: any) {
      logger.error(
        `[deleteSupplierInvoice] Erreur lors de la suppression de la facture fournisseur: ${JSON.stringify(error)}`,
        { id },
      );
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error deleting supplier invoice ${id}.`);
    }
  }

  /**
   * Validates the input data for creating or updating a supplier invoice.
   * @param input - The input data for the invoice.
   * @param context - The validation context, including whether it's an update and the invoice ID.
   */
  private async validateInvoiceInput(
    input: CreateSupplierInvoiceInput | UpdateSupplierInvoiceInput,
    context: ValidationContext,
  ): Promise<void> {
    const { isUpdate, invoiceId, transactionalEntityManager } = context;
    const supplierId = 'supplierId' in input ? input.supplierId : undefined;
    await this.validateSupplier(supplierId, isUpdate, transactionalEntityManager);

    const currencyId = 'currencyId' in input ? input.currencyId : undefined;
    await this.validateCurrency(currencyId, isUpdate, transactionalEntityManager);

    await this.validateInvoiceNumber(input, isUpdate, invoiceId);

    if ('items' in input && input.items) {
      await this.validateItems(input.items, isUpdate, transactionalEntityManager);
    }

    if ('purchaseOrderIds' in input && input.purchaseOrderIds) {
      await this.validatePurchaseOrders(
        input.purchaseOrderIds,
        supplierId,
        transactionalEntityManager,
      );
    }
  }

  /**
   * Validates the supplier ID.
   * @param supplierId - The ID of the supplier.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSupplier(
    supplierId: number | undefined,
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    if (supplierId) {
      let supplier;
      if (manager) {
        const repo = manager.getRepository(Supplier);
        supplier = await repo.findOneBy({ id: supplierId, deletedAt: IsNull() });
      } else {
        supplier = await this.supplierRepository.findById(supplierId);
      }
      if (!supplier) {
        throw new BadRequestError(`Supplier with ID ${supplierId} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Supplier ID is required for creating an invoice.');
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
   * Validates the invoice number.
   * @param input - The input data for the invoice.
   * @param isUpdate - Indicates if the operation is an update.
   * @param invoiceId - The ID of the invoice (if updating).
   */
  private async validateInvoiceNumber(
    input: CreateSupplierInvoiceInput | UpdateSupplierInvoiceInput,
    isUpdate: boolean,
    invoiceId?: number,
  ): Promise<void> {
    if (input.invoiceNumber && 'supplierId' in input && input.supplierId !== undefined) {
      const existing = await this.invoiceRepository.findByInvoiceNumberAndSupplier(
        input.invoiceNumber,
        input.supplierId,
      );

      if (existing && (!isUpdate || existing.id !== invoiceId)) {
        throw new BadRequestError(
          `Invoice number '${input.invoiceNumber}' already exists for supplier ID ${input.supplierId}.`,
        );
      }
    } else if (!isUpdate && !input.invoiceNumber) {
      throw new BadRequestError('Invoice number is required.');
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

    if (item.purchaseReceptionItemId) {
      await this.validateReceptionItem(item.purchaseReceptionItemId, manager);
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
   * Validates a purchase reception item ID.
   * @param receptionItemId - The ID of the purchase reception item.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateReceptionItem(
    receptionItemId: number,
    manager?: EntityManager,
  ): Promise<void> {
    let item;
    if (manager) {
      const repo = manager.getRepository(PurchaseReceptionItem);
      item = await repo.findOneBy({ id: receptionItemId });
    } else {
      item = await this.receptionItemRepository.findById(receptionItemId);
    }

    if (!item) {
      throw new BadRequestError(`Purchase Reception Item ID ${receptionItemId} not found.`);
    }
  }

  /**
   * Validates a list of purchase order IDs.
   * @param purchaseOrderIds - An array of purchase order IDs.
   * @param supplierId - The ID of the supplier associated with the purchase orders.
   * @param manager - The entity manager for transactional operations.
   */
  private async validatePurchaseOrders(
    purchaseOrderIds: number[],
    supplierId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    for (const poId of purchaseOrderIds) {
      let po;
      if (manager) {
        const repo = manager.getRepository(PurchaseOrder);
        po = await repo.findOneBy({ id: poId, deletedAt: IsNull() });
      } else {
        po = await this.poRepository.findById(poId);
      }

      if (!po) {
        throw new BadRequestError(`Purchase Order ID ${poId} not found.`);
      }

      if (supplierId && po.supplierId !== supplierId) {
        throw new BadRequestError(
          `Purchase Order ID ${poId} does not belong to supplier ID ${supplierId}.`,
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
   * Creates the header for a new supplier invoice.
   * @param input - The input data for the invoice.
   * @param createdByUserId - The ID of the user creating the invoice.
   * @param manager - The entity manager for transactional operations.
   * @returns The created SupplierInvoice entity.
   */
  private async createInvoiceHeader(
    input: CreateSupplierInvoiceInput,
    createdByUserId: number,
    manager: EntityManager,
  ): Promise<SupplierInvoice> {
    const repo = manager.getRepository(SupplierInvoice);

    const { items, purchaseOrderIds, ...headerInput } = input;
    const invoiceData: Partial<SupplierInvoice> = {
      ...headerInput,
      invoiceDate: dayjs(input.invoiceDate).toDate(),
      dueDate: input.dueDate ? dayjs(input.dueDate).toDate() : null,
      status: input.status || SupplierInvoiceStatus.PENDING_PAYMENT,
      amountPaid: 0,
      createdByUserId,
      updatedByUserId: createdByUserId,
    };

    const invoice = repo.create(invoiceData);

    this.validateInvoiceEntity(invoice);

    return repo.save(invoice);
  }

  /**
   * Creates items for a supplier invoice.
   * @param itemInputs - An array of input data for invoice items.
   * @param invoiceId - The ID of the supplier invoice.
   * @param manager - The entity manager for transactional operations.
   * @returns An array of created SupplierInvoiceItem entities.
   */
  private async createInvoiceItems(
    itemInputs: CreateSupplierInvoiceItemInput[],
    invoiceId: number,
    manager: EntityManager,
  ): Promise<SupplierInvoiceItem[]> {
    const repo = manager.getRepository(SupplierInvoiceItem);
    const items: SupplierInvoiceItem[] = [];

    if (!itemInputs || itemInputs.length === 0) {
      return [];
    }

    for (const itemInput of itemInputs) {
      const item: any = repo.create({
        ...itemInput,
        supplierInvoiceId: invoiceId,
        totalLineAmountHt: this.calculateLineTotal(itemInput.quantity, itemInput.unitPriceHt),
      });

      if (!item.isValid()) {
        throw new BadRequestError(
          `Invalid data for invoice item (Product ID: ${itemInput.productId || 'N/A'}).`,
        );
      }

      items.push(item);
    }

    const savedItems = await repo.save(items);
    return savedItems;
  }

  /**
   * Updates the total amounts for a supplier invoice.
   * @param invoice - The SupplierInvoice entity to update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceTotals(
    invoice: SupplierInvoice,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierInvoice);
    invoice.calculateTotals();
    await repo.save(invoice);
  }

  /**
   * Creates links between a supplier invoice and purchase orders.
   * @param purchaseOrderIds - An array of purchase order IDs to link.
   * @param invoiceId - The ID of the supplier invoice.
   * @param manager - The entity manager for transactional operations.
   */
  private async createPurchaseOrderLinks(
    purchaseOrderIds: number[] | undefined,
    invoiceId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!purchaseOrderIds?.length) return;

    const repo = manager.getRepository(SupplierInvoicePurchaseOrderLink);
    const links = purchaseOrderIds.map((poId) =>
      repo.create({ supplierInvoiceId: invoiceId, purchaseOrderId: poId }),
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
    input: UpdateSupplierInvoiceInput,
    status: SupplierInvoiceStatus,
  ): UpdateSupplierInvoiceInput {
    if (this.isInvoicePaidOrCancelled(status)) {
      return this.restrictUpdateFieldsForPaidInvoice(input);
    }
    return input;
  }

  /**
   * Checks if the invoice status is paid or cancelled.
   * @param status - The status of the invoice.
   * @returns True if the invoice is paid or cancelled, false otherwise.
   */
  private isInvoicePaidOrCancelled(status: SupplierInvoiceStatus): boolean {
    return status === SupplierInvoiceStatus.PAID || status === SupplierInvoiceStatus.CANCELLED;
  }

  /**
   * Restricts the fields that can be updated for a paid or cancelled invoice.
   * @param input - The update input data.
   * @returns The restricted update input.
   */
  private restrictUpdateFieldsForPaidInvoice(
    input: UpdateSupplierInvoiceInput,
  ): UpdateSupplierInvoiceInput {
    const allowedFields = UPDATABLE_FIELDS_FOR_PAID_INVOICE;
    const restrictedInput: Partial<UpdateSupplierInvoiceInput> = {};

    allowedFields.forEach((field) => {
      if (input.hasOwnProperty(field)) {
        (restrictedInput as any)[field] = (input as any)[field];
      }
    });

    const hasDisallowedFields = Object.keys(input).some(
      (key) =>
        ![...allowedFields, 'status', 'items', 'purchaseOrderIds'].includes(key as any) &&
        input.hasOwnProperty(key),
    );

    if (hasDisallowedFields) {
      throw new ForbiddenError(
        `Cannot update most fields of a supplier invoice in status 'PAID' or 'CANCELLED'.`,
      );
    }

    return restrictedInput;
  }

  /**
   * Checks if invoice items can be updated based on the invoice status.
   * @param status - The current status of the invoice.
   * @returns True if items can be updated, false otherwise.
   */
  private canUpdateItems(status: SupplierInvoiceStatus): boolean {
    return status === SupplierInvoiceStatus.DRAFT;
  }

  /**
   * Checks if purchase order links can be updated based on the invoice status.
   * @param status - The current status of the invoice.
   * @returns True if links can be updated, false otherwise.
   */
  private canUpdateLinks(status: SupplierInvoiceStatus): boolean {
    return status === SupplierInvoiceStatus.DRAFT;
  }

  /**
   * Validates a status transition for a supplier invoice.
   * @param invoice - The current supplier invoice.
   * @param newStatus - The new status to transition to.
   */
  private validateStatusTransition(
    invoice: SupplierInvoice,
    newStatus: SupplierInvoiceStatus,
  ): void {
    if (!Object.values(SupplierInvoiceStatus).includes(newStatus)) {
      throw new BadRequestError(`Invalid status: '${newStatus}'.`);
    }

    if (invoice.status === SupplierInvoiceStatus.PAID && newStatus !== SupplierInvoiceStatus.PAID) {
      throw new ForbiddenError(
        `Cannot change status of a PAID invoice (ID: ${invoice.id}) without specific un-payment logic.`,
      );
    }

    if (
      invoice.status === SupplierInvoiceStatus.CANCELLED &&
      newStatus !== SupplierInvoiceStatus.CANCELLED
    ) {
      throw new ForbiddenError(`Cannot change status of a CANCELLED invoice (ID: ${invoice.id}).`);
    }
  }

  /**
   * Validates the transition to 'PAID' status, checking if the amount paid matches the total.
   * @param invoice - The supplier invoice.
   * @param newStatus - The new status to transition to.
   */
  private async validatePaidStatusTransition(
    invoice: SupplierInvoice,
    newStatus: SupplierInvoiceStatus,
  ): Promise<void> {
    if (newStatus !== SupplierInvoiceStatus.PAID) return;

    const amountPaid = await this.invoiceRepository.getAmountPaidForInvoice(invoice.id);
    const totalAmount = Number(invoice.totalAmountTtc);

    if (Math.abs(totalAmount - amountPaid) > FLOAT_TOLERANCE) {
      logger.warn(
        `Invoice ${invoice.id} marked as PAID, but amountPaid (${amountPaid}) differs from totalTtc (${totalAmount}).`,
      );
    }
  }

  /**
   * Validates if a supplier invoice can be deleted.
   * @param invoice - The supplier invoice to validate.
   */
  private validateDeletion(invoice: SupplierInvoice): void {
    const deletableStatuses = [
      SupplierInvoiceStatus.DRAFT,
      SupplierInvoiceStatus.PENDING_PAYMENT, // Added PENDING_PAYMENT
      SupplierInvoiceStatus.CANCELLED,
    ];

    if (!deletableStatuses.includes(invoice.status)) {
      throw new BadRequestError(
        `Supplier invoice in status '${invoice.status}' cannot be deleted. Consider cancelling it first.`,
      );
    }
  }

  /**
   * Validates that there are no pending payments for an invoice before deletion.
   * @param invoiceId - The ID of the invoice to validate.
   */
  private async validateNoPendingPayments(invoiceId: number): Promise<void> {
    // TODO: Implement payment validation
    const amountPaid = await this.invoiceRepository.getAmountPaidForInvoice(invoiceId);
    if (amountPaid > 0) {
      throw new BadRequestError(
        `Cannot delete invoice ${invoiceId} as payments have been recorded.`,
      );
    }
  }

  // Utility Methods
  /**
   * Calculates the total amount for a single line item.
   * @param quantity - The quantity of the item.
   * @param unitPrice - The unit price of the item (HT).
   * @returns The total line amount (HT).
   */
  private calculateLineTotal(quantity: number, unitPrice: number): number {
    return parseFloat((Number(quantity) * Number(unitPrice)).toFixed(4));
  }

  /**
   * Validates the integrity of a SupplierInvoice entity.
   * @param invoice - The SupplierInvoice entity to validate.
   */
  private validateInvoiceEntity(invoice: SupplierInvoice): void {
    if (!invoice.isValid()) {
      throw new BadRequestError(
        `Supplier invoice data invalid: ${supplierInvoiceValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Maps a SupplierInvoice entity to a SupplierInvoiceApiResponse.
   * @param invoice - The SupplierInvoice entity.
   * @returns The mapped SupplierInvoiceApiResponse.
   */
  private mapToApiResponse(invoice: SupplierInvoice | null): SupplierInvoiceApiResponse {
    if (!invoice) {
      throw new ServerError('Failed to map supplier invoice to API response: invoice is null.');
    }
    return invoice.toApi();
  }

  /**
   * Returns an array of relations to be loaded with a supplier invoice for detailed responses.
   * @returns An array of relation strings.
   */
  private getDetailedRelations(): string[] {
    return [
      'supplier',
      'currency',
      'items',
      'items.product',
      'items.productVariant',
      'items.purchaseReceptionItem',
      'purchaseOrderLinks',
      'purchaseOrderLinks.purchaseOrder',
      'createdByUser',
      'updatedByUser',
    ];
  }

  /**
   * Retrieves an existing supplier invoice by ID.
   * @param id - The ID of the supplier invoice.
   * @returns The SupplierInvoice entity.
   */
  private async getExistingInvoice(id: number): Promise<SupplierInvoice> {
    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError(`Supplier invoice with id ${id} not found.`);
    }
    return invoice;
  }

  /**
   * Retrieves a supplier invoice for update operations, including its items and purchase order links.
   * @param id - The ID of the supplier invoice.
   * @returns The SupplierInvoice entity with relations.
   */
  private async getInvoiceForUpdate(id: number): Promise<SupplierInvoice> {
    const invoice = await this.invoiceRepository.findById(id, {
      relations: ['items', 'purchaseOrderLinks'],
    });
    if (!invoice) {
      throw new NotFoundError(`Supplier invoice with ID ${id} not found.`);
    }
    return invoice;
  }

  /**
   * Retrieves a populated supplier invoice response, including all detailed relations.
   * @param id - The ID of the supplier invoice.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The SupplierInvoiceApiResponse.
   */
  private async getPopulatedInvoiceResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<SupplierInvoiceApiResponse> {
    let invoice;
    if (manager) {
      const repo = manager.getRepository(SupplierInvoice);
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
      throw new ServerError(`Failed to map supplier invoice to API response: invoice is null.`);
    }
    return apiResponse;
  }

  // Transaction helpers (incomplete methods from original)
  /**
   * Updates the header information of a supplier invoice.
   * @param id - The ID of the supplier invoice to update.
   * @param input - The update input data.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceHeader(
    id: number,
    input: UpdateSupplierInvoiceInput,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierInvoice);
    const { items, purchaseOrderIds, ...headerInput } = input;

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
   * Updates the items associated with a supplier invoice.
   * This method deletes existing items and recreates them based on the provided input.
   * @param invoiceId - The ID of the supplier invoice.
   * @param items - An array of invoice item data.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateInvoiceItems(
    invoiceId: number,
    items: any[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierInvoiceItem);

    // Simple approach: delete all existing items and recreate
    await repo.delete({ supplierInvoiceId: invoiceId });

    const newItems: SupplierInvoiceItem[] = items
      .filter((item) => !item._delete)
      .flatMap((itemInput) =>
        repo.create({
          ...itemInput,
          supplierInvoiceId: invoiceId,
          totalLineAmountHt: this.calculateLineTotal(itemInput.quantity, itemInput.unitPriceHt),
        }),
      );

    if (newItems.length > 0) {
      await repo.save(newItems);
    }
  }

  /**
   * Updates the sales order links associated with a supplier invoice.
   * This method deletes existing links and recreates them based on the provided input.
   * @param invoiceId - The ID of the supplier invoice.
   * @param purchaseOrderIds - An array of purchase order IDs to link.
   * @param manager - The entity manager for transactional operations.
   */
  private async updatePurchaseOrderLinks(
    invoiceId: number,
    purchaseOrderIds: number[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierInvoicePurchaseOrderLink);

    await repo.delete({ supplierInvoiceId: invoiceId });

    if (purchaseOrderIds.length > 0) {
      const links = purchaseOrderIds.map((poId) =>
        repo.create({ supplierInvoiceId: invoiceId, purchaseOrderId: poId }),
      );
      await repo.save(links);
    }
  }

  /**
   * Recalculates and updates the total amounts for a supplier invoice.
   * @param invoiceId - The ID of the supplier invoice.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async recalculateAndUpdateTotals(
    invoiceId: number,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierInvoice);
    const invoice = await repo.findOne({
      where: { id: invoiceId },
      relations: ['items'],
    });

    if (!invoice) {
      throw new ServerError('Failed to re-fetch invoice for total calculation.');
    }

    invoice.calculateTotals();
    await repo.update(invoiceId, {
      totalAmountHt: invoice.totalAmountHt,
      totalVatAmount: invoice.totalVatAmount,
      totalAmountTtc: invoice.totalAmountTtc,
      updatedByUserId: userId,
    });
  }

  /**
   * Returns a singleton instance of SupplierInvoiceService.
   * @returns The singleton instance of SupplierInvoiceService.
   */
  static getInstance(): SupplierInvoiceService {
    if (!instance) {
      instance = new SupplierInvoiceService();
    }
    return instance;
  }
}
