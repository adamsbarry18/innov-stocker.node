import { appDataSource } from '@/database/data-source';
// TODO: Dépendance - StockMovementService si des actions sur les items modifient directement le stock avant la réception globale du retour.

import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type EntityManager, IsNull } from 'typeorm';
import { CustomerReturnRepository } from '../../data/customer-return.repository';
import { CustomerReturnItemRepository } from '../data/customer-return-item.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import {
  type CreateCustomerReturnItemInput,
  createCustomerReturnItemSchema,
  CustomerReturnItem,
  type CustomerReturnItemApiResponse,
  customerReturnItemValidationInputErrors,
  type UpdateCustomerReturnItemInput,
  updateCustomerReturnItemSchema,
} from '../models/customer-return-item.entity';
import { CustomerReturn, CustomerReturnStatus } from '../../models/customer-return.entity';

let instance: CustomerReturnItemService | null = null;

export class CustomerReturnItemService {
  constructor(
    private readonly returnRepository: CustomerReturnRepository = new CustomerReturnRepository(),
    private readonly itemRepository: CustomerReturnItemRepository = new CustomerReturnItemRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    // TODO: private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  private mapToApiResponse(item: CustomerReturnItem | null): CustomerReturnItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getReturnAndCheckStatus(
    returnId: number,
    allowedStatuses: CustomerReturnStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerReturn> {
    const customerReturn = await this.returnRepository.findById(returnId, {
      relations: ['items', 'items.product', 'items.productVariant'],
      transactionalEntityManager,
    });
    if (!customerReturn) {
      throw new NotFoundError(`Customer Return with ID ${returnId} not found.`);
    }
    if (!allowedStatuses.includes(customerReturn.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a customer return with status '${customerReturn.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return customerReturn;
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

  async addItemToReturn(
    customerReturnId: number,
    input: CreateCustomerReturnItemInput,
    createdByUserId: number, // For audit on parent CustomerReturn if item addition updates it
  ): Promise<CustomerReturnItemApiResponse> {
    const validationResult = createCustomerReturnItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid return item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(CustomerReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(CustomerReturnItem);

      const customerReturn = await this.getReturnAndCheckStatus(
        customerReturnId,
        [CustomerReturnStatus.REQUESTED, CustomerReturnStatus.APPROVED], // Only allow adding items to returns in these statuses
        transactionalEntityManager,
      );

      await this.validateItemProductAndVariant(validatedInput);

      // Check for duplicate item (product/variant) in this return
      const existingItem = await itemRepoTx.findOne({
        where: {
          customerReturnId,
          productId: validatedInput.productId,
          productVariantId: validatedInput.productVariantId || IsNull(),
          deletedAt: IsNull(),
        },
      });
      if (existingItem) {
        throw new BadRequestError(
          `Product/Variant (ID: ${validatedInput.productId}/${validatedInput.productVariantId || 'N/A'}) already exists in this return (Item ID: ${existingItem.id}). Update its quantity instead.`,
        );
      }

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        customerReturnId,
        // createdByUserId, // If CustomerReturnItem has audit fields
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Return item data is invalid (internal check). Errors: ${customerReturnItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      customerReturn.updatedByUserId = createdByUserId; // Audit for parent return update
      // TODO: Recalculate any potential totals on CustomerReturn if applicable
      await returnRepoTx.save(customerReturn);

      logger.info(
        `Item (Product ID: ${validatedInput.productId}) added to Customer Return ${customerReturnId}. Item ID: ${savedItem.id}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created customer return item.');
      return apiResponse;
    });
  }

  async getReturnItems(customerReturnId: number): Promise<CustomerReturnItemApiResponse[]> {
    await this.getReturnAndCheckStatus(customerReturnId, Object.values(CustomerReturnStatus)); // Validate Return existence
    const items = await this.itemRepository.findByCustomerReturnId(customerReturnId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as CustomerReturnItemApiResponse[];
  }

  async getItemById(
    customerReturnId: number,
    itemId: number,
  ): Promise<CustomerReturnItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.customerReturnId !== customerReturnId) {
      throw new NotFoundError(
        `Customer return item with ID ${itemId} not found for return ${customerReturnId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map customer return item.');
    return apiResponse;
  }

  async updateItemInReturn(
    customerReturnId: number,
    itemId: number,
    input: UpdateCustomerReturnItemInput,
    updatedByUserId: number,
  ): Promise<CustomerReturnItemApiResponse> {
    const validationResult = updateCustomerReturnItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(CustomerReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(CustomerReturnItem);

      const customerReturn = await this.getReturnAndCheckStatus(
        customerReturnId,
        [
          CustomerReturnStatus.REQUESTED,
          CustomerReturnStatus.APPROVED,
          CustomerReturnStatus.PENDING_RECEPTION,
        ],
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOne({ where: { id: itemId, customerReturnId } });
      if (!item) {
        throw new NotFoundError(
          `Customer return item with ID ${itemId} not found for return ${customerReturnId}.`,
        );
      }

      // Apply updates from validatedInput
      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceAtReturn !== undefined)
        item.unitPriceAtReturn = validatedInput.unitPriceAtReturn;
      if (validatedInput.condition !== undefined) item.condition = validatedInput.condition;
      if (validatedInput.actionTaken !== undefined) item.actionTaken = validatedInput.actionTaken;
      if (validatedInput.notes !== undefined) item.notes = validatedInput.notes;
      // item.updatedByUserId = updatedByUserId; // If audit on item

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated return item data is invalid (internal check). Errors: ${customerReturnItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      customerReturn.updatedByUserId = updatedByUserId;
      await returnRepoTx.save(customerReturn);

      logger.info(
        `Customer return item ID ${itemId} for return ${customerReturnId} updated successfully.`,
      );
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated customer return item.');
      return apiResponse;
    });
  }

  async removeItemFromReturn(
    customerReturnId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const returnRepoTx = transactionalEntityManager.getRepository(CustomerReturn);
      const itemRepoTx = transactionalEntityManager.getRepository(CustomerReturnItem);

      const customerReturn = await this.getReturnAndCheckStatus(
        customerReturnId,
        [CustomerReturnStatus.REQUESTED, CustomerReturnStatus.APPROVED], // Only allow removal if not yet physically processed
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, customerReturnId });
      if (!item) {
        throw new NotFoundError(
          `Customer return item with ID ${itemId} not found for return ${customerReturnId}.`,
        );
      }

      await itemRepoTx.softDelete(itemId); // Assuming soft delete

      customerReturn.updatedByUserId = deletedByUserId;
      await returnRepoTx.save(customerReturn);

      logger.info(`Customer return item ID ${itemId} removed from return ${customerReturnId}.`);
    });
  }

  static getInstance(): CustomerReturnItemService {
    if (!instance) {
      instance = new CustomerReturnItemService();
    }
    return instance;
  }
}
