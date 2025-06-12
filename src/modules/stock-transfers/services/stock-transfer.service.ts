import { appDataSource } from '@/database/data-source';
import { IsNull, type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';
import { WarehouseRepository } from '@/modules/warehouses/data/warehouse.repository';
import { ShopRepository } from '@/modules/shops/data/shop.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { UserRepository } from '@/modules/users/data/users.repository';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';

import {
  StockTransfer,
  type CreateStockTransferInput,
  type UpdateStockTransferInput,
  type ShipStockTransferInput,
  type ReceiveStockTransferInput,
  type StockTransferApiResponse,
  StockTransferStatus,
  stockTransferValidationInputErrors,
} from '../models/stock-transfer.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { StockTransferRepository } from '../data/stock-transfer.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { Warehouse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop } from '@/modules/shops/models/shop.entity';
import { Product } from '@/modules/products/models/product.entity';
import { ProductVariant } from '@/modules/product-variants/models/product-variant.entity';
import {
  type CreateStockTransferItemInput,
  StockTransferItem,
  stockTransferItemValidationInputErrors,
} from '../stock-transfer-items/models/stock-transfer-item.entity';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';
import { User } from '@/modules/users';
import { v4 as uuidv4 } from 'uuid';
interface ValidationContext {
  isUpdate: boolean;
  transferId?: number;
  transactionalEntityManager?: EntityManager;
}

let instance: StockTransferService | null = null;

export class StockTransferService {
  constructor(
    private readonly transferRepository: StockTransferRepository = new StockTransferRepository(),
    private readonly warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    private readonly shopRepository: ShopRepository = new ShopRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  // Public Methods

  /**
   * Creates a new stock transfer.
   * @param input - The data to create the stock transfer.
   * @param requestedByUserId - The ID of the user requesting the transfer.
   * @returns The API response of the created stock transfer.
   */
  async createStockTransfer(
    input: CreateStockTransferInput,
    requestedByUserId: number,
  ): Promise<StockTransferApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        await this.validateTransferInput(input, {
          isUpdate: false,
          transactionalEntityManager: manager,
        });

        await this.validateUser(requestedByUserId, manager);

        const transferHeader = await this.createTransferHeader(input, requestedByUserId, manager);
        await this.createTransferItems(input.items, transferHeader.id, manager);

        return await this.getPopulatedTransferResponse(transferHeader.id, manager);
      } catch (error: any) {
        logger.error(`Error creating stock transfer: ${error.message}`, {
          error,
          requestedByUserId,
        });
        throw error;
      }
    });
  }

  /**
   * Retrieves a stock transfer by its ID.
   * @param id - The ID of the stock transfer.
   * @param includeItems - Indicates whether items should be included in the response.
   * @returns The API response of the stock transfer.
   */
  async findStockTransferById(
    id: number,
    includeItems: boolean = true,
  ): Promise<StockTransferApiResponse> {
    try {
      const relations = includeItems ? this.getDetailedRelations() : this.getDefaultRelations();
      const transfer = await this.transferRepository.findById(id, { relations });
      if (!transfer) throw new NotFoundError(`Stock transfer with ID ${id} not found.`);

      const apiResponse = this.mapToApiResponse(transfer, includeItems);
      if (!apiResponse) throw new ServerError(`Failed to convert stock transfer ${id}.`);
      return apiResponse;
    } catch (error: any) {
      logger.error(`Error finding stock transfer ${id}: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Retrieves all stock transfers based on the provided options.
   * @param options - Options for filtering, sorting, and pagination.
   * @returns An object containing the list of transfers and the total count.
   */
  async findAllStockTransfers(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<StockTransfer>;
    sort?: FindManyOptions<StockTransfer>['order'];
  }): Promise<{ transfers: StockTransferApiResponse[]; total: number }> {
    try {
      const { transfers, count } = await this.transferRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { requestDate: 'DESC', createdAt: 'DESC' },
        relations: this.getDefaultRelations(),
      });

      const apiTransfers = transfers
        .map((t) => this.mapToApiResponse(t, false))
        .filter(Boolean) as StockTransferApiResponse[];
      return { transfers: apiTransfers, total: count };
    } catch (error: any) {
      logger.error(`Error retrieving stock transfers: ${error.message}`, {
        error,
      });
      throw new ServerError('Error retrieving stock transfers.');
    }
  }

  /**
   * Updates an existing stock transfer.
   * @param id - The ID of the stock transfer to update.
   * @param input - The data for the update.
   * @param updatedByUserId - The ID of the user performing the update.
   * @returns The API response of the updated transfer.
   */
  async updateStockTransfer(
    id: number,
    input: UpdateStockTransferInput,
    updatedByUserId: number,
  ): Promise<StockTransferApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        const transfer = await this.getTransferForUpdate(id, manager);
        if (transfer.status !== StockTransferStatus.PENDING) {
          throw new ForbiddenError(
            `Cannot update a transfer that is not in PENDING status. Current status: ${transfer.status}`,
          );
        }

        await this.validateTransferInput(input, {
          isUpdate: true,
          transferId: id,
          transactionalEntityManager: manager,
        });

        await this.updateTransferHeader(id, input, updatedByUserId, manager);

        if (input.items) {
          await this.updateTransferItems(id, input.items, manager);
        }

        return await this.getPopulatedTransferResponse(id, manager);
      } catch (error: any) {
        logger.error(`Error updating stock transfer ${id}: ${JSON.stringify(error)}`, {
          id,
          updatedByUserId,
        });
        throw error;
      }
    });
  }

  /**
   * Ships a stock transfer.
   * @param transferId - The ID of the transfer to ship.
   * @param input - The shipping data.
   * @param shippedByUserId - The ID of the user who ships.
   * @returns The API response of the shipped transfer.
   */
  async shipStockTransfer(
    transferId: number,
    input: ShipStockTransferInput,
    shippedByUserId: number,
  ): Promise<StockTransferApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        const transfer = await this.getTransferForShipping(transferId, manager);
        if (transfer.status !== StockTransferStatus.PENDING) {
          throw new BadRequestError(
            `Transfer ID ${transferId} is not in PENDING status. Current status: ${transfer.status}`,
          );
        }
        if (!input.items?.length) {
          throw new BadRequestError('At least one item must be shipped.');
        }

        await this.processShipment(transfer, input, shippedByUserId, manager);
        await this.updateTransferStatusToInTransit(transfer, input, shippedByUserId, manager);

        return await this.getPopulatedTransferResponse(transferId, manager);
      } catch (error: any) {
        logger.error(`Error shipping transfer ${transferId}: ${JSON.stringify(error)}`, {
          error,
          transferId,
          shippedByUserId,
        });
        throw error;
      }
    });
  }

  /**
   * Receives a stock transfer.
   * @param transferId - The ID of the transfer to receive.
   * @param input - The receiving data.
   * @param receivedByUserId - The ID of the user who receives.
   * @returns The API response of the received transfer.
   */
  async receiveStockTransfer(
    transferId: number,
    input: ReceiveStockTransferInput,
    receivedByUserId: number,
  ): Promise<StockTransferApiResponse> {
    return appDataSource.transaction(async (manager) => {
      try {
        const transfer = await this.getTransferForReceiving(transferId, manager);
        if (
          transfer.status !== StockTransferStatus.IN_TRANSIT &&
          transfer.status !== StockTransferStatus.PARTIALLY_RECEIVED
        ) {
          throw new BadRequestError(
            `Transfer ID ${transferId} is not in IN_TRANSIT or PARTIALLY_RECEIVED status. Current status: ${transfer.status}`,
          );
        }
        if (!input.items?.length) {
          throw new BadRequestError('At least one item must be received.');
        }

        const newStatus = await this.processReceipt(transfer, input, receivedByUserId, manager);
        await this.updateTransferStatus(transfer, newStatus, input, receivedByUserId, manager);

        return await this.getPopulatedTransferResponse(transferId, manager);
      } catch (error: any) {
        logger.error(`Error receiving transfer ${transferId}: ${JSON.stringify(error)}`, {
          error,
          transferId,
          receivedByUserId,
        });
        throw error;
      }
    });
  }

  /**
   * Cancels a stock transfer.
   * @param transferId - The ID of the transfer to cancel.
   * @param cancelledByUserId - The ID of the user who cancels.
   * @returns The API response of the cancelled transfer.
   */
  async cancelStockTransfer(
    transferId: number,
    cancelledByUserId: number,
  ): Promise<StockTransferApiResponse> {
    try {
      const transfer = await this.getExistingTransfer(transferId);
      if (transfer.status !== StockTransferStatus.PENDING) {
        throw new ForbiddenError(
          `Cannot cancel a transfer that is not in PENDING status. Current status: ${transfer.status}`,
        );
      }

      transfer.status = StockTransferStatus.CANCELLED;
      transfer.updatedByUserId = cancelledByUserId;
      await this.transferRepository.save(transfer);

      return this.mapToApiResponse(transfer, true) as StockTransferApiResponse;
    } catch (error: any) {
      logger.error(`Error canceling transfer ${transferId}: ${JSON.stringify(error)}`, {
        error,
        transferId,
        cancelledByUserId,
      });
      throw error;
    }
  }

  /**
   * Soft deletes a stock transfer.
   * @param id - The ID of the transfer to delete.
   * @param deletedByUserId - The ID of the user performing the deletion.
   */
  async deleteStockTransfer(id: number, deletedByUserId: number): Promise<void> {
    try {
      const transfer = await this.getExistingTransfer(id);
      if (
        transfer.status !== StockTransferStatus.PENDING &&
        transfer.status !== StockTransferStatus.CANCELLED
      ) {
        throw new BadRequestError(
          `Cannot delete a transfer with status '${transfer.status}'. Cancel it first if PENDING.`,
        );
      }

      await this.transferRepository.softDelete(id);
    } catch (error: any) {
      logger.error(`Error deleting transfer ${id}: ${JSON.stringify(error)}`, {
        error,
        id,
        deletedByUserId,
      });
      throw error;
    }
  }

  // Private Validation Methods

  /**
   * Validates the input for creating or updating a stock transfer.
   * @param input - The input data for the stock transfer.
   * @param context - The validation context, including whether it's an update and the transactional entity manager.
   */
  private async validateTransferInput(
    input: CreateStockTransferInput | UpdateStockTransferInput,
    context: ValidationContext,
  ): Promise<void> {
    const { isUpdate, transactionalEntityManager } = context;

    if (!isUpdate && (!input.items || input.items.length === 0)) {
      throw new BadRequestError('A stock transfer must have at least one item when creating.');
    }

    await this.validateLocations(input, isUpdate, transactionalEntityManager);
    if ('items' in input && input.items) {
      await this.validateItems(input.items, isUpdate, transactionalEntityManager);
    }
  }

  /**
   * Validates the source and destination locations for a stock transfer.
   * @param input - The input data for the stock transfer.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateLocations(
    input: CreateStockTransferInput | UpdateStockTransferInput,
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    // Source validation
    if ('sourceWarehouseId' in input && input.sourceWarehouseId) {
      let warehouse;
      if (manager) {
        const repo = manager.getRepository(Warehouse);
        warehouse = await repo.findOneBy({ id: input.sourceWarehouseId, deletedAt: IsNull() });
      } else {
        warehouse = await this.warehouseRepository.findById(input.sourceWarehouseId);
      }
      if (!warehouse) {
        throw new BadRequestError(`Source warehouse ID ${input.sourceWarehouseId} not found.`);
      }
    } else if ('sourceShopId' in input && input.sourceShopId) {
      let shop;
      if (manager) {
        const repo = manager.getRepository(Shop);
        shop = await repo.findOneBy({ id: input.sourceShopId, deletedAt: IsNull() });
      } else {
        shop = await this.shopRepository.findById(input.sourceShopId);
      }
      if (!shop) {
        throw new BadRequestError(`Source shop ID ${input.sourceShopId} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('A source location (warehouse or shop) is required.');
    }

    // Destination validation
    if ('destinationWarehouseId' in input && input.destinationWarehouseId) {
      let warehouse;
      if (manager) {
        const repo = manager.getRepository(Warehouse);
        warehouse = await repo.findOneBy({ id: input.destinationWarehouseId, deletedAt: IsNull() });
      } else {
        warehouse = await this.warehouseRepository.findById(input.destinationWarehouseId);
      }
      if (!warehouse) {
        throw new BadRequestError(
          `Destination warehouse ID ${input.destinationWarehouseId} not found.`,
        );
      }
    } else if ('destinationShopId' in input && input.destinationShopId) {
      let shop;
      if (manager) {
        const repo = manager.getRepository(Shop);
        shop = await repo.findOneBy({ id: input.destinationShopId, deletedAt: IsNull() });
      } else {
        shop = await this.shopRepository.findById(input.destinationShopId);
      }
      if (!shop) {
        throw new BadRequestError(`Destination shop ID ${input.destinationShopId} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('A destination location (warehouse or shop) is required.');
    }

    // Check for duplicate source/destination
    if (input.sourceWarehouseId && input.sourceShopId) {
      throw new BadRequestError('Provide either a source warehouse or a source shop, not both.');
    }
    if (input.destinationWarehouseId && input.destinationShopId) {
      throw new BadRequestError(
        'Provide either a destination warehouse or a destination shop, not both.',
      );
    }
    if (
      (input.sourceWarehouseId && input.sourceWarehouseId === input.destinationWarehouseId) ||
      (input.sourceShopId && input.sourceShopId === input.destinationShopId)
    ) {
      throw new BadRequestError('Source and destination locations cannot be the same.');
    }
  }

  /**
   * Validates the items within a stock transfer.
   * @param items - The list of stock transfer items.
   * @param isUpdate - Indicates if the operation is an update.
   * @param manager - The entity manager for transactional operations.
   */
  private async validateItems(
    items: any[],
    isUpdate: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    for (const item of items) {
      if (item.deletedAt && isUpdate) continue;

      const productId = item.productId;
      if (!productId && !item.id) {
        throw new BadRequestError('Product ID is required for a new item.');
      }

      if (productId) {
        let product;
        if (manager) {
          const repo = manager.getRepository(Product);
          product = await repo.findOneBy({ id: productId, deletedAt: IsNull() });
        } else {
          product = await this.productRepository.findById(productId);
        }
        if (!product) throw new BadRequestError(`Product ID ${productId} not found.`);

        if (item.productVariantId) {
          let variant;
          if (manager) {
            const repo = manager.getRepository(ProductVariant);
            variant = await repo.findOneBy({
              id: item.productVariantId,
              productId,
              deletedAt: IsNull(),
            });
          } else {
            variant = await this.variantRepository.findById(item.productVariantId);
            if (variant && variant.productId !== productId) {
              variant = null;
            }
          }
          if (!variant) {
            throw new BadRequestError(
              `Variant ID ${item.productVariantId} invalid for product ${productId}.`,
            );
          }
        }
      }

      if (item.quantityRequested <= 0) {
        throw new BadRequestError(
          `Requested quantity for product ID ${productId} must be positive.`,
        );
      }
    }
  }

  /**
   * Validates if a user exists.
   * @param userId - The ID of the user to validate.
   * @param manager - The entity manager for transactional operations.
   * @returns The validated User entity.
   */
  private async validateUser(userId: number, manager?: EntityManager): Promise<User> {
    const user = manager
      ? await manager.getRepository(User).findOneBy({ id: userId })
      : await this.userRepository.findById(userId);
    if (!user) throw new BadRequestError(`User ID ${userId} not found.`);
    return user;
  }

  // Private Creation Methods

  /**
   * Creates the header for a new stock transfer.
   * @param input - The input data for the stock transfer.
   * @param requestedByUserId - The ID of the user requesting the transfer.
   * @param manager - The entity manager for transactional operations.
   * @returns The created StockTransfer entity.
   */
  private async createTransferHeader(
    input: CreateStockTransferInput,
    requestedByUserId: number,
    manager: EntityManager,
  ): Promise<StockTransfer> {
    const repo = manager.getRepository(StockTransfer);
    const transferData: Partial<StockTransfer> = {
      transferNumber: this.generateTransferNumber(),
      sourceWarehouseId: input.sourceWarehouseId,
      sourceShopId: input.sourceShopId,
      destinationWarehouseId: input.destinationWarehouseId,
      destinationShopId: input.destinationShopId,
      requestDate: dayjs(input.requestDate).toDate(),
      status: StockTransferStatus.PENDING,
      notes: input.notes,
      requestedByUserId,
      updatedByUserId: requestedByUserId,
    };

    const transfer = repo.create(transferData);
    this.validateTransferEntity(transfer);
    return await repo.save(transfer);
  }

  /**
   * Creates the items for a new stock transfer.
   * @param itemInputs - The input data for the stock transfer items.
   * @param transferId - The ID of the parent stock transfer.
   * @param manager - The entity manager for transactional operations.
   * @returns An array of created StockTransferItem entities.
   */
  private async createTransferItems(
    itemInputs: CreateStockTransferItemInput[],
    transferId: number,
    manager: EntityManager,
  ): Promise<StockTransferItem[]> {
    const repo = manager.getRepository(StockTransferItem);
    const itemsToSave: StockTransferItem[] = [];

    if (!itemInputs || itemInputs.length === 0) {
      return [];
    }

    for (const itemInput of itemInputs) {
      const item = repo.create({
        ...itemInput,
        stockTransferId: transferId,
        quantityShipped: 0,
        quantityReceived: 0,
      });
      this.validateTransferItemEntity(item);
      itemsToSave.push(item);
    }

    const savedItems = await repo.save(itemsToSave);
    return savedItems;
  }

  // Private Update Methods

  /**
   * Updates the header of an existing stock transfer.
   * @param id - The ID of the stock transfer to update.
   * @param input - The data for the update.
   * @param updatedByUserId - The ID of the user performing the update.
   * @param manager - The entity manager for transactional operations.
   * @returns The updated StockTransfer entity.
   */
  private async updateTransferHeader(
    id: number,
    input: UpdateStockTransferInput,
    updatedByUserId: number,
    manager: EntityManager,
  ): Promise<StockTransfer> {
    const repo = manager.getRepository(StockTransfer);
    const transfer = await repo.findOne({ where: { id, deletedAt: IsNull() } });

    if (!transfer) {
      throw new NotFoundError(`Stock transfer with ID ${id} not found.`);
    }

    // Update entity fields
    if (input.sourceWarehouseId !== undefined) transfer.sourceWarehouseId = input.sourceWarehouseId;
    if (input.sourceShopId !== undefined) transfer.sourceShopId = input.sourceShopId;
    if (input.destinationWarehouseId !== undefined)
      transfer.destinationWarehouseId = input.destinationWarehouseId;
    if (input.destinationShopId !== undefined) transfer.destinationShopId = input.destinationShopId;
    if (input.requestDate !== undefined) transfer.requestDate = dayjs(input.requestDate).toDate();
    if (input.notes !== undefined) transfer.notes = input.notes;
    if (input.status !== undefined) transfer.status = input.status;

    transfer.updatedByUserId = updatedByUserId;

    // Save the updated entity
    return await repo.save(transfer);
  }

  /**
   * Updates the items associated with a stock transfer.
   * This method deletes existing items for the transfer and recreates them based on the provided input.
   * @param transferId - The ID of the parent stock transfer.
   * @param items - The list of stock transfer items to update.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateTransferItems(
    transferId: number,
    items: any[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(StockTransferItem);
    await repo.delete({ stockTransferId: transferId });

    const newItems: StockTransferItem[] = [];
    for (const itemInput of items.filter((item) => !item.deletedAt)) {
      const item: any = repo.create({
        ...itemInput,
        stockTransferId: transferId,
        quantityShipped: 0,
        quantityReceived: 0,
      });
      this.validateTransferItemEntity(item);
      newItems.push(item);
    }

    if (newItems.length > 0) {
      await repo.save(newItems);
    }
  }

  /**
   * Processes the shipment of items for a stock transfer.
   * Updates item quantities and creates stock movements for shipped items.
   * @param transfer - The stock transfer entity.
   * @param input - The shipping data.
   * @param shippedByUserId - The ID of the user who ships.
   * @param manager - The entity manager for transactional operations.
   */
  private async processShipment(
    transfer: StockTransfer,
    input: ShipStockTransferInput,
    shippedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const itemRepo = manager.getRepository(StockTransferItem);

    for (const shipItem of input.items) {
      const item = transfer.items.find((i) => i.id === shipItem.stockTransferItemId);
      if (!item)
        throw new BadRequestError(
          `Item ID ${shipItem.stockTransferItemId} not found in transfer ${transfer.id}.`,
        );
      if (shipItem.quantityShipped < 0) {
        throw new BadRequestError(`Shipped quantity for item ID ${item.id} cannot be negative.`);
      }
      const remaining = Number(item.quantityRequested) - Number(item.quantityShipped);
      if (shipItem.quantityShipped > remaining) {
        throw new BadRequestError(
          `Shipped quantity ${shipItem.quantityShipped} for item ${item.id} exceeds remaining quantity (${remaining}).`,
        );
      }

      item.quantityShipped = Number(item.quantityShipped) + Number(shipItem.quantityShipped);
      await itemRepo.save(item);

      const unitCost = item.product?.defaultPurchasePrice ?? 0;

      await this.stockMovementService.createMovement(
        {
          productId: item.productId,
          productVariantId: item.productVariantId,
          warehouseId: transfer.sourceWarehouseId,
          shopId: transfer.sourceShopId,
          movementType: StockMovementType.STOCK_TRANSFER_OUT,
          quantity: -Math.abs(Number(shipItem.quantityShipped)),
          movementDate: input.shipDate ? dayjs(input.shipDate).toDate() : new Date(),
          unitCostAtMovement: Number(unitCost),
          userId: shippedByUserId,
          referenceDocumentType: 'stock_transfer',
          referenceDocumentId: transfer.id.toString(),
          notes: `Shipped for transfer ${transfer.transferNumber}, Item ${item.id}`,
        },
        manager,
      );
    }
  }

  /**
   * Processes the receipt of items for a stock transfer.
   * Updates item quantities, creates stock movements for received items, and determines the new transfer status.
   * @param transfer - The stock transfer entity.
   * @param input - The receiving data.
   * @param receivedByUserId - The ID of the user who receives.
   * @param manager - The entity manager for transactional operations.
   * @returns The new status of the stock transfer.
   */
  private async processReceipt(
    transfer: StockTransfer,
    input: ReceiveStockTransferInput,
    receivedByUserId: number,
    manager: EntityManager,
  ): Promise<StockTransferStatus> {
    const itemRepo = manager.getRepository(StockTransferItem);
    let allItemsFullyReceived = true;

    for (const receiveItem of input.items) {
      const item = transfer.items.find((i) => i.id === receiveItem.stockTransferItemId);
      if (!item)
        throw new BadRequestError(
          `Item ID ${receiveItem.stockTransferItemId} not found in transfer ${transfer.id}.`,
        );
      if (receiveItem.quantityReceived < 0) {
        throw new BadRequestError(`Received quantity for item ID ${item.id} cannot be negative.`);
      }
      const remaining = Number(item.quantityShipped) - Number(item.quantityReceived);
      if (receiveItem.quantityReceived > remaining) {
        throw new BadRequestError(
          `Received quantity ${receiveItem.quantityReceived} for item ${item.id} exceeds remaining shipped quantity (${remaining}).`,
        );
      }

      item.quantityReceived = Number(item.quantityReceived) + Number(receiveItem.quantityReceived);
      await itemRepo.save(item);

      if (item.quantityReceived < Number(item.quantityShipped)) {
        allItemsFullyReceived = false;
      }

      const unitCost = item.product?.defaultPurchasePrice ?? 0;

      await this.stockMovementService.createMovement(
        {
          productId: item.productId,
          productVariantId: item.productVariantId,
          warehouseId: transfer.destinationWarehouseId,
          shopId: transfer.destinationShopId,
          movementType: StockMovementType.STOCK_TRANSFER_IN,
          quantity: Math.abs(Number(receiveItem.quantityReceived)),
          movementDate: input.receiveDate ? dayjs(input.receiveDate).toDate() : new Date(),
          unitCostAtMovement: Number(unitCost),
          userId: receivedByUserId,
          referenceDocumentType: 'stock_transfer',
          referenceDocumentId: transfer.id.toString(),
          notes: `Received for transfer ${transfer.transferNumber}, Item ${item.id}`,
        },
        manager,
      );
    }

    const freshItems = await itemRepo.find({ where: { stockTransferId: transfer.id } });
    return freshItems.every((i) => Number(i.quantityReceived) >= Number(i.quantityShipped))
      ? StockTransferStatus.RECEIVED
      : StockTransferStatus.PARTIALLY_RECEIVED;
  }

  /**
   * Updates the status of a stock transfer to IN_TRANSIT after shipment.
   * @param transfer - The stock transfer entity to update.
   * @param input - The shipping data.
   * @param shippedByUserId - The ID of the user who shipped the transfer.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateTransferStatusToInTransit(
    transfer: StockTransfer,
    input: ShipStockTransferInput,
    shippedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(StockTransfer);
    transfer.status = StockTransferStatus.IN_TRANSIT;
    transfer.shippedByUserId = shippedByUserId;
    transfer.shipDate = input.shipDate ? dayjs(input.shipDate).toDate() : new Date();
    transfer.notes = input.notes ?? transfer.notes;
    transfer.updatedByUserId = shippedByUserId;
    await repo.save(transfer);
  }

  /**
   * Updates the status of a stock transfer after receiving items.
   * @param transfer - The stock transfer entity to update.
   * @param newStatus - The new status to set for the transfer.
   * @param input - The receiving data.
   * @param receivedByUserId - The ID of the user who received the transfer.
   * @param manager - The entity manager for transactional operations.
   */
  private async updateTransferStatus(
    transfer: StockTransfer,
    newStatus: StockTransferStatus,
    input: ReceiveStockTransferInput,
    receivedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(StockTransfer);
    transfer.status = newStatus;
    transfer.receivedByUserId = receivedByUserId;
    transfer.receiveDate = input.receiveDate ? dayjs(input.receiveDate).toDate() : new Date();
    transfer.notes = input.notes ?? transfer.notes;
    transfer.updatedByUserId = receivedByUserId;
    await repo.save(transfer);
  }

  /**
   * Generates a unique transfer number based on the current date and a sequence.
   * @returns A unique stock transfer number.
   */
  private generateTransferNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `TRF-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Validates a StockTransfer entity.
   * @param transfer - The StockTransfer entity to validate.
   */
  private validateTransferEntity(transfer: StockTransfer): void {
    if (!transfer.isValid()) {
      throw new BadRequestError(
        `Invalid stock transfer data: ${stockTransferValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Validates a StockTransferItem entity.
   * @param item - The StockTransferItem entity to validate.
   */
  private validateTransferItemEntity(item: StockTransferItem): void {
    if (!item.isValid()) {
      throw new BadRequestError(
        `Invalid transfer item data: ${stockTransferItemValidationInputErrors.join(', ')}`,
      );
    }
  }

  /**
   * Maps a StockTransfer entity to its API response format.
   * @param transfer - The StockTransfer entity to map.
   * @param includeItems - Whether to include associated items in the API response.
   * @returns The API response of the stock transfer, or null if the input transfer is null.
   */
  private mapToApiResponse(
    transfer: StockTransfer | null,
    includeItems: boolean = false,
  ): StockTransferApiResponse | null {
    if (!transfer) return null;
    return transfer.toApi(includeItems);
  }

  /**
   * Returns an array of default relations to be loaded with a stock transfer.
   * @returns An array of relation names.
   */
  private getDefaultRelations(): string[] {
    return [
      'sourceWarehouse',
      'sourceShop',
      'destinationWarehouse',
      'destinationShop',
      'requestedByUser',
    ];
  }

  /**
   * Returns an array of detailed relations to be loaded with a stock transfer, including items and user details.
   * @returns An array of relation names.
   */
  private getDetailedRelations(): string[] {
    return [
      ...this.getDefaultRelations(),
      'items',
      'items.product',
      'items.productVariant',
      'shippedByUser',
      'receivedByUser',
    ];
  }

  /**
   * Retrieves an existing stock transfer by its ID.
   * @param id - The ID of the stock transfer.
   * @returns The found StockTransfer entity.
   */
  private async getExistingTransfer(id: number): Promise<StockTransfer> {
    const transfer = await this.transferRepository.findById(id);
    if (!transfer) throw new NotFoundError(`Stock transfer with ID ${id} not found.`);
    return transfer;
  }

  /**
   * Retrieves a stock transfer for update operations, including its items.
   * @param id - The ID of the stock transfer.
   * @param manager - The entity manager for transactional operations.
   * @returns The found StockTransfer entity with items.
   */
  private async getTransferForUpdate(id: number, manager: EntityManager): Promise<StockTransfer> {
    const transfer = await this.transferRepository.findById(id, {
      relations: ['items'],
      transactionalEntityManager: manager,
    });
    if (!transfer) throw new NotFoundError(`Stock transfer with ID ${id} not found.`);
    return transfer;
  }

  /**
   * Retrieves a stock transfer for shipping operations, including detailed item and source location information.
   * @param id - The ID of the stock transfer.
   * @param manager - The entity manager for transactional operations.
   * @returns The found StockTransfer entity with shipping-related details.
   */
  private async getTransferForShipping(id: number, manager: EntityManager): Promise<StockTransfer> {
    const transfer = await this.transferRepository.findById(id, {
      relations: [
        'items',
        'items.product',
        'items.productVariant',
        'sourceWarehouse',
        'sourceShop',
      ],
      transactionalEntityManager: manager,
    });
    if (!transfer) throw new NotFoundError(`Stock transfer with ID ${id} not found.`);
    return transfer;
  }

  /**
   * Retrieves a stock transfer for receiving operations, including detailed item and destination location information.
   * @param id - The ID of the stock transfer.
   * @param manager - The entity manager for transactional operations.
   * @returns The found StockTransfer entity with receiving-related details.
   */
  private async getTransferForReceiving(
    id: number,
    manager: EntityManager,
  ): Promise<StockTransfer> {
    const transfer = await this.transferRepository.findById(id, {
      relations: [
        'items',
        'items.product',
        'items.productVariant',
        'destinationWarehouse',
        'destinationShop',
      ],
      transactionalEntityManager: manager,
    });
    if (!transfer) throw new NotFoundError(`Stock transfer with ID ${id} not found.`);
    return transfer;
  }

  /**
   * Retrieves a stock transfer with all detailed relations and maps it to an API response.
   * @param id - The ID of the stock transfer.
   * @param manager - Optional entity manager for transactional operations.
   * @returns The API response of the populated stock transfer.
   */
  private async getPopulatedTransferResponse(
    id: number,
    manager?: EntityManager,
  ): Promise<StockTransferApiResponse> {
    const transfer = await this.transferRepository.findById(id, {
      relations: this.getDetailedRelations(),
      transactionalEntityManager: manager,
    });
    const apiResponse = this.mapToApiResponse(transfer, true);
    if (!apiResponse) throw new ServerError(`Failed to convert transfer ${id} to API response.`);
    return apiResponse;
  }

  /**
   * Returns the singleton instance of StockTransferService.
   * @returns The StockTransferService instance.
   */
  static getInstance(): StockTransferService {
    instance ??= new StockTransferService();
    return instance;
  }
}
