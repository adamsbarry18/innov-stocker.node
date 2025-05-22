import { type DataSource, type Repository, IsNull, Not, type UpdateResult } from 'typeorm';
import { appDataSource } from '@/database/data-source';
import { ProductImage } from '../models/product-image.entity';
import { ServerError } from '@/common/errors/httpErrors';
import logger from '@/lib/logger';

export class ProductImageRepository {
  private readonly repository: Repository<ProductImage>;

  constructor(dataSource: DataSource = appDataSource) {
    this.repository = dataSource.getRepository(ProductImage);
  }

  async findById(id: number): Promise<ProductImage | null> {
    try {
      return await this.repository.findOne({ where: { id, deletedAt: IsNull() } });
    } catch (error) {
      logger.error({ message: `Error finding product image by id ${id}`, error });
      throw new ServerError('Error finding product image.');
    }
  }

  async findByProductId(productId: number): Promise<ProductImage[]> {
    try {
      return await this.repository.find({
        where: { productId, deletedAt: IsNull() },
        order: { isPrimary: 'DESC', createdAt: 'ASC' },
      });
    } catch (error) {
      logger.error({ message: `Error finding images for product ${productId}`, error });
      throw new ServerError('Error finding product images.');
    }
  }

  async findPrimaryByProductId(productId: number): Promise<ProductImage | null> {
    try {
      return await this.repository.findOne({
        where: { productId, isPrimary: true, deletedAt: IsNull() },
      });
    } catch (error) {
      logger.error({ message: `Error finding primary image for product ${productId}`, error });
      throw new ServerError('Error finding primary product image.');
    }
  }

  create(dto: Partial<ProductImage>): ProductImage {
    return this.repository.create(dto);
  }

  async save(image: ProductImage): Promise<ProductImage> {
    try {
      return await this.repository.save(image);
    } catch (error) {
      logger.error({ message: 'Error saving product image', error, image });
      throw new ServerError('Error saving product image.');
    }
  }

  async update(id: number, dto: Partial<ProductImage>): Promise<UpdateResult> {
    try {
      return await this.repository.update({ id, deletedAt: IsNull() }, dto);
    } catch (error) {
      logger.error({ message: `Error updating product image ${id}`, error, dto });
      throw new ServerError('Error updating product image.');
    }
  }

  async unsetPrimaryForOtherImages(productId: number, excludeImageId: number): Promise<void> {
    try {
      await this.repository.update(
        { productId, id: Not(excludeImageId), isPrimary: true, deletedAt: IsNull() },
        { isPrimary: false },
      );
    } catch (error) {
      logger.error({
        message: `Error unsetting primary for other images of product ${productId}`,
        error,
      });
      throw new ServerError('Error updating primary image status.');
    }
  }

  async softDelete(id: number): Promise<UpdateResult> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      logger.error({ message: `Error soft-deleting product image ${id}`, error });
      throw new ServerError('Error soft-deleting product image.');
    }
  }
}
