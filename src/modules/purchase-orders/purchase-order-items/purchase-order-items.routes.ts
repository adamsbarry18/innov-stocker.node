import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import {
  CreatePurchaseOrderItemInput,
  UpdatePurchaseOrderItemInput,
} from './models/purchase-order-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { PurchaseOrderItemService } from './services/purchase-order-item.service';

export default class PurchaseOrderItemRouter extends BaseRouter {
  private itemService = PurchaseOrderItemService.getInstance();

  /**
   * @openapi
   * /purchase-orders/{orderId}/items:
   *   post:
   *     summary: Add an item to a specific purchase order
   *     tags: [Purchase Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePurchaseOrderItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/purchase-orders/:orderId/items')
  @authorize({ level: SecurityLevel.USER })
  async addPurchaseOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10); // orderId vient du routeur parent
    if (isNaN(orderId)) return next(new BadRequestError('Invalid Purchase Order ID in path.'));

    const input: CreatePurchaseOrderItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToOrder(orderId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /purchase-orders/{orderId}/items:
   *   get:
   *     summary: Get all items for a specific purchase order
   *     tags: [Purchase Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order
   *     responses:
   *       200:
   *         description: List of items for the purchase order
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PurchaseOrderItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/purchase-orders/:orderId/items')
  @authorize({ level: SecurityLevel.USER })
  async listPurchaseOrderItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) return next(new BadRequestError('Invalid Purchase Order ID in path.'));
    // TODO: Authorization - Check if user can view items of this PO
    await this.pipe(res, req, next, () => this.itemService.getOrderItems(orderId));
  }

  /**
   * @openapi
   * /purchase-orders/{orderId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a purchase order
   *     tags: [Purchase Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order item
   *     responses:
   *       200:
   *         description: Purchase order item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/purchase-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getPurchaseOrderItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Order or Item ID in path.'));
    // TODO: Authorization
    await this.pipe(res, req, next, () => this.itemService.getOrderItemById(orderId, itemId));
  }

  /**
   * @openapi
   * /purchase-orders/{orderId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a purchase order
   *     tags: [Purchase Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order item
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePurchaseOrderItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseOrderItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/purchase-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updatePurchaseOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Order or Item ID in path.'));

    const input: UpdatePurchaseOrderItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    // TODO: Authorization

    await this.pipe(res, req, next, () =>
      this.itemService.updateOrderItem(orderId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /purchase-orders/{orderId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a purchase order
   *     tags: [Purchase Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase order item
   *     responses:
   *       204:
   *         description: Item removed successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/purchase-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removePurchaseOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Order or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeOrderItem(orderId, itemId, userId);
      },
      204,
    );
  }
}
