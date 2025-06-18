import { appDataSource } from '@/database/data-source';
import {
  SalesOrderItem,
  type CreateSalesOrderItemInput,
  type UpdateSalesOrderItemInput,
  type SalesOrderItemApiResponse,
  createSalesOrderItemSchema,
  updateSalesOrderItemSchema,
  salesOrderItemValidationInputErrors,
} from '../index';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import { type EntityManager } from 'typeorm';
import { SalesOrderRepository } from '@/modules/sales-orders';
import { SalesOrderItemRepository } from '../index';
import { ProductRepository } from '@/modules/products';
import { ProductVariantRepository } from '@/modules/product-variants';
import { SalesOrder, SalesOrderStatus } from '@/modules/sales-orders/models/sales-order.entity';

let instance: SalesOrderItemService | null = null;

export class SalesOrderItemService {
  private readonly orderRepository: SalesOrderRepository;
  private readonly itemRepository: SalesOrderItemRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;

  constructor(
    orderRepository: SalesOrderRepository = new SalesOrderRepository(),
    itemRepository: SalesOrderItemRepository = new SalesOrderItemRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
  ) {
    this.orderRepository = orderRepository;
    this.itemRepository = itemRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
  }

  /**
   * Maps a SalesOrderItem entity to its API response format.
   * @param item The SalesOrderItem entity or null.
   * @returns The API response object or null.
   */
  mapToApiResponse(item: SalesOrderItem | null): SalesOrderItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getOrderAndCheckStatus(
    orderId: number,
    allowedStatuses?: SalesOrderStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SalesOrder> {
    const orderRepo = transactionalEntityManager
      ? new SalesOrderRepository(transactionalEntityManager.connection)
      : this.orderRepository;

    const order = await orderRepo.findById(orderId, {
      relations: ['items', 'items.product', 'items.productVariant'],
      transactionalEntityManager,
    });
    if (!order) {
      throw new NotFoundError(`Sales Order with ID ${orderId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(order.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a sales order with status '${order.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return order;
  }

  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{
    productName: string;
    variantName?: string | null;
    defaultVat?: number | null;
    unitPriceHt?: number | null;
  }> {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${input.productId} not found for item.`);

    let variantName: string | null = null;
    let variantPriceHt: number | null = null;
    if (input.productVariantId) {
      const variant = await this.variantRepository.findById(input.productVariantId);
      if (!variant || variant.productId !== input.productId) {
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
        );
      }
      variantName = variant.nameVariant;
      variantPriceHt = variant.sellingPriceHt;
    }
    return {
      productName: product.name,
      variantName,
      defaultVat: product.defaultVatRatePercentage,
      unitPriceHt: variantPriceHt ?? product.defaultSellingPriceHt,
    };
  }

  /**
   * Adds an item to a sales order.
   * @param salesOrderId The ID of the sales order.
   * @param input The input data for the sales order item.
   * @param createdByUserId The ID of the user creating the item.
   * @returns The created sales order item as an API response.
   */
  async addItemToSalesOrder(
    salesOrderId: number,
    input: CreateSalesOrderItemInput,
    createdByUserId: number,
  ): Promise<SalesOrderItemApiResponse> {
    const validationResult = createSalesOrderItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid sales order item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(SalesOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(SalesOrderItem);

      const order = await this.getOrderAndCheckStatus(
        salesOrderId,
        [SalesOrderStatus.DRAFT, SalesOrderStatus.PENDING_APPROVAL],
        transactionalEntityManager,
      );

      const {
        productName,
        variantName,
        defaultVat,
        unitPriceHt: productDefaultPrice,
      } = await this.validateItemProductAndVariant(validatedInput);

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        salesOrderId: salesOrderId,
        description: validatedInput.description ?? variantName ?? productName,
        unitPriceHt: validatedInput.unitPriceHt
          ? validatedInput.unitPriceHt
          : (productDefaultPrice ?? 0),
        vatRatePercentage:
          validatedInput.vatRatePercentage !== undefined
            ? validatedInput.vatRatePercentage
            : defaultVat,
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Sales order item data is invalid (internal check). Errors: ${salesOrderItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      const itemsForTotal = await itemRepoTx.find({ where: { salesOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = createdByUserId;
      await orderRepoTx.save(order);

      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: ['product', 'productVariant'],
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created sales order item.');
      return apiResponse;
    });
  }

  /**
   * Gets all items for a specific sales order.
   * @param salesOrderId The ID of the sales order.
   * @returns An array of sales order item API responses.
   */
  async getSalesOrderItems(salesOrderId: number): Promise<SalesOrderItemApiResponse[]> {
    await this.getOrderAndCheckStatus(salesOrderId);
    const items = await this.itemRepository.findBySalesOrderId(salesOrderId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as SalesOrderItemApiResponse[];
  }

  /**
   * Gets a specific item from a sales order by its ID.
   * @param salesOrderId The ID of the sales order.
   * @param itemId The ID of the sales order item.
   * @returns The sales order item as an API response.
   */
  async getSalesOrderItemById(
    salesOrderId: number,
    itemId: number,
  ): Promise<SalesOrderItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.salesOrderId !== salesOrderId) {
      throw new NotFoundError(
        `Sales order item with ID ${itemId} not found for SO ${salesOrderId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map sales order item.');
    return apiResponse;
  }

  /**
   * Updates a specific item in a sales order.
   * @param salesOrderId The ID of the sales order.
   * @param itemId The ID of the sales order item.
   * @param input The update data for the sales order item.
   * @param updatedByUserId The ID of the user performing the update.
   * @returns The updated sales order item as an API response.
   */
  async updateSalesOrderItem(
    salesOrderId: number,
    itemId: number,
    input: UpdateSalesOrderItemInput,
    updatedByUserId: number,
  ): Promise<SalesOrderItemApiResponse> {
    const validationResult = updateSalesOrderItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid sales order item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(SalesOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(SalesOrderItem);

      const order = await this.getOrderAndCheckStatus(
        salesOrderId,
        [SalesOrderStatus.DRAFT, SalesOrderStatus.PENDING_APPROVAL],
        transactionalEntityManager,
      );

      const item = await itemRepoTx.findOne({
        where: { id: itemId, salesOrderId },
        relations: ['product', 'productVariant'],
      });

      if (!item) {
        throw new NotFoundError(
          `Sales order item with ID ${itemId} not found for SO ${salesOrderId}.`,
        );
      }

      Object.assign(item, validatedInput);
      if (validatedInput.quantity !== undefined && validatedInput.quantity <= 0) {
        throw new BadRequestError('Quantity must be positive.');
      }
      if (validatedInput.unitPriceHt !== undefined && validatedInput.unitPriceHt < 0) {
        throw new BadRequestError('Unit price cannot be negative.');
      }

      if (!item.isValid()) {
        throw new BadRequestError(
          `Sales order item data is invalid (internal check). Errors: ${salesOrderItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      const itemsForTotal = await itemRepoTx.find({ where: { salesOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = updatedByUserId;
      await orderRepoTx.save(order);

      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: ['product', 'productVariant'],
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated sales order item.');
      return apiResponse;
    });
  }

  /**
   * Removes an item from a sales order.
   * @param salesOrderId The ID of the sales order.
   * @param itemId The ID of the sales order item.
   * @param deletedByUserId The ID of the user performing the deletion.
   */
  async removeSalesOrderItem(
    salesOrderId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(SalesOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(SalesOrderItem);

      const order = await this.getOrderAndCheckStatus(
        salesOrderId,
        [SalesOrderStatus.DRAFT, SalesOrderStatus.PENDING_APPROVAL],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, salesOrderId });
      if (!item) {
        throw new NotFoundError(
          `Sales order item with ID ${itemId} not found for SO ${salesOrderId}.`,
        );
      }

      await itemRepoTx.remove(item);

      const itemsForTotal = await itemRepoTx.find({ where: { salesOrderId } });
      order.items = itemsForTotal;
      order.calculateTotals();
      order.updatedByUserId = deletedByUserId;
      await orderRepoTx.save(order);
    });
  }

  /**
   * Gets the singleton instance of the SalesOrderItemService.
   * @returns The SalesOrderItemService instance.
   */
  static getInstance(): SalesOrderItemService {
    instance ??= new SalesOrderItemService();
    return instance;
  }
}
