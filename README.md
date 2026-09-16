# Product Content Studio

A small product-content editor for an online shop, built for the Junior Full Stack technical
assignment (`test-task-junior.md`).

A manager signs in to a protected admin area, edits a product's description and SEO fields,
and publishes it. Visitors see a catalogue of published products and can open each product's
page. Draft products are not reachable publicly — not by URL and not through the public API.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | NestJS 12 (TypeScript 6, ESM) in `backend/` |
| Frontend | Next.js 16 App Router (React 19, Tailwind v4) in `frontend/` |
| Database | SQLite via Prisma 6.19.3 |
| Auth | JWT in an httpOnly cookie |
| Validation | class-validator + a global `ValidationPipe` |
| Tests | Vitest — Supertest e2e on the backend, React Testing Library on the frontend |
| Tooling | ESLint + Prettier, npm |

The reasoning behind each choice, with the alternatives that were rejected, is in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Prerequisites

- **Node.js 22 or newer** (developed and verified on 24.21.0)
- **npm 10 or newer** (verified on 12.0.2)

No database server, Docker, or external service is required. SQLite is a file.

---

## Setup

The two applications install separately. **Copy the environment file before installing** —
the backend's `postinstall` runs `prisma generate`, which reads `DATABASE_URL`.

### 1. Backend

```bash
cd backend
cp .env.example .env          # must come first
npm install                   # also runs `prisma generate`
npx prisma migrate deploy     # creates prisma/dev.db and applies migrations
npm run prisma:seed           # creates the admin and three demo products
npm run start:dev             # http://localhost:3001
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Then open **http://localhost:3000**.

> **Note on the first `npm install`:** npm 12 blocks dependency lifecycle scripts by default,
> so Prisma's engine binaries are not downloaded during install. Prisma fetches them
> automatically on the first CLI command instead (about 40 MB), which means the first
> `npx prisma` command needs network access. Nothing else is affected.

---

## Signing in

The seed creates one administrator from the values in `backend/.env`. With the defaults copied
from `.env.example`:

| | |
|---|---|
| URL | http://localhost:3000/admin/login |
| Email | `admin@example.com` |
| Password | `ChangeMe123!` |

These are development defaults, not a real credential: the account is created locally on your
machine from whatever your `.env` contains. Change `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
and re-run the seed to use different ones. `backend/.env` is git-ignored and no real secret is
committed.

### Demo data

Three products are seeded — two **published** and one **draft**, as the assignment requires:

| Product | Status |
|---|---|
| Aurora Wireless Headphones | published |
| Terra Ceramic Pour-Over Set | published |
| Nimbus Standing Desk Mat | **draft** |

The draft is the one to check: it appears in the admin list, but
`/products/nimbus-standing-desk-mat` returns 404 and it never appears in the catalogue.

---

## Running the tests

From the repository root, this runs all 76 tests — backend unit, backend end-to-end, and
frontend component tests:

```bash
npm test
```

Individually:

```bash
npm run test:backend        # unit
npm run test:backend:e2e    # end-to-end (creates and deletes its own throwaway database)
npm run test:frontend       # React component tests
npm run lint                # both apps
npm run typecheck           # both apps
```

No test needs a running server, a network connection, or an API key. The e2e suite builds
`backend/prisma/test.db`, applies the real migrations, seeds it with its own administrator,
and deletes it afterwards, so your development data is never touched.

### Why these tests

The assignment asks for the reasoning, so:

**The backbone is backend e2e over real HTTP against a real database.** Almost everything the
assignment actually requires is an HTTP-level fact — "invalid data is not saved, including
through direct API requests", "a draft is unavailable through the public API", "administrative
data is unavailable without authorisation". Those are claims about what the server does when
someone bypasses the UI entirely, so testing them below the HTTP layer would prove the wrong
thing. Supertest against a real SQLite database exercises the guard, the validation pipe, the
DTO and the query together.

**A rejected write is checked against the stored row, not just the status code.** A 400
response does not prove nothing was written, so the tests that matter re-read the record and
compare it.

**Frontend tests cover only what is genuinely client-side logic** — chiefly that a failed save
keeps the user's edits and is never shown as success. That behaviour lives entirely in React
state and no backend test can see it.

**Some properties are enforced statically instead of by tests.** `dangerouslySetInnerHTML` is
an ESLint *error* (`react/no-danger`), so content cannot be rendered as markup anywhere,
including in components not yet written. A lint rule beats a test here because it covers
future code.

**The important tests were mutation-tested** — deliberately broken to confirm they fail. A
green suite only means something if its tests can go red:

| Mutation | Result |
|---|---|
| `@MaxLength(60)` → `@MaxLength(61)` | exactly 1 failure (`rejects 61 characters`) |
| failed save resets the form | exactly 2 failures (both data-preservation tests) |
| remove the `X-Powered-By` fix | exactly 1 failure |

**No Playwright / browser E2E.** It was judged disproportionate to the time budget. The gap
this leaves is stated honestly under [Known limitations](#known-limitations).

---

## Project structure

```
backend/
  src/
    app-setup.ts            shared HTTP config, used by main.ts AND the e2e tests
    auth/                   login, logout, /auth/me, JwtCookieGuard
    products/               admin + public controllers, service, update DTO
    prisma/                 PrismaService
  prisma/
    schema.prisma           User, Product
    seed.ts                 admin + 3 demo products (idempotent)
  test/                     e2e specs, shared test app factory, global setup

frontend/
  app/
    page.tsx                public catalogue
    products/[slug]/        public product page + generateMetadata
    admin/login/            sign-in
    admin/products/         list and editor
    error.tsx               error boundary for the public pages
  lib/
    api.ts                  browser API client (sends the cookie)
    server-api.ts           server-side client for public pages (no cookie)
    use-api-resource.ts     shared admin data-loading hook
  test/                     React Testing Library specs

docs/
  DECISIONS.md              every material decision, with rejected alternatives
  IMPLEMENTATION-PLAN.md    phase-by-phase record and verification results
  TECHNICAL-REVIEW.md       interview checklist
AI-WORKLOG.md               how AI was used, and what was rejected
```

---

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | – | Verify credentials, set the session cookie |
| `POST` | `/auth/logout` | – | Clear the cookie |
| `GET` | `/auth/me` | cookie | Current administrator |
| `GET` | `/admin/products` | cookie | List: id, name, status |
| `GET` | `/admin/products/:id` | cookie | Full record for the editor |
| `PATCH` | `/admin/products/:id` | cookie | Update description, SEO fields, status |
| `GET` | `/products` | – | Published products only |
| `GET` | `/products/:slug` | – | One published product, otherwise 404 |
| `GET` | `/health` | – | Liveness check |

### Validation rules

Enforced on the server for every save, including direct API calls:

| Field | Rule |
|---|---|
| `description` | non-empty, ≤ 1000 characters |
| `seoTitle` | non-empty, ≤ 60 characters |
| `seoDescription` | non-empty, ≤ 160 characters |
| `status` | `draft` or `published` |

Values are trimmed before validation, so `"   "` is rejected as empty. `name`,
`characteristics`, `slug` and `id` are **not** on the update DTO, so sending them returns
`400 property … should not exist` rather than being silently ignored.

Try it against a running backend:

```bash
# log in and keep the cookie
curl -c jar.txt -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'

# a draft is invisible publicly
curl -i http://localhost:3001/products/nimbus-standing-desk-mat   # 404

# admin data requires the cookie
curl -i http://localhost:3001/admin/products                       # 401
```

---

## Security notes

- **Authorisation is enforced only on the server.** Every admin route sits behind a
  controller-level guard. The frontend hiding a page is a convenience, never a control.
- **The session is an httpOnly cookie** (`SameSite=Lax`, `Secure` in production, expiry derived
  from the token's own `exp`). Page JavaScript cannot read it, so an XSS cannot steal it. The
  token never appears in a response body.
- **Passwords are bcrypt hashes** (cost 12). An unknown email and a wrong password return an
  identical message *and* take the same time — bcrypt runs against a throwaway hash when no
  user is found, so response timing cannot be used to discover which accounts exist.
- **Drafts return 404, never 403**, with the same body as an unknown slug: a 403 would confirm
  that a draft exists at that URL.
- **Product content is stored verbatim and escaped at render.** There is no input sanitiser to
  get wrong, and `react/no-danger` prevents any component from rendering it as markup.
- **No CSRF token, deliberately** — `SameSite=Lax` and single-origin CORS block it
  independently. The reasoning is in `docs/DECISIONS.md` §4b.
- **Secrets stay server-side.** The built client bundle was searched for the admin password and
  JWT secret: no matches.

---

## Verification performed

Results from the final run (see `docs/IMPLEMENTATION-PLAN.md` for per-phase detail):

| Check | Result |
|---|---|
| Backend unit tests | 1/1 passing |
| Backend e2e tests | 65/65 passing |
| Frontend component tests | 10/10 passing |
| `npm run lint` (backend) | 0 errors |
| `npm run lint` (frontend) | 0 errors |
| `npm run typecheck` (frontend) | clean |
| `npm run build` (both) | clean |
| `npm audit` (both) | 0 vulnerabilities |

Manually verified against running servers, beyond the suites:

- Persistence across a real restart — a saved change survived stopping the process, confirming
  no listener remained, and cold-starting a new one.
- A stored XSS payload (`<script>`, `<img onerror>`, and a `">` attribute breakout in the SEO
  description) rendered as visible text: zero live script elements, fully escaped `<title>`
  and `<meta>`.
- Page metadata matched the stored SEO fields byte-for-byte.
- Production mode (`NODE_ENV=production`) produced `HttpOnly; Secure; SameSite=Lax`.
- SQL-injection payloads through the public slug parameter returned 404 with the data intact.
- Oversized bodies returned 413 and an oversized cookie 431, so neither reaches app code.
- A genuine 500 returned `{"statusCode":500,"message":"Internal server error"}` with no stack,
  table names or file paths.

---

## Known limitations

Stated rather than hidden. None of these are required by the assignment.

- **Logout does not revoke an issued token.** The session is a stateless JWT, so logout clears
  the cookie but a token already copied elsewhere stays valid until it expires (one hour by
  default). A server-side session store would be the fix. There is an e2e test asserting this
  real behaviour, so adding revocation later will fail it and force the docs to be updated.
- **No login rate limiting.** Brute-force protection would need another dependency.
- **No automated browser test.** There is no Playwright click-through of login → edit → save,
  and the responsive layout has not been verified in a real browser at mobile width. The
  editor's behaviour is covered by component tests and its API by the e2e suite, but "it looks
  right in a browser" is asserted by neither.
- **SQLite has no enum type**, so `status` is a validated string rather than a database-level
  constraint. PostgreSQL would give a real enum.
- **`Secure` cookies require HTTPS**, so a production deployment must terminate TLS.
- **Single administrator, no roles**, as the assignment specifies. No registration or password
  recovery.

## Not implemented

All bonus items are out of scope for this submission: LLM generation, Shopify import, the
Figma workflow, and Docker/CI. The mandatory scope is complete.

---

## Time spent

<!-- Replace with your actual figure before submitting. -->
_To be completed by the candidate._

The planned breakdown, for reference, was roughly: setup and tooling 0.75 h, database and seed
1 h, authentication 1.25 h, product API 1.25 h, admin UI 1.5 h, public pages 0.75 h, security
audit 0.75 h, documentation 0.75 h — about 8 hours in total.

---

## AI usage

AI (Claude Code, Opus 5) was used throughout, as the assignment requires. `AI-WORKLOG.md`
records what it generated, what was reviewed, changed or **rejected**, and how each result was
verified — including a test that was thrown away for passing regardless of the behaviour it
claimed to check, and a verification step that turned out to have proved nothing.
