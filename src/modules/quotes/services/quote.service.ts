import { appDataSource } from '@/database/data-source';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { QuoteRepository } from '../data/quote.repository';
import { CustomerRepository } from '../../customers/data/customer.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { UserRepository } from '../../users/data/users.repository';

import {
  Quote,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteApiResponse,
  QuoteStatus,
  quoteValidationInputErrors,
} from '../models/quote.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import dayjs from 'dayjs';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { QuoteItemRepository } from '../quote-items/data/quote-item.repository';
import { QuoteItem, quoteItemValidationInputErrors } from '../quote-items/models/quote-item.entity';

// TODO: Dépendance - Importer SalesOrderService pour la conversion
// import { SalesOrderService } from '../../sales-orders/services/sales_order.service';

let instance: QuoteService | null = null;

export class QuoteService {
  private readonly quoteRepository: QuoteRepository;
  private readonly itemRepository: QuoteItemRepository;
  private readonly customerRepository: CustomerRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly addressRepository: AddressRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly userRepository: UserRepository;
  // TODO: Dépendance - private readonly salesOrderService: SalesOrderService;

  constructor(
    quoteRepository: QuoteRepository = new QuoteRepository(),
    itemRepository: QuoteItemRepository = new QuoteItemRepository(),
    customerRepository: CustomerRepository = new CustomerRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    userRepository: UserRepository = new UserRepository(),
    // salesOrderService: SalesOrderService = new SalesOrderService(),
  ) {
    this.quoteRepository = quoteRepository;
    this.itemRepository = itemRepository;
    this.customerRepository = customerRepository;
    this.currencyRepository = currencyRepository;
    this.addressRepository = addressRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.userRepository = userRepository;
    // TODO: this.salesOrderService = salesOrderService;
  }

  mapToApiResponse(quote: Quote | null): QuoteApiResponse | null {
    if (!quote) return null;
    return quote.toApi();
  }

  private async generateQuoteNumber(): Promise<string> {
    const datePrefix = dayjs().format('YYYYMMDD');
    const prefix = `QT-${datePrefix}-`;

    const lastNumberStr = await this.quoteRepository.findLastQuoteNumber(prefix);
    let nextSeq = 1;
    if (lastNumberStr) {
      const lastSeq = parseInt(lastNumberStr.substring(prefix.length), 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async findById(id: number, requestingUserId: number): Promise<QuoteApiResponse> {
    try {
      const quote = await this.quoteRepository.findById(id, {
        relations: [
          'customer',
          'currency',
          'shippingAddress',
          'billingAddress',
          'createdByUser',
          'updatedByUser',
          'items',
          'items.product', // Load product for item description fallback
          'items.productVariant', // Load variant for item description fallback
        ],
      });
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);
      // TODO: Autorisation - Vérifier si l'utilisateur a le droit de voir ce devis (ex: si c'est son devis ou s'il est admin)

      const apiResponse = this.mapToApiResponse(quote);
      if (!apiResponse) throw new ServerError(`Failed to map quote ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error finding quote by id ${id}`, error }, 'QuoteService.findById');
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding quote by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Quote> | FindOptionsWhere<Quote>[];
    sort?: FindManyOptions<Quote>['order'];
    searchTerm?: string;
  }): Promise<{ quotes: QuoteApiResponse[]; total: number }> {
    try {
      // TODO: Ajouter une logique de recherche plus avancée pour searchTerm si nécessaire
      const { quotes, count } = await this.quoteRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { issueDate: 'DESC', createdAt: 'DESC' },
        relations: ['customer', 'currency', 'createdByUser'], // Lighter relations for list
      });
      const apiQuotes = quotes
        .map((q) => this.mapToApiResponse(q))
        .filter(Boolean) as QuoteApiResponse[];
      return { quotes: apiQuotes, total: count };
    } catch (error) {
      logger.error({ message: `Error finding all quotes`, error, options }, 'QuoteService.findAll');
      throw new ServerError('Error finding all quotes.');
    }
  }

  async createQuote(input: CreateQuoteInput, createdByUserId: number): Promise<QuoteApiResponse> {
    // Validate foreign keys
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) throw new BadRequestError(`Customer with ID ${input.customerId} not found.`);

    const currency = await this.currencyRepository.findById(input.currencyId);
    if (!currency) throw new BadRequestError(`Currency with ID ${input.currencyId} not found.`);

    const billingAddress = await this.addressRepository.findById(input.billingAddressId);
    if (!billingAddress)
      throw new BadRequestError(`Billing address with ID ${input.billingAddressId} not found.`);

    if (input.shippingAddressId) {
      const shippingAddress = await this.addressRepository.findById(input.shippingAddressId);
      if (!shippingAddress)
        throw new BadRequestError(`Shipping address with ID ${input.shippingAddressId} not found.`);
    }

    const createdByUser = await this.userRepository.findById(createdByUserId);
    if (!createdByUser) throw new BadRequestError(`User with ID ${createdByUserId} not found.`);

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const quoteRepoTx = transactionalEntityManager.getRepository(Quote);
      const itemRepoTx = transactionalEntityManager.getRepository(QuoteItem);

      // Validate that items array is not empty for new quotes
      if (!input.items || input.items.length === 0) {
        throw new BadRequestError('Quote must contain at least one item.');
      }

      const quoteEntity = quoteRepoTx.create({
        ...input,
        issueDate: dayjs(input.issueDate).toDate(),
        expiryDate: input.expiryDate ? dayjs(input.expiryDate).toDate() : null,
        status: input.status || QuoteStatus.DRAFT,
        quoteNumber: await this.generateQuoteNumber(), // Generate unique quote number
        createdByUserId: createdByUserId,
        updatedByUserId: createdByUserId,
        items: [], // Initialize items array, will be populated next
      });

      // Validate main quote entity (basic validation)
      if (!quoteEntity.isValid()) {
        throw new BadRequestError(
          `Quote data is invalid. Errors: ${quoteValidationInputErrors.join(', ')}`,
        );
      }

      const savedQuote = await quoteRepoTx.save(quoteEntity); // Save quote first to get an ID

      const quoteItems: QuoteItem[] = [];
      for (const itemInput of input.items) {
        const product = await this.productRepository.findById(itemInput.productId);
        if (!product)
          throw new BadRequestError(`Product with ID ${itemInput.productId} not found for item.`);
        if (itemInput.productVariantId) {
          const variant = await this.variantRepository.findById(itemInput.productVariantId);
          if (!variant || variant.productId !== itemInput.productId) {
            throw new BadRequestError(
              `Product Variant ID ${itemInput.productVariantId} not found or does not belong to product ${itemInput.productId}.`,
            );
          }
        }

        const itemEntity: any = itemRepoTx.create({
          ...itemInput,
          quoteId: savedQuote.id, // Link to the saved quote
          description:
            itemInput.description ||
            (itemInput.productVariantId
              ? (await this.variantRepository.findById(itemInput.productVariantId))?.nameVariant
              : product.name),
          vatRatePercentage:
            itemInput.vatRatePercentage !== undefined
              ? itemInput.vatRatePercentage
              : product.defaultVatRatePercentage,
        });
        if (!itemEntity.isValid()) {
          throw new BadRequestError(
            `Invalid data for quote item (Product ID: ${itemInput.productId}). Errors: ${quoteItemValidationInputErrors.join(', ')}`,
          );
        }
        quoteItems.push(itemEntity);
      }
      await itemRepoTx.save(quoteItems);
      savedQuote.items = quoteItems;

      savedQuote.calculateTotals();
      await quoteRepoTx.save(savedQuote);
      const populatedQuote = await transactionalEntityManager.getRepository(Quote).findOne({
        where: { id: savedQuote.id },
        relations: [
          'customer',
          'currency',
          'shippingAddress',
          'billingAddress',
          'createdByUser',
          'updatedByUser',
          'items',
          'items.product',
          'items.productVariant',
        ],
      });
      const apiResponse = this.mapToApiResponse(populatedQuote);
      if (!apiResponse) {
        logger.error(
          { populatedQuote },
          `QuoteService.createQuote: Failed to map created quote ${savedQuote.id}. populatedQuote was null or invalid.`,
        );
        throw new ServerError(`Failed to map created quote ${savedQuote.id}.`);
      }
      return apiResponse;
    });
  }

  async updateQuote(
    id: number,
    input: UpdateQuoteInput,
    updatedByUserId: number,
  ): Promise<QuoteApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const quoteRepoTx = transactionalEntityManager.getRepository(Quote);
      const itemRepoTx = transactionalEntityManager.getRepository(QuoteItem);

      const quote = await this.quoteRepository.findById(id, {
        relations: [
          'items',
          'customer',
          'currency',
          'billingAddress',
          'shippingAddress',
          'createdByUser',
        ],
      }); // Load items for update
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

      if (quote.status !== QuoteStatus.DRAFT && quote.status !== QuoteStatus.SENT) {
        // Example: Allow editing only if draft or sent
        // Allow certain fields like notes or terms to be updated for other statuses if needed
        if (
          Object.keys(input).some(
            (key) => !['notes', 'termsAndConditions', 'status', 'expiryDate'].includes(key),
          )
        ) {
          throw new ForbiddenError(
            `Quote is in status '${quote.status}' and cannot be fully modified.`,
          );
        }
      }

      // Validate FKs if changed
      if (input.currencyId && input.currencyId !== quote.currencyId) {
        if (!(await this.currencyRepository.findById(input.currencyId)))
          throw new BadRequestError(`Currency ID ${input.currencyId} not found.`);
      }
      if (input.billingAddressId && input.billingAddressId !== quote.billingAddressId) {
        if (!(await this.addressRepository.findById(input.billingAddressId)))
          throw new BadRequestError(`Billing Address ID ${input.billingAddressId} not found.`);
      }
      if (input.hasOwnProperty('shippingAddressId')) {
        // Handles null
        if (input.shippingAddressId && input.shippingAddressId !== quote.shippingAddressId) {
          if (!(await this.addressRepository.findById(input.shippingAddressId)))
            throw new BadRequestError(`Shipping Address ID ${input.shippingAddressId} not found.`);
        }
      }

      // Prepare update payload for quote entity
      const quoteUpdatePayload: Partial<Quote> = { updatedByUserId };
      if (input.issueDate) quoteUpdatePayload.issueDate = dayjs(input.issueDate).toDate();
      if (input.hasOwnProperty('expiryDate'))
        quoteUpdatePayload.expiryDate = input.expiryDate ? dayjs(input.expiryDate).toDate() : null;
      if (input.status) quoteUpdatePayload.status = input.status;
      if (input.currencyId) quoteUpdatePayload.currencyId = input.currencyId;
      if (input.hasOwnProperty('shippingAddressId'))
        quoteUpdatePayload.shippingAddressId = input.shippingAddressId;
      if (input.billingAddressId) quoteUpdatePayload.billingAddressId = input.billingAddressId;
      if (input.hasOwnProperty('notes')) quoteUpdatePayload.notes = input.notes;
      if (input.hasOwnProperty('termsAndConditions'))
        quoteUpdatePayload.termsAndConditions = input.termsAndConditions;

      // Validate the merged entity before saving (for Zod based checks)
      const tempQuote = quoteRepoTx.create({ ...quote, ...quoteUpdatePayload });
      if (!tempQuote.isValid()) {
        throw new BadRequestError(
          `Updated quote data is invalid: ${quoteValidationInputErrors.join(', ')}`,
        );
      }

      // Apply main quote updates
      await quoteRepoTx.update(id, quoteUpdatePayload);

      // Handle items update
      if (input.items) {
        const existingItemIds = quote.items?.map((item) => item.id) || [];
        const inputItemIds = input.items
          .map((item) => item.id)
          .filter((itemId) => itemId !== undefined) as number[];

        // Items to delete: in existing but not in input
        const itemsToDelete = quote.items?.filter((item) => !inputItemIds.includes(item.id)) || [];
        if (itemsToDelete.length > 0) {
          await itemRepoTx.remove(itemsToDelete);
        }

        const itemsToUpdateOrAdd: QuoteItem[] = [];
        for (const itemInput of input.items) {
          // TODO: Dépendance - Validate product/variant existence
          const product = await this.productRepository.findById(itemInput.productId as number); // Assuming productId is present
          if (!product)
            throw new BadRequestError(`Product with ID ${itemInput.productId} not found for item.`);
          if (itemInput.productVariantId) {
            const variant = await this.variantRepository.findById(itemInput.productVariantId);
            if (!variant || variant.productId !== itemInput.productId) {
              throw new BadRequestError(
                `Product Variant ID ${itemInput.productVariantId} not valid for product ${itemInput.productId}.`,
              );
            }
          }

          const itemEntityData = {
            ...itemInput,
            quoteId: id,
            description:
              itemInput.description ||
              (itemInput.productVariantId
                ? (await this.variantRepository.findById(itemInput.productVariantId))?.nameVariant
                : product.name),
            vatRatePercentage:
              itemInput.vatRatePercentage !== undefined
                ? itemInput.vatRatePercentage
                : product.defaultVatRatePercentage,
          };

          let itemEntity;
          if (itemInput.id) {
            // Update existing item
            const existingItem = quote.items?.find((i) => i.id === itemInput.id);
            if (!existingItem)
              throw new NotFoundError(
                `Quote item with ID ${itemInput.id} not found on this quote.`,
              );
            itemEntity = itemRepoTx.merge(existingItem, itemEntityData as Partial<QuoteItem>);
          } else {
            // Add new item
            itemEntity = itemRepoTx.create(itemEntityData as Partial<QuoteItem>);
          }
          if (!itemEntity.isValid()) {
            logger.error(
              { errors: quoteItemValidationInputErrors },
              `Validation failed for quote item (Product ID: ${itemInput.productId}).`,
            );
            throw new BadRequestError(
              `Invalid data for quote item (Product ID: ${itemInput.productId}). Errors: ${quoteItemValidationInputErrors.join('; ')}`,
            );
          }
          itemsToUpdateOrAdd.push(itemEntity);
        }
        if (itemsToUpdateOrAdd.length > 0) {
          await itemRepoTx.save(itemsToUpdateOrAdd);
        }
      }

      const quoteForTotals = await quoteRepoTx.findOne({
        where: { id },
        relations: ['items', 'items.product', 'items.productVariant'],
      });
      if (!quoteForTotals) throw new ServerError('Failed to re-fetch quote for total calculation.');

      quoteForTotals.calculateTotals();
      await quoteRepoTx.update(id, {
        totalAmountHt: quoteForTotals.totalAmountHt,
        totalVatAmount: quoteForTotals.totalVatAmount,
        totalAmountTtc: quoteForTotals.totalAmountTtc,
        updatedByUserId,
      });
      const populatedQuote = await transactionalEntityManager.getRepository(Quote).findOne({
        where: { id },
        relations: [
          'customer',
          'currency',
          'shippingAddress',
          'billingAddress',
          'createdByUser',
          'updatedByUser',
          'items',
          'items.product',
          'items.productVariant',
        ],
      });
      const apiResponse = this.mapToApiResponse(populatedQuote);
      if (!apiResponse) throw new ServerError(`Failed to map updated quote ${id}.`);
      return apiResponse;
    });
  }

  async deleteQuote(id: number, deletedByUserId: number): Promise<void> {
    try {
      const quote = await this.quoteRepository.findById(id);
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

      if (
        quote.status === QuoteStatus.ACCEPTED ||
        quote.status === QuoteStatus.CONVERTED_TO_ORDER
      ) {
        throw new BadRequestError(`Quote is in status '${quote.status}' and cannot be deleted.`);
      }

      // TODO: Dépendance - Vérifier si le devis est lié à une commande client qui n'est pas annulée.
      // const isConverted = await this.quoteRepository.isQuoteConvertedToOrder(id);
      // if (isConverted) {
      //   throw new BadRequestError(`Quote '${quote.quoteNumber}' has been converted to an order and cannot be deleted.`);
      // }

      await this.quoteRepository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error deleting quote ${id}`, error }, 'QuoteService.deleteQuote');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting quote ${id}.`);
    }
  }

  async updateQuoteStatus(
    id: number,
    status: QuoteStatus,
    updatedByUserId: number,
  ): Promise<QuoteApiResponse> {
    const quote = await this.quoteRepository.findById(id);
    if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

    if (!Object.values(QuoteStatus).includes(status)) {
      throw new BadRequestError(`Invalid status: ${status}`);
    }

    quote.status = status;
    quote.updatedByUserId = updatedByUserId;

    try {
      await this.quoteRepository.save(quote);

      const populatedQuote = await this.quoteRepository.findById(id, {
        relations: [
          'customer',
          'currency',
          'shippingAddress',
          'billingAddress',
          'createdByUser',
          'updatedByUser',
          'items',
          'items.product',
          'items.productVariant',
        ],
      });
      const apiResponse = this.mapToApiResponse(populatedQuote);
      if (!apiResponse) throw new ServerError(`Failed to map quote ${id} after status update.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating status for quote ${id}`, error },
        'QuoteService.updateQuoteStatus',
      );
      throw new ServerError(`Error updating status for quote ${id}.`);
    }
  }

  // TODO: Dépendance - Implémenter la conversion en SalesOrder
  async convertQuoteToOrder(
    quoteId: number,
    createdByUserId: number,
  ): Promise<any /* SalesOrderApiResponse */> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) throw new NotFoundError(`Quote with ID ${quoteId} not found.`);
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestError(
        `Only an accepted quote can be converted to an order. Current status: ${quote.status}`,
      );
    }

    // const isAlreadyConverted = await this.quoteRepository.isQuoteConvertedToOrder(quoteId);
    // if (isAlreadyConverted) {
    //   throw new BadRequestError(`Quote ${quote.quoteNumber} has already been converted to an order.`);
    // }

    logger.warn(
      `QuoteService.convertQuoteToOrder for quote ${quoteId} is a STUB. SalesOrder module needed.`,
    );
    // 1. Créer un SalesOrderInput à partir des données du Quote et QuoteItems
    // 2. Appeler salesOrderService.createSalesOrder(salesOrderInput, createdByUserId)
    // 3. Mettre à jour le statut du devis à QuoteStatus.CONVERTED_TO_ORDER
    // quote.status = QuoteStatus.CONVERTED_TO_ORDER;
    // quote.updatedByUserId = createdByUserId;
    // await this.quoteRepository.save(quote);

    // return salesOrderApiResponse; // Placeholder
    throw new ServerError('Conversion to Sales Order not implemented yet.');
  }

  static getInstance(): QuoteService {
    if (!instance) {
      instance = new QuoteService();
    }
    return instance;
  }
}
