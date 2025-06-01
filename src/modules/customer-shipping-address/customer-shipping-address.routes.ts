import { BaseRouter } from '../../common/routing/BaseRouter';
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
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { CustomerShippingAddressService } from './services/csa.service';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import {
  CreateCustomerShippingAddressInput,
  UpdateCustomerShippingAddressInput,
} from './models/csa.entity';

export default class CustomerShippingAddressRouter extends BaseRouter {
  service = CustomerShippingAddressService.getInstance();

  /**
   * @openapi
   * /customer-shipping-addresses:
   *   get:
   *     summary: Get all customer shipping address links
   *     description: Retrieve a list of all customer shipping address links. Primarily for admin/debug. Filter by customerId is recommended.
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: customerId
   *         in: query
   *         schema:
   *           type: integer
   *         description: Filter by Customer ID
   *       - name: addressLabel
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by address label
   *       - name: isDefault
   *         in: query
   *         schema:
   *           type: boolean
   *         description: Filter by default status
   *     responses:
   *       200:
   *         description: List of customer shipping address links
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 shippingAddresses:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerShippingAddressApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Get('/customer-shipping-addresses')
  @authorize({ level: SecurityLevel.USER }) // Admin or Integrator level
  @paginate()
  @sortable(['id', 'customerId', 'addressLabel', 'isDefault', 'createdAt'])
  @filterable(['customerId', 'addressLabel', 'isDefault'])
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
   * /customer-shipping-addresses/{id}:
   *   get:
   *     summary: Get a specific customer shipping address link by its ID
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Shipping Address Link ID
   *     responses:
   *       200:
   *         description: Customer shipping address link found
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
  @Get('/customer-shipping-addresses/:id')
  @authorize({ level: SecurityLevel.USER })
  async getByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    // TODO: Add authorization to ensure user can access this specific link,
    // e.g., if req.user.id matches the customerId of the link, or if admin.
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /customer-shipping-addresses:
   *   post:
   *     summary: Create a new customer shipping address link
   *     description: Links an existing address (or creates a new one on-the-fly) to a customer with a label.
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerShippingAddressInput'
   *     responses:
   *       201:
   *         description: Link created successfully
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
  @Post('/customer-shipping-addresses')
  @authorize({ level: SecurityLevel.USER })
  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateCustomerShippingAddressInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    // TODO: Authorization: Ensure req.user can create a shipping address for input.customerId

    await this.pipe(res, req, next, () => this.service.create(input, userId), 201);
  }

  /**
   * @openapi
   * /customer-shipping-addresses/{id}:
   *   put:
   *     summary: Update a customer shipping address link
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Shipping Address Link ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerShippingAddressInput'
   *     responses:
   *       200:
   *         description: Link updated successfully
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
  @Put('/customer-shipping-addresses/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdateCustomerShippingAddressInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    // TODO: Authorization: Ensure req.user can update this link

    await this.pipe(res, req, next, () => this.service.update(id, input, userId));
  }

  /**
   * @openapi
   * /customer-shipping-addresses/{id}:
   *   delete:
   *     summary: Delete a customer shipping address link (soft delete)
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Shipping Address Link ID
   *     responses:
   *       204:
   *         description: Link deleted successfully
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/customer-shipping-addresses/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    // TODO: Authorization: Ensure req.user can delete this link

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.delete(id, userId);
      },
      204,
    );
  }

  /**
   * @openapi
   * /customer-shipping-addresses/{id}/set-default:
   *   patch:
   *     summary: Set a customer shipping address link as the default for its customer
   *     tags:
   *       - Customer Shipping Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Shipping Address Link ID
   *     responses:
   *       200:
   *         description: Default status updated successfully
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
  @Patch('/customer-shipping-addresses/:id/set-default')
  @authorize({ level: SecurityLevel.USER })
  async setAsDefaultRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));
    // TODO: Authorization: Ensure req.user can modify this link's default status

    await this.pipe(res, req, next, () => this.service.setAsDefault(id, userId));
  }
}
