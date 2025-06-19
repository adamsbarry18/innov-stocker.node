import { BaseRouter } from '@/common/routing/BaseRouter';
import { ProductSupplierService } from './services/product-supplier.service';
import { authorize, Delete, Get, Post, Put } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import {
  CreateProductSupplierForProductInput,
  CreateProductSupplierForVariantInput,
  UpdateProductSupplierInput,
} from './models/product-supplier.entity';

export default class ProductRouter extends BaseRouter {
  productSupplierService = ProductSupplierService.getInstance();

  /**
   * @openapi
   * /products/{productId}/suppliers:
   *   post:
   *     summary: Add a supplier to a base product
   *     tags: [Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the base product
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductSupplierInput'
   *     responses:
   *       201:
   *         description: Supplier linked to product successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/products/:productId/suppliers')
  @authorize({ level: SecurityLevel.USER })
  async addSupplierToProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));

    const input: Omit<CreateProductSupplierForProductInput, 'productId'> = req.body;

    await this.pipe(
      res,
      req,
      next,
      () => this.productSupplierService.addSupplierToProduct(productId, input),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/suppliers:
   *   get:
   *     summary: Get all suppliers for a base product
   *     tags: [Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the base product
   *     responses:
   *       200:
   *         description: List of suppliers for the product
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:productId/suppliers')
  @authorize({ level: SecurityLevel.USER })
  async listProductSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) return next(new BadRequestError('Invalid Product ID.'));
    await this.pipe(res, req, next, () =>
      this.productSupplierService.getProductSuppliers(productId),
    );
  }

  // --- Product Variant Supplier Sub-Routes ---

  /**
   * @openapi
   * /products/{productId}/variants/{variantId}/suppliers:
   *   post:
   *     summary: Add a supplier to a specific product variant
   *     tags: [Product Variants, Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: variantId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the variant
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProductSupplierInput'
   *     responses:
   *       201:
   *         description: Supplier linked to variant successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Post('/products/:productId/variants/:variantId/suppliers')
  @authorize({ level: SecurityLevel.USER })
  async addSupplierToVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const variantId = parseInt(req.params.variantId, 10);
    if (isNaN(productId) || isNaN(variantId))
      return next(new BadRequestError('Invalid Product or Variant ID.'));

    const input: Omit<CreateProductSupplierForVariantInput, 'productVariantId' | 'productId'> =
      req.body;

    await this.pipe(
      res,
      req,
      next,
      () => this.productSupplierService.addSupplierToVariant(productId, variantId, input),
      201,
    );
  }

  /**
   * @openapi
   * /products/{productId}/variants/{variantId}/suppliers:
   *   get:
   *     summary: Get all suppliers for a specific product variant
   *     tags: [Product Variants, Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: productId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the product
   *       - name: variantId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: ID of the variant
   *     responses:
   *       200:
   *         description: List of suppliers for the variant
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/products/:productId/variants/:variantId/suppliers')
  @authorize({ level: SecurityLevel.USER })
  async listProductVariantSuppliers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const productId = parseInt(req.params.productId, 10);
    const variantId = parseInt(req.params.variantId, 10);
    if (isNaN(productId) || isNaN(variantId))
      return next(new BadRequestError('Invalid Product or Variant ID.'));
    await this.pipe(res, req, next, () =>
      this.productSupplierService.getProductVariantSuppliers(productId, variantId),
    );
  }

  // --- Routes for managing a specific ProductSupplier link (identified by its own ID) ---

  /**
   * @openapi
   * /product-suppliers/{linkId}:
   *   get:
   *     summary: Get a specific product-supplier link by its ID
   *     tags: [Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: linkId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: The ID of the product_suppliers record
   *     responses:
   *       200:
   *         description: Product-supplier link details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/product-suppliers/:linkId')
  @authorize({ level: SecurityLevel.USER })
  async getProductSupplierLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    const linkId = parseInt(req.params.linkId, 10);
    if (isNaN(linkId)) return next(new BadRequestError('Invalid link ID.'));
    await this.pipe(res, req, next, () =>
      this.productSupplierService.getProductSupplierLink(linkId),
    );
  }

  /**
   * @openapi
   * /product-suppliers/{linkId}:
   *   put:
   *     summary: Update a specific product-supplier link
   *     description: Updates details like purchase price, supplier code, or default status for an existing link.
   *     tags: [Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: linkId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: The ID of the product_suppliers record
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateProductSupplierInput'
   *     responses:
   *       200:
   *         description: Link updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ProductSupplierApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/product-suppliers/:linkId')
  @authorize({ level: SecurityLevel.USER })
  async updateProductSupplierLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    const linkId = parseInt(req.params.linkId, 10);
    if (isNaN(linkId)) return next(new BadRequestError('Invalid link ID.'));

    const input: UpdateProductSupplierInput = req.body;

    await this.pipe(res, req, next, () =>
      this.productSupplierService.updateProductSupplierLink(linkId, input),
    );
  }

  /**
   * @openapi
   * /product-suppliers/{linkId}:
   *   delete:
   *     summary: Delete a specific product-supplier link
   *     tags: [Product Suppliers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: linkId
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: The ID of the product_suppliers record
   *     responses:
   *       204:
   *         description: Link deleted successfully
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/product-suppliers/:linkId')
  @authorize({ level: SecurityLevel.USER })
  async deleteProductSupplierLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    const linkId = parseInt(req.params.linkId, 10);
    if (isNaN(linkId)) return next(new BadRequestError('Invalid link ID.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.productSupplierService.deleteProductSupplierLink(linkId);
      },
      204,
    );
  }
}
