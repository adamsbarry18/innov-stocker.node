import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type EntityManager,
} from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { CashRegister } from '../models/cash-register.entity';
import { ServerError, BadRequestError, NotFoundError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllCashRegistersOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<CashRegister>;
  order?: FindManyOptions<CashRegister>['order'];
  relations?: string[];
}

export class CashRegisterRepository {
  private readonly repository: Repository<CashRegister>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(CashRegister);
  }

  private getDefaultRelations(): string[] {
    return ['shop', 'currency'];
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<CashRegister | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations:
          options?.relations === undefined ? this.getDefaultRelations() : options.relations,
      });
    } catch (error) {
      logger.error(
        { message: `Error finding cash register with id ${id}`, error },
        'CashRegisterRepository.findById',
      );
      throw new ServerError(`Error finding cash register with id ${id}.`);
    }
  }

  async findByName(name: string): Promise<CashRegister | null> {
    try {
      return await this.repository.findOne({ where: { name, deletedAt: IsNull() } });
    } catch (error) {
      logger.error(
        { message: `Error finding cash register by name '${name}'`, error },
        'CashRegisterRepository.findByName',
      );
      throw new ServerError(`Error finding cash register by name '${name}'.`);
    }
  }

  async findAll(
    options: FindAllCashRegistersOptions = {},
  ): Promise<{ registers: CashRegister[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<CashRegister> = {
        where,
        order: options.order || { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations === undefined ? this.getDefaultRelations() : options.relations,
      };
      const [registers, count] = await this.repository.findAndCount(findOptions);
      return { registers, count };
    } catch (error) {
      logger.error(
        { message: `Error finding all cash registers`, error, options },
        'CashRegisterRepository.findAll',
      );
      throw new ServerError(`Error finding all cash registers.`);
    }
  }

  create(dto: Partial<CashRegister>): CashRegister {
    return this.repository.create(dto);
  }

  async save(register: CashRegister): Promise<CashRegister> {
    try {
      // currentBalance is initialized to 0 by default or by input, then managed by sessions
      return await this.repository.save(register);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (error.message?.includes('uq_cash_register_name')) {
          throw new BadRequestError(`Cash register with name '${register.name}' already exists.`);
        }
      }
      logger.error(
        { message: `Error saving cash register ${register.id || register.name}`, error },
        'CashRegisterRepository.save',
      );
      throw new ServerError(`Error saving cash register.`);
    }
  }

  async update(id: number, dto: Partial<CashRegister>): Promise<UpdateResult> {
    try {
      // currentBalance should be updated via specific transaction services, not directly here.
      const { currentBalance, ...updateDto } = dto;
      if (currentBalance !== undefined) {
        logger.warn(
          `Attempted to update currentBalance directly for cash register ${id}. This should be handled by sessions/transactions.`,
        );
      }
      return await this.repository.update({ id, deletedAt: IsNull() }, updateDto);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
        if (dto.name && error.message?.includes('uq_cash_register_name')) {
          throw new BadRequestError(
            `Cannot update: Cash register with name '${dto.name}' may already exist.`,
          );
        }
      }
      logger.error(
        { message: `Error updating cash register with id ${id}`, error },
        'CashRegisterRepository.update',
      );
      throw new ServerError(`Error updating cash register with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // Dependency checks (e.g., active sessions, transactions) should be in the service layer.
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(
        { message: `Error soft-deleting cash register with id ${id}`, error },
        'CashRegisterRepository.softDelete',
      );
      throw new ServerError(`Error soft-deleting cash register with id ${id}.`);
    }
  }

  // TODO: Dépendance - Implémenter avec CashRegisterSessionRepository
  async isCashRegisterInUse(registerId: number): Promise<boolean> {
    logger.warn('CashRegisterRepository.isCashRegisterInUse is a placeholder.');
    // Example:
    // const sessionRepo = this.repository.manager.getRepository(CashRegisterSession);
    // const count = await sessionRepo.count({where: {cashRegisterId: registerId, status: 'open'}});
    // return count > 0;
    return false;
  }

  // Method to update currentBalance (should be used by cash register session/transaction services)
  async updateBalance(
    registerId: number,
    amountChange: number,
    manager: EntityManager,
  ): Promise<void> {
    try {
      const currentRegister = await manager.findOneBy(CashRegister, { id: registerId });
      if (!currentRegister) {
        throw new NotFoundError(`Cash register ${registerId} not found for balance update.`);
      }
      // Using direct assignment and save within transaction for more control if needed
      // Or use increment/decrement if appropriate for the logic.
      currentRegister.currentBalance =
        Number(currentRegister.currentBalance) + Number(amountChange);
      await manager.save(CashRegister, currentRegister);

      // Alternative using increment/decrement (simpler for pure additions/subtractions)
      // if (amountChange > 0) {
      //     await manager.increment(CashRegister, { id: registerId }, "currentBalance", amountChange);
      // } else if (amountChange < 0) {
      //     await manager.decrement(CashRegister, { id: registerId }, "currentBalance", Math.abs(amountChange));
      // }
    } catch (error) {
      logger.error(
        { message: `Error updating balance for cash register ${registerId}`, error, amountChange },
        'CashRegisterRepository.updateBalance',
      );
      throw new ServerError('Error updating cash register balance.');
    }
  }
}
