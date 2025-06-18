import { appDataSource } from '@/database/data-source';
import {
  QuoteItem,
  type CreateQuoteItemInput,
  type UpdateQuoteItemInput,
  type QuoteItemApiResponse,
  createQuoteItemSchema,
  updateQuoteItemSchema,
} from '../models/quote-item.entity';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import { QuoteItemRepository } from '../data/quote-item.repository';
import { ProductRepository } from '@/modules/products/data/product.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';
import { QuoteRepository } from '@/modules/quotes/data/quote.repository';
import { Quote, QuoteStatus } from '@/modules/quotes/models/quote.entity';

let instance: QuoteItemService | null = null;

export class QuoteItemService {
  private readonly quoteRepository: QuoteRepository;
  private readonly itemRepository: QuoteItemRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;

  constructor(
    quoteRepository: QuoteRepository = new QuoteRepository(),
    itemRepository: QuoteItemRepository = new QuoteItemRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
  ) {
    this.quoteRepository = quoteRepository;
    this.itemRepository = itemRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
  }

  mapToApiResponse(item: QuoteItem | null): QuoteItemApiResponse | null {
    if (!item) return null;
    return item.toApi();
  }

  private async getQuoteAndCheckStatus(
    quoteId: number,
    allowedStatuses?: QuoteStatus[],
  ): Promise<Quote> {
    const quote = await this.quoteRepository.findById(quoteId, { relations: ['items'] }); // Load items for recalculation
    if (!quote) {
      throw new NotFoundError(`Quote with ID ${quoteId} not found.`);
    }
    if (allowedStatuses && !allowedStatuses.includes(quote.status)) {
      throw new ForbiddenError(
        `Cannot modify items of a quote with status '${quote.status}'. Allowed statuses: ${allowedStatuses.join(', ')}.`,
      );
    }
    return quote;
  }

  private async validateItemProductAndVariant(input: {
    productId: number;
    productVariantId?: number | null;
  }): Promise<{ productName: string; variantName?: string | null; defaultVat?: number | null }> {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${input.productId} not found for item.`);

    let variantName: string | null = null;
    if (input.productVariantId) {
      const variant = await this.variantRepository.findById(input.productVariantId);
      if (!variant || variant.productId !== input.productId) {
        throw new BadRequestError(
          `Product Variant ID ${input.productVariantId} not found or does not belong to product ${input.productId}.`,
        );
      }
      variantName = variant.nameVariant;
    }
    return { productName: product.name, variantName, defaultVat: product.defaultVatRatePercentage };
  }

  async addItemToQuote(
    quoteId: number,
    input: CreateQuoteItemInput,
    createdByUserId: number, // For audit if QuoteItem had createdByUserId
  ): Promise<QuoteItemApiResponse> {
    const validationResult = createQuoteItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const quoteRepoTx = transactionalEntityManager.getRepository(Quote);
      const itemRepoTx = transactionalEntityManager.getRepository(QuoteItem);

      const quote = await this.getQuoteAndCheckStatus(quoteId, [
        QuoteStatus.DRAFT,
        QuoteStatus.SENT,
      ]);

      const { productName, variantName, defaultVat } =
        await this.validateItemProductAndVariant(validatedInput);

      const itemEntity = itemRepoTx.create({
        ...validatedInput,
        quoteId: quoteId,
        description: validatedInput.description ?? variantName ?? productName,
        vatRatePercentage:
          validatedInput.vatRatePercentage !== undefined
            ? validatedInput.vatRatePercentage
            : defaultVat,
      });
      if (!itemEntity.isValid()) {
        throw new BadRequestError(`Item data is invalid (internal check).`);
      }

      const savedItem = await itemRepoTx.save(itemEntity);

      const itemsForTotal = await itemRepoTx.find({ where: { quoteId } });
      quote.items = itemsForTotal;
      quote.calculateTotals();
      quote.updatedByUserId = createdByUserId;
      await quoteRepoTx.save(quote);

      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: ['product', 'productVariant'],
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map created quote item.');
      return apiResponse;
    });
  }

  async getQuoteItems(quoteId: number): Promise<QuoteItemApiResponse[]> {
    await this.getQuoteAndCheckStatus(quoteId); // Just to validate quote existence
    const items = await this.itemRepository.findByQuoteId(quoteId);
    return items
      .map((item) => this.mapToApiResponse(item))
      .filter(Boolean) as QuoteItemApiResponse[];
  }

  async getQuoteItemById(quoteId: number, itemId: number): Promise<QuoteItemApiResponse> {
    // getQuoteAndCheckStatus(quoteId); // Optional: ensure quote exists first
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.quoteId !== quoteId) {
      throw new NotFoundError(`Quote item with ID ${itemId} not found for quote ${quoteId}.`);
    }
    const apiResponse = this.mapToApiResponse(item);
    if (!apiResponse) throw new ServerError('Failed to map quote item.');
    return apiResponse;
  }

  async updateQuoteItem(
    quoteId: number,
    itemId: number,
    input: UpdateQuoteItemInput,
    updatedByUserId: number,
  ): Promise<QuoteItemApiResponse> {
    const validationResult = updateQuoteItemSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid item update data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const quoteRepoTx = transactionalEntityManager.getRepository(Quote);
      const itemRepoTx = transactionalEntityManager.getRepository(QuoteItem);

      const quote = await this.getQuoteAndCheckStatus(quoteId, [
        QuoteStatus.DRAFT,
        QuoteStatus.SENT,
      ]);
      const item = await itemRepoTx.findOne({ where: { id: itemId, quoteId } });
      if (!item) {
        throw new NotFoundError(`Quote item with ID ${itemId} not found for quote ${quoteId}.`);
      }

      // Apply updates
      if (validatedInput.description !== undefined) item.description = validatedInput.description;
      if (validatedInput.quantity !== undefined) item.quantity = validatedInput.quantity;
      if (validatedInput.unitPriceHt !== undefined) item.unitPriceHt = validatedInput.unitPriceHt;
      if (validatedInput.discountPercentage !== undefined)
        item.discountPercentage = validatedInput.discountPercentage;
      if (validatedInput.vatRatePercentage !== undefined)
        item.vatRatePercentage = validatedInput.vatRatePercentage;
      // item.updatedByUserId = updatedByUserId; // If audit on QuoteItem

      if (!item.isValid()) {
        throw new BadRequestError(`Updated item data is invalid (internal check).`);
      }

      const savedItem = await itemRepoTx.save(item);

      // Recalculate quote totals
      const itemsForTotal = await itemRepoTx.find({ where: { quoteId } });
      quote.items = itemsForTotal;
      quote.calculateTotals();
      quote.updatedByUserId = updatedByUserId;
      await quoteRepoTx.save(quote);

      const populatedItem = await itemRepoTx.findOne({
        where: { id: savedItem.id },
        relations: ['product', 'productVariant'],
      });
      const apiResponse = this.mapToApiResponse(populatedItem);
      if (!apiResponse) throw new ServerError('Failed to map updated quote item.');
      return apiResponse;
    });
  }

  async removeQuoteItem(quoteId: number, itemId: number, deletedByUserId: number): Promise<void> {
    await appDataSource.transaction(async (transactionalEntityManager) => {
      const quoteRepoTx = transactionalEntityManager.getRepository(Quote);
      const itemRepoTx = transactionalEntityManager.getRepository(QuoteItem);

      const quote = await this.getQuoteAndCheckStatus(quoteId, [
        QuoteStatus.DRAFT,
        QuoteStatus.SENT,
      ]);
      const item = await itemRepoTx.findOneBy({ id: itemId, quoteId });
      if (!item) {
        throw new NotFoundError(`Quote item with ID ${itemId} not found for quote ${quoteId}.`);
      }

      await itemRepoTx.remove(item);

      const itemsForTotal = await itemRepoTx.find({ where: { quoteId } });
      quote.items = itemsForTotal;
      quote.calculateTotals();
      quote.updatedByUserId = deletedByUserId;
      await quoteRepoTx.save(quote);
    });
  }

  static getInstance(): QuoteItemService {
    instance ??= new QuoteItemService();
    return instance;
  }
}
