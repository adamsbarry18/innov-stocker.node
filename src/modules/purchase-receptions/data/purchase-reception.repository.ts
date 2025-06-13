import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import { PurchaseReception } from '../models/purchase-reception.entity';
import logger from '@/lib/logger';

interface FindAllReceptionsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<PurchaseReception> | FindOptionsWhere<PurchaseReception>[];
  order?: FindManyOptions<PurchaseReception>['order'];
  relations?: string[];
}

export class PurchaseReceptionRepository {
  private readonly repository: Repository<PurchaseReception>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(PurchaseReception);
  }

  private getDefaultRelationsForFindOne(): string[] {
    return [
      'supplier',
      'purchaseOrder',
      'warehouse',
      'shop',
      'receivedByUser',
      'items',
      'items.product',
      'items.productVariant',
      'items.purchaseOrderItem',
    ];
  }

  private getDefaultRelationsForFindAll(): string[] {
    return ['supplier', 'purchaseOrder', 'receivedByUser', 'warehouse', 'shop'];
  }

  async findById(
    id: number,
    options?: { relations?: string[] },
  ): Promise<PurchaseReception | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindOne() : options?.relations,
      });
    } catch (error) {
      throw new ServerError(`Error finding purchase reception with id ${id}.  ${error}`);
    }
  }

  async findByReceptionNumber(receptionNumber: string): Promise<PurchaseReception | null> {
    try {
      return await this.repository.findOne({
        where: { receptionNumber, deletedAt: IsNull() },
        relations: this.getDefaultRelationsForFindOne(),
      });
    } catch (error) {
      logger.error(
        { message: `Error finding reception by number '${receptionNumber}'`, error },
        'PurchaseReceptionRepository.findByReceptionNumber',
      );
      throw new ServerError(`Error finding reception by number '${receptionNumber}'.`);
    }
  }

  async findLastReceptionNumber(prefix: string): Promise<string | null> {
    try {
      const lastReception = await this.repository
        .createQueryBuilder('pr')
        .select('MAX(pr.receptionNumber)', 'maxReceptionNumber')
        .where('pr.receptionNumber LIKE :prefix', { prefix: `${prefix}%` })
        .getRawOne();
      return lastReception?.maxReceptionNumber || null;
    } catch (error) {
      logger.error({ message: 'Error fetching last reception number', error, prefix });
      throw new ServerError(`Could not fetch last reception number.  ${error}`);
    }
  }

  async findAll(
    options: FindAllReceptionsOptions = {},
  ): Promise<{ receptions: PurchaseReception[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const [receptions, count] = await this.repository.findAndCount({
        where,
        order: options.order ?? { createdAt: 'DESC' },
        skip: options.skip,
        take: options.take,
      });
      return { receptions, count };
    } catch (error) {
      throw new ServerError(`Error finding all purchase receptions.${error}`);
    }
  }

  async findByPurchaseOrderId(
    purchaseOrderId: number,
    options?: { relations?: string[] },
  ): Promise<PurchaseReception[]> {
    try {
      return await this.repository.find({
        where: { purchaseOrderId, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelationsForFindAll() : options?.relations,
        order: { receptionDate: 'ASC' },
      });
    } catch (error) {
      throw new ServerError(`Error finding receptions for PO. ${error}`);
    }
  }

  create(dto: Partial<PurchaseReception>): PurchaseReception {
    return this.repository.create(dto);
  }

  async save(reception: PurchaseReception): Promise<PurchaseReception> {
    try {
      return await this.repository.save(reception);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_pr_reception_number')) {
          throw new BadRequestError(
            `Purchase reception with number '${reception.receptionNumber}' already exists.`,
          );
        }
      }
      throw new ServerError(`Error saving purchase reception.`);
    }
  }

  async update(id: number, dto: Partial<PurchaseReception>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      throw new ServerError(`Error updating purchase reception with id ${id}. ${error}`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      throw new ServerError(`Error soft-deleting purchase reception with id ${id}.  ${error}`);
    }
  }

  /*TODO: Dépendance - Implémenter avec SupplierInvoiceRepository
  async isReceptionLinkedToInvoice(receptionId: number): Promise<boolean> {
    logger.warn('PurchaseReceptionRepository.isReceptionLinkedToInvoice is a placeholder.');
    // Example:
    // const supplierInvoiceItemRepo = this.repository.manager.getRepository(SupplierInvoiceItem);
    // const count = await supplierInvoiceItemRepo.count({where: {purchaseReceptionItemId: In(receptionItemIds)}}); // Needs receptionItemIds
    return false;
  }*/
}
