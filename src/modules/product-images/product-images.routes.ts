import { BaseRouter } from '@/common/routing/BaseRouter';
import { authorize, Delete, Get, Patch, Post, Put } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { CreateProductImageInput, UpdateProductImageInput } from './models/product-image.entity';
import { ProductImageService } from './services/product-image.service';

export default class ProductImageRouter extends BaseRouter {
  productImageService = ProductImageService.getInstance();

  // --- Product Image Sub-Routes ---

  /**
   * @openapi
   * /products/{productId}/images:
   *   post:
   *     summary: Add an image to a product
   *     description: Uploads an image file (via multipart/form-data typically handled by middleware before this controller) and links its URL to the product. If it's the first image or `isPrimary` is true, it becomes the primary image.
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductImageInput'
   *     responses:
   *       201:
   *         description: Image added successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Post('/products/:productId/images')
  @authorize({ level: SecurityLevel.USER })
  async addProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));

    // Assuming input contains imageUrl. File upload itself would be handled by middleware like Multer.
    // The middleware would make file URL available, e.g., in req.file.path or req.body.imageUrl (if pre-uploaded)
    const input: CreateProductImageInput = req.body;
    // Example if using multer and storing URL:
    // if (req.file) { input.imageUrl = req.file.path; // Or a publicly accessible URL }
    // else if (!input.imageUrl) { return next(new BadRequestError('Image URL or file is required.')); }

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      () => this.productImageService.addProductImage(productId, input, userId),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/images:
   *   get:
   *     summary: Get all images for a product
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *     responses:
   *       200:
   *         description: List of product images
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductImageApiResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/images')
  @authorize({ level: SecurityLevel.USER })
  async listProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    await this.pipe(res, req, next, () => this.productImageService.getProductImages(productId));
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}:
   *   get:
   *     summary: Get a specific product image by its ID
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the image
   *     responses:
   *       200:
   *         description: Product image found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Get('/products/:productId/images/:imageId')
  @authorize({ level: SecurityLevel.USER })
  async getProductImageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));
    await this.pipe(res, req, next, () =>
      this.productImageService.getProductImageById(productId, imageId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}:
   *   put:
   *     summary: Update product image details (e.g., alt text, primary status)
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the image
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductImageInput'
   *     responses:
   *       200:
   *         description: Image updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Put('/products/:productId/images/:imageId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));

    const input: UpdateProductImageInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.productImageService.updateProductImage(productId, imageId, input, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}/set-primary:
   *   patch:
   *     summary: Set an image as the primary image for the product
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the image
   *     responses:
   *       200:
   *         description: Primary image set successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductImageApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Patch('/products/:productId/images/:imageId/set-primary')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async setPrimaryProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(res, req, next, () =>
      this.productImageService.setPrimaryProductImage(productId, imageId, userId),
    );
  }

  /**
   * @openapi
   * /products/{productId}/images/{imageId}:
   *   delete:
   *     summary: Delete a product image
   *     tags: [Products, Product Images]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: imageId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the image
   *     responses:
   *       204:
   *         description: Image deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  @Delete('/products/:productId/images/:imageId')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(productId) || isNaN(imageId)) return next(new BadRequestError('Invalid ID(s).'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.productImageService.deleteProductImage(productId, imageId, userId);
      },
      204,
    );
  }
}
