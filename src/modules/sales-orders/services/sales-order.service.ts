import { appDataSource } from '@/database/data-source';
import {
  type EntityManager,
  IsNull,
  type Repository,
  type FindManyOptions,
  type FindOptionsWhere,
} from 'typeorm';
import { CustomerRepository } from '../../customers/data/customer.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { WarehouseRepository } from '../../warehouses/data/warehouse.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { UserRepository } from '../../users/data/users.repository';
import { QuoteRepository } from '../../quotes/data/quote.repository';
import { Quote, QuoteStatus } from '../../quotes/models/quote.entity';
import { v4 as uuidv4 } from 'uuid';
import {
  SalesOrder,
  type CreateSalesOrderInput,
  type UpdateSalesOrderInput,
  type SalesOrderApiResponse,
  SalesOrderStatus,
} from '../models/sales-order.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { SalesOrderRepository } from '../data/sales-order.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { SalesOrderItemRepository } from '../sales-order-items/data/sales-order-item.repository';
import {
  type CreateSalesOrderItemInput,
  SalesOrderItem,
} from '../sales-order-items/models/sales-order-item.entity';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';

let instance: SalesOrderService | null = null;

export class SalesOrderService {
  constructor(
    private readonly orderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly itemRepository: SalesOrderItemRepository = new SalesOrderItemRepository(),
    private readonly customerRepository: CustomerRepository = new CustomerRepository(),
    private readonly quoteRepository: QuoteRepository = new QuoteRepository(),
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository(),
    private readonly addressRepository: AddressRepository = new AddressRepository(),
    private readonly warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    private readonly shopRepository: ShopRepository = new ShopRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  /**
   * Creates a new sales order.
   * @param input The input data for creating the order.
   * @param createdByUserId The ID of the user creating the order.
   * @returns The created sales order as an API response.
   */
  async createSalesOrder(
    input: CreateSalesOrderInput,
    createdByUserId: number,
  ): Promise<SalesOrderApiResponse> {
    return appDataSource.transaction(async (manager) => {
      await this.validateUser(createdByUserId);
      await this.validateInput(input);

      const orderData = this.buildOrderData(input, createdByUserId);
      const savedOrder = await this.saveOrderWithItems(manager, orderData, input.items);

      if (savedOrder.quoteId) {
        await this.updateQuoteStatus(
          manager,
          savedOrder.quoteId,
          QuoteStatus.CONVERTED_TO_ORDER,
          createdByUserId,
        );
      }

      return this.getOrderResponse(savedOrder.id, manager);
    });
  }

  /**
   * Finds a sales order by its ID.
   * @param id The ID of the sales order to find.
   * @returns The found sales order as an API response.
   */
  async findSalesOrderById(id: number): Promise<SalesOrderApiResponse> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError(`Sales order with id ${id} not found.`);
    }
    return this.mapToApiResponse(order);
  }

  /**
   * Retrieves all sales orders with pagination and filtering options.
   * @param options The search options (limit, offset, filters, sort, search term).
   * @returns A paginated response containing the sales orders.
   */
  async findAllSalesOrders(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<SalesOrder>;
    sort?: FindManyOptions<SalesOrder>['order'];
  }): Promise<{ orders: SalesOrderApiResponse[]; total: number }> {
    try {
      const { orders, count } = await this.orderRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort,
      });
      const apiOrders = orders.map((salesOrd) => this.mapToApiResponse(salesOrd)).filter(Boolean);
      return { orders: apiOrders, total: count };
    } catch (error) {
      logger.error(`Error finding all sales orders: ${error}`);
      throw new ServerError('Error finding all sales orders.');
    }
  }

  /**
   * Updates an existing sales order.
   * @param id The ID of the sales order to update.
   * @param input The input data for updating the order.
   * @param updatedByUserId The ID of the user updating the order.
   * @returns The updated sales order as an API response.
   */
  async updateSalesOrder(
    id: number,
    input: UpdateSalesOrderInput,
    updatedByUserId: number,
  ): Promise<SalesOrderApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const existingOrder = await this.getOrderForUpdate(manager, id);
      this.validateOrderCanBeUpdated(existingOrder);

      await this.validateInput(input, true, id);

      const updatedOrder = await this.performUpdate(manager, existingOrder, input, updatedByUserId);
      return this.getOrderResponse(updatedOrder.id, manager);
    });
  }

  /**
   * Updates the status of a sales order.
   * @param id The ID of the sales order.
   * @param status The new status of the order.
   * @param updatedByUserId The ID of the user updating the status.
   * @returns The updated sales order as an API response.
   */
  async updateSalesOrderStatus(
    id: number,
    status: SalesOrderStatus,
    updatedByUserId: number,
  ): Promise<SalesOrderApiResponse> {
    return appDataSource.transaction(async (manager) => {
      const order = await this.orderRepository.findById(id, {
        relations: ['items'],
        transactionalEntityManager: manager,
      });
      if (!order) {
        throw new NotFoundError(`Sales order with id ${id} not found.`);
      }

      this.validateStatusTransition(order.status, status);
      await this.handleStatusSpecificActions(order, status, updatedByUserId, manager);

      await manager.getRepository(SalesOrder).update(id, { status, updatedByUserId });
      return this.getOrderResponse(id, manager);
    });
  }

  /**
   * Deletes (soft delete) a sales order.
   * @param id The ID of the sales order to delete.
   */
  async deleteSalesOrder(id: number): Promise<void> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundError(`Sales order with id ${id} not found.`);
    }

    if (!this.canDeleteOrder(order.status)) {
      throw new BadRequestError(`Sales order in status '${order.status}' cannot be deleted.`);
    }

    await this.orderRepository.softDelete(id);
  }

  /**
   * Converts a quote to a sales order.
   * @param quoteId The ID of the quote to convert.
   * @param createdByUserId The ID of the user performing the conversion.
   * @returns The sales order created from the quote.
   */
  async convertQuoteToSalesOrder(
    quoteId: number,
    createdByUserId: number,
  ): Promise<SalesOrderApiResponse> {
    const quote = await this.getQuoteForConversion(quoteId);
    const orderInput = this.buildOrderInputFromQuote(quote);

    const salesOrder = await this.createSalesOrder(orderInput, createdByUserId);

    await appDataSource.getRepository(Quote).update(quoteId, {
      status: QuoteStatus.CONVERTED_TO_ORDER,
      updatedByUserId: createdByUserId,
    });

    return salesOrder;
  }

  /**
   * Validates the input data for creating or updating a sales order.
   * @param input The input data.
   * @param isUpdate Indicates if the operation is an update.
   * @param orderId The ID of the order if it's an update.
   */
  private async validateInput(
    input: CreateSalesOrderInput | UpdateSalesOrderInput,
    isUpdate = false,
    orderId?: number,
  ): Promise<void> {
    if (!isUpdate) {
      this.validateRequiredFields(input as CreateSalesOrderInput);
    }

    const validators = [
      () => this.validateRelatedEntities(input, isUpdate, orderId),
      () => this.validateDispatchRules(input),
      () => this.validateOrderItems(input, isUpdate, orderId),
    ];

    await Promise.all(validators.map((validator) => validator()));
  }

  /**
   * Validates the required fields for creating a sales order.
   * @param input The input data for creation.
   */
  private validateRequiredFields(input: CreateSalesOrderInput): void {
    const requiredFields = [
      { key: 'customerId', message: 'Customer ID is required.' },
      { key: 'orderDate', message: 'Order date is required.' },
      { key: 'currencyId', message: 'Currency ID is required.' },
      { key: 'shippingAddressId', message: 'Shipping address ID is required.' },
      { key: 'billingAddressId', message: 'Billing address ID is required.' },
    ];

    const missingField = requiredFields.find(
      (field) => !input[field.key as keyof CreateSalesOrderInput],
    );
    if (missingField) {
      throw new BadRequestError(missingField.message);
    }
  }

  /**
   * Validates related entities (customer, currency, addresses, warehouse, shop) in the input data.
   * @param input The input data.
   * @param isUpdate Indicates if the operation is an update.
   * @param orderId The ID of the order if it's an update.
   */
  private async validateRelatedEntities(
    input: CreateSalesOrderInput | UpdateSalesOrderInput,
    isUpdate: boolean,
    orderId?: number,
  ): Promise<void> {
    const validations = [
      { field: 'customerId', repo: this.customerRepository, name: 'Customer' },
      { field: 'currencyId', repo: this.currencyRepository, name: 'Currency' },
      { field: 'billingAddressId', repo: this.addressRepository, name: 'Billing Address' },
      { field: 'shippingAddressId', repo: this.addressRepository, name: 'Shipping Address' },
      {
        field: 'dispatchWarehouseId',
        repo: this.warehouseRepository,
        name: 'Dispatch Warehouse',
        optional: true,
      },
      { field: 'dispatchShopId', repo: this.shopRepository, name: 'Dispatch Shop', optional: true },
    ];

    const validationPromises = validations.map(async ({ field, repo, name, optional }) => {
      const value = input[field as keyof typeof input] as number;
      if (!value && optional) return;
      if (value && !(await repo.findById(value))) {
        throw new BadRequestError(`${name} with ID ${value} not found.`);
      }
    });

    await Promise.all(validationPromises);

    if ('quoteId' in input && input.quoteId) {
      await this.validateQuote(input, isUpdate, orderId);
    }
  }

  /**
   * Validates the quote linked to the order.
   * @param input The order input data.
   * @param isUpdate Indicates if the operation is an update.
   * @param orderId The ID of the order if it's an update.
   */
  private async validateQuote(
    input: CreateSalesOrderInput,
    isUpdate: boolean,
    orderId?: number,
  ): Promise<void> {
    if (!input.quoteId) return;

    const quote = await this.quoteRepository.findById(input.quoteId);
    if (!quote) {
      throw new BadRequestError(`Quote with ID ${input.quoteId} not found.`);
    }

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestError(`Quote ID ${input.quoteId} is not in 'ACCEPTED' status.`);
    }

    const customerId =
      input.customerId ||
      (isUpdate && orderId ? (await this.orderRepository.findById(orderId))?.customerId : null);
    if (customerId && quote.customerId !== customerId) {
      throw new BadRequestError(
        `Quote ID ${input.quoteId} does not belong to customer ID ${customerId}.`,
      );
    }
  }

  /**
   * Validates dispatch rules (warehouse or shop, not both).
   * @param input The order input data.
   */
  private validateDispatchRules(input: CreateSalesOrderInput | UpdateSalesOrderInput): void {
    const hasWarehouse = 'dispatchWarehouseId' in input && input.dispatchWarehouseId;
    const hasShop = 'dispatchShopId' in input && input.dispatchShopId;

    if (hasWarehouse && hasShop) {
      throw new BadRequestError('Provide either dispatchWarehouseId or dispatchShopId, not both.');
    }
  }

  /**
   * Validates the order items.
   * @param input The order input data.
   * @param isUpdate Indicates if the operation is an update.
   * @param orderId The ID of the order if it's an update.
   */
  private async validateOrderItems(
    input: CreateSalesOrderInput | UpdateSalesOrderInput,
    isUpdate: boolean,
    orderId?: number,
  ): Promise<void> {
    if (!('items' in input) || !input.items) return;

    const isDraft = isUpdate
      ? (await this.orderRepository.findById(orderId!))?.status === SalesOrderStatus.DRAFT
      : (input as CreateSalesOrderInput).status === SalesOrderStatus.DRAFT;

    if (!isDraft && input.items.length === 0) {
      throw new BadRequestError(
        'A sales order must have at least one item unless it is in DRAFT status.',
      );
    }

    await Promise.all(input.items.map((item) => this.validateSingleItem(item, isUpdate)));
  }

  /**
   * Validates a single order item.
   * @param itemInput The item input data.
   * @param isUpdate Indicates if the operation is an update.
   */
  private async validateSingleItem(itemInput: any, isUpdate: boolean): Promise<void> {
    if (itemInput._delete && isUpdate) return;

    const productId =
      itemInput.productId ??
      (isUpdate && itemInput.id
        ? (await this.itemRepository.findById(itemInput.id))?.productId
        : null);

    if (!productId && !itemInput.id) {
      throw new BadRequestError('Item is missing productId for new item.');
    }

    if (productId) {
      await this.validateItemProduct(itemInput, productId);
    }

    this.validateItemValues(itemInput);
  }

  /**
   * Validates the product associated with an order item.
   * @param itemInput The item input data.
   * @param productId The ID of the product.
   */
  private async validateItemProduct(itemInput: any, productId: number): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new BadRequestError(`Product with ID ${productId} not found.`);
    }

    if (itemInput.productVariantId) {
      const variant = await this.variantRepository.findById(itemInput.productVariantId);
      if (!variant || variant.productId !== productId) {
        throw new BadRequestError(
          `Product Variant ID ${itemInput.productVariantId} not valid for product ${productId}.`,
        );
      }
    }
  }

  /**
   * Validates the values (quantity, unit price) of an order item.
   * @param itemInput The item input data.
   */
  private validateItemValues(itemInput: any): void {
    if (itemInput.quantity !== undefined && itemInput.quantity <= 0) {
      throw new BadRequestError('Item quantity must be positive.');
    }

    if (itemInput.unitPriceHt !== undefined && itemInput.unitPriceHt < 0) {
      throw new BadRequestError('Item unit price cannot be negative.');
    }
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
   * Builds the order data from the input.
   * @param input The input data for creating the order.
   * @param createdByUserId The ID of the user creating the order.
   * @returns The partial order data.
   */
  private buildOrderData(
    input: CreateSalesOrderInput,
    createdByUserId: number,
  ): Partial<SalesOrder> {
    return {
      ...input,
      orderNumber: this.generateOrderNumber(),
      orderDate: dayjs(input.orderDate).toDate(),
      status: input.status ?? SalesOrderStatus.DRAFT,
      createdByUserId,
      updatedByUserId: createdByUserId,
      items: [],
    };
  }

  /**
   * Saves the order and its items within a transaction.
   * @param manager The EntityManager for the transaction.
   * @param orderData The order data.
   * @param items The order items.
   * @returns The saved order.
   */
  private async saveOrderWithItems(
    manager: EntityManager,
    orderData: Partial<SalesOrder>,
    items?: any[],
  ): Promise<SalesOrder> {
    const orderRepo = manager.getRepository(SalesOrder);
    const itemRepo = manager.getRepository(SalesOrderItem);

    const orderEntity = orderRepo.create(orderData);
    const savedOrder = await orderRepo.save(orderEntity);

    if (items?.length) {
      const salesOrderItems = await this.createOrderItems(itemRepo, items, savedOrder.id);
      await itemRepo.save(salesOrderItems);
      savedOrder.items = salesOrderItems;
    }

    savedOrder.calculateTotals();
    return orderRepo.save(savedOrder);
  }

  /**
   * Creates the sales order item entities.
   * @param itemRepo The sales order item repository.
   * @param items The input data for the items.
   * @param orderId The ID of the parent order.
   * @returns An array of SalesOrderItem entities.
   */
  private async createOrderItems(
    itemRepo: Repository<SalesOrderItem>,
    items: CreateSalesOrderItemInput[],
    orderId: number,
  ): Promise<SalesOrderItem[]> {
    const itemPromises = items.map(async (itemInput) => {
      const product = await this.productRepository.findById(itemInput.productId);
      let variantName: string | undefined;

      if (itemInput.productVariantId) {
        const variant = await this.variantRepository.findById(itemInput.productVariantId);
        variantName = variant?.nameVariant;
      }

      return itemRepo.create({
        ...itemInput,
        salesOrderId: orderId,
        description: itemInput.description ?? variantName ?? product?.name,
        vatRatePercentage: itemInput.vatRatePercentage ?? product?.defaultVatRatePercentage,
      });
    });

    return (await Promise.all(itemPromises)).flat();
  }

  /**
   * Retrieves an order for update.
   * @param manager The EntityManager for the transaction.
   * @param id The ID of the order.
   * @returns The sales order.
   */
  private async getOrderForUpdate(manager: EntityManager, id: number): Promise<SalesOrder> {
    const orderRepo = manager.getRepository(SalesOrder);
    const order = await orderRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundError(`Sales order with id ${id} not found.`);
    }

    return order;
  }

  /**
   * Validates if an order can be updated based on its status.
   * @param order The sales order.
   */
  private validateOrderCanBeUpdated(order: SalesOrder): void {
    const nonUpdatableStatuses = [
      SalesOrderStatus.FULLY_SHIPPED,
      SalesOrderStatus.COMPLETED,
      SalesOrderStatus.CANCELLED,
    ];

    if (nonUpdatableStatuses.includes(order.status)) {
      throw new ForbiddenError(`Cannot update sales order in '${order.status}' status.`);
    }
  }

  /**
   * Performs the update of the order and its items.
   * @param manager The EntityManager for the transaction.
   * @param existingOrder The existing order.
   * @param input The input data for the update.
   * @param updatedByUserId The ID of the user updating the order.
   * @returns The updated sales order.
   */
  private async performUpdate(
    manager: EntityManager,
    existingOrder: SalesOrder,
    input: UpdateSalesOrderInput,
    updatedByUserId: number,
  ): Promise<SalesOrder> {
    Object.assign(existingOrder, {
      ...input,
      updatedByUserId,
      updatedAt: new Date(),
      orderDate: input.orderDate ? dayjs(input.orderDate).toDate() : existingOrder.orderDate,
    });

    if (input.items) {
      await this.updateOrderItems(
        manager,
        existingOrder,
        input.items
          .filter(
            (item) =>
              item.productId !== undefined &&
              item.quantity !== undefined &&
              item.unitPriceHt !== undefined &&
              item.discountPercentage !== undefined,
          )
          .map((item) => ({
            ...item,
            productId: item.productId as number,
            quantity: item.quantity as number,
            unitPriceHt: item.unitPriceHt as number,
            discountPercentage: item.discountPercentage as number,
          })),
      );
    }

    existingOrder.calculateTotals();
    return manager.getRepository(SalesOrder).save(existingOrder);
  }

  /**
   * Updates the items of a sales order.
   * @param manager The EntityManager for the transaction.
   * @param order The sales order.
   * @param itemInputs The input data for the items to update.
   */
  private async updateOrderItems(
    manager: EntityManager,
    order: SalesOrder,
    itemInputs: (CreateSalesOrderItemInput & { id?: number; _delete?: boolean })[],
  ): Promise<void> {
    const itemRepo = manager.getRepository(SalesOrderItem);
    const itemsToSave: SalesOrderItem[] = [];
    const itemsToDelete = itemInputs
      .filter((item) => item._delete && item.id)
      .map((item) => item.id)
      .filter((id): id is number => id !== undefined);

    if (itemsToDelete.length > 0) {
      await itemRepo.delete(itemsToDelete);
    }

    for (const itemInput of itemInputs.filter((item) => !item._delete)) {
      if (itemInput.id) {
        const existingItem = order.items.find((item) => item.id === itemInput.id);
        if (existingItem) {
          Object.assign(existingItem, itemInput);
          itemsToSave.push(existingItem);
        }
      } else {
        const newItem = await this.createNewOrderItem(itemRepo, itemInput, order.id);
        itemsToSave.push(newItem);
      }
    }

    if (itemsToSave.length > 0) {
      await itemRepo.save(itemsToSave);
    }

    order.items = await itemRepo.find({
      where: { salesOrderId: order.id, deletedAt: IsNull() },
    });
  }

  /**
   * Creates a new sales order item.
   * @param itemRepo The sales order item repository.
   * @param itemInput The input data for the new item.
   * @param orderId The ID of the parent order.
   * @returns The new sales order item.
   */
  private async createNewOrderItem(
    itemRepo: Repository<SalesOrderItem>,
    itemInput: CreateSalesOrderItemInput,
    orderId: number,
  ): Promise<SalesOrderItem> {
    const product = await this.productRepository.findById(itemInput.productId);
    let variantName: string | null = null;

    if (itemInput.productVariantId) {
      const variant = await this.variantRepository.findById(itemInput.productVariantId);
      variantName = variant?.nameVariant ?? null;
    }

    return itemRepo.create({
      ...itemInput,
      salesOrderId: orderId,
      description: itemInput.description || variantName || product?.name,
      vatRatePercentage: itemInput.vatRatePercentage ?? product?.defaultVatRatePercentage,
    });
  }

  /**
   * Validates the status transition of an order.
   * @param currentStatus The current status of the order.
   * @param newStatus The desired new status.
   */
  private validateStatusTransition(
    currentStatus: SalesOrderStatus,
    newStatus: SalesOrderStatus,
  ): void {
    const finalStatuses = [
      SalesOrderStatus.FULLY_SHIPPED,
      SalesOrderStatus.COMPLETED,
      SalesOrderStatus.CANCELLED,
    ];

    if (finalStatuses.includes(currentStatus) && newStatus !== currentStatus) {
      throw new ForbiddenError(
        `Cannot change status of an order that is already '${currentStatus}'.`,
      );
    }

    if (newStatus === SalesOrderStatus.IN_PREPARATION) {
      const validPreviousStatuses = [SalesOrderStatus.APPROVED, SalesOrderStatus.PAYMENT_RECEIVED];
      if (!validPreviousStatuses.includes(currentStatus)) {
        throw new BadRequestError(
          `Order must be 'APPROVED' or 'PAYMENT_RECEIVED' to move to 'IN_PREPARATION'.`,
        );
      }
    }
  }

  /**
   * Handles status-specific actions for the order.
   * @param order The sales order.
   * @param newStatus The new status of the order.
   */
  private async handleStatusSpecificActions(
    order: SalesOrder,
    newStatus: SalesOrderStatus,
    updatedByUserId: number,
    manager: EntityManager,
  ): Promise<void> {
    const locationId = order.dispatchWarehouseId ?? order.dispatchShopId;

    if (!locationId) {
      logger.warn(`Order ${order.id} has no dispatch location, cannot perform stock movements.`);
      return;
    }

    if ([SalesOrderStatus.APPROVED, SalesOrderStatus.IN_PREPARATION].includes(newStatus)) {
      logger.info(`Reserving stock for order ${order.id} moving to ${newStatus}`);
      for (const item of order.items) {
        await this._createStockMovementForOrderItem(
          item,
          locationId,
          updatedByUserId,
          StockMovementType.SALE_DELIVERY,
          `Stock reserved for Sales Order ${order.orderNumber} (Item: ${item.id})`,
          manager,
        );
      }
    }

    if (
      newStatus === SalesOrderStatus.CANCELLED &&
      [
        SalesOrderStatus.APPROVED,
        SalesOrderStatus.IN_PREPARATION,
        SalesOrderStatus.PAYMENT_RECEIVED,
      ].includes(order.status)
    ) {
      logger.info(`Un-reserving stock for cancelled order ${order.id}`);
      for (const item of order.items) {
        await this._createStockMovementForOrderItem(
          item,
          locationId,
          updatedByUserId,
          StockMovementType.CUSTOMER_RETURN,
          `Stock un-reserved for cancelled Sales Order ${order.orderNumber} (Item: ${item.id})`,
          manager,
        );
      }
    }
  }

  /**
   * Creates a stock movement for a given sales order item.
   * @param item The sales order item.
   * @param locationId The ID of the warehouse or shop.
   * @param userId The ID of the user performing the movement.
   * @param movementType The type of stock movement.
   * @param notes Additional notes for the movement.
   * @param manager The EntityManager for the transaction.
   */
  private async _createStockMovementForOrderItem(
    item: SalesOrderItem,
    locationId: number,
    userId: number,
    movementType: StockMovementType,
    notes: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.stockMovementService.createMovement(
      {
        productId: item.productId,
        productVariantId: item.productVariantId ?? undefined,
        quantity: item.quantity,
        movementType,
        warehouseId: locationId,
        shopId: locationId,
        userId,
        referenceDocumentType: 'sales_order_item',
        referenceDocumentId: item.id,
        notes,
      },
      manager,
    );
  }

  /**
   * Checks if an order can be deleted based on its status.
   * @param status The status of the order.
   * @returns True if the order can be deleted, false otherwise.
   */
  private canDeleteOrder(status: SalesOrderStatus): boolean {
    return [SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED].includes(status);
  }

  /**
   * Retrieves a quote for conversion to an order.
   * @param quoteId The ID of the quote.
   * @returns The quote with its relations.
   */
  private async getQuoteForConversion(quoteId: number): Promise<any> {
    const quote = await this.quoteRepository.findById(quoteId, {
      relations: [
        'items',
        'items.product',
        'items.productVariant',
        'customer',
        'currency',
        'billingAddress',
        'shippingAddress',
      ],
    });

    if (!quote) {
      throw new NotFoundError(`Quote with ID ${quoteId} not found.`);
    }

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestError(
        `Quote must be in 'ACCEPTED' status to be converted. Current status: ${quote.status}`,
      );
    }

    return quote;
  }

  /**
   * Builds order input data from a quote.
   * @param quote The quote to build the order from.
   * @returns The input data for creating a sales order.
   */
  private buildOrderInputFromQuote(quote: any): CreateSalesOrderInput {
    return {
      customerId: quote.customerId,
      quoteId: quote.id,
      orderDate: new Date(),
      status: SalesOrderStatus.DRAFT,
      currencyId: quote.currencyId,
      shippingFeesHt: 0,
      shippingAddressId:
        quote.shippingAddressId ??
        quote.customer.defaultShippingAddressId ??
        quote.billingAddressId,
      billingAddressId: quote.billingAddressId ?? quote.customer.billingAddressId,
      dispatchWarehouseId: null,
      dispatchShopId: null,
      notes: `Converted from Quote ${quote.quoteNumber}. ${quote.notes ?? ''}`.trim(),
      items: quote.items.map((item: any) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
        description: item.description ?? item.productVariant?.nameVariant ?? item.product?.name,
        quantity: Number(item.quantity),
        unitPriceHt: Number(item.unitPriceHt),
        discountPercentage: Number(item.discountPercentage ?? 0),
        vatRatePercentage:
          item.vatRatePercentage !== null
            ? Number(item.vatRatePercentage)
            : item.product?.defaultVatRatePercentage,
      })),
    };
  }

  /**
   * Updates the status of a quote.
   * @param manager The EntityManager for the transaction.
   * @param quoteId The ID of the quote to update.
   * @param status The new status of the quote.
   * @param updatedByUserId The ID of the user updating the quote.
   */
  private async updateQuoteStatus(
    manager: EntityManager,
    quoteId: number,
    status: QuoteStatus,
    updatedByUserId: number,
  ): Promise<void> {
    const quoteRepo = manager.getRepository(Quote);
    await quoteRepo.update(quoteId, { status, updatedByUserId });
  }

  /**
   * Retrieves the API response for a sales order.
   * @param orderId The ID of the order.
   * @param manager The EntityManager (optional) for the transaction.
   * @returns The sales order as an API response.
   */
  private async getOrderResponse(
    orderId: number,
    manager?: EntityManager,
  ): Promise<SalesOrderApiResponse> {
    const order = await this.orderRepository.findById(orderId, {
      transactionalEntityManager: manager,
    });
    if (!order) {
      throw new ServerError(`Failed to retrieve order ${orderId}.`);
    }
    return this.mapToApiResponse(order);
  }

  /**
   * Generates a unique order number.
   * @returns The generated order number.
   */
  private generateOrderNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `SO-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Maps a SalesOrder entity to a SalesOrderApiResponse.
   * @param order The SalesOrder entity to map.
   * @returns The API response for the order.
   */
  private mapToApiResponse(order: SalesOrder | null): SalesOrderApiResponse {
    if (!order) {
      throw new ServerError('Failed to map order to API response: order is null.');
    }
    return order.toApi();
  }

  // ===== SINGLETON PATTERN =====

  /**
   * Returns the singleton instance of SalesOrderService.
   * @returns The SalesOrderService instance.
   */
  static getInstance(): SalesOrderService {
    instance ??= new SalesOrderService();

    return instance;
  }
}
