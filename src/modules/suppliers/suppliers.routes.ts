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
import { SupplierService } from './services/supplier.service';
import { CreateSupplierInput, UpdateSupplierInput, Supplier } from './models/supplier.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { type FindOptionsWhere, type FindOptionsOrder } from 'typeorm';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class SupplierRouter extends BaseRouter {
  supplierService = SupplierService.getInstance();

  /**
   * @openapi
   * /suppliers:
   *   get:
   *     summary: Get all suppliers
   *     tags:
   *       - Suppliers
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
   *         description: Filter by supplier name
   *       - name: email
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by supplier email
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name, contactPersonName, email
   *     responses:
   *       200:
   *         description: List of suppliers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 suppliers:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/SupplierApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  @Get('/suppliers')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'name', 'email', 'createdAt'])
  @filterable(['name', 'email'])
  @searchable(['name', 'contactPersonName', 'email'])
  async getAllSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.supplierService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters: filters as FindOptionsWhere<Supplier>,
        sort: sort as FindOptionsOrder<Supplier>,
      }),
    );
  }

  /**
   * @openapi
   * /suppliers/{id}:
   *   get:
   *     summary: Get supplier by ID
   *     tags:
   *       - Suppliers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Supplier ID
   *     responses:
   *       200:
   *         description: Supplier found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/suppliers/:id')
  @authorize({ level: SecurityLevel.USER })
  async getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) {
      return next(new BadRequestError('Invalid supplier ID format.'));
    }
    await this.pipe(res, req, next, () => this.supplierService.findById(supplierId));
  }

  /**
   * @openapi
   * /suppliers:
   *   post:
   *     summary: Create a new supplier
   *     tags:
   *       - Suppliers
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSupplierInput'
   *     responses:
   *       201:
   *         description: Supplier created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/suppliers')
  @authorize({ level: SecurityLevel.USER }) // Or INTEGRATOR
  async createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    const supplierInput: CreateSupplierInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.supplierService.create(supplierInput, userId), 201);
  }

  /**
   * @openapi
   * /suppliers/{id}:
   *   put:
   *     summary: Update a supplier
   *     tags:
   *       - Suppliers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Supplier ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSupplierInput'
   *     responses:
   *       200:
   *         description: Supplier updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/suppliers/:id')
  @authorize({ level: SecurityLevel.USER }) // Or INTEGRATOR
  async updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) {
      return next(new BadRequestError('Invalid supplier ID format.'));
    }
    const updateData: UpdateSupplierInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.supplierService.update(supplierId, updateData, userId),
    );
  }

  /**
   * @openapi
   * /suppliers/{id}:
   *   delete:
   *     summary: Delete a supplier (soft delete)
   *     description: Deletion might be restricted if the supplier is used in purchase orders or product associations.
   *     tags:
   *       - Suppliers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Supplier ID
   *     responses:
   *       204:
   *         description: Supplier deleted successfully (No Content)
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/suppliers/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) {
      return next(new BadRequestError('Invalid supplier ID format.'));
    }
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.supplierService.delete(supplierId, userId);
      },
      204,
    );
  }
}
