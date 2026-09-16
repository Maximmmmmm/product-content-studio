import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bodyOf, createTestApp } from './create-test-app.js';

describe('Security (e2e)', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('information disclosure', () => {
    it('does not advertise the server stack via X-Powered-By', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('does not leak internals in a 404 body', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/definitely-not-a-product')
        .expect(404);

      const body = JSON.stringify(bodyOf<unknown>(response));
      expect(body).not.toMatch(/prisma/i);
      expect(body).not.toMatch(/sqlite/i);
      expect(body).not.toMatch(/\.ts|\.js/);
      expect(body).not.toMatch(/at \w+ \(/); // a stack frame
    });
  });

  describe('SQL injection', () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE Product;--",
      "x' UNION SELECT passwordHash FROM User--",
      "' OR 1=1--",
    ];

    it.each(payloads)(
      'treats %j as an ordinary slug, not as SQL',
      async (payload) => {
        const response = await request(app.getHttpServer())
          .get(`/products/${encodeURIComponent(payload)}`)
          .expect(404);

        expect(JSON.stringify(bodyOf<unknown>(response))).not.toMatch(
          /\$2[aby]\$/,
        );
      },
    );

    it('leaves the data intact after those attempts', async () => {
      expect(await prisma.product.count()).toBe(3);
      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('request limits', () => {
    it('rejects an oversized request body rather than processing it', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'x'.repeat(200_000) })
        .expect(413);
    });
  });

  describe('password handling', () => {
    it('stores the administrator password only as a bcrypt hash', async () => {
      const user = await prisma.user.findFirstOrThrow();

      expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(user.passwordHash).toHaveLength(60);
      expect(user.passwordHash).not.toContain('e2e-password-123');
    });
  });
});
