import { appDataSource } from '@/database/data-source';

import {
  SupplierReturnItem,
  type CreateSupplierReturnItemInput,
  type UpdateSupplierReturnItemInput,
  type SupplierReturnItemApiResponse,
  createSupplierReturnItemSchema,
  updateSupplierReturnItemSchema,
  supplierReturnItemValidationInputErrors,
} from '../index';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type EntityManager, type FindOptionsWhere, IsNull } from 'typeorm';
import { SupplierReturn, SupplierReturnStatus } from '../../models/supplier-return.entity';
import { SupplierReturnRepository } from '../../data/supplier-return.repository';
import { SupplierReturnItemRepository } from '../index';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { PurchaseReceptionItemRepository } from '@/modules/purchase-receptions/purchase-reception-items/data/purchase-reception-item.repository';

let instance: SupplierReturnItemService | null = null;

export class SupplierReturnItemService {
  constructor(
    private readonly returnRepository: SupplierReturnRepository = new SupplierReturnRepository(),
    private readonly itemRepository: SupplierReturnItemRepository = new SupplierReturnItemRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
  ) {}

  private mapToApiResponse(item: SupplierReturnItem | null): SupplierReturnItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getReturnAndCheckStatus(
    returnId: number,
    allowedStatuses: SupplierReturnStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierReturn> {
    const supplierReturn = await this.returnRepository.findById(returnId, {
      relations: ['items', 'items.product', 'items.productVariant', 'items.purchaseReceptionItem'],
      transactionalEntityManager,
    });
    if (!supplierReturn) {
      throw new NotFoundError(`Supplier Return with ID ${returnId} not found.`);
    }
    if (!allowedStatuses.includes(supplierReturn.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a supplier return with status '${supplierReturn.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return supplierReturn;
  }

  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<void> {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${input.productId} not found for return item.`);
    if (input.productVariantId) {
      const variant = await this.variantRepository.findById(input.productVariantId);
      if (!variant || variant.productId !== input.productId) {
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
        );
      }
    }
  }

  private async validateReceptionItemLink(input: {
    purchaseReceptionItemId?: number | null;
    productId?: number | null;
    productVariantId?: number | null;
  }): Promise<void> {
    if (input.purchaseReceptionItemId) {
      const receptionItem = await this.receptionItemRepository.findById(
        input.purchaseReceptionItemId,
      );
      if (!receptionItem) {
        throw new BadRequestError(
          `Purchase Reception Item ID ${input.purchaseReceptionItemId} not found.`,
        );
      }
      if (input.productId && receptionItem.productId !== input.productId) {
        throw new BadRequestError(
          `Product ID ${input.productId} in item does not match product ID ${receptionItem.productId} of linked reception item ${input.purchaseReceptionItemId}.`,
        );
      }
      if (
        input.productVariantId !== undefined &&
        receptionItem.productVariantId !== input.productVariantId
      ) {
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} in item does not match variant ID ${receptionItem.productVariantId} of linked reception item ${input.purchaseReceptionItemId}.`,
        );
      }
    }
  }

  async addItemToSupplierReturn(
    supplierReturnId: number,
    input: CreateSupplierReturnItemInput,
    createdByUserId: number,
  ): Promise<SupplierReturnItemApiResponse> {
    const validationResult = createSupplierReturnItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid supplier return item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(SupplierReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierReturnItem);

      const supplierReturn = await this.getReturnAndCheckStatus(
        supplierReturnId,
        [SupplierReturnStatus.REQUESTED, SupplierReturnStatus.APPROVED_BY_SUPPLIER],
        transactionalEntityManager,
      );

      await this.validateItemProductAndVariant(validatedInput);
      await this.validateReceptionItemLink(validatedInput);

      const existingItemQuery: FindOptionsWhere<SupplierReturnItem> = {
        supplierReturnId,
        productId: validatedInput.productId,
        productVariantId: validatedInput.productVariantId ?? IsNull(),
        deletedAt: IsNull(),
      };
      if (validatedInput.purchaseReceptionItemId) {
        existingItemQuery.purchaseReceptionItemId = validatedInput.purchaseReceptionItemId;
      }
      const existingItem = await itemRepoTx.findOne({ where: existingItemQuery });
      if (existingItem) {
        throw new BadRequestError(
          `This product/variant (from reception item ${validatedInput.purchaseReceptionItemId ?? 'N/A'}) is already part of this supplier return. Update its quantity instead.`,
        );
      }

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        supplierReturnId,
        quantityShipped: 0,
        quantityReceived: 0,
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Supplier return item data is invalid (internal check). Errors: ${supplierReturnItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      supplierReturn.updatedByUserId = createdByUserId;
      await returnRepoTx.save(supplierReturn);

      logger.info(
        `Item (Product ID: ${validatedInput.productId}) added to Supplier Return ${supplierReturnId}. Item ID: ${savedItem.id}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created supplier return item.');
      return apiResponse;
    });
  }

  async getReturnItems(supplierReturnId: number): Promise<SupplierReturnItemApiResponse[]> {
    await this.getReturnAndCheckStatus(supplierReturnId, Object.values(SupplierReturnStatus));
    const items = await this.itemRepository.findBySupplierReturnId(supplierReturnId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as SupplierReturnItemApiResponse[];
  }

  async getItemById(
    supplierReturnId: number,
    itemId: number,
  ): Promise<SupplierReturnItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.supplierReturnId !== supplierReturnId) {
      throw new NotFoundError(
        `Supplier return item with ID ${itemId} not found for return ${supplierReturnId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map supplier return item.');
    return apiResponse;
  }

  async updateItemInReturn(
    supplierReturnId: number,
    itemId: number,
    input: UpdateSupplierReturnItemInput,
    updatedByUserId: number,
  ): Promise<SupplierReturnItemApiResponse> {
    const validationResult = updateSupplierReturnItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(SupplierReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierReturnItem);

      const supplierReturn = await this.getReturnAndCheckStatus(
        supplierReturnId,
        [SupplierReturnStatus.REQUESTED, SupplierReturnStatus.APPROVED_BY_SUPPLIER],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOne({ where: { id: itemId, supplierReturnId } });
      if (!item) {
        throw new NotFoundError(
          `Supplier return item with ID ${itemId} not found for return ${supplierReturnId}.`,
        );
      }

      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceAtReturn !== undefined)
        item.unitPriceAtReturn = validatedInput.unitPriceAtReturn;

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated return item data is invalid (internal check). Errors: ${supplierReturnItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      supplierReturn.updatedByUserId = updatedByUserId;
      await returnRepoTx.save(supplierReturn);

      logger.info(
        `Supplier return item ID ${itemId} for return ${supplierReturnId} updated successfully.`,
      );
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated supplier return item.');
      return apiResponse;
    });
  }

  async removeItemFromReturn(
    supplierReturnId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(SupplierReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierReturnItem);

      const supplierReturn = await this.getReturnAndCheckStatus(
        supplierReturnId,
        [SupplierReturnStatus.REQUESTED, SupplierReturnStatus.APPROVED_BY_SUPPLIER],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, supplierReturnId });
      if (!item) {
        throw new NotFoundError(
          `Supplier return item with ID ${itemId} not found for return ${supplierReturnId}.`,
        );
      }

      await itemRepoTx.softDelete(itemId);

      supplierReturn.updatedByUserId = deletedByUserId;
      await returnRepoTx.save(supplierReturn);

      logger.info(`Supplier return item ID ${itemId} removed from return ${supplierReturnId}.`);
    });
  }

  static getInstance(): SupplierReturnItemService {
    instance ??= new SupplierReturnItemService();
    return instance;
  }
}
