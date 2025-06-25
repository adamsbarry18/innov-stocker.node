import {
  CreateProductInput,
  Product,
  ProductRepository,
  productValidationInputErrors,
} from '@/modules/products';
import { ImportBatchRepository } from '../data/import.repository';
import {
  CreateProductCategoryInput,
  ProductCategory,
  ProductCategoryRepository,
  productCategoryValidationInputErrors,
} from '@/modules/product-categories';
import {
  CreateCustomerInput,
  Customer,
  CustomerRepository,
  customerValidationInputErrors,
} from '@/modules/customers';
import {
  CreateSupplierInput,
  Supplier,
  SupplierRepository,
  supplierValidationInputErrors,
} from '@/modules/suppliers';
import { type CreateSalesOrderInput, SalesOrder, SalesOrderService } from '@/modules/sales-orders';
import { type CreatePurchaseOrderInput, PurchaseOrderService } from '@/modules/purchase-orders';
import {
  CreateStockMovementInput,
  StockMovementService,
  StockMovementType,
} from '@/modules/stock-movements';
import {
  type CreateImportBatchInput,
  type FailedRowDetail,
  type ImportBatch,
  type ImportBatchApiResponse,
  ImportEntityType,
  ImportStatus,
  type ImportSummary,
} from '../models/import.entity';
import { BadRequestError, NotFoundError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';
import { appDataSource } from '@/database/data-source';
import { In } from 'typeorm';
import { Address } from '@/modules/addresses/models/address.entity';
import { Currency } from '@/modules/currencies/models/currency.entity';
import { CustomerGroup } from '@/modules/customer-groups/models/customer-group.entity';
import { Product as ProductEntity } from '@/modules/products/models/product.entity';
import { ProductCategory as ProductCategoryEntity } from '@/modules/product-categories/models/product-category.entity';
import { Customer as CustomerEntity } from '@/modules/customers/models/customer.entity';
import { Supplier as SupplierEntity } from '@/modules/suppliers/models/supplier.entity';

// Import des repositories pour l'injection de dépendances

import { SalesOrderRepository } from '@/modules/sales-orders';
import { PurchaseOrderRepository } from '@/modules/purchase-orders';
import { WarehouseRepository } from '@/modules/warehouses';
import { ShopRepository } from '@/modules/shops';
import { AddressRepository } from '@/modules/addresses';
import { CurrencyRepository } from '@/modules/currencies';
import { CustomerGroupRepository } from '@/modules/customer-groups';

let instance: ImportService | null = null;

export class ImportService {
  constructor(
    private readonly purchaseOrderService: PurchaseOrderService = PurchaseOrderService.getInstance(),
    private readonly stockMovementService: StockMovementService = StockMovementService.getInstance(),
    private readonly salesOrderService: SalesOrderService = SalesOrderService.getInstance(),

    // Repositories injectés
    private readonly importBatchRepository: ImportBatchRepository = new ImportBatchRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
    private readonly categoryRepository: ProductCategoryRepository = new ProductCategoryRepository(),
    private readonly customerRepository: CustomerRepository = new CustomerRepository(),
    private readonly supplierRepository: SupplierRepository = new SupplierRepository(),
    private readonly salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly purchaseOrderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly warehouseRepository: WarehouseRepository = new WarehouseRepository(),
    private readonly shopRepository: ShopRepository = new ShopRepository(),
    private readonly addressRepository: AddressRepository = new AddressRepository(),
    private readonly currencyRepository: CurrencyRepository = new CurrencyRepository(),
    private readonly customerGroupRepository: CustomerGroupRepository = new CustomerGroupRepository(),
  ) {}

  static getInstance(): ImportService {
    instance ??= new ImportService();
    return instance;
  }

  // ===== PUBLIC METHODS =====

  async scheduleImport(
    entityType: ImportEntityType,
    dataPayload: any[],
    input: Omit<CreateImportBatchInput, 'entityType'>,
    createdByUserId: number,
  ): Promise<ImportBatchApiResponse | null> {
    if (!dataPayload || dataPayload.length === 0) {
      throw new BadRequestError('Import payload cannot be empty.');
    }

    const batchEntity = this.importBatchRepository.create({
      entityType,
      payload: dataPayload,
      originalFileName: input.originalFileName,
      createdByUserId,
      updatedByUserId: createdByUserId,
      summary: {
        totalRows: dataPayload.length,
        successfullyImported: 0,
        failedRowsCount: 0,
      },
    });

    const savedBatch = await this.importBatchRepository.save(batchEntity);

    // Simulation de traitement asynchrone
    setTimeout(() => {
      this.processImportBatch(savedBatch.id).catch((err) => {
        logger.error({
          message: `Critical failure during async import batch processing for ID ${savedBatch.id}`,
          error: err,
        });
      });
    }, 0);

    logger.info(`Import batch ID ${savedBatch.id} scheduled for processing.`);
    return this.mapToApiResponse(savedBatch);
  }

  async getImportStatus(batchId: number): Promise<ImportBatchApiResponse> {
    const batch = await this.importBatchRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError(`Import batch with ID ${batchId} not found.`);
    }
    return this.mapToApiResponse(batch) as ImportBatchApiResponse;
  }

  // ===== "WORKER" LOGIC (PRIVATE METHODS) =====

  private async processImportBatch(batchId: number): Promise<void> {
    const batch = await this.importBatchRepository.findById(batchId);
    if (!batch || batch.status !== ImportStatus.PENDING) {
      logger.warn(
        `Skipping import batch ${batchId}: not found or not in PENDING status (current: ${batch?.status}).`,
      );
      return;
    }

    batch.status = ImportStatus.PROCESSING;
    await this.importBatchRepository.save(batch);

    try {
      switch (batch.entityType) {
        case ImportEntityType.CUSTOMER:
          await this.processCustomerImport(batch);
          break;
        case ImportEntityType.SUPPLIER:
          await this.processSupplierImport(batch);
          break;
        case ImportEntityType.PRODUCT:
          await this.processProductImport(batch);
          break;
        case ImportEntityType.PRODUCT_CATEGORY:
          await this.processProductCategoryImport(batch);
          break;
        case ImportEntityType.OPENING_STOCK:
          await this.processOpeningStockImport(batch);
          break;
        case ImportEntityType.SALES_ORDER:
          await this.processSalesOrderImport(batch);
          break;
        case ImportEntityType.PURCHASE_ORDER:
          await this.processPurchaseOrderImport(batch);
          break;
        default:
          throw new Error(`Unsupported entity type for import: ${batch.entityType}`);
      }

      batch.status = ImportStatus.COMPLETED;
    } catch (error: any) {
      batch.status = ImportStatus.FAILED;
      batch.criticalError = error.message;
      logger.error({ message: `Import batch ${batchId} failed critically`, error });
    } finally {
      await this.importBatchRepository.save(batch);
      logger.info(`Processing finished for import batch ${batchId}. Status: ${batch.status}.`);
    }
  }

  // --- Processors for each entity type ---

  private async processCustomerImport(batch: ImportBatch): Promise<void> {
    const customersToImport: CreateCustomerInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: customersToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];
    const validEntities: Partial<Customer>[] = [];

    // Pre-validation pour l'efficacité
    const emailsToImport = customersToImport.map((c) => c.email).filter(Boolean);
    const currencyIds = Array.from(
      new Set(customersToImport.map((c) => c.defaultCurrencyId).filter((id) => id)),
    );
    const groupIds = Array.from(
      new Set(customersToImport.map((c) => c.customerGroupId).filter((id) => id)),
    );
    const addressIds = Array.from(
      new Set(customersToImport.map((c) => c.billingAddressId).filter((id) => id)),
    );

    const [existingCustomers, existingCurrencies, existingGroups, existingAddresses] =
      await Promise.all([
        emailsToImport.length
          ? appDataSource
              .getRepository(CustomerEntity)
              .find({ where: { email: In(emailsToImport) } })
          : [],
        currencyIds.length
          ? appDataSource.getRepository(Currency).find({ where: { id: In(currencyIds) } })
          : [],
        groupIds.length
          ? appDataSource.getRepository(CustomerGroup).find({ where: { id: In(groupIds) } })
          : [],
        addressIds.length
          ? appDataSource.getRepository(Address).find({ where: { id: In(addressIds) } })
          : [],
      ]);
    const existingEmails = new Set(existingCustomers.map((c) => c.email));
    const existingCurrencyIds = new Set(existingCurrencies.map((c) => c.id));
    const existingGroupIds = new Set(existingGroups.map((g) => g.id));
    const existingAddressIds = new Set(existingAddresses.map((a) => a.id));

    // Validation ligne par ligne
    for (let index = 0; index < customersToImport.length; index++) {
      const customerInput = customersToImport[index];
      try {
        if (
          !customerInput.email ||
          !customerInput.defaultCurrencyId ||
          !customerInput.billingAddressId
        ) {
          throw new Error('Missing required fields: email, defaultCurrencyId, billingAddressId.');
        }
        if (existingEmails.has(customerInput.email)) {
          throw new Error(`Email '${customerInput.email}' already exists.`);
        }
        if (!existingCurrencyIds.has(customerInput.defaultCurrencyId)) {
          throw new Error(
            `Default Currency ID '${customerInput.defaultCurrencyId}' does not exist.`,
          );
        }
        if (!existingAddressIds.has(customerInput.billingAddressId)) {
          throw new Error(`Billing Address ID '${customerInput.billingAddressId}' does not exist.`);
        }
        if (customerInput.customerGroupId && !existingGroupIds.has(customerInput.customerGroupId)) {
          throw new Error(`Customer Group ID '${customerInput.customerGroupId}' does not exist.`);
        }

        // Exclure shippingAddresses car le repository.create ne gère pas directement les relations imbriquées de cette manière
        const { shippingAddresses, ...customerData } = customerInput;

        const customerEntity = this.customerRepository.create({
          ...customerData,
          createdByUserId: batch.createdByUserId,
          updatedByUserId: batch.createdByUserId,
        });
        if (!customerEntity.isValid()) {
          throw new Error(`Validation failed: ${customerValidationInputErrors.join('; ')}`);
        }
        validEntities.push(customerEntity);
        existingEmails.add(customerInput.email); // Pour les doublons dans le même fichier
      } catch (error: any) {
        failedRows.push({ row: index + 1, data: customerInput, error: error.message });
      }
    }

    if (failedRows.length > 0) {
      summary.successfullyImported = 0;
    } else if (validEntities.length > 0) {
      try {
        await appDataSource.transaction(async (manager) => {
          await manager.save(validEntities);
        });
        summary.successfullyImported = validEntities.length;
      } catch (dbError: any) {
        batch.criticalError = `Database error during customer bulk insert: ${dbError.message}`;
        summary.successfullyImported = 0;
        summary.failedRowsCount = batch.payload.length;
        batch.errorDetails = batch.payload.map((p, i) => ({
          row: i + 1,
          data: p,
          error: 'Transaction failed.',
        }));
        return;
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  /**
   * Logique complète pour l'importation des fournisseurs.
   */
  private async processSupplierImport(batch: ImportBatch): Promise<void> {
    const suppliersToImport: CreateSupplierInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: suppliersToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];
    const validEntities: Partial<Supplier>[] = [];

    // Pre-validation pour l'efficacité
    const emailsToImport = suppliersToImport.map((s) => s.email).filter(Boolean);
    const currencyIds = Array.from(
      new Set(suppliersToImport.map((s) => s.defaultCurrencyId).filter((id) => id)),
    );
    const addressIds = Array.from(
      new Set(suppliersToImport.map((s) => s.addressId).filter((id) => id)),
    );

    const [existingSuppliers, existingCurrencies, existingAddresses] = await Promise.all([
      emailsToImport.length
        ? appDataSource.getRepository(SupplierEntity).find({ where: { email: In(emailsToImport) } })
        : [],
      currencyIds.length
        ? appDataSource.getRepository(Currency).find({ where: { id: In(currencyIds) } })
        : [],
      addressIds.length
        ? appDataSource.getRepository(Address).find({ where: { id: In(addressIds) } })
        : [],
    ]);
    const existingEmails = new Set(existingSuppliers.map((s) => s.email));
    const existingCurrencyIds = new Set(existingCurrencies.map((c) => c.id));
    const existingAddressIds = new Set(existingAddresses.map((a) => a.id));

    // Validation ligne par ligne
    for (let index = 0; index < suppliersToImport.length; index++) {
      const supplierInput = suppliersToImport[index];
      try {
        if (
          !supplierInput.name ||
          !supplierInput.email ||
          !supplierInput.addressId ||
          !supplierInput.defaultCurrencyId
        ) {
          throw new Error('Missing required fields: name, email, addressId, defaultCurrencyId.');
        }
        if (existingEmails.has(supplierInput.email)) {
          throw new Error(`Email '${supplierInput.email}' already exists for another supplier.`);
        }
        if (!existingAddressIds.has(supplierInput.addressId)) {
          throw new Error(`Address ID '${supplierInput.addressId}' does not exist.`);
        }
        if (!existingCurrencyIds.has(supplierInput.defaultCurrencyId)) {
          throw new Error(`Currency ID '${supplierInput.defaultCurrencyId}' does not exist.`);
        }

        const supplierEntity = this.supplierRepository.create({
          ...supplierInput,
          createdByUserId: batch.createdByUserId,
          updatedByUserId: batch.createdByUserId,
        });
        if (!supplierEntity.isValid()) {
          throw new Error(`Validation failed: ${supplierValidationInputErrors.join('; ')}`);
        }
        validEntities.push(supplierEntity);
        existingEmails.add(supplierInput.email);
      } catch (error: any) {
        failedRows.push({ row: index + 1, data: supplierInput, error: error.message });
      }
    }

    if (failedRows.length > 0) {
      summary.successfullyImported = 0;
    } else if (validEntities.length > 0) {
      try {
        await appDataSource.transaction(async (manager) => {
          await manager.save(validEntities);
        });
        summary.successfullyImported = validEntities.length;
      } catch (dbError: any) {
        batch.criticalError = `Database error during supplier bulk insert: ${dbError.message}`;
        summary.successfullyImported = 0;
        summary.failedRowsCount = batch.payload.length;
        batch.errorDetails = batch.payload.map((p, i) => ({
          row: i + 1,
          data: p,
          error: 'Transaction failed.',
        }));
        return;
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private async processProductImport(batch: ImportBatch): Promise<void> {
    const productsToImport: CreateProductInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: productsToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];
    const validEntities: Partial<Product>[] = [];

    const skusToImport = productsToImport.map((p) => p.sku).filter(Boolean);
    const categoryIdsToImport = Array.from(
      new Set(productsToImport.map((p) => p.productCategoryId).filter((id) => id)),
    );

    const [existingProducts, existingCategories] = await Promise.all([
      skusToImport.length > 0
        ? appDataSource.getRepository(ProductEntity).find({ where: { sku: In(skusToImport) } })
        : [],
      categoryIdsToImport.length > 0
        ? appDataSource
            .getRepository(ProductCategoryEntity)
            .find({ where: { id: In(categoryIdsToImport) } })
        : [],
    ]);
    const existingSkus = new Set(existingProducts.map((p) => p.sku));
    const existingCategoryIds = new Set(existingCategories.map((c) => c.id));

    productsToImport.forEach((productInput, index) => {
      try {
        if (
          !productInput.sku ||
          !productInput.name ||
          !productInput.productCategoryId ||
          !productInput.unitOfMeasure
        ) {
          throw new Error('Missing required fields: sku, name, productCategoryId, unitOfMeasure.');
        }
        if (existingSkus.has(productInput.sku)) {
          throw new Error(`SKU '${productInput.sku}' already exists.`);
        }
        if (!existingCategoryIds.has(productInput.productCategoryId)) {
          throw new Error(
            `Product Category ID '${productInput.productCategoryId}' does not exist.`,
          );
        }

        const productEntity = this.productRepository.create({
          ...productInput,
          createdByUserId: batch.createdByUserId,
          updatedByUserId: batch.createdByUserId,
        });
        if (!productEntity.isValid())
          throw new Error(`Validation failed: ${productValidationInputErrors.join('; ')}`);
        validEntities.push(productEntity);
        existingSkus.add(productInput.sku);
      } catch (error: any) {
        failedRows.push({ row: index + 1, data: productInput, error: error.message });
      }
    });

    if (failedRows.length > 0) {
      summary.successfullyImported = 0;
    } else if (validEntities.length > 0) {
      try {
        await appDataSource.transaction(async (manager) => {
          await manager.save(validEntities);
        });
        summary.successfullyImported = validEntities.length;
      } catch (dbError: any) {
        batch.criticalError = `Database error during product bulk insert: ${dbError.message}`;
        summary.successfullyImported = 0;
        summary.failedRowsCount = batch.payload.length;
        batch.errorDetails = batch.payload.map((p, i) => ({
          row: i + 1,
          data: p,
          error: 'Transaction failed due to database error.',
        }));
        return;
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private async processProductCategoryImport(batch: ImportBatch): Promise<void> {
    const categoriesToImport: CreateProductCategoryInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: categoriesToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];
    const validEntities: Partial<ProductCategory>[] = [];

    const categoryNamesToImport = categoriesToImport.map((c) => c.name).filter(Boolean);
    const existingCategories = await appDataSource.getRepository(ProductCategoryEntity).find({
      where: { name: In(categoryNamesToImport) },
    });
    const existingCategoryNames = new Set(existingCategories.map((c) => c.name));

    categoriesToImport.forEach((catInput, index) => {
      try {
        if (!catInput.name) throw new Error('Category name is required.');
        if (existingCategoryNames.has(catInput.name))
          throw new Error(`Category name '${catInput.name}' already exists.`);

        const categoryEntity = this.categoryRepository.create({ ...catInput });
        if (!categoryEntity.isValid())
          throw new Error(`Validation failed: ${productCategoryValidationInputErrors.join('; ')}`);
        validEntities.push(categoryEntity);
        existingCategoryNames.add(catInput.name);
      } catch (error: any) {
        failedRows.push({ row: index + 1, data: catInput, error: error.message });
      }
    });

    if (failedRows.length > 0) {
      summary.successfullyImported = 0;
    } else if (validEntities.length > 0) {
      try {
        await appDataSource.transaction(async (manager) => {
          await manager.save(validEntities);
        });
        summary.successfullyImported = validEntities.length;
      } catch (dbError: any) {
        batch.criticalError = `Database error during category bulk insert: ${dbError.message}`;
        summary.successfullyImported = 0;
        summary.failedRowsCount = batch.payload.length;
        batch.errorDetails = batch.payload.map((p, i) => ({
          row: i + 1,
          data: p,
          error: 'Transaction failed due to database error.',
        }));
        return;
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private async processOpeningStockImport(batch: ImportBatch): Promise<void> {
    type OpeningStockItem = {
      productId: number;
      productVariantId?: number | null;
      locationId: number;
      locationType: 'warehouse' | 'shop';
      quantity: number;
      unitCost: number;
    };

    const stockItemsToImport: OpeningStockItem[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: stockItemsToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];

    for (let i = 0; i < stockItemsToImport.length; i++) {
      const itemInput = stockItemsToImport[i];
      const rowIndex = i + 1;
      try {
        if (itemInput.quantity <= 0)
          throw new Error('Quantity must be positive for opening stock.');
        if (!itemInput.locationId || !itemInput.locationType)
          throw new Error('locationId and locationType are required.');
        if(batch.createdByUserId) {
        const movementInput: CreateStockMovementInput = {
          productId: itemInput.productId,
          productVariantId: itemInput.productVariantId,
          warehouseId: itemInput.locationType === 'warehouse' ? itemInput.locationId : null,
          shopId: itemInput.locationType === 'shop' ? itemInput.locationId : null,
          movementType: StockMovementType.MANUAL_ENTRY_IN,
          quantity: itemInput.quantity,
          unitCostAtMovement: itemInput.unitCost,
          userId: batch.createdByUserId,
          referenceDocumentType: 'opening_stock_import',
          referenceDocumentId: null,
          notes: `Opening stock for row ${rowIndex} of import batch ${batch.id}.`,
        };
        await this.stockMovementService.createMovement(movementInput);
        }

        summary.successfullyImported++;
      } catch (error: any) {
        failedRows.push({ row: rowIndex, data: itemInput, error: error.message });
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private async processSalesOrderImport(batch: ImportBatch): Promise<void> {
    const ordersToImport: CreateSalesOrderInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: ordersToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];

    // Pour les commandes, il est plus sûr de les traiter une par une dans une transaction
    // car chaque commande peut avoir de multiples dépendances.
    for (let i = 0; i < ordersToImport.length; i++) {
      const orderInput = ordersToImport[i];
      const rowIndex = i + 1;
      try {
        if(batch.createdByUserId)
        await this.salesOrderService.createSalesOrder(orderInput, batch.createdByUserId);
        if (!orderInput.customerId || !orderInput.items || orderInput.items.length === 0) {
          throw new Error('Missing customerId or items.');
        }
        logger.info(`(Simulation) Importing Sales Order for customer ${orderInput.customerId}`);
        summary.successfullyImported++;
      } catch (error: any) {
        failedRows.push({ row: rowIndex, data: orderInput, error: error.message });
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private async processPurchaseOrderImport(batch: ImportBatch): Promise<void> {
    const ordersToImport: CreatePurchaseOrderInput[] = batch.payload;
    const summary: ImportSummary = {
      totalRows: ordersToImport.length,
      successfullyImported: 0,
      failedRowsCount: 0,
    };
    const failedRows: FailedRowDetail[] = [];

    for (let i = 0; i < ordersToImport.length; i++) {
      const orderInput = ordersToImport[i];
      const rowIndex = i + 1;
      try {
        if(batch.createdByUserId) {
          await this.purchaseOrderService.createPurchaseOrder(orderInput, batch.createdByUserId);
        }
        if (!orderInput.supplierId || !orderInput.items || orderInput.items.length === 0) {
          throw new Error('Missing supplierId or items.');
        }
        logger.info(`(Simulation) Importing Purchase Order for supplier ${orderInput.supplierId}`);
        summary.successfullyImported++;
      } catch (error: any) {
        failedRows.push({ row: rowIndex, data: orderInput, error: error.message });
      }
    }

    summary.failedRowsCount = failedRows.length;
    batch.summary = summary;
    batch.errorDetails = failedRows.length > 0 ? failedRows : null;
  }

  private mapToApiResponse(batch: ImportBatch | null): ImportBatchApiResponse | null {
    if (!batch) return null;
    return batch.toApi();
  }
}
