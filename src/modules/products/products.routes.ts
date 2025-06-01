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
} from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { ProductService } from './services/product.service';
import { CreateProductInput, UpdateProductInput } from './models/product.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import {
  CreateProductImageInput,
  UpdateProductImageInput,
} from '../product-images/models/product-image.entity';

export default class ProductRouter extends BaseRouter {
  service = ProductService.getInstance();

  /**
   * @openapi
   * /products:
   *   get:
   *     summary: Get all products
   *     tags: [Products]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: name
   *         in: query
   *         schema: { type: string }
   *         description: Filter by product name (partial match)
   *       - name: sku
   *         in: query
   *         schema: { type: string }
   *         description: Filter by product SKU
   *       - name: productCategoryId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter by product category ID
   *       - name: status
   *         in: query
   *         schema: { type: string, enum: [active, inactive, obsolete] }
   *         description: Filter by product status
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for name, SKU, description
   *     responses:
   *       200:
   *         description: List of products
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 products:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ProductApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/products')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'name', 'sku', 'productCategoryId', 'status', 'createdAt'])
  @filterable(['name', 'sku', 'productCategoryId', 'status'])
  @searchable(['name', 'sku', 'description'])
  async getAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);
    const searchTerm = req.searchQuery;
    await this.pipe(res, req, next, () =>
      this.service.findAllProducts({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
        searchTerm,
      }),
    );
  }

  /**
   * @openapi
   * /products/{id}:
   *   get:
   *     summary: Get product by ID
   *     tags: [Products]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Product ID
   *       - name: includeRelations
   *         in: query
   *         schema: { type: boolean, default: true }
   *         description: Whether to include full related data (images, variants, suppliers, etc.)
   *     responses:
   *       200:
   *         description: Product found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:id')
  @authorize({ level: SecurityLevel.USER })
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const includeRelations = req.query.includeRelations !== 'false';
    await this.pipe(res, req, next, () => this.service.findProductById(id, includeRelations));
  }

  /**
   * @openapi
   * /products:
   *   post:
   *     summary: Create a new product
   *     tags: [Products]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductInput'
   *     responses:
   *       201:
   *         description: Product created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/products')
  @authorize({ level: SecurityLevel.USER })
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateProductInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.service.createProduct(input, userId), 201);
  }

  /**
   * @openapi
   * /products/{id}:
   *   put:
   *     summary: Update a product
   *     tags: [Products]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Product ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductInput'
   *     responses:
   *       200:
   *         description: Product updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/products/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const input: UpdateProductInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.service.updateProduct(id, input, userId));
  }

  /**
   * @openapi
   * /products/{id}:
   *   delete:
   *     summary: Delete a product (soft delete)
   *     tags: [Products]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Product ID
   *     responses:
   *       204:
   *         description: Product deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/products/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteProduct(id, userId);
      },
      204,
    );
  }

  // --- Product Image Sub-Routes ---

  /**
   * @openapi
   * /products/{productId}/images:
   *   post:
   *     summary: Add an image to a product
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductImageInput'
   *     responses:
   *       201:
   *         description: Image added
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/products/:productId/images')
  @authorize({ level: SecurityLevel.USER })
  async addProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    const input: CreateProductImageInput = req.body;
    const userId = req.user!.id;
    await this.pipe(
      res,
      req,
      next,
      () => this.service.addProductImage(productId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/images:
   *   get:
   *     summary: Get all images for a product
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: List of product images
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductImageApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:productId/images')
  @authorize({ level: SecurityLevel.USER })
  async getProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    await this.pipe(res, req, next, () => this.service.getProductImages(productId));
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}:
   *   put:
   *     summary: Update product image details (e.g., alt text, primary status)
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductImageInput'
   *     responses:
   *       200:
   *         description: Image updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/products/:productId/images/:imageId')
  @authorize({ level: SecurityLevel.USER })
  async updateProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));
    const input: UpdateProductImageInput = req.body;
    const userId = Number(req.user?.id);
    await this.pipe(res, req, next, () =>
      this.service.updateProductImage(productId, imageId, input, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}/set-primary:
   *   patch:
   *     summary: Set an image as the primary image for the product
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Primary image set
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/products/:productId/images/:imageId/set-primary')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async setPrimaryProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));
    const userId = Number(req.user?.id);
    await this.pipe(res, req, next, () =>
      this.service.setPrimaryProductImage(productId, imageId, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}:
   *   delete:
   *     summary: Delete a product image
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       204:
   *         description: Image deleted
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/products/:productId/images/:imageId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));
    const userId = Number(req.user?.id);
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteProductImage(productId, imageId, userId);
      },
      204,
    );
  }

  // --- Product Specific Info Routes ---

  /**
   * @openapi
   * /products/{productId}/stock-movements:
   *   get:
   *     summary: Get stock movements for a specific product
   *     tags: [Products, Stock Movements]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *     responses:
   *       200:
   *         description: List of stock movements
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       501:
   *         description: Not Implemented
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:productId/stock-movements')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['movementDate', 'quantity'])
  async getProductStockMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    await this.pipe(res, req, next, () =>
      this.service.getProductStockMovements(productId, {
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
      }),
    );
  }

  /**
   * @openapi
   * /products/{productId}/current-stock:
   *   get:
   *     summary: Get current stock level for a product
   *     tags: [Products, Stock]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: warehouseId
   *         in: query
   *         schema: { type: integer }
   *         description: Optional Warehouse ID to get stock for a specific warehouse
   *       - name: shopId
   *         in: query
   *         schema: { type: integer }
   *         description: Optional Shop ID to get stock for a specific shop
   *     responses:
   *       200:
   *         description: Current stock information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       501:
   *         description: Not Implemented
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:productId/current-stock')
  @authorize({ level: SecurityLevel.USER })
  async getProductCurrentStock(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    const warehouseId = req.query.warehouseId
      ? parseInt(req.query.warehouseId as string, 10)
      : undefined;
    const shopId = req.query.shopId ? parseInt(req.query.shopId as string, 10) : undefined;
    if (req.query.warehouseId && warehouseId && isNaN(warehouseId))
      return next(new BadRequestError('Invalid Warehouse ID.'));
    if (req.query.shopId && (shopId === undefined || isNaN(shopId)))
      return next(new BadRequestError('Invalid Shop ID.'));
    await this.pipe(res, req, next, () =>
      this.service.getProductCurrentStock(productId, warehouseId, shopId),
    );
  }
}
