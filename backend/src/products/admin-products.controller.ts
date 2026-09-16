import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import {
  AdminProduct,
  AdminProductListItem,
  ProductsService,
} from './products.service.js';

// Guarded at controller level so a new route here cannot be added unprotected.
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
