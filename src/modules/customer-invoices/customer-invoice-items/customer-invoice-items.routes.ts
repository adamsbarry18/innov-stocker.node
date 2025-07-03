import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { CustomerInvoiceItemService } from './services/customer-invoice-item.service';
import {
  CreateCustomerInvoiceItemInput,
  UpdateCustomerInvoiceItemInput,
} from './models/customer-invoice-item.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class CustomerInvoiceItemRouter extends BaseRouter {
  private itemService = CustomerInvoiceItemService.getInstance();

  /**
   * @openapi
   * /customer-invoices/{invoiceId}/items:
   *   post:
   *     summary: Add an item to a specific customer invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Customer Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer invoice
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerInvoiceItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/customer-invoices/:invoiceId/items')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async addCustomerInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (isNaN(invoiceId)) return next(new BadRequestError('Invalid Customer Invoice ID in path.'));

    const input: CreateCustomerInvoiceItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.itemService.addItemToInvoice(invoiceId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /customer-invoices/{invoiceId}/items:
   *   get:
   *     summary: Get all items for a specific customer invoice
   *     tags: [Customer Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer invoice
   *     responses:
   *       200:
   *         description: List of items for the customer invoice
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CustomerInvoiceItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/customer-invoices/:invoiceId/items')
  @authorize({ level: SecurityLevel.READER })
  async listCustomerInvoiceItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (isNaN(invoiceId)) return next(new BadRequestError('Invalid Customer Invoice ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getInvoiceItems(invoiceId));
  }

  /**
   * @openapi
   * /customer-invoices/{invoiceId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a customer invoice
   *     tags: [Customer Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer invoice
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the item
   *     responses:
   *       200:
   *         description: Customer invoice item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/customer-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.READER })
  async getCustomerInvoiceItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Customer Invoice or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(invoiceId, itemId));
  }

  /**
   * @openapi
   * /customer-invoices/{invoiceId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a customer invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Customer Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer invoice
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the item
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerInvoiceItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerInvoiceItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/customer-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateCustomerInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Customer Invoice or Item ID in path.'));

    const input: UpdateCustomerInvoiceItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateItemInInvoice(invoiceId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /customer-invoices/{invoiceId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a customer invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Customer Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the customer invoice
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the item
   *     responses:
   *       204:
   *         description: Item removed successfully (No Content)
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/customer-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async removeCustomerInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Customer Invoice or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.itemService.removeItemFromInvoice(invoiceId, itemId, userId);
      },
      204,
    );
  }
}
