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
import { WarehouseService } from './services/warehouse.service';
import { CreateWarehouseInput, UpdateWarehouseInput } from './models/warehouse.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class WarehouseRouter extends BaseRouter {
  service = WarehouseService.getInstance();

  /**
   * @openapi
   * /warehouses:
   *   get:
   *     summary: Get all warehouses
   *     tags:
   *       - Warehouses
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
   *         description: Filter by warehouse name
   *       - name: code
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by warehouse code
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name and code
   *     responses:
   *       200:
   *         description: List of warehouses
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 warehouses:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/WarehouseApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  @Get('/warehouses')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'name', 'code', 'createdAt'])
  @filterable(['name', 'code'])
  @searchable(['name', 'code'])
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /warehouses/{id}:
   *   get:
   *     summary: Get warehouse by ID
   *     tags:
   *       - Warehouses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Warehouse ID
   *     responses:
   *       200:
   *         description: Warehouse found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WarehouseApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/warehouses/:id')
  @authorize({ level: SecurityLevel.USER })
  async getByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(new BadRequestError('Invalid ID format.'));
    }
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /warehouses:
   *   post:
   *     summary: Create a new warehouse
   *     tags:
   *       - Warehouses
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateWarehouseInput'
   *     responses:
   *       201:
   *         description: Warehouse created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WarehouseApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/warehouses')
  @authorize({ level: SecurityLevel.USER })
  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateWarehouseInput = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return next(new UnauthorizedError('User ID not found for audit.'));
    }

    await this.pipe(res, req, next, () => this.service.create(input, userId), 201);
  }

  /**
   * @openapi
   * /warehouses/{id}:
   *   put:
   *     summary: Update a warehouse
   *     tags:
   *       - Warehouses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Warehouse ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateWarehouseInput'
   *     responses:
   *       200:
   *         description: Warehouse updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WarehouseApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/warehouses/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(new BadRequestError('Invalid ID format.'));
    }

    const input: UpdateWarehouseInput = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return next(new UnauthorizedError('User ID not found for audit.'));
    }

    await this.pipe(res, req, next, () => this.service.update(id, input, userId));
  }

  /**
   * @openapi
   * /warehouses/{id}:
   *   delete:
   *     summary: Delete a warehouse (soft delete)
   *     description: Deletion might be restricted if the warehouse is in use.
   *     tags:
   *       - Warehouses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Warehouse ID
   *     responses:
   *       204:
   *         description: Warehouse deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/warehouses/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(new BadRequestError('Invalid ID format.'));
    }

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
