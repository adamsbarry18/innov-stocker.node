import { BaseRouter } from '@/common/routing/BaseRouter';
import { CurrencyService } from './services/currency.service';
import {
  authorize,
  Delete,
  filterable,
  Get,
  paginate,
  Patch,
  Post,
  Put,
  sortable,
} from '@/common/routing/decorators';
import { NextFunction, Request, Response } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import { BadRequestError } from '@/common/errors/httpErrors';

export default class CurrencyRouter extends BaseRouter {
  currencyService = CurrencyService.getInstance();

  /**
   * @openapi
   * /currencies:
   *   get:
   *     summary: Get all currencies
   *     tags:
   *       - Currencies
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: isActive
   *         in: query
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - name: code
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by currency code
   *     responses:
   *       200:
   *         description: List of currencies
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 currencies:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CurrencyApiResponse'
   *                 total:
   *                   type: integer
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *
   */
  @Get('/currencies')
  @authorize({ level: SecurityLevel.USER }) // Accessible aux utilisateurs pour voir les devises disponibles
  @paginate()
  @sortable(['id', 'code', 'name', 'isActive', 'createdAt'])
  @filterable(['isActive', 'code'])
  async getAllCurrencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    const filters: FindOptionsWhere<any> = {};
    if (req.filters) {
      req.filters.forEach((filter) => {
        // Assuming 'eq' operator for simplicity based on parseFiltering middleware
        (filters as any)[filter.field] = filter.value;
      });
    }

    const sort: FindOptionsOrder<any> = {};
    if (req.sorting) {
      req.sorting.forEach((s) => {
        (sort as any)[s.field] = s.direction;
      });
    }
    await this.pipe(res, req, next, () =>
      this.currencyService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /currencies/{id}:
   *   get:
   *     summary: Get currency by ID
   *     tags:
   *       - Currencies
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Currency ID
   *     responses:
   *       200:
   *         description: Currency found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CurrencyApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Get('/currencies/:id')
  @authorize({ level: SecurityLevel.USER })
  async getCurrencyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const currencyId = parseInt(req.params.id, 10);
    if (isNaN(currencyId)) {
      return next(new BadRequestError('Invalid currency ID format.'));
    }
    await this.pipe(res, req, next, () => this.currencyService.findById(currencyId));
  }

  /**
   * @openapi
   * /currencies:
   *   post:
   *     summary: Create a new currency
   *     tags:
   *       - Currencies
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCurrencyInput'
   *     responses:
   *       201:
   *         description: Currency created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CurrencyApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *
   */
  @Post('/currencies')
  @authorize({ level: SecurityLevel.ADMIN })
  async createCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    const currencyInput = req.body;
    await this.pipe(res, req, next, () => this.currencyService.create(currencyInput), 201);
  }

  /**
   * @openapi
   * /currencies/{id}:
   *   put:
   *     summary: Update a currency
   *     tags:
   *       - Currencies
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Currency ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCurrencyInput'
   *     responses:
   *       200:
   *         description: Currency updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CurrencyApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Put('/currencies/:id')
  @authorize({ level: SecurityLevel.ADMIN })
  async updateCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    const currencyId = parseInt(req.params.id, 10);
    if (isNaN(currencyId)) {
      return next(new BadRequestError('Invalid currency ID format.'));
    }
    const updateData = req.body;

    await this.pipe(res, req, next, () => this.currencyService.update(currencyId, updateData));
  }

  /**
   * @openapi
   * /currencies/{id}:
   *   delete:
   *     summary: Delete a currency (soft delete)
   *     description: Deletion might be restricted if the currency is actively used (e.g., as default company currency).
   *     tags:
   *       - Currencies
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Currency ID
   *     responses:
   *       204:
   *         description: Currency deleted successfully (No Content)
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Delete('/currencies/:id')
  @authorize({ level: SecurityLevel.ADMIN })
  async deleteCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    const currencyId = parseInt(req.params.id, 10);
    if (isNaN(currencyId)) {
      return next(new BadRequestError('Invalid currency ID format.'));
    }

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.currencyService.delete(currencyId);
      },
      204,
    );
  }

  /**
   * @openapi
   * /currencies/{id}/set-default:
   *   patch:
   *     summary: Set a currency as the company's default currency
   *     tags:
   *       - Currencies
   *       - Company
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the currency to set as default
   *     responses:
   *       200:
   *         description: Company default currency updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompanyApiResponse' # Returns the updated company settings
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Patch('/currencies/:id/set-default')
  @authorize({ level: SecurityLevel.ADMIN })
  async setDefaultCompanyCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    const currencyId = parseInt(req.params.id, 10);
    if (isNaN(currencyId)) {
      return next(new BadRequestError('Invalid currency ID format.'));
    }
    await this.pipe(res, req, next, () =>
      this.currencyService.setDefaultCompanyCurrency(currencyId),
    );
  }
}
