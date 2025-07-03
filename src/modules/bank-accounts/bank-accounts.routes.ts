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
import { BankAccountService } from './services/bank-account.service';
import { CreateBankAccountInput, UpdateBankAccountInput } from './models/bank-account.entity';
import { BadRequestError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class BankAccountRouter extends BaseRouter {
  service = BankAccountService.getInstance();

  /**
   * @openapi
   * /bank-accounts:
   *   get:
   *     summary: Get all bank accounts
   *     tags:
   *       - Bank Accounts
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: accountName
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by account name
   *       - name: bankName
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by bank name
   *       - name: currencyId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by currency ID
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for accountName, bankName, iban, accountNumber
   *     responses:
   *       200:
   *         description: List of bank accounts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accounts:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BankAccountApiResponse'
   *                 total:
   *                   type: integer
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/bank-accounts')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable(['id', 'accountName', 'bankName', 'currencyId', 'createdAt'])
  @filterable(['accountName', 'bankName', 'currencyId'])
  @searchable(['accountName', 'bankName', 'iban', 'accountNumber'])
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
   * /bank-accounts/{id}:
   *   get:
   *     summary: Get bank account by ID
   *     tags:
   *       - Bank Accounts
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Bank account found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BankAccountApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/bank-accounts/:id')
  @authorize({ level: SecurityLevel.READER })
  async getByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /bank-accounts:
   *   post:
   *     summary: Create a new bank account
   *     tags:
   *       - Bank Accounts
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateBankAccountInput'
   *     responses:
   *       201:
   *         description: Bank account created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BankAccountApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/bank-accounts')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateBankAccountInput = req.body;

    await this.pipe(res, req, next, () => this.service.create(input), 201);
  }

  /**
   * @openapi
   * /bank-accounts/{id}:
   *   put:
   *     summary: Update a bank account
   *     description: Note - initialBalance and currentBalance are not typically updated via this endpoint. currentBalance is modified by transactions.
   *     tags:
   *       - Bank Accounts
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateBankAccountInput'
   *     responses:
   *       200:
   *         description: Bank account updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BankAccountApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/bank-accounts/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdateBankAccountInput = req.body;

    await this.pipe(res, req, next, () => this.service.update(id, input));
  }

  /**
   * @openapi
   * /bank-accounts/{id}:
   *   delete:
   *     summary: Delete a bank account (soft delete)
   *     description: Deletion might be restricted if the account has a non-zero balance or associated transactions.
   *     tags:
   *       - Bank Accounts
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       204:
   *         description: Bank account deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/bank-accounts/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
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
