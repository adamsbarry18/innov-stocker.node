import { appDataSource } from '@/database/data-source';
import {
  NotFoundError,
  BadRequestError,
  ServerError,
  ForbiddenError,
} from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { InventorySessionRepository } from '../data/inventory-session.repository';
import { WarehouseRepository } from '@/modules/warehouses/data/warehouse.repository';
import { ShopRepository } from '@/modules/shops/data/shop.repository';
import { User, UserRepository } from '@/modules/users';

import {
  InventorySession,
  type CreateInventorySessionInput,
  type UpdateInventorySessionInput,
  type CompleteInventorySessionInput,
  type InventorySessionApiResponse,
  InventorySessionStatus,
  inventorySessionValidationInputErrors,
} from '../models/inventory-session.entity';
import dayjs from 'dayjs';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import { type EntityManager, type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';

let instance: InventorySessionService | null = null;

export class InventorySessionService {
  constructor(
    private readonly sessionRepository: InventorySessionRepository = new InventorySessionRepository(),
    private readonly warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    private readonly shopRepository: ShopRepository = new ShopRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  /**
   * Maps an InventorySession entity to an InventorySessionApiResponse.
   * @param session - The inventory session entity to map.
   * @param includeItems - Whether to include associated inventory items. Defaults to false.
   * @returns The API response for the inventory session, or null if the input session is null.
   */
  private mapToApiResponse(
    session: InventorySession | null,
    includeItems: boolean = false,
  ): InventorySessionApiResponse | null {
    if (!session) return null;
    return session.toApi(includeItems);
  }

  /**
   * Validates the location (warehouse or shop) for an inventory session.
   * Ensures that either a warehouseId or a shopId is provided, but not both, and that the provided ID exists.
   * @param input - An object containing either warehouseId or shopId.
   */
  private async validateSessionLocation(input: {
    warehouseId?: number | null;
    shopId?: number | null;
  }): Promise<void> {
    if (input.warehouseId && input.shopId) {
      throw new BadRequestError('Provide either warehouseId or shopId, not both.');
    }
    if (!input.warehouseId && !input.shopId) {
      throw new BadRequestError(
        'Either warehouseId or shopId must be provided for the inventory session.',
      );
    }
    if (input.warehouseId && !(await this.warehouseRepository.findById(input.warehouseId))) {
      throw new BadRequestError(`Warehouse with ID ${input.warehouseId} not found.`);
    }
    if (input.shopId && !(await this.shopRepository.findById(input.shopId))) {
      throw new BadRequestError(`Shop with ID ${input.shopId} not found.`);
    }
  }

  /**
   * Initiates a new inventory session.
   * Validates the session location and ensures no active session exists for the given location.
   * Creates and saves the new inventory session entity.
   * @param input - The data for creating the inventory session.
   * @param initiatedByUserId - The ID of the user initiating the session.
   * @returns The API response for the newly created inventory session.
   */
  async startInventorySession(
    input: CreateInventorySessionInput,
    initiatedByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    await this.validateSessionLocation(input);

    const existingActiveSession = await this.sessionRepository.findActiveSessionForLocation({
      warehouseId: input.warehouseId,
      shopId: input.shopId,
    });
    if (existingActiveSession) {
      logger.warn(
        `InventorySessionService.startInventorySession: An active session already exists for this location. ID: ${existingActiveSession.id}`,
      );
      throw new BadRequestError(
        `An active inventory session (ID: ${existingActiveSession.id}) already exists for this location.`,
      );
    }

    const user = await this.userRepository.findById(initiatedByUserId);
    if (!user) {
      logger.error(
        `InventorySessionService.startInventorySession: User ID ${initiatedByUserId} not found.`,
      );
      throw new BadRequestError(`User ID ${initiatedByUserId} not found.`);
    }

    const sessionEntity = this.sessionRepository.create({
      ...input,
      startDate: input.startDate ? dayjs(input.startDate).toDate() : new Date(),
      endDate: input.endDate ? dayjs(input.endDate).toDate() : null,
      status: InventorySessionStatus.IN_PROGRESS,
      createdByUserId: initiatedByUserId,
      updatedByUserId: initiatedByUserId,
    });

    if (!sessionEntity.isValid()) {
      logger.error(
        `InventorySessionService.startInventorySession: Invalid inventory session data: ${inventorySessionValidationInputErrors.join(', ')}`,
        { input },
      );
      throw new BadRequestError(
        `Inventory session data invalid: ${inventorySessionValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedSession = await this.sessionRepository.save(sessionEntity);

      const populatedSession = await this.sessionRepository.findById(savedSession.id);
      const apiResponse = this.mapToApiResponse(populatedSession);
      if (!apiResponse) {
        logger.error(
          `InventorySessionService.startInventorySession: Failed to map the newly created inventory session ${savedSession.id}.`,
        );
        throw new ServerError(`Failed to map newly created inventory session ${savedSession.id}.`);
      }
      logger.info(
        `Inventory session ID ${savedSession.id} started for ${input.warehouseId ? 'Warehouse ' + input.warehouseId : 'Shop ' + input.shopId} by user ${initiatedByUserId}.`,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.INVENTORY_AND_FLOW,
        savedSession.id.toString(),
        {
          id: savedSession.id,
          location: input.warehouseId ? 'Warehouse ' + input.warehouseId : 'Shop ' + input.shopId,
        },
      );

      return apiResponse;
    } catch (error) {
      logger.error({
        message: 'InventorySessionService.startInventorySession: Error starting inventory session',
        error,
        input,
      });
      throw new ServerError('Failed to start inventory session.');
    }
  }

  /**
   * Retrieves all inventory sessions based on provided options.
   * @param options - Optional parameters for filtering, pagination, and sorting.
   * @returns An object containing an array of inventory session API responses and the total count.
   */
  async findAllInventorySessions(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<InventorySession> | FindOptionsWhere<InventorySession>[];
    sort?: FindManyOptions<InventorySession>['order'];
  }): Promise<{ sessions: InventorySessionApiResponse[]; total: number }> {
    try {
      const { sessions, count } = await this.sessionRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { startDate: 'DESC' },
        relations: this.sessionRepository['getDefaultRelationsForFindAll'](),
      });
      const apiSessions = sessions
        .map((s) => this.mapToApiResponse(s, false))
        .filter(Boolean) as InventorySessionApiResponse[];
      return { sessions: apiSessions, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all inventory sessions`, error, options },
        'InventorySessionService.findAll',
      );
      throw new ServerError('Error finding all inventory sessions.');
    }
  }

  /**
   * Finds an inventory session by its ID.
   * @param sessionId - The ID of the inventory session to find.
   * @param includeItems - Whether to include associated inventory items in the response. Defaults to true.
   * @returns The API response for the found inventory session.
   */
  async findInventorySessionById(
    sessionId: number,
    includeItems: boolean = true,
  ): Promise<InventorySessionApiResponse> {
    const relations = includeItems
      ? this.sessionRepository['getDefaultRelationsForFindOne']()
      : this.sessionRepository['getDefaultRelationsForFindAll']();
    const session = await this.sessionRepository.findById(sessionId, { relations });
    if (!session) {
      logger.error(
        `InventorySessionService.findInventorySessionById: Inventory session with ID ${sessionId} not found.`,
      );
      throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);
    }
    return this.mapToApiResponse(session, includeItems) as InventorySessionApiResponse;
  }

  /**
   * Updates an existing inventory session.
   * Prevents updates to completed or cancelled sessions, and changes to warehouse/shop IDs.
   * Validates input and applies updates to the session.
   * @param sessionId - The ID of the inventory session to update.
   * @param input - The data for updating the inventory session.
   * @param updatedByUserId - The ID of the user performing the update.
   * @returns The API response for the updated inventory session.
   */
  async updateInventorySession(
    sessionId: number,
    input: UpdateInventorySessionInput,
    updatedByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      logger.error(
        `InventorySessionService.updateInventorySession: Inventory session ID ${sessionId} not found.`,
      );
      throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);
    }

    if (
      session.status === InventorySessionStatus.COMPLETED ||
      session.status === InventorySessionStatus.CANCELLED
    ) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Attempt to update a session with status '${session.status}'.`,
      );
      throw new ForbiddenError(`Cannot update a session that is already '${session.status}'.`);
    }

    if (input.warehouseId !== undefined && input.warehouseId !== session.warehouseId) {
      throw new BadRequestError('Warehouse ID cannot be changed after session creation.');
    }
    if (input.shopId !== undefined && input.shopId !== session.shopId) {
      throw new BadRequestError('Shop ID cannot be changed after session creation.');
    }

    if (input.startDate && session.status !== InventorySessionStatus.PENDING) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Attempt to modify start date for a non-PENDING session. Current status: ${session.status}`,
      );
      throw new BadRequestError('Start date can only be changed for PENDING sessions.');
    }
    if (input.status && !Object.values(InventorySessionStatus).includes(input.status)) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Invalid status provided: ${input.status}`,
      );
      throw new BadRequestError(`Invalid status provided: ${input.status}`);
    }
    if (input.status === InventorySessionStatus.COMPLETED) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Attempt to complete session via PUT. Use the dedicated endpoint.`,
      );
      throw new BadRequestError(`To complete a session, use the dedicated /complete endpoint.`);
    }

    const updatePayload: Partial<InventorySession> = { updatedByUserId };
    if (input.notes !== undefined) updatePayload.notes = input.notes;
    if (input.startDate) updatePayload.startDate = dayjs(input.startDate).toDate();
    if (input.endDate !== undefined)
      updatePayload.endDate = input.endDate ? dayjs(input.endDate).toDate() : null;
    if (input.status) updatePayload.status = input.status;

    const tempSession = this.sessionRepository.create({ ...session, ...updatePayload });
    if (!tempSession.isValid()) {
      logger.error(
        `InventorySessionService.updateInventorySession: Invalid updated session data: ${inventorySessionValidationInputErrors.join(',')}`,
        { updatePayload },
      );
      throw new BadRequestError(
        `Updated session data invalid: ${inventorySessionValidationInputErrors.join(',')}`,
      );
    }

    await this.sessionRepository.update(sessionId, updatePayload);

    const updatedSession = await this.sessionRepository.findById(sessionId);
    const apiResponse = this.mapToApiResponse(updatedSession);
    if (!apiResponse) {
      logger.error(
        `InventorySessionService.updateInventorySession: Failed to map updated session ${sessionId}.`,
      );
      throw new ServerError(`Failed to map updated session ${sessionId}.`);
    }

    await UserActivityLogService.getInstance().insertEntry(
      ActionType.UPDATE,
      EntityType.INVENTORY_AND_FLOW,
      sessionId.toString(),
      { updatedFields: Object.keys(input) },
    );

    return apiResponse;
  }

  /**
   * Completes an inventory session, calculates variances, and creates adjustment stock movements.
   * This operation is performed within a transaction to ensure data consistency.
   * @param sessionId - The ID of the inventory session to complete.
   * @param input - The data for completing the inventory session.
   * @param validatedByUserId - The ID of the user validating the completion.
   * @returns The API response for the completed inventory session.
   */
  async completeInventorySession(
    sessionId: number,
    input: CompleteInventorySessionInput,
    validatedByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const session = await this.getAndValidateSessionForCompletion(
        sessionId,
        transactionalEntityManager,
      );
      await this.validateUser(validatedByUserId, transactionalEntityManager);

      await this.processInventoryItemsAndAdjustStock(
        session,
        validatedByUserId,
        transactionalEntityManager,
      );

      await this.finalizeSessionStatus(
        session,
        input,
        validatedByUserId,
        transactionalEntityManager,
      );

      logger.info(
        `Inventory session ID ${sessionId} completed and validated by user ${validatedByUserId}.`,
      );

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.COMPLETE,
        EntityType.INVENTORY_AND_FLOW,
        sessionId.toString(),
        { id: session.id, status: session.status },
      );

      return this.getInventorySessionResponse(sessionId, transactionalEntityManager);
    });
  }

  /**
   * Retrieves an inventory session and validates it for completion.
   * Ensures the session exists and is in an 'IN_PROGRESS' status.
   * @param sessionId - The ID of the inventory session.
   * @param manager - The EntityManager for transactional operations.
   * @returns The validated InventorySession entity.
   */
  private async getAndValidateSessionForCompletion(
    sessionId: number,
    manager: EntityManager,
  ): Promise<InventorySession> {
    const sessionRepo = manager.getRepository(InventorySession);
    const session = await sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['items', 'items.product'],
    });
    if (!session) {
      logger.error(
        `InventorySessionService.getAndValidateSessionForCompletion: Inventory Session ID ${sessionId} not found.`,
      );
      throw new NotFoundError(`Inventory Session ID ${sessionId} not found.`);
    }
    if (session.status !== InventorySessionStatus.IN_PROGRESS) {
      logger.warn(
        `InventorySessionService.getAndValidateSessionForCompletion: Attempt to complete a session with invalid status: ${session.status}.`,
      );
      throw new BadRequestError(
        `Inventory session must be IN_PROGRESS to be completed. Current status: ${session.status}.`,
      );
    }
    return session;
  }

  /**
   * Validates if a user exists.
   * @param userId - The ID of the user to validate.
   * @param manager - Optional EntityManager for transactional operations.
   */
  private async validateUser(userId: number, manager?: EntityManager): Promise<void> {
    const user = manager
      ? await manager.getRepository(User).findOneBy({ id: userId })
      : await this.userRepository.findById(userId);
    if (!user) {
      logger.error(`InventorySessionService.validateUser: User with ID ${userId} not found.`);
      throw new BadRequestError(`User with ID ${userId} not found.`);
    }
  }

  /**
   * Processes inventory items, calculates variances, and creates stock adjustment movements.
   * @param session - The inventory session entity.
   * @param userId - The ID of the user performing the adjustments.
   * @param manager - The EntityManager for transactional operations.
   */
  private async processInventoryItemsAndAdjustStock(
    session: InventorySession,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    if (!session.items || session.items.length === 0) {
      logger.warn(
        `Inventory session ${session.id} is being completed without any items recorded. This will result in no stock adjustments.`,
      );
      return;
    }

    for (const item of session.items) {
      item.calculateVariance();
      await manager.save(item);

      if (item.varianceQuantity !== 0) {
        const movementType =
          item.varianceQuantity > 0
            ? StockMovementType.INVENTORY_ADJUSTMENT_IN
            : StockMovementType.INVENTORY_ADJUSTMENT_OUT;

        await this.stockMovementService.createMovement(
          {
            productId: item.productId,
            productVariantId: item.productVariantId,
            warehouseId: session.warehouseId,
            shopId: session.shopId,
            movementType: movementType,
            quantity: item.varianceQuantity,
            movementDate: new Date(),
            unitCostAtMovement: item.unitCostAtInventory,
            userId: userId,
            referenceDocumentType: 'inventory_session',
            referenceDocumentId: session.id.toString(),
            notes: `Inventory adjustment for session ${session.id}. Counted: ${item.countedQuantity}, Theoretical: ${item.theoreticalQuantity}.`,
          },
          manager,
        );
      }
    }
  }

  /**
   * Finalizes the status of an inventory session to 'COMPLETED'.
   * Updates the session's end date, validation user, and notes.
   * @param session - The inventory session entity to finalize.
   * @param input - The completion input data, potentially containing notes.
   * @param userId - The ID of the user finalizing the session.
   * @param manager - The EntityManager for transactional operations.
   */
  private async finalizeSessionStatus(
    session: InventorySession,
    input: CompleteInventorySessionInput,
    userId: number,
    manager: EntityManager,
  ): Promise<void> {
    session.status = InventorySessionStatus.COMPLETED;
    session.endDate = new Date();
    session.validatedByUserId = userId;
    session.updatedByUserId = userId;
    session.notes = input.notes
      ? session.notes
        ? `${session.notes}\nCompletion: ${input.notes}`
        : `Completion: ${input.notes}`
      : session.notes;

    if (!session.isValid()) {
      logger.error(
        `InventorySessionService.finalizeSessionStatus: Invalid session data after completion: ${inventorySessionValidationInputErrors.join(',')}`,
        { session },
      );
      throw new BadRequestError(
        `Session data invalid upon completion: ${inventorySessionValidationInputErrors.join(',')}`,
      );
    }
    await manager.save(session);
  }

  /**
   * Retrieves the API response for an inventory session after it has been populated.
   * @param sessionId - The ID of the inventory session.
   * @param manager - Optional EntityManager for transactional operations.
   * @returns The API response for the inventory session.
   */
  private async getInventorySessionResponse(
    sessionId: number,
    manager?: EntityManager,
  ): Promise<InventorySessionApiResponse> {
    let populatedSession;
    if (manager) {
      const sessionRepo = manager.getRepository(InventorySession);
      populatedSession = await sessionRepo.findOne({
        where: { id: sessionId },
        relations: this.sessionRepository['getDefaultRelationsForFindOne'](),
      });
    } else {
      populatedSession = await this.sessionRepository.findById(sessionId, {
        relations: this.sessionRepository['getDefaultRelationsForFindOne'](),
      });
    }
    const apiResponse = this.mapToApiResponse(populatedSession, true);
    if (!apiResponse) {
      logger.error(
        `InventorySessionService.getInventorySessionResponse: Failed to map inventory session ${sessionId}.`,
      );
      throw new ServerError(`Failed to map inventory session ${sessionId}.`);
    }
    return apiResponse;
  }

  // Delete for inventory sessions might mean CANCELLED if in PENDING/IN_PROGRESS
  // Or true soft-delete if business rules allow.
  // For now, a generic update can set to CANCELLED. A hard delete is not usually done.
  async cancelInventorySession(
    sessionId: number,
    cancelledByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError(`Inventory session ID ${sessionId} not found.`);
    if (session.status === InventorySessionStatus.COMPLETED) {
      throw new ForbiddenError('Cannot cancel a COMPLETED inventory session.');
    }
    if (session.status === InventorySessionStatus.CANCELLED) {
      return this.mapToApiResponse(session) as InventorySessionApiResponse;
    }
    session.status = InventorySessionStatus.CANCELLED;
    session.endDate = new Date();
    session.updatedByUserId = cancelledByUserId;
    // No stock movements generated for cancelled sessions.
    // If items were added, they remain but have no stock impact.

    await this.sessionRepository.save(session);

    await UserActivityLogService.getInstance().insertEntry(
      ActionType.CANCEL,
      EntityType.INVENTORY_AND_FLOW,
      sessionId.toString(),
      { id: session.id },
    );

    return this.mapToApiResponse(session) as InventorySessionApiResponse;
  }

  static getInstance(): InventorySessionService {
    instance ??= new InventorySessionService();

    return instance;
  }
}
