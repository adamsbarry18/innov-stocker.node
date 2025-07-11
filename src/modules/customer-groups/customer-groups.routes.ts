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
  searchable,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '@/modules/users/models/users.entity';
import { BadRequestError } from '@/common/errors/httpErrors';
import { CustomerGroupService } from './services/customer-group.service';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { CreateCustomerGroupInput, UpdateCustomerGroupInput } from './models/customer-group.entity';

export default class CustomerGroupRouter extends BaseRouter {
  groupService = CustomerGroupService.getInstance();

  /**
   * @openapi
   * /customer-groups:
   *   get:
   *     summary: Get all customer groups
   *     tags:
   *       - Customer Groups
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
   *         description: Filter by group name (supports partial match)
   *       - name: q
   *         in: query
   *         schema:
   *           type: string
   *         description: Search term for name and description
   *     responses:
   *       200:
   *         description: List of customer groups
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 groups:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerGroupApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/customer-groups')
  @authorize({ level: SecurityLevel.READER })
  @paginate()
  @sortable(['id', 'name', 'discountPercentage', 'createdAt'])
  @filterable(['name'])
  @searchable(['name', 'description'])
  async getAllGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.groupService.findAll({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /customer-groups/{id}:
   *   get:
   *     summary: Get customer group by ID
   *     tags:
   *       - Customer Groups
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Group ID
   *     responses:
   *       200:
   *         description: Customer group found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerGroupApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/customer-groups/:id')
  @authorize({ level: SecurityLevel.READER })
  async getGroupById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return next(new BadRequestError('Invalid customer group ID format.'));
    }
    await this.pipe(res, req, next, () => this.groupService.findById(groupId));
  }

  /**
   * @openapi
   * /customer-groups:
   *   post:
   *     summary: Create a new customer group
   *     tags:
   *       - Customer Groups
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateCustomerGroupInput'
   *     responses:
   *       201:
   *         description: Customer group created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerGroupApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/customer-groups')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    const groupInput: CreateCustomerGroupInput = req.body;

    await this.pipe(res, req, next, () => this.groupService.create(groupInput), 201);
  }

  /**
   * @openapi
   * /customer-groups/{id}:
   *   put:
   *     summary: Update a customer group
   *     tags:
   *       - Customer Groups
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Group ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateCustomerGroupInput'
   *     responses:
   *       200:
   *         description: Customer group updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CustomerGroupApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Put('/customer-groups/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async updateGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return next(new BadRequestError('Invalid customer group ID format.'));
    }
    const updateData: UpdateCustomerGroupInput = req.body;

    await this.pipe(res, req, next, () => this.groupService.update(groupId, updateData));
  }

  /**
   * @openapi
   * /customer-groups/{id}:
   *   delete:
   *     summary: Delete a customer group (soft delete)
   *     description: Deletion might be restricted if the group is used by customers.
   *     tags:
   *       - Customer Groups
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Customer Group ID
   *     responses:
   *       204:
   *         description: Customer group deleted successfully (No Content)
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/customer-groups/:id')
  @authorize({ level: SecurityLevel.INTEGRATOR })
  async deleteGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return next(new BadRequestError('Invalid customer group ID format.'));
    }

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.groupService.delete(groupId);
      },
      204,
    );
  }
}
