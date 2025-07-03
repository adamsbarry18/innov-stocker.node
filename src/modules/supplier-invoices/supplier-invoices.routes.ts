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
import { SupplierInvoiceService } from './services/supplier-invoice.service';
import {
  CreateSupplierInvoiceInput,
  UpdateSupplierInvoiceInput,
  SupplierInvoiceStatus,
} from './models/supplier-invoice.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class SupplierInvoiceRouter extends BaseRouter {
  service = SupplierInvoiceService.getInstance();

  /**
   * @openapi
   * /supplier-invoices:
   *   get:
   *     summary: Get all supplier invoices
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: supplierId
   *         in: query
   *         schema: { type: integer }
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [draft, pending_payment, partially_paid, paid, cancelled] }
   *       - name: invoiceDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: invoiceDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: dueDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: dueDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for invoiceNumber, supplier name
   *     responses:
   *       200:
   *         description: List of supplier invoices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 invoices:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SupplierInvoiceApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/supplier-invoices')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable([
    'id',
    'invoiceNumber',
    'invoiceDate',
    'dueDate',
    'status',
    'totalAmountTtc',
    'supplierId',
    'createdAt',
  ])
  @filterable(['supplierId', 'status', 'currencyId'])
  @searchable(['invoiceNumber', 'notes'])
  async listSupplierInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllSupplierInvoices({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /supplier-invoices/{id}:
   *   get:
   *     summary: Get supplier invoice by ID
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Supplier invoice found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/supplier-invoices/:id')
  @authorize({ level: SecurityLevel.READER })
  async getSupplierInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(res, req, next, () => this.service.findSupplierInvoiceById(id));
  }

  /**
   * @openapi
   * /supplier-invoices:
   *   post:
   *     summary: Create a new supplier invoice
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSupplierInvoiceInput'
   *     responses:
   *       201:
   *         description: Supplier invoice created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/supplier-invoices')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async createSupplierInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateSupplierInvoiceInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.service.createSupplierInvoice(input, userId), 201);
  }

  /**
   * @openapi
   * /supplier-invoices/{id}:
   *   put:
   *     summary: Update a supplier invoice
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSupplierInvoiceInput'
   *     responses:
   *       200:
   *         description: Supplier invoice updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/supplier-invoices/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateSupplierInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateSupplierInvoiceInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.service.updateSupplierInvoice(id, input, userId));
  }

  /**
   * @openapi
   * /supplier-invoices/{id}/status:
   *   patch:
   *     summary: Update the status of a supplier invoice
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
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
   *                 enum: [draft, pending_payment, partially_paid, paid, cancelled]
   *     responses:
   *       200:
   *         description: Supplier invoice status updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/supplier-invoices/:id/status')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateSupplierInvoiceStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const { status } = req.body;
    if (
      !status ||
      !Object.values(SupplierInvoiceStatus).includes(status as SupplierInvoiceStatus)
    ) {
      return next(new BadRequestError('Invalid or missing status.'));
    }
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () =>
      this.service.updateSupplierInvoiceStatus(id, status as SupplierInvoiceStatus, userId),
    );
  }

  /**
   * @openapi
   * /supplier-invoices/{id}:
   *   delete:
   *     summary: Delete a supplier invoice (soft delete)
   *     tags: [Supplier Invoices]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       204:
   *         description: Supplier invoice deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/supplier-invoices/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteSupplierInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteSupplierInvoice(id);
      },
      204,
    );
  }
}
