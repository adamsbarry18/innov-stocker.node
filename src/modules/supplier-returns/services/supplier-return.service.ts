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

import { SupplierReturnRepository } from '../data/supplier-return.repository';
import { SupplierReturnItemRepository } from '../supplier-return-items/data/supplier-return-item.repository';
import { SupplierRepository } from '@/modules/suppliers/data/supplier.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { UserRepository } from '@/modules/users';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import { PurchaseReceptionItemRepository } from '@/modules/purchase-receptions/purchase-reception-items/data/purchase-reception-item.repository';

import {
  SupplierReturn,
  SupplierReturnStatus,
  supplierReturnValidationInputErrors,
  type CreateSupplierReturnInput,
  type UpdateSupplierReturnInput,
  type SupplierReturnApiResponse,
  type ShipSupplierReturnInput,
  type CompleteSupplierReturnInput,
} from '../models/supplier-return.entity';
import {
  SupplierReturnItem,
  supplierReturnItemValidationInputErrors,
  createSupplierReturnItemSchema,
  type CreateSupplierReturnItemInput,
} from '../supplier-return-items/models/supplier-return-item.entity';
import { Supplier } from '@/modules/suppliers/models/supplier.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import { User } from '@/modules/users/models/users.entity';
import { Warehouse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop } from '@/modules/shops/models/shop.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-receptions/purchase-reception-items/models/purchase-reception-item.entity';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

interface ValidationContext {
  isUpdate: boolean;
  returnId?: number;
  transactionalEntityManager?: EntityManager;
}

const UPDATABLE_FIELDS_FOR_PROCESSED_RETURN = ['notes'] as const;

let instance: SupplierReturnService | null = null;

export class SupplierReturnService {
  constructor(
    private readonly returnRepository: SupplierReturnRepository = new SupplierReturnRepository(),
    private readonly itemRepository: SupplierReturnItemRepository = new SupplierReturnItemRepository(),
    private readonly supplierRepository: SupplierRepository = new SupplierRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  /**
   * Creates a new supplier return.
   * @param input - The data for creating the supplier return.
   * @param createdByUserId - The ID of the user creating the return.
   * @returns The created supplier return API response.
   */
  async createSupplierReturn(
    input: CreateSupplierReturnInput,
    createdByUserId: number,
  ): Promise<SupplierReturnApiResponse> {
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
          EntityType.PROCUREMENT_PROCESS,
          returnHeader.id.toString(),
          { returnNumber: returnHeader.returnNumber, supplierId: returnHeader.supplierId },
        );

        return response;
      } catch (error: any) {
        logger.error(
          `[createSupplierReturn] Erreur lors de la création du retour fournisseur: ${error.message || JSON.stringify(error)}`,
          { error },
        );
        throw error;
      }
    });
  }

  /**
   * Finds a supplier return by its ID.
   * @param id - The ID of the supplier return.
   * @returns The supplier return API response.
   */
  async findSupplierReturnById(id: number): Promise<SupplierReturnApiResponse> {
    try {
      const supplierReturn = await this.returnRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
      if (!supplierReturn) {
        throw new NotFoundError(`Supplier return with id ${id} not found.`);
      }

      const apiResponse = this.mapToApiResponse(supplierReturn);
      if (!apiResponse) {
        throw new ServerError(`Failed to map supplier return ${id}.`);
      }
      return apiResponse;
    } catch (error: any) {
      logger.error('findSupplierReturnById', error, { id });
      throw error;
    }
  }

  /**
   * Finds all supplier returns based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing an array of supplier return API responses and the total count.
   */
  async findAllSupplierReturns(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<SupplierReturn>;
    sort?: FindManyOptions<SupplierReturn>['order'];
  }): Promise<{ returns: SupplierReturnApiResponse[]; total: number }> {
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
        .filter(Boolean) as SupplierReturnApiResponse[];
      return { returns: apiReturns, total: count };
    } catch (error: any) {
      logger.error(`Error finding all supplier returns: ${JSON.stringify(error)}`);
      throw new ServerError('Error finding all supplier returns.');
    }
  }

  /**
   * Updates an existing supplier return.
   * @param id - The ID of the supplier return to update.
   * @param input - The data for updating the supplier return.
   * @param updatedByUserId - The ID of the user updating the return.
   * @returns The updated supplier return API response.
   */
  async updateSupplierReturn(
    id: number,
    input: UpdateSupplierReturnInput,
    updatedByUserId: number,
  ): Promise<SupplierReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const supplierReturn = await this.getReturnForUpdate(id, manager);
      const sanitizedInput = this.sanitizeUpdateInput(input, supplierReturn.status);

      await this.validateReturnInput(sanitizedInput, {
        isUpdate: true,
        returnId: id,
        transactionalEntityManager: manager,
      });
      await this.validateUser(updatedByUserId, manager);

      await this.updateReturnHeader(id, sanitizedInput, updatedByUserId, manager);

      if (this.canUpdateItems(supplierReturn.status) && sanitizedInput.items) {
        await this.updateReturnItems(id, sanitizedInput.items, manager);
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PROCUREMENT_PROCESS,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return this.getPopulatedReturnResponse(id, manager);
    });
  }

  /**
   * Approves a supplier return.
   * @param returnId - The ID of the supplier return to approve.
   * @param approvedByUserId - The ID of the user approving the return.
   * @param supplierRmaNumber - The RMA number provided by the supplier.
   * @param notes - Optional notes.
   * @returns The updated supplier return API response.
   */
  async approveSupplierReturn(
    returnId: number,
    approvedByUserId: number,
    supplierRmaNumber?: string | null,
    notes?: string | null,
  ): Promise<SupplierReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const supplierReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        supplierReturn,
        SupplierReturnStatus.APPROVED_BY_SUPPLIER,
        approvedByUserId,
      );

      await this.updateReturnStatus(
        returnId,
        SupplierReturnStatus.APPROVED_BY_SUPPLIER,
        approvedByUserId,
        notes,
        { supplierRmaNumber },
        manager,
      );
      logger.info(
        `Supplier Return ID ${returnId} approved by user ${approvedByUserId} ${supplierRmaNumber ? `with RMA ${supplierRmaNumber}` : ''}.`,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.APPROVE,
        EntityType.PROCUREMENT_PROCESS,
        returnId.toString(),
        { supplierRmaNumber: supplierRmaNumber, notes: notes },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Ships items for a supplier return.
   * @param returnId - The ID of the supplier return.
   * @param input - The shipping details.
   * @param shippedByUserId - The ID of the user shipping the items.
   * @returns The updated supplier return API response.
   */
  async shipSupplierReturn(
    returnId: number,
    input: ShipSupplierReturnInput,
    shippedByUserId: number,
  ): Promise<SupplierReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const supplierReturn = await this.getReturnForShipping(returnId, manager);

      await this.validateUser(shippedByUserId, manager);

      if (!input.items || input.items.length === 0) {
        throw new BadRequestError('At least one item must be specified for shipping.');
      }

      await this.processShippedItems(supplierReturn, input, shippedByUserId, manager);

      // Determine new overall status
      const freshItems = await manager.getRepository(SupplierReturnItem).find({
        where: { supplierReturnId: returnId, deletedAt: IsNull() },
      });
      const allItemsFullyShipped = freshItems.every(
        (item) => Number(item.quantityShipped) >= Number(item.quantity),
      );
      const newStatus = allItemsFullyShipped
        ? SupplierReturnStatus.SHIPPED_TO_SUPPLIER
        : SupplierReturnStatus.PENDING_SHIPMENT;

      await this.updateReturnStatus(
        returnId,
        newStatus,
        shippedByUserId,
        input.notes ? `Shipping Note: ${input.notes}` : undefined,
        {
          shipDate: input.shipDate ? dayjs(input.shipDate).toDate() : undefined,
        },
        manager,
      );

      logger.info(`Items shipped for Supplier Return ID ${returnId}. Status: ${newStatus}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.SHIP,
        EntityType.PROCUREMENT_PROCESS,
        returnId.toString(),
        {
          newStatus: newStatus,
          shipDate: input.shipDate,
          shippedItems: input.items.map((item) => ({
            id: item.id,
            quantityShipped: item.quantityShipped,
          })),
        },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Completes the supplier return process.
   * @param returnId - The ID of the supplier return.
   * @param input - Completion details.
   * @param completedByUserId - The ID of the user completing the return.
   * @returns The updated supplier return API response.
   */
  async completeSupplierReturnProcess(
    returnId: number,
    input: CompleteSupplierReturnInput,
    completedByUserId: number,
  ): Promise<SupplierReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const supplierReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        supplierReturn,
        SupplierReturnStatus.COMPLETED,
        completedByUserId,
      );
      await this.validateUser(completedByUserId, manager);

      await this.processReturnCompletion(supplierReturn, input, completedByUserId, manager);

      await this.updateReturnStatus(
        returnId,
        SupplierReturnStatus.COMPLETED,
        completedByUserId,
        input.resolutionNotes ? `Resolution: ${input.resolutionNotes}` : undefined,
        undefined,
        manager,
      );

      logger.info(`Supplier Return ID ${returnId} completed by user ${completedByUserId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.COMPLETE,
        EntityType.PROCUREMENT_PROCESS,
        returnId.toString(),
        { resolutionNotes: input.resolutionNotes },
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Cancels a supplier return.
   * @param returnId - The ID of the supplier return to cancel.
   * @param cancelledByUserId - The ID of the user cancelling the return.
   * @returns The updated supplier return API response.
   */
  async cancelSupplierReturn(
    returnId: number,
    cancelledByUserId: number,
  ): Promise<SupplierReturnApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const supplierReturn = await this.getExistingReturn(returnId, manager);
      this.validateStatusTransition(
        supplierReturn,
        SupplierReturnStatus.CANCELLED,
        cancelledByUserId,
      );
      await this.validateUser(cancelledByUserId, manager);

      await this.updateReturnStatus(
        returnId,
        SupplierReturnStatus.CANCELLED,
        cancelledByUserId,
        undefined,
        undefined,
        manager,
      );

      logger.info(`Supplier Return ID ${returnId} cancelled by user ${cancelledByUserId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CANCEL,
        EntityType.PROCUREMENT_PROCESS,
        returnId.toString(),
      );

      return this.getPopulatedReturnResponse(returnId, manager);
    });
  }

  /**
   * Deletes a supplier return (soft delete).
   * @param id - The ID of the supplier return to delete.
   * @param deletedByUserId - The ID of the user deleting the return.
   */
  async deleteSupplierReturn(id: number, deletedByUserId: number): Promise<void> {
    try {
      const supplierReturn = await this.getExistingReturn(id);
      this.validateDeletion(supplierReturn);
      this.validateNoProcessedTransactions(id);
      await this.validateUser(deletedByUserId);

      await this.returnRepository.softDelete(id);
      logger.info(`Supplier return '${supplierReturn.returnNumber}' (ID: ${id}) soft-deleted.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PROCUREMENT_PROCESS,
        id.toString(),
      );
    } catch (error: any) {
      logger.error(
        `[deleteSupplierReturn] Error deleting supplier return: ${error.message ?? JSON.stringify(error)}`,
        { id },
      );
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error deleting supplier return ${id}.`);
    }
  }

  /**
   * Validates the input data for creating or updating a supplier return.
   * @param input - The input data for the return.
   * @param context - The validation context, including whether it's an update and the return ID.
   */
  private async validateReturnInput(
    input: CreateSupplierReturnInput | UpdateSupplierReturnInput,
    context: ValidationContext,
  ): Promise<void> {
    const { isUpdate, transactionalEntityManager: manager } = context;

    if ('supplierId' in input && input.supplierId !== undefined) {
      await this.validateSupplier(input.supplierId, true, manager);
    } else if (!isUpdate) {
      throw new BadRequestError('Supplier ID is required for creating a return.');
    }

    if (input.hasOwnProperty('sourceWarehouseId') && input.sourceWarehouseId) {
      await this.validateWarehouse(input.sourceWarehouseId, manager);
    } else if (input.hasOwnProperty('sourceShopId') && input.sourceShopId) {
      await this.validateShop(input.sourceShopId, manager);
    } else if (!isUpdate) {
      throw new BadRequestError('Either sourceWarehouseId or sourceShopId must be provided.');
    }
    if (input.sourceWarehouseId && input.sourceShopId) {
      throw new BadRequestError('Provide either sourceWarehouseId or sourceShopId, not both.');
    }

    if ('items' in input && input.items) {
      if (!isUpdate && input.items.length === 0) {
        throw new BadRequestError('A supplier return must have at least one item upon creation.');
      }
      await this.validateItems(input.items, isUpdate, manager);
    } else if (!isUpdate) {
      throw new BadRequestError('A supplier return must have at least one item upon creation.');
    }
  }

  /**
   * Validates the supplier ID.
   * @param supplierId - The ID of the supplier.
   * @param isRequired - Indicates if the supplier is required.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateSupplier(
    supplierId: number | undefined | null,
    isRequired: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    if (supplierId) {
      const supplier = manager
        ? await manager.getRepository(Supplier).findOneBy({ id: supplierId, deletedAt: IsNull() })
        : await this.supplierRepository.findById(supplierId);
      if (!supplier) {
        throw new BadRequestError(`Supplier with ID ${supplierId} not found.`);
      }
    } else if (isRequired) {
      throw new BadRequestError('Supplier ID is required.');
    }
  }

  /**
   * Validates a warehouse ID.
   * @param warehouseId - The ID of the warehouse.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateWarehouse(warehouseId: number, manager?: EntityManager): Promise<void> {
    const warehouse = manager
      ? await manager.getRepository(Warehouse).findOneBy({ id: warehouseId, deletedAt: IsNull() })
      : await appDataSource.manager
          .getRepository(Warehouse)
          .findOneBy({ id: warehouseId, deletedAt: IsNull() });
    if (!warehouse) {
      throw new BadRequestError(`Warehouse with ID ${warehouseId} not found.`);
    }
  }

  /**
   * Validates a shop ID.
   * @param shopId - The ID of the shop.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateShop(shopId: number, manager?: EntityManager): Promise<void> {
    const shop = manager
      ? await manager.getRepository(Shop).findOneBy({ id: shopId, deletedAt: IsNull() })
      : await appDataSource.manager
          .getRepository(Shop)
          .findOneBy({ id: shopId, deletedAt: IsNull() });
    if (!shop) {
      throw new BadRequestError(`Shop with ID ${shopId} not found.`);
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
    } else if (!item.id) {
      throw new BadRequestError('Item is missing productId for new item.');
    }

    if (item.purchaseReceptionItemId) {
      await this.validateReceptionItem(
        item.purchaseReceptionItemId,
        item.productId,
        item.productVariantId,
        manager,
      );
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
   * Validates a purchase reception item ID.
   * @param purchaseReceptionItemId - The ID of the purchase reception item.
   * @param productId - The ID of the product associated with the item.
   * @param productVariantId - The ID of the product variant associated with the item.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateReceptionItem(
    purchaseReceptionItemId: number,
    productId: number,
    productVariantId: number | null,
    manager?: EntityManager,
  ): Promise<void> {
    const receptionItem = manager
      ? await manager
          .getRepository(PurchaseReceptionItem)
          .findOneBy({ id: purchaseReceptionItemId, deletedAt: IsNull() })
      : await this.receptionItemRepository.findById(purchaseReceptionItemId);

    if (!receptionItem) {
      throw new BadRequestError(`Purchase Reception Item ID ${purchaseReceptionItemId} not found.`);
    }
    if (receptionItem.productId !== productId) {
      throw new BadRequestError(
        `Product ID ${productId} in return item does not match product ID ${receptionItem.productId} of linked reception item ${purchaseReceptionItemId}.`,
      );
    }
    if (receptionItem.productVariantId !== productVariantId) {
      throw new BadRequestError(
        `Product Variant ID ${productVariantId} in return item does not match variant ID ${receptionItem.productVariantId} of linked reception item ${purchaseReceptionItemId}.`,
      );
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
   * Creates the header for a new supplier return.
   * @param input - The input data for the return.
   * @param createdByUserId - The ID of the user creating the return.
   * @param manager - The entity manager for transactional operations.
   * @returns The created SupplierReturn entity.
   */
  private async createReturnHeader(
    input: CreateSupplierReturnInput,
    createdByUserId: number,
    manager: EntityManager,
  ): Promise<SupplierReturn> {
    const repo = manager.getRepository(SupplierReturn);

    const { items, sourceWarehouseId, sourceShopId, shipDate, ...headerInput } = input;
    const returnData: Partial<SupplierReturn> = {
      ...headerInput,
      returnNumber: this.generateReturnNumber(),
      returnDate: input.returnDate ? dayjs(input.returnDate).toDate() : undefined,
      shipDate: shipDate ? dayjs(shipDate).toDate() : undefined,
      status: SupplierReturnStatus.REQUESTED,
      sourceWarehouseId: sourceWarehouseId,
      sourceShopId: sourceShopId,
      createdByUserId,
      updatedByUserId: createdByUserId,
    };

    const supplierReturn = repo.create(returnData);
    this.validateReturnEntity(supplierReturn);

    const savedReturn = await repo.save(supplierReturn);
    return savedReturn;
  }

  /**
   * Creates items for a supplier return.
   * @param itemInputs - An array of input data for return items.
   * @param returnId - The ID of the supplier return.
   * @param manager - The entity manager for transactional operations.
   * @returns An array of created SupplierReturnItem entities.
   */
  private async createReturnItems(
    itemInputs: CreateSupplierReturnItemInput[] | undefined,
    returnId: number,
    manager: EntityManager,
  ): Promise<SupplierReturnItem[]> {
    const repo = manager.getRepository(SupplierReturnItem);
    const items: SupplierReturnItem[] = [];

    if (!itemInputs || itemInputs.length === 0) {
      return [];
    }

    for (const itemInput of itemInputs) {
      const parsedItemInput = createSupplierReturnItemSchema.safeParse(itemInput);

      if (!parsedItemInput.success) {
        const errors = parsedItemInput.error.issues
          .map((issue) => `${issue.path.join('.') || 'Field'}: ${issue.message}`)
          .join('; ');
        logger.error(
          `[createReturnItems] Validation échouée pour l'élément de retour (Product ID: ${itemInput.productId || 'N/A'}). Erreurs: ${errors}`,
        );
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${errors}`,
        );
      }

      const item = repo.create({
        ...parsedItemInput.data,
        supplierReturnId: returnId,
      });

      if (!item.isValid()) {
        logger.error(
          `[createReturnItems] Validation échouée pour l'élément de retour (Product ID: ${itemInput.productId || 'N/A'}). Erreurs: ${supplierReturnItemValidationInputErrors.join('; ')}`,
        );
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${supplierReturnItemValidationInputErrors.join('; ')}`,
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
    input: UpdateSupplierReturnInput,
    status: SupplierReturnStatus,
  ): UpdateSupplierReturnInput {
    if (this.isReturnProcessed(status)) {
      return this.restrictUpdateFieldsForProcessedReturn(input);
    }
    return input;
  }

  /**
   * Checks if the return status indicates it has been processed (e.g., shipped, received, completed, refunded).
   * @param status - The status of the return.
   * @returns True if the return is processed, false otherwise.
   */
  private isReturnProcessed(status: SupplierReturnStatus): boolean {
    return [
      SupplierReturnStatus.SHIPPED_TO_SUPPLIER,
      SupplierReturnStatus.RECEIVED_BY_SUPPLIER,
      SupplierReturnStatus.CREDIT_EXPECTED,
      SupplierReturnStatus.REFUNDED,
      SupplierReturnStatus.CREDIT_NOTE_RECEIVED,
      SupplierReturnStatus.COMPLETED,
      SupplierReturnStatus.CANCELLED,
      SupplierReturnStatus.REJECTED_BY_SUPPLIER,
    ].includes(status);
  }

  /**
   * Restricts the fields that can be updated for a processed return.
   * @param input - The update input data.
   * @returns The restricted update input.
   */
  private restrictUpdateFieldsForProcessedReturn(
    input: UpdateSupplierReturnInput,
  ): UpdateSupplierReturnInput {
    const allowedFields = UPDATABLE_FIELDS_FOR_PROCESSED_RETURN;
    const restrictedInput: Partial<UpdateSupplierReturnInput> = {};

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
        `Cannot update most fields of a supplier return once it has been processed (e.g., shipped, completed, refunded). Only notes can be updated.`,
      );
    }

    return restrictedInput;
  }

  /**
   * Checks if return items can be updated based on the return status.
   * @param status - The current status of the return.
   * @returns True if items can be updated, false otherwise.
   */
  private canUpdateItems(status: SupplierReturnStatus): boolean {
    return [SupplierReturnStatus.REQUESTED, SupplierReturnStatus.APPROVED_BY_SUPPLIER].includes(
      status,
    );
  }

  /**
   * Updates the header information of a supplier return.
   * @param id - The ID of the supplier return to update.
   * @param input - The update input data.
   * @param userId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnHeader(
    id: number,
    input: UpdateSupplierReturnInput,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierReturn);
    const { items, ...headerInput } = input;

    const updateData = {
      ...headerInput,
      updatedByUserId: userId,
      ...(input.returnDate !== undefined && {
        returnDate: input.returnDate ? dayjs(input.returnDate).toDate() : undefined,
      }),
    };

    await repo.update(id, updateData);
  }

  /**
   * Updates the items associated with a supplier return.
   * This method soft-deletes existing items and recreates them based on the provided input.
   * @param returnId - The ID of the supplier return.
   * @param items - An array of return item data.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnItems(
    returnId: number,
    items: Array<Partial<CreateSupplierReturnItemInput> & { id?: string; _delete?: boolean }>,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(SupplierReturnItem);

    await repo.softDelete({ supplierReturnId: returnId });

    const newItems: SupplierReturnItem[] = [];
    for (const itemInput of items.filter((item) => !(item as any)._delete)) {
      const item: SupplierReturnItem = repo.create({
        ...itemInput,
        id: itemInput.id ? Number(itemInput.id) : undefined,
        supplierReturnId: returnId,
      });

      if (!item.isValid()) {
        logger.error(
          `[updateReturnItems] Validation échouée pour l'élément de retour (Product ID: ${itemInput.productId || 'N/A'}). Erreurs: ${supplierReturnItemValidationInputErrors.join('; ')}`,
        );
        throw new BadRequestError(
          `Invalid data for return item (Product ID: ${itemInput.productId || 'N/A'}). Errors: ${supplierReturnItemValidationInputErrors.join('; ')}`,
        );
      }
      newItems.push(item);
    }

    if (newItems.length > 0) {
      await repo.save(newItems);
    }
  }

  /**
   * Updates the status of a supplier return.
   * @param id - The ID of the supplier return to update.
   * @param newStatus - The new status for the return.
   * @param updatedByUserId - The ID of the user updating the status.
   * @param notes - Optional notes to add to the return.
   * @param additionalPayload - Optional additional fields to update on the return.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateReturnStatus(
    id: number,
    newStatus: SupplierReturnStatus,
    updatedByUserId: number,
    notes?: string | null,
    additionalPayload?: Partial<SupplierReturn>,
    manager?: EntityManager,
  ): Promise<void> {
    const updateData: Partial<SupplierReturn> = { status: newStatus, updatedByUserId };
    if (notes !== undefined) {
      let currentReturn: SupplierReturn | null;
      if (manager) {
        currentReturn = await manager.getRepository(SupplierReturn).findOneBy({ id });
      } else {
        currentReturn = await this.returnRepository.findById(id);
      }

      if (currentReturn) {
        updateData.notes = currentReturn.notes ? `${currentReturn.notes}\n${notes}` : notes;
      } else {
        updateData.notes = notes;
      }
    }
    if (additionalPayload) {
      Object.assign(updateData, additionalPayload);
    }

    if (manager) {
      await manager.getRepository(SupplierReturn).update(id, updateData);
    } else {
      await this.returnRepository.update(id, updateData);
    }
  }

  /**
   * Validates a status transition for a supplier return.
   * @param supplierReturn - The current supplier return.
   * @param newStatus - The new status to transition to.
   * @param userId - The ID of the user performing the transition.
   */
  private validateStatusTransition(
    supplierReturn: SupplierReturn,
    newStatus: SupplierReturnStatus,
    userId?: number,
  ): void {
    if (!Object.values(SupplierReturnStatus).includes(newStatus)) {
      throw new BadRequestError(`Invalid status: '${newStatus}'.`);
    }

    const currentStatus = supplierReturn.status;

    // Define allowed transitions
    const allowedTransitions: Record<SupplierReturnStatus, SupplierReturnStatus[]> = {
      [SupplierReturnStatus.REQUESTED]: [
        SupplierReturnStatus.APPROVED_BY_SUPPLIER,
        SupplierReturnStatus.REJECTED_BY_SUPPLIER,
        SupplierReturnStatus.CANCELLED,
      ],
      [SupplierReturnStatus.APPROVED_BY_SUPPLIER]: [
        SupplierReturnStatus.PENDING_SHIPMENT,
        SupplierReturnStatus.SHIPPED_TO_SUPPLIER,
        SupplierReturnStatus.CANCELLED,
      ],
      [SupplierReturnStatus.REJECTED_BY_SUPPLIER]: [],
      [SupplierReturnStatus.PENDING_SHIPMENT]: [
        SupplierReturnStatus.SHIPPED_TO_SUPPLIER,
        SupplierReturnStatus.CANCELLED,
      ],
      [SupplierReturnStatus.SHIPPED_TO_SUPPLIER]: [
        SupplierReturnStatus.RECEIVED_BY_SUPPLIER,
        SupplierReturnStatus.CREDIT_EXPECTED,
        SupplierReturnStatus.REFUNDED,
        SupplierReturnStatus.CREDIT_NOTE_RECEIVED,
        SupplierReturnStatus.COMPLETED,
      ],
      [SupplierReturnStatus.RECEIVED_BY_SUPPLIER]: [
        SupplierReturnStatus.CREDIT_EXPECTED,
        SupplierReturnStatus.REFUNDED,
        SupplierReturnStatus.CREDIT_NOTE_RECEIVED,
        SupplierReturnStatus.COMPLETED,
      ],
      [SupplierReturnStatus.CREDIT_EXPECTED]: [
        SupplierReturnStatus.REFUNDED,
        SupplierReturnStatus.CREDIT_NOTE_RECEIVED,
        SupplierReturnStatus.COMPLETED,
      ],
      [SupplierReturnStatus.REFUNDED]: [SupplierReturnStatus.COMPLETED],
      [SupplierReturnStatus.CREDIT_NOTE_RECEIVED]: [SupplierReturnStatus.COMPLETED],
      [SupplierReturnStatus.COMPLETED]: [],
      [SupplierReturnStatus.CANCELLED]: [],
    };

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      throw new BadRequestError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}' for return ID ${supplierReturn.id}.`,
      );
    }
  }

  /**
   * Validates if a supplier return can be deleted.
   * @param supplierReturn - The supplier return to validate.
   */
  private validateDeletion(supplierReturn: SupplierReturn): void {
    const deletableStatuses = [
      SupplierReturnStatus.REQUESTED,
      SupplierReturnStatus.REJECTED_BY_SUPPLIER,
      SupplierReturnStatus.CANCELLED,
    ];

    if (!deletableStatuses.includes(supplierReturn.status)) {
      throw new BadRequestError(
        `Supplier return in status '${supplierReturn.status}' cannot be deleted.`,
      );
    }
  }

  /**TODO
   * Validates that there are no processed financial transactions linked to the return before deletion.
   * @param returnId - The ID of the return to validate.
   */
  private validateNoProcessedTransactions(returnId: number): void {
    /*const isProcessed = await this.returnRepository.isReturnProcessedForCreditOrRefund(returnId);
    if (isProcessed) {
      throw new BadRequestError(
        `Return ${returnId} has been processed for credit/refund and cannot be deleted.`,
      );
    }*/
  }

  // Private processing methods
  /**
   * Processes the shipment of return items, including stock movements.
   * @param supplierReturn - The supplier return entity.
   * @param input - The shipping input data.
   * @param shippedByUserId - The ID of the user shipping the items.
   * @param manager - The entity manager for transactional operations.
   */
  private async processShippedItems(
    supplierReturn: SupplierReturn,
    input: ShipSupplierReturnInput,
    shippedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const itemRepoTx = manager.getRepository(SupplierReturnItem);

    for (const shipItemInput of input.items) {
      const itemToUpdate = supplierReturn.items?.find((i) => i.id === shipItemInput.id);
      if (!itemToUpdate) {
        throw new BadRequestError(`Return Item ID ${shipItemInput.id} not found in this return.`);
      }

      const quantityToShip = Number(shipItemInput.quantityShipped || 0);
      if (quantityToShip < 0) {
        throw new BadRequestError(
          `Quantity shipped for item ${itemToUpdate.id} cannot be negative.`,
        );
      }

      const remainingToShipOnItem =
        Number(itemToUpdate.quantity) - Number(itemToUpdate.quantityShipped || 0);
      if (quantityToShip > remainingToShipOnItem) {
        throw new BadRequestError(
          `Quantity shipped ${quantityToShip} for item ${itemToUpdate.id} (Product: ${itemToUpdate.product?.sku}) exceeds remaining expected quantity (${remainingToShipOnItem}).`,
        );
      }

      itemToUpdate.quantityShipped = Number(itemToUpdate.quantityShipped || 0) + quantityToShip;
      await itemRepoTx.save(itemToUpdate);

      const sourceWarehouseId = supplierReturn.sourceWarehouseId;
      const sourceShopId = supplierReturn.sourceShopId;

      if (!sourceWarehouseId && !sourceShopId) {
        throw new BadRequestError(
          'Cannot create stock movement: Neither sourceWarehouseId nor sourceShopId is specified for the return.',
        );
      }

      const stockMovementInput = {
        productId: itemToUpdate.productId,
        productVariantId: itemToUpdate.productVariantId,
        warehouseId: sourceWarehouseId,
        shopId: sourceShopId,
        movementType: StockMovementType.SUPPLIER_RETURN,
        quantity: -Math.abs(quantityToShip),
        movementDate: input.shipDate ? dayjs(input.shipDate).toDate() : new Date(),
        unitCostAtMovement: Number(itemToUpdate.unitPriceAtReturn),
        userId: shippedByUserId,
        referenceDocumentType: 'supplier_return',
        referenceDocumentId: supplierReturn.id.toString(),
      };

      await this.stockMovementService.createMovement(stockMovementInput, manager);
    }
  }

  /**
   * Processes the completion of a return, including financial transactions.
   * @param supplierReturn - The supplier return entity.
   * @param input - Completion input data.
   * @param completedByUserId - The ID of the user completing the return.
   * @param manager - The entity manager for transactional operations.
   */
  private async processReturnCompletion(
    supplierReturn: SupplierReturn,
    input: CompleteSupplierReturnInput,
    completedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!supplierReturn.items || supplierReturn.items.length === 0) {
      const populatedReturn = await this.returnRepository.findById(supplierReturn.id, {
        relations: ['items'],
        transactionalEntityManager: manager,
      });
      if (populatedReturn) {
        supplierReturn.items = populatedReturn.items;
      } else {
        throw new ServerError(`Failed to load items for return ${supplierReturn.id}.`);
      }
    }
  }

  /**
   * Maps a SupplierReturn entity to a SupplierReturnApiResponse.
   * @param supplierReturn - The SupplierReturn entity.
   * @returns The mapped SupplierReturnApiResponse or null if the input is null.
   */
  private mapToApiResponse(
    supplierReturn: SupplierReturn | null,
  ): SupplierReturnApiResponse | null {
    if (!supplierReturn) {
      return null;
    }
    return supplierReturn.toApi(true);
  }

  /**
   * Generates a unique return number.
   * @returns A promise that resolves to a unique return number string.
   */
  private generateReturnNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `SRA-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Validates the integrity of a SupplierReturn entity.
   * @param supplierReturn - The SupplierReturn entity to validate.
   */
  private validateReturnEntity(supplierReturn: SupplierReturn): void {
    if (!supplierReturn.isValid()) {
      throw new BadRequestError(
        `Supplier return data invalid: ${supplierReturnValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Returns an array of relations to be loaded with a supplier return for detailed responses.
   * @returns An array of relation strings.
   */
  private getDetailedRelations(): string[] {
    return [
      'supplier',
      'items',
      'items.product',
      'items.productVariant',
      'items.purchaseReceptionItem',
      'createdByUser',
      'updatedByUser',
      'shippedByUser',
      'sourceWarehouse',
      'sourceShop',
      'processedByUser',
    ];
  }

  /**
   * Returns an array of relations to be loaded with a supplier return for summary responses.
   * @returns An array of relation strings.
   */
  private getSummaryRelations(): string[] {
    return ['supplier', 'createdByUser', 'sourceWarehouse', 'sourceShop'];
  }

  /**
   * Retrieves an existing supplier return by ID.
   * @param id - The ID of the supplier return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The SupplierReturn entity.
   */
  private async getExistingReturn(id: number, manager?: EntityManager): Promise<SupplierReturn> {
    let supplierReturn;
    if (manager) {
      const repo = manager.getRepository(SupplierReturn);
      supplierReturn = await repo.findOne({ where: { id, deletedAt: IsNull() } });
    } else {
      supplierReturn = await this.returnRepository.findById(id);
    }
    if (!supplierReturn) {
      throw new NotFoundError(`Supplier return with id ${id} not found.`);
    }
    return supplierReturn;
  }

  /**
   * Retrieves a supplier return for update operations, including its items.
   * @param id - The ID of the supplier return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The SupplierReturn entity with relations.
   */
  private async getReturnForUpdate(id: number, manager?: EntityManager): Promise<SupplierReturn> {
    let supplierReturn;
    if (manager) {
      const repo = manager.getRepository(SupplierReturn);
      supplierReturn = await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: ['items'],
      });
    } else {
      supplierReturn = await this.returnRepository.findById(id, { relations: ['items'] });
    }
    if (!supplierReturn) {
      throw new NotFoundError(`Supplier return with ID ${id} not found.`);
    }
    return supplierReturn;
  }

  /**
   * Retrieves a supplier return for shipping operations, including its items and related entities for stock movements.
   * @param id - The ID of the supplier return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The SupplierReturn entity with relations.
   */
  private async getReturnForShipping(id: number, manager?: EntityManager): Promise<SupplierReturn> {
    let supplierReturn;
    const relations = [
      'items',
      'items.product',
      'items.productVariant',
      'sourceWarehouse',
      'sourceShop',
    ];
    if (manager) {
      const repo = manager.getRepository(SupplierReturn);
      supplierReturn = await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: relations,
      });
    } else {
      supplierReturn = await this.returnRepository.findById(id, { relations: relations });
    }
    if (!supplierReturn) {
      throw new NotFoundError(`Supplier Return ID ${id} not found.`);
    }
    return supplierReturn;
  }

  /**
   * Retrieves a populated supplier return response, including all detailed relations.
   * @param id - The ID of the supplier return.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The SupplierReturnApiResponse.
   */
  private async getPopulatedReturnResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<SupplierReturnApiResponse> {
    let supplierReturn;
    if (manager) {
      const repo = manager.getRepository(SupplierReturn);
      supplierReturn = await repo.findOne({
        where: { id },
        relations: this.getDetailedRelations(),
      });
    } else {
      supplierReturn = await this.returnRepository.findById(id, {
        relations: this.getDetailedRelations(),
      });
    }

    const apiResponse = this.mapToApiResponse(supplierReturn);
    if (!apiResponse) {
      logger.error(
        `[getPopulatedReturnResponse] mapToApiResponse returned null for return ID ${id}.`,
      );
      throw new ServerError(
        `Failed to map created supplier return to API response: return is null.`,
      );
    }
    return apiResponse;
  }

  static getInstance(): SupplierReturnService {
    instance ??= new SupplierReturnService();

    return instance;
  }
}
