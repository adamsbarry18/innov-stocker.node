import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  Delete,
  authorize,
  paginate,
  sortable,
  filterable,
  searchable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { PaymentService } from './services/payment.service';
import { CreatePaymentInput } from './models/payment.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';

export default class PaymentRouter extends BaseRouter {
  private service = PaymentService.getInstance();

  /**
   * @openapi
   * /payments:
   *   post:
   *     summary: Record a new payment
   *     tags: [Payments]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePaymentInput'
   *     responses:
   *       201:
   *         description: Payment recorded successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/payments')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async recordPaymentRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreatePaymentInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for recording payment.'));

    await this.pipe(res, req, next, () => this.service.recordPayment(input, userId), 201);
  }

  /**
   * @openapi
   * /payments:
   *   get:
   *     summary: Get all payments
   *     tags: [Payments]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam'
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: direction
   *         in: query
   *         schema: { type: string, enum: [inbound, outbound] }
   *       - name: paymentMethodId
   *         in: query
   *         schema: { type: integer }
   *       - name: currencyId
   *         in: query
   *         schema: { type: integer }
   *       - name: customerId
   *         in: query
   *         schema: { type: integer }
   *       - name: supplierId
   *         in: query
   *         schema: { type: integer }
   *       - name: customerInvoiceId
   *         in: query
   *         schema: { type: integer }
   *       - name: supplierInvoiceId
   *         in: query
   *         schema: { type: integer }
   *       - name: bankAccountId
   *         in: query
   *         schema: { type: integer }
   *       - name: cashRegisterSessionId
   *         in: query
   *         schema: { type: integer }
   *       - name: paymentDateFrom
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: paymentDateTo
   *         in: query
   *         schema: { type: string, format: date }
   *       - name: q
   *         in: query
   *         schema: { type: string }
   *         description: Search term for referenceNumber or notes
   *     responses:
   *       200:
   *         description: List of payments
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 payments:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PaymentApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/payments')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable([
    'id',
    'paymentDate',
    'amount',
    'direction',
    'currencyId',
    'paymentMethodId',
    'createdAt',
  ])
  @filterable([
    'direction',
    'paymentMethodId',
    'currencyId',
    'customerId',
    'supplierId',
    'customerInvoiceId',
    'supplierInvoiceId',
    'salesOrderId',
    'purchaseOrderId',
    'bankAccountId',
    'cashRegisterSessionId',
    'recordedByUserId',
  ])
  @searchable(['referenceNumber', 'notes'])
  async listPaymentsRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllPayments({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /payments/{id}:
   *   get:
   *     summary: Get a specific payment by its ID
   *     tags: [Payments]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string } # Payment ID is BIGINT, so string
   *         description: ID of the payment
   *     responses:
   *       200:
   *         description: Payment found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaymentApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/payments/:id')
  @authorize({ level: SecurityLevel.READER })
  async getPaymentByIdRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) {
      return next(new BadRequestError('Payment ID required'));
    }

    await this.pipe(res, req, next, () => this.service.findPaymentById(paymentId));
  }

  /**
   * @openapi
   * /payments/{id}:
   *   delete:
   *     summary: Delete (void/reverse) a payment
   *     description: This is a sensitive operation. It should reverse financial impacts (invoice statuses, account balances).
   *     tags: [Payments]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: string }
   *         description: ID of the payment to delete/reverse
   *     responses:
   *       204:
   *         description: Payment deleted/reversed successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/payments/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deletePaymentRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const paymentId = parseInt(req.params.id, 10);
    if (!paymentId) {
      return next(new BadRequestError('Payment ID required'));
    }
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deletePayment(paymentId, userId);
      },
      204,
    );
  }

  // PUT /payments/{id} is generally not provided for payments as they are often immutable.
  // Corrections are typically handled by voiding the original payment and creating a new one.
  // Or by creating adjustment transactions.
  // If a limited update (e.g., notes, referenceNumber) is needed, a PATCH endpoint could be added.
}
