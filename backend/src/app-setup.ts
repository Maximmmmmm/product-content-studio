import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);

  (app as NestExpressApplication)
    .getHttpAdapter()
    .getInstance()
    .disable?.('x-powered-by');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  return app;
}
