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
import { InventorySessionService } from './services/inventory-session.service';
import {
  CreateInventorySessionInput,
  UpdateInventorySessionInput,
  CompleteInventorySessionInput,
} from './models/inventory-session.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class InventorySessionRouter extends BaseRouter {
  private service = InventorySessionService.getInstance();

  /**
   * @openapi
   * /inventory-sessions:
   *   get:
   *     summary: Get all inventory sessions
   *     tags: [Inventory Sessions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: warehouseId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by warehouse ID
   *       - name: shopId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by shop ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [pending, in_progress, completed, cancelled] }
   *         description: Filter by session status
   *       - name: startDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter sessions starting from this date
   *       - name: startDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter sessions starting up to this date
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for notes
   *     responses:
   *       200:
   *         description: List of inventory sessions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessions:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/InventorySessionApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/inventory-sessions')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'startDate', 'endDate', 'status', 'warehouseId', 'shopId', 'createdAt'])
  @filterable(['warehouseId', 'shopId', 'status', 'createdByUserId', 'validatedByUserId'])
  @searchable(['notes'])
  async listInventorySessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllInventorySessions({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /inventory-sessions/{id}:
   *   get:
   *     summary: Get inventory session by ID
   *     tags: [Inventory Sessions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - name: includeItems
   *         in: query
   *         schema: { type: boolean, default: false }
   *         description: Set to true to include all items of the session in the response.
   *     responses:
   *       200:
   *         description: Inventory session found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/inventory-sessions/:id')
  @authorize({ level: SecurityLevel.USER })
  async getInventorySessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const includeItems = req.query.includeItems === 'true';
    await this.pipe(res, req, next, () => this.service.findInventorySessionById(id, includeItems));
  }

  /**
   * @openapi
   * /inventory-sessions:
   *   post:
   *     summary: Start a new inventory session
   *     tags: [Inventory Sessions]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateInventorySessionInput'
   *     responses:
   *       201:
   *         description: Inventory session started successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/inventory-sessions')
  @authorize({ level: SecurityLevel.USER }) // User with rights to manage inventory
  async startInventorySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateInventorySessionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.startInventorySession(input, userId), 201);
  }

  /**
   * @openapi
   * /inventory-sessions/{id}:
   *   put:
   *     summary: Update an inventory session header (e.g., notes, dates if status allows)
   *     tags: [Inventory Sessions]
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
   *             $ref: '#/components/schemas/UpdateInventorySessionInput'
   *     responses:
   *       200:
   *         description: Inventory session updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/inventory-sessions/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateInventorySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateInventorySessionInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateInventorySession(id, input, userId));
  }

  /**
   * @openapi
   * /inventory-sessions/{id}/complete:
   *   post:
   *     summary: Complete and validate an inventory session
   *     description: This action finalizes the counts, calculates variances, and generates stock adjustment movements.
   *     tags: [Inventory Sessions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CompleteInventorySessionInput'
   *     responses:
   *       200:
   *         description: Inventory session completed and validated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/inventory-sessions/:id/complete') // Changed from PATCH to POST as per API list
  @authorize({ level: SecurityLevel.USER })
  async completeInventorySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: CompleteInventorySessionInput = req.body;
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.completeInventorySession(id, input, userId));
  }

  /**
   * @openapi
   * /inventory-sessions/{id}/cancel:
   *   patch:
   *     summary: Cancel an ongoing or pending inventory session
   *     tags: [Inventory Sessions]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Inventory session cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/inventory-sessions/:id/cancel')
  @authorize({ level: SecurityLevel.USER })
  async cancelInventorySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.cancelInventorySession(id, userId));
  }

  // DELETE /inventory-sessions/{id} is usually not provided for sessions.
  // They are either COMPLETED or CANCELLED. Soft delete might be possible if rules allow.
}
