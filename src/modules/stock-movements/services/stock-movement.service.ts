import { ProductRepository } from '../../products/data/product.repository';
import { WarehouseRepository } from '../../warehouses/data/warehouse.repository';
import { ShopRepository } from '../../shops/data/shop.repository';
import { UserRepository } from '../../users/data/users.repository';

import {
  StockMovement,
  type CreateStockMovementInput,
  type StockMovementApiResponse,
  StockMovementType,
  createStockMovementSchema,
} from '../models/stock-movement.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere, type EntityManager } from 'typeorm';
import { StockMovementRepository } from '../data/stock-movement.repository';
import { ProductVariantRepository } from '@/modules/product-variants/data/product-variant.repository';

let instance: StockMovementService | null = null;

export class StockMovementService {
  private readonly movementRepository: StockMovementRepository;
  private readonly productRepository: ProductRepository;
  private readonly variantRepository: ProductVariantRepository;
  private readonly warehouseRepository: WarehouseRepository;
  private readonly shopRepository: ShopRepository;
  private readonly userRepository: UserRepository;

  constructor(
    movementRepository: StockMovementRepository = new StockMovementRepository(),
    productRepository: ProductRepository = new ProductRepository(),
    variantRepository: ProductVariantRepository = new ProductVariantRepository(),
    warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    shopRepository: ShopRepository = new ShopRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.movementRepository = movementRepository;
    this.productRepository = productRepository;
    this.variantRepository = variantRepository;
    this.warehouseRepository = warehouseRepository;
    this.shopRepository = shopRepository;
    this.userRepository = userRepository;
  }

  mapToApiResponse(movement: StockMovement | null): StockMovementApiResponse | null {
    if (!movement) return null;
    return movement.toApi();
  }

  /**
   * Internal method to create a stock movement. Usually called by other services.
   * Can also be used for manual adjustments if the DTO is constructed correctly.
   * Ensures product/variant and location exist.
   * IMPORTANT: This method is designed to be called within an existing transaction if part of a larger operation.
   * If called directly (e.g. for manual adjustment), it should initiate its own transaction.
   */
  async createMovement(
    input: CreateStockMovementInput,
    transactionalEntityManager?: EntityManager, // Optional for use within existing transactions
  ): Promise<StockMovement> {
    // Returns entity for internal use
    const validationResult = createStockMovementSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new BadRequestError(`Invalid stock movement data. Errors: ${errors.join(', ')}`);
    }
    const validatedInput = validationResult.data;

    const product = await this.productRepository.findById(validatedInput.productId);
    if (!product)
      throw new BadRequestError(`Product with ID ${validatedInput.productId} not found.`);
    if (validatedInput.productVariantId) {
      const variant = await this.variantRepository.findById(validatedInput.productVariantId);
      if (!variant || variant.productId !== validatedInput.productId) {
        throw new BadRequestError(
          `Variant ID ${validatedInput.productVariantId} not valid for product ${validatedInput.productId}.`,
        );
      }
    }
    if (validatedInput.warehouseId) {
      if (!(await this.warehouseRepository.findById(validatedInput.warehouseId))) {
        throw new BadRequestError(`Warehouse ID ${validatedInput.warehouseId} not found.`);
      }
    } else if (validatedInput.shopId) {
      if (!(await this.shopRepository.findById(validatedInput.shopId))) {
        throw new BadRequestError(`Shop ID ${validatedInput.shopId} not found.`);
      }
    } else {
      throw new BadRequestError('Stock movement must be associated with a warehouse or a shop.');
    }
    if (!(await this.userRepository.findById(validatedInput.userId))) {
      throw new BadRequestError(`User ID ${validatedInput.userId} not found for stock movement.`);
    }

    const movementEntityData: Partial<StockMovement> = {
      ...validatedInput,
      movementDate: validatedInput.movementDate || new Date(), // Default to now
    };
    // Ensure quantity has the correct sign based on movement type
    const type = validatedInput.movementType;
    if (
      (type.endsWith('_OUT') || type === StockMovementType.SALE_DELIVERY) &&
      validatedInput.quantity > 0
    ) {
      movementEntityData.quantity = -Math.abs(validatedInput.quantity);
    } else if (
      (type.endsWith('_IN') || type === StockMovementType.CUSTOMER_RETURN) &&
      validatedInput.quantity < 0
    ) {
      movementEntityData.quantity = Math.abs(validatedInput.quantity);
    } else {
      movementEntityData.quantity = validatedInput.quantity;
    }

    const movementEntity = (
      transactionalEntityManager
        ? transactionalEntityManager.getRepository(StockMovement)
        : this.movementRepository
    ).create(movementEntityData);

    if (!movementEntity.isValidBasic()) {
      logger.error(
        `[createMovement] Basic validation failed for movement entity: ${JSON.stringify(movementEntity)}`,
      );
      throw new BadRequestError('Internal stock movement entity state invalid.');
    }

    try {
      const savedMovement = await (
        transactionalEntityManager
          ? transactionalEntityManager.getRepository(StockMovement)
          : this.movementRepository
      ).save(movementEntity);
      logger.info(
        `Stock movement ID ${savedMovement.id} (Type: ${savedMovement.movementType}, Qty: ${savedMovement.quantity}) created.`,
      );

      // TODO: Dépendance - Mettre à jour une table de niveaux de stock agrégés (StockLevel)
      // Ou, si le stock est calculé à la volée, cette étape n'est pas nécessaire ici.
      // await this.stockLevelRepository.updateStockLevel(
      //   savedMovement.productId,
      //   savedMovement.productVariantId,
      //   savedMovement.warehouseId,
      //   savedMovement.shopId,
      //   savedMovement.quantity,
      //   transactionalEntityManager
      // );

      return savedMovement;
    } catch (error) {
      logger.error({ message: `Error creating stock movement`, error, input: validatedInput });
      throw new ServerError('Failed to create stock movement.');
    }
  }

  async createManualAdjustment(
    input: CreateStockMovementInput,
    createdByUserId: number,
  ): Promise<StockMovementApiResponse> {
    if (
      input.movementType !== StockMovementType.MANUAL_ENTRY_IN &&
      input.movementType !== StockMovementType.MANUAL_ENTRY_OUT
    ) {
      throw new BadRequestError(
        "Invalid movementType for manual adjustment. Must be 'manual_entry_in' or 'manual_entry_out'.",
      );
    }
    input.userId = createdByUserId; // Ensure the user creating the adjustment is logged

    // Manual adjustments should be transactional if they update other aggregates
    const movement = await this.createMovement(input); // createMovement handles its own transaction if no EM passed
    const populatedMovement = await this.movementRepository.findById(movement.id); // Re-fetch with relations
    const apiResponse = this.mapToApiResponse(populatedMovement);
    if (!apiResponse)
      throw new ServerError(`Failed to map created manual stock adjustment ${movement.id}.`);
    return apiResponse;
  }

  async findStockMovementById(
    id: number,
    requestingUserId: number,
  ): Promise<StockMovementApiResponse> {
    try {
      const movement = await this.movementRepository.findById(id);
      if (!movement) throw new NotFoundError(`Stock movement with id ${id} not found.`);
      // TODO: Authorization, if needed

      const apiResponse = this.mapToApiResponse(movement);
      if (!apiResponse) throw new ServerError(`Failed to map stock movement ${id}.`);
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding stock movement by id ${id}`, error },
        'StockMovementService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding stock movement by id ${id}.`);
    }
  }

  async findAllStockMovements(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<StockMovement> | FindOptionsWhere<StockMovement>[];
    sort?: FindManyOptions<StockMovement>['order'];
    // searchTerm?: string; // Stock movements usually filtered by specific fields
  }): Promise<{ movements: StockMovementApiResponse[]; total: number }> {
    try {
      const { movements, count } = await this.movementRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { movementDate: 'DESC', createdAt: 'DESC' },
        relations: this.movementRepository['getDefaultRelations'](), // Get all default relations
      });
      const apiMovements = movements
        .map((m) => this.mapToApiResponse(m))
        .filter(Boolean) as StockMovementApiResponse[];
      return { movements: apiMovements, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all stock movements`, error, options },
        'StockMovementService.findAll',
      );
      throw new ServerError('Error finding all stock movements.');
    }
  }

  async getCurrentStock(
    productId: number,
    productVariantId: number | undefined,
    warehouseId: number | undefined,
    shopId: number | undefined,
  ): Promise<{
    productId: number;
    productVariantId: number | undefined;
    locationId: number;
    locationType: 'warehouse' | 'shop';
    quantity: number;
  }> {
    if (!warehouseId && !shopId) {
      throw new BadRequestError(
        'Either warehouseId or shopId must be provided to get current stock.',
      );
    }
    if (warehouseId && shopId) {
      throw new BadRequestError(
        'Provide either warehouseId or shopId for stock location, not both.',
      );
    }

    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found.`);
    }

    if (productVariantId) {
      const variant = await this.variantRepository.findById(productVariantId);
      if (!variant || variant.productId !== productId) {
        throw new NotFoundError(
          `Variant ID ${productVariantId} not found or not linked to product ${productId}.`,
        );
      }
    }

    const locationParam = warehouseId ? { warehouseId } : { shopId };
    const locationType = warehouseId ? 'warehouse' : 'shop';
    const locationId = (warehouseId !== undefined ? warehouseId : shopId) as number;

    if (locationType === 'warehouse') {
      const warehouse = await this.warehouseRepository.findById(locationId);
      if (!warehouse) {
        throw new NotFoundError(`Warehouse with ID ${locationId} not found.`);
      }
    } else if (locationType === 'shop') {
      const shop = await this.shopRepository.findById(locationId);
      if (!shop) {
        throw new NotFoundError(`Shop with ID ${locationId} not found.`);
      }
    }

    const quantity =
      (await this.movementRepository.getCurrentStockLevel(
        productId,
        productVariantId,
        locationParam,
      )) || 0;
    return {
      productId,
      productVariantId,
      locationId,
      locationType,
      quantity,
    };
  }

  static getInstance(): StockMovementService {
    instance ??= new StockMovementService();
    return instance;
  }
}
