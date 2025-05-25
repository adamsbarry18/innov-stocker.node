import { appDataSource } from '@/database/data-source';
import { SupplierRepository } from '../../suppliers/data/supplier.repository';
import { WarehouseRepository } from '../../warehouses/data/warehouse.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { UserRepository } from '../../users/data/users.repository';
// TODO: Dépendance - Importer StockMovementService ou Repository
// import { StockMovementService } from '../../stock-movements/services/stock-movement.service';

import {
  PurchaseReception,
  type CreatePurchaseReceptionInput,
  type UpdatePurchaseReceptionInput,
  type PurchaseReceptionApiResponse,
  PurchaseReceptionStatus,
  purchaseReceptionValidationInputErrors,
} from '../models/purchase-reception.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import dayjs from 'dayjs';
import { PurchaseReceptionRepository } from '../data/purchase-reception.repository';
import { PurchaseReceptionItemRepository } from '@/modules/purchase-reception-items/data/purchase-reception-item.repository';
import { PurchaseOrderRepository } from '@/modules/purchase-orders/data/purchase-order.repository';
import { PurchaseOrderItemRepository } from '@/modules/purchase-order-items/data/purchase-order-item.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/modules/purchase-orders/models/purchase-order.entity';
import { PurchaseReceptionItem } from '@/modules/purchase-reception-items/models/purchase-reception-item.entity';
import { PurchaseOrderItem } from '@/modules/purchase-order-items/models/purchase-order-item.entity';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import logger from '@/lib/logger';

let instance: PurchaseReceptionService | null = null;

export class PurchaseReceptionService {
  private readonly receptionRepository: PurchaseReceptionRepository;
  private readonly receptionItemRepository: PurchaseReceptionItemRepository;
  private readonly orderRepository: PurchaseOrderRepository;
  private readonly orderItemRepository: PurchaseOrderItemRepository;
  private readonly supplierRepository: SupplierRepository;
  private readonly warehouseRepository: WarehouseRepository;
  private readonly shopRepository: ShopRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly userRepository: UserRepository;
  // TODO: Dépendance - private readonly stockMovementService: StockMovementService;

  constructor(
    receptionRepository: PurchaseReceptionRepository = new PurchaseReceptionRepository(),
    receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
    orderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    orderItemRepository: PurchaseOrderItemRepository = new PurchaseOrderItemRepository(),
    supplierRepository: SupplierRepository = new SupplierRepository(),
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    userRepository: UserRepository = new UserRepository(),
    // stockMovementService: StockMovementService = new StockMovementService(),
  ) {
    this.receptionRepository = receptionRepository;
    this.receptionItemRepository = receptionItemRepository;
    this.orderRepository = orderRepository;
    this.orderItemRepository = orderItemRepository;
    this.supplierRepository = supplierRepository;
    this.warehouseRepository = warehouseRepository;
    this.shopRepository = shopRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.userRepository = userRepository;
    // TODO: this.stockMovementService = stockMovementService;
  }

  mapToApiResponse(reception: PurchaseReception | null): PurchaseReceptionApiResponse | null {
    if (!reception) return null;
    return reception.toApi();
  }

  private async generateReceptionNumber(): Promise<string> {
    const datePrefix = dayjs().format('YYYYMMDD');
    const prefix = `REC-${datePrefix}-`;
    const lastNumberStr = await this.receptionRepository.findLastReceptionNumber(prefix);
    let nextSeq = 1;
    if (lastNumberStr) {
      const lastSeq = parseInt(lastNumberStr.substring(prefix.length), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  /**
   * Validates the input data for a reception, whether for creation or update.
   * Centralizes validation logic for related entities (PO, supplier, warehouse/shop, products/variants).
   * @param input The reception data.
   * @param isUpdate Indicates if the validation is for an update.
   * @param receptionId The reception ID in case of an update.
   * @returns The linked purchase order, if applicable.
   */
  private async validateReceptionInput(
    input: CreatePurchaseReceptionInput | UpdatePurchaseReceptionInput,
    isUpdate: boolean = false,
    receptionId?: number,
  ): Promise<{ purchaseOrder?: PurchaseOrder | null }> {
    let purchaseOrder: PurchaseOrder | null = null;

    if ('purchaseOrderId' in input && input.purchaseOrderId) {
      purchaseOrder = await this.orderRepository.findById(input.purchaseOrderId, {
        relations: ['items', 'items.product', 'items.productVariant'],
      });
      if (!purchaseOrder) {
        throw new NotFoundError(`Purchase Order with ID ${input.purchaseOrderId} not found.`);
      }
      if (
        purchaseOrder.status === PurchaseOrderStatus.CANCELLED ||
        purchaseOrder.status === PurchaseOrderStatus.DRAFT
      ) {
        throw new BadRequestError(
          `Cannot create/update reception for a PO that is in '${purchaseOrder.status}' status.`,
        );
      }
      if (
        input.supplierId !== undefined &&
        input.supplierId !== null &&
        input.supplierId !== purchaseOrder.supplierId
      ) {
        throw new BadRequestError(
          `Supplier ID ${input.supplierId} does not match the supplier ID ${purchaseOrder.supplierId} on the linked Purchase Order ${purchaseOrder.orderNumber}.`,
        );
      }
    } else if ('supplierId' in input && input.supplierId) {
      if (!(await this.supplierRepository.findById(input.supplierId))) {
        throw new NotFoundError(
          `Supplier with ID ${input.supplierId} not found for blind reception.`,
        );
      }
    } else if (
      !isUpdate &&
      (input as CreatePurchaseReceptionInput).purchaseOrderId === undefined &&
      (input as CreatePurchaseReceptionInput).supplierId === undefined
    ) {
      throw new BadRequestError('Either purchaseOrderId or supplierId is required for creation.');
    }

    if (input.warehouseId && input.shopId) {
      throw new BadRequestError('Provide either warehouseId or shopId, not both.');
    }
    if (input.warehouseId) {
      if (!(await this.warehouseRepository.findById(input.warehouseId))) {
        throw new NotFoundError(`Warehouse ID ${input.warehouseId} not found.`);
      }
    }
    if (input.shopId) {
      if (!(await this.shopRepository.findById(input.shopId))) {
        throw new NotFoundError(`Shop ID ${input.shopId} not found.`);
      }
    }
    if (!isUpdate && !input.warehouseId && !input.shopId) {
      throw new BadRequestError(
        'Either warehouseId or shopId must be provided as reception location.',
      );
    }

    if (input.items) {
      for (const itemInput of input.items) {
        if ((itemInput as any)._delete && isUpdate) continue;

        const productId = itemInput.productId;
        const productVariantId = itemInput.productVariantId;

        if (!productId) {
          throw new BadRequestError('Reception item is missing productId.');
        }

        const product = await this.productRepository.findById(productId);
        if (!product) {
          throw new NotFoundError(`Product with ID ${productId} not found for a reception item.`);
        }

        if (productVariantId) {
          const variant = await this.variantRepository.findById(productVariantId);
          if (!variant || variant.productId !== productId) {
            throw new BadRequestError(
              `Variant ID ${productVariantId} not valid for product ${productId}.`,
            );
          }
        }

        if (itemInput.purchaseOrderItemId) {
          const poItem = await this.orderItemRepository.findById(itemInput.purchaseOrderItemId);
          if (!poItem) {
            throw new NotFoundError(
              `Purchase Order Item ID ${itemInput.purchaseOrderItemId} not found.`,
            );
          }
          if (purchaseOrder && poItem.purchaseOrderId !== purchaseOrder.id) {
            throw new BadRequestError(
              `PO Item ID ${itemInput.purchaseOrderItemId} does not belong to linked PO ${purchaseOrder.orderNumber}.`,
            );
          }

          const totalReceivedForThisPoItemExcludingCurrent =
            await this.calculateTotalReceivedForPOItem(itemInput.purchaseOrderItemId, receptionId);

          const totalReceivedIncludingCurrentUpdate =
            totalReceivedForThisPoItemExcludingCurrent + Number(itemInput.quantityReceived);

          if (totalReceivedIncludingCurrentUpdate > Number(poItem.quantity)) {
            throw new BadRequestError(
              `Quantity received (${itemInput.quantityReceived}) for PO item ${itemInput.purchaseOrderItemId}`,
            );
          }
        }
      }
    }
    return { purchaseOrder };
  }

  async calculateTotalReceivedForPOItem(
    purchaseOrderItemId: number,
    excludeReceptionId?: number,
  ): Promise<number> {
    const query = this.receptionItemRepository.createSumQuantityReceivedQuery(
      purchaseOrderItemId,
      excludeReceptionId,
    );
    const result = await query.getRawOne();
    return Number(result?.total || 0);
  }

  async createReception(
    input: CreatePurchaseReceptionInput,
    receivedByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestError('A purchase reception must have at least one item.');
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
      const receptionItemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);

      const { purchaseOrder } = await this.validateReceptionInput(input, false);

      const receivedByUser = await this.userRepository.findById(receivedByUserId);
      if (!receivedByUser) {
        throw new NotFoundError(`Receiving User ID ${receivedByUserId} not found.`);
      }

      let finalSupplierId: number;
      if (input.purchaseOrderId && purchaseOrder) {
        finalSupplierId = purchaseOrder.supplierId;
      } else if (input.supplierId) {
        finalSupplierId = input.supplierId;
      } else {
        throw new BadRequestError('Supplier ID is required for reception creation.');
      }

      const receptionEntityData: Partial<PurchaseReception> = {
        supplierId: finalSupplierId,
        purchaseOrderId: input.purchaseOrderId,
        receptionNumber: await this.generateReceptionNumber(),
        receptionDate: dayjs(input.receptionDate).toDate(),
        warehouseId: input.warehouseId,
        shopId: input.shopId,
        status: input.status || PurchaseReceptionStatus.PENDING_QUALITY_CHECK,
        notes: input.notes,
        receivedByUserId: receivedByUserId,
        updatedByUserId: receivedByUserId,
      };

      const receptionHeader = receptionRepoTx.create(receptionEntityData);
      if (!receptionHeader.isValid()) {
        throw new BadRequestError(
          `Reception data invalid: ${purchaseReceptionValidationInputErrors.join(', ')}`,
        );
      }
      const savedReceptionHeader = await receptionRepoTx.save(receptionHeader);

      const receptionItems: PurchaseReceptionItem[] = [];
      for (const itemInput of input.items) {
        const product = await this.productRepository.findById(itemInput.productId);
        let variantName: string | undefined;
        if (itemInput.productVariantId) {
          const variant = await this.variantRepository.findById(itemInput.productVariantId);
          variantName = variant?.nameVariant;
        }

        const itemEntity = receptionItemRepoTx.create({
          ...itemInput,
          purchaseReceptionId: savedReceptionHeader.id,
          notes: itemInput.notes || variantName || product?.name,
          quantityOrdered: itemInput.purchaseOrderItemId
            ? Number(
                (await this.orderItemRepository.findById(itemInput.purchaseOrderItemId))?.quantity,
              )
            : (itemInput.quantityOrdered ?? null),
        });

        if (!itemEntity.isValid()) {
          throw new BadRequestError(
            `Invalid data for reception item (Product ID: ${itemInput.productId}).`,
          );
        }
        receptionItems.push(itemEntity);
      }
      await receptionItemRepoTx.save(receptionItems);
      const finalSavedReception = await receptionRepoTx.findOne({
        where: { id: savedReceptionHeader.id },
        relations: ['items', 'items.product', 'items.productVariant'],
      });

      if (!finalSavedReception) {
        throw new ServerError(`Failed to retrieve created reception ${savedReceptionHeader.id}.`);
      }

      const apiResponse = this.mapToApiResponse(finalSavedReception);
      if (!apiResponse) {
        throw new ServerError(`Failed to map created reception ${finalSavedReception.id}.`);
      }
      return apiResponse;
    });
  }

  async findReceptionById(id: number): Promise<PurchaseReceptionApiResponse> {
    try {
      const reception = await this.receptionRepository.findById(id, {
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'supplier',
          'warehouse',
          'shop',
          'receivedByUser',
          'purchaseOrder',
          'purchaseOrder.supplier',
        ],
      });
      if (!reception) throw new NotFoundError(`Purchase reception with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(reception);
      if (!apiResponse) throw new ServerError(`Failed to map reception ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(`Error finding reception by id ${id}`, error);
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding reception by id ${id}.`);
    }
  }

  async findAllReceptions(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<PurchaseReception> | FindOptionsWhere<PurchaseReception>[];
    sort?: FindManyOptions<PurchaseReception>['order'];
    searchTerm?: string;
  }): Promise<{ receptions: PurchaseReceptionApiResponse[]; total: number }> {
    try {
      const { receptions, count } = await this.receptionRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { receptionDate: 'DESC', createdAt: 'DESC' },
        searchTerm: options?.searchTerm,
        relations: this.receptionRepository['getDefaultRelationsForFindAll'](),
      });
      const apiReceptions = receptions
        .map((r) => this.mapToApiResponse(r))
        .filter(Boolean) as PurchaseReceptionApiResponse[];
      return { receptions: apiReceptions, total: count };
    } catch (error) {
      logger.error(`Error finding all receptions`, error, options);
      throw new ServerError('Error finding all receptions.');
    }
  }

  async updateReception(
    id: number,
    input: UpdatePurchaseReceptionInput,
    updatedByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    try {
      return await appDataSource.transaction(async (transactionalEntityManager) => {
        const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
        const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);

        const reception = await receptionRepoTx.findOne({
          where: { id },
          relations: ['items', 'items.product', 'items.productVariant'],
        });
        if (!reception) throw new NotFoundError(`Purchase reception with ID ${id} not found.`);

        await this.validateReceptionInput(input, true, id);

        const headerUpdatePayload: Partial<PurchaseReception> = { updatedByUserId };

        if (reception.status !== PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
          if (input.status && input.status !== reception.status) {
            throw new ForbiddenError(
              `Cannot change status from '${reception.status}' to '${input.status}' via generic update. Use specific actions.`,
            );
          }
          const disallowedUpdates = Object.keys(input).filter(
            (key) =>
              key !== 'notes' && key !== 'items' && key !== 'status' && key !== 'updatedByUserId',
          );
          if (disallowedUpdates.length > 0) {
            throw new ForbiddenError(
              `Cannot update fields ${disallowedUpdates.join(', ')} for reception ID ${id} because its status is '${reception.status}'. Only notes can be changed.`,
            );
          }
          if (input.hasOwnProperty('notes')) {
            headerUpdatePayload.notes = input.notes;
          }
        } else {
          if (input.receptionDate)
            headerUpdatePayload.receptionDate = dayjs(input.receptionDate).toDate();
          if (input.hasOwnProperty('warehouseId'))
            headerUpdatePayload.warehouseId = input.warehouseId;
          if (input.hasOwnProperty('shopId')) headerUpdatePayload.shopId = input.shopId;
          if (input.hasOwnProperty('notes')) headerUpdatePayload.notes = input.notes;
          if (input.status) headerUpdatePayload.status = input.status;
        }

        await receptionRepoTx.update(id, headerUpdatePayload);

        if (input.items && reception.status === PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
          const existingItemMap = new Map(reception.items?.map((item) => [item.id, item]));
          const itemsToCreate: PurchaseReceptionItem[] = [];
          const itemsToUpdate: PurchaseReceptionItem[] = [];
          const itemIdsToDelete: number[] = [];

          for (const itemInput of input.items) {
            if ((itemInput as any)._delete) {
              if ((itemInput as any).id) {
                itemIdsToDelete.push((itemInput as any).id);
              }
              continue;
            }

            let itemEntity: PurchaseReceptionItem;
            const currentProductId = itemInput.productId;
            const currentProductVariantId = itemInput.productVariantId;

            if ((itemInput as any).id) {
              const foundItem = existingItemMap.get((itemInput as any).id);
              if (!foundItem) {
                throw new NotFoundError(
                  `Purchase reception item with ID ${(itemInput as any).id} not found for reception ${id}.`,
                );
              }
              itemEntity = foundItem;
              Object.assign(itemEntity, itemInput);
            } else {
              itemEntity = itemRepoTx.create(itemInput);
            }

            if (!currentProductId) {
              throw new BadRequestError('Item is missing productId.');
            }
            const product = await this.productRepository.findById(currentProductId);
            if (!product) {
              throw new NotFoundError(
                `Product with ID ${currentProductId} not found for a reception item.`,
              );
            }
            let variantName: string | undefined;
            if (currentProductVariantId) {
              const variant = await this.variantRepository.findById(currentProductVariantId);
              if (!variant || variant.productId !== currentProductId) {
                throw new BadRequestError(
                  `Variant ID ${currentProductVariantId} not valid for product ${currentProductId}.`,
                );
              }
              variantName = variant.nameVariant;
            }

            itemEntity.productId = currentProductId;
            itemEntity.productVariantId = currentProductVariantId ?? null;
            itemEntity.purchaseReceptionId = id;
            itemEntity.notes = itemInput.notes || variantName || product?.name;
            itemEntity.quantityOrdered = itemInput.purchaseOrderItemId
              ? Number(
                  (await this.orderItemRepository.findById(itemInput.purchaseOrderItemId))
                    ?.quantity,
                )
              : (itemInput.quantityOrdered ?? null);

            if (!itemEntity.isValid()) {
              throw new BadRequestError(
                `Invalid data for reception item (Product ID: ${currentProductId}).`,
              );
            }

            if (itemEntity.id && existingItemMap.has(itemEntity.id)) {
              itemsToUpdate.push(itemEntity);
            } else {
              itemsToCreate.push(itemEntity);
            }
          }

          if (itemIdsToDelete.length > 0) {
            await itemRepoTx.delete(itemIdsToDelete);
          }
          if (itemsToUpdate.length > 0) {
            await itemRepoTx.save(itemsToUpdate);
          }
          if (itemsToCreate.length > 0) {
            await itemRepoTx.save(itemsToCreate);
          }
        } else if (input.items) {
          logger.warn(
            `Attempt to update items for reception ID ${id} in status ${reception.status} was ignored.`,
          );
        }

        const populatedReception = await receptionRepoTx.findOne({
          where: { id },
          relations: [
            'items',
            'items.product',
            'items.productVariant',
            'supplier',
            'warehouse',
            'shop',
            'receivedByUser',
            'purchaseOrder',
            'purchaseOrder.supplier',
          ],
        });
        if (!populatedReception)
          throw new ServerError(`Failed to retrieve updated reception ${id}.`);

        const apiResponse = this.mapToApiResponse(populatedReception);
        if (!apiResponse) throw new ServerError(`Failed to map updated reception ${id}.`);
        return apiResponse;
      });
    } catch (error: any) {
      logger.error(`Unhandled error in updateReception for reception ID ${id}`, error);
      if (
        error instanceof NotFoundError ||
        error instanceof BadRequestError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }
      throw new ServerError(`Error updating reception ${id}. Details: ${error.message}`);
    }
  }

  async validateReception(
    receptionId: number,
    validatedByUserId: number,
  ): Promise<PurchaseReceptionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
      const poRepoTx = transactionalEntityManager.getRepository(PurchaseOrder);
      const poItemRepoTx = transactionalEntityManager.getRepository(PurchaseOrderItem);
      // TODO: Dépendance - const stockMovementService = new StockMovementService(transactionalEntityManager);

      const reception = await receptionRepoTx.findOne({
        where: { id: receptionId },
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'items.purchaseOrderItem',
          'purchaseOrder',
          'purchaseOrder.items',
        ],
      });
      if (!reception) throw new NotFoundError(`Purchase Reception ID ${receptionId} not found.`);
      if (reception.status !== PurchaseReceptionStatus.PENDING_QUALITY_CHECK) {
        throw new BadRequestError(
          `Reception ID ${receptionId} is not in PENDING_QUALITY_CHECK status. Current: ${reception.status}`,
        );
      }
      if (!reception.items || reception.items.length === 0) {
        throw new BadRequestError(`Reception ID ${receptionId} has no items to validate.`);
      }

      for (const recItem of reception.items) {
        if (recItem.purchaseOrderItemId) {
          const poItem = await poItemRepoTx.findOneBy({ id: recItem.purchaseOrderItemId });
          if (poItem) {
            poItem.quantityReceived =
              Number(poItem.quantityReceived || 0) + Number(recItem.quantityReceived);
            await poItemRepoTx.save(poItem);
          } else {
            logger.warn(
              `PO Item ID ${recItem.purchaseOrderItemId} linked to reception item ${recItem.id} not found during validation.`,
            );
          }
        }
        // TODO: Dépendance - Create StockMovement
        logger.info(
          `TODO: Create StockMovement for validated reception item ${recItem.id}: Product ${recItem.productId}, Qty ${recItem.quantityReceived} to Warehouse/Shop ${reception.warehouseId || reception.shopId} by user ${validatedByUserId}`,
        );
      }

      if (reception.purchaseOrder) {
        const po = await poRepoTx.findOne({
          where: { id: reception.purchaseOrderId as number },
          relations: ['items'],
        });
        if (po) {
          let allPoItemsNowFullyReceived = true;
          if (po.items && po.items.length > 0) {
            for (const poItem of po.items) {
              const updatedPoItem = await poItemRepoTx.findOneBy({ id: poItem.id });
              if (
                updatedPoItem &&
                Number(updatedPoItem.quantityReceived) < Number(updatedPoItem.quantity)
              ) {
                allPoItemsNowFullyReceived = false;
                break;
              }
            }
          } else {
            allPoItemsNowFullyReceived = false;
          }

          if (po.status !== PurchaseOrderStatus.FULLY_RECEIVED) {
            po.status = allPoItemsNowFullyReceived
              ? PurchaseOrderStatus.FULLY_RECEIVED
              : PurchaseOrderStatus.PARTIALLY_RECEIVED;
            po.updatedByUserId = validatedByUserId;
            await poRepoTx.save(po);
          }
        }
      }

      reception.status = PurchaseReceptionStatus.COMPLETE;
      reception.updatedByUserId = validatedByUserId;
      await receptionRepoTx.save(reception);

      const populatedReception = await receptionRepoTx.findOne({
        where: { id: receptionId },
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'supplier',
          'warehouse',
          'shop',
          'receivedByUser',
          'purchaseOrder',
          'purchaseOrder.supplier',
        ],
      });
      if (!populatedReception)
        throw new ServerError(`Failed to retrieve validated reception ${receptionId}.`);
      return this.mapToApiResponse(populatedReception) as PurchaseReceptionApiResponse;
    });
  }

  async deleteReception(id: number, deletedByUserId: number): Promise<void> {
    const reception = await this.receptionRepository.findById(id, { relations: ['items'] });
    if (!reception) throw new NotFoundError(`Purchase reception with id ${id} not found.`);

    if (
      reception.status === PurchaseReceptionStatus.COMPLETE ||
      reception.status === PurchaseReceptionStatus.PARTIAL
    ) {
      throw new BadRequestError(
        `Cannot delete a reception that has been processed (status: ${reception.status}). Consider a supplier return or stock adjustment if items were incorrectly received and stock updated.`,
      );
    }
    // TODO: Dépendance - Vérifier si la réception est liée à une facture fournisseur non annulée
    // const isLinkedToInvoice = await this.receptionRepository.isReceptionLinkedToInvoice(id);
    // if (isLinkedToInvoice) {
    //   throw new BadRequestError(`Reception '${reception.receptionNumber}' is linked to a supplier invoice and cannot be deleted.`);
    // }

    try {
      await appDataSource.transaction(async (transactionalEntityManager) => {
        const receptionRepoTx = transactionalEntityManager.getRepository(PurchaseReception);
        // If items are hard-deleted due to cascade on PurchaseReception soft-delete, this is fine.
        // If not, and items should also be soft-deleted:
        // const itemRepoTx = transactionalEntityManager.getRepository(PurchaseReceptionItem);
        // await itemRepoTx.softDelete({ purchaseReceptionId: id });
        await receptionRepoTx.softDelete(id);
      });
    } catch (error) {
      logger.error(`Error deleting purchase reception ${id}`, error);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting purchase reception ${id}.`);
    }
  }

  static getInstance(): PurchaseReceptionService {
    if (!instance) {
      instance = new PurchaseReceptionService();
    }
    return instance;
  }
}
