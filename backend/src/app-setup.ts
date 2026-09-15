import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/**
 * Applies the application's HTTP configuration.
 *
 * This lives outside `main.ts` on purpose: end-to-end tests build the app
 * through Nest's `TestingModule`, which never executes `main.ts`. Without a
 * shared function the tests would run against an app with no cookie parsing
 * and no validation pipe — that is, they would be testing a configuration that
 * never ships. Both entry points call this instead, so the two cannot drift.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);

  // Express advertises itself with `X-Powered-By: Express` by default. It
  // serves no purpose and tells anyone scanning the service exactly which
  // stack to look up known vulnerabilities for.
  (app as NestExpressApplication)
    .getHttpAdapter()
    .getInstance()
    .disable?.('x-powered-by');

  // Required so the auth guard can read the session cookie.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties that have no decorator in the DTO.
      whitelist: true,
      // Reject (rather than silently ignore) unknown properties, so a direct
      // API request cannot attempt to set fields the DTO does not expose.
      forbidNonWhitelisted: true,
      // Apply DTO types/transforms to incoming payloads.
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  return app;
}
