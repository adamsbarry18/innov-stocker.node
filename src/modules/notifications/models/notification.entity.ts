import { Model } from '@/common/models/Model';
import { User } from '@/modules/users';
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';

// Catégories de notifications pour le filtrage côté client
export enum NotificationType {
  INFO = 'INFO',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  APPROVAL_REQUEST = 'approval_request',
}

// Zod Schema for input DTOs (used internally by the NotificationService)
export const createNotificationSchema = z.object({
  userId: z.number().int().positive({ message: 'User ID is required.' }),
  message: z.string().min(1, { message: 'Notification message is required.' }).max(1000),
  type: z.nativeEnum(NotificationType).default(NotificationType.INFO),
  isRead: z.boolean().default(false),
  entityType: z.string().max(100).nullable().optional(),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
// Les notifications ne sont généralement pas modifiables, sauf leur statut 'isRead'.

export type NotificationApiResponse = {
  id: number;
  userId: number;
  message: string;
  type: NotificationType;
  isRead: boolean;
  entityType: string | null;
  entityId: string | number | null;
  // Link to navigate to in the frontend
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
    type: 'varchar',
    length: 30,
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

    // Construct a frontend link based on the entity type and ID
    let link: string | null = null;
    if (this.entityType && this.entityId) {
      // This mapping is an example and should be aligned with your frontend routing structure
      //const entityPath = `${this.entityType.toLowerCase().replace(/_/g, '-')}-s`; // e.g., 'sales_order' -> 'sales-orders'
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
