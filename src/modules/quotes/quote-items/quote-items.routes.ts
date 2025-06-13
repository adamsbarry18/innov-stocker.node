import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { QuoteItemService } from './services/quote-item.service';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { CreateQuoteItemInput, UpdateQuoteItemInput } from './models/quote-item.entity';

export default class QuoteRouter extends BaseRouter {
  quoteItemService = QuoteItemService.getInstance();

  /**
   * @openapi
   * /quotes/{quoteId}/items:
   *   post:
   *     summary: Add an item to a specific quote
   *     tags: [Quotes, Quote Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: quoteId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote to add item to
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateQuoteItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully to quote
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/quotes/:quoteId/items')
  @authorize({ level: SecurityLevel.USER })
  async addQuoteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const quoteId = parseInt(req.params.quoteId, 10);
    if (isNaN(quoteId)) return next(new BadRequestError('Invalid Quote ID.'));

    const input: CreateQuoteItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.quoteItemService.addItemToQuote(quoteId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /quotes/{quoteId}/items:
   *   get:
   *     summary: Get all items for a specific quote
   *     tags: [Quotes, Quote Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: quoteId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote
   *     responses:
   *       200:
   *         description: List of items for the quote
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/QuoteItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/quotes/:quoteId/items')
  @authorize({ level: SecurityLevel.USER })
  async listQuoteItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const quoteId = parseInt(req.params.quoteId, 10);
    if (isNaN(quoteId)) return next(new BadRequestError('Invalid Quote ID.'));
    await this.pipe(res, req, next, () => this.quoteItemService.getQuoteItems(quoteId));
  }

  /**
   * @openapi
   * /quotes/{quoteId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a quote
   *     tags: [Quotes, Quote Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: quoteId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote item
   *     responses:
   *       200:
   *         description: Quote item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteItemApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/quotes/:quoteId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getQuoteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const quoteId = parseInt(req.params.quoteId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(quoteId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Quote or Item ID.'));
    await this.pipe(res, req, next, () => this.quoteItemService.getQuoteItemById(quoteId, itemId));
  }

  /**
   * @openapi
   * /quotes/{quoteId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a quote
   *     tags: [Quotes, Quote Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: quoteId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote item
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateQuoteItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/quotes/:quoteId/items/:itemId')
  @authorize({ level: SecurityLevel.USER }) // User who can edit the quote
  async updateQuoteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const quoteId = parseInt(req.params.quoteId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(quoteId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Quote or Item ID.'));

    const input: UpdateQuoteItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.quoteItemService.updateQuoteItem(quoteId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /quotes/{quoteId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a quote
   *     tags: [Quotes, Quote Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: quoteId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the quote item
   *     responses:
   *       204:
   *         description: Item removed successfully
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/quotes/:quoteId/items/:itemId')
  @authorize({ level: SecurityLevel.USER }) // User who can edit the quote
  async removeQuoteItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const quoteId = parseInt(req.params.quoteId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(quoteId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Quote or Item ID.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.quoteItemService.removeQuoteItem(quoteId, itemId, userId);
      },
      204,
    );
  }
}
