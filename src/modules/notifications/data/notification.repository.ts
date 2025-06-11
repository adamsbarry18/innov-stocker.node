import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  type FindManyOptions,
  type EntityManager,
  IsNull,
  type UpdateResult,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Notification } from '../models/notification.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllNotificationsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Notification> | FindOptionsWhere<Notification>[];
  order?: FindManyOptions<Notification>['order'];
}

export class NotificationRepository {
  private readonly repository: Repository<Notification>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Notification);
  }

  async findById(
    id: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<Notification | null> {
    try {
      const repo = transactionalEntityManager?.getRepository(Notification) ?? this.repository;
      return await repo.findOne({
        where: { id, deletedAt: IsNull() },
        relations: ['user'],
      });
    } catch (error) {
      logger.error({ message: `Error finding notification with id ${id}`, error });
      throw new ServerError(`Error finding notification with id ${id}.`);
    }
  }

  async findAllForUser(
    userId: number,
    options: FindAllNotificationsOptions = {},
  ): Promise<{ notifications: Notification[]; count: number }> {
    try {
      const where: FindOptionsWhere<Notification> | FindOptionsWhere<Notification>[] = options.where
        ? Array.isArray(options.where)
          ? options.where.map((w) => ({ ...w, userId, deletedAt: IsNull() }))
          : { ...options.where, userId, deletedAt: IsNull() }
        : { userId, deletedAt: IsNull() };

      const findOptions: FindManyOptions<Notification> = {
        where,
        order: options.order ?? { createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
        relations: ['user'], // Eager load user for toApi
      };
      const [notifications, count] = await this.repository.findAndCount(findOptions);
      return { notifications, count };
    } catch (error) {
      logger.error({ message: `Error finding notifications for user ${userId}`, error, options });
      throw new ServerError(`Error finding notifications for user ${userId}.`);
    }
  }

  async countUnreadForUser(userId: number): Promise<number> {
    try {
      return await this.repository.count({
        where: { userId, isRead: false, deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error({ message: `Error counting unread notifications for user ${userId}`, error });
      throw new ServerError('Error counting unread notifications.');
    }
  }

  create(dto: Partial<Notification>, transactionalEntityManager?: EntityManager): Notification {
    const repo = transactionalEntityManager?.getRepository(Notification) ?? this.repository;
    return repo.create(dto);
  }

  async save(
    notification: Notification,
    transactionalEntityManager?: EntityManager,
  ): Promise<Notification> {
    try {
      const repo = transactionalEntityManager?.getRepository(Notification) ?? this.repository;
      return await repo.save(notification);
    } catch (error: any) {
      logger.error({ message: `Error saving notification`, error, notification });
      throw new ServerError('Error saving notification.');
    }
  }

  async markAsRead(notificationId: number, userId: number): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id: notificationId, userId }, { isRead: true });
    } catch (error) {
      logger.error({ message: `Error marking notification ${notificationId} as read`, error });
      throw new ServerError('Error updating notification status.');
    }
  }

  async markAllAsReadForUser(userId: number): Promise<UpdateResult> {
    try {
      return await this.repository.update({ userId, isRead: false }, { isRead: true });
    } catch (error) {
      logger.error({
        message: `Error marking all notifications as read for user ${userId}`,
        error,
      });
      throw new ServerError('Error updating notifications status.');
    }
  }

  async softDelete(notificationId: number, userId: number): Promise<UpdateResult> {
    try {
      return await this.repository.update(
        { id: notificationId, userId, deletedAt: IsNull() },
        { deletedAt: new Date() },
      );
    } catch (error) {
      logger.error({ message: `Error soft-deleting notification ${notificationId}`, error });
      throw new ServerError('Error soft-deleting notification.');
    }
  }

  async softDeleteAllForUser(userId: number): Promise<UpdateResult> {
    try {
      return await this.repository.update(
        { userId, deletedAt: IsNull() },
        { deletedAt: new Date() },
      );
    } catch (error) {
      logger.error({
        message: `Error soft-deleting all notifications for user ${userId}`,
        error,
      });
      throw new ServerError('Error soft-deleting all notifications.');
    }
  }
}
