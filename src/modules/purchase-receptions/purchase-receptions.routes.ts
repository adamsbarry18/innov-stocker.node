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
import { PurchaseReceptionService } from './services/purchase-reception.service';
import {
  CreatePurchaseReceptionInput,
  UpdatePurchaseReceptionInput,
} from './models/purchase-reception.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class PurchaseReceptionRouter extends BaseRouter {
  service = PurchaseReceptionService.getInstance();

  /**
   * @openapi
   * /purchase-receptions:
   *   get:
   *     summary: Get all purchase receptions
   *     tags: [Purchase Receptions]
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
   *       - name: purchaseOrderId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Purchase Order ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [pending_quality_check, partial, complete] }
   *         description: Filter by reception status
   *       - name: receptionDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter receptions on or after this date (YYYY-MM-DD)
   *       - name: receptionDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter receptions on or before this date (YYYY-MM-DD)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for receptionNumber, supplier name, PO number
   *     responses:
   *       200:
   *         description: List of purchase receptions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 receptions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PurchaseReceptionApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/purchase-receptions')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable([
    'id',
    'receptionNumber',
    'receptionDate',
    'status',
    'supplierId',
    'purchaseOrderId',
    'createdAt',
  ])
  @filterable([
    'supplierId',
    'purchaseOrderId',
    'status',
    'receivedByUserId',
    'warehouseId',
    'shopId',
  ])
  @searchable(['receptionNumber'])
  async getAllReceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllReceptions({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /purchase-receptions/{id}:
   *   get:
   *     summary: Get purchase reception by ID
   *     tags: [Purchase Receptions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase reception ID
   *     responses:
   *       200:
   *         description: Purchase reception found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/purchase-receptions/:id')
  @authorize({ level: SecurityLevel.READER })
  async getReceptionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    // const userId = req.user!.id; // For authorization if needed
    await this.pipe(res, req, next, () => this.service.findReceptionById(id));
  }

  /**
   * @openapi
   * /purchase-receptions:
   *   post:
   *     summary: Create a new purchase reception
   *     tags: [Purchase Receptions]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePurchaseReceptionInput'
   *     responses:
   *       201:
   *         description: Reception created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/purchase-receptions')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async createReception(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreatePurchaseReceptionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () => this.service.createReception(input, userId), 201);
  }

  /**
   * @openapi
   * /purchase-receptions/{id}:
   *   put:
   *     summary: Update a purchase reception
   *     description: Limited updates allowed, especially if reception is already processed. Items are typically managed via dedicated item endpoints if reception is editable.
   *     tags: [Purchase Receptions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase reception ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePurchaseReceptionInput'
   *     responses:
   *       200:
   *         description: Reception updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/purchase-receptions/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateReception(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdatePurchaseReceptionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateReception(id, input, userId));
  }

  /**
   * @openapi
   * /purchase-receptions/{id}/validate:
   *   patch:
   *     summary: Validate a purchase reception
   *     description: Moves a PENDING_QUALITY_CHECK reception to PARTIAL or COMPLETE, updates stock levels, and related PO status.
   *     tags: [Purchase Receptions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase reception ID
   *     responses:
   *       200:
   *         description: Reception validated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/purchase-receptions/:id/validate')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async validateReception(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.validateReception(id, userId));
  }

  /**
   * @openapi
   * /purchase-receptions/{id}:
   *   delete:
   *     summary: Delete a purchase reception (soft delete)
   *     description: Only possible for receptions in certain statuses (e.g., pending_quality_check). Processed receptions should usually not be deleted directly.
   *     tags: [Purchase Receptions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Purchase reception ID
   *     responses:
   *       204:
   *         description: Reception deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/purchase-receptions/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteReception(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteReception(id);
      },
      204,
    );
  }
}
