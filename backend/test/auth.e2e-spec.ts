import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import {
  AdminBody,
  bodyOf,
  cookiesFrom,
  createTestApp,
  ErrorBody,
} from './create-test-app.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
      .expect(200);

    const cookie = cookiesFrom(response).find((c) => c.startsWith('session='));
    expect(cookie).toBeDefined();
    return cookie!;
  }

  describe('POST /auth/login', () => {
    it('accepts valid credentials and sets an httpOnly session cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
        .expect(200);

      const cookie = cookiesFrom(response).find((c) =>
        c.startsWith('session='),
      );

      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const admin = bodyOf<AdminBody>(response);
      expect(admin.email).toBe(TEST_ADMIN_EMAIL);
      expect(typeof admin.id).toBe('string');
      expect(admin.id.length).toBeGreaterThan(0);
    });

    it('never returns the token in the response body', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
        .expect(200);

      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/eyJ/); // a JWT always starts with this
      expect(response.body).not.toHaveProperty('token');
      expect(response.body).not.toHaveProperty('accessToken');
    });

    it('never returns the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
        .expect(200);

      expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: 'definitely-wrong' })
        .expect(401);
    });

    it('returns an identical message for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: 'definitely-wrong' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: TEST_ADMIN_PASSWORD })
        .expect(401);

      expect(bodyOf<ErrorBody>(wrongPassword).message).toEqual(
        bodyOf<ErrorBody>(unknownEmail).message,
      );
    });

    it('sets no cookie when authentication fails', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL, password: 'definitely-wrong' })
        .expect(401);

      expect(
        cookiesFrom(response).filter((c) => c.startsWith('session=')),
      ).toHaveLength(0);
    });

    it('rejects a malformed email with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: TEST_ADMIN_PASSWORD })
        .expect(400);
    });

    it('rejects a missing password with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_ADMIN_EMAIL })
        .expect(400);
    });

    it('rejects unknown properties in the payload with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: TEST_ADMIN_EMAIL,
          password: TEST_ADMIN_PASSWORD,
          isAdmin: true,
        })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the admin when a valid session cookie is sent', async () => {
      const cookie = await login();

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      const admin = bodyOf<AdminBody>(response);
      expect(admin.email).toBe(TEST_ADMIN_EMAIL);
      expect(typeof admin.id).toBe('string');
    });

    it('rejects a request with no cookie with 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rejects a tampered token with 401', async () => {
      const cookie = await login();
      const tampered = cookie.replace(
        /session=([^;]+)/,
        (_match, token: string) =>
          `session=${token.slice(0, -1)}${token.slice(-1) === 'a' ? 'b' : 'a'}`,
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', tampered)
        .expect(401);
    });

    it('rejects a token signed with a different secret with 401', async () => {
      const foreign =
        'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJhdHRhY2tlciIsImVtYWlsIjoiYXR0YWNrZXJAZXhhbXBsZS5jb20ifQ.' +
        'thisSignatureWasNotProducedByOurSecret';

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', foreign)
        .expect(401);
    });

    it('rejects a garbage cookie value with 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'session=not-a-jwt-at-all')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('instructs the browser to drop the session cookie', async () => {
      const cookie = await login();

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      const logout = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      const cleared = cookiesFrom(logout).find((c) => c.startsWith('session='));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/session=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    });

    it('a browser following the clear-cookie instruction loses access', async () => {
      await login();

      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('does NOT revoke an already-issued token (known stateless-JWT limitation)', async () => {
      const cookie = await login();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);
    });
  });
});
