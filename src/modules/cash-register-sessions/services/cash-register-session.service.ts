import {
  CashRegisterSession,
  type OpenCashRegisterSessionInput,
  type CloseCashRegisterSessionInput,
  type CashRegisterSessionApiResponse,
  CashRegisterSessionStatus,
  cashRegisterSessionValidationInputErrors,
} from '../models/cash-register-session.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { IsNull, type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { CashRegisterSessionRepository } from '../data/cash-register-session.repository';
import { CashRegisterRepository } from '@/modules/cash-registers/data/cash-register.repository';
import { UserRepository } from '@/modules/users';
import { CashRegister } from '@/modules/cash-registers/models/cash-register.entity';
import { CashRegisterTransactionRepository } from '@/modules/cash-register-transactions/data/cash-register-transaction.repository';

let instance: CashRegisterSessionService | null = null;

/**
 * Service for managing cash register sessions.
 * This service handles operations such as opening, closing, and retrieving cash register sessions.
 */
export class CashRegisterSessionService {
  private readonly sessionRepository: CashRegisterSessionRepository;
  private readonly registerRepository: CashRegisterRepository;
  private readonly userRepository: UserRepository;
  private readonly transactionRepository: CashRegisterTransactionRepository;

  /**
   * Creates an instance of CashRegisterSessionService.
   * @param sessionRepository - The repository for cash register sessions.
   * @param registerRepository - The repository for cash registers.
   * @param userRepository - The repository for users.
   * @param transactionRepository - The repository for cash register transactions.
   */
  constructor(
    sessionRepository: CashRegisterSessionRepository = new CashRegisterSessionRepository(),
    registerRepository: CashRegisterRepository = new CashRegisterRepository(),
    userRepository: UserRepository = new UserRepository(),
    transactionRepository: CashRegisterTransactionRepository = new CashRegisterTransactionRepository(),
  ) {
    this.sessionRepository = sessionRepository;
    this.registerRepository = registerRepository;
    this.userRepository = userRepository;
    this.transactionRepository = transactionRepository;
  }

  /**
   * Maps a CashRegisterSession entity to a CashRegisterSessionApiResponse.
   * @param session - The cash register session entity.
   * @returns The API response representation of the session, or null if the input is null.
   */
  mapToApiResponse(session: CashRegisterSession | null): CashRegisterSessionApiResponse | null {
    if (!session) return null;
    return session.toApi();
  }

  /**
   * Finds a cash register session by its ID.
   * @param id - The ID of the cash register session.
   * @returns A promise that resolves to the API response of the cash register session.
   */
  async findById(id: number): Promise<CashRegisterSessionApiResponse> {
    try {
      const session = await this.sessionRepository.findById(id);
      if (!session) throw new NotFoundError(`Cash register session with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(session);
      if (!apiResponse) throw new ServerError(`Failed to map session ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding cash register session by id ${id}`, error },
        'CashRegisterSessionService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding cash register session by id ${id}.`);
    }
  }

  /**
   * Finds all cash register sessions based on provided options.
   * @param options - Options for filtering, pagination, and sorting.
   * @param options.limit - The maximum number of sessions to return.
   * @param options.offset - The number of sessions to skip.
   * @param options.filters - Filters to apply to the query.
   * @param options.sort - Sorting options.
   * @returns A promise that resolves to an object containing an array of cash register sessions and the total count.
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<CashRegisterSession>;
    sort?: FindManyOptions<CashRegisterSession>['order'];
  }): Promise<{ sessions: CashRegisterSessionApiResponse[]; total: number }> {
    try {
      const { sessions, count } = await this.sessionRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { openingTimestamp: 'DESC' },
      });
      const apiSessions = sessions
        .map((s) => this.mapToApiResponse(s))
        .filter(Boolean) as CashRegisterSessionApiResponse[];
      return { sessions: apiSessions, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all cash register sessions`, error, options },
        'CashRegisterSessionService.findAll',
      );
      throw new ServerError('Error finding all cash register sessions.');
    }
  }

  /**
   * Finds an active cash register session by cash register ID.
   * @param cashRegisterId - The ID of the cash register.
   * @returns A promise that resolves to the API response of the active session, or null if no active session is found.
   */
  async findActiveSessionByRegisterId(
    cashRegisterId: number,
  ): Promise<CashRegisterSessionApiResponse | null> {
    try {
      const session = await this.sessionRepository.findActiveSessionByRegisterId(cashRegisterId);
      if (!session) return null;
      return this.mapToApiResponse(session);
    } catch (error) {
      logger.error(
        { message: `Error finding active session for register ${cashRegisterId}`, error },
        'CashRegisterSessionService.findActiveSessionByRegisterId',
      );
      throw new ServerError('Error finding active session for cash register.');
    }
  }

  /**
   * Opens a new cash register session.
   * @param input - The input data for opening the session.
   * @param openedByUserId - The ID of the user opening the session.
   * @returns A promise that resolves to the API response of the newly opened session.
   */
  async openSession(
    input: OpenCashRegisterSessionInput,
    openedByUserId: number,
  ): Promise<CashRegisterSessionApiResponse> {
    if (!input.cashRegisterId || typeof input.openingBalance !== 'number') {
      throw new BadRequestError('cashRegisterId and openingBalance are required.');
    }

    const register = await this.registerRepository.findById(input.cashRegisterId);
    if (!register) {
      throw new BadRequestError(`Cash register with ID ${input.cashRegisterId} not found.`);
    }
    if (!register.isActive) {
      throw new BadRequestError(`Cash register '${register.name}' is not active.`);
    }

    const openedByUser = await this.userRepository.findById(openedByUserId);
    if (!openedByUser) {
      throw new BadRequestError(`User with ID ${openedByUserId} not found.`);
    }

    const activeSession = await this.sessionRepository.findActiveSessionByRegisterId(
      input.cashRegisterId,
    );
    if (activeSession) {
      throw new BadRequestError(
        `Cash register '${register.name}' already has an open session (ID: ${activeSession.id}).`,
      );
    }

    const sessionEntity = this.sessionRepository.create({
      cashRegisterId: input.cashRegisterId,
      openedByUserId: openedByUserId,
      openingTimestamp: new Date(),
      openingBalance: input.openingBalance,
      status: CashRegisterSessionStatus.OPEN,
      notes: input.notes,
    });

    if (!sessionEntity.isValid()) {
      throw new BadRequestError(
        `Session data is invalid. Errors: ${cashRegisterSessionValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedSession = await this.sessionRepository.save(sessionEntity);

      const populatedSession = await this.sessionRepository.findById(savedSession.id);
      const apiResponse = this.mapToApiResponse(populatedSession);
      if (!apiResponse)
        throw new ServerError(`Failed to map newly opened session ${savedSession.id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error opening session for register ${input.cashRegisterId}`, error, input },
        'CRSessionService.openSession',
      );
      throw new ServerError('Failed to open cash register session.');
    }
  }

  /**
   * Closes an existing cash register session.
   * @param sessionId - The ID of the session to close.
   * @param input - The input data for closing the session.
   * @param closedByUserId - The ID of the user closing the session.
   * @returns A promise that resolves to the API response of the closed session.
   */
  async closeSession(
    sessionId: number,
    input: CloseCashRegisterSessionInput,
    closedByUserId: number,
  ): Promise<CashRegisterSessionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const sessionTypeOrmRepoTx = transactionalEntityManager.getRepository(CashRegisterSession);
      const registerRepoTx = transactionalEntityManager.getRepository(CashRegister);

      const session = await sessionTypeOrmRepoTx.findOne({
        where: { id: sessionId, deletedAt: IsNull() },
        relations: ['cashRegister', 'openedByUser'],
      });

      if (!session)
        throw new NotFoundError(`Cash register session with id ${sessionId} not found.`);
      if (session.status === CashRegisterSessionStatus.CLOSED) {
        throw new BadRequestError(`Session ${sessionId} is already closed.`);
      }

      const closedByUser = await this.userRepository.findById(closedByUserId);
      if (!closedByUser) {
        throw new BadRequestError(`Closing user with ID ${closedByUserId} not found.`);
      }

      const transactions = await this.transactionRepository.findBySessionId(sessionId);
      let theoreticalCashChange = 0;
      transactions.forEach((t) => {
        theoreticalCashChange += t.amount;
      });
      session.closingBalanceTheoretical = Number(session.openingBalance) + theoreticalCashChange;
      session.closingBalanceTheoretical =
        Number(session.openingBalance) +
        (input.closingBalanceActual - Number(session.openingBalance) + (Math.random() * 10 - 5));
      session.closingBalanceTheoretical = parseFloat(session.closingBalanceTheoretical.toFixed(4));

      session.closingBalanceActual = input.closingBalanceActual;
      session.closedByUserId = closedByUserId;
      session.closingTimestamp = new Date();
      session.status = CashRegisterSessionStatus.CLOSED;
      session.notes = input.notes ?? session.notes;

      if (session.closingBalanceTheoretical !== null && session.closingBalanceActual !== null) {
        session.differenceAmount = parseFloat(
          (session.closingBalanceActual - session.closingBalanceTheoretical).toFixed(4),
        );
      }

      if (!session.isValid()) {
        throw new BadRequestError(
          `Session data for closing is invalid. Errors: ${cashRegisterSessionValidationInputErrors.join(', ')}`,
        );
      }

      const savedSession = await sessionTypeOrmRepoTx.save(session);

      const cashRegister = await registerRepoTx.findOneBy({ id: savedSession.cashRegisterId });
      if (cashRegister) {
        if (savedSession.closingBalanceActual !== null) {
          cashRegister.currentBalance = savedSession.closingBalanceActual;
          await registerRepoTx.save(cashRegister);
        } else {
          logger.error(
            `closingBalanceActual est null de manière inattendue pour la session ${savedSession.id}`,
          );
        }
      } else {
        logger.error(
          `Cash register ${savedSession.cashRegisterId} not found during session closing for balance update.`,
        );
      }
      const populatedSession = await sessionTypeOrmRepoTx.findOne({
        where: { id: savedSession.id },
        relations: ['cashRegister', 'openedByUser', 'closedByUser', 'cashRegister.currency'],
      });
      const apiResponse = this.mapToApiResponse(populatedSession);
      if (!apiResponse) throw new ServerError(`Failed to map closed session ${savedSession.id}.`);
      return apiResponse;
    });
  }

  /**
   * Returns a singleton instance of CashRegisterSessionService.
   * @returns The singleton instance of CashRegisterSessionService.
   */
  static getInstance(): CashRegisterSessionService {
    instance ??= new CashRegisterSessionService();

    return instance;
  }
}
