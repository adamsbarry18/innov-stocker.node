import { SupplierRepository } from '../data/supplier.repository';
// TODO: Importer AddressRepository et CurrencyRepository pour valider les IDs.
// import { AddressRepository } from '../../addresses/data/address.repository';
// import { CurrencyRepository } from '../../currencies/data/currency.repository';
// TODO: Importer les repositories nécessaires pour la vérification des dépendances à la suppression.
// import { PurchaseOrderRepository } from '../../purchase-orders/data/purchase-order.repository';
// import { ProductSupplierRepository } from '../../products/data/product_supplier.repository'; // Si elle existe en tant que repo dédié

import {
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierApiResponse,
  type Supplier,
  supplierValidationInputErrors,
} from '../models/supplier.entity';
import { NotFoundError, BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { type FindManyOptions, type FindOptionsWhere } from 'typeorm';

let instance: SupplierService | null = null;

export class SupplierService {
  private readonly supplierRepository: SupplierRepository;
  // TODO: private readonly addressRepository: AddressRepository;
  // TODO: private readonly currencyRepository: CurrencyRepository;
  // TODO: private readonly purchaseOrderRepository: PurchaseOrderRepository;

  constructor(
    supplierRepository: SupplierRepository = new SupplierRepository(),
    // addressRepository: AddressRepository = new AddressRepository(),
    // currencyRepository: CurrencyRepository = new CurrencyRepository(),
    // purchaseOrderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
  ) {
    this.supplierRepository = supplierRepository;
    // TODO: this.addressRepository = addressRepository;
    // TODO: this.currencyRepository = currencyRepository;
    // TODO: this.purchaseOrderRepository = purchaseOrderRepository;
  }

  mapToApiResponse(supplier: Supplier | null): SupplierApiResponse | null {
    if (!supplier) return null;
    // The supplier.toApi() method already handles mapping of eager-loaded relations
    return supplier.toApi();
  }

  async findById(id: number): Promise<SupplierApiResponse> {
    try {
      const supplier = await this.supplierRepository.findById(id, {
        relations: ['address', 'defaultCurrency'],
      });
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(supplier);
      if (!apiResponse) {
        throw new ServerError(`Failed to map supplier ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error finding supplier by id ${id}`, error },
        'SupplierService.findById',
      );
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding supplier by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<Supplier>;
    sort?: FindManyOptions<Supplier>['order'];
    // Add searchTerm for full-text or specific field search if needed
  }): Promise<{ suppliers: SupplierApiResponse[]; total: number }> {
    try {
      const { suppliers, count } = await this.supplierRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' },
        relations: ['address', 'defaultCurrency'], // Eager load for list view
      });
      const apiSuppliers = suppliers
        .map((s) => this.mapToApiResponse(s))
        .filter(Boolean) as SupplierApiResponse[];
      return { suppliers: apiSuppliers, total: count };
    } catch (error) {
      logger.error(
        { message: `Error finding all suppliers`, error, options },
        'SupplierService.findAll',
      );
      throw new ServerError('Error finding all suppliers.');
    }
  }

  async create(input: CreateSupplierInput, createdByUserId: number): Promise<SupplierApiResponse> {
    // TODO: Dépendance - Valider l'existence de input.addressId si fourni
    // if (input.addressId) {
    //   const addressExists = await this.addressRepository.findById(input.addressId);
    //   if (!addressExists) throw new BadRequestError(`Address with ID ${input.addressId} not found.`);
    // }
    // TODO: Dépendance - Valider l'existence de input.defaultCurrencyId
    // const currencyExists = await this.currencyRepository.findById(input.defaultCurrencyId);
    // if (!currencyExists) throw new BadRequestError(`Currency with ID ${input.defaultCurrencyId} not found.`);

    if (input.email) {
      const existingByEmail = await this.supplierRepository.findByEmail(input.email);
      if (existingByEmail) {
        throw new BadRequestError(`Supplier with email '${input.email}' already exists.`);
      }
    }

    const supplierEntity = this.supplierRepository.create({
      ...input,
      createdByUserId: createdByUserId,
      updatedByUserId: createdByUserId,
    });

    if (!supplierEntity.isValid()) {
      throw new BadRequestError(
        `Supplier data is invalid. Errors: ${supplierValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedSupplier = await this.supplierRepository.save(supplierEntity);
      logger.info(
        `Supplier '${savedSupplier.name}' (ID: ${savedSupplier.id}) created successfully.`,
      );

      // Re-fetch to get populated relations if not automatically handled by save or if toApi needs them fresh
      const populatedSupplier = await this.supplierRepository.findById(savedSupplier.id);
      const apiResponse = this.mapToApiResponse(populatedSupplier);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created supplier ${savedSupplier.id} to API response.`,
        );
      }
      return apiResponse;
    } catch (error) {
      logger.error({ message: `Error creating supplier`, error, input }, 'SupplierService.create');
      if (error instanceof BadRequestError) throw error; // Erreur de duplication gérée par le repo
      throw new ServerError('Failed to create supplier.');
    }
  }

  async update(
    id: number,
    input: UpdateSupplierInput,
    updatedByUserId: number,
  ): Promise<SupplierApiResponse> {
    try {
      const supplier = await this.supplierRepository.findById(id);
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      // TODO: Dépendance - Valider l'existence de input.addressId si fourni et différent
      // if (input.addressId && input.addressId !== supplier.addressId) {
      //   const addressExists = await this.addressRepository.findById(input.addressId);
      //   if (!addressExists) throw new BadRequestError(`New address with ID ${input.addressId} not found.`);
      // }
      // TODO: Dépendance - Valider l'existence de input.defaultCurrencyId si fourni et différent
      // if (input.defaultCurrencyId && input.defaultCurrencyId !== supplier.defaultCurrencyId) {
      //   const currencyExists = await this.currencyRepository.findById(input.defaultCurrencyId);
      //   if (!currencyExists) throw new BadRequestError(`New currency with ID ${input.defaultCurrencyId} not found.`);
      // }

      if (input.email && input.email !== supplier.email) {
        const existingByEmail = await this.supplierRepository.findByEmail(input.email);
        if (existingByEmail && existingByEmail.id !== id) {
          throw new BadRequestError(`Another supplier with email '${input.email}' already exists.`);
        }
      }

      const tempSupplierData = { ...supplier, ...input };
      // TypeORM merges, so just create with new data to validate
      const tempSupplier = this.supplierRepository.create(tempSupplierData);
      if (!tempSupplier.isValid()) {
        throw new BadRequestError(
          `Updated supplier data is invalid. Errors: ${supplierValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<Supplier> = {
        ...input,
        updatedByUserId: updatedByUserId,
      };

      if (Object.keys(updatePayload).length <= 1 && updatePayload.updatedByUserId !== undefined) {
        // Only audit field
        const currentSupplier = await this.supplierRepository.findById(id); // Re-fetch to ensure latest data for response
        return this.mapToApiResponse(currentSupplier) as SupplierApiResponse;
      }

      const result = await this.supplierRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Supplier with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedSupplier = await this.supplierRepository.findById(id); // Re-fetch to get populated relations
      if (!updatedSupplier) throw new ServerError('Failed to re-fetch supplier after update.');

      logger.info(`Supplier '${updatedSupplier.name}' (ID: ${id}) updated successfully.`);
      const apiResponse = this.mapToApiResponse(updatedSupplier);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated supplier ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(
        { message: `Error updating supplier ${id}`, error, input },
        'SupplierService.update',
      );
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Failed to update supplier ${id}.`);
    }
  }

  async delete(id: number, deletedByUserId: number): Promise<void> {
    try {
      const supplier = await this.supplierRepository.findById(id);
      if (!supplier) throw new NotFoundError(`Supplier with id ${id} not found.`);

      // TODO: Dépendance - Vérifier si le fournisseur est utilisé
      // (ex: PurchaseOrders, ProductSuppliers) avant la suppression.
      // const isUsed = await this.supplierRepository.isSupplierInUse(id); // Méthode à implémenter dans le repo
      // if (isUsed) {
      //   throw new BadRequestError(`Supplier '${supplier.name}' is in use and cannot be deleted. Please reassign associated records first.`);
      // }

      await this.supplierRepository.softDelete(id);
      // Log who deleted it if audit is extended
      // await this.auditLogService.logAction(deletedByUserId, 'delete', 'supplier', id, { name: supplier.name });
      logger.info(
        `Supplier '${supplier.name}' (ID: ${id}) successfully soft-deleted by user ${deletedByUserId}.`,
      );
    } catch (error) {
      logger.error({ message: `Error deleting supplier ${id}`, error }, 'SupplierService.delete');
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
      throw new ServerError(`Error deleting supplier ${id}.`);
    }
  }

  static getInstance(): SupplierService {
    if (!instance) {
      instance = new SupplierService();
    }
    return instance;
  }
}
