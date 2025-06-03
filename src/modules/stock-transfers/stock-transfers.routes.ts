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
import { SecurityLevel } from '../users/models/users.entity';
import { StockTransferService } from './services/stock-transfer.service';
import {
  CreateStockTransferInput,
  UpdateStockTransferInput,
  ShipStockTransferInput,
  ReceiveStockTransferInput,
} from './models/stock-transfer.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class StockTransferRouter extends BaseRouter {
  private service = StockTransferService.getInstance();

  /**
   * @openapi
   * /stock-transfers:
   *   get:
   *     summary: Get all stock transfers
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [pending, in_transit, partially_received, received, cancelled] }
   *       - name: sourceWarehouseId
   *         in: query
   *         schema: { type: integer }
   *       - name: sourceShopId
   *         in: query
   *         schema: { type: integer }
   *       - name: destinationWarehouseId
   *         in: query
   *         schema: { type: integer }
   *       - name: destinationShopId
   *         in: query
   *         schema: { type: integer }
   *       - name: requestDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: requestDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for transferNumber or notes
   *     responses:
   *       200:
   *         description: List of stock transfers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 transfers:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/StockTransferApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/stock-transfers')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable([
    'id',
    'transferNumber',
    'requestDate',
    'shipDate',
    'receiveDate',
    'status',
    'createdAt',
  ])
  @filterable([
    'status',
    'sourceWarehouseId',
    'sourceShopId',
    'destinationWarehouseId',
    'destinationShopId',
    'requestedByUserId',
    'shippedByUserId',
    'receivedByUserId',
  ])
  @searchable(['transferNumber', 'notes'])
  async listStockTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);
    const searchTerm = req.searchQuery;
    await this.pipe(res, req, next, () =>
      this.service.findAllStockTransfers({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
        searchTerm: searchTerm,
      }),
    );
  }

  /**
   * @openapi
   * /stock-transfers/{id}:
   *   get:
   *     summary: Get stock transfer by ID
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *       - name: includeItems
   *         in: query
   *         schema: { type: boolean, default: true }
   *         description: Include transfer items
   *     responses:
   *       200:
   *         description: Stock transfer found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/stock-transfers/:id')
  @authorize({ level: SecurityLevel.USER })
  async getStockTransferById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const includeItems = req.query.includeItems !== 'false'; // Default to true
    await this.pipe(res, req, next, () => this.service.findStockTransferById(id, includeItems));
  }

  /**
   * @openapi
   * /stock-transfers:
   *   post:
   *     summary: Create a new stock transfer request
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateStockTransferInput'
   *     responses:
   *       201:
   *         description: Stock transfer created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/stock-transfers')
  @authorize({ level: SecurityLevel.USER })
  async createStockTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateStockTransferInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.createStockTransfer(input, userId), 201);
  }

  /**
   * @openapi
   * /stock-transfers/{id}:
   *   put:
   *     summary: Update a stock transfer (header and items if PENDING)
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateStockTransferInput'
   *     responses:
   *       200:
   *         description: Stock transfer updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/stock-transfers/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateStockTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateStockTransferInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(res, req, next, () => this.service.updateStockTransfer(id, input, userId));
  }

  /**
   * @openapi
   * /stock-transfers/{id}/ship:
   *   patch:
   *     summary: Mark a stock transfer as shipped
   *     description: Updates item quantities shipped and creates stock_transfer_out movements.
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ShipStockTransferInput'
   *     responses:
   *       200:
   *         description: Stock transfer marked as shipped
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/stock-transfers/:id/ship')
  @authorize({ level: SecurityLevel.USER }) // User at source location
  async shipStockTransferAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    const input: ShipStockTransferInput = req.body;
    await this.pipe(res, req, next, () => this.service.shipStockTransfer(id, input, userId));
  }

  /**
   * @openapi
   * /stock-transfers/{id}/receive:
   *   patch:
   *     summary: Mark a stock transfer as received (partially or fully)
   *     description: Updates item quantities received and creates stock_transfer_in movements.
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ReceiveStockTransferInput'
   *     responses:
   *       200:
   *         description: Stock transfer reception processed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/stock-transfers/:id/receive')
  @authorize({ level: SecurityLevel.USER }) // User at destination location
  async receiveStockTransferAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    const input: ReceiveStockTransferInput = req.body;
    await this.pipe(res, req, next, () => this.service.receiveStockTransfer(id, input, userId));
  }

  /**
   * @openapi
   * /stock-transfers/{id}/cancel:
   *   patch:
   *     summary: Cancel a PENDING stock transfer
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       200:
   *         description: Stock transfer cancelled
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockTransferApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/stock-transfers/:id/cancel')
  @authorize({ level: SecurityLevel.USER })
  async cancelStockTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.cancelStockTransfer(id, userId));
  }

  /**
   * @openapi
   * /stock-transfers/{id}:
   *   delete:
   *     summary: Delete a stock transfer (soft delete)
   *     description: Only possible for transfers in certain statuses (e.g., PENDING, CANCELLED).
   *     tags: [Stock Transfers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/idPathParam'
   *     responses:
   *       204:
   *         description: Stock transfer deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/stock-transfers/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteStockTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteStockTransfer(id, userId);
      },
      204,
    );
  }
}
