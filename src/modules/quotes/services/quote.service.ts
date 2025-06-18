import { appDataSource } from '@/database/data-source';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { QuoteRepository } from '../index';
import { CustomerRepository } from '../../customers/data/customer.repository';
import { CurrencyRepository } from '../../currencies/data/currency.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { ProductRepository } from '../../products/data/product.repository';
import { UserRepository } from '../../users/data/users.repository';
import { v4 as uuidv4 } from 'uuid';
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
import { QuoteItemRepository, QuoteItem, quoteItemValidationInputErrors } from '../quote-items';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: QuoteService | null = null;

/**
 * Service for managing quotes.
 * Provides methods for creating, retrieving, updating, and deleting quotes,
 * as well as managing quote items and status changes.
 */
export class QuoteService {
  private readonly quoteRepository: QuoteRepository;
  private readonly itemRepository: QuoteItemRepository;
  private readonly customerRepository: CustomerRepository;
  private readonly currencyRepository: CurrencyRepository;
  private readonly addressRepository: AddressRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly userRepository: UserRepository;

  /**
   * Creates an instance of QuoteService.
   * @param quoteRepository - Repository for quote entities.
   * @param itemRepository - Repository for quote item entities.
   * @param customerRepository - Repository for customer entities.
   * @param currencyRepository - Repository for currency entities.
   * @param addressRepository - Repository for address entities.
   * @param productRepository - Repository for product entities.
   * @param variantRepository - Repository for product variant entities.
   * @param userRepository - Repository for user entities.
   */
  constructor(
    quoteRepository: QuoteRepository = new QuoteRepository(),
    itemRepository: QuoteItemRepository = new QuoteItemRepository(),
    customerRepository: CustomerRepository = new CustomerRepository(),
    currencyRepository: CurrencyRepository = new CurrencyRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.quoteRepository = quoteRepository;
    this.itemRepository = itemRepository;
    this.customerRepository = customerRepository;
    this.currencyRepository = currencyRepository;
    this.addressRepository = addressRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.userRepository = userRepository;
  }

  /**
   * Maps a Quote entity to a QuoteApiResponse object.
   * @param quote - The Quote entity to map.
   * @returns The mapped QuoteApiResponse object, or null if the input quote is null.
   */
  mapToApiResponse(quote: Quote | null): QuoteApiResponse | null {
    if (!quote) return null;
    return quote.toApi();
  }

  /**
   * Generates a unique quote number.
   * The format is 'QT-YYYYMMDD-UUID_short'.
   * @returns A unique quote number string.
   */
  private generateQuoteNumber(): string {
    const datePrefix = dayjs().format('YYYYMMDD');
    return `QT-${datePrefix}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Finds a quote by its ID.
   * @param id - The ID of the quote to find.
   * @returns A Promise that resolves to the QuoteApiResponse.
   */
  async findById(id: number): Promise<QuoteApiResponse> {
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
          'items.product',
          'items.productVariant',
        ],
      });
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(quote);
      if (!apiResponse) throw new ServerError(`Failed to map quote ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error finding quote by id ${id}`, error }, 'QuoteService.findById');
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding quote by id ${id}.`);
    }
  }

  /**
   * Retrieves all quotes with optional filtering, pagination, and sorting.
   * @param options - Options for filtering, pagination, and sorting.
   * @param options.limit - The maximum number of quotes to return.
   * @param options.offset - The number of quotes to skip.
   * @param options.filters - Filters to apply to the quotes.
   * @param options.sort - Sorting order for the quotes.
   * @param options.searchTerm - A term to search for within quotes.
   * @returns A Promise that resolves to an object containing an array of QuoteApiResponse and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Quote> | FindOptionsWhere<Quote>[];
    sort?: FindManyOptions<Quote>['order'];
    searchTerm?: string;
  }): Promise<{ quotes: QuoteApiResponse[]; total: number }> {
    try {
      const { quotes, count } = await this.quoteRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { issueDate: 'DESC', createdAt: 'DESC' },
        relations: ['customer', 'currency', 'createdByUser'],
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

  /**
   * Creates a new quote.
   * This operation is performed within a transaction to ensure data consistency.
   * @param input - The data for creating the quote.
   * @param createdByUserId - The ID of the user creating the quote.
   * @returns A Promise that resolves to the created QuoteApiResponse.
   */
  async createQuote(input: CreateQuoteInput, createdByUserId: number): Promise<QuoteApiResponse> {
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

      if (!input.items || input.items.length === 0) {
        throw new BadRequestError('Quote must contain at least one item.');
      }

      const quoteEntity = quoteRepoTx.create({
        ...input,
        issueDate: dayjs(input.issueDate).toDate(),
        expiryDate: input.expiryDate ? dayjs(input.expiryDate).toDate() : null,
        status: input.status ?? QuoteStatus.DRAFT,
        quoteNumber: this.generateQuoteNumber(),
        createdByUserId: createdByUserId,
        updatedByUserId: createdByUserId,
        items: [],
      });

      if (!quoteEntity.isValid()) {
        throw new BadRequestError(
          `Quote data is invalid. Errors: ${quoteValidationInputErrors.join(', ')}`,
        );
      }

      const savedQuote = await quoteRepoTx.save(quoteEntity);

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

        const itemEntity = itemRepoTx.create({
          ...itemInput,
          quoteId: savedQuote.id,
          description:
            itemInput.description ??
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

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.SALES_AND_DISTRIBUTION,
        savedQuote.id.toString(),
        { quoteNumber: savedQuote.quoteNumber },
      );

      return apiResponse;
    });
  }

  /**
   * Updates an existing quote.
   * This operation is performed within a transaction to ensure data consistency.
   * @param id - The ID of the quote to update.
   * @param input - The data for updating the quote.
   * @param updatedByUserId - The ID of the user updating the quote.
   * @returns A Promise that resolves to the updated QuoteApiResponse.
   */
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
      });
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

      if (quote.status !== QuoteStatus.DRAFT && quote.status !== QuoteStatus.SENT) {
        if (
          Object.keys(input).some(
            (key) => !['notes', 'termsAndConditions', 'status', 'expiryDate'].includes(key),
          )
        ) {
          throw new ForbiddenError(
            `Quote is in status "${quote.status}" and cannot be fully modified.`,
          );
        }
      }

      if (input.currencyId && input.currencyId !== quote.currencyId) {
        if (!(await this.currencyRepository.findById(input.currencyId)))
          throw new BadRequestError(`Currency ID ${input.currencyId} not found.`);
      }
      if (input.billingAddressId && input.billingAddressId !== quote.billingAddressId) {
        if (!(await this.addressRepository.findById(input.billingAddressId)))
          throw new BadRequestError(`Billing Address ID ${input.billingAddressId} not found.`);
      }
      if (input.hasOwnProperty('shippingAddressId')) {
        if (input.shippingAddressId && input.shippingAddressId !== quote.shippingAddressId) {
          if (!(await this.addressRepository.findById(input.shippingAddressId)))
            throw new BadRequestError(`Shipping Address ID ${input.shippingAddressId} not found.`);
        }
      }

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

      const tempQuote = quoteRepoTx.create({ ...quote, ...quoteUpdatePayload });
      if (!tempQuote.isValid()) {
        throw new BadRequestError(
          `Updated quote data is invalid: ${quoteValidationInputErrors.join(', ')}`,
        );
      }

      await quoteRepoTx.update(id, quoteUpdatePayload);

      if (input.items) {
        const inputItemIds = input.items
          .map((item) => item.id)
          .filter((itemId) => itemId !== undefined);

        const itemsToDelete = quote.items?.filter((item) => !inputItemIds.includes(item.id)) || [];
        if (itemsToDelete.length > 0) {
          await itemRepoTx.remove(itemsToDelete);
        }

        const itemsToUpdateOrAdd: QuoteItem[] = [];
        for (const itemInput of input.items) {
          const product = await this.productRepository.findById(itemInput.productId as number);
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
              itemInput.description ??
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
            const existingItem = quote.items?.find((i) => i.id === itemInput.id);
            if (!existingItem)
              throw new NotFoundError(
                `Quote item with ID ${itemInput.id} not found on this quote.`,
              );
            itemEntity = itemRepoTx.merge(existingItem, itemEntityData as Partial<QuoteItem>);
          } else {
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

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    });
  }

  /**
   * Soft deletes a quote by its ID.
   * A quote cannot be deleted if its status is ACCEPTED or CONVERTED_TO_ORDER.
   * @param id - The ID of the quote to delete.
   * @returns A Promise that resolves when the quote is successfully soft deleted.
   */
  async deleteQuote(id: number): Promise<void> {
    try {
      const quote = await this.quoteRepository.findById(id);
      if (!quote) throw new NotFoundError(`Quote with id ${id} not found.`);

      if (
        quote.status === QuoteStatus.ACCEPTED ||
        quote.status === QuoteStatus.CONVERTED_TO_ORDER
      ) {
        throw new BadRequestError(`Quote is in status '${quote.status}' and cannot be deleted.`);
      }

      const isConverted = await this.quoteRepository.isQuoteConvertedToOrder(id);
      if (isConverted) {
        throw new BadRequestError(
          `Quote '${quote.quoteNumber}' has been converted to an order and cannot be deleted.`,
        );
      }

      await this.quoteRepository.softDelete(id);

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
      );
    } catch (error) {
      logger.error({ message: `Error deleting quote ${id}`, error }, 'QuoteService.deleteQuote');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting quote ${id}.`);
    }
  }

  /**
   * Updates the status of a quote.
   * @param id - The ID of the quote to update.
   * @param status - The new status for the quote.
   * @param updatedByUserId - The ID of the user updating the quote status.
   * @returns A Promise that resolves to the updated QuoteApiResponse.
   */
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

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.SALES_AND_DISTRIBUTION,
        id.toString(),
        { newStatus: status },
      );

      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating status for quote ${id}`, error },
        'QuoteService.updateQuoteStatus',
      );
      throw new ServerError(`Error updating status for quote ${id}.`);
    }
  }

  /**
   * Converts an accepted quote to a sales order.
   * This method is currently a stub and requires the SalesOrder module to be implemented.
   * @param quoteId - The ID of the quote to convert.
   * @returns A Promise that resolves to the created sales order API response (currently throws an error).
   */
  async convertQuoteToOrder(quoteId: number): Promise<any> {
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

  /**
   * Returns a singleton instance of the QuoteService.
   * @returns The singleton instance of QuoteService.
   */
  static getInstance(): QuoteService {
    instance ??= new QuoteService();
    return instance;
  }
}
