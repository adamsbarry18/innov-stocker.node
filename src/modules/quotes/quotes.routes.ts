import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  Put,
  Delete,
  Patch,
  authorize,
  paginate,
  sortable,
  filterable,
  searchable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '../../config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { QuoteService } from './services/quote.service';
import { CreateQuoteInput, UpdateQuoteInput, Quote, QuoteStatus } from './models/quote.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { type FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import dayjs from 'dayjs';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class QuoteRouter extends BaseRouter {
  service = QuoteService.getInstance();

  /**
   * @openapi
   * /quotes:
   *   get:
   *     summary: Get all quotes
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: customerId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Customer ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [draft, sent, accepted, refused, cancelled, converted_to_order] }
   *         description: Filter by quote status
   *       - name: issueDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter quotes issued on or after this date (YYYY-MM-DD)
   *       - name: issueDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter quotes issued on or before this date (YYYY-MM-DD)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for quoteNumber, customer name, notes
   *     responses:
   *       200:
   *         description: List of quotes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 quotes:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/QuoteApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/quotes')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'quoteNumber',
    'issueDate',
    'expiryDate',
    'status',
    'totalAmountTtc',
    'customerId',
    'createdAt',
  ])
  @filterable(['customerId', 'status'])
  @searchable([
    'quoteNumber',
    'customer.companyName',
    'customer.firstName',
    'customer.lastName',
    'notes',
  ]) // Requires join for customer fields
  async getAllQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);
    const searchTerm = req.searchQuery;

    const effectiveFilters: FindOptionsWhere<Quote>[] = [];

    if (req.query.issueDateFrom && req.query.issueDateTo) {
      const from = dayjs(req.query.issueDateFrom as string);
      const to = dayjs(req.query.issueDateTo as string);
      if (from.isValid() && to.isValid()) {
        filters.issueDate = Between(from.toDate(), to.endOf('day').toDate());
      } else {
        return next(new BadRequestError('Invalid date range for issueDate.'));
      }
    } else if (req.query.issueDateFrom) {
      const from = dayjs(req.query.issueDateFrom as string);
      if (from.isValid()) {
        filters.issueDate = MoreThanOrEqual(from.toDate());
      } else {
        return next(new BadRequestError('Invalid issueDateFrom format.'));
      }
    } else if (req.query.issueDateTo) {
      const to = dayjs(req.query.issueDateTo as string);
      if (to.isValid()) {
        filters.issueDate = LessThanOrEqual(to.endOf('day').toDate());
      } else {
        return next(new BadRequestError('Invalid issueDateTo format.'));
      }
    }

    if (Object.keys(filters).length > 0) {
      effectiveFilters.push(filters);
    }

    await this.pipe(res, req, next, () =>
      this.service.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters: effectiveFilters.length > 0 ? effectiveFilters : undefined,
        sort,
        searchTerm: searchTerm,
      }),
    );
  }

  /**
   * @openapi
   * /quotes/{id}:
   *   get:
   *     summary: Get quote by ID
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Quote ID
   *     responses:
   *       200:
   *         description: Quote found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/quotes/:id')
  @authorize({ level: SecurityLevel.USER })
  async getQuoteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /quotes:
   *   post:
   *     summary: Create a new quote
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateQuoteInput'
   *     responses:
   *       201:
   *         description: Quote created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/quotes')
  @authorize({ level: SecurityLevel.USER }) // Sales role or similar
  async createQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateQuoteInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.createQuote(input, userId), 201);
  }

  /**
   * @openapi
   * /quotes/{id}:
   *   put:
   *     summary: Update a quote
   *     description: Allows updating details of a quote, typically if it's in a draft or sent status. Items can also be modified.
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Quote ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateQuoteInput'
   *     responses:
   *       200:
   *         description: Quote updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/quotes/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdateQuoteInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.updateQuote(id, input, userId));
  }

  /**
   * @openapi
   * /quotes/{id}/status:
   *   patch:
   *     summary: Update the status of a quote
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Quote ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [draft, sent, accepted, refused, cancelled, converted_to_order]
   *     responses:
   *       200:
   *         description: Quote status updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QuoteApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/quotes/:id/status')
  @authorize({ level: SecurityLevel.USER })
  async updateQuoteStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const { status } = req.body;
    if (!status || !Object.values(QuoteStatus).includes(status as QuoteStatus)) {
      return next(new BadRequestError('Invalid or missing status.'));
    }
    const userId = req.user!.id;
    await this.pipe(res, req, next, () =>
      this.service.updateQuoteStatus(id, status as QuoteStatus, userId),
    );
  }

  /**
   * @openapi
   * /quotes/{id}/convert-to-order:
   *   post:
   *     summary: Convert an accepted quote to a sales order
   *     tags: [Quotes, Sales Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Quote ID
   *     responses:
   *       201:
   *         description: Sales order created successfully from quote
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       501:
   *         description: Not Implemented Yet
   */
  @Post('/quotes/:id/convert-to-order')
  @authorize({ level: SecurityLevel.USER })
  async convertQuoteToOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(res, req, next, () => this.service.convertQuoteToOrder(id), 201);
  }

  /**
   * @openapi
   * /quotes/{id}:
   *   delete:
   *     summary: Delete a quote (soft delete)
   *     description: Deletion might be restricted if the quote is accepted or converted.
   *     tags: [Quotes]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Quote ID
   *     responses:
   *       204:
   *         description: Quote deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/quotes/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteQuote(id);
      },
      204,
    );
  }
}
