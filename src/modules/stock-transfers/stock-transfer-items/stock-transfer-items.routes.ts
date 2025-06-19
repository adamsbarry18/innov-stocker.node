import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { StockTransferItemService } from './services/stock-transfer-item.service';
import {
  CreateStockTransferItemInput,
  UpdateStockTransferItemInput,
} from './models/stock-transfer-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class StockTransferItemRouter extends BaseRouter {
  private itemService = StockTransferItemService.getInstance();

  /**
   * @openapi
   * /stock-transfers/{transferId}/items:
   *   post:
   *     summary: Add an item to a specific stock transfer
   *     description: Only allowed if the transfer is in an editable status (e.g., PENDING).
   *     tags: [Stock Transfer Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: transferId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the stock transfer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateStockTransferItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/stock-transfers/:transferId/items')
  @authorize({ level: SecurityLevel.USER })
  async addStockTransferItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const transferId = parseInt(req.params.transferId, 10);
    if (isNaN(transferId)) return next(new BadRequestError('Invalid Stock Transfer ID in path.'));

    const input: CreateStockTransferItemInput = req.body;

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToTransfer(transferId, input),
      201,
    );
  }

  /**
   * @openapi
   * /stock-transfers/{transferId}/items:
   *   get:
   *     summary: Get all items for a specific stock transfer
   *     tags: [Stock Transfer Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: transferId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the stock transfer
   *     responses:
   *       200:
   *         description: List of items for the stock transfer
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/StockTransferItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/stock-transfers/:transferId/items')
  @authorize({ level: SecurityLevel.USER })
  async listStockTransferItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const transferId = parseInt(req.params.transferId, 10);
    if (isNaN(transferId)) return next(new BadRequestError('Invalid Stock Transfer ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getTransferItems(transferId));
  }

  /**
   * @openapi
   * /stock-transfers/{transferId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a stock transfer
   *     tags: [Stock Transfer Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: transferId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the stock transfer item (BIGINT as string)
   *     responses:
   *       200:
   *         description: Stock transfer item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/stock-transfers/:transferId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getStockTransferItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const transferId = parseInt(req.params.transferId, 10);
    const itemId = parseInt(req.params.itemId, 10); // BIGINT is string
    if (isNaN(transferId) || !itemId)
      return next(new BadRequestError('Invalid Stock Transfer or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(transferId, itemId));
  }

  /**
   * @openapi
   * /stock-transfers/{transferId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a stock transfer
   *     description: Only allowed if the transfer is in an editable status (e.g., PENDING). Typically only quantityRequested is changed.
   *     tags: [Stock Transfer Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: transferId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the stock transfer item (BIGINT as string)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateStockTransferItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/stock-transfers/:transferId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateStockTransferItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const transferId = parseInt(req.params.transferId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(transferId) || !itemId)
      return next(new BadRequestError('Invalid Stock Transfer or Item ID in path.'));

    const input: UpdateStockTransferItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateItemInTransfer(transferId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /stock-transfers/{transferId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a stock transfer
   *     description: Only allowed if the transfer is in an editable status (e.g., PENDING).
   *     tags: [Stock Transfer Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: transferId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the stock transfer item (BIGINT as string)
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
  @Delete('/stock-transfers/:transferId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeStockTransferItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const transferId = parseInt(req.params.transferId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(transferId) || !itemId)
      return next(new BadRequestError('Invalid Stock Transfer or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeItemFromTransfer(transferId, itemId, userId);
      },
      204,
    );
  }
}
