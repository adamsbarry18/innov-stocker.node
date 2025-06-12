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
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { SupplierReturnService } from './services/supplier-return.service';
import {
  CreateSupplierReturnInput,
  UpdateSupplierReturnInput,
  ShipSupplierReturnInput,
  CompleteSupplierReturnInput,
} from './models/supplier-return.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class SupplierReturnRouter extends BaseRouter {
  private service = SupplierReturnService.getInstance();

  /**
   * @openapi
   * /supplier-returns:
   *   get:
   *     summary: Get all supplier returns
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: supplierId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by supplier ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [requested, approved_by_supplier, pending_shipment, shipped_to_supplier, received_by_supplier, credit_expected, refunded, credit_note_received, completed, cancelled] }
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
   *         description: Search term for returnNumber, supplierRmaNumber, notes
   *     responses:
   *       200:
   *         description: List of supplier returns
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 returns:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SupplierReturnApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/supplier-returns')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'returnNumber', 'returnDate', 'status', 'supplierId', 'createdAt'])
  @filterable(['supplierId', 'status', 'createdByUserId', 'sourceWarehouseId', 'sourceShopId'])
  @searchable(['returnNumber', 'supplierRmaNumber', 'notes'])
  async listSupplierReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllSupplierReturns({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /supplier-returns/{id}:
   *   get:
   *     summary: Get supplier return by ID
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *       - name: includeItems
   *         in: query
   *         schema: { type: boolean, default: true }
   *         description: Include return items in the response
   *     responses:
   *       200:
   *         description: Supplier return found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/supplier-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async getSupplierReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findSupplierReturnById(id));
  }

  /**
   * @openapi
   * /supplier-returns:
   *   post:
   *     summary: Create a new supplier return request
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSupplierReturnInput'
   *     responses:
   *       201:
   *         description: Supplier return created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/supplier-returns')
  @authorize({ level: SecurityLevel.USER })
  async createSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateSupplierReturnInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.createSupplierReturn(input, userId), 201);
  }

  /**
   * @openapi
   * /supplier-returns/{id}:
   *   put:
   *     summary: Update a supplier return (header info, and items if status allows)
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSupplierReturnInput'
   *     responses:
   *       200:
   *         description: Supplier return updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/supplier-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateSupplierReturnInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateSupplierReturn(id, input, userId));
  }

  /**
   * @openapi
   * /supplier-returns/{id}/approve:
   *   patch:
   *     summary: Approve a supplier return request (e.g., after supplier confirmation/RMA)
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               supplierRmaNumber: { type: string, nullable: true, description: "Supplier's RMA number, if provided." }
   *               notes: { type: string, nullable: true, description: "Notes for approval." }
   *     responses:
   *       200:
   *         description: Return approved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/supplier-returns/:id/approve')
  @authorize({ level: SecurityLevel.USER })
  async approveSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    const { supplierRmaNumber, notes } = req.body;
    await this.pipe(res, req, next, () =>
      this.service.approveSupplierReturn(id, userId, supplierRmaNumber, notes),
    );
  }

  /**
   * @openapi
   * /supplier-returns/{id}/ship:
   *   patch:
   *     summary: Mark a supplier return as shipped
   *     description: Updates item quantities shipped and creates stock_transfer_out movements from the source location.
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ShipSupplierReturnInput'
   *     responses:
   *       200:
   *         description: Supplier return marked as shipped
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/supplier-returns/:id/ship')
  @authorize({ level: SecurityLevel.USER })
  async shipSupplierReturnAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    const input: ShipSupplierReturnInput = req.body;
    await this.pipe(res, req, next, () => this.service.shipSupplierReturn(id, input, userId));
  }

  /**
   * @openapi
   * /supplier-returns/{id}/complete:
   *   patch:
   *     summary: Complete the supplier return process
   *     description: Finalizes the return, typically after supplier confirms reception and credit/refund is processed.
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompleteSupplierReturnInput'
   *     responses:
   *       200:
   *         description: Return process completed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/supplier-returns/:id/complete')
  @authorize({ level: SecurityLevel.USER })
  async completeSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    const input: CompleteSupplierReturnInput = req.body;
    await this.pipe(res, req, next, () =>
      this.service.completeSupplierReturnProcess(id, input, userId),
    );
  }

  /**
   * @openapi
   * /supplier-returns/{id}/cancel:
   *   patch:
   *     summary: Cancel a supplier return request
   *     description: Possible if the return has not been shipped.
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       200:
   *         description: Return cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/supplier-returns/:id/cancel')
  @authorize({ level: SecurityLevel.USER })
  async cancelSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.cancelSupplierReturn(id, userId));
  }

  /**
   * @openapi
   * /supplier-returns/{id}:
   *   delete:
   *     summary: Delete a supplier return (soft delete)
   *     description: Only possible for returns in certain statuses (e.g., REQUESTED, CANCELLED).
   *     tags: [Supplier Returns]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       204:
   *         description: Supplier return deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/supplier-returns/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteSupplierReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteSupplierReturn(id, userId);
      },
      204,
    );
  }
}
