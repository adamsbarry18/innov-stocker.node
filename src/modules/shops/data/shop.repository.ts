import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { Shop } from '../models/shop.entity';
import { ServerError, BadRequestError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { CashRegister } from '@/modules/cash-registers/models/cash-register.entity';

interface FindAllShopsOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<Shop>;
  order?: FindManyOptions<Shop>['order'];
  relations?: string[];
}

export class ShopRepository {
  private readonly repository: Repository<Shop>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(Shop);
  }

  private getDefaultRelations(): string[] {
    return ['address', 'manager'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<Shop | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations ? this.getDefaultRelations() : options?.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding shop with id ${id}`, error },
        'ShopRepository.findById',
      );
      throw new ServerError(`Error finding shop with id ${id}.`);
    }
  }

  async findByName(name: string): Promise<Shop | null> {
    try {
      return await this.repository.findOne({ where: { name, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding shop by name '${name}'`, error },
        'ShopRepository.findByName',
      );
      throw new ServerError(`Error finding shop by name '${name}'.`);
    }
  }

  async findByCode(code: string): Promise<Shop | null> {
    if (!code) return null;
    try {
      return await this.repository.findOne({ where: { code, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding shop by code '${code}'`, error },
        'ShopRepository.findByCode',
      );
      throw new ServerError(`Error finding shop by code '${code}'.`);
    }
  }

  async findAll(options: FindAllShopsOptions = {}): Promise<{ shops: Shop[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<Shop> = {
        where,
        order: options.order ?? { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations ? this.getDefaultRelations() : options.relations,
      };
      const [shops, count] = await this.repository.findAndCount(findOptions);
      return { shops, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all shops`, error, options },
        'ShopRepository.findAll',
      );
      throw new ServerError(`Error finding all shops.`);
    }
  }

  create(dto: Partial<Shop>): Shop {
    return this.repository.create(dto);
  }

  async save(shop: Shop): Promise<Shop> {
    try {
      return await this.repository.save(shop);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_shop_name')) {
          throw new BadRequestError(`Shop with name '${shop.name}' already exists.`);
        }
        if (shop.code && error.message?.includes('uq_shop_code')) {
          throw new BadRequestError(`Shop with code '${shop.code}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving shop ${shop.id || shop.name}`, error },
        'ShopRepository.save',
      );
      throw new ServerError(`Error saving shop.`);
    }
  }

  async update(id: number, dto: Partial<Shop>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.name && error.message?.includes('uq_shop_name')) {
          throw new BadRequestError(
            `Cannot update: Shop with name '${dto.name}' may already exist.`,
          );
        }
        if (dto.code && error.message?.includes('uq_shop_code')) {
          throw new BadRequestError(
            `Cannot update: Shop with code '${dto.code}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating shop with id ${id}`, error },
        'ShopRepository.update',
      );
      throw new ServerError(`Error updating shop with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting shop with id ${id}`, error },
        'ShopRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting shop with id ${id}.`);
    }
  }

  async isShopInUse(shopId: number): Promise<boolean> {
    const cashRegisterRepo = this.repository.manager.getRepository(CashRegister);
    const crCount = await cashRegisterRepo.count({ where: { shopId } });
    return crCount > 0;
  }
}
