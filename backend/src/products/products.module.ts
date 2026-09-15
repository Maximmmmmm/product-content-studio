import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminProductsController } from './admin-products.controller.js';
import { ProductsService } from './products.service.js';
import { PublicProductsController } from './public-products.controller.js';

@Module({
  // AuthModule provides JwtCookieGuard, used by AdminProductsController.
  imports: [AuthModule],
  controllers: [AdminProductsController, PublicProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
