import { BaseRouter } from '../../common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '../../config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { CreateDeliveryItemInput, UpdateDeliveryItemInput } from './models/delivery-item.entity';
import { BadRequestError, UnauthorizedError } from '../../common/errors/httpErrors';
import { DeliveryItemService } from './services/delivery-item.service';

export default class DeliveryItemRouter extends BaseRouter {
  private itemService = DeliveryItemService.getInstance();

  constructor() {
    super();
  }

  /**
   * @openapi
   * /deliveries/{deliveryId}/items:
   *   post:
   *     summary: Add an item to a specific delivery
   *     description: Only allowed if the delivery is in an editable status (e.g., PENDING, IN_PREPARATION).
   *     tags: [Delivery Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: deliveryId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the delivery
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateDeliveryItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/deliveries/:deliveryId/items')
  @authorize({ level: SecurityLevel.USER })
  async addDeliveryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deliveryId = parseInt(req.params.deliveryId, 10);
    if (isNaN(deliveryId)) return next(new BadRequestError('Invalid Delivery ID in path.'));

    const input: CreateDeliveryItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToDelivery(deliveryId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /deliveries/{deliveryId}/items:
   *   get:
   *     summary: Get all items for a specific delivery
   *     tags: [Delivery Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: deliveryId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the delivery
   *     responses:
   *       200:
   *         description: List of items for the delivery
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DeliveryItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/deliveries/:deliveryId/items')
  @authorize({ level: SecurityLevel.USER })
  async listDeliveryItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deliveryId = parseInt(req.params.deliveryId, 10);
    if (isNaN(deliveryId)) return next(new BadRequestError('Invalid Delivery ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getDeliveryItems(deliveryId));
  }

  /**
   * @openapi
   * /deliveries/{deliveryId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a delivery
   *     tags: [Delivery Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: deliveryId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Delivery item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/deliveries/:deliveryId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getDeliveryItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deliveryId = parseInt(req.params.deliveryId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(deliveryId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Delivery or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getDeliveryItemById(deliveryId, itemId));
  }

  /**
   * @openapi
   * /deliveries/{deliveryId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a delivery
   *     description: Typically only quantityShipped can be updated, and only if the delivery is in an editable status.
   *     tags: [Delivery Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: deliveryId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateDeliveryItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/DeliveryItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/deliveries/:deliveryId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateDeliveryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deliveryId = parseInt(req.params.deliveryId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(deliveryId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Delivery or Item ID in path.'));

    const input: UpdateDeliveryItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateDeliveryItem(deliveryId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /deliveries/{deliveryId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a delivery
   *     description: Only allowed if the delivery is in an editable status.
   *     tags: [Delivery Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: deliveryId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       204:
   *         description: Item removed successfully (No Content)
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/deliveries/:deliveryId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeDeliveryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deliveryId = parseInt(req.params.deliveryId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(deliveryId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Delivery or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeDeliveryItem(deliveryId, itemId, userId);
      },
      204,
    );
  }
}
