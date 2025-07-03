import {
  Get,
  Post,
  Put,
  Delete,
  authorize,
  paginate,
  sortable,
  filterable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { BadRequestError } from '../../common/errors/httpErrors';
import { ProductCategoryService } from './services/product-category.service';
import {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from './models/product-category.entity';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { BaseRouter } from '@/common/routing/BaseRouter';

export default class ProductCategoryRouter extends BaseRouter {
  categoryService = ProductCategoryService.getInstance();

  /**
   * @openapi
   * /product-categories:
   *   get:
   *     summary: Get all product categories
   *     description: Retrieve a list of product categories. Can be a flat list, a tree, or children of a specific parent.
   *     tags:
   *       - Product Categories
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam' # e.g., name, createdAt
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: name
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by category name (exact or partial match depending on service implementation)
   *       - name: parentId
   *         in: query
   *         schema:
   *           type: integer
   *           nullable: true
   *         description: Filter by parent category ID. Send 'null' or omit for root categories if not using tree=true.
   *       - name: tree
   *         in: query
   *         schema:
   *           type: boolean
   *           default: false
   *         description: If true, returns categories as a nested tree structure. Pagination might be ignored or apply to root nodes.
   *     responses:
   *       200:
   *         description: List of product categories or a tree structure.
   *         content:
   *           application/json:
   *             schema:
   *               oneOf: # Indicates response can be one of the following
   *                 - type: object # For paginated flat list
   *                   properties:
   *                     categories:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/ProductCategoryApiResponse'
   *                     total:
   *                       type: integer
   *                 - type: array # For tree view
   *                   items:
   *                     $ref: '#/components/schemas/ProductCategoryTreeApiResponse' # Define this if different (includes children)
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/product-categories')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable(['id', 'name', 'createdAt'])
  @filterable(['name', 'parentCategoryId'])
  async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parentIdQuery = req.query.parentId;
    let parentId: number | null | undefined = undefined;

    if (parentIdQuery !== undefined) {
      parentId = parentIdQuery === 'null' ? null : parseInt(parentIdQuery as string, 10);
      if (parentIdQuery !== 'null' && isNaN(parentId as number)) {
        return next(new BadRequestError('Invalid parentId format. Must be an integer or "null".'));
      }
    }

    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.categoryService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
        parentId: parentId,
      }),
    );
  }

  /**
   * @openapi
   * /product-categories/{id}:
   *   get:
   *     summary: Get product category by ID
   *     tags:
   *       - Product Categories
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Product Category ID
   *       - name: includeChildren
   *         in: query
   *         schema:
   *           type: boolean
   *           default: false
   *         description: If true, includes direct children of the category.
   *     responses:
   *       200:
   *         description: Product category found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductCategoryApiResponse' # Schema should support optional children
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/product-categories/:id')
  @authorize({ level: SecurityLevel.READER })
  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return next(new BadRequestError('Invalid category ID format.'));
    }
    const includeChildren = req.query.includeChildren === 'true';
    await this.pipe(res, req, next, () =>
      this.categoryService.findById(categoryId, includeChildren),
    );
  }

  /**
   * @openapi
   * /product-categories:
   *   post:
   *     summary: Create a new product category
   *     tags:
   *       - Product Categories
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductCategoryInput'
   *     responses:
   *       201:
   *         description: Product category created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductCategoryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/product-categories')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const categoryInput: CreateProductCategoryInput = req.body;
    await this.pipe(res, req, next, () => this.categoryService.create(categoryInput), 201);
  }

  /**
   * @openapi
   * /product-categories/{id}:
   *   put:
   *     summary: Update a product category
   *     tags:
   *       - Product Categories
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Product Category ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductCategoryInput'
   *     responses:
   *       200:
   *         description: Product category updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductCategoryApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/product-categories/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return next(new BadRequestError('Invalid category ID format.'));
    }
    const updateData: UpdateProductCategoryInput = req.body;
    await this.pipe(res, req, next, () => this.categoryService.update(categoryId, updateData));
  }

  /**
   * @openapi
   * /product-categories/{id}:
   *   delete:
   *     summary: Delete a product category (soft delete)
   *     description: Deletion might be restricted if the category is used by products or has sub-categories (unless sub-categories' parentId is set to null).
   *     tags:
   *       - Product Categories
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Product Category ID
   *     responses:
   *       204:
   *         description: Product category deleted successfully (No Content)
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/product-categories/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return next(new BadRequestError('Invalid category ID format.'));
    }
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.categoryService.delete(categoryId);
      },
      204,
    );
  }
}
