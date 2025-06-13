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
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { PaymentMethodService } from './services/payment-method.service';
import { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './models/payment-method.entity';
import { BadRequestError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class PaymentMethodRouter extends BaseRouter {
  service = PaymentMethodService.getInstance();

  /**
   * @openapi
   * /payment-methods:
   *   get:
   *     summary: Get all payment methods
   *     tags:
   *       - Payment Methods
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
   *         description: Filter by payment method name
   *       - name: type
   *         in: query
   *         schema:
   *           type: string
   *           enum: [cash, bank_transfer, check, card, other]
   *         description: Filter by payment method type
   *       - name: isActive
   *         in: query
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       200:
   *         description: List of payment methods
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 methods:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PaymentMethodApiResponse'
   *                 total:
   *                   type: integer
   *                 meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  @Get('/payment-methods')
  @authorize({ level: SecurityLevel.USER }) // Users might need to list these
  @paginate()
  @sortable(['id', 'name', 'type', 'isActive', 'createdAt'])
  @filterable(['name', 'type', 'isActive'])
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
   * /payment-methods/{id}:
   *   get:
   *     summary: Get payment method by ID
   *     tags:
   *       - Payment Methods
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Payment Method ID
   *     responses:
   *       200:
   *         description: Payment method found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentMethodApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/payment-methods/:id')
  @authorize({ level: SecurityLevel.USER })
  async getByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    await this.pipe(res, req, next, () => this.service.findById(id));
  }

  /**
   * @openapi
   * /payment-methods:
   *   post:
   *     summary: Create a new payment method
   *     tags:
   *       - Payment Methods
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePaymentMethodInput'
   *     responses:
   *       201:
   *         description: Payment method created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentMethodApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   */
  @Post('/payment-methods')
  @authorize({ level: SecurityLevel.USER })
  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreatePaymentMethodInput = req.body;

    await this.pipe(res, req, next, () => this.service.create(input), 201);
  }

  /**
   * @openapi
   * /payment-methods/{id}:
   *   put:
   *     summary: Update a payment method
   *     tags:
   *       - Payment Methods
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Payment Method ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePaymentMethodInput'
   *     responses:
   *       200:
   *         description: Payment method updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentMethodApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/payment-methods/:id')
  @authorize({ level: SecurityLevel.USER })
  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));

    const input: UpdatePaymentMethodInput = req.body;

    await this.pipe(res, req, next, () => this.service.update(id, input));
  }

  /**
   * @openapi
   * /payment-methods/{id}:
   *   delete:
   *     summary: Delete a payment method (soft delete)
   *     description: Deletion might be restricted if the payment method is in use.
   *     tags:
   *       - Payment Methods
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Payment Method ID
   *     responses:
   *       204:
   *         description: Payment method deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/payment-methods/:id')
  @authorize({ level: SecurityLevel.USER })
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
