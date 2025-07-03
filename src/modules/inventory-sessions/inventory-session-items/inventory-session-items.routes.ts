import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { InventorySessionItemService } from './services/inventory-session-item.service';
import { CreateOrUpdateInventorySessionItemInput } from './models/inventory-session-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class InventorySessionItemRouter extends BaseRouter {
  private itemService = InventorySessionItemService.getInstance();

  /**
   * @openapi
   * /inventory-sessions/{sessionId}/items:
   *   post:
   *     summary: Add or update a counted item in an inventory session
   *     description: Creates a new item if it doesn't exist for the product/variant in this session, or updates the counted_quantity if it does. Only allowed if the session is IN_PROGRESS or PENDING.
   *     tags: [Inventory Session Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: sessionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the inventory session
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateOrUpdateInventorySessionItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionItemApiResponse'
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/inventory-sessions/:sessionId/items')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async addOrUpdateInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) return next(new BadRequestError('Invalid Inventory Session ID in path.'));

    const input: CreateOrUpdateInventorySessionItemInput = req.body;
    await this.pipe(res, req, next, () => this.itemService.addOrUpdateItem(sessionId, input));
  }

  /**
   * @openapi
   * /inventory-sessions/{sessionId}/items:
   *   get:
   *     summary: Get all items for a specific inventory session
   *     tags: [Inventory Session Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: sessionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the inventory session
   *     responses:
   *       200:
   *         description: List of items for the inventory session
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/InventorySessionItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/inventory-sessions/:sessionId/items')
  @authorize({ level: SecurityLevel.READER })
  async listInventorySessionItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) return next(new BadRequestError('Invalid Inventory Session ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getSessionItems(sessionId));
  }

  /**
   * @openapi
   * /inventory-sessions/{sessionId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from an inventory session
   *     tags: [Inventory Session Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: sessionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the inventory session
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the inventory session item (BIGINT as string)
   *     responses:
   *       200:
   *         description: Inventory session item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InventorySessionItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/inventory-sessions/:sessionId/items/:itemId')
  @authorize({ level: SecurityLevel.READER })
  async getInventorySessionItemById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const sessionId = parseInt(req.params.sessionId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(sessionId) || !itemId)
      return next(new BadRequestError('Invalid Inventory Session or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(sessionId, itemId));
  }

  /**
   * @openapi
   * /inventory-sessions/{sessionId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from an inventory session
   *     description: Only allowed if the session is in an editable status (e.g., PENDING, IN_PROGRESS).
   *     tags: [Inventory Session Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: sessionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the inventory session
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the inventory session item (BIGINT as string)
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
  @Delete('/inventory-sessions/:sessionId/items/:itemId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async removeInventorySessionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const sessionId = parseInt(req.params.sessionId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(sessionId) || !itemId)
      return next(new BadRequestError('Invalid Inventory Session or Item ID in path.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeItemFromSession(sessionId, itemId);
      },
      204,
    );
  }
}
