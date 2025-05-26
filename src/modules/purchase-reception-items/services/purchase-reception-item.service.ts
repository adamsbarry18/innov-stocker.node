import { ProductRepository } from '../../products/data/product.repository';
import {
  PurchaseReceptionItem,
  type CreatePurchaseReceptionItemInput,
  type UpdatePurchaseReceptionItemInput,
  type PurchaseReceptionItemApiResponse,
  createPurchaseReceptionItemSchema,
  updatePurchaseReceptionItemSchema,
} from '../models/purchase-reception-item.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import { appDataSource } from '@/database/data-source';
import { PurchaseReceptionItemRepository } from '../data/purchase-reception-item.repository';
import { PurchaseReceptionRepository } from '@/modules/purchase-receptions/data/purchase-reception.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { PurchaseOrderItemRepository } from '@/modules/purchase-order-items/data/purchase-order-item.repository';
import {
  type PurchaseReception,
  PurchaseReceptionStatus,
} from '@/modules/purchase-receptions/models/purchase-reception.entity';
import dayjs from 'dayjs';
import { PurchaseOrderItem } from '@/modules/purchase-order-items/models/purchase-order-item.entity';
import logger from '@/lib/logger';
import { type EntityManager, IsNull } from 'typeorm';

let instance: PurchaseReceptionItemService | null = null;

export class PurchaseReceptionItemService {
  private readonly itemRepository: PurchaseReceptionItemRepository;
  private readonly receptionRepository: PurchaseReceptionRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly poItemRepository: PurchaseOrderItemRepository;

  constructor(
    itemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
    receptionRepository: PurchaseReceptionRepository = new PurchaseReceptionRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    poItemRepository: PurchaseOrderItemRepository = new PurchaseOrderItemRepository(),
  ) {
    this.itemRepository = itemRepository;
    this.receptionRepository = receptionRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.poItemRepository = poItemRepository;
  }

  /**
   * Maps a PurchaseReceptionItem entity to its API response format.
   * @param item The PurchaseReceptionItem entity.
   * @returns The API response format or null if the item is null.
   */
  mapToApiResponse(item: PurchaseReceptionItem | null): PurchaseReceptionItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  /**
   * Retrieves a PurchaseReception and checks its status against allowed statuses.
   * @param receptionId The ID of the purchase reception.
   * @param allowedStatuses Optional array of allowed statuses for modification.
   * @returns The PurchaseReception entity.
   */
  private async getReceptionAndCheckStatus(
    receptionId: number,
    allowedStatuses?: PurchaseReceptionStatus[],
  ): Promise<PurchaseReception> {
    const reception = await this.receptionRepository.findById(receptionId, {
      relations: ['items'],
    });
    if (!reception) {
      throw new NotFoundError(`Purchase Reception with ID ${receptionId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(reception.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a purchase reception with status '${reception.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return reception;
  }

  /**
   * Validates the product and product variant IDs for an item.
   * @param input Contains productId and optional productVariantId.
   * @returns An object with product name and variant name (if applicable).
   */
  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{ productName: string; variantName?: string | null }> {
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new BadRequestError(`Product with ID ${input.productId} not found for item.`);
    }

    let variantName: string | null = null;
    if (input.productVariantId) {
      const variant = await this.variantRepository.findById(input.productVariantId);
      if (!variant || variant.productId !== input.productId) {
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
        );
      }
      variantName = variant.nameVariant;
    }
    return { productName: product.name, variantName };
  }

  /**
   * Retrieves all items for a given purchase reception.
   * @param purchaseReceptionId The ID of the purchase reception.
   * @returns An array of PurchaseReceptionItemApiResponse.
   */
  async getItemsByReceptionId(
    purchaseReceptionId: number,
  ): Promise<PurchaseReceptionItemApiResponse[]> {
    await this.getReceptionAndCheckStatus(purchaseReceptionId);

    try {
      const items = await this.itemRepository.findByReceptionId(purchaseReceptionId);
      return items
        .map((item) => this.mapToApiResponse(item))
        .filter(Boolean) as PurchaseReceptionItemApiResponse[];
    } catch (error) {
      logger.error({ message: `Error finding items for reception ${purchaseReceptionId}`, error });
      throw new ServerError('Error finding reception items.');
    }
  }

  /**
   * Retrieves a specific item by its ID and associated purchase reception ID.
   * @param purchaseReceptionId The ID of the purchase reception.
   * @param itemId The ID of the item.
   * @returns The PurchaseReceptionItemApiResponse.
   */
  async getItemById(
    purchaseReceptionId: number,
    itemId: number,
  ): Promise<PurchaseReceptionItemApiResponse> {
    await this.getReceptionAndCheckStatus(purchaseReceptionId); // Ensure reception exists

    try {
      const item = await this.itemRepository.findById(itemId);
      if (!item || item.purchaseReceptionId !== purchaseReceptionId) {
        throw new NotFoundError(
          `Purchase reception item with ID ${itemId} not found for reception ${purchaseReceptionId}.`,
        );
      }
      const apiResponse = this.mapToApiResponse(item);
      if (!apiResponse) {
        throw new ServerError('Failed to map reception item.');
      }
      return apiResponse;
    } catch (error) {
      logger.error({
        message: `Error finding reception item ${itemId} for reception ${purchaseReceptionId}`,
        error,
      });
      if (error instanceof NotFoundError) throw error;
      throw new ServerError('Error finding reception item.');
    }
  }

  /**
   * Adds an item to an existing purchase reception within a transaction.
   * This method handles validation, duplicate checks, and updates to linked Purchase Order Items.
   * It should be called within a broader transaction if part of a larger workflow (e.g., creating a reception).
   * @param purchaseReceptionId The ID of the purchase reception.
   * @param input The data for the new purchase reception item.
   * @param createdByUserId The ID of the user creating the item (for audit).
   * @param transactionalEntityManager Optional TypeORM EntityManager for transaction chaining.
   * @returns The created PurchaseReceptionItemApiResponse.
   */
  async addItemToReception(
    purchaseReceptionId: number,
    input: CreatePurchaseReceptionItemInput,
    createdByUserId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<PurchaseReceptionItemApiResponse> {
    const validationResult = createPurchaseReceptionItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    const executeInTransaction = async (manager: EntityManager) => {
      const itemRepoTx = manager.getRepository(PurchaseReceptionItem);
      const poItemRepoTx = manager.getRepository(PurchaseOrderItem);

      const reception = await this.getReceptionAndCheckStatus(purchaseReceptionId, [
        PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
        PurchaseReceptionStatus.PARTIAL,
      ]);
      await this.validateItemProductAndVariant(validatedInput);

      // Check for duplicate item (product/variant from same PO line if applicable)
      const existingItem = await itemRepoTx.findOne({
        where: {
          purchaseReceptionId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId || IsNull(),
          purchaseOrderItemId: validatedInput.purchaseOrderItemId || IsNull(),
        },
      });
      if (existingItem) {
        throw new BadRequestError(
          `This product/variant (from PO line ${validatedInput.purchaseOrderItemId || 'N/A'}) is already recorded in this reception.`,
        );
      }

      let poItem: PurchaseOrderItem | null = null;
      if (validatedInput.purchaseOrderItemId) {
        poItem = await poItemRepoTx.findOne({
          where: { id: validatedInput.purchaseOrderItemId },
        });
        if (!poItem) {
          throw new BadRequestError(
            `Purchase Order Item ID ${validatedInput.purchaseOrderItemId} not found.`,
          );
        }
        if (poItem.purchaseOrderId !== reception.purchaseOrderId) {
          throw new BadRequestError(
            `PO Item ID ${validatedInput.purchaseOrderItemId} does not belong to PO ID ${reception.purchaseOrderId}.`,
          );
        }

        const totalPreviouslyReceived = await this.itemRepository
          .createSumQuantityReceivedQuery(validatedInput.purchaseOrderItemId, purchaseReceptionId)
          .getRawOne();

        const currentTotalReceived = Number(totalPreviouslyReceived?.total || 0);
        const remainingQuantity = Number(poItem.quantity) - currentTotalReceived;

        if (validatedInput.quantityReceived > remainingQuantity) {
          throw new BadRequestError(
            `Quantity received (${validatedInput.quantityReceived}) for PO item ${validatedInput.purchaseOrderItemId} exceeds remaining quantity to be received (${remainingQuantity}).`,
          );
        }
      }

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        purchaseReceptionId: reception.id,
        // createdBy: createdByUserId, // Removed as 'createdBy' is not on the entity
      });

      // Zod validation is already done, isValid() on entity might be redundant if Zod is comprehensive
      // if (!itemEntity.isValid()) {
      //   throw new BadRequestError(`Reception item data invalid: ${purchaseReceptionItemValidationInputErrors.join(', ')}`);
      // }

      const savedItem = await itemRepoTx.save(itemEntity);

      if (poItem) {
        poItem.quantityReceived =
          Number(poItem.quantityReceived) + Number(savedItem.quantityReceived);
        await poItemRepoTx.save(poItem);
      }

      // TODO: Dépendance - Create StockMovement (This should ideally be handled by a dedicated StockMovementService)
      // Example: await new StockMovementService(manager).createMovement({ type: 'purchase_reception', ... });

      // TODO: Update PurchaseOrder status if all items are now received
      // This logic is better placed in PurchaseReceptionService when a reception is finalized/validated.

      // Re-fetch the item with relations for the API response
      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: this.itemRepository.getDefaultRelations(),
      });

      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) {
        throw new ServerError('Failed to map created reception item.');
      }
      return apiResponse;
    };

    if (transactionalEntityManager) {
      return await executeInTransaction(transactionalEntityManager);
    } else {
      return await appDataSource.transaction(executeInTransaction);
    }
  }

  /**
   * Updates an existing item in a purchase reception within a transaction.
   * This method handles validation, quantity adjustments, and updates to linked Purchase Order Items.
   * @param purchaseReceptionId The ID of the purchase reception.
   * @param itemId The ID of the item to update.
   * @param input The update data for the item.
   * @param updatedByUserId The ID of the user updating the item (for audit).
   * @param transactionalEntityManager Optional TypeORM EntityManager for transaction chaining.
   * @returns The updated PurchaseReceptionItemApiResponse.
   */
  async updateItemInReception(
    purchaseReceptionId: number,
    itemId: number,
    input: UpdatePurchaseReceptionItemInput,
    updatedByUserId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<PurchaseReceptionItemApiResponse> {
    const validationResult = updatePurchaseReceptionItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    const executeInTransaction = async (manager: EntityManager) => {
      const itemRepoTx = manager.getRepository(PurchaseReceptionItem);
      const poItemRepoTx = manager.getRepository(PurchaseOrderItem);

      const item = await itemRepoTx.findOne({
        where: { id: itemId, purchaseReceptionId },
        relations: ['product', 'productVariant', 'purchaseOrderItem'],
      });
      if (!item) {
        throw new NotFoundError(
          `Reception item ID ${itemId} not found for reception ${purchaseReceptionId}.`,
        );
      }

      await this.getReceptionAndCheckStatus(purchaseReceptionId, [
        PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
        PurchaseReceptionStatus.PARTIAL,
      ]);

      const oldQuantityReceived = Number(item.quantityReceived);

      // Apply updates
      if (validatedInput.quantityReceived !== undefined) {
        item.quantityReceived = validatedInput.quantityReceived;
      }
      if (validatedInput.lotNumber !== undefined) {
        item.lotNumber = validatedInput.lotNumber;
      }
      if (validatedInput.expiryDate !== undefined) {
        item.expiryDate = validatedInput.expiryDate
          ? dayjs(validatedInput.expiryDate).toDate()
          : null;
      }
      if (validatedInput.notes !== undefined) {
        item.notes = validatedInput.notes;
      }
      // item.updatedBy = updatedByUserId; // Removed as 'updatedBy' is not on the entity

      if (item.purchaseOrderItemId) {
        const poItem = await poItemRepoTx.findOne({ where: { id: item.purchaseOrderItemId } });
        if (!poItem) {
          throw new BadRequestError(`Linked PO Item ID ${item.purchaseOrderItemId} not found.`);
        }

        const totalPreviouslyReceivedForPoItem = await this.itemRepository
          .createSumQuantityReceivedQuery(item.purchaseOrderItemId, itemId)
          .getRawOne();

        const currentTotalReceived = Number(totalPreviouslyReceivedForPoItem?.total || 0);
        const remainingQuantity = Number(poItem.quantity) - currentTotalReceived;

        if (item.quantityReceived > remainingQuantity) {
          throw new BadRequestError(
            `New quantity received (${item.quantityReceived}) for PO item ${item.purchaseOrderItemId} exceeds remaining quantity (${remainingQuantity}).`,
          );
        }
      }

      const savedItem = await itemRepoTx.save(item);
      const quantityChange = Number(savedItem.quantityReceived) - oldQuantityReceived;

      if (item.purchaseOrderItemId && quantityChange !== 0) {
        await poItemRepoTx.increment(
          { id: item.purchaseOrderItemId },
          'quantityReceived',
          quantityChange,
        );
      }

      // TODO: Dépendance - Adjust StockMovement if quantity changed

      // Re-fetch the item with relations for the API response
      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: this.itemRepository.getDefaultRelations(),
      });
      return this.mapToApiResponse(populatedItem) as PurchaseReceptionItemApiResponse;
    };

    if (transactionalEntityManager) {
      return await executeInTransaction(transactionalEntityManager);
    } else {
      return await appDataSource.transaction(executeInTransaction);
    }
  }

  /**
   * Removes an item from a purchase reception within a transaction.
   * This method handles quantity adjustments on linked Purchase Order Items.
   * @param purchaseReceptionId The ID of the purchase reception.
   * @param itemId The ID of the item to remove.
   * @param deletedByUserId The ID of the user deleting the item (for audit).
   * @param transactionalEntityManager Optional TypeORM EntityManager for transaction chaining.
   */
  async removeItemFromReception(
    purchaseReceptionId: number,
    itemId: number,
    deletedByUserId: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<void> {
    const executeInTransaction = async (manager: EntityManager) => {
      const itemRepoTx = manager.getRepository(PurchaseReceptionItem);
      const poItemRepoTx = manager.getRepository(PurchaseOrderItem);

      const item = await itemRepoTx.findOne({
        where: { id: itemId, purchaseReceptionId },
        relations: ['purchaseOrderItem'],
      });
      if (!item) {
        throw new NotFoundError(
          `Reception item ID ${itemId} not found for reception ${purchaseReceptionId}.`,
        );
      }

      await this.getReceptionAndCheckStatus(purchaseReceptionId, [
        PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
        PurchaseReceptionStatus.PARTIAL,
      ]);

      const quantityReversed = Number(item.quantityReceived);

      await itemRepoTx.remove(item);

      if (item.purchaseOrderItemId && quantityReversed > 0) {
        await poItemRepoTx.decrement(
          { id: item.purchaseOrderItemId },
          'quantityReceived',
          quantityReversed,
        );
      }
      // TODO: Dépendance - Reverse StockMovement
    };

    if (transactionalEntityManager) {
      await executeInTransaction(transactionalEntityManager);
    } else {
      await appDataSource.transaction(executeInTransaction);
    }
  }

  /**
   * Returns a singleton instance of PurchaseReceptionItemService.
   * @returns The singleton instance.
   */
  static getInstance(): PurchaseReceptionItemService {
    if (!instance) {
      instance = new PurchaseReceptionItemService();
    }
    return instance;
  }
}
