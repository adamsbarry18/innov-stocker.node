import { UserActivityLogRepository } from '../data/user-activity-log.repository';
import { UserRepository } from '@/modules/users/data/users.repository';
import {
  UserActivityLog,
  type CreateUserActivityLogInput,
  type UserActivityLogApiResponse,
  createUserActivityLogSchema,
} from '../models/user-activity-log.entity';
import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';

let instance: UserActivityLogService | null = null;

export class UserActivityLogService {
  constructor(
    private readonly logRepository: UserActivityLogRepository = new UserActivityLogRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
  ) {}

  static getInstance(): UserActivityLogService {
    instance ??= new UserActivityLogService();
    return instance;
  }

  private mapToApiResponse(log: UserActivityLog | null): UserActivityLogApiResponse | null {
    if (!log) return null;
    return log.toApi();
  }

  /**
   * Logs a user action. This is the primary method to be called by other services.
   * Can be executed within an existing transaction by passing the entityManager.
   * @param input - The data for the log entry.
   * @param transactionalEntityManager - Optional. The EntityManager from an ongoing transaction.
   * @returns The saved log entity.
   */
  async logAction(
    input: CreateUserActivityLogInput,
    transactionalEntityManager?: EntityManager,
  ): Promise<UserActivityLog> {
    const validationResult = createUserActivityLogSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      // In a real-world scenario, a logging failure should probably not fail the main transaction.
      // We'll log the error and continue, rather than throwing a BadRequestError.
      logger.error({ message: 'Invalid data passed to logAction', errors, input });
      throw new BadRequestError(`Invalid log data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    // The user should already be validated by the calling service.
    // A quick check can be done here for robustness.
    if (!(await this.userRepository.findById(validatedInput.userId))) {
      logger.error(`Attempted to log action for non-existent user ID: ${validatedInput.userId}`);
      throw new BadRequestError(
        `Attempted to log action for non-existent user ID: ${validatedInput.userId}`,
      );
    }

    const logEntity = this.logRepository.create(validatedInput, transactionalEntityManager);

    try {
      const savedLog = await this.logRepository.save(logEntity, transactionalEntityManager);
      logger.info(
        `User action logged: { userId: ${savedLog.userId}, actionType: ${savedLog.actionType}, entityType: ${savedLog.entityType}, entityId: ${savedLog.entityId} }`,
      );
      return savedLog;
    } catch (error) {
      logger.error({ message: 'Failed to save user activity log', error, logData: logEntity });
      return new UserActivityLog();
    }
  }

  /**
   * Retrieves a single log entry by its ID.
   * @param id - The ID of the log entry.
   * @returns The log entry API response.
   */
  async findLogById(id: number): Promise<UserActivityLogApiResponse> {
    try {
      const log = await this.logRepository.findById(id);
      if (!log) throw new NotFoundError(`Activity log with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(log);
      if (!apiResponse) throw new ServerError(`Failed to map activity log ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding activity log by id ${id}`, error },
        'UserActivityLogService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding activity log by id ${id}.`);
    }
  }

  /**
   * Retrieves all user activity logs with pagination and filtering.
   * @param options - Filtering, sorting, and pagination options.
   * @returns A paginated list of log entries.
   */
  async findAllLogs(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<UserActivityLog> | FindOptionsWhere<UserActivityLog>[];
    sort?: FindManyOptions<UserActivityLog>['order'];
  }): Promise<{ logs: UserActivityLogApiResponse[]; total: number }> {
    try {
      const { logs, count } = await this.logRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { timestamp: 'DESC' },
        relations: ['user'],
      });
      const apiLogs = logs
        .map((log) => this.mapToApiResponse(log))
        .filter(Boolean) as UserActivityLogApiResponse[];
      return { logs: apiLogs, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all activity logs`, error, options },
        'UserActivityLogService.findAll',
      );
      throw new ServerError('Error finding all activity logs.');
    }
  }
}
