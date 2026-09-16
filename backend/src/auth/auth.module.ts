import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtCookieGuard } from './jwt-cookie.guard.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtCookieGuard],
  exports: [AuthService, JwtCookieGuard],
})
export class AuthModule {}
