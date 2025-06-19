import { BaseRouter } from '@/common/routing/BaseRouter';
import { Get, Post, authorize, paginate, sortable, filterable } from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { UserActivityLogService } from './services/user-activity-log.service';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { CreateUserActivityLogInput } from './models/user-activity-log.entity';

export default class UserActivityLogRouter extends BaseRouter {
  private service = UserActivityLogService.getInstance();

  /**
   * @openapi
   * /user-activity-logs:
   *   get:
   *     summary: Get all user activity logs
   *     description: Retrieve a paginated and filterable list of all user actions recorded in the system.
   *     tags: [User Activity Logs]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - $ref: '#/components/parameters/sortByQueryParam' # e.g., timestamp, entityType, actionType
   *       - $ref: '#/components/parameters/orderQueryParam'
   *       - name: userId
   *         in: query
   *         schema: { type: integer }
   *         description: Filter logs by the user who performed the action.
   *       - name: actionType
   *         in: query
   *         schema: { type: string, enum: [create, update, delete, login_success, login_failure, approve, cancel, complete, ship, receive, validate] }
   *         description: Filter by the type of action performed.
   *       - name: entityType
   *         in: query
   *         schema: { type: string }
   *         description: Filter by the type of entity affected (e.g., 'Product', 'SalesOrder').
   *       - name: entityId
   *         in: query
   *         schema: { type: string }
   *         description: Filter by the specific ID of the entity affected.
   *       - name: timestampFrom
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter logs on or after this date (YYYY-MM-DD).
   *       - name: timestampTo
   *         in: query
   *         schema: { type: string, format: date }
   *         description: Filter logs on or before this date (YYYY-MM-DD).
   *     responses:
   *       200:
   *         description: A list of user activity logs.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 logs:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/UserActivityLogApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Get('/user-activity-logs')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['id', 'timestamp', 'userId', 'actionType', 'entityType'])
  @filterable(['userId', 'actionType', 'entityType', 'entityId', 'ipAddress'])
  async listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findAllLogs({
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /user-activity-logs:
   *   post:
   *     summary: Log a user activity
   *     tags: [User Activity Logs]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserActivityLogInput'
   *     responses:
   *       201:
   *         description: User activity logged successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserActivityLogApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/user-activity-logs')
  @authorize({ level: SecurityLevel.USER })
  async createLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateUserActivityLogInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(res, req, next, () => this.service.logAction(input), 201);
  }

  /**
   * @openapi
   * /user-activity-logs/{id}:
   *   get:
   *     summary: Get a specific user activity log by its ID
   *     tags: [User Activity Logs]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: The ID of the log entry.
   *     responses:
   *       200:
   *         description: Activity log found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserActivityLogApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Get('/user-activity-logs/:id')
  @authorize({ level: SecurityLevel.USER })
  async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const logId = parseInt(req.params.id, 10);
    if (!logId) {
      return next(new BadRequestError('Log ID required'));
    }
    await this.pipe(res, req, next, () => this.service.findLogById(logId));
  }
}
