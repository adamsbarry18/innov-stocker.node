import { BaseRouter } from '@/common/routing/BaseRouter';
import { ProductVariantService } from './services/product-variant.service';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { authorize, Delete, Get, Post, Put } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import {
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from './models/product-variant.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';

export default class ProductVariantRouter extends BaseRouter {
  productVariantService = ProductVariantService.getInstance();

  /**
   * @openapi
   * /products/{productId}/variants:
   *   post:
   *     summary: Create a new variant for a product
   *     tags: [Products, Product Variants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the parent product
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductVariantInput'
   *     responses:
   *       201:
   *         description: Product variant created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductVariantApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/products/:productId/variants')
  @authorize({ level: SecurityLevel.USER }) // Ou ADMIN
  async createProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));

    const input: CreateProductVariantInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.productVariantService.createProductVariant(productId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/variants:
   *   get:
   *     summary: Get all variants for a specific product
   *     tags: [Products, Product Variants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the parent product
   *     responses:
   *       200:
   *         description: List of product variants
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductVariantApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/variants')
  @authorize({ level: SecurityLevel.USER })
  async listProductVariants(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    await this.pipe(res, req, next, () => this.productVariantService.getProductVariants(productId));
  }

  /**
   * @openapi
   * /products/{productId}/variants/{variantId}:
   *   get:
   *     summary: Get a specific product variant by its ID and parent product ID
   *     tags: [Products, Product Variants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the parent product
   *       - name: variantId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product variant
   *     responses:
   *       200:
   *         description: Product variant found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductVariantApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/variants/:variantId')
  @authorize({ level: SecurityLevel.USER })
  async getProductVariantById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const variantId = parseInt(req.params.variantId, 10);
    if (isNaN(productId) || isNaN(variantId))
      return next(new BadRequestError('Invalid Product or Variant ID.'));
    await this.pipe(res, req, next, () =>
      this.productVariantService.getProductVariantById(productId, variantId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/variants/{variantId}:
   *   put:
   *     summary: Update a specific product variant
   *     tags: [Products, Product Variants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the parent product
   *       - name: variantId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product variant
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductVariantInput'
   *     responses:
   *       200:
   *         description: Product variant updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductVariantApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/products/:productId/variants/:variantId')
  @authorize({ level: SecurityLevel.USER }) // Ou ADMIN
  async updateProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const variantId = parseInt(req.params.variantId, 10);
    if (isNaN(productId) || isNaN(variantId))
      return next(new BadRequestError('Invalid Product or Variant ID.'));

    const input: UpdateProductVariantInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.productVariantService.updateProductVariant(productId, variantId, input, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/variants/{variantId}:
   *   delete:
   *     summary: Delete a product variant (soft delete)
   *     tags: [Products, Product Variants]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the parent product
   *       - name: variantId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product variant
   *     responses:
   *       204:
   *         description: Product variant deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/products/:productId/variants/:variantId')
  @authorize({ level: SecurityLevel.USER })
  async deleteProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const variantId = parseInt(req.params.variantId, 10);
    if (isNaN(productId) || isNaN(variantId))
      return next(new BadRequestError('Invalid Product or Variant ID.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.productVariantService.deleteProductVariant(productId, variantId);
      },
      204,
    );
  }
}
