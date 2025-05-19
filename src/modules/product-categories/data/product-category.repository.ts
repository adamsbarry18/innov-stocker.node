import {
  type Repository,
  type DataSource,
  type FindOptionsWhere,
  IsNull,
  type UpdateResult,
  type FindManyOptions,
  type TreeRepository,
} from 'typeorm';
import { ProductCategory } from '../models/product-category.entity';
import { appDataSource } from '@/database/data-source';
import { BadRequestError, ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

interface FindAllProductCategoriesOptions {
  skip?: number;
  take?: number;
  where?: FindOptionsWhere<ProductCategory>;
  order?: FindManyOptions<ProductCategory>['order'];
  relations?: string[];
}

export class ProductCategoryRepository {
  private readonly repository: Repository<ProductCategory>;
  private readonly treeRepository: TreeRepository<ProductCategory>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ProductCategory);
    this.treeRepository = dataSource.manager.getTreeRepository(ProductCategory);
  }

  async findById(id: number, options?: { relations?: string[] }): Promise<ProductCategory | null> {
    try {
      return await this.repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: options?.relations,
      });
    } catch (error) {
      logger.error(`Error finding product category with id ${id}: ${error}`);
      throw new ServerError(`Error finding product category with id ${id}.`);
    }
  }

  async findByNameAndParent(
    name: string,
    parentCategoryId: number | null,
  ): Promise<ProductCategory | null> {
    try {
      const whereCondition: FindOptionsWhere<ProductCategory> = {
        name,
        deletedAt: IsNull(),
        parentCategoryId: parentCategoryId === null ? IsNull() : parentCategoryId,
      };
      return await this.repository.findOne({ where: whereCondition });
    } catch (error) {
      logger.error(`Error finding product category by name and parent: ${error}`);
      throw new ServerError(`Error finding product category by name and parent.`);
    }
  }

  async findAll(
    options: FindAllProductCategoriesOptions = {},
  ): Promise<{ categories: ProductCategory[]; count: number }> {
    try {
      const where = { ...options.where, deletedAt: IsNull() };
      const findOptions: FindManyOptions<ProductCategory> = {
        where,
        order: options.order || { name: 'ASC' },
        skip: options.skip,
        take: options.take,
        relations: options.relations,
      };
      const [categories, count] = await this.repository.findAndCount(findOptions);
      return { categories, count };
    } catch (error) {
      logger.error(`Error finding all product categories (flat list): ${error}`);
      throw new ServerError(`Error finding all product categories (flat list).`);
    }
  }

  async findTrees(options?: { relations?: string[] }): Promise<ProductCategory[]> {
    try {
      // findTrees loads all root categories and their descendants.
      // Relations specified are loaded for all entities in the tree.
      return await this.treeRepository.findTrees({
        // Now correctly calls on TreeRepository instance
        relations: options?.relations || ['children', 'parentCategory'], // Ensure children and parent context are loaded
      });
    } catch (error) {
      logger.error(`Error fetching product category trees: ${error}`);
      throw new ServerError(`Error fetching product category trees.`);
    }
  }

  // Alternative if you need a tree starting from a specific parent
  async findDescendantsTreeOf(parentCategory: ProductCategory): Promise<ProductCategory> {
    try {
      return await this.treeRepository.findDescendantsTree(parentCategory, {
        // Now correctly calls on TreeRepository instance
        relations: ['children', 'parentCategory'],
      });
    } catch (error) {
      logger.error(`Error fetching descendants tree for category ${parentCategory.id}: ${error}`);
      throw new ServerError(`Error fetching descendants tree for category ${parentCategory.id}.`);
    }
  }

  create(dto: Partial<ProductCategory>): ProductCategory {
    return this.repository.create(dto);
  }

  async save(category: ProductCategory): Promise<ProductCategory> {
    try {
      return await this.repository.save(category);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique_by_parent')
      ) {
        // Make sure BadRequestError is imported or handled appropriately
        throw new BadRequestError(
          `Product category with name '${category.name}' already exists under the specified parent.`,
        );
      }
      logger.error(`Error saving product category ${category.id || category.name}: ${error}`);
      throw new ServerError(`Error saving product category.`);
    }
  }

  async update(id: number, dto: Partial<ProductCategory>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error: any) {
      if (
        error.code === 'ER_DUP_ENTRY' ||
        error.message?.includes('UNIQUE constraint failed') ||
        error.message?.includes('name_unique_by_parent')
      ) {
        // Make sure BadRequestError is imported or handled appropriately
        throw new BadRequestError(
          `Cannot update: product category with name '${dto.name}' may already exist under the specified parent.`,
        );
      }
      logger.error(`Error updating product category with id ${id}: ${error}`);
      throw new ServerError(`Error updating product category with id ${id}.`);
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      // The check for usage by products should be done in the service layer before calling this.
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error(`Error soft-deleting product category with id ${id}: ${error}`);
      throw new ServerError(`Error soft-deleting product category with id ${id}.`);
    }
  }

  // This method should ideally be in ProductRepository or use a direct query.
  // For now, it's a placeholder as its direct implementation here is not ideal.
  async isCategoryUsedByProducts(categoryId: number): Promise<boolean> {
    logger.warn(
      'ProductCategoryRepository.isCategoryUsedByProducts is a placeholder and should be implemented using ProductRepository or a direct query.',
    );
    // Example (requires Product entity and repository):
    // const productRepository = this.repository.manager.getRepository(Product); // Assuming Product entity exists
    // const count = await productRepository.count({ where: { productCategoryId: categoryId, deletedAt: IsNull() }});
    // return count > 0;
    return false;
  }
}
