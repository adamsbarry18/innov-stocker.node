import { ProductRepository } from '../../products/data/product.repository';
import {
  PurchaseReceptionItem,
  type CreatePurchaseReceptionItemInput,
  type UpdatePurchaseReceptionItemInput,
  type PurchaseReceptionItemApiResponse,
  createPurchaseReceptionItemSchema,
  updatePurchaseReceptionItemSchema,
  purchaseReceptionItemValidationInputErrors,
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
  PurchaseReception,
  PurchaseReceptionStatus,
} from '@/modules/purchase-receptions/models/purchase-reception.entity';
import { type FindOptionsWhere, IsNull, Not } from 'typeorm';
import dayjs from 'dayjs';
import { PurchaseOrderItem } from '@/modules/purchase-order-items/models/purchase-order-item.entity';
import { PurchaseOrder } from '@/modules/purchase-orders/models/purchase-order.entity';
import logger from '@/lib/logger';

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

  mapToApiResponse(item: PurchaseReceptionItem | null): PurchaseReceptionItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

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

  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{ productName: string; variantName?: string | null }> {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${input.productId} not found for item.`);

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

  async getItemsByReceptionId(
    purchaseReceptionId: number,
  ): Promise<PurchaseReceptionItemApiResponse[]> {
    // Ensure reception exists
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

  async getItemById(
    purchaseReceptionId: number,
    itemId: number,
  ): Promise<PurchaseReceptionItemApiResponse> {
    // Ensure reception exists and item belongs to it
    await this.getReceptionAndCheckStatus(purchaseReceptionId);

    try {
      const item = await this.itemRepository.findById(itemId);
      if (!item || item.purchaseReceptionId !== purchaseReceptionId) {
        throw new NotFoundError(
          `Purchase reception item with ID ${itemId} not found for reception ${purchaseReceptionId}.`,
        );
      }
      const apiResponse = this.mapToApiResponse(item);
      if (!apiResponse) throw new ServerError('Failed to map reception item.');
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

  // Note: Direct creation, update, deletion of items outside the parent PurchaseReceptionService context
  // might be complex due to the need to recalculate PO statuses, update POItem.quantityReceived,
  // and manage stock movements. These operations are typically part of the PurchaseReceptionService's
  // create/update methods for atomicity.
  // The methods below are stubs or simplified versions if direct item manipulation is truly needed.

  /**
   * Adds an item to an existing purchase reception.
   * WARNING: This method should be used with caution as it might not trigger all necessary
   * updates (like PO status or full stock movement logic) that are handled when items
   * are managed through the main PurchaseReceptionService.create/update methods.
   * It's primarily for scenarios where items are added to a reception that is still editable.
   */
  async addItemToReception(
    purchaseReceptionId: number,
    input: CreatePurchaseReceptionItemInput,
    createdByUserId: number, // For audit if needed
  ): Promise<PurchaseReceptionItemApiResponse> {
    const validationResult = createPurchaseReceptionItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      try {
        const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);
        const poItemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem); // For updating POItem.quantityReceived
        // const stockMovementService = new StockMovementService(transactionalEntityManager); // For stock updates

        const reception = await this.getReceptionAndCheckStatus(purchaseReceptionId, [
          PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
          PurchaseReceptionStatus.PARTIAL,
        ]);

        const { productName, variantName } =
          await this.validateItemProductAndVariant(validatedInput);

        // Check for duplicate item (product/variant from same PO line if applicable)
        const existingItemQuery: FindOptionsWhere<PurchaseReceptionItem> = {
          purchaseReceptionId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId || IsNull(),
          purchaseOrderItemId: validatedInput.purchaseOrderItemId || IsNull(),
        };
        const existingItem = await itemRepoTx.findOneBy(existingItemQuery);
        if (existingItem) {
          throw new BadRequestError(
            `This product/variant (from PO line ${validatedInput.purchaseOrderItemId || 'N/A'}) is already recorded in this reception.`,
          );
        }

        // Validate quantity against PO item if linked
        let poItem = null;
        if (validatedInput.purchaseOrderItemId) {
          poItem = await this.poItemRepository.findById(validatedInput.purchaseOrderItemId, {
            transactionalEntityManager,
          }); // Use this. for non-tx read
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
          const alreadyReceivedForPoItem = await itemRepoTx
            .createQueryBuilder('pri')
            .select('SUM(pri.quantityReceived)', 'totalReceived')
            .where('pri.purchaseOrderItemId = :poItemId', {
              poItemId: validatedInput.purchaseOrderItemId,
            })
            .andWhere('pri.purchaseReceptionId != :currentReceptionId', {
              currentReceptionId: purchaseReceptionId,
            }) // Exclude current reception if item is being updated
            .getRawOne();
          const totalPreviouslyReceived = Number(alreadyReceivedForPoItem?.totalReceived || 0);
          if (validatedInput.quantityReceived > Number(poItem.quantity) - totalPreviouslyReceived) {
            throw new BadRequestError(
              `Quantity received (${validatedInput.quantityReceived}) for PO item ${validatedInput.purchaseOrderItemId} exceeds remaining quantity to be received (${Number(poItem.quantity) - totalPreviouslyReceived}).`,
            );
          }
        }

        const itemEntity = itemRepoTx.create({
          ...validatedInput,
          purchaseReception: reception, // Using entity object
          // createdByUserId: createdByUserId, // If audit
        });
        if (!itemEntity.isValid()) {
          throw new BadRequestError(
            `Reception item data invalid: ${purchaseReceptionItemValidationInputErrors.join(', ')}`,
          );
        }

        const savedItem = await itemRepoTx.save(itemEntity);

        if (poItem) {
          poItem.quantityReceived =
            Number(poItem.quantityReceived) + Number(savedItem.quantityReceived);
          await poItemRepoTx.save(poItem);
        }

        // TODO: Dépendance - Create StockMovement
        // await stockMovementService.createMovement({ type: 'purchase_reception', ... });

        // TODO: Update PurchaseOrder status if all items are now received
        // This logic is better placed in PurchaseReceptionService when a reception is finalized/validated.

        const populatedItem = await this.itemRepository.findById(savedItem.id);
        const apiResponse = this.mapToApiResponse(populatedItem);
        if (!apiResponse) {
          throw new ServerError('Failed to map created reception item.');
        }
        return apiResponse;
      } catch (error) {
        logger.error(
          { message: `Error adding item to reception ${purchaseReceptionId}`, error, input },
          'PurchaseReceptionItemService.addItemToReception',
        ); // Modified log
        if (
          error instanceof BadRequestError ||
          error instanceof NotFoundError ||
          error instanceof ForbiddenError
        )
          throw error;
        throw new ServerError('Error adding item to reception.');
      }
    });
  }

  // Update and Delete for individual items are complex because they require:
  // - Recalculating parent PurchaseReception status/totals (if any)
  // - Reversing/adjusting StockMovements
  // - Reversing/adjusting PurchaseOrderItem.quantityReceived
  // - Re-evaluating PurchaseOrder status
  // These are typically handled by updating the parent PurchaseReception with a new set of items.
  // Providing direct PUT/DELETE on items can lead to inconsistencies if not handled carefully within transactions.
  // For now, these will be stubs or simplified.

  async updateItemInReception(
    purchaseReceptionId: number,
    itemId: number,
    input: UpdatePurchaseReceptionItemInput,
    updatedByUserId: number,
  ): Promise<PurchaseReceptionItemApiResponse> {
    const validationResult = updatePurchaseReceptionItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      try {
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);
        const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder); // For PO totals/status
        const poItemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem); // For POItem quantityReceived
        // const stockMovementService = new StockMovementService(transactionalEntityManager); // For stock updates

        const item = await itemRepoTx.findOne({
          where: { id: itemId, purchaseReceptionId },
          relations: ['product', 'productVariant', 'purchaseOrderItem'],
        });
        if (!item)
          throw new NotFoundError(
            `Reception item ID ${itemId} not found for reception ${purchaseReceptionId}.`,
          );

        const reception = await this.getReceptionAndCheckStatus(purchaseReceptionId, [
          PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
          PurchaseReceptionStatus.PARTIAL,
        ]); // Check status

        const oldQuantityReceived = Number(item.quantityReceived);

        // Apply updates
        if (validatedInput.quantityReceived !== undefined)
          item.quantityReceived = validatedInput.quantityReceived;
        if (validatedInput.lotNumber !== undefined) item.lotNumber = validatedInput.lotNumber;
        if (validatedInput.expiryDate !== undefined)
          item.expiryDate = validatedInput.expiryDate
            ? dayjs(validatedInput.expiryDate).toDate()
            : null;
        if (validatedInput.notes !== undefined) item.notes = validatedInput.notes;
        // item.updatedByUserId = updatedByUserId;

        if (!item.isValid()) throw new BadRequestError(`Updated reception item data invalid.`);

        // Validate quantity against PO item if linked
        if (item.purchaseOrderItemId) {
          const poItem = await this.poItemRepository.findById(item.purchaseOrderItemId); // Non-transactional read
          if (!poItem)
            throw new BadRequestError(`Linked PO Item ID ${item.purchaseOrderItemId} not found.`);

          // Calculate total received for this PO item *excluding the current item's old quantity*
          const otherItemsForPoLine = await itemRepoTx.find({
            where: { purchaseOrderItemId: item.purchaseOrderItemId, id: Not(itemId) },
          });
          const totalPreviouslyReceivedForPoItem = otherItemsForPoLine.reduce(
            (sum, i) => sum + Number(i.quantityReceived),
            0,
          );

          if (item.quantityReceived > Number(poItem.quantity) - totalPreviouslyReceivedForPoItem) {
            throw new BadRequestError(
              `New quantity received (${item.quantityReceived}) for PO item ${item.purchaseOrderItemId} exceeds remaining quantity (${Number(poItem.quantity) - totalPreviouslyReceivedForPoItem}).`,
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

        const populatedItem = await this.itemRepository.findById(savedItem.id);
        return this.mapToApiResponse(populatedItem) as PurchaseReceptionItemApiResponse;
      } catch (error) {
        if (
          error instanceof BadRequestError ||
          error instanceof NotFoundError ||
          error instanceof ForbiddenError
        )
          throw error;
        throw new ServerError('Error updating reception item.');
      }
    });
  }

  async removeItemFromReception(
    purchaseReceptionId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      try {
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);
        const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
        const poItemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);
        // const stockMovementService = new StockMovementService(transactionalEntityManager);

        const item = await itemRepoTx.findOne({
          where: { id: itemId, purchaseReceptionId },
          relations: ['purchaseOrderItem'],
        });
        if (!item)
          throw new NotFoundError(
            `Reception item ID ${itemId} not found for reception ${purchaseReceptionId}.`,
          );

        const reception = await this.getReceptionAndCheckStatus(purchaseReceptionId, [
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
      } catch (error) {
        logger.error(
          {
            message: `Error removing reception item ${itemId} from reception ${purchaseReceptionId}`,
            error,
          },
          'PurchaseReceptionItemService.removeItemFromReception',
        );
        if (
          error instanceof BadRequestError ||
          error instanceof NotFoundError ||
          error instanceof ForbiddenError
        )
          throw error;
        throw new ServerError('Error removing reception item.');
      }
    });
  }

  static getInstance(): PurchaseReceptionItemService {
    if (!instance) {
      instance = new PurchaseReceptionItemService();
    }
    return instance;
  }
}
