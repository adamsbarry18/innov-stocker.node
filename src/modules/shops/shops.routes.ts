// src/modules/shops/shops.routes.ts
import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  Put,
  Delete,
  authorize,
  paginate,
  sortable,
  filterable,
  searchable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { ShopService } from './services/shop.service';
import { CreateShopInput, UpdateShopInput } from './models/shop.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class ShopRouter extends BaseRouter {
  service = ShopService.getInstance();

  /**
   * @openapi
   * /shops:
   *   get:
   *     summary: Get all shops
   *     tags:
   *       - Shops
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: name
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by shop name
   *       - name: code
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by shop code
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name and code
   *     responses:
   *       200:
   *         description: List of shops
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 shops:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ShopApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  @Get('/shops')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'name', 'code', 'createdAt'])
  @filterable(['name', 'code'])
  @searchable(['name', 'code'])
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);
    const searchTerm = req.searchQuery;

    await this.pipe(res, req, next, () =>
      this.service.findAll({
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
   * /shops/{id}:
   *   get:
   *     summary: Get shop by ID
   *     tags:
   *       - Shops
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Shop ID
   *     responses:
   *       200:
   *         description: Shop found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ShopApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/shops/:id')
  @authorize({ level: SecurityLevel.USER })
  async getByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /shops:
   *   post:
   *     summary: Create a new shop
   *     tags:
   *       - Shops
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateShopInput'
   *     responses:
   *       201:
   *         description: Shop created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ShopApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/shops')
  @authorize({ level: SecurityLevel.ADMIN })
  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateShopInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.create(input, userId), 201);
  }

  /**
   * @openapi
   * /shops/{id}:
   *   put:
   *     summary: Update a shop
   *     tags:
   *       - Shops
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Shop ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateShopInput'
   *     responses:
   *       200:
   *         description: Shop updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ShopApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/shops/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdateShopInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.service.update(id, input, userId));
  }

  /**
   * @openapi
   * /shops/{id}:
   *   delete:
   *     summary: Delete a shop (soft delete)
   *     description: Deletion might be restricted if the shop is in use (e.g., has cash registers, stock).
   *     tags:
   *       - Shops
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Shop ID
   *     responses:
   *       204:
   *         description: Shop deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/shops/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.delete(id);
      },
      204,
    );
  }
}
