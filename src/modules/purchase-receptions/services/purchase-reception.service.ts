import { appDataSource } from '@/database/data-source';
import { SupplierRepository } from '../../suppliers/data/supplier.repository';
import { WarehouseRepository } from '../../warehouses/data/warehouse.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { StockMovementService } from '../../stock-movements/services/stock-movement.service';
import { v4 as uuidv4 } from 'uuid';
import {
  PurchaseReception,
  type CreatePurchaseReceptionInput,
  type UpdatePurchaseReceptionInput,
  type PurchaseReceptionApiResponse,
  PurchaseReceptionStatus,
} from '../models/purchase-reception.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import dayjs from 'dayjs';
import { PurchaseReceptionRepository } from '../data/purchase-reception.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/modules/purchase-orders/models/purchase-order.entity';
import {
  type FindManyOptions,
  type FindOptionsWhere,
  type EntityManager,
  type Repository,
} from 'typeorm';
import logger from '@/lib/logger';
import { PurchaseReceptionItemRepository } from '../purchase-reception-items/data/purchase-reception-item.repository';
import { PurchaseOrderItemRepository } from '@/modules/purchase-orders/purchase-order-items/data/purchase-order-item.repository';
import {
  type CreatePurchaseReceptionItemInput,
  PurchaseReceptionItem,
} from '../purchase-reception-items/models/purchase-reception-item.entity';
import { PurchaseOrderItem } from '@/modules/purchase-orders/purchase-order-items/models/purchase-order-item.entity';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';
import { purchaseReceptionValidationInputErrors } from '../models/purchase-reception.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: PurchaseReceptionService | null = null;

export class PurchaseReceptionService {
  private readonly receptionRepository: PurchaseReceptionRepository;
  private readonly receptionItemRepository: PurchaseReceptionItemRepository;
  private readonly orderItemRepository: PurchaseOrderItemRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly warehouseRepository: WarehouseRepository;
  private readonly shopRepository: ShopRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly stockMovementService: StockMovementService;

  constructor(
    receptionRepository: PurchaseReceptionRepository = new PurchaseReceptionRepository(),
    receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
    orderItemRepository: PurchaseOrderItemRepository = new PurchaseOrderItemRepository(),
    supplierRepository: SupplierRepository = new SupplierRepository(),
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {
    this.receptionRepository = receptionRepository;
    this.receptionItemRepository = receptionItemRepository;
    this.orderItemRepository = orderItemRepository;
    this.supplierRepository = supplierRepository;
    this.warehouseRepository = warehouseRepository;
    this.shopRepository = shopRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.stockMovementService = stockMovementService;
  }

  /**
   * Creates a new purchase reception.
   * @param input - The data for creating the reception.
   * @param createdByUserId - The ID of the user creating the reception.
   * @returns The created reception, formatted for API response.
   */
  async createReception(
    input: CreatePurchaseReceptionInput,
    createdByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      await this.validateCreateReceptionInput(input, transactionalEntityManager);

      const receptionData = this.buildReceptionData(input, createdByUserId);
      const newReception = transactionalEntityManager
        .getRepository(PurchaseReception)
        .create(receptionData);

      if (!newReception.isValid()) {
        throw new BadRequestError(
          `Invalid reception data: ${purchaseReceptionValidationInputErrors.join(', ')}`,
        );
      }

      const savedReception = await this.saveReceptionAndItems(
        newReception,
        input.items,
        transactionalEntityManager,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PROCUREMENT_PROCESS,
        savedReception.id.toString(),
        { receptionNumber: savedReception.receptionNumber },
      );

      return this.getReceptionResponse(savedReception.id, transactionalEntityManager);
    });
  }

  /**
   * Validates a reception, updates received quantities, and creates stock movements.
   * @param receptionId - The ID of the reception to validate.
   * @param validatedByUserId - The ID of the user performing the validation.
   * @returns The validated and updated reception.
   */
  async validateReception(
    receptionId: number,
    validatedByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const reception = await this.getReceptionForProcessing(
        receptionId,
        transactionalEntityManager,
      );

      // If the reception has no items, it cannot be validated for stock movements.
      // It can be created without items if it's in PENDING_QUALITY_CHECK, but not validated.
      if (!reception.items || reception.items.length === 0) {
        throw new BadRequestError(`Reception ID ${receptionId} has no items to validate.`);
      }

      for (const recItem of reception.items) {
        await this.updatePurchaseOrderItemQuantityReceived(
          recItem.purchaseOrderItemId,
          recItem.quantityReceived,
          transactionalEntityManager,
        );

        await this.createStockMovementForReceptionItem(
          recItem,
          reception,
          validatedByUserId,
          transactionalEntityManager,
        );
      }

      if (reception.purchaseOrderId) {
        await this.updatePurchaseOrderStatusAfterReception(
          reception.purchaseOrderId,
          validatedByUserId,
          transactionalEntityManager,
        );
      }

      reception.status = PurchaseReceptionStatus.COMPLETE;
      reception.updatedByUserId = validatedByUserId;
      await transactionalEntityManager.getRepository(PurchaseReception).save(reception);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.VALIDATE,
        EntityType.PROCUREMENT_PROCESS,
        receptionId.toString(),
        { receptionNumber: reception.receptionNumber },
      );

      return this.getReceptionResponse(receptionId, transactionalEntityManager);
    });
  }

  /**
   * Finds all purchase receptions based on provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing a list of purchase receptions and the total count.
   */
  async findAllReceptions(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<PurchaseReception> | FindOptionsWhere<PurchaseReception>[];
    sort?: FindManyOptions<PurchaseReception>['order'];
  }): Promise<{ receptions: PurchaseReceptionApiResponse[]; total: number }> {
    const { receptions, count } = await this.receptionRepository.findAll({
      where: options?.filters,
      skip: options?.offset,
      take: options?.limit,
      order: options?.sort,
    });
    const apiReceptions = receptions
      .map((r) => this.mapToApiResponse(r))
      .filter(Boolean) as PurchaseReceptionApiResponse[];
    return { receptions: apiReceptions, total: count };
  }

  /**
   * Finds a purchase reception by its ID.
   * @param id - The ID of the purchase reception.
   * @returns The found purchase reception, formatted for API response.
   */
  async findReceptionById(id: number): Promise<PurchaseReceptionApiResponse> {
    const reception = await this.receptionRepository.findById(id);
    if (!reception) throw new NotFoundError(`Purchase reception with id ${id} not found.`);
    return this.mapToApiResponse(reception) as PurchaseReceptionApiResponse;
  }

  /**
   * Updates an existing purchase reception.
   * @param id - The ID of the reception to update.
   * @param input - The update data for the reception.
   * @param updatedByUserId - The ID of the user performing the update.
   * @returns The updated reception, formatted for API response.
   */
  async updateReception(
    id: number,
    input: UpdatePurchaseReceptionInput,
    updatedByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    try {
      return await appDataSource.transaction(async (transactionalEntityManager) => {
        const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);

        const reception = await receptionRepoTx.findOne({
          where: { id },
          relations: ['items', 'items.product', 'items.productVariant'],
        });
        if (!reception) throw new NotFoundError(`Purchase reception with ID ${id} not found.`);

        await this.validateUpdateReceptionInput(input, id, transactionalEntityManager);

        const headerUpdatePayload: Partial<PurchaseReception> = { updatedByUserId };
        if (reception.status !== PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
          if (input.status && input.status !== reception.status) {
            throw new ForbiddenError(
              `Cannot change status from '${reception.status}' to '${input.status}' via generic update. Use specific actions.`,
            );
          }
          const allowedUpdatesForNonPending = ['notes', 'updatedByUserId'];
          const disallowedUpdates = Object.keys(input).filter(
            (key) => !allowedUpdatesForNonPending.includes(key),
          );

          if (disallowedUpdates.length > 0) {
            throw new ForbiddenError(
              `Cannot update fields ${disallowedUpdates.join(', ')} for reception ID ${id} because its status is '${reception.status}'. Only notes can be changed.`,
            );
          }
          if (input.notes !== undefined) {
            headerUpdatePayload.notes = input.notes;
          }
        } else {
          if (input.receptionDate)
            headerUpdatePayload.receptionDate = dayjs(input.receptionDate).toDate();
          if (input.hasOwnProperty('warehouseId'))
            headerUpdatePayload.warehouseId = input.warehouseId;
          if (input.hasOwnProperty('shopId')) headerUpdatePayload.shopId = input.shopId;
          if (input.hasOwnProperty('notes')) headerUpdatePayload.notes = input.notes;
          if (input.status) headerUpdatePayload.status = input.status;
        }

        await receptionRepoTx.update(id, headerUpdatePayload);

        if (input.items && reception.status === PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
          const existingItemMap = new Map(reception.items?.map((item) => [item.id, item]));
          await this.handleReceptionItemsUpdate(
            id,
            input.items,
            existingItemMap,
            itemRepoTx,
            transactionalEntityManager,
          );
        }

        const populatedReception = await receptionRepoTx.findOne({
          where: { id },
          relations: [
            'items',
            'items.product',
            'items.productVariant',
            'supplier',
            'warehouse',
            'shop',
            'receivedByUser',
            'purchaseOrder',
            'purchaseOrder.supplier',
          ],
        });
        if (!populatedReception)
          throw new ServerError(`Failed to retrieve updated reception ${id}.`);

        const apiResponse = this.mapToApiResponse(populatedReception);
        if (!apiResponse) throw new ServerError(`Failed to map updated reception ${id}.`);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.UPDATE,
          EntityType.PROCUREMENT_PROCESS,
          id.toString(),
          { updatedFields: Object.keys(input) },
        );

        return apiResponse;
      });
    } catch (error: any) {
      logger.error(`Unhandled error in updateReception for reception ID ${id}`, error);
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error updating reception ${id}. Details: ${error.message}`);
    }
  }

  /**
   * Deletes a purchase reception (soft delete).
   * @param id - The ID of the reception to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteReception(id: number): Promise<void> {
    const reception = await this.receptionRepository.findById(id, { relations: ['items'] });
    if (!reception) throw new NotFoundError(`Purchase reception with id ${id} not found.`);

    if (
      reception.status === PurchaseReceptionStatus.COMPLETE ||
      reception.status === PurchaseReceptionStatus.PARTIAL
    ) {
      throw new BadRequestError(
        `Cannot delete a reception that has been processed (status: ${reception.status}). Consider a supplier return or stock adjustment if items were incorrectly received and stock updated.`,
      );
    }
    // TODO: isReceptionLinkedToInvoice - Implement with SupplierInvoiceRepository
    // const isLinkedToInvoice = await this.receptionRepository.isReceptionLinkedToInvoice(id);
    // if (isLinkedToInvoice) {
    //   throw new BadRequestError(`Reception '${reception.receptionNumber}' is linked to a supplier invoice and cannot be deleted.`);
    // }

    try {
      await appDataSource.transaction(async (transactionalEntityManager) => {
        const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
        // If items are hard-deleted due to cascade on PurchaseReception soft-delete, this is fine.
        // If not, and items should also be soft-deleted:
        // const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);
        // await itemRepoTx.softDelete({ purchaseReceptionId: id });
        await receptionRepoTx.softDelete(id);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.DELETE,
          EntityType.PROCUREMENT_PROCESS,
          id.toString(),
        );
      });
    } catch (error) {
      logger.error(`Error deleting purchase reception ${id}`, error);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting purchase reception ${id}.`);
    }
  }

  /**
   * Maps a PurchaseReception entity to its API response format.
   * @param reception - The PurchaseReception entity.
   * @returns The formatted PurchaseReceptionApiResponse, or null if the input is null.
   */
  private mapToApiResponse(
    reception: PurchaseReception | null,
  ): PurchaseReceptionApiResponse | null {
    if (!reception) return null;
    return reception.toApi();
  }

  /**
   * Generates a unique reception number.
   * @returns A unique reception number string.
   */
  private generateReceptionNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `REC-${datePrefix}-${uuidv4().substring(0, 10)}`;
  }

  /**
   * Validates input data for creating a reception.
   * @param input - The reception input data.
   * @param manager - The EntityManager for database operations.
   */
  private async validateCreateReceptionInput(
    input: CreatePurchaseReceptionInput,
    manager: EntityManager,
  ): Promise<void> {
    await this.validatePurchaseOrderAndSupplier(input, manager);
    await this.validateReceptionLocation(input, false, manager);
    await this.validateReceptionItems(input.items, undefined, manager);
  }

  /**
   * Validates input data for updating a reception.
   * @param input - The reception input data.
   * @param receptionId - The ID of the reception to update.
   * @param manager - The EntityManager for database operations.
   */
  private async validateUpdateReceptionInput(
    input: UpdatePurchaseReceptionInput,
    receptionId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (
      ('purchaseOrderId' in input && input.purchaseOrderId !== undefined) ||
      ('supplierId' in input && input.supplierId !== undefined)
    ) {
      await this.validatePurchaseOrderAndSupplier(input, manager, true);
    }
    await this.validateReceptionLocation(input, true, manager);
    if (input.items) {
      await this.validateReceptionItems(input.items, receptionId, manager);
    }
  }

  /**
   * Validates the purchase order ID and supplier ID.
   * Ensures that if a purchase order ID is provided, it exists and matches the supplier ID if also provided.
   * Ensures that either a purchase order ID or a supplier ID is provided for creation.
   * @param input - The reception input data.
   * @param manager - The EntityManager for database operations.
   * @param isUpdate - Indicates if it's an update operation.
   */
  private async validatePurchaseOrderAndSupplier(
    input: CreatePurchaseReceptionInput | UpdatePurchaseReceptionInput,
    manager: EntityManager,
    isUpdate: boolean = false,
  ): Promise<void> {
    if ('purchaseOrderId' in input && input.purchaseOrderId) {
      const po = await manager
        .getRepository(PurchaseOrder)
        .findOneBy({ id: input.purchaseOrderId });
      if (!po) throw new NotFoundError(`Purchase Order ID ${input.purchaseOrderId} not found.`);
      if ('supplierId' in input && input.supplierId && po.supplierId !== input.supplierId) {
        throw new BadRequestError(
          `Supplier ID ${input.supplierId} does not match PO supplier ID ${po.supplierId}.`,
        );
      }
    } else if ('supplierId' in input && input.supplierId) {
      if (!(await this.supplierRepository.findById(input.supplierId))) {
        throw new NotFoundError(
          `Supplier with ID ${input.supplierId} not found for blind reception.`,
        );
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Either purchaseOrderId or supplierId is required for creation.');
    }
  }

  /**
   * Validates the reception location (warehouse or shop).
   * Ensures that either a warehouse ID or a shop ID is provided, but not both.
   * Ensures that the provided warehouse or shop exists.
   * @param input - The reception input data.
   * @param isUpdate - Indicates if it's an update operation.
   * @param manager - The EntityManager for database operations.
   */
  private async validateReceptionLocation(
    input: CreatePurchaseReceptionInput | UpdatePurchaseReceptionInput,
    isUpdate: boolean,
    manager: EntityManager,
  ): Promise<void> {
    if (input.warehouseId && input.shopId) {
      throw new BadRequestError('Provide either warehouseId or shopId, not both.');
    }
    if (input.warehouseId) {
      if (!(await this.warehouseRepository.findById(input.warehouseId))) {
        throw new NotFoundError(`Warehouse ID ${input.warehouseId} not found.`);
      }
    }
    if (input.shopId) {
      if (!(await this.shopRepository.findById(input.shopId))) {
        throw new NotFoundError(`Shop ID ${input.shopId} not found.`);
      }
    }
    if (!isUpdate && !input.warehouseId && !input.shopId) {
      throw new BadRequestError(
        'Either warehouseId or shopId must be provided as reception location.',
      );
    }
  }

  /**
   * Validates reception items.
   * Ensures that each item has a product ID, the product exists, and if a variant ID is provided, it's valid for the product.
   * Also checks if the quantity received for a purchase order item does not exceed the remaining quantity.
   * @param items - The reception items to validate.
   * @param receptionId - The ID of the reception (to exclude current reception items when calculating received quantities).
   * @param manager - The EntityManager for database operations.
   */
  private async validateReceptionItems(
    items:
      | Array<Omit<CreatePurchaseReceptionItemInput, 'purchaseReceptionId'>>
      | Array<Partial<CreatePurchaseReceptionItemInput> & { id?: number; _delete?: boolean }>,
    receptionId: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    for (const itemInput of items) {
      if ((itemInput as any)._delete) continue;

      const productId = itemInput.productId;
      const productVariantId = itemInput.productVariantId;

      if (!productId) {
        throw new BadRequestError('Reception item is missing productId.');
      }

      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${productId} not found for a reception item.`);
      }

      if (productVariantId) {
        const variant = await this.variantRepository.findById(productVariantId);
        if (!variant || variant.productId !== productId) {
          throw new BadRequestError(
            `Variant ID ${productVariantId} not valid for product ${productId}.`,
          );
        }
      }

      if (itemInput.purchaseOrderItemId) {
        const poItem = await this.orderItemRepository.findById(itemInput.purchaseOrderItemId);
        if (!poItem) {
          throw new NotFoundError(
            `Purchase Order Item ID ${itemInput.purchaseOrderItemId} not found.`,
          );
        }

        const totalReceivedForThisPoItemExcludingCurrent =
          await this.calculateTotalReceivedForPOItem(itemInput.purchaseOrderItemId, receptionId);

        const totalReceivedIncludingCurrentUpdate =
          totalReceivedForThisPoItemExcludingCurrent + Number(itemInput.quantityReceived);
        if (totalReceivedIncludingCurrentUpdate > Number(poItem.quantity)) {
          throw new BadRequestError(
            `Quantity received (${itemInput.quantityReceived}) for PO item ${itemInput.purchaseOrderItemId} exceeds remaining quantity (${Number(poItem.quantity) - totalReceivedForThisPoItemExcludingCurrent}).`,
          );
        }
      }
    }
  }

  /**
   * Saves the reception and its items within a transaction.
   * @param reception - The reception entity to save.
   * @param items - The reception items to save.
   * @param manager - The EntityManager for database operations.
   * @returns The saved reception with its items.
   */
  private async saveReceptionAndItems(
    reception: PurchaseReception,
    items: CreatePurchaseReceptionInput['items'],
    manager: EntityManager,
  ): Promise<PurchaseReception> {
    const savedHeader = await manager.getRepository(PurchaseReception).save(reception);

    if (items && items.length > 0) {
      const receptionItems = items.map((itemInput) =>
        manager.getRepository(PurchaseReceptionItem).create({
          ...itemInput,
          purchaseReceptionId: savedHeader.id,
        }),
      );
      await manager.getRepository(PurchaseReceptionItem).save(receptionItems);
      savedHeader.items = receptionItems;
    } else {
      savedHeader.items = [];
    }
    return savedHeader;
  }

  /**
   * Handles the update of reception items (add, modify, delete).
   * @param receptionId - The ID of the reception.
   * @param itemsInput - The input data for the items.
   * @param existingItemMap - A Map of existing items for this reception.
   * @param itemRepoTx - The repository for reception items within the transaction.
   * @param manager - The EntityManager for database operations.
   */
  private async handleReceptionItemsUpdate(
    receptionId: number,
    itemsInput: Array<
      Partial<CreatePurchaseReceptionItemInput> & { id?: number; _delete?: boolean }
    >,
    existingItemMap: Map<number, PurchaseReceptionItem>,
    itemRepoTx: Repository<PurchaseReceptionItem>,
    manager: EntityManager,
  ): Promise<void> {
    const itemsToCreate: PurchaseReceptionItem[] = [];
    const itemsToUpdate: PurchaseReceptionItem[] = [];
    const itemIdsToDelete: number[] = [];

    for (const itemInput of itemsInput) {
      if (itemInput._delete) {
        if (itemInput.id) {
          itemIdsToDelete.push(itemInput.id);
        }
        continue;
      }

      let itemEntity: PurchaseReceptionItem;
      const currentProductId = itemInput.productId;
      const currentProductVariantId = itemInput.productVariantId;

      if (itemInput.id) {
        const foundItem = existingItemMap.get(itemInput.id);
        if (!foundItem) {
          throw new NotFoundError(
            `Purchase reception item with ID ${itemInput.id} not found for reception ${receptionId}.`,
          );
        }
        itemEntity = foundItem;
        Object.assign(itemEntity, itemInput);
      } else {
        itemEntity = itemRepoTx.create(itemInput);
      }

      if (!currentProductId) {
        throw new BadRequestError('Item is missing productId.');
      }
      const product = await this.productRepository.findById(currentProductId);
      if (!product) {
        throw new NotFoundError(
          `Product with ID ${currentProductId} not found for a reception item.`,
        );
      }
      let variantName: string | undefined;
      if (currentProductVariantId) {
        const variant = await this.variantRepository.findById(currentProductVariantId);
        if (!variant || variant.productId !== currentProductId) {
          throw new BadRequestError(
            `Variant ID ${currentProductVariantId} not valid for product ${currentProductId}.`,
          );
        }
        variantName = variant.nameVariant;
      }

      itemEntity.productId = currentProductId;
      itemEntity.productVariantId = currentProductVariantId ?? null;
      itemEntity.purchaseReceptionId = receptionId;
      itemEntity.notes = itemInput.notes ?? variantName ?? product?.name;
      itemEntity.quantityOrdered = itemInput.purchaseOrderItemId
        ? Number((await this.orderItemRepository.findById(itemInput.purchaseOrderItemId))?.quantity)
        : (itemInput.quantityOrdered ?? null);

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Invalid data for reception item (Product ID: ${currentProductId}).`,
        );
      }

      if (itemEntity.id && existingItemMap.has(itemEntity.id)) {
        itemsToUpdate.push(itemEntity);
      } else {
        itemsToCreate.push(itemEntity);
      }
    }

    if (itemIdsToDelete.length > 0) {
      await itemRepoTx.delete(itemIdsToDelete);
    }
    if (itemsToUpdate.length > 0) {
      await itemRepoTx.save(itemsToUpdate);
    }
    if (itemsToCreate.length > 0) {
      await itemRepoTx.save(itemsToCreate);
    }
  }

  /**
   * Calculates the total quantity received for a given purchase order item, optionally excluding a specific reception.
   * @param purchaseOrderItemId - The ID of the purchase order item.
   * @param excludeReceptionId - The ID of a reception to exclude from the calculation.
   * @returns The total quantity received.
   */
  async calculateTotalReceivedForPOItem(
    purchaseOrderItemId: number,
    excludeReceptionId?: number,
  ): Promise<number> {
    const query = this.receptionItemRepository.createSumQuantityReceivedQuery(
      purchaseOrderItemId,
      excludeReceptionId,
    );
    const result = await query.getRawOne();
    return Number(result?.total || 0);
  }

  /**
   * Builds a partial PurchaseReception entity from input data.
   * @param input - The input data for creating the reception.
   * @param userId - The ID of the user creating/updating the reception.
   * @returns A partial PurchaseReception entity.
   */
  private buildReceptionData(
    input: CreatePurchaseReceptionInput,
    userId: number,
  ): Partial<PurchaseReception> {
    const { items, ...restInput } = input;
    return {
      ...restInput,
      receptionNumber: this.generateReceptionNumber(),
      receptionDate: dayjs(input.receptionDate).toDate(),
      status: input.status ?? PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
      receivedByUserId: userId,
      updatedByUserId: userId,
    };
  }

  /**
   * Retrieves a purchase reception for processing (validation).
   * Ensures the reception exists and is in PENDING_QUALITY_CHECK status.
   * @param receptionId - The ID of the reception to retrieve.
   * @param manager - The EntityManager for database operations.
   * @returns The PurchaseReception entity with related items and purchase order.
   */
  private async getReceptionForProcessing(
    receptionId: number,
    manager: EntityManager,
  ): Promise<PurchaseReception> {
    const reception = await manager.getRepository(PurchaseReception).findOne({
      where: { id: receptionId },
      relations: [
        'items',
        'items.product',
        'items.productVariant',
        'items.purchaseOrderItem',
        'purchaseOrder',
      ],
    });
    if (!reception) throw new NotFoundError(`Purchase Reception ID ${receptionId} not found.`);

    if (reception.status !== PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
      throw new BadRequestError(
        `Reception ID ${receptionId} is not in PENDING_QUALITY_CHECK status. Current: ${reception.status}`,
      );
    }
    return reception;
  }

  /**
   * Updates the quantity received for a purchase order item.
   * @param poItemId - The ID of the purchase order item.
   * @param receivedQty - The quantity received to add.
   * @param manager - The EntityManager for database operations.
   */
  private async updatePurchaseOrderItemQuantityReceived(
    poItemId: number | null,
    receivedQty: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!poItemId) return;

    const poItemRepo = manager.getRepository(PurchaseOrderItem);
    const poItem = await poItemRepo.findOneBy({ id: poItemId });
    if (poItem) {
      poItem.quantityReceived = Number(poItem.quantityReceived || 0) + Number(receivedQty);
      await poItemRepo.save(poItem);
    } else {
      logger.warn(`PO Item ID ${poItemId} linked to reception item not found during validation.`);
    }
  }

  /**
   * Creates a stock movement for a received purchase reception item.
   * @param recItem - The purchase reception item.
   * @param reception - The parent purchase reception.
   * @param userId - The ID of the user creating the movement.
   * @param manager - The EntityManager for database operations.
   */
  private async createStockMovementForReceptionItem(
    recItem: PurchaseReceptionItem,
    reception: PurchaseReception,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (recItem.quantityReceived <= 0) return;

    const unitCost =
      recItem.purchaseOrderItem?.unitPriceHt ?? recItem.product?.defaultPurchasePrice;

    try {
      await this.stockMovementService.createMovement(
        {
          productId: recItem.productId,
          productVariantId: recItem.productVariantId,
          warehouseId: reception.warehouseId,
          shopId: reception.shopId,
          movementType: StockMovementType.PURCHASE_RECEPTION,
          quantity: Number(recItem.quantityReceived),
          movementDate: reception.receptionDate,
          unitCostAtMovement: Number(unitCost),
          userId: userId,
          referenceDocumentType: 'purchase_reception',
          referenceDocumentId: reception.id.toString(),
          notes: `Reception of ${recItem.quantityReceived} units from PO #${reception.purchaseOrder?.orderNumber ?? 'N/A'}`,
        },
        manager,
      );
    } catch (error: any) {
      logger.error(
        `Error creating stock movement for reception item ${recItem.id}: ${error.message} - ${JSON.stringify(error)}`,
        error,
      );
      throw new BadRequestError(
        `Failed to create stock movement for item ${recItem.id}. Details: ${error.message}`,
      );
    }
  }

  /**
   * Updates the status of a purchase order after a reception.
   * Sets the PO status to FULLY_RECEIVED or PARTIALLY_RECEIVED based on item quantities.
   * @param poId - The ID of the purchase order.
   * @param userId - The ID of the user performing the update.
   * @param manager - The EntityManager for database operations.
   */
  private async updatePurchaseOrderStatusAfterReception(
    poId: number,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    const poRepo = manager.getRepository(PurchaseOrder);
    const po = await poRepo.findOne({ where: { id: poId }, relations: ['items'] });
    if (!po) return;

    let allItemsFullyReceived = true;
    if (!po.items || po.items.length === 0) {
      allItemsFullyReceived = false;
    } else {
      for (const poItem of po.items) {
        const updatedPoItem = await manager
          .getRepository(PurchaseOrderItem)
          .findOneBy({ id: poItem.id });
        if (
          !updatedPoItem ||
          Number(updatedPoItem.quantityReceived) < Number(updatedPoItem.quantity)
        ) {
          allItemsFullyReceived = false;
          break;
        }
      }
    }

    const newStatus = allItemsFullyReceived
      ? PurchaseOrderStatus.FULLY_RECEIVED
      : PurchaseOrderStatus.PARTIALLY_RECEIVED;
    if (po.status !== PurchaseOrderStatus.FULLY_RECEIVED && po.status !== newStatus) {
      po.status = newStatus;
      po.updatedByUserId = userId;
      await poRepo.save(po);
    }
  }

  /**
   * Retrieves a populated PurchaseReception entity and maps it to an API response.
   * @param receptionId - The ID of the reception to retrieve.
   * @param manager - The EntityManager for database operations.
   * @returns The populated PurchaseReceptionApiResponse.
   */
  private async getReceptionResponse(
    receptionId: number,
    manager: EntityManager,
  ): Promise<PurchaseReceptionApiResponse> {
    const populatedReception = await manager.getRepository(PurchaseReception).findOne({
      where: { id: receptionId },
      relations: [
        'items',
        'items.product',
        'items.productVariant',
        'supplier',
        'warehouse',
        'shop',
        'receivedByUser',
        'purchaseOrder',
        'purchaseOrder.supplier',
      ],
    });
    if (!populatedReception)
      throw new ServerError(`Failed to map validated reception ${receptionId}.`);
    return this.mapToApiResponse(populatedReception) as PurchaseReceptionApiResponse;
  }

  /**
   * Returns a singleton instance of the PurchaseReceptionService.
   * @returns The singleton instance.
   */
  static getInstance(): PurchaseReceptionService {
    instance ??= new PurchaseReceptionService();
    return instance;
  }
}
