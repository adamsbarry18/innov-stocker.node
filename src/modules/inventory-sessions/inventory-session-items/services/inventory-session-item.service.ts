import { appDataSource } from '@/database/data-source';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { InventorySessionItemRepository } from '../data/inventory-session-item.repository';

import {
  InventorySessionItem,
  type CreateOrUpdateInventorySessionItemInput,
  type InventorySessionItemApiResponse,
  createOrUpdateInventorySessionItemSchema,
  inventorySessionItemValidationInputErrors,
} from '../models/inventory-session-item.entity';
import { IsNull, type EntityManager } from 'typeorm';
import { InventorySessionRepository } from '../../data/inventory-session.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import {
  type InventorySession,
  InventorySessionStatus,
} from '../../models/inventory-session.entity';

let instance: InventorySessionItemService | null = null;

export class InventorySessionItemService {
  constructor(
    private readonly sessionRepository: InventorySessionRepository = new InventorySessionRepository(),
    private readonly itemRepository: InventorySessionItemRepository = new InventorySessionItemRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  private mapToApiResponse(
    item: InventorySessionItem | null,
  ): InventorySessionItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getSessionAndCheckStatus(
    sessionId: number,
    allowedStatuses: InventorySessionStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<InventorySession> {
    const session = await this.sessionRepository.findById(sessionId, {
      relations: ['warehouse', 'shop'],
      transactionalEntityManager,
    });
    if (!session) {
      throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);
    }
    if (!allowedStatuses.includes(session.status)) {
      throw new ForbiddenError(
        `Cannot modify items of an inventory session with status '${session.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    if (!session.warehouseId && !session.shopId) {
      throw new ServerError(
        `Inventory session ${sessionId} does not have a valid location (warehouse or shop).`,
      );
    }
    return session;
  }

  /**
   * Adds or updates an item in an inventory session.
   * Fetches theoretical quantity and unit cost for new items.
   * Calculates variance.
   */
  async addOrUpdateItem(
    inventorySessionId: number,
    input: CreateOrUpdateInventorySessionItemInput,
    userId: number, // For audit if InventorySessionItem has updatedByUserId
  ): Promise<InventorySessionItemApiResponse> {
    const validationResult = createOrUpdateInventorySessionItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid inventory item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const itemRepoTx = transactionalEntityManager.getRepository(InventorySessionItem);
      const session = await this.getSessionAndCheckStatus(
        inventorySessionId,
        [InventorySessionStatus.IN_PROGRESS, InventorySessionStatus.PENDING],
        transactionalEntityManager,
      );

      const product = await this.productRepository.findById(validatedInput.productId);
      if (!product)
        throw new BadRequestError(`Product with ID ${validatedInput.productId} not found.`);
      if (validatedInput.productVariantId) {
        const variant = await this.variantRepository.findById(validatedInput.productVariantId);
        if (!variant || variant.productId !== validatedInput.productId) {
          throw new BadRequestError(
            `Variant ID ${validatedInput.productVariantId} not valid for product ${validatedInput.productId}.`,
          );
        }
      }

      let itemEntity = await itemRepoTx.findOne({
        where: {
          inventorySessionId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId || IsNull(),
          deletedAt: IsNull(),
        },
      });

      if (itemEntity) {
        itemEntity.countedQuantity = validatedInput.counted_quantity;
        itemEntity.notes =
          validatedInput.notes !== undefined ? validatedInput.notes : itemEntity.notes;
        // itemEntity.updatedByUserId = userId; // If audit
      } else {
        const theoreticalQtyResult = await this.stockMovementService.getCurrentStock(
          validatedInput.productId,
          validatedInput.productVariantId || undefined,
          session.warehouseId || undefined,
          session.shopId || undefined,
          // session.startDate, // Stock à la date de début de session
        );
        const theoreticalQuantity = theoreticalQtyResult.quantity;

        const unitCostAtInventory = product.defaultPurchasePrice || 0;

        itemEntity = itemRepoTx.create({
          inventorySessionId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId || null,
          theoreticalQuantity: theoreticalQuantity,
          countedQuantity: validatedInput.counted_quantity,
          unitCostAtInventory: unitCostAtInventory,
          notes: validatedInput.notes,
          // createdByUserId: userId, // If audit
          // updatedByUserId: userId,
        });
      }

      itemEntity.calculateVariance();

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Inventory item data is invalid (internal check). Errors: ${inventorySessionItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);
      logger.info(
        `Item for product ${validatedInput.productId} in session ${inventorySessionId} ${itemEntity.id === savedItem.id ? 'updated' : 'added'}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map inventory session item.');
      return apiResponse;
    });
  }

  async getSessionItems(inventorySessionId: number): Promise<InventorySessionItemApiResponse[]> {
    await this.getSessionAndCheckStatus(inventorySessionId, [
      InventorySessionStatus.PENDING,
      InventorySessionStatus.IN_PROGRESS,
      InventorySessionStatus.COMPLETED,
      InventorySessionStatus.CANCELLED,
    ]);
    const items = await this.itemRepository.findBySessionId(inventorySessionId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as InventorySessionItemApiResponse[];
  }

  async getItemById(
    inventorySessionId: number,
    itemId: number,
  ): Promise<InventorySessionItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.inventorySessionId !== inventorySessionId) {
      throw new NotFoundError(
        `Inventory session item with ID ${itemId} not found for session ${inventorySessionId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map inventory session item.');
    return apiResponse;
  }

  // La suppression d'un item d'une session en cours est généralement autorisée
  async removeItemFromSession(
    inventorySessionId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const itemRepoTx = transactionalEntityManager.getRepository(InventorySessionItem);
      const session = await this.getSessionAndCheckStatus(
        inventorySessionId,
        [InventorySessionStatus.PENDING, InventorySessionStatus.IN_PROGRESS], // Seulement si pas complétée/annulée
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, inventorySessionId });
      if (!item) {
        throw new NotFoundError(
          `Inventory session item with ID ${itemId} not found for session ${inventorySessionId}.`,
        );
      }
      // Utiliser softDelete si Model le supporte et que c'est le comportement désiré
      // Sinon, remove pour suppression physique. Le SQL a deleted_time.
      await itemRepoTx.softDelete(itemId);
      // TODO: Mettre à jour updatedByUserId de la session parente ?
      logger.info(
        `Inventory session item ID ${itemId} removed from session ${inventorySessionId}.`,
      );
    });
  }

  static getInstance(): InventorySessionItemService {
    if (!instance) {
      instance = new InventorySessionItemService();
    }
    return instance;
  }
}
