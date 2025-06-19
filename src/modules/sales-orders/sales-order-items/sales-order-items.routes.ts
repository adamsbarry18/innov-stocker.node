import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { SalesOrderItemService } from './services/sales-order-item.service';
import {
  CreateSalesOrderItemInput,
  UpdateSalesOrderItemInput,
} from './models/sales-order-item.entity';

export default class SalesOrderItemRouter extends BaseRouter {
  private itemService = SalesOrderItemService.getInstance();

  constructor() {
    super();
  }

  /**
   * @openapi
   * /sales-orders/{orderId}/items:
   *   post:
   *     summary: Add an item to a specific sales order
   *     tags: [Sales Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSalesOrderItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/sales-orders/:orderId/items')
  @authorize({ level: SecurityLevel.USER })
  async addSalesOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) return next(new BadRequestError('Invalid Sales Order ID in path.'));

    const input: CreateSalesOrderItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToSalesOrder(orderId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /sales-orders/{orderId}/items:
   *   get:
   *     summary: Get all items for a specific sales order
   *     tags: [Sales Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order
   *     responses:
   *       200:
   *         description: List of items for the sales order
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/SalesOrderItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/sales-orders/:orderId/items')
  @authorize({ level: SecurityLevel.USER })
  async listSalesOrderItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) return next(new BadRequestError('Invalid Sales Order ID in path.'));
    await this.pipe(res, req, next, async () => {
      const items = await this.itemService.getSalesOrderItems(orderId);
      return { items }; // Wrap the array in an object with an 'items' key
    });
  }

  /**
   * @openapi
   * /sales-orders/{orderId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a sales order
   *     tags: [Sales Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order item
   *     responses:
   *       200:
   *         description: Sales order item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/sales-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getSalesOrderItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Sales Order or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getSalesOrderItemById(orderId, itemId));
  }

  /**
   * @openapi
   * /sales-orders/{orderId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a sales order
   *     tags: [Sales Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order item
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSalesOrderItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SalesOrderItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/sales-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateSalesOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Sales Order or Item ID in path.'));

    const input: UpdateSalesOrderItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateSalesOrderItem(orderId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /sales-orders/{orderId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a sales order
   *     tags: [Sales Order Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the sales order item
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
  @Delete('/sales-orders/:orderId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeSalesOrderItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const orderId = parseInt(req.params.orderId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(orderId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Sales Order or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeSalesOrderItem(orderId, itemId, userId);
      },
      204,
    );
  }
}
