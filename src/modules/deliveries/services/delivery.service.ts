import { appDataSource } from '@/database/data-source';
import { v4 as uuidv4 } from 'uuid';
import { IsNull, type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';
import { DeliveryRepository } from '../data/delivery.repository';
import { UserRepository } from '../../users/data/users.repository';
import { StockMovementService } from '../../stock-movements/services/stock-movement.service';

import {
  Delivery,
  type CreateDeliveryInput,
  type UpdateDeliveryInput,
  type DeliveryApiResponse,
  DeliveryStatus,
  deliveryValidationInputErrors,
} from '../models/delivery.entity';
import { type SalesOrder, SalesOrderStatus } from '../../sales-orders/models/sales-order.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { SalesOrderRepository } from '@/modules/sales-orders/data/sales-order.repository';
import { Address } from '@/modules/addresses/models/address.entity';
import { Warehouse } from '@/modules/warehouses/models/warehouse.entity';
import { Shop } from '@/modules/shops/models/shop.entity';
import { DeliveryItemRepository } from '../delivery-items/data/delivery-item.repository';
import { DeliveryItem } from '../delivery-items/models/delivery-item.entity';
import { SalesOrderItem } from '@/modules/sales-orders/sales-order-items/models/sales-order-item.entity';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: DeliveryService | null = null;

export class DeliveryService {
  private readonly deliveryRepository: DeliveryRepository;
  private readonly deliveryItemRepository: DeliveryItemRepository;
  private readonly salesOrderRepository: SalesOrderRepository;
  private readonly userRepository: UserRepository;
  private readonly stockMovementService: StockMovementService = StockMovementService.getInstance();

  constructor(
    deliveryRepository: DeliveryRepository = new DeliveryRepository(),
    deliveryItemRepository: DeliveryItemRepository = new DeliveryItemRepository(),
    salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.deliveryRepository = deliveryRepository;
    this.deliveryItemRepository = deliveryItemRepository;
    this.salesOrderRepository = salesOrderRepository;
    this.userRepository = userRepository;
  }

  /**
   * Creates a new delivery.
   * @param input The input data for creating the delivery.
   * @param createdByUserId The ID of the user creating the delivery.
   * @returns The created delivery as an API response.
   */
  async createDelivery(
    input: CreateDeliveryInput,
    createdByUserId: number,
  ): Promise<DeliveryApiResponse> {
    return appDataSource.transaction(async (manager) => {
      await this.validateUser(createdByUserId);
      const { salesOrder } = await this.validateInput(input, false, undefined, manager);

      const deliveryData = this.buildDeliveryData(input, salesOrder, createdByUserId);
      const savedDelivery = await this.saveDeliveryWithItems(
        manager,
        deliveryData,
        input.items,
        salesOrder,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.SALES_AND_DISTRIBUTION,
        savedDelivery.id.toString(),
        { deliveryNumber: savedDelivery.deliveryNumber },
      );

      return this.getDeliveryResponse(savedDelivery.id, manager);
    });
  }

  /**
   * Finds a delivery by its ID.
   * @param id The ID of the delivery to find.
   * @returns The found delivery as an API response.
   */
  async findDeliveryById(id: number): Promise<DeliveryApiResponse> {
    const delivery = await this.deliveryRepository.findById(id);
    if (!delivery) {
      throw new NotFoundError(`Delivery with id ${id} not found.`);
    }
    return this.mapToApiResponse(delivery);
  }

  /**
   * Retrieves all deliveries with pagination and filtering options.
   * @param options The search options (limit, offset, filters, sort, search term).
   * @returns A paginated response containing the deliveries.
   */
  async findAllDeliveries(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Delivery> | FindOptionsWhere<Delivery>[];
    sort?: FindManyOptions<Delivery>['order'];
  }): Promise<{ deliveries: DeliveryApiResponse[]; total: number }> {
    try {
      const { deliveries, count } = await this.deliveryRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { deliveryDate: 'DESC', createdAt: 'DESC' },
        relations: this.deliveryRepository['getDefaultRelationsForFindAll'](),
      });
      const apiDeliveries = deliveries.map((d) => this.mapToApiResponse(d)).filter(Boolean);
      return { deliveries: apiDeliveries, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all deliveries`, error, options },
        'DeliveryService.findAllDeliveries',
      );
      throw new ServerError('Error finding all deliveries.');
    }
  }

  /**
   * Updates an existing delivery.
   * @param id The ID of the delivery to update.
   * @param input The input data for updating the delivery.
   * @param updatedByUserId The ID of the user updating the delivery.
   * @returns The updated delivery as an API response.
   */
  async updateDelivery(
    id: number,
    input: UpdateDeliveryInput,
    updatedByUserId: number,
  ): Promise<DeliveryApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const existingDelivery = await this.getDeliveryForUpdate(manager, id);
      this.validateDeliveryCanBeUpdated(existingDelivery);

      const { salesOrder } = await this.validateInput(input, true, id, manager);

      const updatedDelivery = await this.performUpdate(
        manager,
        existingDelivery,
        input,
        updatedByUserId,
        salesOrder,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return this.getDeliveryResponse(updatedDelivery.id, manager);
    });
  }

  /**
   * Marks a delivery as shipped.
   * @param deliveryId The ID of the delivery to ship.
   * @param createdByUserId The ID of the user shipping the delivery.
   * @param actualShipDate The actual date of shipment.
   * @returns The updated delivery as an API response.
   */
  async shipDelivery(
    deliveryId: number,
    createdByUserId: number,
    actualShipDate?: Date | string,
  ): Promise<DeliveryApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const delivery = await this.getDeliveryForShipment(deliveryId, manager);
      await this.validateUser(createdByUserId);
      await this.handleStockMovements(delivery, createdByUserId, actualShipDate, manager);
      await this.updateSalesOrderShippedQuantities(delivery, manager);

      delivery.status = DeliveryStatus.SHIPPED;
      delivery.createdByUserId = createdByUserId;
      delivery.deliveryDate = actualShipDate ? dayjs(actualShipDate).toDate() : new Date();
      delivery.updatedByUserId = createdByUserId;
      await this.deliveryRepository.save(delivery, manager);

      await this.updateSalesOrderStatusBasedOnDeliveries(
        delivery.salesOrderId,
        createdByUserId,
        manager,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.SHIP,
        EntityType.INVENTORY_AND_FLOW,
        deliveryId.toString(),
        { deliveryNumber: delivery.deliveryNumber, actualShipDate: delivery.deliveryDate },
      );

      return this.getDeliveryResponse(deliveryId, manager);
    });
  }

  /**
   * Marks a delivery as delivered.
   * @param deliveryId The ID of the delivery to mark as delivered.
   * @param deliveredByUserId The ID of the user marking the delivery as delivered.
   * @returns The updated delivery as an API response.
   */
  async markAsDelivered(
    deliveryId: number,
    deliveredByUserId: number,
  ): Promise<DeliveryApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const delivery = await this.getDeliveryForDelivery(deliveryId, manager);
      await this.validateUser(deliveredByUserId);

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.updatedByUserId = deliveredByUserId;

      await this.deliveryRepository.save(delivery, manager);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.COMPLETE,
        EntityType.SALES_AND_DISTRIBUTION,
        deliveryId.toString(),
        { deliveryNumber: delivery.deliveryNumber },
      );

      return this.getDeliveryResponse(deliveryId, manager);
    });
  }

  /**
   * Deletes (soft delete) a delivery.
   * @param id The ID of the delivery to delete.
   * @param deletedByUserId The ID of the user deleting the delivery.
   */
  async deleteDelivery(id: number): Promise<void> {
    await appDataSource.transaction(async (manager) => {
      const delivery = await this.deliveryRepository.findById(id, {
        transactionalEntityManager: manager,
      });
      if (!delivery) {
        throw new NotFoundError(`Delivery with id ${id} not found.`);
      }

      this.validateDeliveryCanBeDeleted(delivery);

      if (delivery.status === DeliveryStatus.IN_PREPARATION) {
        logger.info(
          `TODO: Reverse any stock reservations for cancelled/deleted delivery ID ${id}.`,
        );
        // await this.stockMovementService.unreserveStockForDelivery(id, delivery.items);
      }

      try {
        await this.deliveryRepository.softDelete(id, manager);

        await UserActivityLogService.getInstance().insertEntry(
          ActionType.DELETE,
          EntityType.SALES_AND_DISTRIBUTION,
          id.toString(),
          { deliveryNumber: delivery.deliveryNumber },
        );
      } catch (error) {
        logger.error({ message: `Error deleting delivery ${id}`, error });
        throw new ServerError(`Error deleting delivery ${id}.`);
      }
    });
  }

  /**
   * Validates the input data for creating or updating a delivery.
   * @param input The input data.
   * @param isUpdate Indicates if the operation is an update.
   * @param deliveryId The ID of the delivery if it's an update.
   * @param manager The EntityManager for the transaction.
   * @returns The associated SalesOrder.
   */
  private async validateInput(
    input: CreateDeliveryInput | UpdateDeliveryInput,
    isUpdate: boolean,
    deliveryId: number | undefined,
    manager: EntityManager,
  ): Promise<{ salesOrder: SalesOrder }> {
    const salesOrder = await this.validateSalesOrder(input, isUpdate, deliveryId, manager);
    await this.validateRelatedEntities(input, salesOrder, isUpdate, deliveryId, manager);
    this.validateDispatchRules(input, salesOrder, isUpdate);
    await this.validateDeliveryItems(input, salesOrder, isUpdate, deliveryId, manager);

    return { salesOrder };
  }

  /**
   * Validates the existence of a user.
   * @param userId The ID of the user to validate.
   */
  private async validateUser(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestError(`User with ID ${userId} not found.`);
    }
  }

  /**
   * Validates the Sales Order associated with the delivery.
   * @param input The delivery input.
   * @param isUpdate Indicates if it's an update operation.
   * @param deliveryId The ID of the delivery being updated.
   * @param manager The EntityManager.
   * @returns The validated SalesOrder.
   */
  private async validateSalesOrder(
    input: CreateDeliveryInput | UpdateDeliveryInput,
    isUpdate: boolean,
    deliveryId: number | undefined,
    manager: EntityManager,
  ): Promise<SalesOrder> {
    let salesOrder: SalesOrder | null = null;

    if ('salesOrderId' in input && input.salesOrderId) {
      salesOrder = await this.salesOrderRepository.findById(input.salesOrderId, {
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'shippingAddress',
          'customer',
        ],
        transactionalEntityManager: manager,
      });
      if (!salesOrder) {
        throw new BadRequestError(`Sales Order with ID ${input.salesOrderId} not found.`);
      }
      const allowedSOStatuses = [
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.PAYMENT_RECEIVED,
        SalesOrderStatus.IN_PREPARATION,
        SalesOrderStatus.PARTIALLY_SHIPPED,
      ];
      if (!isUpdate && !allowedSOStatuses.includes(salesOrder.status)) {
        throw new BadRequestError(
          `Cannot create delivery for Sales Order ${salesOrder.orderNumber} in status '${salesOrder.status}'. Must be Approved or In Preparation.`,
        );
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Sales Order ID is required to create a delivery.');
    }

    if (!salesOrder && isUpdate) {
      const currentDelivery = await this.deliveryRepository.findById(deliveryId as number, {
        relations: ['salesOrder', 'salesOrder.items'],
        transactionalEntityManager: manager,
      });
      if (!currentDelivery || !currentDelivery.salesOrder) {
        throw new ServerError('Could not retrieve sales order for current delivery.');
      }
      salesOrder = currentDelivery.salesOrder;
    }

    if (!salesOrder) {
      throw new ServerError('Sales Order context could not be established.');
    }
    return salesOrder;
  }

  /**
   * Validates related entities (addresses, warehouse, shop) in the input data.
   * @param input The delivery input.
   * @param salesOrder The associated SalesOrder.
   * @param isUpdate Indicates if it's an update operation.
   * @param deliveryId The ID of the delivery being updated.
   * @param manager The EntityManager.
   */
  private async validateRelatedEntities(
    input: CreateDeliveryInput | UpdateDeliveryInput,
    salesOrder: SalesOrder,
    isUpdate: boolean,
    deliveryId: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const addressRepoTx = manager.getRepository(Address);
    const warehouseRepoTx = manager.getRepository(Warehouse);
    const shopRepoTx = manager.getRepository(Shop);

    const shippingAddressIdToValidate =
      input.shippingAddressId ?? (isUpdate ? undefined : salesOrder.shippingAddressId);
    if (shippingAddressIdToValidate) {
      if (
        !(await addressRepoTx.findOneBy({ id: shippingAddressIdToValidate, deletedAt: IsNull() }))
      ) {
        throw new BadRequestError(`Shipping Address ID ${shippingAddressIdToValidate} not found.`);
      }
    } else if (!isUpdate) {
      throw new BadRequestError('Shipping Address ID is required for delivery.');
    }

    if (input.dispatchWarehouseId !== undefined && input.dispatchWarehouseId !== null) {
      if (
        !(await warehouseRepoTx.findOneBy({ id: input.dispatchWarehouseId, deletedAt: IsNull() }))
      ) {
        throw new BadRequestError(`Dispatch Warehouse ID ${input.dispatchWarehouseId} not found.`);
      }
    }
    if (input.dispatchShopId !== undefined && input.dispatchShopId !== null) {
      if (!(await shopRepoTx.findOneBy({ id: input.dispatchShopId, deletedAt: IsNull() }))) {
        throw new BadRequestError(`Dispatch Shop ID ${input.dispatchShopId} not found.`);
      }
    }
  }

  /**
   * Validates dispatch rules (warehouse or shop, not both).
   * @param input The delivery input.
   * @param salesOrder The associated SalesOrder.
   * @param isUpdate Indicates if it's an update operation.
   * @param deliveryId The ID of the delivery being updated.
   * @param manager The EntityManager.
   */
  private validateDispatchRules(
    input: CreateDeliveryInput | UpdateDeliveryInput,
    salesOrder: SalesOrder,
    isUpdate: boolean,
  ): void {
    const currentWarehouseId =
      input.dispatchWarehouseId ?? (isUpdate ? undefined : salesOrder.dispatchWarehouseId);
    const currentShopId =
      input.dispatchShopId ?? (isUpdate ? undefined : salesOrder.dispatchShopId);

    if (currentWarehouseId && currentShopId) {
      throw new BadRequestError('Provide either dispatchWarehouseId or dispatchShopId, not both.');
    }

    if (!isUpdate && !currentWarehouseId && !currentShopId) {
      throw new BadRequestError(
        'Either dispatchWarehouseId or dispatchShopId must be provided for delivery.',
      );
    }
  }

  /**
   * Validates the delivery items.
   * @param input The delivery input.
   * @param salesOrder The associated SalesOrder.
   * @param isUpdate Indicates if it's an update operation.
   * @param deliveryId The ID of the delivery being updated.
   * @param manager The EntityManager.
   */
  private async validateDeliveryItems(
    input: CreateDeliveryInput | UpdateDeliveryInput,
    salesOrder: SalesOrder,
    isUpdate: boolean,
    deliveryId: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    if (!('items' in input) || !input.items) return;

    for (const itemInput of input.items) {
      if ((itemInput as any)._delete && isUpdate) continue;

      const soItem = salesOrder.items.find((i) => i.id === itemInput.salesOrderItemId);
      if (!soItem) {
        throw new BadRequestError(
          `Sales Order Item ID ${itemInput.salesOrderItemId} not found or does not belong to SO ${salesOrder.orderNumber}.`,
        );
      }

      if (itemInput.quantityShipped <= 0) {
        throw new BadRequestError(
          `Quantity shipped for SO Item ID ${itemInput.salesOrderItemId} must be positive.`,
        );
      }

      const allDeliveryItemsForSOItem = await this.deliveryItemRepository.findBySalesOrderItemId(
        soItem.id,
        { transactionalEntityManager: manager },
      );

      let totalPreviouslyShippedForSOItem = 0;
      allDeliveryItemsForSOItem.forEach((di: DeliveryItem) => {
        // Exclude items from the current delivery being updated from the sum of previously shipped quantities
        if (!deliveryId || di.deliveryId !== deliveryId) {
          totalPreviouslyShippedForSOItem += Number(di.quantityShipped);
        }
      });

      const maxShippableNow = Number(soItem.quantity) - totalPreviouslyShippedForSOItem;
      if (itemInput.quantityShipped > maxShippableNow) {
        throw new BadRequestError(
          `Quantity to ship (${itemInput.quantityShipped}) for SO Item ${soItem.id} (Product: ${soItem.product?.sku}) ` +
            `exceeds remaining shippable quantity (${maxShippableNow.toFixed(3)}). ` +
            `Ordered: ${soItem.quantity}, Already shipped: ${totalPreviouslyShippedForSOItem.toFixed(3)}.`,
        );
      }
    }
  }

  /**
   * Builds the delivery data from the input.
   * @param input The input data for creating the delivery.
   * @param salesOrder The associated SalesOrder.
   * @param createdByUserId The ID of the user creating the delivery.
   * @returns The partial delivery data.
   */
  private buildDeliveryData(
    input: CreateDeliveryInput,
    salesOrder: SalesOrder,
    createdByUserId: number,
  ): Partial<Delivery> {
    return {
      salesOrderId: input.salesOrderId,
      deliveryNumber: this.generateDeliveryNumber(),
      deliveryDate: dayjs(input.deliveryDate).toDate(),
      status: DeliveryStatus.PENDING,
      shippingAddressId: input.shippingAddressId ?? salesOrder.shippingAddressId,
      dispatchWarehouseId: input.dispatchWarehouseId ?? salesOrder.dispatchWarehouseId,
      dispatchShopId: input.dispatchShopId ?? salesOrder.dispatchShopId,
      carrierName: input.carrierName,
      trackingNumber: input.trackingNumber,
      notes: input.notes,
      createdByUserId: createdByUserId,
      updatedByUserId: createdByUserId,
    };
  }

  /**
   * Saves the delivery and its items within a transaction.
   * @param manager The EntityManager for the transaction.
   * @param deliveryData The delivery data.
   * @param items The delivery items.
   * @param salesOrder The associated SalesOrder.
   * @returns The saved delivery.
   */
  private async saveDeliveryWithItems(
    manager: EntityManager,
    deliveryData: Partial<Delivery>,
    items: CreateDeliveryInput['items'],
    salesOrder: SalesOrder,
  ): Promise<Delivery> {
    const deliveryRepo = manager.getRepository(Delivery);
    const deliveryItemRepo = manager.getRepository(DeliveryItem);

    const deliveryEntity = deliveryRepo.create({
      ...deliveryData,
      items: [],
    });

    if (!deliveryEntity.isValid()) {
      throw new BadRequestError(
        `Delivery data invalid: ${deliveryValidationInputErrors.join(', ')}`,
      );
    }
    const savedDelivery = await deliveryRepo.save(deliveryEntity);

    const deliveryItemsToCreate = items.map((itemInput) => {
      const soItem = salesOrder.items.find((i) => i.id === itemInput.salesOrderItemId);
      if (!soItem) {
        throw new ServerError(
          `Sales Order Item ID ${itemInput.salesOrderItemId} not found during item creation for delivery.`,
        );
      }
      const itemEntity = deliveryItemRepo.create({
        deliveryId: savedDelivery.id,
        salesOrderItemId: itemInput.salesOrderItemId,
        productId: soItem.productId,
        productVariantId: soItem.productVariantId,
        quantityShipped: itemInput.quantityShipped,
      });
      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Invalid data for delivery item (SO Item ID: ${itemInput.salesOrderItemId}).`,
        );
      }
      return itemEntity;
    });

    await deliveryItemRepo.save(deliveryItemsToCreate);
    savedDelivery.items = deliveryItemsToCreate;

    return savedDelivery;
  }

  /**
   * Retrieves a delivery for update.
   * @param manager The EntityManager for the transaction.
   * @param id The ID of the delivery.
   * @returns The delivery.
   */
  private async getDeliveryForUpdate(manager: EntityManager, id: number): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findById(id, {
      transactionalEntityManager: manager,
    });
    if (!delivery) {
      throw new NotFoundError(`Delivery with ID ${id} not found.`);
    }
    return delivery;
  }

  /**
   * Validates if a delivery can be updated based on its status.
   * @param delivery The delivery.
   */
  private validateDeliveryCanBeUpdated(delivery: Delivery): void {
    const nonUpdatableStatuses = [
      DeliveryStatus.SHIPPED,
      DeliveryStatus.DELIVERED,
      DeliveryStatus.CANCELLED,
    ];
    if (nonUpdatableStatuses.includes(delivery.status)) {
      throw new ForbiddenError(
        `Cannot update delivery header for a delivery in status '${delivery.status}'.`,
      );
    }
  }

  /**
   * Performs the update of the delivery and its items.
   * @param manager The EntityManager for the transaction.
   * @param existingDelivery The existing delivery.
   * @param input The input data for the update.
   * @param updatedByUserId The ID of the user updating the delivery.
   * @param salesOrder The associated SalesOrder.
   * @returns The updated delivery.
   */
  private async performUpdate(
    manager: EntityManager,
    existingDelivery: Delivery,
    input: UpdateDeliveryInput,
    updatedByUserId: number,
    salesOrder: SalesOrder,
  ): Promise<Delivery> {
    Object.assign(existingDelivery, {
      ...input,
      updatedByUserId,
      updatedAt: new Date(),
      deliveryDate: input.deliveryDate
        ? dayjs(input.deliveryDate).toDate()
        : existingDelivery.deliveryDate,
    });

    const deliveryRepo = manager.getRepository(Delivery);

    if (!existingDelivery.isValid()) {
      throw new BadRequestError(
        `Updated delivery data invalid: ${deliveryValidationInputErrors.join(', ')}`,
      );
    }

    await deliveryRepo.save(existingDelivery);

    if (input.items) {
      await this.updateDeliveryItems(manager, existingDelivery, input.items, salesOrder);
    }

    return existingDelivery;
  }

  /**
   * Updates the items of a delivery.
   * @param manager The EntityManager for the transaction.
   * @param delivery The delivery.
   * @param itemInputs The input data for the items to update.
   * @param salesOrder The associated SalesOrder.
   */
  private async updateDeliveryItems(
    manager: EntityManager,
    delivery: Delivery,
    itemInputs: (CreateDeliveryInput['items'][number] & { id?: number; _delete?: boolean })[],
    salesOrder: SalesOrder,
  ): Promise<void> {
    const deliveryItemRepo = manager.getRepository(DeliveryItem);
    const itemsToSave: DeliveryItem[] = [];

    const itemsToDelete = itemInputs
      .filter((item) => item._delete && item.id)
      .map((item) => item.id)
      .filter((id): id is number => id !== undefined);

    if (itemsToDelete.length > 0) {
      await deliveryItemRepo.softDelete(itemsToDelete);
    }

    for (const itemInput of itemInputs.filter((item) => !item._delete)) {
      const soItem = salesOrder.items.find((i) => i.id === itemInput.salesOrderItemId);
      if (!soItem) {
        throw new ServerError(
          `Sales Order Item ID ${itemInput.salesOrderItemId} not found during item update for delivery.`,
        );
      }

      if (itemInput.id) {
        const existingItem = delivery.items.find((item) => item.id === itemInput.id);
        if (existingItem) {
          Object.assign(existingItem, {
            ...itemInput,
            productId: soItem.productId,
            productVariantId: soItem.productVariantId,
          });
          if (!existingItem.isValid()) {
            throw new BadRequestError(
              `Invalid data for existing delivery item (ID: ${itemInput.id}).`,
            );
          }
          itemsToSave.push(existingItem);
        } else {
          const newItem = deliveryItemRepo.create({
            ...itemInput,
            deliveryId: delivery.id,
            productId: soItem.productId,
            productVariantId: soItem.productVariantId,
          });
          if (!newItem.isValid()) {
            throw new BadRequestError(
              `Invalid data for new delivery item (SO Item ID: ${itemInput.salesOrderItemId}).`,
            );
          }
          itemsToSave.push(newItem);
        }
      } else {
        const newItem = deliveryItemRepo.create({
          ...itemInput,
          deliveryId: delivery.id,
          productId: soItem.productId,
          productVariantId: soItem.productVariantId,
        });
        if (!newItem.isValid()) {
          throw new BadRequestError(
            `Invalid data for new delivery item (SO Item ID: ${itemInput.salesOrderItemId}).`,
          );
        }
        itemsToSave.push(newItem);
      }
    }

    if (itemsToSave.length > 0) {
      await deliveryItemRepo.save(itemsToSave);
    }

    delivery.items = await deliveryItemRepo.find({
      where: { deliveryId: delivery.id, deletedAt: IsNull() },
    });
  }

  /**
   * Retrieves a delivery for shipment.
   * @param deliveryId The ID of the delivery.
   * @param manager The EntityManager.
   * @returns The delivery with necessary relations.
   */
  private async getDeliveryForShipment(
    deliveryId: number,
    manager: EntityManager,
  ): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findById(deliveryId, {
      relations: [
        'items',
        'items.salesOrderItem',
        'items.product',
        'items.productVariant',
        'salesOrder',
        'salesOrder.items',
      ],
      transactionalEntityManager: manager,
    });
    if (!delivery) {
      throw new NotFoundError(`Delivery ID ${deliveryId} not found.`);
    }
    if (
      delivery.status !== DeliveryStatus.PENDING &&
      delivery.status !== DeliveryStatus.IN_PREPARATION &&
      delivery.status !== DeliveryStatus.READY_TO_SHIP
    ) {
      throw new BadRequestError(
        `Delivery ID ${deliveryId} cannot be shipped. Current status: ${delivery.status}.`,
      );
    }
    if (!delivery.items || delivery.items.length === 0) {
      throw new BadRequestError(`Delivery ID ${deliveryId} has no items to ship.`);
    }
    if (!delivery.salesOrder) {
      throw new ServerError(`Sales Order not found for delivery ID ${deliveryId}`);
    }
    return delivery;
  }

  /**
   * Handles stock movements for shipped items.
   * @param delivery The delivery being shipped.
   * @param createdByUserId The ID of the user shipping the delivery.
   * @param actualShipDate The actual date of shipment.
   * @param manager The EntityManager.
   */
  private async handleStockMovements(
    delivery: Delivery,
    createdByUserId: number,
    actualShipDate: Date | string | undefined,
    manager: EntityManager,
  ): Promise<void> {
    for (const item of delivery.items) {
      if (!item.salesOrderItem) {
        throw new ServerError(`SalesOrderItem link missing for delivery item ${item.id}`);
      }

      const unitCost = item.salesOrderItem.product?.defaultPurchasePrice ?? 0;
      await this.stockMovementService.createMovement(
        {
          productId: item.productId,
          productVariantId: item.productVariantId,
          warehouseId: delivery.dispatchWarehouseId,
          shopId: delivery.dispatchShopId,
          movementType: StockMovementType.SALE_DELIVERY,
          quantity: -Math.abs(Number(item.quantityShipped)),
          movementDate: actualShipDate ? dayjs(actualShipDate).toDate() : new Date(),
          unitCostAtMovement: Number(unitCost),
          userId: createdByUserId,
          referenceDocumentType: 'delivery',
          referenceDocumentId: delivery.id.toString(),
          notes: `Shipped via Delivery ${delivery.deliveryNumber} for SO ${delivery.salesOrder.orderNumber}`,
        },
        manager,
      );
    }
  }

  /**
   * Updates the quantityShipped for SalesOrderItems.
   * @param delivery The delivery being shipped.
   * @param manager The EntityManager.
   */
  private async updateSalesOrderShippedQuantities(
    delivery: Delivery,
    manager: EntityManager,
  ): Promise<void> {
    const salesOrderItemRepo = manager.getRepository(SalesOrderItem);
    for (const item of delivery.items) {
      const soItem = await salesOrderItemRepo.findOneBy({ id: item.salesOrderItemId });
      if (soItem) {
        soItem.quantityShipped = Number(soItem.quantityShipped || 0) + Number(item.quantityShipped);
        await salesOrderItemRepo.save(soItem);
      } else {
        logger.error(
          `SalesOrderItem ID ${item.salesOrderItemId} not found during delivery ship process.`,
        );
      }
    }
  }

  /**
   * Updates the SalesOrder status based on its deliveries.
   * @param salesOrderId The ID of the SalesOrder.
   * @param updatedByUserId The ID of the user performing the update.
   * @param manager The EntityManager.
   */
  private async updateSalesOrderStatusBasedOnDeliveries(
    salesOrderId: number,
    updatedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const salesOrder = await this.salesOrderRepository.findById(salesOrderId, {
      relations: ['items'],
      transactionalEntityManager: manager,
    });

    if (salesOrder) {
      const allDeliveriesForSO = await this.deliveryRepository.findBySalesOrderId(salesOrder.id, {
        relations: ['items'],
        transactionalEntityManager: manager,
      });

      let allItemsFullyShipped = true;
      for (const soItem of salesOrder.items) {
        const totalShippedForSOItem =
          allDeliveriesForSO
            .flatMap((d: Delivery) => d.items || [])
            .filter(
              (di: DeliveryItem) => di.salesOrderItemId === soItem.id && di.deletedAt === null,
            )
            .reduce((sum: number, di: DeliveryItem) => sum + Number(di.quantityShipped), 0) || 0;

        if (totalShippedForSOItem < Number(soItem.quantity)) {
          allItemsFullyShipped = false;
          break;
        }
      }

      if (
        salesOrder.status !== SalesOrderStatus.FULLY_SHIPPED &&
        salesOrder.status !== SalesOrderStatus.COMPLETED &&
        salesOrder.status !== SalesOrderStatus.CANCELLED
      ) {
        salesOrder.status = allItemsFullyShipped
          ? SalesOrderStatus.FULLY_SHIPPED
          : SalesOrderStatus.PARTIALLY_SHIPPED;
        salesOrder.updatedByUserId = updatedByUserId;
        await this.salesOrderRepository.save(salesOrder, manager);
      }
    }
  }

  /**
   * Retrieves a delivery for marking as delivered.
   * @param deliveryId The ID of the delivery.
   * @param manager The EntityManager.
   * @returns The delivery.
   */
  private async getDeliveryForDelivery(
    deliveryId: number,
    manager: EntityManager,
  ): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findById(deliveryId, {
      transactionalEntityManager: manager,
    });
    if (!delivery) {
      throw new NotFoundError(`Delivery ID ${deliveryId} not found.`);
    }
    if (delivery.status !== DeliveryStatus.SHIPPED) {
      throw new BadRequestError(
        `Delivery ID ${deliveryId} must be in SHIPPED status to be marked as delivered. Current status: ${delivery.status}.`,
      );
    }
    return delivery;
  }

  /**
   * Validates if a delivery can be deleted based on its status.
   * @param delivery The delivery.
   */
  private validateDeliveryCanBeDeleted(delivery: Delivery): void {
    if (
      delivery.status === DeliveryStatus.SHIPPED ||
      delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestError(
        `Delivery in status '${delivery.status}' cannot be deleted. Consider a customer return process.`,
      );
    }
    // TODO: Dépendance - Check if linked to non-voided customer invoices
    // const isLinked = await this.deliveryRepository.isDeliveryLinkedToInvoice(id);
    // if(isLinked) throw new BadRequestError('Delivery is linked to an invoice.');
  }

  /**
   * Retrieves the API response for a delivery.
   * @param deliveryId The ID of the delivery.
   * @param manager The EntityManager (optional) for the transaction.
   * @returns The delivery as an API response.
   */
  private async getDeliveryResponse(
    deliveryId: number,
    manager?: EntityManager,
  ): Promise<DeliveryApiResponse> {
    const delivery = await this.deliveryRepository.findById(deliveryId, {
      transactionalEntityManager: manager,
    });
    if (!delivery) {
      throw new ServerError(`Failed to retrieve delivery ${deliveryId}.`);
    }
    return this.mapToApiResponse(delivery);
  }

  mapToApiResponse(delivery: Delivery | null): DeliveryApiResponse {
    if (!delivery) {
      throw new ServerError('Failed to map delivery to API response: delivery is null.');
    }
    return delivery.toApi();
  }

  private generateDeliveryNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `DL-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  static getInstance(): DeliveryService {
    instance ??= new DeliveryService();
    return instance;
  }
}
