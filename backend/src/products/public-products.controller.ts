import { Controller, Get, Param } from '@nestjs/common';
import {
  ProductsService,
  PublicProduct,
  PublicProductListItem,
} from './products.service.js';

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
