import { NotificationRepository } from '../data/notification.repository';
import { UserRepository } from '../../users/data/users.repository';
import {
  type Notification,
  type CreateNotificationInput,
  type NotificationApiResponse,
  createNotificationSchema,
} from '../models/notification.entity';
import {
  NotFoundError,
  ServerError,
  ForbiddenError,
  BadRequestError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';

let instance: NotificationService | null = null;

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository = new NotificationRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
  ) {}

  static getInstance(): NotificationService {
    instance ??= new NotificationService();
    return instance;
  }

  private mapToApiResponse(notification: Notification | null): NotificationApiResponse | null {
    if (!notification) return null;
    return notification.toApi();
  }

  /**
   * Creates a notification for a user. This is the primary method to be called by other services.
   * This service is designed to be highly resilient and should not fail the main transaction
   * of the calling service. It logs errors internally but doesn't re-throw them.
   * @param input - The data for the notification entry.
   * @param transactionalEntityManager - Optional. The EntityManager from an ongoing transaction.
   */
  async createNotification(
    input: CreateNotificationInput,
    transactionalEntityManager?: EntityManager,
  ): Promise<NotificationApiResponse> {
    try {
      const validationResult = createNotificationSchema.safeParse(input);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        );
        logger.error({ message: 'Invalid data passed to createNotification', errors, input });
        throw new BadRequestError(`Invalid notification data provided: ${errors.join('; ')}`);
      }

      const notificationEntity = this.notificationRepository.create(
        validationResult.data,
        transactionalEntityManager,
      );
      const savedNotification = await this.notificationRepository.save(
        notificationEntity,
        transactionalEntityManager,
      );
      logger.info(`Notification created for user ${input.userId}: "${input.message}"`);
      // TODO: Here you could trigger real-time push notifications (e.g., via WebSockets, Firebase Cloud Messaging)
      return this.mapToApiResponse(savedNotification) as NotificationApiResponse;
    } catch (error) {
      logger.error(`Failed to create notification ${JSON.stringify(error)} `);
      throw error;
    }
  }

  /**
   * Retrieves all notifications for a specific user.
   * @param userId - The ID of the user whose notifications are to be fetched.
   * @param options - Filtering and pagination options.
   * @returns A paginated list of the user's notifications.
   */
  async findUserNotifications(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      filters?: FindOptionsWhere<Notification>;
      sort?: FindManyOptions<Notification>['order'];
    },
  ): Promise<{ notifications: NotificationApiResponse[]; total: number }> {
    try {
      const { notifications, count } = await this.notificationRepository.findAllForUser(userId, {
        where: options.filters,
        skip: options.offset,
        take: options.limit,
        order: options.sort ?? { createdAt: 'DESC' },
      });
      const apiNotifications = notifications
        .map((n) => this.mapToApiResponse(n))
        .filter(Boolean) as NotificationApiResponse[];
      return { notifications: apiNotifications, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding notifications for user ${userId}`, error, options },
        'NotificationService.findUserNotifications',
      );
      // Relancer l'erreur si c'est déjà une erreur HTTP spécifique, sinon une ServerError
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error retrieving notifications.');
    }
  }

  /**
   * Counts unread notifications for a user.
   * @param userId - The ID of the user.
   * @returns The count of unread notifications.
   */
  async getUnreadCount(userId: number): Promise<{ unreadCount: number }> {
    try {
      const unreadCount = await this.notificationRepository.countUnreadForUser(userId);
      return { unreadCount };
    } catch (error) {
      logger.error(
        { message: `Error counting unread notifications for user ${userId}`, error },
        'NotificationService.getUnreadCount',
      );
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error counting notifications.');
    }
  }

  /**
   * Marks a specific notification as read for the given user.
   * @param notificationId - The ID of the notification to mark as read.
   * @param userId - The ID of the user who owns the notification.
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      const notification = await this.notificationRepository.findById(notificationId);
      if (!notification) {
        throw new NotFoundError(`Notification with ID ${notificationId} not found.`);
      }
      if (notification.userId !== userId) {
        throw new ForbiddenError('You are not authorized to modify this notification.');
      }
      if (notification.isRead) {
        return; // Already read, no action needed.
      }
      await this.notificationRepository.markAsRead(notificationId, userId);
      logger.info(`Notification ${notificationId} marked as read for user ${userId}.`);
    } catch (error) {
      logger.error({ message: `Error marking notification ${notificationId} as read`, error });
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error updating notification status.');
    }
  }

  /**
   * Marks all unread notifications as read for the given user.
   * @param userId - The ID of the user.
   */
  async markAllAsRead(userId: number): Promise<{ markedAsReadCount: number }> {
    try {
      const result = await this.notificationRepository.markAllAsReadForUser(userId);
      const markedAsReadCount = result.affected ?? 0;
      logger.info(`${markedAsReadCount} notifications marked as read for user ${userId}.`);
      return { markedAsReadCount };
    } catch (error) {
      logger.error(
        { message: `Error marking all notifications as read for user ${userId}`, error },
        'NotificationService.markAllAsRead',
      );
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error updating notifications status.');
    }
  }

  /**
   * Soft deletes a specific notification for the given user.
   * @param notificationId - The ID of the notification to delete.
   * @param userId - The ID of the user who owns the notification.
   */
  async deleteNotification(notificationId: number, userId: number): Promise<void> {
    try {
      const notification = await this.notificationRepository.findById(notificationId);
      if (!notification) {
        throw new NotFoundError(`Notification with ID ${notificationId} not found.`);
      }
      if (notification.userId !== userId) {
        throw new ForbiddenError('You are not authorized to delete this notification.');
      }
      await this.notificationRepository.softDelete(notificationId, userId);
      logger.info(`Notification ${notificationId} soft-deleted for user ${userId}.`);
    } catch (error) {
      logger.error({ message: `Error soft-deleting notification ${notificationId}`, error });
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error soft-deleting notification.');
    }
  }

  /**
   * Soft deletes all notifications for the given user.
   * @param userId - The ID of the user.
   */
  async deleteAllNotifications(userId: number): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationRepository.softDeleteAllForUser(userId);
      const deletedCount = result.affected ?? 0;
      logger.info(`${deletedCount} notifications soft-deleted for user ${userId}.`);
      return { deletedCount };
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting all notifications for user ${userId}`, error },
        'NotificationService.deleteAllNotifications',
      );
      throw error instanceof NotFoundError ||
        error instanceof ForbiddenError ||
        error instanceof BadRequestError
        ? error
        : new ServerError('Error soft-deleting all notifications.');
    }
  }
}
