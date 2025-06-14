import { v4 as uuidv4 } from 'uuid';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServerError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere, IsNull, type EntityManager } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import dayjs from 'dayjs';

import { Customer, CustomerRepository } from '@/modules/customers';
import { SalesOrder, SalesOrderRepository } from '@/modules/sales-orders';
import { CustomerInvoice, CustomerInvoiceRepository } from '@/modules/customer-invoices';
import { Product, ProductRepository } from '@/modules/products';
import { ProductVariant, ProductVariantRepository } from '@/modules/product-variants';
import { User, UserRepository } from '@/modules/users';
import { StockMovementService, StockMovementType } from '@/modules/stock-movements';
import { PaymentService } from '@/modules/payments';

import {
  CustomerReturn,
  CustomerReturnRepository,
  CustomerReturnStatus,
  customerReturnValidationInputErrors,
  type CreateCustomerReturnInput,
  type UpdateCustomerReturnInput,
  type CustomerReturnApiResponse,
  type ApproveReturnInput,
  type ReceiveReturnInput,
  type CompleteReturnInput,
} from '../index';

import {
  CustomerReturnItem,
  customerReturnItemValidationInputErrors,
  CreateCustomerReturnItemInput,
  ReturnItemActionTaken,
  createCustomerReturnItemSchema,
} from '../index';

import { UserActivityLogService, ActionType, EntityType } from '@/modules/user-activity-logs';

interface ValidationContext {
  isUpdate: boolean;
  returnId?: number;
  transactionalEntityManager?: EntityManager;
}

const UPDATABLE_FIELDS_FOR_PROCESSED_RETURN = ['notes'] as const;

let instance: CustomerReturnService | null = null;

export class CustomerReturnService {
  constructor(
    private readonly returnRepository: CustomerReturnRepository = new CustomerReturnRepository(),
    private readonly customerRepository: CustomerRepository = new CustomerRepository(),
    private readonly salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly customerInvoiceRepository: CustomerInvoiceRepository = new CustomerInvoiceRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
    private readonly paymentService: PaymentService = PaymentService.getInstance(),
    // TODO: private readonly creditNoteService: CreditNoteService = CreditNoteService.getInstance(),
  ) {}

  /**
   * Creates a new customer return.
   * @param input - The data for creating the customer return.
   * @param createdByUserId - The ID of the user creating the return.
   * @returns The created customer return API response.
   */
  async createCustomerReturn(
    input: CreateCustomerReturnInput,
    createdByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        await this.validateReturnInput(input, {
          isUpdate: false,
          transactionalEntityManager: manager,
        });
        await this.validateUser(createdByUserId, manager);

        const returnHeader = await this.createReturnHeader(input, createdByUserId, manager);
        await this.createReturnItems(input.items, returnHeader.id, manager);

        const response = await this.getPopulatedReturnResponse(returnHeader.id, manager);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.CREATE,
          EntityType.SALES_AND_DISTRIBUTION,
          returnHeader.id.toString(),
          { returnNumber: returnHeader.returnNumber, customerId: returnHeader.customerId },
        );

        return response;
      } catch (error: any) {
        logger.error(
          `[createCustomerReturn] Erreur lors de la création du retour client: ${error.message || JSON.stringify(error)}`,
          { error },
        );
        throw error;
      }
    });
  }

  /**
   * Finds a customer return by its ID.
   * @param id - The ID of the customer return.
   * @returns The customer return API response.
   */
  async findCustomerReturnById(id: number): Promise<CustomerReturnApiResponse> {
    try {
      const customerReturn = await this.returnRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
      if (!customerReturn) {
        throw new NotFoundError(`Customer return with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(customerReturn);
      if (!apiResponse) {
        throw new ServerError(`Failed to map customer return ${id}.`);
      }
      return apiResponse;
    } catch (error: any) {
      logger.error('findCustomerReturnById', error, { id });
      throw error;
    }
  }

  /**
   * Finds all customer returns based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of customer return API responses and the total count.
   */
  async findAllCustomerReturns(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CustomerReturn>;
    sort?: FindManyOptions<CustomerReturn>['order'];
  }): Promise<{ returns: CustomerReturnApiResponse[]; total: number }> {
    try {
      const { returns, count } = await this.returnRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { returnDate: 'DESC', createdAt: 'DESC' },
        relations: this.getSummaryRelations(),
      });

      const apiReturns = returns
        .map((r) => this.mapToApiResponse(r))
        .filter(Boolean) as CustomerReturnApiResponse[];
      return { returns: apiReturns, total: count };
    } catch (error: any) {
      logger.error(`Error finding all customer returns: ${JSON.stringify(error)}`);
      throw new ServerError('Error finding all customer returns.');
    }
  }

  /**
   * Updates an existing customer return.
   * @param id - The ID of the customer return to update.
   * @param input - The data for updating the customer return.
   * @param updatedByUserId - The ID of the user updating the return.
   * @returns The updated customer return API response.
   */
  async updateCustomerReturn(
    id: number,
    input: UpdateCustomerReturnInput,
    updatedByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getReturnForUpdate(id, manager);
      const sanitizedInput = this.sanitizeUpdateInput(input, customerReturn.status);

      await this.validateReturnInput(sanitizedInput, {
        isUpdate: true,
        returnId: id,
        transactionalEntityManager: manager,
      });
      await this.validateUser(updatedByUserId, manager);

      await this.updateReturnHeader(id, sanitizedInput, updatedByUserId, manager);

      if (this.canUpdateItems(customerReturn.status) && sanitizedInput.items) {
        await this.updateReturnItems(id, sanitizedInput.items, manager);
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return this.getPopulatedReturnResponse(id, manager);
    });
  }

  /**
   * Approves a customer return.
   * @param returnId - The ID of the customer return to approve.
   * @param input - Approval notes.
   * @param approvedByUserId - The ID of the user approving the return.
   * @returns The updated customer return API response.
   */
  async approveReturn(
    returnId: number,
    input: ApproveReturnInput,
    approvedByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        customerReturn,
        CustomerReturnStatus.APPROVED,
        approvedByUserId,
      );

      await this.updateReturnStatus(
        returnId,
        CustomerReturnStatus.APPROVED,
        approvedByUserId,
        input.notes,
        manager,
      );
      logger.info(`Customer Return ID ${returnId} approved by user ${approvedByUserId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.APPROVE,
        EntityType.SALES_AND_DISTRIBUTION,
        returnId.toString(),
        { notes: input.notes },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Rejects a customer return.
   * @param returnId - The ID of the customer return to reject.
   * @param reason - The reason for rejection.
   * @param rejectedByUserId - The ID of the user rejecting the return.
   * @returns The updated customer return API response.
   */
  async rejectReturn(
    returnId: number,
    reason: string,
    rejectedByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        customerReturn,
        CustomerReturnStatus.REJECTED,
        rejectedByUserId,
      );

      await this.updateReturnStatus(
        returnId,
        CustomerReturnStatus.REJECTED,
        rejectedByUserId,
        `Rejected: ${reason}`,
        manager,
      );
      logger.info(
        `Customer Return ID ${returnId} rejected by user ${rejectedByUserId}. Reason: ${reason}`,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE, // Pas de ActionType.REJECT, donc UPDATE
        EntityType.SALES_AND_DISTRIBUTION,
        returnId.toString(),
        { status: CustomerReturnStatus.REJECTED, reason: reason },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Receives items for a customer return.
   * @param returnId - The ID of the customer return.
   * @param input - The reception details.
   * @param receivedByUserId - The ID of the user receiving the items.
   * @returns The updated customer return API response.
   */
  async receiveReturnItems(
    returnId: number,
    input: ReceiveReturnInput,
    receivedByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getReturnForReception(returnId, manager);

      await this.validateUser(receivedByUserId, manager);

      if (!input.items || input.items.length === 0) {
        throw new BadRequestError('No items provided for reception.');
      }

      await this.processReceivedItems(customerReturn, input, receivedByUserId, manager);

      // Determine new overall status
      const freshItems = await manager.getRepository(CustomerReturnItem).find({
        where: { customerReturnId: returnId, deletedAt: IsNull() },
      });
      const allItemsFullyReceived = freshItems.every(
        (item) => Number(item.quantityReceived) >= Number(item.quantity),
      );
      const newStatus = allItemsFullyReceived
        ? CustomerReturnStatus.RECEIVED_COMPLETE
        : CustomerReturnStatus.RECEIVED_PARTIAL;

      await this.updateReturnStatus(
        returnId,
        newStatus,
        receivedByUserId,
        input.notes ? `Reception Note: ${input.notes}` : undefined,
        manager,
      );

      logger.info(`Items received for Customer Return ID ${returnId}. Status: ${newStatus}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.RECEIVE,
        EntityType.SALES_AND_DISTRIBUTION,
        returnId.toString(),
        {
          newStatus: newStatus,
          receivedItems: input.items.map((item) => ({
            id: item.id,
            quantityReceived: item.quantityReceived,
          })),
        },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Completes the customer return process.
   * @param returnId - The ID of the customer return.
   * @param input - Completion details.
   * @param completedByUserId - The ID of the user completing the return.
   * @returns The updated customer return API response.
   */
  async completeReturnProcess(
    returnId: number,
    input: CompleteReturnInput,
    completedByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        customerReturn,
        CustomerReturnStatus.COMPLETED,
        completedByUserId,
      );
      await this.validateUser(completedByUserId, manager);

      await this.processReturnCompletion(customerReturn, input, completedByUserId, manager);

      await this.updateReturnStatus(
        returnId,
        CustomerReturnStatus.COMPLETED,
        completedByUserId,
        input.resolutionNotes ? `Resolution: ${input.resolutionNotes}` : undefined,
        manager,
      );

      logger.info(`Customer Return ID ${returnId} completed by user ${completedByUserId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.COMPLETE,
        EntityType.SALES_AND_DISTRIBUTION,
        returnId.toString(),
        { resolutionNotes: input.resolutionNotes },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Cancels a customer return.
   * @param returnId - The ID of the customer return to cancel.
   * @param cancelledByUserId - The ID of the user cancelling the return.
   * @returns The updated customer return API response.
   */
  async cancelCustomerReturn(
    returnId: number,
    cancelledByUserId: number,
  ): Promise<CustomerReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const customerReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        customerReturn,
        CustomerReturnStatus.CANCELLED,
        cancelledByUserId,
      );
      await this.validateUser(cancelledByUserId, manager);

      await this.updateReturnStatus(
        returnId,
        CustomerReturnStatus.CANCELLED,
        cancelledByUserId,
        undefined,
        manager,
      );

      logger.info(`Customer Return ID ${returnId} cancelled by user ${cancelledByUserId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CANCEL,
        EntityType.SALES_AND_DISTRIBUTION,
        returnId.toString(),
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Deletes a customer return (soft delete).
   * @param id - The ID of the customer return to delete.
   * @param deletedByUserId - The ID of the user deleting the return.
   */
  async deleteCustomerReturn(id: number, deletedByUserId: number): Promise<void> {
    try {
      const customerReturn = await this.getExistingReturn(id);
      this.validateDeletion(customerReturn);
      await this.validateNoProcessedTransactions(id);
      await this.validateUser(deletedByUserId);

      await this.returnRepository.softDelete(id);
      logger.info(`Customer return '${customerReturn.returnNumber}' (ID: ${id}) soft-deleted.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
      );
    } catch (error: any) {
      logger.error(
        `[deleteCustomerReturn] Error deleting customer return: ${JSON.stringify(error)}`,
        { id },
      );
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error deleting customer return ${id}.`);
    }
  }

  // Private validation methods
  /**
   * Validates the input data for creating or updating a customer return.
   * @param input - The input data for the return.
   * @param context - The validation context, including whether it's an update and the return ID.
   */
  private async validateReturnInput(
    input: CreateCustomerReturnInput | UpdateCustomerReturnInput,
    context: ValidationContext,
  ): Promise<void> {
    const { isUpdate, transactionalEntityManager: manager } = context;

    if ('customerId' in input && input.customerId !== undefined) {
      await this.validateCustomer(input.customerId, true, manager);
    } else if (!isUpdate) {
      throw new BadRequestError('Customer ID is required for creating a return.');
    }

    if ('salesOrderId' in input && input.salesOrderId !== undefined) {
      await this.validateSalesOrder(input.salesOrderId, input.customerId, manager);
    }

    if ('customerInvoiceId' in input && input.customerInvoiceId !== undefined) {
      await this.validateCustomerInvoice(input.customerInvoiceId, input.customerId, manager);
    }

    if ('items' in input && input.items) {
      await this.validateItems(input.items, isUpdate, manager);
    } else if (!isUpdate) {
      throw new BadRequestError('A customer return must have at least one item upon creation.');
    }
  }

  /**
   * Validates the customer ID.
   * @param customerId - The ID of the customer.
   * @param isRequired - Indicates if the customer is required.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCustomer(
    customerId: number | undefined | null,
    isRequired: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    if (customerId) {
      const customer = manager
        ? await manager.getRepository(Customer).findOneBy({ id: customerId, deletedAt: IsNull() })
        : await this.customerRepository.findById(customerId);
      if (!customer) {
        throw new BadRequestError(`Customer with ID ${customerId} not found.`);
      }
    } else if (isRequired) {
      throw new BadRequestError('Customer ID is required.');
    }
  }

  /**
   * Validates a sales order ID.
   * @param salesOrderId - The ID of the sales order.
   * @param customerId - The ID of the customer associated with the sales order.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSalesOrder(
    salesOrderId: number | undefined | null,
    customerId: number | undefined | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (salesOrderId) {
      const salesOrder = manager
        ? await manager
            .getRepository(SalesOrder)
            .findOneBy({ id: salesOrderId, deletedAt: IsNull() })
        : await this.salesOrderRepository.findById(salesOrderId);
      if (!salesOrder) {
        throw new BadRequestError(`Sales Order ID ${salesOrderId} not found.`);
      }
      if (customerId && salesOrder.customerId !== customerId) {
        throw new BadRequestError(
          `Sales Order ID ${salesOrderId} does not belong to customer ID ${customerId}.`,
        );
      }
    }
  }

  /**
   * Validates a customer invoice ID.
   * @param customerInvoiceId - The ID of the customer invoice.
   * @param customerId - The ID of the customer associated with the invoice.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateCustomerInvoice(
    customerInvoiceId: number | undefined | null,
    customerId: number | undefined | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (customerInvoiceId) {
      const customerInvoice = manager
        ? await manager
            .getRepository(CustomerInvoice)
            .findOneBy({ id: customerInvoiceId, deletedAt: IsNull() })
        : await this.customerInvoiceRepository.findById(customerInvoiceId);
      if (!customerInvoice) {
        throw new BadRequestError(`Customer Invoice ID ${customerInvoiceId} not found.`);
      }
      if (customerId && customerInvoice.customerId !== customerId) {
        throw new BadRequestError(
          `Customer Invoice ID ${customerInvoiceId} does not belong to customer ID ${customerId}.`,
        );
      }
    }
  }

  /**
   * Validates a list of return items.
   * @param items - The array of return items to validate.
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
   * Validates a single return item.
   * @param item - The return item to validate.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSingleItem(item: any, manager?: EntityManager): Promise<void> {
    if (item.productId) {
      await this.validateItemProduct(item, manager);
    } else if (!item.description && !item.id) {
      throw new BadRequestError('Item description is required if no product is specified.');
    }

    if (item.quantity <= 0) {
      throw new BadRequestError('Item quantity must be positive.');
    }
  }

  /**
   * Validates the product and product variant for a return item.
   * @param item - The return item containing product information.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateItemProduct(item: any, manager?: EntityManager): Promise<void> {
    if (item.productId) {
      const product = manager
        ? await manager
            .getRepository(Product)
            .findOneBy({ id: item.productId, deletedAt: IsNull() })
        : await this.productRepository.findById(item.productId);

      if (!product) {
        throw new BadRequestError(`Product ID ${item.productId} not found for an item.`);
      }

      if (item.productVariantId) {
        const variant = manager
          ? await manager.getRepository(ProductVariant).findOneBy({
              id: item.productVariantId,
              productId: item.productId,
              deletedAt: IsNull(),
            })
          : await this.variantRepository.findById(item.productVariantId);

        if (!variant || variant.productId !== item.productId) {
          throw new BadRequestError(
            `Variant ID ${item.productVariantId} not valid for product ${item.productId}.`,
          );
        }
      }
    }
  }

  /**
   * Validates a user ID.
   * @param userId - The ID of the user.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateUser(userId: number, manager?: EntityManager): Promise<void> {
    const user = manager
      ? await manager.getRepository(User).findOneBy({ id: userId, deletedAt: IsNull() })
      : await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestError(`User ID ${userId} not found.`);
    }
  }

  // Private creation methods
  /**
   * Creates the header for a new customer return.
   * @param input - The input data for the return.
   * @param createdByUserId - The ID of the user creating the return.
   * @param manager - The entity manager for transactional operations.
   * @returns The created CustomerReturn entity.
   */
  private async createReturnHeader(
    input: CreateCustomerReturnInput,
    createdByUserId: number,
    manager: EntityManager,
  ): Promise<CustomerReturn> {
    const repo = manager.getRepository(CustomerReturn);

    const { items, warehouseId, shopId, ...headerInput } = input;
    const returnData: Partial<CustomerReturn> = {
      ...headerInput,
      returnNumber: this.generateReturnNumber(),
      returnDate: dayjs(input.returnDate).toDate(),
      status: input.status ?? CustomerReturnStatus.REQUESTED,
      warehouseId: warehouseId,
      shopId: shopId,
      createdByUserId,
      updatedByUserId: createdByUserId,
    };

    const customerReturn = repo.create(returnData);
    this.validateReturnEntity(customerReturn);

    const savedReturn = await repo.save(customerReturn);
    return savedReturn;
  }

  /**
   * Creates items for a customer return.
   * @param itemInputs - An array of input data for return items.
   * @param returnId - The ID of the customer return.
   * @param manager - The entity manager for transactional operations.
   * @returns An array of created CustomerReturnItem entities.
   */
  private async createReturnItems(
    itemInputs: CreateCustomerReturnItemInput[],
    returnId: number,
    manager: EntityManager,
  ): Promise<CustomerReturnItem[]> {
    const repo = manager.getRepository(CustomerReturnItem);
    const items: CustomerReturnItem[] = [];

    if (!itemInputs || itemInputs.length === 0) {
      return [];
    }

    for (const itemInput of itemInputs) {
      const parsedItemInput = createCustomerReturnItemSchema.safeParse(itemInput);

      if (!parsedItemInput.success) {
        const errors = parsedItemInput.error.issues
          .map((issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`)
          .join('; ');
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${errors}`,
        );
      }

      const item = repo.create({
        ...parsedItemInput.data,
        customerReturnId: returnId,
      });

      if (!item.isValid()) {
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${customerReturnItemValidationInputErrors.join('; ')}`,
        );
      }

      items.push(item);
    }

    const savedItems = await repo.save(items);
    return savedItems;
  }

  /**
   * Sanitizes the update input based on the return status.
   * Restricts fields that can be updated if the return is processed.
   * @param input - The update input data.
   * @param status - The current status of the return.
   * @returns The sanitized update input.
   */
  private sanitizeUpdateInput(
    input: UpdateCustomerReturnInput,
    status: CustomerReturnStatus,
  ): UpdateCustomerReturnInput {
    if (this.isReturnProcessed(status)) {
      return this.restrictUpdateFieldsForProcessedReturn(input);
    }
    return input;
  }

  /**
   * Checks if the return status indicates it has been processed (e.g., received, completed, refunded).
   * @param status - The status of the return.
   * @returns True if the return is processed, false otherwise.
   */
  private isReturnProcessed(status: CustomerReturnStatus): boolean {
    return [
      CustomerReturnStatus.RECEIVED_PARTIAL,
      CustomerReturnStatus.RECEIVED_COMPLETE,
      CustomerReturnStatus.INSPECTED,
      CustomerReturnStatus.REFUND_PENDING,
      CustomerReturnStatus.EXCHANGE_PENDING,
      CustomerReturnStatus.CREDIT_NOTE_ISSUED,
      CustomerReturnStatus.REFUNDED,
      CustomerReturnStatus.EXCHANGED,
      CustomerReturnStatus.COMPLETED,
      CustomerReturnStatus.CANCELLED,
      CustomerReturnStatus.REJECTED,
    ].includes(status);
  }

  /**
   * Restricts the fields that can be updated for a processed return.
   * @param input - The update input data.
   * @returns The restricted update input.
   */
  private restrictUpdateFieldsForProcessedReturn(
    input: UpdateCustomerReturnInput,
  ): UpdateCustomerReturnInput {
    const allowedFields = UPDATABLE_FIELDS_FOR_PROCESSED_RETURN;
    const restrictedInput: Partial<UpdateCustomerReturnInput> = {};

    allowedFields.forEach((field) => {
      if (input.hasOwnProperty(field)) {
        (restrictedInput as any)[field] = (input as any)[field];
      }
    });

    const hasDisallowedFields = Object.keys(input).some(
      (key) =>
        ![...allowedFields, 'status', 'items'].includes(key as any) && input.hasOwnProperty(key),
    );

    if (hasDisallowedFields) {
      throw new ForbiddenError(
        `Cannot update most fields of a customer return once it has been processed (e.g., received, completed, refunded). Only notes can be updated.`,
      );
    }

    return restrictedInput;
  }

  /**
   * Checks if return items can be updated based on the return status.
   * @param status - The current status of the return.
   * @returns True if items can be updated, false otherwise.
   */
  private canUpdateItems(status: CustomerReturnStatus): boolean {
    return [CustomerReturnStatus.REQUESTED, CustomerReturnStatus.APPROVED].includes(status);
  }

  /**
   * Updates the header information of a customer return.
   * @param id - The ID of the customer return to update.
   * @param input - The update input data.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnHeader(
    id: number,
    input: UpdateCustomerReturnInput,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerReturn);
    const { items, ...headerInput } = input;

    const updateData = {
      ...headerInput,
      updatedByUserId: userId,
      ...(input.returnDate && { returnDate: dayjs(input.returnDate).toDate() }),
    };

    await repo.update(id, updateData);
  }

  /**
   * Updates the items associated with a customer return.
   * This method deletes existing items and recreates them based on the provided input.
   * @param returnId - The ID of the customer return.
   * @param items - An array of return item data.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnItems(
    returnId: number,
    items: Partial<CreateCustomerReturnItemInput>[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(CustomerReturnItem);

    await repo.softDelete({ customerReturnId: returnId });

    const newItems: CustomerReturnItem[] = [];
    for (const itemInput of items.filter((item) => !(item as any)._delete)) {
      const item: CustomerReturnItem = repo.create({
        ...itemInput,
        customerReturnId: returnId,
      } as Partial<CustomerReturnItem>);

      if (!item.isValid()) {
        logger.error(
          `[updateReturnItems] Validation échouée pour l'élément de retour (Product ID: ${itemInput.productId ?? 'N/A'}). Erreurs: ${customerReturnItemValidationInputErrors.join('; ')}`,
        );
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId ?? 'N/A'}). Errors: ${customerReturnItemValidationInputErrors.join('; ')}`,
        );
      }
      newItems.push(item);
    }

    if (newItems.length > 0) {
      await repo.save(newItems);
    }
  }

  /**
   * Updates the status of a customer return.
   * @param id - The ID of the customer return to update.
   * @param newStatus - The new status for the return.
   * @param updatedByUserId - The ID of the user updating the status.
   * @param notes - Optional notes to add to the return.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnStatus(
    id: number,
    newStatus: CustomerReturnStatus,
    updatedByUserId: number,
    notes?: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    const updateData: Partial<CustomerReturn> = { status: newStatus, updatedByUserId };
    if (notes !== undefined) {
      let currentReturn: CustomerReturn | null;
      if (manager) {
        currentReturn = await manager.getRepository(CustomerReturn).findOneBy({ id });
      } else {
        currentReturn = await this.returnRepository.findById(id);
      }

      if (currentReturn) {
        updateData.notes = currentReturn.notes ? `${currentReturn.notes}\n${notes}` : notes;
      } else {
        updateData.notes = notes;
      }
    }

    if (manager) {
      await manager.getRepository(CustomerReturn).update(id, updateData);
    } else {
      await this.returnRepository.update(id, updateData);
    }
  }

  /**
   * Validates a status transition for a customer return.
   * @param customerReturn - The current customer return.
   * @param newStatus - The new status to transition to.
   * @param userId - The ID of the user performing the transition.
   */
  private validateStatusTransition(
    customerReturn: CustomerReturn,
    newStatus: CustomerReturnStatus,
    userId?: number,
  ): void {
    if (!Object.values(CustomerReturnStatus).includes(newStatus)) {
      throw new BadRequestError(`Invalid status: '${newStatus}'.`);
    }

    const currentStatus = customerReturn.status;

    const allowedTransitions: Record<CustomerReturnStatus, CustomerReturnStatus[]> = {
      [CustomerReturnStatus.REQUESTED]: [
        CustomerReturnStatus.APPROVED,
        CustomerReturnStatus.REJECTED,
        CustomerReturnStatus.CANCELLED,
      ],
      [CustomerReturnStatus.APPROVED]: [
        CustomerReturnStatus.PENDING_RECEPTION,
        CustomerReturnStatus.RECEIVED_PARTIAL,
        CustomerReturnStatus.RECEIVED_COMPLETE,
        CustomerReturnStatus.CANCELLED,
      ],
      [CustomerReturnStatus.REJECTED]: [],
      [CustomerReturnStatus.PENDING_RECEPTION]: [
        CustomerReturnStatus.RECEIVED_PARTIAL,
        CustomerReturnStatus.RECEIVED_COMPLETE,
        CustomerReturnStatus.CANCELLED,
      ],
      [CustomerReturnStatus.RECEIVED_PARTIAL]: [
        CustomerReturnStatus.RECEIVED_COMPLETE,
        CustomerReturnStatus.INSPECTED,
        CustomerReturnStatus.REFUND_PENDING,
        CustomerReturnStatus.EXCHANGE_PENDING,
        CustomerReturnStatus.CREDIT_NOTE_ISSUED,
        CustomerReturnStatus.COMPLETED,
      ],
      [CustomerReturnStatus.RECEIVED_COMPLETE]: [
        CustomerReturnStatus.INSPECTED,
        CustomerReturnStatus.REFUND_PENDING,
        CustomerReturnStatus.EXCHANGE_PENDING,
        CustomerReturnStatus.CREDIT_NOTE_ISSUED,
        CustomerReturnStatus.COMPLETED,
      ],
      [CustomerReturnStatus.INSPECTED]: [
        CustomerReturnStatus.REFUND_PENDING,
        CustomerReturnStatus.EXCHANGE_PENDING,
        CustomerReturnStatus.CREDIT_NOTE_ISSUED,
        CustomerReturnStatus.COMPLETED,
      ],
      [CustomerReturnStatus.REFUND_PENDING]: [
        CustomerReturnStatus.REFUNDED,
        CustomerReturnStatus.COMPLETED,
      ],
      [CustomerReturnStatus.EXCHANGE_PENDING]: [
        CustomerReturnStatus.EXCHANGED,
        CustomerReturnStatus.COMPLETED,
      ],
      [CustomerReturnStatus.CREDIT_NOTE_ISSUED]: [CustomerReturnStatus.COMPLETED],
      [CustomerReturnStatus.REFUNDED]: [CustomerReturnStatus.COMPLETED],
      [CustomerReturnStatus.EXCHANGED]: [CustomerReturnStatus.COMPLETED],
      [CustomerReturnStatus.COMPLETED]: [],
      [CustomerReturnStatus.CANCELLED]: [],
    };

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      throw new BadRequestError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}' for return ID ${customerReturn.id}.`,
      );
    }
  }

  /**
   * Validates if a customer return can be deleted.
   * @param customerReturn - The customer return to validate.
   */
  private validateDeletion(customerReturn: CustomerReturn): void {
    const deletableStatuses = [
      CustomerReturnStatus.REQUESTED,
      CustomerReturnStatus.REJECTED,
      CustomerReturnStatus.CANCELLED,
    ];

    if (!deletableStatuses.includes(customerReturn.status)) {
      throw new BadRequestError(
        `Customer return in status '${customerReturn.status}' cannot be deleted.`,
      );
    }
  }

  /**TODO
   * Validates that there are no processed financial transactions linked to the return before deletion.
   * @param returnId - The ID of the return to validate.
   */
  private async validateNoProcessedTransactions(returnId: number): Promise<void> {
    /*const isProcessed = await this.returnRepository.isReturnProcessedForRefundOrExchange(returnId);
    if (isProcessed) {
      throw new BadRequestError(
        `Return ${returnId} has been processed for refund/exchange and cannot be deleted.`,
      );
    }*/
  }
  /**
   * Processes the reception of return items, including stock movements.
   * @param customerReturn - The customer return entity.
   * @param input - The reception input data.
   * @param receivedByUserId - The ID of the user receiving the items.
   * @param manager - The entity manager for transactional operations.
   */
  private async processReceivedItems(
    customerReturn: CustomerReturn,
    input: ReceiveReturnInput,
    receivedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const itemRepoTx = manager.getRepository(CustomerReturnItem);

    for (const receivedItemInput of input.items) {
      const itemToUpdate = customerReturn.items?.find((i) => i.id === receivedItemInput.id);
      if (!itemToUpdate) {
        throw new BadRequestError(
          `Return Item ID ${receivedItemInput.id} not found in this return.`,
        );
      }

      const quantityToReceive = Number(receivedItemInput.quantityReceived ?? 0);
      if (quantityToReceive < 0) {
        throw new BadRequestError(
          `Quantity received for item ${itemToUpdate.id} cannot be negative.`,
        );
      }

      const remainingToReceiveOnItem =
        Number(itemToUpdate.quantity) - Number(itemToUpdate.quantityReceived || 0);
      if (quantityToReceive > remainingToReceiveOnItem) {
        throw new BadRequestError(
          `Quantity received ${quantityToReceive} for item ${itemToUpdate.id} (Product: ${itemToUpdate.product?.sku}) exceeds remaining expected quantity (${remainingToReceiveOnItem}).`,
        );
      }

      itemToUpdate.quantityReceived =
        Number(itemToUpdate.quantityReceived || 0) + quantityToReceive;
      if (receivedItemInput.condition) itemToUpdate.condition = receivedItemInput.condition;
      if (receivedItemInput.actionTaken) itemToUpdate.actionTaken = receivedItemInput.actionTaken;
      if (receivedItemInput.itemNotes) {
        itemToUpdate.notes =
          (itemToUpdate.notes ? itemToUpdate.notes + '\n' : '') +
          `Reception Note: ${receivedItemInput.itemNotes}`;
      }
      await itemRepoTx.save(itemToUpdate);
      if (
        itemToUpdate.actionTaken === ReturnItemActionTaken.RESTOCK ||
        itemToUpdate.actionTaken === ReturnItemActionTaken.RESTOCK_QUARANTINE
      ) {
        const targetWarehouseId = customerReturn.warehouseId;
        const targetShopId = customerReturn.shopId;

        if (!targetWarehouseId && !targetShopId) {
          throw new BadRequestError(
            'Cannot create stock movement: Neither warehouseId nor shopId is specified for the return.',
          );
        }

        const stockMovementInput = {
          productId: itemToUpdate.productId,
          productVariantId: itemToUpdate.productVariantId,
          warehouseId: targetWarehouseId,
          shopId: targetShopId,
          movementType: StockMovementType.CUSTOMER_RETURN,
          quantity: quantityToReceive,
          movementDate: input.receivedDate ? dayjs(input.receivedDate).toDate() : new Date(),
          unitCostAtMovement: Number(itemToUpdate.unitPriceAtReturn),
          userId: receivedByUserId,
          referenceDocumentType: 'customer_return',
          referenceDocumentId: customerReturn.id.toString(),
        };

        await this.stockMovementService.createMovement(stockMovementInput, manager);
      }
    }
  }

  /**
   * Processes the completion of a return, including financial transactions.
   * @param customerReturn - The customer return entity.
   * @param input - Completion input data.
   * @param completedByUserId - The ID of the user completing the return.
   * @param manager - The entity manager for transactional operations.
   */
  private async processReturnCompletion(
    customerReturn: CustomerReturn,
    input: CompleteReturnInput,
    completedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!customerReturn.items || customerReturn.items.length === 0) {
      const populatedReturn = await this.returnRepository.findById(customerReturn.id, {
        relations: ['items'],
        transactionalEntityManager: manager,
      });
      if (populatedReturn) {
        customerReturn.items = populatedReturn.items;
      } else {
        throw new ServerError(`Failed to load items for return ${customerReturn.id}.`);
      }
    }

    const totalRefundAmount = customerReturn.items.reduce((sum, item) => {
      if (item.actionTaken === ReturnItemActionTaken.REFUND_APPROVED) {
        return sum + Number(item.quantityReceived) * Number(item.unitPriceAtReturn ?? 0);
      }
      return sum;
    }, 0);

    if (totalRefundAmount > 0) {
      await this.paymentService.createRefundPayment(
        {
          customerId: customerReturn.customerId,
          amount: totalRefundAmount,
          relatedReturnId: customerReturn.id,
        },
        manager,
      );
    }
  }

  /**
   * Maps a CustomerReturn entity to a CustomerReturnApiResponse.
   * @param customerReturn - The CustomerReturn entity.
   * @returns The mapped CustomerReturnApiResponse or null if the input is null.
   */
  private mapToApiResponse(
    customerReturn: CustomerReturn | null,
  ): CustomerReturnApiResponse | null {
    if (!customerReturn) {
      return null;
    }
    return customerReturn.toApi(true);
  }

  /**
   * Generates a unique return number.
   * @returns A promise that resolves to a unique return number string.
   */
  private generateReturnNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `RMA-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Validates the integrity of a CustomerReturn entity.
   * @param customerReturn - The CustomerReturn entity to validate.
   */
  private validateReturnEntity(customerReturn: CustomerReturn): void {
    if (!customerReturn.isValid()) {
      throw new BadRequestError(
        `Customer return data invalid: ${customerReturnValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Returns an array of relations to be loaded with a customer return for detailed responses.
   * @returns An array of relation strings.
   */
  private getDetailedRelations(): string[] {
    return [
      'customer',
      'salesOrder',
      'customerInvoice',
      'items',
      'items.product',
      'items.productVariant',
      'createdByUser',
      'updatedByUser',
    ];
  }

  /**
   * Returns an array of relations to be loaded with a customer return for summary responses.
   * @returns An array of relation strings.
   */
  private getSummaryRelations(): string[] {
    return ['customer', 'salesOrder', 'customerInvoice', 'createdByUser'];
  }

  /**
   * Retrieves an existing customer return by ID.
   * @param id - The ID of the customer return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CustomerReturn entity.
   */
  private async getExistingReturn(id: number, manager?: EntityManager): Promise<CustomerReturn> {
    let customerReturn;
    if (manager) {
      const repo = manager.getRepository(CustomerReturn);
      customerReturn = await repo.findOne({ where: { id, deletedAt: IsNull() } });
    } else {
      customerReturn = await this.returnRepository.findById(id);
    }
    if (!customerReturn) {
      throw new NotFoundError(`Customer return with id ${id} not found.`);
    }
    return customerReturn;
  }

  /**
   * Retrieves a customer return for update operations, including its items.
   * @param id - The ID of the customer return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CustomerReturn entity with relations.
   */
  private async getReturnForUpdate(id: number, manager?: EntityManager): Promise<CustomerReturn> {
    let customerReturn;
    if (manager) {
      const repo = manager.getRepository(CustomerReturn);
      customerReturn = await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: ['items'],
      });
    } else {
      customerReturn = await this.returnRepository.findById(id, { relations: ['items'] });
    }
    if (!customerReturn) {
      throw new NotFoundError(`Customer return with ID ${id} not found.`);
    }
    return customerReturn;
  }

  /**
   * Retrieves a customer return for reception operations, including its items and related entities for stock movements.
   * @param id - The ID of the customer return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CustomerReturn entity with relations.
   */
  private async getReturnForReception(
    id: number,
    manager?: EntityManager,
  ): Promise<CustomerReturn> {
    let customerReturn;
    const relations = ['items', 'items.product', 'items.productVariant', 'warehouse', 'shop'];
    if (manager) {
      const repo = manager.getRepository(CustomerReturn);
      customerReturn = await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: relations,
      });
    } else {
      customerReturn = await this.returnRepository.findById(id, { relations: relations });
    }
    if (!customerReturn) {
      throw new NotFoundError(`Customer Return ID ${id} not found.`);
    }

    if (!customerReturn) {
      throw new NotFoundError(`Customer Return ID ${id} not found.`);
    }
    return customerReturn;
  }

  /**
   * Retrieves a populated customer return response, including all detailed relations.
   * @param id - The ID of the customer return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The CustomerReturnApiResponse.
   */
  private async getPopulatedReturnResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<CustomerReturnApiResponse> {
    let customerReturn;
    if (manager) {
      const repo = manager.getRepository(CustomerReturn);
      customerReturn = await repo.findOne({
        where: { id },
        relations: this.getDetailedRelations(),
      });
    } else {
      customerReturn = await this.returnRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
    }

    const apiResponse = this.mapToApiResponse(customerReturn);
    if (!apiResponse) {
      logger.error(
        `[getPopulatedReturnResponse] mapToApiResponse returned null for return ID ${id}.`,
      );
      throw new ServerError(`Failed to map customer return to API response: return is null.`);
    }
    return apiResponse;
  }

  static getInstance(): CustomerReturnService {
    instance ??= new CustomerReturnService();
    return instance;
  }
}
