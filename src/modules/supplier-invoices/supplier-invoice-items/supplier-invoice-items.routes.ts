import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, Put, Delete, authorize } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { SupplierInvoiceItemService } from './services/supplier-invoice-item.service';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import {
  CreateSupplierInvoiceItemInput,
  UpdateSupplierInvoiceItemInput,
} from './models/supplier-invoice-item.entity';

export default class SupplierInvoiceItemRouter extends BaseRouter {
  private itemService = SupplierInvoiceItemService.getInstance();

  /**
   * @openapi
   * /supplier-invoices/{invoiceId}/items:
   *   post:
   *     summary: Add an item to a specific supplier invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Supplier Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the supplier invoice
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateSupplierInvoiceItemInput'
   *     responses:
   *       201:
   *         description: Item added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/supplier-invoices/:invoiceId/items')
  @authorize({ level: SecurityLevel.USER }) // Or specific accounting role
  async addSupplierInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (isNaN(invoiceId)) return next(new BadRequestError('Invalid Supplier Invoice ID in path.'));

    const input: CreateSupplierInvoiceItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

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
   * /supplier-invoices/{invoiceId}/items:
   *   get:
   *     summary: Get all items for a specific supplier invoice
   *     tags: [Supplier Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the supplier invoice
   *     responses:
   *       200:
   *         description: List of items for the supplier invoice
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/SupplierInvoiceItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/supplier-invoices/:invoiceId/items')
  @authorize({ level: SecurityLevel.USER }) // User with rights to view supplier invoices
  async listSupplierInvoiceItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    if (isNaN(invoiceId)) return next(new BadRequestError('Invalid Supplier Invoice ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getInvoiceItems(invoiceId));
  }
  /**
   * @openapi
   * /supplier-invoices/{invoiceId}/items/{itemId}:
   *   get:
   *     summary: Get a specific item from a supplier invoice
   *     tags: [Supplier Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Supplier invoice item found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/supplier-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getSupplierInvoiceItemById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Supplier Invoice or Item ID in path.'));
    await this.pipe(res, req, next, () => this.itemService.getItemById(invoiceId, itemId));
  }

  /**
   * @openapi
   * /supplier-invoices/{invoiceId}/items/{itemId}:
   *   put:
   *     summary: Update a specific item in a supplier invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Supplier Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateSupplierInvoiceItemInput'
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SupplierInvoiceItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/supplier-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateSupplierInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Supplier Invoice or Item ID in path.'));

    const input: UpdateSupplierInvoiceItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.itemService.updateItemInInvoice(invoiceId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /supplier-invoices/{invoiceId}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from a supplier invoice
   *     description: Only allowed if the invoice is in an editable status (e.g., DRAFT).
   *     tags: [Supplier Invoice Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: invoiceId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       204:
   *         description: Item removed successfully (No Content)
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/supplier-invoices/:invoiceId/items/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeSupplierInvoiceItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const invoiceId = parseInt(req.params.invoiceId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(invoiceId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Supplier Invoice or Item ID in path.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

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
