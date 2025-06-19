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
import { SalesOrderService } from './services/sales-order.service';
import {
  CreateSalesOrderInput,
  UpdateSalesOrderInput,
  SalesOrderStatus,
} from './models/sales-order.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class SalesOrderRouter extends BaseRouter {
  orderService = SalesOrderService.getInstance();

  /**
   * @openapi
   * /sales-orders:
   *   get:
   *     summary: Get all sales orders
   *     tags: [Sales Orders]
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
   *         schema: { type: string, enum: [draft, pending_approval, approved, payment_pending, payment_received, in_preparation, partially_shipped, fully_shipped, invoiced, completed, cancelled] }
   *         description: Filter by sales order status
   *       - name: orderDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by order date (from)
   *       - name: orderDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter by order date (to)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for orderNumber, customer name/company, notes
   *     responses:
   *       200:
   *         description: List of sales orders
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 orders:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SalesOrderApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/sales-orders')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'orderNumber',
    'orderDate',
    'status',
    'totalAmountTtc',
    'customerId',
    'createdAt',
  ])
  @filterable(['customerId', 'status', 'createdByUserId'])
  @searchable(['orderNumber', 'notes'])
  async getAllSalesOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.orderService.findAllSalesOrders({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /sales-orders/{id}:
   *   get:
   *     summary: Get sales order by ID
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     responses:
   *       200:
   *         description: Sales order found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/sales-orders/:id')
  @authorize({ level: SecurityLevel.USER })
  async getSalesOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.orderService.findSalesOrderById(id));
  }

  /**
   * @openapi
   * /sales-orders:
   *   post:
   *     summary: Create a new sales order
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSalesOrderInput'
   *     responses:
   *       201:
   *         description: Sales order created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/sales-orders')
  @authorize({ level: SecurityLevel.USER })
  async createSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateSalesOrderInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.orderService.createSalesOrder(input, userId), 201);
  }

  /**
   * @openapi
   * /sales-orders/{id}:
   *   put:
   *     summary: Update a sales order
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSalesOrderInput'
   *     responses:
   *       200:
   *         description: Sales order updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/sales-orders/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateSalesOrderInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.orderService.updateSalesOrder(id, input, userId));
  }

  /**
   * @openapi
   * /sales-orders/{id}/approve:
   *   patch:
   *     summary: Approve a sales order
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     responses:
   *       200:
   *         description: Sales order approved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/sales-orders/:id/approve')
  @authorize({ level: SecurityLevel.USER }) // or INTEGRATOR
  async approveSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () =>
      this.orderService.updateSalesOrderStatus(id, SalesOrderStatus.APPROVED, userId),
    );
  }

  /**
   * @openapi
   * /sales-orders/{id}/prepare:
   *   patch:
   *     summary: Mark a sales order as in preparation
   *     description: This status might trigger stock reservation.
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     responses:
   *       200:
   *         description: Sales order marked as in preparation
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/sales-orders/:id/prepare')
  @authorize({ level: SecurityLevel.USER })
  async prepareSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () =>
      this.orderService.updateSalesOrderStatus(id, SalesOrderStatus.IN_PREPARATION, userId),
    );
  }

  /**
   * @openapi
   * /sales-orders/{id}/cancel:
   *   patch:
   *     summary: Cancel a sales order
   *     description: Possible if order not yet shipped or in advanced processing. Might un-reserve stock.
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     responses:
   *       200:
   *         description: Sales order cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/sales-orders/:id/cancel')
  @authorize({ level: SecurityLevel.USER }) // or INTEGRATOR
  async cancelSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () =>
      this.orderService.updateSalesOrderStatus(id, SalesOrderStatus.CANCELLED, userId),
    );
  }

  /**
   * @openapi
   * /sales-orders/{id}:
   *   delete:
   *     summary: Delete a sales order (soft delete)
   *     description: Only possible for orders in certain statuses (e.g., draft, cancelled).
   *     tags: [Sales Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Sales order ID
   *     responses:
   *       204:
   *         description: Sales order deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/sales-orders/:id')
  @authorize({ level: SecurityLevel.USER }) // or ADMIN
  async deleteSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.orderService.deleteSalesOrder(id);
      },
      204,
    );
  }

  // --- Routes pour les entités liées à SalesOrder (non demandées explicitement mais pour référence) ---
  // GET /sales-orders/{orderId}/deliveries : Lister les livraisons associées
  // GET /sales-orders/{orderId}/invoices : Lister les factures associées
}
