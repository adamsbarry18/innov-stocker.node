import { BaseRouter } from '../../common/routing/BaseRouter';
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
import { PurchaseOrderService } from './services/purchase-order.service';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  PurchaseOrder,
  PurchaseOrderStatus,
} from './models/purchase-order.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import dayjs from 'dayjs';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

export default class PurchaseOrderRouter extends BaseRouter {
  service = PurchaseOrderService.getInstance();

  /**
   * @openapi
   * /purchase-orders:
   *   get:
   *     summary: Get all purchase orders
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: supplierId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Supplier ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [draft, pending_approval, approved, sent_to_supplier, partially_received, fully_received, cancelled] }
   *         description: Filter by purchase order status
   *       - name: orderDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter POs ordered on or after this date (YYYY-MM-DD)
   *       - name: orderDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter POs ordered on or before this date (YYYY-MM-DD)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for orderNumber, supplier name, notes
   *     responses:
   *       200:
   *         description: List of purchase orders
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 orders:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/purchase-orders')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'orderNumber',
    'orderDate',
    'expectedDeliveryDate',
    'status',
    'totalAmountTtc',
    'supplierId',
    'createdAt',
  ])
  @filterable(['supplierId', 'status', 'createdByUserId', 'approvedByUserId'])
  @searchable(['orderNumber', 'supplier.name', 'notes'])
  async getAllPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters: baseFilters, sort } = buildTypeORMCriteria(req);
    const searchTerm = req.searchQuery;

    let effectiveFilters: FindOptionsWhere<PurchaseOrder> | FindOptionsWhere<PurchaseOrder>[] =
      Array.isArray(baseFilters) ? [...baseFilters] : [{ ...baseFilters }];

    if (req.query.orderDateFrom || req.query.orderDateTo) {
      const dateFilter: FindOptionsWhere<PurchaseOrder> = {};
      if (req.query.orderDateFrom && req.query.orderDateTo) {
        const from = dayjs(req.query.orderDateFrom as string);
        const to = dayjs(req.query.orderDateTo as string);
        if (from.isValid() && to.isValid() && from.isBefore(to.add(1, 'day'))) {
          dateFilter.orderDate = Between(from.toDate(), to.endOf('day').toDate());
        } else {
          return next(new BadRequestError('Invalid date range for orderDate.'));
        }
      } else if (req.query.orderDateFrom) {
        const from = dayjs(req.query.orderDateFrom as string);
        if (from.isValid()) dateFilter.orderDate = MoreThanOrEqual(from.toDate());
        else return next(new BadRequestError('Invalid orderDateFrom format.'));
      } else if (req.query.orderDateTo) {
        const to = dayjs(req.query.orderDateTo as string);
        if (to.isValid()) dateFilter.orderDate = LessThanOrEqual(to.endOf('day').toDate());
        else return next(new BadRequestError('Invalid orderDateTo format.'));
      }
      if (Array.isArray(effectiveFilters)) {
        effectiveFilters = effectiveFilters.map((f) => ({ ...f, ...dateFilter }));
      } else {
        effectiveFilters = [
          { ...(effectiveFilters as FindOptionsWhere<PurchaseOrder>), ...dateFilter },
        ];
      }
    }

    await this.pipe(res, req, next, () =>
      this.service.findAllPurchaseOrders({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters: effectiveFilters,
        sort,
        searchTerm: searchTerm,
      }),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{id}:
   *   get:
   *     summary: Get purchase order by ID
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     responses:
   *       200:
   *         description: Purchase order found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/purchase-orders/:id')
  @authorize({ level: SecurityLevel.USER })
  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.findPurchaseOrderById(id, userId));
  }

  /**
   * @openapi
   * /purchase-orders:
   *   post:
   *     summary: Create a new purchase order
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePurchaseOrderInput'
   *     responses:
   *       201:
   *         description: Purchase order created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/purchase-orders')
  @authorize({ level: SecurityLevel.USER })
  async createPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreatePurchaseOrderInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.createPurchaseOrder(input, userId), 201);
  }

  /**
   * @openapi
   * /purchase-orders/{id}:
   *   put:
   *     summary: Update a purchase order
   *     description: Allows updating details of a PO, typically if in draft or pending approval. Item management is complex.
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePurchaseOrderInput'
   *     responses:
   *       200:
   *         description: Purchase order updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/purchase-orders/:id')
  @authorize({ level: SecurityLevel.USER })
  async updatePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdatePurchaseOrderInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.updatePurchaseOrder(id, input, userId));
  }

  /**
   * @openapi
   * /purchase-orders/{id}/status:
   *   patch:
   *     summary: Update the status of a purchase order
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
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
   *                 enum: [draft, pending_approval, approved, sent_to_supplier, partially_received, fully_received, cancelled]
   *               approvedByUserId:
   *                 type: integer
   *                 description: ID of the user approving the order. Required if setting status to 'approved'.
   *     responses:
   *       200:
   *         description: Purchase order status updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/purchase-orders/:id/status')
  @authorize({ level: SecurityLevel.USER })
  async updatePurchaseOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const { status, approvedByUserId: inputApprovedByUserId } = req.body;
    if (!status || !Object.values(PurchaseOrderStatus).includes(status as PurchaseOrderStatus)) {
      return next(new BadRequestError('Invalid or missing status.'));
    }
    const userId = req.user!.id; // User performing the update
    const approvedBy =
      status === PurchaseOrderStatus.APPROVED ? inputApprovedByUserId || userId : undefined;

    await this.pipe(res, req, next, () =>
      this.service.updatePurchaseOrderStatus(id, status as PurchaseOrderStatus, userId, approvedBy),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{id}/approve:
   *   patch:
   *     summary: Approve a purchase order
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     responses:
   *       200:
   *         description: Purchase order approved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/purchase-orders/:id/approve')
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Higher level for approval
  async approvePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id; // User performing the action is the approver
    await this.pipe(res, req, next, () =>
      this.service.updatePurchaseOrderStatus(id, PurchaseOrderStatus.APPROVED, userId, userId),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{id}/send:
   *   patch:
   *     summary: Mark a purchase order as sent to supplier
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     responses:
   *       200:
   *         description: Purchase order marked as sent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/purchase-orders/:id/send')
  @authorize({ level: SecurityLevel.USER }) // User who manages POs
  async sendPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () =>
      this.service.updatePurchaseOrderStatus(id, PurchaseOrderStatus.SENT_TO_SUPPLIER, userId),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{id}/cancel:
   *   patch:
   *     summary: Cancel a purchase order
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     responses:
   *       200:
   *         description: Purchase order cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/purchase-orders/:id/cancel')
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or Admin, or user if draft
  async cancelPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () =>
      this.service.updatePurchaseOrderStatus(id, PurchaseOrderStatus.CANCELLED, userId),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{id}:
   *   delete:
   *     summary: Delete a purchase order (soft delete)
   *     description: Only possible for orders in draft or cancelled status, and not linked to receptions/invoices.
   *     tags: [Purchase Orders]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase order ID
   *     responses:
   *       204:
   *         description: Purchase order deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/purchase-orders/:id')
  @authorize({ level: SecurityLevel.USER })
  async deletePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deletePurchaseOrder(id, userId);
      },
      204,
    );
  }
}
