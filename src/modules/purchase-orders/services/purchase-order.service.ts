import { appDataSource } from '@/database/data-source';
import { IsNull, type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { SupplierRepository } from '../../suppliers/data/supplier.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { WarehouseRepository } from '../../warehouses/data/warehouse.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { UserRepository } from '../../users/data/users.repository';

import {
  PurchaseOrder,
  type CreatePurchaseOrderInput,
  type UpdatePurchaseOrderInput,
  type PurchaseOrderApiResponse,
  PurchaseOrderStatus,
  purchaseOrderValidationInputErrors,
} from '../models/purchase-order.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { PurchaseOrderRepository } from '../data/purchase-order.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { PurchaseOrderItemRepository } from '../purchase-order-items/data/purchase-order-item.repository';
import { PurchaseOrderItem } from '../purchase-order-items/models/purchase-order-item.entity';

// TODO: Dépendance - Importer PurchaseReceptionRepository, SupplierInvoiceRepository pour les vérifications
// import { PurchaseReceptionRepository } from '../../purchase-receptions/data/purchase_reception.repository';
// import { SupplierInvoiceRepository } from '../../supplier-invoices/data/supplier-invoice.repository';

let instance: PurchaseOrderService | null = null;

export class PurchaseOrderService {
  private readonly orderRepository: PurchaseOrderRepository;
  private readonly itemRepository: PurchaseOrderItemRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly addressRepository: AddressRepository;
  private readonly warehouseRepository: WarehouseRepository;
  private readonly shopRepository: ShopRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly userRepository: UserRepository;
  // TODO: Dépendance - private readonly receptionRepository: PurchaseReceptionRepository;
  // TODO: Dépendance - private readonly supplierInvoiceRepository: SupplierInvoiceRepository;

  constructor(
    orderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    itemRepository: PurchaseOrderItemRepository = new PurchaseOrderItemRepository(),
    supplierRepository: SupplierRepository = new SupplierRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    userRepository: UserRepository = new UserRepository(),
    // receptionRepository: PurchaseReceptionRepository = new PurchaseReceptionRepository(),
    // supplierInvoiceRepository: SupplierInvoiceRepository = new SupplierInvoiceRepository(),
  ) {
    this.orderRepository = orderRepository;
    this.itemRepository = itemRepository;
    this.supplierRepository = supplierRepository;
    this.currencyRepository = currencyRepository;
    this.addressRepository = addressRepository;
    this.warehouseRepository = warehouseRepository;
    this.shopRepository = shopRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.userRepository = userRepository;
    // TODO: this.receptionRepository = receptionRepository;
    // TODO: this.supplierInvoiceRepository = supplierInvoiceRepository;
  }

  mapToApiResponse(order: PurchaseOrder | null): PurchaseOrderApiResponse | null {
    if (!order) return null;
    return order.toApi();
  }

  private async generateOrderNumber(): Promise<string> {
    const datePrefix = dayjs().format('YYYYMMDD');
    const prefix = `PO-${datePrefix}-`;

    const lastNumberStr = await this.orderRepository.findLastOrderNumber(prefix);
    let nextSeq = 1;
    if (lastNumberStr) {
      const lastSeq = parseInt(lastNumberStr.substring(prefix.length), 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private async validatePurchaseOrderInput(
    input: CreatePurchaseOrderInput | UpdatePurchaseOrderInput,
    isUpdate: boolean = false,
    orderId?: number,
  ) {
    if (input.supplierId) {
      if (!(await this.supplierRepository.findById(input.supplierId))) {
        throw new BadRequestError(`Supplier with ID ${input.supplierId} not found.`);
      }
    }
    if (input.currencyId) {
      if (!(await this.currencyRepository.findById(input.currencyId))) {
        throw new BadRequestError(`Currency with ID ${input.currencyId} not found.`);
      }
    }
    if (input.shippingAddressId) {
      if (!(await this.addressRepository.findById(input.shippingAddressId))) {
        throw new BadRequestError(`Shipping Address with ID ${input.shippingAddressId} not found.`);
      }
    }
    if (input.warehouseIdForDelivery) {
      if (!(await this.warehouseRepository.findById(input.warehouseIdForDelivery))) {
        throw new BadRequestError(
          `Delivery Warehouse with ID ${input.warehouseIdForDelivery} not found.`,
        );
      }
    }
    if (input.shopIdForDelivery) {
      if (!(await this.shopRepository.findById(input.shopIdForDelivery))) {
        throw new BadRequestError(`Delivery Shop with ID ${input.shopIdForDelivery} not found.`);
      }
    }
    if (
      input.hasOwnProperty('items') &&
      (!input.items || input.items.length === 0) &&
      input.status !== PurchaseOrderStatus.DRAFT
    ) {
      throw new BadRequestError('A non-draft purchase order must have at least one item.');
    }

    if (input.items) {
      for (const itemInput of input.items) {
        if ((itemInput as any)._delete) continue;

        const productId =
          (itemInput as any).productId ||
          (isUpdate && orderId
            ? (await this.itemRepository.findById((itemInput as any).id))?.productId
            : undefined);
        if (!productId) {
          throw new BadRequestError('Item is missing productId.');
        }

        const product = await this.productRepository.findById(productId);
        if (!product) {
          throw new BadRequestError(`Product with ID ${productId} not found for an item.`);
        }

        if (itemInput.productVariantId) {
          const variant = await this.variantRepository.findById(itemInput.productVariantId);
          if (!variant || variant.productId !== productId) {
            throw new BadRequestError(
              `Product Variant ID ${itemInput.productVariantId} not found or does not belong to product ${productId}.`,
            );
          }
        }
        if (itemInput.quantity !== undefined && itemInput.quantity <= 0) {
          throw new BadRequestError(`Item quantity for product ID ${productId} must be positive.`);
        }
        if (itemInput.unitPriceHt !== undefined && itemInput.unitPriceHt < 0) {
          throw new BadRequestError(
            `Item unit price for product ID ${productId} cannot be negative.`,
          );
        }
      }
    }
  }

  async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    createdByUserId: number,
  ): Promise<PurchaseOrderApiResponse> {
    try {
      await this.validatePurchaseOrderInput(input);

      const createdByUser = await this.userRepository.findById(createdByUserId);
      if (!createdByUser)
        throw new BadRequestError(`Creating User with ID ${createdByUserId} not found.`);

      return appDataSource.transaction(async (transactionalEntityManager) => {
        const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);

        const orderEntity = orderRepoTx.create({
          ...input,
          orderNumber: await this.generateOrderNumber(),
          orderDate: dayjs(input.orderDate).toDate(),
          expectedDeliveryDate: input.expectedDeliveryDate
            ? dayjs(input.expectedDeliveryDate).toDate()
            : null,
          status: input.status || PurchaseOrderStatus.DRAFT,
          createdByUserId: createdByUserId,
          updatedByUserId: createdByUserId,
          items: [],
        });

        // Validate the main entity instance
        const tempOrderForValidation = this.orderRepository.create(orderEntity);

        if (!tempOrderForValidation.isValid()) {
          throw new BadRequestError(
            `Purchase order data is invalid. Errors: ${purchaseOrderValidationInputErrors.join(', ')}`,
          );
        }

        // First save the PO header to get an ID
        const savedOrderHeader = await orderRepoTx.save(orderEntity);

        const purchaseOrderItems: PurchaseOrderItem[] = [];
        if (input.items && input.items.length > 0) {
          for (const itemInput of input.items) {
            const product = await this.productRepository.findById(itemInput.productId);
            if (!product) {
              throw new BadRequestError(
                `Product with ID ${itemInput.productId} not found for an item.`,
              );
            }
            let variantName: string | undefined;
            if (itemInput.productVariantId) {
              const variant = await this.variantRepository.findById(itemInput.productVariantId);
              if (!variant || variant.productId !== itemInput.productId) {
                throw new BadRequestError(
                  `Product Variant ID ${itemInput.productVariantId} not found or does not belong to product ${itemInput.productId}.`,
                );
              }
              variantName = variant.nameVariant;
            }

            const lineTotalHt = Number(itemInput.quantity) * Number(itemInput.unitPriceHt);

            const itemEntity = itemRepoTx.create({
              ...itemInput,
              purchaseOrderId: savedOrderHeader.id,
              description: itemInput.description || variantName || product.name,
              vatRatePercentage:
                itemInput.vatRatePercentage !== undefined
                  ? itemInput.vatRatePercentage
                  : product.defaultVatRatePercentage,
              totalLineAmountHt: parseFloat(lineTotalHt.toFixed(4)),
            });
            if (!itemEntity.isValid()) {
              throw new BadRequestError(
                `Invalid data for purchase order item (Product ID: ${itemInput.productId}).`,
              );
            }
            purchaseOrderItems.push(itemEntity);
          }
          await itemRepoTx.save(purchaseOrderItems);
          savedOrderHeader.items = purchaseOrderItems;
        }

        savedOrderHeader.calculateTotals();
        await orderRepoTx.save(savedOrderHeader);

        const populatedOrder = await orderRepoTx.findOne({
          where: { id: savedOrderHeader.id, deletedAt: IsNull() },
          relations: this.orderRepository['getDefaultRelationsForFindOne'](),
        });
        const apiResponse = this.mapToApiResponse(populatedOrder);
        if (!apiResponse)
          throw new ServerError(`Failed to map created purchase order ${savedOrderHeader.id}.`);
        return apiResponse;
      });
    } catch (error) {
      logger.error(
        { message: `Error creating purchase order`, error, input, createdByUserId },
        'PurchaseOrderService.createPurchaseOrder',
      );
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError('Failed to create purchase order due to an unexpected error.');
    }
  }

  async findPurchaseOrderById(
    id: number,
    requestingUserId: number,
  ): Promise<PurchaseOrderApiResponse> {
    try {
      const order = await this.orderRepository.findById(id);
      if (!order) throw new NotFoundError(`Purchase order with id ${id} not found.`);
      // TODO: Authorization - Check if user can view this PO

      const apiResponse = this.mapToApiResponse(order);
      if (!apiResponse) throw new ServerError(`Failed to map purchase order ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding purchase order by id ${id}`, error },
        'PurchaseOrderService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding purchase order by id ${id}.`);
    }
  }

  async findAllPurchaseOrders(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<PurchaseOrder> | FindOptionsWhere<PurchaseOrder>[];
    sort?: FindManyOptions<PurchaseOrder>['order'];
    searchTerm?: string;
  }): Promise<{ orders: PurchaseOrderApiResponse[]; total: number }> {
    try {
      const { orders, count } = await this.orderRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { orderDate: 'DESC', createdAt: 'DESC' },
        searchTerm: options?.searchTerm,
        relations: this.orderRepository['getDefaultRelationsForFindAll'](),
      });
      const apiOrders = orders
        .map((o) => this.mapToApiResponse(o))
        .filter(Boolean) as PurchaseOrderApiResponse[];
      return { orders: apiOrders, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all purchase orders`, error, options },
        'PurchaseOrderService.findAll',
      );
      throw new ServerError('Error finding all purchase orders.');
    }
  }

  async updatePurchaseOrder(
    id: number,
    input: UpdatePurchaseOrderInput,
    updatedByUserId: number,
  ): Promise<PurchaseOrderApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const orderRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
      const itemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);

      const order = await orderRepoTx.findOne({
        where: { id, deletedAt: IsNull() },
        relations: [
          'items',
          'supplier',
          'currency',
          'shippingAddress',
          'warehouseForDelivery',
          'shopForDelivery',
          'createdByUser',
          'approvedByUser',
        ],
      });
      if (!order) throw new NotFoundError(`Purchase order with id ${id} not found.`);

      if (
        order.status !== PurchaseOrderStatus.DRAFT &&
        order.status !== PurchaseOrderStatus.PENDING_APPROVAL
      ) {
        const allowedUpdates = ['notes', 'expectedDeliveryDate', 'status'];
        for (const key in input) {
          if (!allowedUpdates.includes(key) && input.hasOwnProperty(key) && key !== 'items') {
            throw new ForbiddenError(
              `Cannot update field '${key}' for a purchase order in status '${order.status}'.`,
            );
          }
        }
      }

      await this.validatePurchaseOrderInput(input, true, id);

      // Update header fields
      const headerUpdatePayload: Partial<PurchaseOrder> = { updatedByUserId };
      if (input.orderDate) headerUpdatePayload.orderDate = dayjs(input.orderDate).toDate();
      if (input.hasOwnProperty('expectedDeliveryDate'))
        headerUpdatePayload.expectedDeliveryDate = input.expectedDeliveryDate
          ? dayjs(input.expectedDeliveryDate).toDate()
          : null;
      if (input.status) headerUpdatePayload.status = input.status;
      if (input.currencyId) headerUpdatePayload.currencyId = input.currencyId;

      headerUpdatePayload.shippingAddressId = input.hasOwnProperty('shippingAddressId')
        ? input.shippingAddressId
        : order.shippingAddressId;
      headerUpdatePayload.warehouseIdForDelivery = input.hasOwnProperty('warehouseIdForDelivery')
        ? input.warehouseIdForDelivery
        : order.warehouseIdForDelivery;
      headerUpdatePayload.shopIdForDelivery = input.hasOwnProperty('shopIdForDelivery')
        ? input.shopIdForDelivery
        : order.shopIdForDelivery;

      if (input.hasOwnProperty('notes')) {
        headerUpdatePayload.notes = input.notes;
      }

      const tempOrderForValidation = this.orderRepository.create({
        ...order,
        ...headerUpdatePayload,
      });
      if (!tempOrderForValidation.isValid()) {
        throw new BadRequestError(
          `Updated purchase order data is invalid. Errors: ${purchaseOrderValidationInputErrors.join(', ')}`,
        );
      }
      await orderRepoTx.update(id, headerUpdatePayload);

      const reloadedOrder = await orderRepoTx.findOne({
        where: { id, deletedAt: IsNull() },
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'shippingAddress',
          'warehouseForDelivery',
          'shopForDelivery',
          'supplier',
          'currency',
          'createdByUser',
          'approvedByUser',
        ],
      });
      if (!reloadedOrder) throw new ServerError('Failed to re-fetch order after header update.');

      if (input.items) {
        const existingItemsMap = new Map(reloadedOrder.items?.map((item) => [item.id, item]));

        for (const itemInput of input.items) {
          const product = await this.productRepository.findById(itemInput.productId as number);
          if (!product && !itemInput.id)
            throw new BadRequestError(
              `Product with ID ${itemInput.productId} not found for new item.`,
            );

          const itemData = {
            ...itemInput,
            purchaseOrderId: id,
            description:
              itemInput.description ||
              (itemInput.productVariantId
                ? (await this.variantRepository.findById(itemInput.productVariantId))?.nameVariant
                : product?.name),
            vatRatePercentage:
              itemInput.vatRatePercentage !== undefined
                ? itemInput.vatRatePercentage
                : (product?.defaultVatRatePercentage ?? 0),
          };

          if (itemInput.id) {
            // Update existing item
            const existingItem = existingItemsMap.get(itemInput.id);
            if (!existingItem)
              throw new NotFoundError(
                `Purchase order item with ID ${itemInput.id} not found on this order.`,
              );
            if ((itemInput as any)._delete === true) {
              await itemRepoTx.remove(existingItem);
              continue;
            }
            const updatedItemEntity = itemRepoTx.merge(
              existingItem,
              itemData as Partial<PurchaseOrderItem>,
            );
            if (!updatedItemEntity.isValid()) {
              throw new BadRequestError(`Invalid data for item ID ${itemInput.id}.`);
            }
            await itemRepoTx.save(updatedItemEntity);
          } else if (!(itemInput as any)._delete) {
            // Add new item
            if (!itemInput.productId)
              throw new BadRequestError('productId is required for new items.');
            const newItemEntity = itemRepoTx.create(itemData as Partial<PurchaseOrderItem>);
            if (!newItemEntity.isValid()) {
              throw new BadRequestError(
                `Invalid data for new item (Product ID: ${itemInput.productId}).`,
              );
            }
            await itemRepoTx.save(newItemEntity);
          }
        }
        reloadedOrder.items = await itemRepoTx.find({
          where: { purchaseOrderId: id, deletedAt: IsNull() },
          relations: ['product', 'productVariant'],
        });
      }

      reloadedOrder.calculateTotals();
      await orderRepoTx.save(reloadedOrder);

      const populatedOrder = await orderRepoTx.findOne({
        where: { id, deletedAt: IsNull() },
        relations: this.orderRepository['getDefaultRelationsForFindOne'](),
      });
      const apiResponse = this.mapToApiResponse(populatedOrder);
      if (!apiResponse) throw new ServerError(`Failed to map updated purchase order ${id}.`);
      return apiResponse;
    });
  }

  async updatePurchaseOrderStatus(
    id: number,
    status: PurchaseOrderStatus,
    updatedByUserId: number,
    approvedByUserId?: number,
  ): Promise<PurchaseOrderApiResponse> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundError(`Purchase order with id ${id} not found.`);

    if (!Object.values(PurchaseOrderStatus).includes(status)) {
      throw new BadRequestError(`Invalid status: '${status}'.`);
    }

    if (
      order.status === PurchaseOrderStatus.FULLY_RECEIVED &&
      status !== PurchaseOrderStatus.FULLY_RECEIVED
    ) {
      throw new BadRequestError(`Cannot change status of a fully received order (ID: ${id}).`);
    }
    if (
      order.status === PurchaseOrderStatus.CANCELLED &&
      status !== PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestError(`Cannot change status of a cancelled order (ID: ${id}).`);
    }

    const updatePayload: Partial<PurchaseOrder> = { status, updatedByUserId };
    if (status === PurchaseOrderStatus.APPROVED && !order.approvedByUserId) {
      if (!approvedByUserId)
        throw new BadRequestError('approvedByUserId is required when approving an order.');
      const approver = await this.userRepository.findById(approvedByUserId);
      if (!approver)
        throw new BadRequestError(`Approving user with ID ${approvedByUserId} not found.`);
      updatePayload.approvedByUserId = approvedByUserId;
    }
    // If moving away from approved, clear approver? Business rule.
    // if (order.status === PurchaseOrderStatus.APPROVED && status !== PurchaseOrderStatus.APPROVED) {
    //     updatePayload.approvedByUserId = null;
    // }

    await this.orderRepository.update(id, updatePayload);

    const updatedOrder = await this.orderRepository.findById(id);
    const apiResponse = this.mapToApiResponse(updatedOrder);
    if (!apiResponse) throw new ServerError(`Failed to map PO ${id} after status update.`);
    return apiResponse;
  }

  async deletePurchaseOrder(id: number, deletedByUserId: number): Promise<void> {
    try {
      const order = await this.orderRepository.findById(id);
      if (!order) throw new NotFoundError(`Purchase order with id ${id} not found.`);

      if (
        order.status !== PurchaseOrderStatus.DRAFT &&
        order.status !== PurchaseOrderStatus.CANCELLED
      ) {
        throw new BadRequestError(
          `Purchase order in status '${order.status}' cannot be deleted. Cancel it first if applicable.`,
        );
      }

      // TODO: Dépendance - Vérifier si la commande est liée à des réceptions ou factures non annulées
      // const isLinked = await this.orderRepository.isPurchaseOrderLinkedToReceptionOrInvoice(id);
      // if (isLinked) {
      //   throw new BadRequestError(`Purchase order '${order.orderNumber}' has associated receptions or invoices and cannot be deleted.`);
      // }

      // Soft delete of PurchaseOrder should cascade to PurchaseOrderItems if TypeORM relation is set with cascade and softDelete.
      // If not, items would need to be manually soft-deleted or hard-deleted here within a transaction.
      // Our PurchaseOrderItem does not extend Model with softDelete, so they are hard-deleted by cascade if set.
      // If cascade remove is set on PO.items, this will hard delete items.
      await this.orderRepository.softDelete(id);
      // await this.orderRepository.update(id, { updatedByUserId: deletedByUserId }); // Audit
    } catch (error) {
      logger.error(
        { message: `Error deleting purchase order ${id}`, error },
        'PurchaseOrderService.delete',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting purchase order ${id}.`);
    }
  }

  static getInstance(): PurchaseOrderService {
    if (!instance) {
      instance = new PurchaseOrderService();
    }
    return instance;
  }
}
