import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  authorize,
  paginate,
  sortable,
  filterable,
  searchable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { StockMovementService } from './services/stock-movement.service';
import { CreateStockMovementInput, StockMovementType } from './models/stock-movement.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import logger from '@/lib/logger';

export default class StockMovementRouter extends BaseRouter {
  service = StockMovementService.getInstance();

  /**
   * @openapi
   * /stock-movements:
   *   get:
   *     summary: Get all stock movements
   *     description: Retrieve a list of stock movements, highly filterable.
   *     tags: [Stock Movements]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: productId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Product ID
   *       - name: productVariantId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Product Variant ID
   *       - name: warehouseId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Warehouse ID
   *       - name: shopId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by Shop ID
   *       - name: movementType
   *         in: query
   *         schema: { type: string, enum: [purchase_reception, sale_delivery, customer_return, supplier_return, inventory_adjustment_in, inventory_adjustment_out, stock_transfer_out, stock_transfer_in, manual_entry_in, manual_entry_out, production_in, production_out] }
   *         description: Filter by movement type
   *       - name: userId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by User ID who initiated the movement
   *       - name: referenceDocumentType
   *         in: query
   *         schema: { type: string }
   *         description: Filter by reference document type
   *       - name: referenceDocumentId
   *         in: query
   *         schema: { type: string }
   *         description: Filter by reference document ID
   *       - name: movementDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter movements on or after this date (YYYY-MM-DD)
   *       - name: movementDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter movements on or before this date (YYYY-MM-DD)
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for notes or reference document ID
   *     responses:
   *       200:
   *         description: List of stock movements
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 movements:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/StockMovementApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/stock-movements')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'movementDate', 'productId', 'movementType', 'quantity', 'createdAt'])
  @filterable([
    'productId',
    'productVariantId',
    'warehouseId',
    'shopId',
    'movementType',
    'userId',
    'referenceDocumentType',
    'referenceDocumentId',
  ])
  @searchable(['notes', 'referenceDocumentId'])
  async listStockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllStockMovements({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /stock-movements/{id}:
   *   get:
   *     summary: Get a specific stock movement by its ID
   *     tags: [Stock Movements]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: Stock Movement ID (BIGINT as string)
   *     responses:
   *       200:
   *         description: Stock movement found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockMovementApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/stock-movements/:id')
  @authorize({ level: SecurityLevel.USER })
  async getStockMovementById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(new BadRequestError('Invalid ID format. ID must be a number.'));
    }
    const userId = req.user!.id;
    await this.pipe(res, req, next, () => this.service.findStockMovementById(id, userId));
  }

  /**
   * @openapi
   * /stock-movements/adjustments:
   *   post:
   *     summary: Create a manual stock adjustment
   *     description: Used to manually correct stock levels (e.g., for discrepancies, damages not part of returns, or initial stock loading). `movementType` should be 'manual_entry_in' or 'manual_entry_out'. `quantity` is positive for IN, negative for OUT.
   *     tags: [Stock Movements]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateStockMovementInput'
   *     responses:
   *       201:
   *         description: Stock adjustment created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StockMovementApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/stock-movements/adjustments')
  @authorize({ level: SecurityLevel.USER })
  async createManualStockAdjustment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const input: CreateStockMovementInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    if (
      input.movementType !== StockMovementType.MANUAL_ENTRY_IN &&
      input.movementType !== StockMovementType.MANUAL_ENTRY_OUT
    ) {
      return next(
        new BadRequestError(
          "Invalid movementType for manual adjustment. Must be 'manual_entry_in' or 'manual_entry_out'.",
        ),
      );
    }
    // Assurer que la quantité a le bon signe ou le service s'en charge
    if (input.movementType === StockMovementType.MANUAL_ENTRY_IN && input.quantity < 0) {
      input.quantity = Math.abs(input.quantity);
    } else if (input.movementType === StockMovementType.MANUAL_ENTRY_OUT && input.quantity > 0) {
      input.quantity = -Math.abs(input.quantity);
    }

    await this.pipe(res, req, next, () => this.service.createManualAdjustment(input, userId), 201);
  }

  /**
   * @openapi
   * /stock-movements/current-stock:
   *   get:
   *     summary: Get current stock level for a product or product variant in a specific location
   *     description: Retrieve the aggregated current stock quantity for a given product or product variant in either a warehouse or a shop.
   *     tags: [Stock Movements]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: query
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: productVariantId
   *         in: query
   *         schema: { type: integer }
   *         description: ID of the product variant (optional)
   *       - name: warehouseId
   *         in: query
   *         schema: { type: integer }
   *         description: ID of the warehouse (either warehouseId or shopId must be provided)
   *       - name: shopId
   *         in: query
   *         schema: { type: integer }
   *         description: ID of the shop (either warehouseId or shopId must be provided)
   *     responses:
   *       200:
   *         description: Current stock level retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 productId: { type: integer }
   *                 productVariantId: { type: integer, nullable: true }
   *                 locationId: { type: integer }
   *                 locationType: { type: string, enum: [warehouse, shop] }
   *                 quantity: { type: number }
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/stock-movements/current-stock')
  @authorize({ level: SecurityLevel.USER })
  async getCurrentStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productIdNum = req.query.productId
      ? parseInt(req.query.productId as string, 10)
      : undefined;
    const productVariantIdNum = req.query.productVariantId
      ? parseInt(req.query.productVariantId as string, 10)
      : undefined;
    const warehouseIdNum = req.query.warehouseId
      ? parseInt(req.query.warehouseId as string, 10)
      : undefined;
    const shopIdNum = req.query.shopId ? parseInt(req.query.shopId as string, 10) : undefined;

    if (!productIdNum || isNaN(productIdNum)) {
      return next(new BadRequestError('Valid productId is required.'));
    }

    // Validation: soit warehouseId, soit shopId doit être fourni, mais pas les deux
    if ((!warehouseIdNum && !shopIdNum) || (warehouseIdNum && shopIdNum)) {
      return next(
        new BadRequestError('Either warehouseId or shopId must be provided, but not both.'),
      );
    }

    await this.pipe(res, req, next, () =>
      this.service.getCurrentStock(productIdNum, productVariantIdNum, warehouseIdNum, shopIdNum),
    );
  }
}
