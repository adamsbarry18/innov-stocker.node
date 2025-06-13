import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { CustomerReturnItemService } from './services/customer-return-item.service';
import {
  CreateCustomerReturnItemInput,
  UpdateCustomerReturnItemInput,
} from './models/customer-return-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class CustomerReturnItemRouter extends BaseRouter {
  private itemService = CustomerReturnItemService.getInstance();

  /**
   * @openapi
   * /customer-returns/{returnId}/items:
   *   post:
   *     summary: Add an item to a specific customer return
   *     description: Only allowed if the return is in an editable status (e.g., REQUESTED, APPROVED).
   *     tags: [Customer Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer return
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerReturnItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/customer-returns/:returnId/items')
  @authorize({ level: SecurityLevel.USER })
  async addCustomerReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    if (isNaN(returnId)) return next(new BadRequestError('Invalid Customer Return ID in path.'));

    const input: CreateCustomerReturnItemInput = req.body;

    await this.pipe(res, req, next, () => this.itemService.addItemToReturn(returnId, input), 201);
  }

  /**
   * @openapi
   * /customer-returns/{returnId}/items:
   *   get:
   *     summary: Get all items for a specific customer return
   *     tags: [Customer Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer return
   *     responses:
   *       200:
   *         description: List of items for the customer return
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CustomerReturnItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customer-returns/:returnId/items')
  @authorize({ level: SecurityLevel.USER })
  async listCustomerReturnItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    if (isNaN(returnId)) return next(new BadRequestError('Invalid Customer Return ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getReturnItems(returnId));
  }

  /**
   * @openapi
   * /customer-returns/{returnId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a customer return
   *     tags: [Customer Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer return
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the customer return item (BIGINT as string)
   *     responses:
   *       200:
   *         description: Customer return item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customer-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getCustomerReturnItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Customer Return or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(returnId, itemId));
  }

  /**
   * @openapi
   * /customer-returns/{returnId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a customer return
   *     description: Only allowed if the return is in an editable status.
   *     tags: [Customer Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer return
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the customer return item (BIGINT as string)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerReturnItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerReturnItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/customer-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateCustomerReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Customer Return or Item ID in path.'));

    const input: UpdateCustomerReturnItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateItemInReturn(returnId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /customer-returns/{returnId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a customer return
   *     description: Only allowed if the return is in an editable status.
   *     tags: [Customer Return Items]
   *     security: [{ "bearerAuth": [] }]
   *     parameters:
   *       - name: returnId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer return
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the customer return item (BIGINT as string)
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
  @Delete('/customer-returns/:returnId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeCustomerReturnItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const returnId = parseInt(req.params.returnId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(returnId) || !itemId)
      return next(new BadRequestError('Invalid Customer Return or Item ID in path.'));

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
