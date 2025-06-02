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
import { UserRepository } from '@/modules/users/data/users.repository';

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
import { InventorySessionItemRepository } from '../inventory-session-items/data/inventory-session-item.repository';
import { StockMovementService } from '@/modules/stock-movements/services/stock-movement.service';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { StockMovementType } from '@/modules/stock-movements/models/stock-movement.entity';

let instance: InventorySessionService | null = null;

export class InventorySessionService {
  constructor(
    private readonly sessionRepository: InventorySessionRepository = new InventorySessionRepository(),
    private readonly itemRepository: InventorySessionItemRepository = new InventorySessionItemRepository(),
    private readonly warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    private readonly shopRepository: ShopRepository = new ShopRepository(),
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
  ) {}

  private mapToApiResponse(
    session: InventorySession | null,
    includeItems: boolean = false,
  ): InventorySessionApiResponse | null {
    if (!session) return null;
    return session.toApi(includeItems);
  }

  private async validateSessionLocation(input: {
    warehouseId?: number | null;
    shopId?: number | null;
  }): Promise<void> {
    if (input.warehouseId) {
      if (!(await this.warehouseRepository.findById(input.warehouseId))) {
        throw new BadRequestError(`Warehouse with ID ${input.warehouseId} not found.`);
      }
    }
    if (input.shopId) {
      if (!(await this.shopRepository.findById(input.shopId))) {
        throw new BadRequestError(`Shop with ID ${input.shopId} not found.`);
      }
    }
    if (!input.warehouseId && !input.shopId) {
      throw new BadRequestError(
        'Either warehouseId or shopId must be provided for the inventory session.',
      );
    }
    if (input.warehouseId && input.shopId) {
      throw new BadRequestError('Provide either warehouseId or shopId, not both.');
    }
  }

  async startInventorySession(
    input: CreateInventorySessionInput,
    createdByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    await this.validateSessionLocation(input);

    const existingActiveSession = await this.sessionRepository.findActiveSessionForLocation({
      warehouseId: input.warehouseId,
      shopId: input.shopId,
    });
    if (existingActiveSession) {
      logger.warn(
        `InventorySessionService.startInventorySession: Session active existante trouvée pour l'emplacement. ID: ${existingActiveSession.id}`,
      );
      throw new BadRequestError(
        `An active inventory session (ID: ${existingActiveSession.id}) already exists for this location.`,
      );
    }

    const user = await this.userRepository.findById(createdByUserId);
    if (!user) {
      logger.error(
        `InventorySessionService.startInventorySession: Utilisateur ID ${createdByUserId} non trouvé.`,
      );
      throw new BadRequestError(`User ID ${createdByUserId} not found.`);
    }

    const sessionEntity = this.sessionRepository.create({
      ...input,
      startDate: input.startDate ? dayjs(input.startDate).toDate() : new Date(),
      endDate: input.endDate ? dayjs(input.endDate).toDate() : null,
      status: InventorySessionStatus.IN_PROGRESS,
      createdByUserId: createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!sessionEntity.isValid()) {
      logger.error(
        `InventorySessionService.startInventorySession: Données de session d'inventaire invalides: ${inventorySessionValidationInputErrors.join(', ')}`,
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
          `InventorySessionService.startInventorySession: Échec du mappage de la nouvelle session d'inventaire créée ${savedSession.id}.`,
        );
        throw new ServerError(`Failed to map newly created inventory session ${savedSession.id}.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error({
        message:
          "InventorySessionService.startInventorySession: Erreur lors du démarrage de la session d'inventaire",
        error,
        input,
      });
      throw new ServerError('Failed to start inventory session.');
    }
  }

  async findInventorySessionById(
    sessionId: number,
    includeItems: boolean = false,
  ): Promise<InventorySessionApiResponse> {
    try {
      const relations = includeItems
        ? this.sessionRepository['getDefaultRelationsForFindOne']()
        : this.sessionRepository['getDefaultRelationsForFindAll']();
      const session = await this.sessionRepository.findById(sessionId, { relations });
      if (!session) throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);

      const apiResponse = this.mapToApiResponse(session, includeItems);
      if (!apiResponse) throw new ServerError(`Failed to map inventory session ${sessionId}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding inventory session by id ${sessionId}`, error },
        'InventorySessionService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding inventory session by id ${sessionId}.`);
    }
  }

  async findAllInventorySessions(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<InventorySession> | FindOptionsWhere<InventorySession>[];
    sort?: FindManyOptions<InventorySession>['order'];
    searchTerm?: string;
  }): Promise<{ sessions: InventorySessionApiResponse[]; total: number }> {
    try {
      const { sessions, count } = await this.sessionRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { startDate: 'DESC' },
        searchTerm: options?.searchTerm,
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

  async updateInventorySession(
    sessionId: number,
    input: UpdateInventorySessionInput,
    updatedByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      logger.error(
        `InventorySessionService.updateInventorySession: Session d'inventaire ID ${sessionId} non trouvée.`,
      );
      throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);
    }

    if (
      session.status === InventorySessionStatus.COMPLETED ||
      session.status === InventorySessionStatus.CANCELLED
    ) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Tentative de mise à jour d'une session avec le statut '${session.status}'.`,
      );
      throw new ForbiddenError(`Cannot update a session that is already '${session.status}'.`);
    }

    if (input.warehouseId !== undefined && input.warehouseId !== session.warehouseId) {
      throw new BadRequestError('Warehouse ID cannot be changed after session creation.');
    }
    if (input.shopId !== undefined && input.shopId !== session.shopId) {
      throw new BadRequestError('Shop ID cannot be changed after session creation.');
    }

    // Validate input using Zod schema or individual checks
    if (input.startDate && session.status !== InventorySessionStatus.PENDING) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Tentative de modification de la date de début pour une session non PENDING. Statut actuel: ${session.status}`,
      );
      throw new BadRequestError('Start date can only be changed for PENDING sessions.');
    }
    if (input.status && !Object.values(InventorySessionStatus).includes(input.status)) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Statut invalide fourni: ${input.status}`,
      );
      throw new BadRequestError(`Invalid status provided: ${input.status}`);
    }
    if (input.status === InventorySessionStatus.COMPLETED) {
      logger.warn(
        `InventorySessionService.updateInventorySession: Tentative de compléter la session via PUT. Utiliser le point de terminaison dédié.`,
      );
      throw new BadRequestError(`To complete a session, use the dedicated /complete endpoint.`);
    }

    const updatePayload: Partial<InventorySession> = { updatedByUserId };
    if (input.notes !== undefined) updatePayload.notes = input.notes;
    if (input.startDate) updatePayload.startDate = dayjs(input.startDate).toDate();
    if (input.endDate !== undefined)
      updatePayload.endDate = input.endDate ? dayjs(input.endDate).toDate() : null;
    if (input.status) updatePayload.status = input.status; // e.g., PENDING -> IN_PROGRESS, or to CANCELLED

    // Validate entity before saving
    const tempSession = this.sessionRepository.create({ ...session, ...updatePayload });
    if (!tempSession.isValid()) {
      logger.error(
        `InventorySessionService.updateInventorySession: Données de session mises à jour invalides: ${inventorySessionValidationInputErrors.join(',')}`,
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
        `InventorySessionService.updateInventorySession: Échec du mappage de la session mise à jour ${sessionId}.`,
      );
      throw new ServerError(`Failed to map updated session ${sessionId}.`);
    }
    return apiResponse;
  }

  async completeInventorySession(
    sessionId: number,
    input: CompleteInventorySessionInput,
    validatedByUserId: number,
  ): Promise<InventorySessionApiResponse> {
    return appDataSource.transaction(async (transactionalEntityManager) => {
      const sessionRepoTx = transactionalEntityManager.getRepository(InventorySession);

      const session = await this.sessionRepository.findById(sessionId, {
        relations: [...this.sessionRepository['getDefaultRelationsForFindOne']()],
        transactionalEntityManager,
      });
      if (!session) {
        logger.error(
          `InventorySessionService.completeInventorySession: Session d'inventaire ID ${sessionId} non trouvée.`,
        );
        throw new NotFoundError(`Inventory session with ID ${sessionId} not found.`);
      }
      if (
        session.status !== InventorySessionStatus.IN_PROGRESS &&
        session.status !== InventorySessionStatus.PENDING
      ) {
        logger.warn(
          `InventorySessionService.completeInventorySession: Tentative de compléter une session avec un statut invalide: ${session.status}.`,
        );
        throw new BadRequestError(
          `Inventory session must be IN_PROGRESS or PENDING to be completed. Current status: ${session.status}.`,
        );
      }

      const user = await this.userRepository.findById(validatedByUserId);
      if (!user) {
        logger.error(
          `InventorySessionService.completeInventorySession: Utilisateur ID ${validatedByUserId} non trouvé pour la validation.`,
        );
        throw new BadRequestError(`User ID ${validatedByUserId} not found for validation.`);
      }

      if (!session.items || session.items.length === 0) {
        logger.warn(
          `Inventory session ${sessionId} is being completed without any items recorded. This will result in no stock adjustments.`,
        );
      }

      for (const item of session.items || []) {
        item.calculateVariance();
        await transactionalEntityManager.save(item);
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
              movementDate: session.endDate || new Date(),
              unitCostAtMovement: item.unitCostAtInventory,
              userId: validatedByUserId,
              referenceDocumentType: 'inventory_session',
              referenceDocumentId: session.id.toString(),
              notes: `Inventory adjustment for session ${session.id}. Item ${item.id}. Variance: ${item.varianceQuantity}.`,
            },
            transactionalEntityManager,
          );
        }
      }

      session.status = InventorySessionStatus.COMPLETED;
      session.endDate = new Date();
      session.validatedByUserId = validatedByUserId;
      session.updatedByUserId = validatedByUserId;
      session.notes = input.notes || session.notes;

      if (!session.isValid()) {
        logger.error(
          `InventorySessionService.completeInventorySession: Données de session invalides après complétion: ${inventorySessionValidationInputErrors.join(',')}`,
          { session },
        );
        throw new BadRequestError(
          `Session data invalid upon completion: ${inventorySessionValidationInputErrors.join(',')}`,
        );
      }
      await sessionRepoTx.save(session);

      const populatedSession = await this.sessionRepository.findById(sessionId, {
        transactionalEntityManager,
      });
      const apiResponse = this.mapToApiResponse(populatedSession, true);
      if (!apiResponse) {
        logger.error(
          `InventorySessionService.completeInventorySession: Échec du mappage de la session complétée ${sessionId}.`,
        );
        throw new ServerError(`Failed to map completed session ${sessionId}.`);
      }
      return apiResponse;
    });
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
    return this.mapToApiResponse(session) as InventorySessionApiResponse;
  }

  static getInstance(): InventorySessionService {
    if (!instance) {
      instance = new InventorySessionService();
    }
    return instance;
  }
}
