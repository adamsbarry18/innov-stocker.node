import logger from '@/lib/logger';
import { ProductCategoryRepository } from '../data/product-category.repository';
import {
  type CreateProductCategoryInput,
  type UpdateProductCategoryInput,
  type ProductCategoryApiResponse,
  type ProductCategory,
  productCategoryValidationInputErrors,
} from '../models/product-category.entity';

import { type FindManyOptions, type FindOptionsWhere, IsNull } from 'typeorm';
import {
  BadRequestError,
  DependencyError,
  NotFoundError,
  ServerError,
} from '@/common/errors/httpErrors';
import { UserActivityLogService } from '@/modules/user-activity-logs/services/user-activity-log.service';
import {
  ActionType,
  EntityType,
} from '@/modules/user-activity-logs/models/user-activity-log.entity';
import { Service, ResourcesKeys, dependency } from '@/common/utils/Service';

let instance: ProductCategoryService | null = null;

@dependency(ResourcesKeys.PRODUCT_CATEGORIES)
export class ProductCategoryService extends Service {
  private readonly categoryRepository: ProductCategoryRepository;
  constructor(categoryRepository: ProductCategoryRepository = new ProductCategoryRepository()) {
    super();
    this.categoryRepository = categoryRepository;
  }

  mapToApiResponse(
    category: ProductCategory | null,
    includeChildren = false,
  ): ProductCategoryApiResponse | null {
    if (!category) return null;
    return category.toApi(includeChildren);
  }

  async findById(id: number, includeChildren = false): Promise<ProductCategoryApiResponse> {
    try {
      const relations = includeChildren ? ['children'] : [];
      const category = await this.categoryRepository.findById(id, { relations });
      if (!category) throw new NotFoundError(`Product category with id ${id} not found.`);

      const apiResponse = this.mapToApiResponse(category, includeChildren);
      if (!apiResponse) {
        throw new ServerError(`Failed to map product category ${id} to API response.`);
      }
      return apiResponse;
    } catch (error) {
      logger.error(`Error finding product category by id ${id}: ${error}`);
      if (error instanceof NotFoundError) throw error;
      throw new ServerError(`Error finding product category by id ${id}.`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    filters?: FindOptionsWhere<ProductCategory>;
    sort?: FindManyOptions<ProductCategory>['order'];
    parentId?: number | null;
  }): Promise<
    { categories: ProductCategoryApiResponse[]; total?: number } | ProductCategoryApiResponse[]
  > {
    try {
      const { categories, count } = await this.categoryRepository.findAll({
        where: options?.filters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort ?? { name: 'ASC' },
      });
      const apiCategories = categories
        .map((cat) => this.mapToApiResponse(cat, false))
        .filter(Boolean) as ProductCategoryApiResponse[];
      return { categories: apiCategories, total: count };
    } catch (error) {
      logger.error(`Error finding all product categories: ${error}`);
      throw new ServerError('Error finding all product categories.');
    }
  }

  async create(input: CreateProductCategoryInput): Promise<ProductCategoryApiResponse> {
    const { name, parentCategoryId } = input;
    const existingCategory = await this.categoryRepository.findByNameAndParent(
      name,
      parentCategoryId ?? null,
    );
    if (existingCategory) {
      throw new BadRequestError(
        `A category named '${name}' already exists under the specified parent.`,
      );
    }
    if (parentCategoryId) {
      const parentExists = await this.categoryRepository.findById(parentCategoryId);
      if (!parentExists) {
        throw new BadRequestError(`Parent category with ID ${parentCategoryId} not found.`);
      }
    }

    const categoryEntity = this.categoryRepository.create({
      ...input,
    });

    if (!categoryEntity.isValid()) {
      throw new BadRequestError(
        `Product category data is invalid. Errors: ${productCategoryValidationInputErrors.join(', ')}`,
      );
    }

    try {
      const savedCategory = await this.categoryRepository.save(categoryEntity);
      const apiResponse = this.mapToApiResponse(savedCategory);
      if (!apiResponse) {
        throw new ServerError(
          `Failed to map newly created product category ${savedCategory.id} to API response.`,
        );
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.CREATE,
        EntityType.PRODUCT_MANAGEMENT,
        savedCategory.id.toString(),
        { categoryName: savedCategory.name, parentCategoryId: savedCategory.parentCategoryId },
      );

      return apiResponse;
    } catch (error) {
      logger.error(`Error creating product category: ${error}`);
      if (error instanceof ServerError && error.message.includes('already exists')) {
        throw new BadRequestError(error.message);
      }
      throw new ServerError('Failed to create product category.');
    }
  }

  async update(id: number, input: UpdateProductCategoryInput): Promise<ProductCategoryApiResponse> {
    try {
      const category = await this.categoryRepository.findById(id);
      if (!category) throw new NotFoundError(`Product category with id ${id} not found.`);

      const { name, parentCategoryId } = input;

      // Check for uniqueness if name or parentCategoryId is changing
      const newName = name !== undefined ? name : category.name;
      const newParentId =
        parentCategoryId !== undefined
          ? parentCategoryId === null
            ? null
            : parentCategoryId
          : category.parentCategoryId;

      if (
        (name !== undefined && name !== category.name) ||
        (parentCategoryId !== undefined && parentCategoryId !== category.parentCategoryId)
      ) {
        const existingCategory = await this.categoryRepository.findByNameAndParent(
          newName,
          newParentId,
        );
        if (existingCategory && existingCategory.id !== id) {
          throw new BadRequestError(
            `A category named '${newName}' already exists under the specified parent.`,
          );
        }
      }

      if (parentCategoryId !== undefined && parentCategoryId !== category.parentCategoryId) {
        if (parentCategoryId !== null) {
          const parentExists = await this.categoryRepository.findById(parentCategoryId);
          if (!parentExists) {
            throw new BadRequestError(`New parent category with ID ${parentCategoryId} not found.`);
          }
          if (await this.isDescendant(parentCategoryId, id)) {
            throw new BadRequestError(
              "Cannot set a category's parent to itself or one of its descendants.",
            );
          }
        }
      }

      const tempCategoryData = { ...category, ...input };
      if (input.parentCategoryId === null) tempCategoryData.parentCategoryId = null;

      const tempCategory = this.categoryRepository.create(tempCategoryData);
      if (!tempCategory.isValid()) {
        throw new BadRequestError(
          `Updated product category data is invalid. Errors: ${productCategoryValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<ProductCategory> = { ...input };

      const result = await this.categoryRepository.update(id, updatePayload);
      if (result.affected === 0) {
        throw new NotFoundError(
          `Product category with id ${id} not found during update (or no changes applied).`,
        );
      }

      const updatedCategory = await this.categoryRepository.findById(id);
      if (!updatedCategory)
        throw new ServerError('Failed to re-fetch product category after update.');

      const apiResponse = this.mapToApiResponse(updatedCategory);
      if (!apiResponse) {
        throw new ServerError(`Failed to map updated category ${id} to API response.`);
      }

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.UPDATE,
        EntityType.PRODUCT_MANAGEMENT,
        id.toString(),
        { updatedFields: Object.keys(input) },
      );

      return apiResponse;
    } catch (error) {
      logger.error(`Error updating product category ${id}: ${error}`);
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        (error instanceof ServerError && error.message.includes('already exist'))
      ) {
        throw error;
      }
      throw new ServerError(`Failed to update product category ${id}.`);
    }
  }

  async delete(id: number): Promise<void> {
    try {
      const category = await this.categoryRepository.findById(id);
      if (!category) throw new NotFoundError(`Product category with id ${id} not found.`);

      await this.checkAndDelete(id, async () => {
        await this.categoryRepository.softDelete(id);
      });

      await UserActivityLogService.getInstance().insertEntry(
        ActionType.DELETE,
        EntityType.PRODUCT_MANAGEMENT,
        id.toString(),
      );
    } catch (error) {
      logger.error(`Error deleting product category ${id}: ${error}`);
      if (
        error instanceof BadRequestError ||
        error instanceof NotFoundError ||
        error instanceof DependencyError
      )
        throw error;
      throw new ServerError(`Error deleting product category ${id}.`);
    }
  }

  /**
   * Checks if a category (potentialParentId) is a descendant of another category (categoryId).
   * Used to prevent circular dependencies.
   */
  private async isDescendant(potentialChildId: number, ancestorId: number): Promise<boolean> {
    let currentId: number | null = potentialChildId;
    while (currentId !== null) {
      if (currentId === ancestorId) {
        return true;
      }
      const currentCategory = await this.categoryRepository.findById(currentId);
      if (!currentCategory) {
        return false;
      }
      currentId = currentCategory.parentCategoryId;
    }
    return false;
  }

  static getInstance(): ProductCategoryService {
    instance ??= new ProductCategoryService();
    return instance;
  }
}
