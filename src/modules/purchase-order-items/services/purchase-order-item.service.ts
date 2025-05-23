import { appDataSource } from '@/database/data-source';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { PurchaseOrderRepository } from '@/modules/purchase-orders/data/purchase-order.repository';
import { PurchaseOrderItemRepository } from '../data/purchase-order-item.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import {
  createPurchaseOrderItemSchema,
  PurchaseOrderItem,
  purchaseOrderItemValidationInputErrors,
  updatePurchaseOrderItemSchema,
  type CreatePurchaseOrderItemInput,
  type PurchaseOrderItemApiResponse,
  type UpdatePurchaseOrderItemInput,
} from '../models/purchase-order-item.entity';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/modules/purchase-orders/models/purchase-order.entity';

let instance: PurchaseOrderItemService | null = null;

export class PurchaseOrderItemService {
  private readonly orderRepository: PurchaseOrderRepository;
  private readonly itemRepository: PurchaseOrderItemRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;

  constructor(
    orderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    itemRepository: PurchaseOrderItemRepository = new PurchaseOrderItemRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
  ) {
    this.orderRepository = orderRepository;
    this.itemRepository = itemRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
  }

  mapToApiResponse(item: PurchaseOrderItem | null): PurchaseOrderItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getOrderAndCheckStatus(
    orderId: number,
    allowedStatuses?: PurchaseOrderStatus[],
  ): Promise<PurchaseOrder> {
    const order = await this.orderRepository.findById(orderId, {
      relations: ['items', 'items.product', 'items.productVariant'],
    });
    if (!order) {
      throw new NotFoundError(`Purchase Order with ID ${orderId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(order.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a purchase order with status '${order.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return order;
  }

  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{ productName: string; variantName?: string | null; defaultVat?: number | null }> {
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
    return { productName: product.name, variantName, defaultVat: product.defaultVatRatePercentage };
  }

  async addItemToOrder(
    purchaseOrderId: number,
    input: CreatePurchaseOrderItemInput,
    createdByUserId: number,
  ): Promise<PurchaseOrderItemApiResponse> {
    const validationResult = createPurchaseOrderItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);

      const order = await this.getOrderAndCheckStatus(purchaseOrderId, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.PENDING_APPROVAL,
      ]);

      const { productName, variantName, defaultVat } =
        await this.validateItemProductAndVariant(validatedInput);

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        purchaseOrderId: purchaseOrderId,
        description: validatedInput.description || variantName || productName,
        vatRatePercentage:
          validatedInput.vatRatePercentage !== undefined
            ? validatedInput.vatRatePercentage
            : (defaultVat ?? 0),
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Item data is invalid (internal check). Errors: ${purchaseOrderItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      const itemsForTotal = await itemRepoTx.find({ where: { purchaseOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = createdByUserId;
      await orderRepoTx.save(order);

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager: transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created PO item.');
      return apiResponse;
    });
  }

  async getOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItemApiResponse[]> {
    await this.getOrderAndCheckStatus(purchaseOrderId);
    const items = await this.itemRepository.findByPurchaseOrderId(purchaseOrderId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as PurchaseOrderItemApiResponse[];
  }

  async getOrderItemById(
    purchaseOrderId: number,
    itemId: number,
  ): Promise<PurchaseOrderItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.purchaseOrderId !== purchaseOrderId) {
      throw new NotFoundError(
        `Purchase order item with ID ${itemId} not found for PO ${purchaseOrderId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map PO item.');
    return apiResponse;
  }

  async updateOrderItem(
    purchaseOrderId: number,
    itemId: number,
    input: UpdatePurchaseOrderItemInput,
    updatedByUserId: number,
  ): Promise<PurchaseOrderItemApiResponse> {
    const validationResult = updatePurchaseOrderItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);

      const order = await this.getOrderAndCheckStatus(purchaseOrderId, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.PENDING_APPROVAL,
      ]);
      const item = await itemRepoTx.findOne({ where: { id: itemId, purchaseOrderId } });
      if (!item) {
        throw new NotFoundError(
          `Purchase order item with ID ${itemId} not found for PO ${purchaseOrderId}.`,
        );
      }

      if (validatedInput.description !== undefined) item.description = validatedInput.description;
      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceHt !== undefined) item.unitPriceHt = validatedInput.unitPriceHt;
      if (validatedInput.vatRatePercentage !== undefined) {
        item.vatRatePercentage = Number(validatedInput.vatRatePercentage);
      }

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated PO item data is invalid (internal check). Errors: ${purchaseOrderItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      const itemsForTotal = await itemRepoTx.find({ where: { purchaseOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = updatedByUserId;
      await orderRepoTx.save(order);

      logger.info(`PO item ID ${itemId} for PO ${purchaseOrderId} updated successfully.`);
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager: transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated PO item.');
      return apiResponse;
    });
  }

  async removeOrderItem(
    purchaseOrderId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);

      const order = await this.getOrderAndCheckStatus(purchaseOrderId, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.PENDING_APPROVAL,
      ]);
      const item = await itemRepoTx.findOneBy({ id: itemId, purchaseOrderId });
      if (!item) {
        throw new NotFoundError(
          `Purchase order item with ID ${itemId} not found for PO ${purchaseOrderId}.`,
        );
      }

      await itemRepoTx.remove(item);

      const itemsForTotal = await itemRepoTx.find({ where: { purchaseOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = deletedByUserId;
      await orderRepoTx.save(order);

      logger.info(`PO item ID ${itemId} removed from PO ${purchaseOrderId}.`);
    });
  }

  static getInstance(): PurchaseOrderItemService {
    if (!instance) {
      instance = new PurchaseOrderItemService();
    }
    return instance;
  }
}
