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
import { SecurityLevel } from '../users/models/users.entity';
import { CustomerService } from './services/customer.service';
import { CustomerShippingAddressService } from './services/customer-shipping-address.service';
import { CreateCustomerInput, UpdateCustomerInput } from './models/customer.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import {
  CreateCustomerShippingAddressInput,
  UpdateCustomerShippingAddressInput,
} from './models/customer-shipping-addresses.entity';

export default class CustomerRouter extends BaseRouter {
  customerService = CustomerService.getInstance();
  customerShippingAddressService = new CustomerShippingAddressService();

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
    // const searchTerm = req.searchQuery; // Assuming @searchable populates this

    await this.pipe(res, req, next, () =>
      this.customerService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
        // searchTerm: searchTerm
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
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or ADMIN
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
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or ADMIN
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
  @authorize({ level: SecurityLevel.ADMIN })
  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.id, 10);
    if (isNaN(customerId)) {
      return next(new BadRequestError('Invalid customer ID format.'));
    }
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.customerService.delete(customerId, userId);
      },
      204,
    );
  }

  // --- Routes for Customer Shipping Addresses ---

  /**
   * @openapi
   * /customers/{customerId}/shipping-addresses:
   *   get:
   *     summary: Get all shipping addresses for a customer
   *     tags:
   *       - Customers
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: customerId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer ID
   *     responses:
   *       200:
   *         description: List of shipping addresses
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CustomerShippingAddressApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/customers/:customerId/shipping-addresses')
  @authorize({ level: SecurityLevel.USER })
  async getCustomerShippingAddresses(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const customerId = parseInt(req.params.customerId, 10);
    if (isNaN(customerId)) return next(new BadRequestError('Invalid customer ID.'));
    await this.pipe(res, req, next, () =>
      this.customerShippingAddressService.getCustomerShippingAddresses(customerId),
    );
  }

  /**
   * @openapi
   * /customers/{customerId}/shipping-addresses:
   *   post:
   *     summary: Add a new shipping address for a customer
   *     tags:
   *       - Customers
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: customerId
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
   *             $ref: '#/components/schemas/CreateCustomerShippingAddressInput'
   *     responses:
   *       201:
   *         description: Shipping address added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerShippingAddressApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/customers/:customerId/shipping-addresses')
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or ADMIN
  async addShippingAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.customerId, 10);
    if (isNaN(customerId)) return next(new BadRequestError('Invalid customer ID.'));

    const input: CreateCustomerShippingAddressInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.customerShippingAddressService.addShippingAddress(customerId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /customers/{customerId}/shipping-addresses/{shippingAddressId}:
   *   put:
   *     summary: Update a specific shipping address for a customer
   *     tags:
   *       - Customers
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: customerId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer ID
   *       - name: shippingAddressId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Shipping Address Link ID (not Address.id itself)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerShippingAddressInput'
   *     responses:
   *       200:
   *         description: Shipping address updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerShippingAddressApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/customers/:customerId/shipping-addresses/:shippingAddressId')
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or ADMIN
  async updateShippingAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.customerId, 10);
    const shippingAddressId = parseInt(req.params.shippingAddressId, 10);
    if (isNaN(customerId) || isNaN(shippingAddressId))
      return next(new BadRequestError('Invalid ID(s).'));

    const input: UpdateCustomerShippingAddressInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.customerShippingAddressService.updateShippingAddress(
        customerId,
        shippingAddressId,
        input,
        userId,
      ),
    );
  }

  /**
   * @openapi
   * /customers/{customerId}/shipping-addresses/{shippingAddressId}:
   *   delete:
   *     summary: Remove a shipping address linkage for a customer (soft delete)
   *     tags:
   *       - Customers
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: customerId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *       - name: shippingAddressId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       204:
   *         description: Shipping address linkage removed successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/customers/:customerId/shipping-addresses/:shippingAddressId')
  @authorize({ level: SecurityLevel.INTEGRATOR }) // Or ADMIN
  async removeShippingAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.customerId, 10);
    const shippingAddressId = parseInt(req.params.shippingAddressId, 10);
    if (isNaN(customerId) || isNaN(shippingAddressId))
      return next(new BadRequestError('Invalid ID(s).'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.customerShippingAddressService.removeShippingAddress(
          customerId,
          shippingAddressId,
          userId,
        );
      },
      204,
    );
  }

  /**
   * @openapi
   * /customers/{customerId}/shipping-addresses/{shippingAddressId}/set-default:
   *   patch:
   *     summary: Set a specific shipping address as default for the customer
   *     tags:
   *       - Customers
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: customerId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *       - name: shippingAddressId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID of the customer_shipping_addresses record
   *     responses:
   *       200:
   *         description: Default shipping address updated successfully for the customer
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/customers/:customerId/shipping-addresses/:shippingAddressId/set-default')
  @authorize({ level: SecurityLevel.USER }) // Or ADMIN
  async setDefaultShippingAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const customerId = parseInt(req.params.customerId, 10);
    const shippingAddressId = parseInt(req.params.shippingAddressId, 10);
    if (isNaN(customerId) || isNaN(shippingAddressId))
      return next(new BadRequestError('Invalid ID(s).'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.customerShippingAddressService.setDefaultShippingAddress(
        customerId,
        shippingAddressId,
        userId,
      ),
    );
  }
}
