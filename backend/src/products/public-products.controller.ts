import { Controller, Get, Param } from '@nestjs/common';
import {
  ProductsService,
  PublicProduct,
  PublicProductListItem,
} from './products.service.js';

/**
 * Public, unauthenticated product endpoints.
 *
 * Deliberately a separate controller from the admin one: the two have
 * different audiences and different response shapes, and keeping them apart
 * means the public routes cannot accidentally inherit an admin response or
 * lose their published-only filter.
 */
@Controller('products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(): Promise<PublicProductListItem[]> {
    return this.products.findPublished();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<PublicProduct> {
    return this.products.findPublishedBySlug(slug);
  }
}
