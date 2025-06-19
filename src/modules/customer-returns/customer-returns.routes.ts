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
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { CustomerReturnService } from './services/customer-return.service';
import {
  CreateCustomerReturnInput,
  UpdateCustomerReturnInput,
  ReceiveReturnInput,
  CompleteReturnInput,
} from './models/customer-return.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class CustomerReturnRouter extends BaseRouter {
  private service = CustomerReturnService.getInstance();

  /**
   * @openapi
   * /customer-returns:
   *   get:
   *     summary: Get all customer returns
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: customerId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by customer ID
   *       - name: salesOrderId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by sales order ID
   *       - name: customerInvoiceId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by customer invoice ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [requested, approved, pending_reception, received_partial, received_complete, inspected, refund_pending, exchange_pending, credit_note_issued, refunded, exchanged, completed, cancelled] }
   *         description: Filter by return status
   *       - name: returnDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by return date (from)
   *       - name: returnDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by return date (to)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for returnNumber, customer name, notes
   *     responses:
   *       200:
   *         description: List of customer returns
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 returns:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerReturnApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/customer-returns')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'returnNumber',
    'returnDate',
    'status',
    'customerId',
    'salesOrderId',
    'createdAt',
  ])
  @filterable(['customerId', 'salesOrderId', 'customerInvoiceId', 'status', 'createdByUserId'])
  @searchable(['returnNumber', 'reason', 'notes'])
  async listCustomerReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllCustomerReturns({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /customer-returns/{id}:
   *   get:
   *     summary: Get customer return by ID
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *       - name: includeItems
   *         in: query
   *         schema: { type: boolean, default: true }
   *         description: Include return items in the response
   *     responses:
   *       200:
   *         description: Customer return found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customer-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async getCustomerReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findCustomerReturnById(id));
  }

  /**
   * @openapi
   * /customer-returns:
   *   post:
   *     summary: Create a new customer return request
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerReturnInput'
   *     responses:
   *       201:
   *         description: Customer return created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/customer-returns')
  @authorize({ level: SecurityLevel.USER })
  async createCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateCustomerReturnInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.createCustomerReturn(input, userId), 201);
  }

  /**
   * @openapi
   * /customer-returns/{id}:
   *   put:
   *     summary: Update a customer return (header info, and items if status allows)
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerReturnInput'
   *     responses:
   *       200:
   *         description: Customer return updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/customer-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateCustomerReturnInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateCustomerReturn(id, input, userId));
  }

  /**
   * @openapi
   * /customer-returns/{id}/approve:
   *   patch:
   *     summary: Approve a customer return request
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ApproveReturnInput'
   *     responses:
   *       200:
   *         description: Return approved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/customer-returns/:id/approve')
  @authorize({ level: SecurityLevel.USER })
  async approveCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    const input = req.body;
    await this.pipe(res, req, next, () => this.service.approveReturn(id, input, userId));
  }

  /**
   * @openapi
   * /customer-returns/{id}/receive:
   *   patch:
   *     summary: Record reception of returned items
   *     description: Updates quantities received for items, their condition, and action taken. May trigger stock movements.
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ReceiveReturnInput'
   *     responses:
   *       200:
   *         description: Items received and recorded
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/customer-returns/:id/receive')
  @authorize({ level: SecurityLevel.USER })
  async receiveCustomerReturnItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    const input: ReceiveReturnInput = req.body;
    await this.pipe(res, req, next, () => this.service.receiveReturnItems(id, input, userId));
  }

  /**
   * @openapi
   * /customer-returns/{id}/complete:
   *   post:
   *     summary: Complete the customer return process
   *     description: Finalizes the return, typically after inspection and decision on refund/exchange.
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompleteReturnInput'
   *     responses:
   *       200:
   *         description: Return process completed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/customer-returns/:id/complete')
  @authorize({ level: SecurityLevel.USER })
  async completeCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    const input: CompleteReturnInput = req.body;
    await this.pipe(res, req, next, () => this.service.completeReturnProcess(id, input, userId));
  }

  /**
   * @openapi
   * /customer-returns/{id}/cancel:
   *   patch:
   *     summary: Cancel a customer return request
   *     description: Possible if the return has not been significantly processed (e.g., items not yet received).
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       200:
   *         description: Return cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/customer-returns/:id/cancel')
  @authorize({ level: SecurityLevel.USER })
  async cancelCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.cancelCustomerReturn(id, userId));
  }

  /**
   * @openapi
   * /customer-returns/{id}:
   *   delete:
   *     summary: Delete a customer return (soft delete)
   *     description: Only possible for returns in certain statuses (e.g., draft, cancelled).
   *     tags: [Customer Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       204:
   *         description: Customer return deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/customer-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteCustomerReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteCustomerReturn(id, userId);
      },
      204,
    );
  }
}
