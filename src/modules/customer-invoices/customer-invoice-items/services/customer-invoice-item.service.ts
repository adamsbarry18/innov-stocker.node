import { appDataSource } from '@/database/data-source';

import {
  CustomerInvoiceItem,
  type CreateCustomerInvoiceItemInput,
  type UpdateCustomerInvoiceItemInput,
  type CustomerInvoiceItemApiResponse,
  createCustomerInvoiceItemSchema,
  updateCustomerInvoiceItemSchema,
  customerInvoiceItemValidationInputErrors,
} from '../models/customer-invoice-item.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type EntityManager } from 'typeorm';
import { CustomerInvoiceRepository } from '../../data/customer-invoice.repository';
import { CustomerInvoiceItemRepository } from '../data/customer-invoice-item.entity';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { SalesOrderItemRepository } from '@/modules/sales-orders/sales-order-items/data/sales-order-item.repository';
import { DeliveryItemRepository } from '@/modules/deliveries/delivery-items/data/delivery-item.repository';
import { CustomerInvoice, CustomerInvoiceStatus } from '../../models/customer-invoice.entity';

let instance: CustomerInvoiceItemService | null = null;

export class CustomerInvoiceItemService {
  constructor(
    private readonly invoiceRepository: CustomerInvoiceRepository = new CustomerInvoiceRepository(),
    private readonly itemRepository: CustomerInvoiceItemRepository = new CustomerInvoiceItemRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    private readonly soItemRepository: SalesOrderItemRepository = new SalesOrderItemRepository(),
    private readonly deliveryItemRepository: DeliveryItemRepository = new DeliveryItemRepository(),
  ) {}

  public static getInstance(): CustomerInvoiceItemService {
    if (!instance) {
      instance = new CustomerInvoiceItemService();
    }
    return instance;
  }

  private mapToApiResponse(
    item: CustomerInvoiceItem | null,
  ): CustomerInvoiceItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getInvoiceAndCheckStatus(
    invoiceId: number,
    allowedStatuses?: CustomerInvoiceStatus[],
    transactionalEntityManager?: EntityManager,
  ): Promise<CustomerInvoice> {
    let invoice: CustomerInvoice | null;

    if (transactionalEntityManager) {
      // Utilise findOne du repo natif TypeORM
      const repo = transactionalEntityManager.getRepository(CustomerInvoice);
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
          'items.salesOrderItem',
          'items.deliveryItem',
        ],
      });
    }
    if (!invoice) {
      throw new NotFoundError(`Customer Invoice with ID ${invoiceId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(invoice.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a customer invoice with status '${invoice.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return invoice;
  }

  private async validateItemProductAndVariant(input: {
    productId?: number | null;
    productVariantId?: number | null;
  }): Promise<{
    productName?: string | null;
    variantName?: string | null;
    defaultVat?: number | null;
  }> {
    let productName: string | null = null;
    let variantName: string | null = null;
    let defaultVat: number | null = null;

    if (input.productId) {
      const product = await this.productRepository.findById(input.productId);
      if (!product)
        throw new BadRequestError(`Product with ID ${input.productId} not found for invoice item.`);
      productName = product.name;
      defaultVat = product.defaultVatRatePercentage;

      if (input.productVariantId) {
        const variant = await this.variantRepository.findById(input.productVariantId);
        if (!variant || variant.productId !== input.productId) {
          throw new BadRequestError(
            `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
          );
        }
        variantName = variant.nameVariant;
      }
    }
    return { productName, variantName, defaultVat };
  }

  private async validateSourceItemLinks(
    input: { salesOrderItemId?: number | null; deliveryItemId?: number | null; quantity: number },
    isUpdate: boolean,
    existingItem?: CustomerInvoiceItem,
  ): Promise<void> {
    if (input.salesOrderItemId) {
      const soItem = await this.soItemRepository.findById(input.salesOrderItemId);
      if (!soItem)
        throw new BadRequestError(`Sales Order Item ID ${input.salesOrderItemId} not found.`);
      // TODO: Check if quantity invoiced on SOItem + current input.quantity > soItem.quantity
      // (complex if multiple invoices can link to same SOItem line)
    }
    if (input.deliveryItemId) {
      const delItem = await this.deliveryItemRepository.findById(input.deliveryItemId);
      if (!delItem)
        throw new BadRequestError(`Delivery Item ID ${input.deliveryItemId} not found.`);
      // TODO: Check if quantity invoiced on DeliveryItem + current input.quantity > delItem.quantityShipped
    }
  }

  async addItemToInvoice(
    customerInvoiceId: number,
    input: CreateCustomerInvoiceItemInput,
    createdByUserId: number,
  ): Promise<CustomerInvoiceItemApiResponse> {
    const validationResult = createCustomerInvoiceItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid invoice item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepo = transactionalEntityManager.getRepository(CustomerInvoice); // Utilisez getRepository pour le manager transactionnel
      const itemRepo = transactionalEntityManager.getRepository(CustomerInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        customerInvoiceId,
        [CustomerInvoiceStatus.DRAFT], // Only allow adding items to DRAFT invoices
        transactionalEntityManager,
      );

      const { productName, variantName, defaultVat } =
        await this.validateItemProductAndVariant(validatedInput);
      await this.validateSourceItemLinks(validatedInput, false);

      const itemEntity = itemRepo.create({
        ...validatedInput,
        customerInvoiceId,
        description: validatedInput.description || variantName || productName || 'N/A',
        vatRatePercentage:
          validatedInput.vatRatePercentage !== undefined
            ? validatedInput.vatRatePercentage
            : defaultVat,
        // totalLineAmountHt is calculated in entity or before save by repo
      });
      itemEntity.totalLineAmountHt = itemEntity.calculateTotalLineAmountHt();

      if (!itemEntity.isValid()) {
        throw new BadRequestError(
          `Invoice item data is invalid (internal check). Errors: ${customerInvoiceItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepo.save(itemEntity);

      invoice.items.push(savedItem); // Add to in-memory collection for recalculation
      invoice.calculateTotals();
      invoice.updatedByUserId = createdByUserId;
      await invoiceRepo.save(invoice);

      logger.info(
        `Item (Product ID: ${validatedInput.productId || 'N/A'}) added to Customer Invoice ${customerInvoiceId}. Item ID: ${savedItem.id}.`,
      );

      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created customer invoice item.');
      return apiResponse;
    });
  }

  async getInvoiceItems(customerInvoiceId: number): Promise<CustomerInvoiceItemApiResponse[]> {
    await this.getInvoiceAndCheckStatus(customerInvoiceId);
    const items = await this.itemRepository.findByCustomerInvoiceId(customerInvoiceId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as CustomerInvoiceItemApiResponse[];
  }

  async getItemById(
    customerInvoiceId: number,
    itemId: number,
  ): Promise<CustomerInvoiceItemApiResponse> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.customerInvoiceId !== customerInvoiceId) {
      throw new NotFoundError(
        `Customer invoice item with ID ${itemId} not found for invoice ${customerInvoiceId}.`,
      );
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map customer invoice item.');
    return apiResponse;
  }

  async updateItemInInvoice(
    customerInvoiceId: number,
    itemId: number,
    input: UpdateCustomerInvoiceItemInput,
    updatedByUserId: number,
  ): Promise<CustomerInvoiceItemApiResponse> {
    const validationResult = updateCustomerInvoiceItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepo = transactionalEntityManager.getRepository(CustomerInvoice);
      const itemRepo = transactionalEntityManager.getRepository(CustomerInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        customerInvoiceId,
        [CustomerInvoiceStatus.DRAFT], // Only allow updates if DRAFT
        transactionalEntityManager,
      );
      const item = await itemRepo.findOne({
        where: { id: itemId, customerInvoiceId },
        relations: ['product', 'productVariant'],
      });
      if (!item) {
        throw new NotFoundError(
          `Customer invoice item with ID ${itemId} not found for invoice ${customerInvoiceId}.`,
        );
      }

      if (validatedInput.description !== undefined)
        item.description = validatedInput.description ?? item.description;
      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceHt !== undefined) item.unitPriceHt = validatedInput.unitPriceHt;
      if (validatedInput.discountPercentage !== undefined)
        item.discountPercentage = validatedInput.discountPercentage;
      if (validatedInput.vatRatePercentage !== undefined)
        item.vatRatePercentage = validatedInput.vatRatePercentage;

      item.totalLineAmountHt = item.calculateTotalLineAmountHt(); // Recalculate before validation

      if (!item.isValid()) {
        throw new BadRequestError(
          `Updated invoice item data is invalid (internal check). Errors: ${customerInvoiceItemValidationInputErrors.join(', ')}`,
        );
      }

      const savedItem = await itemRepo.save(item);

      const itemsForTotal = await itemRepo.find({ where: { customerInvoiceId } });
      invoice.items = itemsForTotal;
      invoice.calculateTotals();
      invoice.updatedByUserId = updatedByUserId;
      await invoiceRepo.save(invoice);

      logger.info(
        `Customer invoice item ID ${itemId} for invoice ${customerInvoiceId} updated successfully.`,
      );
      const populatedItem = await this.itemRepository.findById(savedItem.id, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated customer invoice item.');
      return apiResponse;
    });
  }

  async removeItemFromInvoice(
    customerInvoiceId: number,
    itemId: number,
    deletedByUserId: number,
  ): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const invoiceRepo = transactionalEntityManager.getRepository(CustomerInvoice);
      const itemRepo = transactionalEntityManager.getRepository(CustomerInvoiceItem);

      const invoice = await this.getInvoiceAndCheckStatus(
        customerInvoiceId,
        [CustomerInvoiceStatus.DRAFT], // Only allow removal if DRAFT
        transactionalEntityManager,
      );
      const item = await itemRepo.findOneBy({ id: itemId, customerInvoiceId });
      if (!item) {
        throw new NotFoundError(
          `Customer invoice item with ID ${itemId} not found for invoice ${customerInvoiceId}.`,
        );
      }

      await itemRepo.remove(item); // Hard delete the item

      const itemsForTotal = await itemRepo.find({ where: { customerInvoiceId } });
      invoice.items = itemsForTotal;
      invoice.calculateTotals();
      invoice.updatedByUserId = deletedByUserId;
      await invoiceRepo.save(invoice);

      logger.info(`Customer invoice item ID ${itemId} removed from invoice ${customerInvoiceId}.`);
    });
  }
}
