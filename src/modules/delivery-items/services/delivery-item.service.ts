import { appDataSource } from '../../../database/data-source';
import {
  type DeliveryItem,
  type CreateDeliveryItemInput,
  type UpdateDeliveryItemInput,
  type DeliveryItemApiResponse,
  createDeliveryItemSchema,
  updateDeliveryItemSchema,
  deliveryItemValidationInputErrors,
} from '../models/delivery-item.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '../../../common/errors/httpErrors';
import logger from '../../../lib/logger';
import { type EntityManager } from 'typeorm';
import { DeliveryRepository } from '@/modules/deliveries/data/delivery.repository';
import { DeliveryItemRepository } from '../data/delivery-item.repository';
import { SalesOrderRepository } from '@/modules/sales-orders/data/sales-order.repository';
import { SalesOrderItemRepository } from '@/modules/sales-order-items/data/sales-order-item.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import { type Delivery, DeliveryStatus } from '@/modules/deliveries/models/delivery.entity';
import { type SalesOrder } from '@/modules/sales-orders/models/sales-order.entity';
import { type SalesOrderItem } from '@/modules/sales-order-items/models/sales-order-item.entity';
import { type Product } from '@/modules/products/models/product.entity';
import { type ProductVariant } from '@/modules/product-variants/models/product-variant.entity';

let instance: DeliveryItemService | null = null;

export class DeliveryItemService {
  private readonly deliveryRepository: DeliveryRepository;
  private readonly itemRepository: DeliveryItemRepository;
  private readonly salesOrderRepository: SalesOrderRepository;
  private readonly salesOrderItemRepository: SalesOrderItemRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly stockMovementService: StockMovementService;

  constructor(
    deliveryRepository: DeliveryRepository = new DeliveryRepository(),
    itemRepository: DeliveryItemRepository = new DeliveryItemRepository(),
    salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    salesOrderItemRepository: SalesOrderItemRepository = new SalesOrderItemRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    stockMovementService: StockMovementService = new StockMovementService(),
  ) {
    this.deliveryRepository = deliveryRepository;
    this.itemRepository = itemRepository;
    this.salesOrderRepository = salesOrderRepository;
    this.salesOrderItemRepository = salesOrderItemRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.stockMovementService = stockMovementService;
  }

  mapToApiResponse(item: DeliveryItem | null): DeliveryItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getDeliveryAndCheckStatus(
    deliveryId: number,
    allowedStatuses?: DeliveryStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findById(deliveryId, {
      relations: ['items', 'items.salesOrderItem', 'salesOrder'],
      transactionalEntityManager,
    });
    if (!delivery) {
      throw new NotFoundError(`Delivery with ID ${deliveryId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(delivery.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a delivery with status '${delivery.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return delivery;
  }

  private async validateDeliveryItemInput(
    input: CreateDeliveryItemInput,
    salesOrder: SalesOrder,
    existingDeliveryItems: DeliveryItem[] = [],
    currentItemIdToExclude?: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<{
    salesOrderItem: SalesOrderItem;
    product: Product;
    productVariant: ProductVariant | null;
  }> {
    const salesOrderItem = await this.salesOrderItemRepository.findById(input.salesOrderItemId, {
      relations: ['product', 'productVariant', 'salesOrder'],
      transactionalEntityManager,
    });
    if (!salesOrderItem || salesOrderItem.salesOrderId !== salesOrder.id) {
      throw new BadRequestError(
        `Sales Order Item ID ${input.salesOrderItemId} not found or does not belong to Sales Order ${salesOrder.orderNumber}.`,
      );
    }
    if (!salesOrderItem.product) {
      throw new ServerError(
        `Product details missing for Sales Order Item ID ${input.salesOrderItemId}.`,
      );
    }

    let alreadyShippedOnOtherLines = 0;
    const deliveryItemsForThisSOItem = await this.itemRepository.findBySalesOrderItemId(
      salesOrderItem.id,
      { transactionalEntityManager: transactionalEntityManager },
    );

    deliveryItemsForThisSOItem.forEach((di: DeliveryItem) => {
      if (currentItemIdToExclude === undefined || di.id !== currentItemIdToExclude) {
        if (existingDeliveryItems.find((edi: DeliveryItem) => edi.id === di.id)) {
        } else {
          alreadyShippedOnOtherLines += Number(di.quantityShipped);
        }
      }
    });

    const alreadyPlannedForThisDeliveryThisSOLine = existingDeliveryItems
      .filter(
        (item) =>
          item.salesOrderItemId === salesOrderItem.id &&
          (currentItemIdToExclude === undefined || item.id !== currentItemIdToExclude),
      )
      .reduce((sum, item) => sum + Number(item.quantityShipped), 0);

    const totalQuantityAccountedFor =
      alreadyShippedOnOtherLines + alreadyPlannedForThisDeliveryThisSOLine;
    const maxShippable = Number(salesOrderItem.quantity) - totalQuantityAccountedFor;

    if (input.quantityShipped > maxShippable) {
      throw new BadRequestError(
        `Quantity shipped (${input.quantityShipped}) for product '${salesOrderItem.product.name}' ` +
          `exceeds remaining quantity on sales order item (${maxShippable.toFixed(3)}). ` +
          `Ordered: ${salesOrderItem.quantity}, Already shipped/planned: ${totalQuantityAccountedFor.toFixed(3)}.`,
      );
    }
    return {
      salesOrderItem,
      product: salesOrderItem.product,
      productVariant: salesOrderItem.productVariant,
    };
  }

  async addItemToDelivery(
    deliveryId: number,
    input: CreateDeliveryItemInput,
    createdByUserId: number,
  ): Promise<DeliveryItemApiResponse> {
    const validationResult = createDeliveryItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid delivery item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      // const stockMovementService = new StockMovementService(transactionalEntityManager); // TODO

      const delivery = await this.getDeliveryAndCheckStatus(
        deliveryId,
        [DeliveryStatus.PENDING, DeliveryStatus.IN_PREPARATION],
        transactionalEntityManager,
      );
      if (!delivery.salesOrder)
        throw new ServerError('Sales Order relation not loaded on delivery.'); // Should be loaded by getDeliveryAndCheckStatus

      const { salesOrderItem, product, productVariant } = await this.validateDeliveryItemInput(
        validatedInput,
        delivery.salesOrder,
        delivery.items || [],
        undefined,
        transactionalEntityManager,
      );

      const existingLink = delivery.items?.find(
        (item) => item.salesOrderItemId === validatedInput.salesOrderItemId,
      );
      if (existingLink) {
        throw new BadRequestError(
          `Sales Order Item ID ${validatedInput.salesOrderItemId} is already part of this delivery (Item ID: ${existingLink.id}). Update its quantity instead.`,
        );
      }

      const itemEntity = this.itemRepository.create(
        {
          deliveryId: deliveryId,
          salesOrderItemId: validatedInput.salesOrderItemId,
          productId: product.id,
          productVariantId: productVariant?.id || null,
          quantityShipped: validatedInput.quantityShipped,
          // createdByUserId, // if DeliveryItem has audit
        },
        transactionalEntityManager,
      );

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Delivery item data is invalid (internal check). Errors: ${deliveryItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await this.itemRepository.save(itemEntity, transactionalEntityManager);

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created delivery item.');
      return apiResponse;
    });
  }

  async getDeliveryItems(deliveryId: number): Promise<DeliveryItemApiResponse[]> {
    await this.getDeliveryAndCheckStatus(deliveryId);
    const items = await this.itemRepository.findByDeliveryId(deliveryId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as DeliveryItemApiResponse[];
  }

  async getDeliveryItemById(deliveryId: number, itemId: number): Promise<DeliveryItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.deliveryId !== deliveryId) {
      throw new NotFoundError(
        `Delivery item with ID ${itemId} not found for delivery ${deliveryId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map delivery item.');
    return apiResponse;
  }

  async updateDeliveryItem(
    deliveryId: number,
    itemId: number,
    input: UpdateDeliveryItemInput,
    updatedByUserId: number,
  ): Promise<DeliveryItemApiResponse> {
    const validationResult = updateDeliveryItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const delivery = await this.getDeliveryAndCheckStatus(
        deliveryId,
        [DeliveryStatus.PENDING, DeliveryStatus.IN_PREPARATION],
        transactionalEntityManager,
      );
      if (!delivery.salesOrder)
        throw new ServerError('Sales Order relation not loaded on delivery.');

      const item = await this.itemRepository.findById(itemId, {
        relations: ['salesOrderItem'],
        transactionalEntityManager,
      });
      if (!item) {
        throw new NotFoundError(
          `Delivery item with ID ${itemId} not found for delivery ${deliveryId}.`,
        );
      }
      if (!item.salesOrderItem)
        throw new ServerError('Sales Order Item relation not loaded on delivery item.');

      if (validatedInput.quantityShipped !== undefined) {
        await this.validateDeliveryItemInput(
          {
            salesOrderItemId: item.salesOrderItemId,
            quantityShipped: validatedInput.quantityShipped,
          },
          delivery.salesOrder,
          delivery.items || [],
          itemId,
          transactionalEntityManager,
        );
        item.quantityShipped = validatedInput.quantityShipped;
      }
      // item.updatedByUserId = updatedByUserId; // If audit on DeliveryItem

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated delivery item data is invalid (internal check). Errors: ${deliveryItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await this.itemRepository.save(item, transactionalEntityManager);
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated delivery item.');
      return apiResponse;
    });
  }

  async removeDeliveryItem(
    deliveryId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      await this.getDeliveryAndCheckStatus(
        deliveryId,
        [DeliveryStatus.PENDING, DeliveryStatus.IN_PREPARATION],
        transactionalEntityManager,
      );
      const item = await this.itemRepository.findOneBy(
        { id: itemId, deliveryId },
        transactionalEntityManager,
      );
      if (!item) {
        throw new NotFoundError(
          `Delivery item with ID ${itemId} not found for delivery ${deliveryId}.`,
        );
      }

      await this.itemRepository.remove(item, transactionalEntityManager);

      logger.info(`Delivery item ID ${itemId} removed from delivery ${deliveryId}.`);
    });
  }

  static getInstance(): DeliveryItemService {
    if (!instance) {
      instance = new DeliveryItemService();
    }
    return instance;
  }
}
