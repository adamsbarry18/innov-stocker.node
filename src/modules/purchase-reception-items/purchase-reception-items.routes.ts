import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { PurchaseReceptionItemService } from './services/purchase-reception-item.service';
import {
  CreatePurchaseReceptionItemInput,
  UpdatePurchaseReceptionItemInput,
} from './models/purchase-reception-item.entity';

export default class PurchaseReceptionItemRouter extends BaseRouter {
  private itemService = PurchaseReceptionItemService.getInstance();

  constructor() {
    super();
  }

  /**
   * @openapi
   * /purchase-receptions/{receptionId}/items:
   *   post:
   *     summary: Add an item to a specific purchase reception
   *     description: This endpoint is typically used when a reception is in an editable state (e.g., PENDING_QUALITY_CHECK).
   *     tags: [Purchase Reception Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: receptionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePurchaseReceptionItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/purchase-receptions/:receptionId/items')
  @authorize({ level: SecurityLevel.USER })
  async addReceptionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const receptionId = parseInt(req.params.receptionId, 10);
    if (isNaN(receptionId))
      return next(new BadRequestError('Invalid Purchase Reception ID in path.'));

    const input: CreatePurchaseReceptionItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToReception(receptionId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /purchase-receptions/{receptionId}/items:
   *   get:
   *     summary: Get all items for a specific purchase reception
   *     tags: [Purchase Reception Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: receptionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception
   *     responses:
   *       200:
   *         description: List of items for the purchase reception
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PurchaseReceptionItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/purchase-receptions/:receptionId/items')
  @authorize({ level: SecurityLevel.USER })
  async listReceptionItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const receptionId = parseInt(req.params.receptionId, 10);
    if (isNaN(receptionId))
      return next(new BadRequestError('Invalid Purchase Reception ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemsByReceptionId(receptionId), 200);
  }

  /**
   * @openapi
   * /purchase-receptions/{receptionId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a purchase reception
   *     tags: [Purchase Reception Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: receptionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception item
   *     responses:
   *       200:
   *         description: Purchase reception item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/purchase-receptions/:receptionId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getReceptionItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const receptionId = parseInt(req.params.receptionId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(receptionId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Reception or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(receptionId, itemId), 200);
  }

  /**
   * @openapi
   * /purchase-receptions/{receptionId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a purchase reception
   *     description: Limited updates allowed, typically for receptions in PENDING_QUALITY_CHECK. Product/Variant of an item cannot be changed.
   *     tags: [Purchase Reception Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: receptionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception item
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePurchaseReceptionItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PurchaseReceptionItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/purchase-receptions/:receptionId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateReceptionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const receptionId = parseInt(req.params.receptionId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(receptionId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Reception or Item ID in path.'));

    const input: UpdatePurchaseReceptionItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.updateItemInReception(receptionId, itemId, input, userId),
      200,
    );
  }

  /**
   * @openapi
   * /purchase-receptions/{receptionId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a purchase reception
   *     description: Use with caution. Removing items from a processed reception can cause inconsistencies.
   *     tags: [Purchase Reception Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: receptionId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the purchase reception item
   *     responses:
   *       204:
   *         description: Item removed successfully (No Content)
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/purchase-receptions/:receptionId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeReceptionItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const receptionId = parseInt(req.params.receptionId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(receptionId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Purchase Reception or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeItemFromReception(receptionId, itemId, userId);
      },
      204,
    );
  }
}
