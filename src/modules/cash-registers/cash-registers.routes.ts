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
import { Request, Response, NextFunction } from '../../config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { CreateCashRegisterInput, UpdateCashRegisterInput } from './models/cash-register.entity';
import { BadRequestError } from '@/common/errors/httpErrors';
import { CashRegisterService } from './services/cash-register.service';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class CashRegisterRouter extends BaseRouter {
  service = CashRegisterService.getInstance();

  /**
   * @openapi
   * /cash-registers:
   *   get:
   *     summary: Get all cash registers
   *     tags:
   *       - Cash Registers
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
   *         description: Filter by cash register name
   *       - name: shopId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by shop ID
   *       - name: currencyId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by currency ID
   *       - name: isActive
   *         in: query
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name
   *     responses:
   *       200:
   *         description: List of cash registers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 registers:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CashRegisterApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/cash-registers')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'name', 'shopId', 'currencyId', 'isActive', 'createdAt'])
  @filterable(['name', 'shopId', 'currencyId', 'isActive'])
  @searchable(['name'])
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
   * /cash-registers/{id}:
   *   get:
   *     summary: Get cash register by ID
   *     tags:
   *       - Cash Registers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cash register ID
   *     responses:
   *       200:
   *         description: Cash register found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/cash-registers/:id')
  @authorize({ level: SecurityLevel.USER })
  async getByIdCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /cash-registers:
   *   post:
   *     summary: Create a new cash register
   *     tags:
   *       - Cash Registers
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCashRegisterInput'
   *     responses:
   *       201:
   *         description: Cash register created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/cash-registers')
  @authorize({ level: SecurityLevel.USER })
  async createCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateCashRegisterInput = req.body;

    await this.pipe(res, req, next, () => this.service.create(input), 201);
  }

  /**
   * @openapi
   * /cash-registers/{id}:
   *   put:
   *     summary: Update a cash register
   *     description: Note - currentBalance is not updated via this endpoint. Currency is typically not changed.
   *     tags:
   *       - Cash Registers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cash register ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCashRegisterInput'
   *     responses:
   *       200:
   *         description: Cash register updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CashRegisterApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/cash-registers/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdateCashRegisterInput = req.body;

    await this.pipe(res, req, next, () => this.service.update(id, input));
  }

  /**
   * @openapi
   * /cash-registers/{id}:
   *   delete:
   *     summary: Delete a cash register (soft delete)
   *     description: Deletion might be restricted if the cash register has a non-zero balance or active sessions.
   *     tags:
   *       - Cash Registers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cash register ID
   *     responses:
   *       204:
   *         description: Cash register deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/cash-registers/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

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
