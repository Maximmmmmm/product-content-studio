import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  AdminProduct,
  AdminProductListItem,
  ProductsService,
} from './products.service.js';

/**
 * Administrative product endpoints.
 *
 * The guard is applied at the controller level so every route here is
 * protected by construction — a new endpoint cannot be added without
 * authentication by forgetting a decorator.
 */
@Controller('admin/products')
@UseGuards(JwtCookieGuard)
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(): Promise<AdminProductListItem[]> {
    return this.products.findAllForAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<AdminProduct> {
    return this.products.findOneForAdmin(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProduct> {
    return this.products.update(id, dto);
  }
}
