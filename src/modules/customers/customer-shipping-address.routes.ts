import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, Patch, authorize } from '../../common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import {
  CreateCustomerShippingAddressInput,
  UpdateCustomerShippingAddressInput,
} from './models/customer-shipping-addresses.entity';
import { CustomerShippingAddressService } from './services/customer-shipping-address.service';

export default class CustomerShippingAddressRouter extends BaseRouter {
  customerShippingAddressService = new CustomerShippingAddressService();

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
  @authorize({ level: SecurityLevel.USER })
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
  @authorize({ level: SecurityLevel.USER })
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
  @authorize({ level: SecurityLevel.USER })
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
