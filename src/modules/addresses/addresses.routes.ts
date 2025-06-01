import { BaseRouter } from '@/common/routing/BaseRouter';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { AddressService } from './services/address.service';
import {
  authorize,
  Delete,
  filterable,
  Get,
  paginate,
  Post,
  Put,
  searchable,
  sortable,
} from '@/common/routing/decorators';
import { NextFunction, Response, Request } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError } from '@/common/errors/httpErrors';

export default class AddressRouter extends BaseRouter {
  addressService = AddressService.getInstance();

  /**
   * @openapi
   * /addresses:
   *   get:
   *     summary: Get all addresses
   *     tags:
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Number of items per page
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *         description: Field to sort by (e.g., "createdAt")
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *       - in: query
   *         name: city
   *         schema:
   *           type: string
   *         description: Filter by city (applied as filter[city]=value)
   *       - in: query
   *         name: country
   *         schema:
   *           type: string
   *         description: Filter by country (applied as filter[country]=value)
   *       - in: query
   *         name: postalCode
   *         schema:
   *           type: string
   *         description: Filter by postal code (applied as filter[postalCode]=value)
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search term for streetLine1, city, postalCode
   *     responses:
   *       200:
   *         description: List of addresses
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 addresses:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/AddressApiResponse'
   *                 total:
   *                   type: integer
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *
   */
  @Get('/addresses')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'city', 'country', 'createdAt'])
  @filterable(['city', 'country', 'postalCode'])
  @searchable(['streetLine1', 'city', 'postalCode'])
  async getAllAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.addressService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /addresses/{id}:
   *   get:
   *     summary: Get address by ID
   *     tags:
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Address ID
   *     responses:
   *       200:
   *         description: Address found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AddressApiResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Get('/addresses/:id')
  @authorize({ level: SecurityLevel.USER })
  async getAddressById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const addressId = parseInt(req.params.id, 10);
    if (isNaN(addressId)) {
      return next(new BadRequestError('Invalid address ID format.'));
    }
    await this.pipe(res, req, next, () => this.addressService.findById(addressId));
  }

  /**
   * @openapi
   * /addresses:
   *   post:
   *     summary: Create a new address
   *     description: Note - Addresses are often created in context of another entity (customer, supplier). This endpoint allows direct creation if needed.
   *     tags:
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateAddressInput'
   *     responses:
   *       201:
   *         description: Address created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AddressApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *
   */
  @Post('/addresses')
  @authorize({ level: SecurityLevel.ADMIN })
  async createAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const addressInput = req.body;

    await this.pipe(res, req, next, () => this.addressService.create(addressInput), 201);
  }

  /**
   * @openapi
   * /addresses/{id}:
   *   put:
   *     summary: Update an address
   *     tags:
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Address ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateAddressInput'
   *     responses:
   *       200:
   *         description: Address updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AddressApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Put('/addresses/:id')
  @authorize({ level: SecurityLevel.ADMIN })
  async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const addressId = parseInt(req.params.id, 10);
    if (isNaN(addressId)) {
      return next(new BadRequestError('Invalid address ID format.'));
    }
    const updateData = req.body;
    await this.pipe(res, req, next, () => this.addressService.update(addressId, updateData));
  }

  /**
   * @openapi
   * /addresses/{id}:
   *   delete:
   *     summary: Delete an address (soft delete)
   *     description: Addresses are typically soft-deleted. Deletion might be restricted if the address is actively used by critical entities.
   *     tags:
   *       - Addresses
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Address ID
   *     responses:
   *       204:
   *         description: Address deleted successfully (No Content)
   *       400:
   *         description: Bad request (e.g., address in use)
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *
   */
  @Delete('/addresses/:id')
  @authorize({ level: SecurityLevel.ADMIN })
  async deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const addressId = parseInt(req.params.id, 10);
    if (isNaN(addressId)) {
      return next(new BadRequestError('Invalid address ID format.'));
    }
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.addressService.delete(addressId);
      },
      204,
    );
  }
}
