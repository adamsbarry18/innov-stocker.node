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
import { CustomerInvoiceService } from './services/customer-invoice.service';
import {
  CreateCustomerInvoiceInput,
  UpdateCustomerInvoiceInput,
  CustomerInvoiceStatus,
} from './models/customer-invoice.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import logger from '@/lib/logger';

export default class CustomerInvoiceRouter extends BaseRouter {
  private service = CustomerInvoiceService.getInstance();

  /**
   * @openapi
   * /customer-invoices:
   *   get:
   *     summary: Get all customer invoices
   *     tags: [Customer Invoices]
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
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [draft, sent, partially_paid, paid, overdue, voided, cancelled] }
   *         description: Filter by invoice status
   *       - name: invoiceDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by invoice date (from)
   *       - name: invoiceDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by invoice date (to)
   *       - name: dueDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by due date (from)
   *       - name: dueDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by due date (to)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for invoiceNumber, customer name
   *     responses:
   *       200:
   *         description: List of customer invoices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 invoices:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/customer-invoices')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'invoiceNumber',
    'invoiceDate',
    'dueDate',
    'status',
    'totalAmountTtc',
    'customerId',
    'createdAt',
  ])
  @filterable(['customerId', 'status', 'currencyId', 'createdByUserId'])
  @searchable(['invoiceNumber', 'notes'])
  async listCustomerInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllCustomerInvoices({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /customer-invoices/{id}:
   *   get:
   *     summary: Get customer invoice by ID
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Customer invoice ID
   *     responses:
   *       200:
   *         description: Customer invoice found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customer-invoices/:id')
  @authorize({ level: SecurityLevel.USER })
  async getCustomerInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    await this.pipe(res, req, next, () => this.service.findCustomerInvoiceById(id));
  }

  /**
   * @openapi
   * /customer-invoices:
   *   post:
   *     summary: Create a new customer invoice
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerInvoiceInput'
   *     responses:
   *       201:
   *         description: Invoice created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/customer-invoices')
  @authorize({ level: SecurityLevel.USER })
  async createCustomerInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateCustomerInvoiceInput = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return next(new UnauthorizedError('User ID not found.'));
    }
    await this.pipe(res, req, next, () => this.service.createCustomerInvoice(input, userId), 201);
  }

  /**
   * @openapi
   * /customer-invoices/{id}:
   *   put:
   *     summary: Update a customer invoice
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Customer invoice ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerInvoiceInput'
   *     responses:
   *       200:
   *         description: Invoice updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/customer-invoices/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateCustomerInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateCustomerInvoiceInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateCustomerInvoice(id, input, userId));
  }

  /**
   * @openapi
   * /customer-invoices/{id}/status:
   *   patch:
   *     summary: Update the status of a customer invoice
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Customer invoice ID
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
   *                 enum: [draft, sent, partially_paid, paid, overdue, voided, cancelled]
   *     responses:
   *       200:
   *         description: Invoice status updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/customer-invoices/:id/status')
  @authorize({ level: SecurityLevel.USER })
  async updateCustomerInvoiceStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const { status } = req.body;
    if (
      !status ||
      !Object.values(CustomerInvoiceStatus).includes(status as CustomerInvoiceStatus)
    ) {
      return next(new BadRequestError('Invalid or missing status.'));
    }
    const userId = req.user!.id;
    await this.pipe(res, req, next, () =>
      this.service.updateCustomerInvoiceStatus(id, status as CustomerInvoiceStatus, userId),
    );
  }

  /**
   * @openapi
   * /customer-invoices/{id}/send:
   *   post:
   *     summary: Mark an invoice as sent (e.g., via email)
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Customer invoice ID
   *     responses:
   *       200:
   *         description: Invoice marked as sent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/customer-invoices/:id/send')
  @authorize({ level: SecurityLevel.USER })
  async sendCustomerInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    // This would typically trigger an email sending process and then update status
    await this.pipe(res, req, next, () =>
      this.service.updateCustomerInvoiceStatus(id, CustomerInvoiceStatus.SENT, userId),
    );
  }

  /**
   * @openapi
   * /customer-invoices/{id}:
   *   delete:
   *     summary: Delete or void a customer invoice
   *     description: Only possible for invoices in DRAFT or CANCELLED status for deletion. Processed invoices might be VOIDED.
   *     tags: [Customer Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Customer invoice ID
   *     responses:
   *       204:
   *         description: Invoice deleted/voided successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/customer-invoices/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteCustomerInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteCustomerInvoice(id);
      },
      204,
    );
  }
}
