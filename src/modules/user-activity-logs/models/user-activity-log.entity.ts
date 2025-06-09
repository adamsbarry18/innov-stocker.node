import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { User, UserApiResponse } from '@/modules/users/models/users.entity';
import { Model } from '@/common/models/Model';

export enum ActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete', // Can be soft or hard delete
  APPROVE = 'approve', // e.g., Approve a Purchase Order
  CANCEL = 'cancel', // e.g., Cancel a Sales Order
  COMPLETE = 'complete', // e.g., Complete an inventory session
  SHIP = 'ship', // e.g., Ship a delivery
  RECEIVE = 'receive', // e.g., Receive a purchase
  VALIDATE = 'validate', // e.g., Validate a reception
  VIEW = 'view',
  // etc.
}

export enum EntityType {
  // Entités fondamentales de configuration et de données de base du système
  SYSTEM_CONFIGURATION = 'system_configuration',
  // Ex: company, currencies, addresses, payment_methods, bank_accounts

  // Entités liées à la gestion des utilisateurs internes et de leurs droits
  USER_AND_ACCESS = 'user_and_access',
  // Ex: users, roles, permissions, user_roles, role_permissions

  // Entités représentant des parties externes avec lesquelles le système interagit
  EXTERNAL_PARTY = 'external_party',
  // Ex: suppliers, customers, customer_groups, customer_shipping_addresses

  // Entités représentant des lieux physiques d'opération ou de stockage
  PHYSICAL_LOCATION = 'physical_location',
  // Ex: warehouses, shops

  // Entités définissant les articles, services ou ressources gérées par le système
  PRODUCT_MANAGEMENT = 'product_management',
  // Ex: products, product_categories, product_variants, product_images, composite_product_items, product_suppliers

  // Entités liées à la gestion des flux d'articles/ressources (entrées, sorties, mouvements internes)
  INVENTORY_AND_FLOW = 'inventory_and_flow',
  // Ex: stock_movements, inventory_sessions, inventory_session_items, stock_transfers, stock_transfer_items

  // Entités gérant le processus d'acquisition de biens ou services
  PROCUREMENT_PROCESS = 'procurement_process',
  // Ex: purchase_orders, purchase_order_items, purchase_receptions, purchase_reception_items, supplier_returns, supplier_return_items

  // Entités gérant le processus de vente et de distribution de biens ou services
  SALES_AND_DISTRIBUTION = 'sales_and_distribution',
  // Ex: quotes, quote_items, sales_orders, sales_order_items, deliveries, delivery_items, customer_returns, customer_return_items

  // Entités représentant des transactions financières ou comptables
  FINANCIAL_TRANSACTION = 'financial_transaction',
  // Ex: supplier_invoices, supplier_invoice_items, customer_invoices, customer_invoice_items, payments, cash_registers, cash_register_sessions, cash_register_transactions

  // Entités de support pour l'audit et la communication du système
  SYSTEM_UTILITY = 'system_utility',
  // Ex: user_activity_logs, notifications
}

export const createUserActivityLogSchema = z.object({
  userId: z.number().int().positive(),
  actionType: z.nativeEnum(ActionType),
  entityType: z.nativeEnum(EntityType),
  entityId: z.string().max(100).nullable().optional(),
  details: z.record(z.string(), z.any()).nullable().optional(),
  ipAddress: z.string().ip().nullable().optional(),
});

export type CreateUserActivityLogInput = z.infer<typeof createUserActivityLogSchema>;

export type UserActivityLogApiResponse = {
  id: number;
  userId: number;
  user?: UserApiResponse | null;
  actionType: ActionType;
  entityType: EntityType;
  entityId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  timestamp: string | null;
};

@Entity({ name: 'user_activity_logs' })
@Index(['userId', 'timestamp'])
@Index(['entityType', 'entityId'])
export class UserActivityLog {
  @Column({ type: 'bigint', primary: true, generated: 'increment' })
  id!: number;

  @Column({ type: 'int', name: 'user_id', nullable: true })
  userId!: number;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'action_type',
    enum: ActionType,
  })
  actionType!: ActionType;

  @Column({ type: 'varchar', length: 100, name: 'entity_type', nullable: true, enum: EntityType })
  entityType!: EntityType;

  @Column({ type: 'varchar', length: 100, name: 'entity_id', nullable: true })
  entityId: string | null = null;

  @Column({ type: 'json', nullable: true })
  details: Record<string, any> | null = null;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string | null = null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'timestamp',
  })
  timestamp!: Date;

  toApi(): UserActivityLogApiResponse {
    return {
      id: this.id,
      userId: this.userId,
      user: this.user ? this.user.toApi() : null,
      actionType: this.actionType,
      entityType: this.entityType,
      entityId: this.entityId,
      details: this.details,
      ipAddress: this.ipAddress,
      timestamp: Model.formatISODate(this.timestamp),
    };
  }
}
