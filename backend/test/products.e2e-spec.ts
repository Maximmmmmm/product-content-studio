import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { bodyOf, cookiesFrom, createTestApp } from './create-test-app.js';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup.js';

const PUBLISHED_SLUG = 'aurora-wireless-headphones';
const DRAFT_SLUG = 'nimbus-standing-desk-mat';

interface AdminListItem {
  id: string;
  name: string;
  status: string;
}

interface AdminProductBody {
  id: string;
  slug: string;
  name: string;
  characteristics: { label: string; value: string }[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: string;
}

interface PublicListItem {
  slug: string;
  name: string;
  seoDescription: string;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    description: 'A valid description.',
    seoTitle: 'A valid SEO title',
    seoDescription: 'A valid SEO description.',
    status: 'published',
    ...overrides,
  };
}

describe('Products (e2e)', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let cookie: string;
  let publishedId: string;
  let draftId: string;

  let snapshot: {
    id: string;
    description: string;
    seoTitle: string;
    seoDescription: string;
    status: string;
  }[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
      .expect(200);
    cookie = cookiesFrom(login).find((c) => c.startsWith('session='))!;

    snapshot = await prisma.product.findMany({
      select: {
        id: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        status: true,
      },
    });

    publishedId = (
      await prisma.product.findUniqueOrThrow({
        where: { slug: PUBLISHED_SLUG },
        select: { id: true },
      })
    ).id;
    draftId = (
      await prisma.product.findUniqueOrThrow({
        where: { slug: DRAFT_SLUG },
        select: { id: true },
      })
    ).id;
  });

  beforeEach(async () => {
    for (const row of snapshot) {
      await prisma.product.update({
        where: { id: row.id },
        data: {
          description: row.description,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          status: row.status,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authorization', () => {
    it('rejects the admin list without a session', async () => {
      await request(app.getHttpServer()).get('/admin/products').expect(401);
    });

    it('rejects the admin detail without a session', async () => {
      await request(app.getHttpServer())
        .get(`/admin/products/${publishedId}`)
        .expect(401);
    });

    it('rejects an update without a session', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .send(validPayload())
        .expect(401);
    });

    it('writes nothing when an update is rejected for being unauthenticated', async () => {
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });

      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .send(validPayload({ description: 'Injected by an anonymous request' }))
        .expect(401);

      const after = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });
      expect(after).toEqual(before);
    });
  });

  describe('GET /admin/products', () => {
    it('lists every product with name and status, including drafts', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/products')
        .set('Cookie', cookie)
        .expect(200);

      const items = bodyOf<AdminListItem[]>(response);
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.status).sort()).toEqual([
        'draft',
        'published',
        'published',
      ]);
      for (const item of items) {
        expect(typeof item.id).toBe('string');
        expect(typeof item.name).toBe('string');
      }
    });
  });

  describe('GET /admin/products/:id', () => {
    it('returns the full record with parsed characteristics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .expect(200);

      const product = bodyOf<AdminProductBody>(response);
      expect(product.slug).toBe(PUBLISHED_SLUG);
      expect(Array.isArray(product.characteristics)).toBe(true);
      expect(product.characteristics.length).toBeGreaterThan(0);
      expect(typeof product.characteristics[0].label).toBe('string');
      expect(typeof product.characteristics[0].value).toBe('string');
    });

    it('returns 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/admin/products/does-not-exist')
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  describe('PATCH /admin/products/:id — validation via direct API requests', () => {
    async function patch(payload: Record<string, unknown>) {
      return request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(payload);
    }

    it('accepts a valid payload', async () => {
      await patch(validPayload()).then((r) => expect(r.status).toBe(200));
    });

    describe('description', () => {
      it('rejects an empty description', async () => {
        await patch(validPayload({ description: '' })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('rejects a whitespace-only description', async () => {
        await patch(validPayload({ description: '     ' })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('accepts exactly 1000 characters', async () => {
        await patch(validPayload({ description: 'a'.repeat(1000) })).then((r) =>
          expect(r.status).toBe(200),
        );
      });

      it('rejects 1001 characters', async () => {
        await patch(validPayload({ description: 'a'.repeat(1001) })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('rejects a missing description', async () => {
        const payload = validPayload();
        delete (payload as Record<string, unknown>).description;
        await patch(payload).then((r) => expect(r.status).toBe(400));
      });
    });

    describe('seoTitle', () => {
      it('rejects an empty SEO title', async () => {
        await patch(validPayload({ seoTitle: '' })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('accepts exactly 60 characters', async () => {
        await patch(validPayload({ seoTitle: 'a'.repeat(60) })).then((r) =>
          expect(r.status).toBe(200),
        );
      });

      it('rejects 61 characters', async () => {
        await patch(validPayload({ seoTitle: 'a'.repeat(61) })).then((r) =>
          expect(r.status).toBe(400),
        );
      });
    });

    describe('seoDescription', () => {
      it('rejects an empty SEO description', async () => {
        await patch(validPayload({ seoDescription: '' })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('accepts exactly 160 characters', async () => {
        await patch(validPayload({ seoDescription: 'a'.repeat(160) })).then(
          (r) => expect(r.status).toBe(200),
        );
      });

      it('rejects 161 characters', async () => {
        await patch(validPayload({ seoDescription: 'a'.repeat(161) })).then(
          (r) => expect(r.status).toBe(400),
        );
      });
    });

    describe('status', () => {
      it('rejects a status outside draft/published', async () => {
        await patch(validPayload({ status: 'archived' })).then((r) =>
          expect(r.status).toBe(400),
        );
      });

      it('rejects a missing status', async () => {
        const payload = validPayload();
        delete (payload as Record<string, unknown>).status;
        await patch(payload).then((r) => expect(r.status).toBe(400));
      });
    });

    it('leaves the stored row byte-for-byte unchanged when validation fails', async () => {
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });

      await patch(
        validPayload({
          description: 'a'.repeat(1001),
          seoTitle: 'This should never be written',
        }),
      ).then((r) => expect(r.status).toBe(400));

      const after = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });
      expect(after).toEqual(before);
    });

    it('returns 404 when updating an unknown id', async () => {
      await request(app.getHttpServer())
        .patch('/admin/products/does-not-exist')
        .set('Cookie', cookie)
        .send(validPayload())
        .expect(404);
    });
  });

  describe('PATCH /admin/products/:id — read-only fields', () => {
    async function patch(payload: Record<string, unknown>) {
      return request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(payload);
    }

    it('rejects an attempt to change the name', async () => {
      await patch(validPayload({ name: 'Renamed By API' })).then((r) =>
        expect(r.status).toBe(400),
      );

      const after = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });
      expect(after.name).not.toBe('Renamed By API');
    });

    it('rejects an attempt to change the characteristics', async () => {
      await patch(
        validPayload({ characteristics: '[{"label":"x","value":"y"}]' }),
      ).then((r) => expect(r.status).toBe(400));
    });

    it('rejects an attempt to change the slug', async () => {
      await patch(validPayload({ slug: 'hijacked-slug' })).then((r) =>
        expect(r.status).toBe(400),
      );
    });

    it('rejects an attempt to change the id', async () => {
      await patch(validPayload({ id: 'some-other-id' })).then((r) =>
        expect(r.status).toBe(400),
      );
    });
  });

  describe('GET /products (public catalogue)', () => {
    it('returns only published products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      const items = bodyOf<PublicListItem[]>(response);
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.slug)).not.toContain(DRAFT_SLUG);
    });

    it('does not expose internal fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      for (const item of bodyOf<Record<string, unknown>[]>(response)) {
        expect(item).not.toHaveProperty('id');
        expect(item).not.toHaveProperty('status');
      }
    });
  });

  describe('GET /products/:slug (public detail)', () => {
    it('returns a published product', async () => {
      const response = await request(app.getHttpServer())
        .get(`/products/${PUBLISHED_SLUG}`)
        .expect(200);

      const product = bodyOf<Record<string, unknown>>(response);
      expect(product.slug).toBe(PUBLISHED_SLUG);
      expect(product).toHaveProperty('seoTitle');
      expect(product).toHaveProperty('seoDescription');
      expect(product).not.toHaveProperty('id');
      expect(product).not.toHaveProperty('status');
    });

    it('returns 404 — not 403 — for a draft', async () => {
      const response = await request(app.getHttpServer())
        .get(`/products/${DRAFT_SLUG}`)
        .expect(404);

      expect(response.status).not.toBe(403);
    });

    it('returns 404 for an unknown slug', async () => {
      await request(app.getHttpServer())
        .get('/products/no-such-product')
        .expect(404);
    });

    it('answers a draft and an unknown slug identically', async () => {
      const draft = await request(app.getHttpServer())
        .get(`/products/${DRAFT_SLUG}`)
        .expect(404);
      const unknown = await request(app.getHttpServer())
        .get('/products/no-such-product')
        .expect(404);

      expect(bodyOf<{ message: string }>(draft).message).toEqual(
        bodyOf<{ message: string }>(unknown).message,
      );
    });
  });

  describe('saved changes and visibility', () => {
    it('persists an update and serves it publicly', async () => {
      const description = 'Updated through the admin API at ' + Date.now();

      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(validPayload({ description }))
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/products/${PUBLISHED_SLUG}`)
        .expect(200);

      expect(bodyOf<{ description: string }>(response).description).toBe(
        description,
      );
    });

    it('publishing a draft makes it publicly visible', async () => {
      await request(app.getHttpServer())
        .get(`/products/${DRAFT_SLUG}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/admin/products/${draftId}`)
        .set('Cookie', cookie)
        .send(validPayload({ status: 'published' }))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/products/${DRAFT_SLUG}`)
        .expect(200);
    });

    it('unpublishing a product removes it from the public API', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(validPayload({ status: 'draft' }))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/products/${PUBLISHED_SLUG}`)
        .expect(404);

      const catalogue = await request(app.getHttpServer())
        .get('/products')
        .expect(200);
      expect(
        bodyOf<PublicListItem[]>(catalogue).map((i) => i.slug),
      ).not.toContain(PUBLISHED_SLUG);
    });

    it('stores and returns author content verbatim, without sanitising it', async () => {
      const payload = '<script>alert("xss")</script> & <b>bold</b>';

      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(validPayload({ description: payload }))
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/products/${PUBLISHED_SLUG}`)
        .expect(200);

      expect(bodyOf<{ description: string }>(response).description).toBe(
        payload,
      );
    });

    it('trims surrounding whitespace before storing', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/products/${publishedId}`)
        .set('Cookie', cookie)
        .send(validPayload({ description: '   Trimmed value   ' }))
        .expect(200);

      const stored = await prisma.product.findUniqueOrThrow({
        where: { id: publishedId },
      });
      expect(stored.description).toBe('Trimmed value');
    });
  });
});
