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
} from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '../../config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { DeliveryService } from './services/delivery.service';
import { CreateDeliveryInput, UpdateDeliveryInput } from './models/delivery.entity';
import { BadRequestError, UnauthorizedError } from '../../common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class DeliveryRouter extends BaseRouter {
  deliveryService = DeliveryService.getInstance();

  /**
   * @openapi
   * /deliveries:
   *   get:
   *     summary: Get all deliveries
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam' # e.g., deliveryDate, deliveryNumber, salesOrder.orderNumber
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: salesOrderId
   *         in: query
   *         schema: { type: integer }
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [pending, in_preparation, ready_to_ship, shipped, delivered, cancelled] }
   *       - name: deliveryDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: deliveryDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for deliveryNumber, trackingNumber, salesOrder.orderNumber
   *     responses:
   *       200:
   *         description: List of deliveries
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deliveries:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/DeliveryApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/deliveries')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'deliveryNumber', 'deliveryDate', 'status', 'salesOrderId', 'createdAt'])
  @filterable([
    'salesOrderId',
    'status',
    'dispatchWarehouseId',
    'dispatchShopId',
    'shippedByUserId',
  ])
  @searchable(['deliveryNumber', 'trackingNumber', 'notes'])
  async listDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.deliveryService.findAllDeliveries({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /deliveries/{id}:
   *   get:
   *     summary: Get delivery by ID
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       200:
   *         description: Delivery found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/deliveries/:id')
  @authorize({ level: SecurityLevel.USER })
  async getDeliveryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.deliveryService.findDeliveryById(id));
  }

  /**
   * @openapi
   * /deliveries:
   *   post:
   *     summary: Create a new delivery
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateDeliveryInput'
   *     responses:
   *       201:
   *         description: Delivery created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/deliveries')
  @authorize({ level: SecurityLevel.USER })
  async createDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateDeliveryInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.deliveryService.createDelivery(input, userId), 201);
  }

  /**
   * @openapi
   * /deliveries/{id}:
   *   put:
   *     summary: Update a delivery header information
   *     description: Allows updating details like carrier, tracking number, notes, if status permits. Items are managed via sub-routes.
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateDeliveryInput'
   *     responses:
   *       200:
   *         description: Delivery updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/deliveries/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateDeliveryInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.deliveryService.updateDelivery(id, input, userId));
  }

  /**
   * @openapi
   * /deliveries/{id}/ship:
   *   patch:
   *     summary: Mark a delivery as shipped
   *     description: This action will update stock levels and related sales order status. Delivery date can be provided.
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: false # Ou true si actualShipDate est obligatoire
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               actualShipDate:
   *                 type: string
   *                 format: date
   *                 description: Optional. Actual date of shipment. Defaults to now if not provided.
   *               carrierName: { type: string, nullable: true }
   *               trackingNumber: { type: string, nullable: true }
   *     responses:
   *       200:
   *         description: Delivery marked as shipped
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/deliveries/:id/ship')
  @authorize({ level: SecurityLevel.USER })
  async shipDeliveryAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    const { actualShipDate } = req.body;
    // Service gèrera la date si non fournie.
    await this.pipe(res, req, next, () =>
      this.deliveryService.shipDelivery(id, userId, actualShipDate),
    );
  }

  /**
   * @openapi
   * /deliveries/{id}/deliver:
   *   patch:
   *     summary: Mark a delivery as delivered
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     # requestBody: (Peut-être une date de livraison effective si différente de la date d'expédition)
   *     responses:
   *       200:
   *         description: Delivery marked as delivered
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/deliveries/:id/deliver')
  @authorize({ level: SecurityLevel.USER })
  async markDeliveryAsDelivered(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.deliveryService.markAsDelivered(id, userId));
    await this.pipe(res, req, next, () => this.deliveryService.markAsDelivered(id, userId));
  }

  /**
   * @openapi
   * /deliveries/{id}:
   *   delete:
   *     summary: Delete a delivery (soft delete)
   *     description: Only possible for deliveries in certain statuses (e.g., pending, not yet shipped).
   *     tags: [Deliveries]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       204:
   *         description: Delivery deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/deliveries/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.deliveryService.deleteDelivery(id, userId);
      },
      204,
    );
  }
}
