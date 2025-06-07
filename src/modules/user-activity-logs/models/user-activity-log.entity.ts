import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { ActionType, User, UserApiResponse } from '@/modules/users/models/users.entity';

// List of standard actions for consistency. Can be extended.
/*export enum ActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  APPROVE = 'approve', // e.g., Approve a Purchase Order
  CANCEL = 'cancel', // e.g., Cancel a Sales Order
  COMPLETE = 'complete', // e.g., Complete an inventory session
  SHIP = 'ship', // e.g., Ship a delivery
  RECEIVE = 'receive', // e.g., Receive a purchase
  VALIDATE = 'validate', // e.g., Validate a reception
  // etc.
}*/

export const createUserActivityLogSchema = z.object({
  userId: z.number().int().positive(),
  action: z.nativeEnum(ActionType),
  entityType: z.string().min(1, { message: 'Entity type is required.' }).max(100),
  entityId: z.union([z.string(), z.number()]).nullable().optional(),
  details: z.record(z.string(), z.any()).nullable().optional(),
  ipAddress: z.string().ip().nullable().optional(),
});

export type CreateUserActivityLogInput = z.infer<typeof createUserActivityLogSchema>;

export type UserActivityLogApiResponse = {
  id: number;
  userId: number;
  user?: UserApiResponse | null;
  action: ActionType;
  entityType: string;
  entityId: string | number | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string | null;
};

@Entity({ name: 'user_activity_logs' })
@Index(['userId', 'action', 'entityType'])
@Index(['entityType', 'entityId'])
export class UserActivityLog extends Model {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id!: number;

  @Column({ type: 'int', name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ActionType,
  })
  action!: ActionType;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_id', nullable: true })
  entityId: string | number | null = null;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any> | null = null;

  @Column({ type: 'varchar', length: 50, name: 'ip_address', nullable: true })
  ipAddress: string | null = null;

  toApi(): UserActivityLogApiResponse {
    return {
      id: this.id,
      userId: this.userId,
      user: this.user ? this.user.toApi() : null,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      details: this.details,
      ipAddress: this.ipAddress,
      createdAt: Model.formatISODate(this.createdAt),
    };
  }
}
