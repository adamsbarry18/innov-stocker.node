import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { z } from 'zod';
import { Model } from '@/common/models/Model';
import { User, UserApiResponse } from '@/modules/users';

export enum ImportEntityType {
  PRODUCT = 'product',
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
  PRODUCT_CATEGORY = 'product_category',
  OPENING_STOCK = 'opening_stock',
  SALES_ORDER = 'sales_order',
  PURCHASE_ORDER = 'purchase_order',
}

export enum ImportStatus {
  PENDING = 'pending', // En attente de traitement
  PROCESSING = 'processing', // Traitement en cours par un worker
  COMPLETED = 'completed', // Terminé avec succès (peut avoir des erreurs partielles)
  FAILED = 'failed', // Échec critique du traitement
}

export const createImportBatchSchema = z.object({
  entityType: z.nativeEnum(ImportEntityType),
  originalFileName: z.string().max(255).optional(),
});

export type CreateImportBatchInput = z.infer<typeof createImportBatchSchema>;

export type ImportSummary = {
  totalRows: number;
  successfullyImported: number;
  failedRowsCount: number;
};

export type FailedRowDetail = {
  row: number;
  data: any;
  error: string;
};

export type ImportBatchApiResponse = {
  id: number;
  entityType: ImportEntityType;
  status: ImportStatus;
  summary: ImportSummary | null;
  errorDetails: FailedRowDetail[] | null;
  criticalError: string | null;
  originalFileName: string | null;
  createdByUser?: UserApiResponse | null;
  createdAt: string | null;
  updatedAt: string | null;
};

@Entity({ name: 'import_batches' })
export class ImportBatch extends Model {
  @Column({
    type: 'varchar',
    length: 50,
    name: 'entity_type',
  })
  entityType!: ImportEntityType;

  @Column({
    type: 'varchar',
    length: 30,
    default: '',
  })
  status: ImportStatus = ImportStatus.PENDING;

  @Column({ type: 'json', name: 'summary', nullable: true })
  summary: ImportSummary | null = null;

  @Column({ type: 'json', name: 'error_details', nullable: true })
  errorDetails: FailedRowDetail[] | null = null;

  @Column({ type: 'text', name: 'critical_error', nullable: true })
  criticalError: string | null = null;

  @Column({ type: 'json' })
  payload!: any[];

  @Column({ type: 'varchar', length: 255, name: 'original_file_name', nullable: true })
  originalFileName: string | null = null;

  @Column({ type: 'int', name: 'created_by_user_id' })
  createdByUserId!: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @Column({ type: 'int', nullable: true, name: 'updated_by_user_id' })
  updatedByUserId: number | null = null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser?: User | null;

  toApi(): ImportBatchApiResponse {
    const base = super.toApi();
    return {
      ...base,
      id: this.id,
      entityType: this.entityType,
      status: this.status,
      summary: this.summary,
      errorDetails: this.errorDetails,
      criticalError: this.criticalError,
      originalFileName: this.originalFileName,
      createdByUser: this.createdByUser ? this.createdByUser.toApi() : null,
      createdAt: Model.formatISODate(this.createdAt),
      updatedAt: Model.formatISODate(this.updatedAt),
    };
  }
}
