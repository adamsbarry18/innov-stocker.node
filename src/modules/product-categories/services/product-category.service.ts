// Assuming ProductRepository exists for checking usage, if not, this check needs adjustment.
// import { ProductRepository } from '../../products/data/product.repository';
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
import { BadRequestError, NotFoundError, ServerError } from '@/common/errors/httpErrors';

let instance: ProductCategoryService | null = null;

export class ProductCategoryService {
  private readonly categoryRepository: ProductCategoryRepository;
  // private readonly productRepository: ProductRepository; // For checking if category is in use

  constructor(
    categoryRepository: ProductCategoryRepository = new ProductCategoryRepository(),
    // productRepository: ProductRepository = new ProductRepository()
  ) {
    this.categoryRepository = categoryRepository;
    // this.productRepository = productRepository;
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
    tree?: boolean; // To fetch as a tree
    parentId?: number | null; // To fetch children of a specific parent or root categories
  }): Promise<
    { categories: ProductCategoryApiResponse[]; total?: number } | ProductCategoryApiResponse[]
  > {
    try {
      if (options?.tree) {
        const categoryTrees = await this.categoryRepository.findTrees({ relations: ['children'] });
        // Filter root nodes if parentId is explicitly null or not provided in conjunction with tree=true for root
        let rootCategories = categoryTrees;
        if (options.parentId === null) {
          // Explicitly request root categories for the tree
          rootCategories = categoryTrees.filter(
            (c) => c.parentCategoryId === null && c.deletedAt === null,
          );
        } else if (options.parentId !== undefined && options.parentId !== null) {
          // This case for tree=true and parentId might be complex; findTrees usually returns all trees from roots.
          // It might be better to fetch a specific subtree starting from parentId if TypeORM supports it well,
          // or fetch all and then filter, or fetch the parent and its children recursively.
          // For now, if tree=true and parentId is given, it's a bit ambiguous. Let's assume tree=true implies all trees.
          // If client wants children of parentId as a tree, they should fetch parent by ID with children.
        }
        return rootCategories
          .map((cat) => this.mapToApiResponse(cat, true))
          .filter(Boolean) as ProductCategoryApiResponse[];
      }

      const effectiveFilters = options?.filters ? { ...options.filters } : {};
      if (options?.parentId !== undefined) {
        effectiveFilters.parentCategoryId = options.parentId === null ? IsNull() : options.parentId;
      }

      const { categories, count } = await this.categoryRepository.findAll({
        where: effectiveFilters,
        skip: options?.offset,
        take: options?.limit,
        order: options?.sort || { name: 'ASC' }, // Default sort by name
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

  async create(
    input: CreateProductCategoryInput,
    createdByUserId?: number,
  ): Promise<ProductCategoryApiResponse> {
    const { name, parentCategoryId } = input;

    // Check for uniqueness (name per parent)
    const existingCategory = await this.categoryRepository.findByNameAndParent(
      name,
      parentCategoryId || null,
    );
    if (existingCategory) {
      throw new BadRequestError(
        `A category named '${name}' already exists under the specified parent.`,
      );
    }

    // Validate parentCategoryId if provided
    if (parentCategoryId) {
      const parentExists = await this.categoryRepository.findById(parentCategoryId);
      if (!parentExists) {
        throw new BadRequestError(`Parent category with ID ${parentCategoryId} not found.`);
      }
    }

    const categoryEntity = this.categoryRepository.create({
      ...input,
      // createdByUserId: createdByUserId // If audit on ProductCategory
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
      return apiResponse;
    } catch (error) {
      logger.error(`Error creating product category: ${error}`);
      if (error instanceof ServerError && error.message.includes('already exists')) {
        throw new BadRequestError(error.message);
      }
      throw new ServerError('Failed to create product category.');
    }
  }

  async update(
    id: number,
    input: UpdateProductCategoryInput,
    updatedByUserId?: number,
  ): Promise<ProductCategoryApiResponse> {
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

      // Validate parentCategoryId if provided and changed
      if (parentCategoryId !== undefined && parentCategoryId !== category.parentCategoryId) {
        if (parentCategoryId !== null) {
          const parentExists = await this.categoryRepository.findById(parentCategoryId);
          if (!parentExists) {
            throw new BadRequestError(`New parent category with ID ${parentCategoryId} not found.`);
          }
          // Prevent setting parent to itself or one of its descendants
          if (await this.isDescendant(parentCategoryId, id)) {
            throw new BadRequestError(
              "Cannot set a category's parent to itself or one of its descendants.",
            );
          }
        }
      }

      // Apply updates to a temporary instance for validation
      const tempCategoryData = { ...category, ...input };
      // Ensure parentCategoryId is correctly null if passed as such
      if (input.parentCategoryId === null) tempCategoryData.parentCategoryId = null;

      const tempCategory = this.categoryRepository.create(tempCategoryData);
      if (!tempCategory.isValid()) {
        throw new BadRequestError(
          `Updated product category data is invalid. Errors: ${productCategoryValidationInputErrors.join(', ')}`,
        );
      }

      const updatePayload: Partial<ProductCategory> = { ...input };
      // updatePayload.updatedByUserId = updatedByUserId; // If audit

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

  async delete(id: number, deletedByUserId?: number): Promise<void> {
    try {
      const category = await this.categoryRepository.findById(id);
      if (!category) throw new NotFoundError(`Product category with id ${id} not found.`);

      const isUsed = await this.categoryRepository.isCategoryUsedByProducts(id);
      if (isUsed) {
        throw new BadRequestError(
          `Category '${category.name}' is in use by products and cannot be deleted. Please reassign products first.`,
        );
      }

      await this.categoryRepository.softDelete(id);
    } catch (error) {
      logger.error(`Error deleting product category ${id}: ${error}`);
      if (error instanceof BadRequestError || error instanceof NotFoundError) throw error;
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
        // Should not happen if IDs are valid
        return false;
      }
      currentId = currentCategory.parentCategoryId;
    }
    return false;
  }

  static getInstance(): ProductCategoryService {
    if (!instance) {
      instance = new ProductCategoryService();
    }
    return instance;
  }
}
