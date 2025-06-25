import { Model } from '@/common/models/Model';
import { User } from '@/modules/users';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  APPROVAL_REQUEST = 'approval_request',
}

export const createNotificationSchema = z.object({
  userId: z.number().int().positive({ message: 'User ID is required.' }),
  message: z.string().min(1, { message: 'Notification message is required.' }).max(1000),
  type: z.nativeEnum(NotificationType).default(NotificationType.INFO),
  isRead: z.boolean().default(false),
  entityType: z.string().max(100).nullable().optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export type NotificationApiResponse = {
  id: number;
  userId: number;
  message: string;
  type: NotificationType;
  isRead: boolean;
  entityType: string | null;
  entityId: string | number | null;
  link?: string | null;
  createdAt: string | null;
};

@Entity({ name: 'notifications' })
@Index(['userId', 'isRead', 'createdAt'])
export class Notification extends Model {
  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 1000 })
  message!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type!: NotificationType;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead: boolean = false;

  @Column({ type: 'varchar', length: 100, name: 'entity_type', nullable: true })
  entityType: string | null = null;

  @Column({ type: 'varchar', length: 100, name: 'entity_id', nullable: true })
  entityId: string | number | null = null;

  toApi(): NotificationApiResponse {
    const base = super.toApi();

    let link: string | null = null;
    if (this.entityType && this.entityId) {
      link = `/${this.entityType}/${this.entityId}`;
    }

    return {
      ...base,
      id: this.id,
      userId: this.userId,
      message: this.message,
      type: this.type,
      isRead: this.isRead,
      entityType: this.entityType,
      entityId: this.entityId,
      link: link,
      createdAt: Model.formatISODate(this.createdAt),
    };
  }
}
