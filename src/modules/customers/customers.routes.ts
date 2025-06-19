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
} from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { CustomerService } from './services/customer.service';
import { CreateCustomerInput, UpdateCustomerInput } from './models/customer.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class CustomerRouter extends BaseRouter {
  customerService = CustomerService.getInstance();

  /**
   * @openapi
   * /customers:
   *   get:
   *     summary: Get all customers
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: email
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by customer email
   *       - name: companyName
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by company name
   *       - name: customerGroupId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by customer group ID
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name, company name, email
   *     responses:
   *       200:
   *         description: List of customers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 customers:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  @Get('/customers')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'email', 'companyName', 'lastName', 'firstName', 'createdAt'])
  @filterable(['email', 'companyName', 'customerGroupId'])
  @searchable(['email', 'firstName', 'lastName', 'companyName'])
  async getAllCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.customerService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /customers/{id}:
   *   get:
   *     summary: Get customer by ID
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer ID
   *     responses:
   *       200:
   *         description: Customer found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customers/:id')
  @authorize({ level: SecurityLevel.USER })
  async getCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return next(new BadRequestError('Invalid customer ID format.'));
    }
    await this.pipe(res, req, next, () => this.customerService.findById(customerId));
  }

  /**
   * @openapi
   * /customers:
   *   post:
   *     summary: Create a new customer
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerInput'
   *     responses:
   *       201:
   *         description: Customer created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/customers')
  @authorize({ level: SecurityLevel.USER })
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerInput: CreateCustomerInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () => this.customerService.create(customerInput, userId), 201);
  }

  /**
   * @openapi
   * /customers/{id}:
   *   put:
   *     summary: Update a customer
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerInput'
   *     responses:
   *       200:
   *         description: Customer updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/customers/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return next(new BadRequestError('Invalid customer ID format.'));
    }
    const updateData: UpdateCustomerInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.customerService.update(customerId, updateData, userId),
    );
  }

  /**
   * @openapi
   * /customers/{id}:
   *   delete:
   *     summary: Delete a customer (soft delete)
   *     description: Deletion might be restricted if the customer has associated orders or invoices.
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer ID
   *     responses:
   *       204:
   *         description: Customer deleted successfully (No Content)
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/customers/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return next(new BadRequestError('Invalid customer ID format.'));
    }

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.customerService.delete(customerId);
      },
      204,
    );
  }
}
