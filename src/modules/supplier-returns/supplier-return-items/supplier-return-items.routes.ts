import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { SupplierReturnItemService } from './services/supplier-return-item.service';
import {
  CreateSupplierReturnItemInput,
  UpdateSupplierReturnItemInput,
} from './models/supplier-return-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class SupplierReturnItemRouter extends BaseRouter {
  private itemService = SupplierReturnItemService.getInstance();

  /**
   * @openapi
   * /supplier-returns/{returnId}/items:
   *   post:
   *     summary: Add an item to a specific supplier return
   *     description: Only allowed if the return is in an editable status (e.g., REQUESTED, APPROVED_BY_SUPPLIER).
   *     tags: [Supplier Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the supplier return
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSupplierReturnItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/supplier-returns/:returnId/items')
  @authorize({ level: SecurityLevel.USER })
  async addSupplierReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    if (isNaN(returnId)) return next(new BadRequestError('Invalid Supplier Return ID in path.'));

    const input: CreateSupplierReturnItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToSupplierReturn(returnId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /supplier-returns/{returnId}/items:
   *   get:
   *     summary: Get all items for a specific supplier return
   *     tags: [Supplier Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the supplier return
   *     responses:
   *       200:
   *         description: List of items for the supplier return
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/SupplierReturnItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/supplier-returns/:returnId/items')
  @authorize({ level: SecurityLevel.USER })
  async listSupplierReturnItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    if (isNaN(returnId)) return next(new BadRequestError('Invalid Supplier Return ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getReturnItems(returnId));
  }

  /**
   * @openapi
   * /supplier-returns/{returnId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a supplier return
   *     tags: [Supplier Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the supplier return item (BIGINT as string)
   *     responses:
   *       200:
   *         description: Supplier return item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/supplier-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getSupplierReturnItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Supplier Return or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(returnId, itemId));
  }

  /**
   * @openapi
   * /supplier-returns/{returnId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a supplier return
   *     description: Only allowed if the return is in an editable status.
   *     tags: [Supplier Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the supplier return item (BIGINT as string)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSupplierReturnItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierReturnItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/supplier-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateSupplierReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Supplier Return or Item ID in path.'));

    const input: UpdateSupplierReturnItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateItemInReturn(returnId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /supplier-returns/{returnId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a supplier return
   *     description: Only allowed if the return is in an editable status.
   *     tags: [Supplier Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the supplier return item (BIGINT as string)
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
  @Delete('/supplier-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeSupplierReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Supplier Return or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeItemFromReturn(returnId, itemId, userId);
      },
      204,
    );
  }
}
