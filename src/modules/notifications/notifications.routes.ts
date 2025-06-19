import { BaseRouter } from '@/common/routing/BaseRouter';
import {
  Get,
  Post,
  Patch,
  authorize,
  paginate,
  sortable,
  filterable,
  Delete,
} from '@/common/routing/decorators';
import { Request, Response, NextFunction } from '@/config/http';
import { SecurityLevel } from '../users/models/users.entity';
import { NotificationService } from './services/notification.service';
import { BadRequestError, UnauthorizedError } from '@/common/errors/httpErrors';
import { buildTypeORMCriteria } from '@/common/utils/queryParsingUtils';
import { CreateNotificationInput } from './models/notification.entity';

export default class NotificationRouter extends BaseRouter {
  private service = NotificationService.getInstance();

  /**
   * @openapi
   * /notifications:
   *   post:
   *     summary: Create a new notification (for internal use by other services)
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateNotificationInput'
   *     responses:
   *       201:
   *         description: Notification created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/NotificationApiResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  @Post('/notifications')
  @authorize({ level: SecurityLevel.USER })
  async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    const input: CreateNotificationInput = req.body;
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));

    const notificationInput: CreateNotificationInput = {
      ...input,
      userId: userId,
    };

    await this.pipe(res, req, next, () => this.service.createNotification(notificationInput), 201);
  }

  /**
   * @openapi
   * /notifications:
   *   get:
   *     summary: Get notifications for the authenticated user
   *     description: Retrieve a paginated list of notifications for the currently logged-in user.
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/pageQueryParam'
   *       - $ref: '#/components/parameters/limitQueryParam'
   *       - name: isRead
   *         in: query
   *         schema: { type: boolean }
   *         description: Filter notifications by their read status (true or false).
   *       - name: type
   *         in: query
   *         schema: { type: string, enum: [INFO, success, warning, error, approval_request] }
   *         description: Filter by notification type.
   *     responses:
   *       200:
   *         description: A list of notifications.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 notifications:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/NotificationApiResponse'
   *                 total:
   *                   type: integer

   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/notifications')
  @authorize({ level: SecurityLevel.USER })
  @paginate()
  @sortable(['createdAt'])
  @filterable(['isRead', 'type'])
  async listMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User not found.'));

    const { filters, sort } = buildTypeORMCriteria(req);

    await this.pipe(res, req, next, () =>
      this.service.findUserNotifications(userId, {
        limit: req.pagination?.limit,
        offset: req.pagination?.offset,
        filters,
        sort,
      }),
    );
  }

  /**
   * @openapi
   * /notifications/unread-count:
   *   get:
   *     summary: Get the count of unread notifications for the authenticated user
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Count of unread notifications.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UnreadCountResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/notifications/unread-count')
  @authorize({ level: SecurityLevel.USER })
  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User not found.'));
    await this.pipe(res, req, next, () => this.service.getUnreadCount(userId));
  }

  /**
   * @openapi
   * /notifications/mark-all-as-read:
   *   post:
   *     summary: Mark all notifications as read for the authenticated user
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: All notifications marked as read. Returns the count of notifications updated.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 markedAsReadCount:
   *                   type: integer
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/notifications/mark-all-as-read')
  @authorize({ level: SecurityLevel.USER })
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User not found.'));
    await this.pipe(res, req, next, () => this.service.markAllAsRead(userId));
  }

  /**
   * @openapi
   * /notifications/{id}/read:
   *   patch:
   *     summary: Mark a specific notification as read
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: The ID of the notification to mark as read.
   *     responses:
   *       204:
   *         description: Notification successfully marked as read. No content returned.
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Patch('/notifications/:id/read')
  @authorize({ level: SecurityLevel.USER })
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid Notification ID format.'));

    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User not found.'));

    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.markAsRead(id, userId);
      },
      204,
    );
  }

  /**
   * @openapi
   * /notifications/{id}:
   *   delete:
   *     summary: Delete a notification (soft delete)
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *         description: Notification ID
   *     responses:
   *       204:
   *         description: Notification deleted successfully
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  @Delete('/notifications/:id')
  @authorize({ level: SecurityLevel.USER })
  async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(new BadRequestError('Invalid ID format.'));
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteNotification(id, userId);
      },
      204,
    );
  }

  /**
   * @openapi
   * /notifications:
   *   delete:
   *     summary: Delete all notifications for the authenticated user (soft delete)
   *     tags: [Notifications]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       204:
   *         description: All notifications deleted successfully
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/notifications')
  @authorize({ level: SecurityLevel.USER })
  async deleteAllNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    const userId = req.user?.id;
    if (!userId) return next(new UnauthorizedError('User ID not found for audit.'));
    await this.pipe(
      res,
      req,
      next,
      async () => {
        await this.service.deleteAllNotifications(userId);
      },
      204,
    );
  }
}
