import {
  StockTransferItem,
  type CreateStockTransferItemInput,
  type UpdateStockTransferItemInput,
  type StockTransferItemApiResponse,
  createStockTransferItemSchema,
  updateStockTransferItemSchema,
  stockTransferItemValidationInputErrors,
} from '../index';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type EntityManager, IsNull } from 'typeorm';
import { StockTransferRepository } from '../../data/stock-transfer.repository';
import { StockTransferItemRepository } from '../index';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { StockTransfer, StockTransferStatus } from '../../models/stock-transfer.entity';
import { appDataSource } from '@/database/data-source';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: StockTransferItemService | null = null;

export class StockTransferItemService {
  /**
   * Constructs a new StockTransferItemService instance.
   * @param transferRepository The repository for stock transfers.
   * @param itemRepository The repository for stock transfer items.
   * @param productRepository The repository for products.
   * @param variantRepository The repository for product variants.
   */
  constructor(
    private readonly transferRepository: StockTransferRepository = new StockTransferRepository(),
    private readonly itemRepository: StockTransferItemRepository = new StockTransferItemRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
  ) {}

  /**
   * Maps a StockTransferItem entity to its API response format.
   * @param item The StockTransferItem entity to map.
   * @returns The API response format of the stock transfer item, or null if the input is null.
   */
  private mapToApiResponse(item: StockTransferItem | null): StockTransferItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }
  /**
   * Retrieves a stock transfer and checks its status against allowed statuses.
   * @param transferId The ID of the stock transfer.
   * @param allowedStatuses An array of allowed stock transfer statuses.
   * @param transactionalEntityManager Optional entity manager for transactions.
   * @returns The found StockTransfer entity.
   */
  private async getTransferAndCheckStatus(
    transferId: number,
    allowedStatuses: StockTransferStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<StockTransfer> {
    const transfer = await this.transferRepository.findById(transferId, {
      relations: ['items', 'items.product', 'items.productVariant'],
      transactionalEntityManager,
    });
    if (!transfer) {
      throw new NotFoundError(`Stock Transfer with ID ${transferId} not found.`);
    }
    if (!allowedStatuses.includes(transfer.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a stock transfer with status '${transfer.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return transfer;
  }

  /**
   * Validates the product and product variant for a stock transfer item.
   * @param input An object containing the product ID and optional product variant ID.
   * @returns An object containing the product name and optional variant name.
   */
  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{ productName: string; variantName?: string | null }> {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${input.productId} not found for transfer item.`);

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
   * Adds an item to an existing stock transfer (if status allows).
   * Note: This method is less common; items are usually defined when creating the transfer.
   * It assumes the transfer itself is NOT yet shipped.
   */
  async addItemToTransfer(
    stockTransferId: number,
    input: CreateStockTransferItemInput,
  ): Promise<StockTransferItemApiResponse> {
    const validationResult = createStockTransferItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid stock transfer item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const transferRepoTx = transactionalEntityManager.getRepository(StockTransfer); // For updating parent
      const itemRepoTx = transactionalEntityManager.getRepository(StockTransferItem);

      const transfer = await this.getTransferAndCheckStatus(
        stockTransferId,
        [StockTransferStatus.PENDING], // Only allow adding items to PENDING transfers
        transactionalEntityManager,
      );

      await this.validateItemProductAndVariant(validatedInput);

      // Check for duplicate item (product/variant) in this transfer
      const existingItem = await itemRepoTx.findOne({
        where: {
          stockTransferId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId ?? IsNull(),
          deletedAt: IsNull(),
        },
      });
      if (existingItem) {
        throw new BadRequestError(
          `Product/Variant (ID: ${validatedInput.productId}/${validatedInput.productVariantId ?? 'N/A'}) already exists in this transfer (Item ID: ${existingItem.id}). Update its quantity instead.`,
        );
      }

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        stockTransferId,
        quantityShipped: 0, // Initialized, updated at shipping stage
        quantityReceived: 0, // Initialized, updated at receiving stage
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Stock transfer item data is invalid (internal check). Errors: ${stockTransferItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      // transfer.updatedByUserId = createdByUserId; // Audit for parent transfer update
      await transferRepoTx.save(transfer);

      logger.info(
        `Item (Product ID: ${validatedInput.productId}) added to Stock Transfer ${stockTransferId}. Item ID: ${savedItem.id}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created stock transfer item.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.INVENTORY_AND_FLOW,
        savedItem.id.toString(),
        {
          stockTransferId: stockTransferId,
          productId: savedItem.productId,
          quantityRequested: savedItem.quantityRequested,
        },
      );

      return apiResponse;
    });
  }

  /**
   * Retrieves all items for a given stock transfer.
   * @param stockTransferId The ID of the stock transfer.
   * @returns A promise that resolves to an array of stock transfer item API responses.
   */
  async getTransferItems(stockTransferId: number): Promise<StockTransferItemApiResponse[]> {
    await this.getTransferAndCheckStatus(stockTransferId, Object.values(StockTransferStatus));
    const items = await this.itemRepository.findByStockTransferId(stockTransferId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as StockTransferItemApiResponse[];
  }

  /**
   * Retrieves a specific stock transfer item by its ID within a given stock transfer.
   * @param stockTransferId The ID of the stock transfer.
   * @param itemId The ID of the stock transfer item.
   * @returns A promise that resolves to the stock transfer item API response.
   */
  async getItemById(
    stockTransferId: number,
    itemId: number,
  ): Promise<StockTransferItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.stockTransferId !== stockTransferId) {
      throw new NotFoundError(
        `Stock transfer item with ID ${itemId} not found for transfer ${stockTransferId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map stock transfer item.');
    return apiResponse;
  }

  /**
   * Updates an item in a stock transfer (e.g., quantityRequested).
   * Only allowed if the transfer is PENDING.
   */
  async updateItemInTransfer(
    stockTransferId: number,
    itemId: number,
    input: UpdateStockTransferItemInput,
    updatedByUserId: number,
  ): Promise<StockTransferItemApiResponse> {
    const validationResult = updateStockTransferItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const transferRepoTx = transactionalEntityManager.getRepository(StockTransfer);
      const itemRepoTx = transactionalEntityManager.getRepository(StockTransferItem);

      const transfer = await this.getTransferAndCheckStatus(
        stockTransferId,
        [StockTransferStatus.PENDING],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOne({ where: { id: itemId, stockTransferId } });
      if (!item) {
        throw new NotFoundError(
          `Stock transfer item with ID ${itemId} not found for transfer ${stockTransferId}.`,
        );
      }

      if (validatedInput.quantityRequested !== undefined)
        item.quantityRequested = validatedInput.quantityRequested;
      if (validatedInput.quantityShipped !== undefined) {
        logger.warn(
          `Attempt to update quantityShipped directly on item ${itemId}. This should be done via /ship endpoint on transfer.`,
        );
        // Potentially disallow or handle with care if status is PENDING
        if (transfer.status === StockTransferStatus.PENDING)
          item.quantityShipped = validatedInput.quantityShipped;
      }
      if (validatedInput.quantityReceived !== undefined) {
        logger.warn(
          `Attempt to update quantityReceived directly on item ${itemId}. This should be done via /receive endpoint on transfer.`,
        );
        // Potentially disallow or handle with care if status is PENDING/IN_TRANSIT
        if (
          transfer.status === StockTransferStatus.PENDING ||
          transfer.status === StockTransferStatus.IN_TRANSIT
        )
          item.quantityReceived = validatedInput.quantityReceived;
      }

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated stock transfer item data is invalid (internal check). Errors: ${stockTransferItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      transfer.updatedByUserId = updatedByUserId;
      await transferRepoTx.save(transfer);

      logger.info(
        `Stock Transfer item ID ${itemId} for transfer ${stockTransferId} updated successfully.`,
      );
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated stock transfer item.');

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.INVENTORY_AND_FLOW,
        itemId.toString(),
        {
          stockTransferId: stockTransferId,
          updatedFields: Object.keys(validatedInput),
        },
      );

      return apiResponse;
    });
  }

  /**
   * Removes an item from a stock transfer.
   * Only allowed if the transfer is PENDING.
   */
  async removeItemFromTransfer(
    stockTransferId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const transferRepoTx = transactionalEntityManager.getRepository(StockTransfer);
      const itemRepoTx = transactionalEntityManager.getRepository(StockTransferItem);

      const transfer = await this.getTransferAndCheckStatus(
        stockTransferId,
        [StockTransferStatus.PENDING],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, stockTransferId });
      if (!item) {
        throw new NotFoundError(
          `Stock transfer item with ID ${itemId} not found for transfer ${stockTransferId}.`,
        );
      }

      await itemRepoTx.softDelete(itemId);

      transfer.updatedByUserId = deletedByUserId;
      await transferRepoTx.save(transfer);

      logger.info(`Stock transfer item ID ${itemId} removed from transfer ${stockTransferId}.`);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.INVENTORY_AND_FLOW,
        itemId.toString(),
        { stockTransferId: stockTransferId },
      );
    });
  }

  /**
   * Returns a singleton instance of the StockTransferItemService.
   * @returns The singleton instance of StockTransferItemService.
   */
  static getInstance(): StockTransferItemService {
    instance ??= new StockTransferItemService();
    return instance;
  }
}
