import { appDataSource } from '@/database/data-source';

import {
  SupplierInvoiceItem,
  type CreateSupplierInvoiceItemInput,
  type UpdateSupplierInvoiceItemInput,
  type SupplierInvoiceItemApiResponse,
  createSupplierInvoiceItemSchema,
  updateSupplierInvoiceItemSchema,
  supplierInvoiceItemValidationInputErrors,
} from '../models/supplier-invoice-item.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type EntityManager } from 'typeorm';
import { SupplierInvoiceRepository } from '@/modules/supplier-invoices/data/supplier-invoice.repository';
import { SupplierInvoiceItemRepository } from '../data/supplier-invoice-item.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import {
  SupplierInvoice,
  SupplierInvoiceStatus,
} from '@/modules/supplier-invoices/models/supplier-invoice.entity';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { PurchaseReceptionItemRepository } from '@/modules/purchase-receptions/purchase-reception-items/data/purchase-reception-item.repository';

let instance: SupplierInvoiceItemService | null = null;

export class SupplierInvoiceItemService {
  private readonly invoiceRepository: SupplierInvoiceRepository;
  private readonly itemRepository: SupplierInvoiceItemRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly receptionItemRepository: PurchaseReceptionItemRepository;

  constructor(
    invoiceRepository: SupplierInvoiceRepository = new SupplierInvoiceRepository(),
    itemRepository: SupplierInvoiceItemRepository = new SupplierInvoiceItemRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    receptionItemRepository: PurchaseReceptionItemRepository = new PurchaseReceptionItemRepository(),
  ) {
    this.invoiceRepository = invoiceRepository;
    this.itemRepository = itemRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.receptionItemRepository = receptionItemRepository;
  }

  mapToApiResponse(item: SupplierInvoiceItem | null): SupplierInvoiceItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getInvoiceAndCheckStatus(
    invoiceId: number,
    allowedStatuses?: SupplierInvoiceStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<SupplierInvoice> {
    let invoice: SupplierInvoice | null;

    if (transactionalEntityManager) {
      // Utilise findOne du repo natif TypeORM
      const repo = transactionalEntityManager.getRepository(SupplierInvoice);
      invoice = await repo.findOne({
        where: { id: invoiceId },
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'items.purchaseReceptionItem',
        ],
      });
    } else {
      // Utilise la méthode custom de ton repository
      invoice = await this.invoiceRepository.findById(invoiceId, {
        relations: [
          'items',
          'items.product',
          'items.productVariant',
          'items.purchaseReceptionItem',
        ],
      });
    }

    if (!invoice) {
      throw new NotFoundError(`Supplier Invoice with ID ${invoiceId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(invoice.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a supplier invoice with status '${invoice.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return invoice;
  }

  private async validateItemProductAndVariant(input: {
    productId?: number | null;
    productVariantId?: number | null;
  }): Promise<void> {
    if (input.productId) {
      const product = await this.productRepository.findById(input.productId);
      if (!product)
        throw new BadRequestError(`Product with ID ${input.productId} not found for invoice item.`);
      if (input.productVariantId) {
        const variant = await this.variantRepository.findById(input.productVariantId);
        if (!variant || variant.productId !== input.productId) {
          throw new BadRequestError(
            `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
          );
        }
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
        { relations: ['product', 'productVariant'] },
      );
      if (!receptionItem) {
        throw new BadRequestError(
          `Purchase Reception Item ID ${input.purchaseReceptionItemId} not found.`,
        );
      }
      // Optionally, check if product/variant matches if also provided in input
      if (input.productId && receptionItem.productId !== input.productId) {
        throw new BadRequestError(
          `Product ID ${input.productId} in item does not match product ID ${receptionItem.productId} of linked reception item ${input.purchaseReceptionItemId}.`,
        );
      }
      if (
        input.productVariantId !== undefined &&
        receptionItem.productVariantId !== input.productVariantId
      ) {
        // handles null
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} in item does not match variant ID ${receptionItem.productVariantId} of linked reception item ${input.purchaseReceptionItemId}.`,
        );
      }
    }
  }

  async addItemToInvoice(
    supplierInvoiceId: number,
    input: CreateSupplierInvoiceItemInput,
    createdByUserId: number,
  ): Promise<SupplierInvoiceItemApiResponse> {
    const validationResult = createSupplierInvoiceItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid supplier invoice item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepoTx = transactionalEntityManager.getRepository(SupplierInvoice);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        supplierInvoiceId,
        [SupplierInvoiceStatus.DRAFT], // Only allow adding items to DRAFT invoices
        transactionalEntityManager,
      );

      await this.validateItemProductAndVariant(validatedInput);
      await this.validateReceptionItemLink(validatedInput);

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        supplierInvoiceId,
        totalLineAmountHt: parseFloat(
          (Number(validatedInput.quantity) * Number(validatedInput.unitPriceHt)).toFixed(4),
        ), // Calculate here
        // createdByUserId: createdByUserId, // If audit on item
      });

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Supplier invoice item data is invalid (internal check). Errors: ${supplierInvoiceItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      const itemsForTotal = await itemRepoTx.find({ where: { supplierInvoiceId } });
      invoice.items = itemsForTotal;
      invoice.calculateTotals();
      invoice.updatedByUserId = createdByUserId; // Audit for invoice update
      await invoiceRepoTx.save(invoice);

      logger.info(
        `Item (Product ID: ${validatedInput.productId || 'N/A'}) added to Supplier Invoice ${supplierInvoiceId}. Item ID: ${savedItem.id}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created supplier invoice item.');
      return apiResponse;
    });
  }

  async getInvoiceItems(supplierInvoiceId: number): Promise<SupplierInvoiceItemApiResponse[]> {
    await this.getInvoiceAndCheckStatus(supplierInvoiceId);
    const items = await this.itemRepository.findBySupplierInvoiceId(supplierInvoiceId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as SupplierInvoiceItemApiResponse[];
  }

  async getItemById(
    supplierInvoiceId: number,
    itemId: number,
  ): Promise<SupplierInvoiceItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.supplierInvoiceId !== supplierInvoiceId) {
      throw new NotFoundError(
        `Supplier invoice item with ID ${itemId} not found for invoice ${supplierInvoiceId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map supplier invoice item.');
    return apiResponse;
  }

  async updateItemInInvoice(
    supplierInvoiceId: number,
    itemId: number,
    input: UpdateSupplierInvoiceItemInput,
    updatedByUserId: number,
  ): Promise<SupplierInvoiceItemApiResponse> {
    const validationResult = updateSupplierInvoiceItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepoTx = transactionalEntityManager.getRepository(SupplierInvoice);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        supplierInvoiceId,
        [SupplierInvoiceStatus.DRAFT], // Only allow updates if DRAFT
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOne({
        where: { id: itemId, supplierInvoiceId },
        relations: ['product', 'productVariant'],
      });
      if (!item) {
        throw new NotFoundError(
          `Supplier invoice item with ID ${itemId} not found for invoice ${supplierInvoiceId}.`,
        );
      }

      // ProductId, ProductVariantId, purchaseReceptionItemId are not updatable for an existing item
      if (validatedInput.description !== undefined) item.description = validatedInput.description;
      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceHt !== undefined) item.unitPriceHt = validatedInput.unitPriceHt;
      if (validatedInput.vatRatePercentage !== undefined)
        item.vatRatePercentage = validatedInput.vatRatePercentage;
      // item.updatedByUserId = updatedByUserId; // If audit on item

      // Recalculate totalLineAmountHt before validation if it's application managed
      item.totalLineAmountHt = parseFloat(
        (Number(item.quantity) * Number(item.unitPriceHt)).toFixed(4),
      );

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated supplier invoice item data is invalid (internal check). Errors: ${supplierInvoiceItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepoTx.save(item);

      const itemsForTotal = await itemRepoTx.find({ where: { supplierInvoiceId } });
      invoice.items = itemsForTotal;
      invoice.calculateTotals();
      invoice.updatedByUserId = updatedByUserId;
      await invoiceRepoTx.save(invoice);

      logger.info(
        `Supplier invoice item ID ${itemId} for invoice ${supplierInvoiceId} updated successfully.`,
      );
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated supplier invoice item.');
      return apiResponse;
    });
  }

  async removeItemFromInvoice(
    supplierInvoiceId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepoTx = transactionalEntityManager.getRepository(SupplierInvoice);
      const itemRepoTx = transactionalEntityManager.getRepository(SupplierInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        supplierInvoiceId,
        [SupplierInvoiceStatus.DRAFT], // Only allow removal if DRAFT
        transactionalEntityManager,
      );
      const item = await itemRepoTx.findOneBy({ id: itemId, supplierInvoiceId });
      if (!item) {
        throw new NotFoundError(
          `Supplier invoice item with ID ${itemId} not found for invoice ${supplierInvoiceId}.`,
        );
      }

      await itemRepoTx.remove(item); // Hard delete the item

      const itemsForTotal = await itemRepoTx.find({ where: { supplierInvoiceId } });
      invoice.items = itemsForTotal;
      invoice.calculateTotals();
      invoice.updatedByUserId = deletedByUserId;
      await invoiceRepoTx.save(invoice);

      logger.info(`Supplier invoice item ID ${itemId} removed from invoice ${supplierInvoiceId}.`);
    });
  }

  static getInstance(): SupplierInvoiceItemService {
    if (!instance) {
      instance = new SupplierInvoiceItemService();
    }
    return instance;
  }
}
