import { BaseRouter } from '@/common/routing/BaseRouter';
import { Post, Get, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { ImportService } from './services/import.service';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { ImportEntityType } from './models/import.entity';
import { SecurityLevel } from '../users';

export default class ImportRouter extends BaseRouter {
  private service = ImportService.getInstance();

  private async handleImportRequest(
    entityType: ImportEntityType,
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { data, originalFileName } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return next(new BadRequestError('Request body must contain a non-empty "data" array.'));
    }
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    await this.pipe(
      res,
      req,
      next,
      () => this.service.scheduleImport(entityType, data, { originalFileName }, userId),
      202,
    );
  }

  /**
   * @openapi
   * /import/products:
   *   post:
   *     summary: Schedule a product import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportProductsInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/products')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleProductImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleImportRequest(ImportEntityType.PRODUCT, req, res, next);
  }

  /**
   * @openapi
   * /import/customers:
   *   post:
   *     summary: Schedule a customer import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportCustomersInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/customers')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleCustomerImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleImportRequest(ImportEntityType.CUSTOMER, req, res, next);
  }

  /**
   * @openapi
   * /import/suppliers:
   *   post:
   *     summary: Schedule a supplier import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportSuppliersInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/suppliers')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleSupplierImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleImportRequest(ImportEntityType.SUPPLIER, req, res, next);
  }

  /**
   * @openapi
   * /import/product-categories:
   *   post:
   *     summary: Schedule a product category import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportProductCategoriesInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/product-categories')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleProductCategoryImport(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    await this.handleImportRequest(ImportEntityType.PRODUCT_CATEGORY, req, res, next);
  }

  /**
   * @openapi
   * /import/opening-stock:
   *   post:
   *     summary: Schedule an opening stock import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportOpeningStockInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/opening-stock')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleOpeningStockImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleImportRequest(ImportEntityType.OPENING_STOCK, req, res, next);
  }

  /**
   * @openapi
   * /import/sales-orders:
   *   post:
   *     summary: Schedule a sales order import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportSalesOrdersInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/sales-orders')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async scheduleSalesOrderImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleImportRequest(ImportEntityType.SALES_ORDER, req, res, next);
  }

  /**
   * @openapi
   * /import/purchase-orders:
   *   post:
   *     summary: Schedule a purchase order import from a JSON array
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ImportPurchaseOrdersInput'
   *     responses:
   *       202:
   *         description: Import task scheduled successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/import/purchase-orders')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async schedulePurchaseOrderImport(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    await this.handleImportRequest(ImportEntityType.PURCHASE_ORDER, req, res, next);
  }
  /**
   * @openapi
   * /import/batches/{id}:
   *   get:
   *     summary: Get the status and result of an import batch
   *     tags: [Import]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: The current status and summary of the import batch.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ImportBatchApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/import/batches/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async getImportBatchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const batchId = parseInt(req.params.id, 10);
    if (isNaN(batchId)) return next(new BadRequestError('Invalid batch ID format.'));
    await this.pipe(res, req, next, () => this.service.getImportStatus(batchId));
  }
}
