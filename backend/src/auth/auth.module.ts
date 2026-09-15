import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtCookieGuard } from './jwt-cookie.guard.js';

@Module({
  // The secret is passed per sign/verify call in AuthService rather than being
  // registered here, so a missing JWT_SECRET fails loudly at use time with a
  // clear message instead of silently registering an undefined secret.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtCookieGuard],
  exports: [AuthService, JwtCookieGuard],
})
export class AuthModule {}
