import { BaseRouter } from '@/common/routing/BaseRouter';
import { authorize, Delete, Get, Post, Put } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { CompositeProductItemService } from './services/composite-product-item.service';
import {
  CreateCompositeProductItemInput,
  UpdateCompositeProductItemInput,
} from './models/composite-product-item.entity';

export default class ProductRouter extends BaseRouter {
  compositeItemService = CompositeProductItemService.getInstance();

  /**
   * @openapi
   * /products/{productId}/components:
   *   post:
   *     summary: Add a component to a composite product (kit)
   *     tags: [Products, Product Components]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite product (the kit)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCompositeProductItemInput'
   *     responses:
   *       201:
   *         description: Component added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompositeProductItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/products/:productId/components')
  @authorize({ level: SecurityLevel.USER })
  async addProductComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const compositeProductId = parseInt(req.params.productId, 10);
    if (isNaN(compositeProductId))
      return next(new BadRequestError('Invalid composite Product ID.'));

    const input: CreateCompositeProductItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.compositeItemService.addComponentToProduct(compositeProductId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/components:
   *   get:
   *     summary: Get all components for a composite product (kit)
   *     tags: [Products, Product Components]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite product (the kit)
   *     responses:
   *       200:
   *         description: List of components for the composite product
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/CompositeProductItemApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/components')
  @authorize({ level: SecurityLevel.USER })
  async listProductComponents(req: Request, res: Response, next: NextFunction): Promise<void> {
    const compositeProductId = parseInt(req.params.productId, 10);
    if (isNaN(compositeProductId))
      return next(new BadRequestError('Invalid composite Product ID.'));
    await this.pipe(res, req, next, () =>
      this.compositeItemService.getProductComponents(compositeProductId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/components/{itemId}:
   *   get:
   *     summary: Get a specific component link by its ID for a composite product
   *     tags: [Products, Product Components]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite product
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite_product_items record (the link)
   *     responses:
   *       200:
   *         description: Component link details found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompositeProductItemApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/components/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async getProductComponentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const compositeProductId = parseInt(req.params.productId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(compositeProductId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Product or Item ID.'));
    await this.pipe(res, req, next, () =>
      this.compositeItemService.getCompositeItemById(compositeProductId, itemId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/components/{itemId}:
   *   put:
   *     summary: Update a component's quantity in a composite product
   *     tags: [Products, Product Components]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite product
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite_product_items record (the link)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCompositeProductItemInput'
   *     responses:
   *       200:
   *         description: Component quantity updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CompositeProductItemApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/products/:productId/components/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async updateProductComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const compositeProductId = parseInt(req.params.productId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(compositeProductId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Product or Item ID.'));

    const input: UpdateCompositeProductItemInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.compositeItemService.updateProductComponent(compositeProductId, itemId, input, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/components/{itemId}:
   *   delete:
   *     summary: Remove a component from a composite product
   *     tags: [Products, Product Components]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite product
   *       - name: itemId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the composite_product_items record (the link)
   *     responses:
   *       204:
   *         description: Component removed successfully
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/products/:productId/components/:itemId')
  @authorize({ level: SecurityLevel.USER })
  async removeProductComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const compositeProductId = parseInt(req.params.productId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(compositeProductId) || isNaN(itemId))
      return next(new BadRequestError('Invalid Product or Item ID.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.compositeItemService.removeProductComponent(compositeProductId, itemId, userId);
      },
      204,
    );
  }
}
