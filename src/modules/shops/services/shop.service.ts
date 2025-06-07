import { ShopRepository } from '../data/shop.repository';
import { AddressRepository } from '../../addresses/data/address.repository';
import { UserRepository } from '../../users/data/users.repository';
import {
  type CreateShopInput,
  type UpdateShopInput,
  type ShopApiResponse,
  Shop,
  shopValidationInputErrors,
} from '../models/shop.entity';
import { Address, type CreateAddressInput } from '../../addresses/models/address.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { ILike, type FindManyOptions, type FindOptionsWhere } from 'typeorm';
import { appDataSource } from '@/database/data-source';

let instance: ShopService | null = null;

export class ShopService {
  private readonly shopRepository: ShopRepository;
  private readonly addressRepository: AddressRepository;
  private readonly userRepository: UserRepository;
  // TODO: Dépendance - Repositories for checking usage (CashRegister, StockMovement, etc.)

  constructor(
    shopRepository: ShopRepository = new ShopRepository(),
    addressRepository: AddressRepository = new AddressRepository(),
    userRepository: UserRepository = new UserRepository(),
  ) {
    this.shopRepository = shopRepository;
    this.addressRepository = addressRepository;
    this.userRepository = userRepository;
  }

  mapToApiResponse(shop: Shop | null): ShopApiResponse | null {
    if (!shop) return null;
    return shop.toApi();
  }

  async findById(id: number): Promise<ShopApiResponse> {
    try {
      const shop = await this.shopRepository.findById(id);
      if (!shop) throw new NotFoundError(`Shop with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(shop);
      if (!apiResponse) throw new ServerError(`Failed to map shop ${id} to API response.`);
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error finding shop by id ${id}`, error }, 'ShopService.findById');
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding shop by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Shop>;
    sort?: FindManyOptions<Shop>['order'];
    searchTerm?: string;
  }): Promise<{ shops: ShopApiResponse[]; total: number }> {
    try {
      const whereClause = options?.filters ? { ...options.filters } : {};
      const { shops, count } = await this.shopRepository.findAll({
        where: whereClause,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' },
      });
      const apiShops = shops
        .map((s) => this.mapToApiResponse(s))
        .filter(Boolean) as ShopApiResponse[];
      return { shops: apiShops, total: count };
    } catch (error) {
      logger.error({ message: `Error finding all shops`, error, options }, 'ShopService.findAll');
      throw new ServerError('Error finding all shops.');
    }
  }

  async create(input: CreateShopInput, createdByUserId: number): Promise<ShopApiResponse> {
    const { name, code, managerId, newAddress, addressId: inputAddressId } = input;

    const existingByName = await this.shopRepository.findByName(name);
    if (existingByName) {
      throw new BadRequestError(`Shop with name '${name}' already exists.`);
    }
    if (code) {
      const existingByCode = await this.shopRepository.findByCode(code);
      if (existingByCode) {
        throw new BadRequestError(`Shop with code '${code}' already exists.`);
      }
    }
    if (managerId) {
      const manager = await this.userRepository.findById(managerId);
      if (!manager) throw new BadRequestError(`Manager (User) with ID ${managerId} not found.`);
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const shopRepoTx = transactionalEntityManager.getRepository(Shop);
      const addressRepoTx = transactionalEntityManager.getRepository(Address);

      let finalAddressId = inputAddressId;
      if (newAddress) {
        if (inputAddressId) {
          throw new BadRequestError('Provide either addressId or newAddress for shop, not both.');
        }
        const addressEntity = addressRepoTx.create(newAddress);
        const savedAddress = await addressRepoTx.save(addressEntity);
        finalAddressId = savedAddress.id;
      } else if (inputAddressId) {
        const address = await this.addressRepository.findById(inputAddressId); // Check before transaction if possible
        if (!address) throw new BadRequestError(`Address with ID ${inputAddressId} not found.`);
      } else {
        throw new BadRequestError('Either addressId or newAddress is required for shop.');
      }
      if (!finalAddressId) throw new ServerError('Could not determine address ID for shop.');

      const shopEntity = shopRepoTx.create({
        ...input,
        addressId: finalAddressId,
        createdByUserId: createdByUserId,
        updatedByUserId: createdByUserId,
      });

      const tempShopForValidation = this.shopRepository.create(shopEntity);
      if (!tempShopForValidation.isValid()) {
        throw new BadRequestError(
          `Shop data is invalid. Errors: ${shopValidationInputErrors.join(', ')}`,
        );
      }

      const savedShop = await shopRepoTx.save(shopEntity);

      const populatedShop = await shopRepoTx.findOne({
        where: { id: savedShop.id },
        relations: ['address', 'manager'],
      });
      if (!populatedShop)
        throw new ServerError(`Failed to re-fetch newly created shop ${savedShop.id}.`);

      const apiResponse = this.mapToApiResponse(populatedShop);
      if (!apiResponse) throw new ServerError(`Failed to map newly created shop ${savedShop.id}.`);
      return apiResponse;
    });
  }

  async update(
    id: number,
    input: UpdateShopInput,
    updatedByUserId: number,
  ): Promise<ShopApiResponse> {
    const shopToUpdate = await this.shopRepository.findById(id);
    if (!shopToUpdate) throw new NotFoundError(`Shop with id ${id} not found.`);

    if (input.name && input.name !== shopToUpdate.name) {
      const existingByName = await this.shopRepository.findByName(input.name);
      if (existingByName && existingByName.id !== id) {
        throw new BadRequestError(`Another shop with name '${input.name}' already exists.`);
      }
    }
    if (input.code && input.code !== shopToUpdate.code) {
      const existingByCode = await this.shopRepository.findByCode(input.code);
      if (existingByCode && existingByCode.id !== id) {
        throw new BadRequestError(`Another shop with code '${input.code}' already exists.`);
      }
    }
    if (input.addressId && input.addressId !== shopToUpdate.addressId) {
      const address = await this.addressRepository.findById(input.addressId);
      if (!address) throw new BadRequestError(`New address with ID ${input.addressId} not found.`);
    }
    if (input.hasOwnProperty('managerId')) {
      if (input.managerId === null) {
        /* ok */
      } else if (input.managerId !== shopToUpdate.managerId) {
        const manager = await this.userRepository.findById(input.managerId as number);
        if (!manager)
          throw new BadRequestError(`New manager (User) with ID ${input.managerId} not found.`);
      }
    }

    return appDataSource.transaction(async (transactionalEntityManager) => {
      const shopRepoTx = transactionalEntityManager.getRepository(Shop);

      const tempShopData = { ...shopToUpdate, ...input };
      const tempShopForValidation = this.shopRepository.create(tempShopData);
      if (!tempShopForValidation.isValid()) {
        throw new BadRequestError(
          `Updated shop data is invalid. Errors: ${shopValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Shop> = { ...input, updatedByUserId };
      if (input.hasOwnProperty('code') && input.code === null) updatePayload.code = null;
      if (input.hasOwnProperty('managerId') && input.managerId === null)
        updatePayload.managerId = null;
      if (input.hasOwnProperty('openingHoursNotes') && input.openingHoursNotes === null)
        updatePayload.openingHoursNotes = null;

      let hasChanges = false;
      for (const key in input) {
        if (input.hasOwnProperty(key) && (input as any)[key] !== (shopToUpdate as any)[key]) {
          hasChanges = true;
          break;
        }
      }
      if (
        !hasChanges &&
        Object.keys(updatePayload).length === 1 &&
        updatePayload.updatedByUserId !== undefined
      ) {
        return this.mapToApiResponse(shopToUpdate) as ShopApiResponse;
      }

      const result = await shopRepoTx.update(id, updatePayload);
      if (result.affected === 0) {
        const stillExists = await this.shopRepository.findById(id);
        if (!stillExists) throw new NotFoundError(`Shop with id ${id} not found during update.`);
      }

      const updatedShop = await shopRepoTx.findOne({
        where: { id: id },
        relations: ['address', 'manager'],
      });
      if (!updatedShop) throw new ServerError('Failed to re-fetch shop after update.');

      const apiResponse = this.mapToApiResponse(updatedShop);
      if (!apiResponse) throw new ServerError(`Failed to map updated shop ${id}.`);
      return apiResponse;
    });
  }

  async delete(id: number, deletedByUserId: number): Promise<void> {
    try {
      const shop = await this.shopRepository.findById(id);
      if (!shop) throw new NotFoundError(`Shop with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si la boutique est utilisée (CashRegisters, Stock, etc.)
      const isInUse = await this.shopRepository.isShopInUse(id);
      if (isInUse) {
        throw new BadRequestError(`Shop '${shop.name}' is in use and cannot be deleted.`);
      }

      await this.shopRepository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error deleting shop ${id}`, error }, 'ShopService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting shop ${id}.`);
    }
  }

  static getInstance(): ShopService {
    if (!instance) {
      instance = new ShopService();
    }
    return instance;
  }
}
