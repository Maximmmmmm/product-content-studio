# Product Content Studio — Implementation Plan

## Purpose

This file is the persistent execution plan for the technical assignment in `test-task-junior.md`.

The plan prioritizes mandatory requirements over bonus work and keeps the implementation
proportional to the stated 6–8 hour budget.

## Working rules

- Complete one phase at a time.
- A phase is complete only after its verification steps actually ran and passed.
- Mark a checklist item complete only when it is implemented and checked — never in advance.
- Do not start bonus functionality before all mandatory requirements are complete.
- Do not introduce architecture or dependencies that are not clearly useful for the assignment.
- Record material architectural decisions in `docs/DECISIONS.md`.
- Record real AI-assisted work and personal review in `AI-WORKLOG.md`.
- Propose a commit at the end of each phase; the candidate reviews the diff and commits.

## Fixed stack (decided — see `docs/DECISIONS.md`)

| Area | Choice |
|---|---|
| Backend | NestJS 12 in `backend/` (ESM, TypeScript 6) |
| Frontend | Next.js 16 App Router in `frontend/` (React 19, Tailwind v4) |
| Database | SQLite file, via an ORM |
| ORM | Prisma, pinned to **6.19.3** exactly |
| Auth | JWT in an httpOnly cookie, issued and verified by NestJS |
| API topology | Browser → NestJS directly (CORS + credentials); Next server components call NestJS server-to-server |
| Validation | class-validator + global `ValidationPipe` |
| UI | Tailwind v4, hand-written components, no component library |
| Client state | React local state only |
| Tests | Vitest: NestJS e2e (supertest) + unit + a few React Testing Library tests |
| Package manager | npm |
| Repository | One git repository rooted at `test-task/` |

---

## Phase 0 — Requirements, architecture and decisions

Status: **COMPLETE**

Done:
- Read the complete assignment.
- Inspected the repository before changing any code.
- Summarized mandatory requirements, security-critical requirements and testing requirements.
- Proposed the remaining stack with alternatives and trade-offs.
- Obtained candidate approval for every material decision.
- Verified empirically that Prisma 6's CommonJS client works with the ESM backend
  (see `AI-WORKLOG.md`, entry 2).
- Wrote this plan, `docs/DECISIONS.md` and `AI-WORKLOG.md`.

No application code was written in this phase.

---

## Phase 1 — Foundations

Status: **COMPLETE**

Implemented:
- Confirmed via `git status`/`git log` in both nested repos that nothing would be lost
  (`backend/.git` had zero commits; `frontend/.git` had one clean create-next-app commit),
  then deleted both and ran `git init` at the repository root.
- Root `.gitignore` (`node_modules/`, build output, `.env*` except `.env.example`, `*.db`,
  logs, tsbuildinfo, coverage, editor/OS files).
- Root `package.json` with delegating convenience scripts (`dev:*`, `build*`, `lint*`,
  `test*`, `db:*`) — no workspaces.
- Backend: removed `oxlint` and its config; added ESLint 10 + typescript-eslint 8 (flat
  config, `recommendedTypeChecked`) + `eslint-config-prettier`; kept Prettier; added
  `lint:fix` and `format:check` scripts.
- Also removed the unused `@nestjs/mau` dev dependency (a Nest cloud-deploy CLI helper,
  irrelevant to this assignment) after `npm audit` showed it was the sole source of 5
  vulnerabilities (2 low, 1 moderate, 2 high) in transitive packages it pulled in; removing
  it dropped the count to 0 and also removed the now-meaningless `deploy` script.
- Frontend: added Prettier 3.9 + `eslint-config-prettier`, `.prettierrc.json`,
  `.prettierignore`, and `format`/`format:check`/`typecheck` scripts.
- Backend: `@nestjs/config` (global `ConfigModule`), `.env.example` (placeholders only),
  `cookie-parser`, global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
  transform: true })`, CORS restricted to `FRONTEND_ORIGIN` with credentials, port from
  `PORT` (default 3001).
- Also installed `class-validator` + `class-transformer` — discovered to be a hard runtime
  requirement of `ValidationPipe` when the dev server was actually started (it throws
  `The "class-validator" package is missing` at boot otherwise); not caught by lint, build,
  or the existing unit/e2e tests, only by running the app.
- Frontend: `.env.example` with `NEXT_PUBLIC_API_URL` (a base URL, not a secret — safe to be
  public since the browser calls NestJS directly, per the approved API topology decision).
- Replaced the `getHello`/`/` scaffold with a `GET /health` endpoint returning
  `{ status: 'ok' }`, with matching unit and e2e tests.

Verification (all actually run):
- Backend: `npm run lint` → 0 errors (1 pre-existing-pattern warning from `supertest`'s
  typing, same severity the standard NestJS ESLint template assigns); `npm run build` → 0
  TypeScript errors; `npm test` → 1/1 unit test passed; `npm run test:e2e` → 1/1 e2e test
  passed; `npm run format:check` → clean.
- Frontend: `npm run lint` → clean; `npm run typecheck` → clean; `npm run format:check` →
  clean (after formatting one pre-existing scaffold file, `next.config.ts`); `npm run build`
  → succeeded, static pages generated.
- Both dev servers were started for real (not assumed): backend on port 3001
  (`curl http://localhost:3001/health` → `200 {"status":"ok"}`, with
  `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials:
  true` present, and *not* reflecting a disallowed `Origin` header — the header always echoes
  the configured `FRONTEND_ORIGIN`, so a browser from another origin would see a mismatch and
  block the response); frontend on port 3000 (`curl` → `200`). Both were then stopped.
- Confirmed `backend/.env` (created locally from `.env.example` for this testing) is actually
  git-ignored via `git check-ignore -v`.

Commit: `chore: set up single repository, linting and app configuration` — staged and ready,
not yet committed (the candidate reviews the diff and commits, per the git workflow in
`docs/DECISIONS.md` §11).

---

## Phase 2 — Database and seed data

Status: **COMPLETE**

Implemented:
- Installed `prisma@6.19.3` and `@prisma/client@6.19.3` as **exact pins** (no caret), plus
  `tsx` (to run the TypeScript seed) and `bcryptjs` (pure JS — deliberately not the native
  `bcrypt`, to avoid a compilation step on a reviewer's machine).
- `postinstall: prisma generate` plus `prisma:generate` / `prisma:migrate` /
  `prisma:migrate:deploy` / `prisma:seed` / `prisma:reset` / `prisma:studio` scripts, and the
  `prisma.seed` entry pointing at `tsx prisma/seed.ts`.
- `prisma/schema.prisma` with `User` and `Product` as planned. `characteristics` is
  JSON-encoded text; `status` is a **String, not a Prisma enum**, because the SQLite connector
  does not support enums — it is constrained to `draft | published` by the API's validation
  DTOs in Phase 4.
- `@@index([status])`, since every public query filters on it.
- First migration `20260915101632_init`.
- `PrismaService` (extends `PrismaClient`, `$connect` on module init, `$disconnect` on
  destroy) and a `@Global()` `PrismaModule`, wired into `AppModule`.
- `prisma/seed.ts` — idempotent (upserts by unique key): one administrator whose password is
  read from the environment and stored only as a bcrypt hash (cost 12), and three demo
  products (2 published, 1 draft).
- Fixed `DATABASE_URL` in `.env.example` to `file:./dev.db` — Prisma resolves relative SQLite
  paths against the **schema** directory, not the project root, so the Phase 1 value would
  have produced `backend/prisma/prisma/dev.db`.
- Added an npm `overrides` entry forcing `deepmerge-ts` to `^8.0.2` — see `docs/DECISIONS.md`
  §3 for the full reasoning and the Prisma 6/7/8 comparison behind it.

Verification (all actually run):
- `prisma migrate dev --name init` → migration created and applied; client generated.
- `npm run prisma:seed` → seeded 1 admin + 3 products; re-run a second time to confirm
  idempotency (no duplicates, no failure).
- ESM compatibility confirmed in **all three** runtimes the project uses: the compiled
  `node dist/main` output, `tsx` (seed + ad-hoc scripts), and vitest. `PrismaService extends
  PrismaClient` compiles under `module: nodenext` and runs.
- Real app boot (`npm run start:prod`): `PrismaModule dependencies initialized`, `$connect()`
  succeeded, `curl http://localhost:3001/health` → 200.
- Persistence across processes: the seed wrote rows in one process and a separate process read
  them back (1 admin with a 60-char `$2b$12$` bcrypt hash; 2 published + 1 draft).
- Clean-slate reproducibility: migrated and seeded a **throwaway** database at a different
  `DATABASE_URL`, giving `users: 1 | products: 3 | published: 2 | draft: 1`, then deleted it.
  (`prisma migrate reset` itself is blocked by Prisma's built-in AI-agent guard and needs the
  candidate's explicit consent — not run.)
- `npm run lint` → 0 errors; `npm run build` → clean; `npm test` → 1/1; `npm run test:e2e` →
  1/1 (the e2e suite now boots `AppModule` with Prisma connected).
- `npm audit` → **0 vulnerabilities** (3 high before the override).
- Confirmed our own `postinstall` still runs under npm 12 by deleting the generated client and
  re-running `npm install` — it regenerated.
- `backend/prisma/dev.db` confirmed git-ignored; no credential literal in any tracked file.

Proposed commit: `feat: add database schema, migrations and seed data`

---

## Phase 3 — Authentication

Status: **COMPLETE**

Implemented:
- `POST /auth/login` — bcrypt compare, signs a JWT, sets it as an httpOnly cookie
  (`httpOnly`, `sameSite=lax`, `secure` in production, `path=/`). Returns 200, not Nest's
  default 201, because logging in creates no resource. The token is **never** in the body.
- `POST /auth/logout` — clears the cookie with the same attributes it was set with.
- `GET /auth/me` — the current admin, for the admin UI.
- `JwtCookieGuard` — reads the cookie, verifies the token, attaches the admin to the request.
  Applied to `/auth/me` now and to every admin route in Phase 4.
- A single generic message (`Invalid email or password.`) for both an unknown email and a
  wrong password.
- A **timing-attack mitigation**: when no user is found, bcrypt is still run against a
  throwaway hash, so both paths cost the same. Without it an unknown email returns in
  milliseconds while a known one takes the ~300 ms bcrypt needs, which alone reveals which
  accounts exist.
- The cookie's `maxAge` is derived from the signed token's own `exp` claim, so the cookie and
  the token cannot expire at different times.
- `JWT_SECRET` has **no default** — a missing value throws a clear error rather than silently
  signing with a guessable fallback.
- Session lifetime moved to `JWT_EXPIRES_IN_SECONDS` (a number) rather than a string like
  `1h`: `@nestjs/jwt` types the string form as the `ms` package's template-literal type, which
  a value read from the environment cannot satisfy without a cast, and environment variables
  are always strings so the conversion must be explicit and validated.
- No registration, no password recovery, no roles — all out of scope.

Supporting change — **shared app configuration**. `configureApp()` was extracted to
`src/app-setup.ts` and is now called by both `main.ts` and the e2e tests. Previously the e2e
suite built the app through `TestingModule`, which never runs `main.ts`, so it had no
cookie-parser and no global `ValidationPipe` — meaning the validation tests would have passed
against a configuration that never ships.

Supporting change — **isolated test database**. `test/global-setup.ts` creates
`prisma/test.db`, applies the real migrations, seeds it with a dedicated e2e administrator,
and deletes it afterwards. `vitest.config.e2e.ts` points `DATABASE_URL` at it and disables
file parallelism, since the specs share one SQLite file. Tests therefore never touch
`prisma/dev.db`, and need no external service.

Verification (all actually run):
- **e2e: 18/18 passing** (17 auth + 1 health), covering: valid login sets an `HttpOnly`,
  `SameSite=Lax` cookie; the token never appears in the body; the password hash never appears
  in the body; wrong password → 401; wrong password and unknown email return an **identical**
  message; no cookie is set on a failed login; malformed email → 400; missing password → 400;
  an unknown property in the payload → 400; `/auth/me` with a valid cookie → 200; with no
  cookie → 401; with a tampered token → 401; with a token signed by a different secret → 401;
  with a garbage value → 401; logout returns a cookie cleared with a 1970 expiry.
- Test isolation confirmed: `prisma/test.db` was created, used and removed by teardown, and
  `prisma/dev.db` still contained only `admin@example.com` afterwards.
- `npm run lint` → 0 errors; `npm run build` → clean; `npm test` → 1/1.
- Manual curl walkthrough against the running app: login returned
  `Set-Cookie: session=…; Max-Age=3599; HttpOnly; SameSite=Lax` with no token in the body;
  `/auth/me` with the cookie → 200, without → 401; wrong password and unknown email returned
  byte-identical bodies; `{"isAdmin":true}` in the login payload → 400
  `property isAdmin should not exist`; logout returned
  `session=; Expires=Thu, 01 Jan 1970 …`.
- **Timing mitigation measured, not assumed**: known-email-wrong-password took
  0.348 / 0.299 / 0.298 s and unknown-email took 0.306 / 0.305 / 0.320 s — indistinguishable.

Known limitation (documented, not hidden): logout clears the cookie but cannot revoke an
already-issued stateless token, which stays valid until it expires. There is an explicit e2e
test asserting this real behaviour, so that adding revocation later will fail the test and
force the documentation to be updated. See `docs/DECISIONS.md` §4.

Also not implemented: login rate limiting / brute-force protection. The assignment does not
require it and it would mean another dependency; recorded here as a known limitation rather
than silently omitted.

Proposed commit: `feat: add admin authentication with httpOnly JWT cookie`

---

## Phase 4 — Product API and server-side validation

Status: **COMPLETE**

Implemented:
- `GET /admin/products` — id, name, status (guarded).
- `GET /admin/products/:id` — full record with `characteristics` parsed from JSON text into
  a real array (guarded).
- `PATCH /admin/products/:id` — description, seoTitle, seoDescription, status only (guarded).
- `GET /products` — published only; returns slug, name, seoDescription.
- `GET /products/:slug` — published only, otherwise 404.
- `UpdateProductDto` with the assignment's limits: description non-empty ≤ 1000, seoTitle
  non-empty ≤ 60, seoDescription non-empty ≤ 160, status in `draft|published`. All four
  fields are required, so every save re-validates everything.
- Values are **trimmed before validation**, so `"   "` fails the non-empty check and trailing
  whitespace does not count toward a limit. The validated value is exactly what gets stored.
- `whitelist` + `forbidNonWhitelisted` (from Phase 1) mean `name`, `characteristics`, `slug`
  and `id` are rejected with 400 rather than silently ignored.
- The guard is applied at **controller level** on `AdminProductsController`, so a future
  endpoint cannot be added unprotected by forgetting a decorator.
- Public and admin routes live in **separate controllers** with separate response shapes, so
  the public routes cannot inherit an admin response or lose their published-only filter.
- Every Prisma query uses an explicit `select`, so a column added later cannot leak into a
  public response by default.
- The published filter is part of the database query, not a JavaScript filter applied after
  loading — a draft is never read from the database by a public request.
- `src/products/product-status.ts` is the single source of truth for the two status values,
  since SQLite cannot express them as a Prisma enum.

Verification (all actually run):
- **e2e: 55/55 passing** across 3 spec files. New product coverage includes: all three
  boundary pairs (1000 ok / 1001 rejected, 60 ok / 61 rejected, 160 ok / 161 rejected), empty
  and whitespace-only values, missing fields, an invalid status, admin routes returning 401
  without a session, a rejected update leaving the row byte-for-byte unchanged, attempts to
  change `name`/`characteristics`/`slug`/`id` all returning 400, the public catalogue never
  containing a draft, a draft slug returning 404 with a message **identical** to an unknown
  slug, public payloads omitting `id` and `status`, publish/unpublish flipping visibility, and
  whitespace trimming.
- **The boundary tests were mutation-tested**: temporarily changing `@MaxLength(60)` to
  `@MaxLength(61)` made exactly one test fail — `rejects 61 characters` — confirming the test
  actually constrains the limit rather than passing regardless. Reverted immediately, suite
  green again.
- `npm run lint` → 0 errors; `npm run build` → clean; `npm test` → 1/1.
- Manual curl walkthrough against the running app: public catalogue returned only the two
  published products; `GET /products/nimbus-standing-desk-mat` (the draft) → 404;
  `GET /admin/products` without a cookie → 401; a 1001-character description → 400
  `Description must be 1000 characters or fewer.`; `"name":"HACKED"` → 400
  `property name should not exist`; re-reading the record afterwards confirmed the name and
  description were untouched; unpublishing removed the product from both the catalogue and its
  detail URL (404), and republishing restored it.
- **Persistence across an application restart** (an explicit assignment requirement): a
  distinctive description was saved through the API, the server process was stopped, absence
  of any listener was proven (`curl` refused to connect), a fresh process was started, and the
  value was still served. See `AI-WORKLOG.md` entry 6 — the first attempt at this test was
  invalid and had to be redone.
- Development data was restored to its seeded values afterwards.

**Correction made during Phase 6:** that last claim was not fully true. The `curl` command
used to restore the data on Windows mangled the em-dash (U+2014) in `seoTitle` into the
Unicode replacement character (U+FFFD), so the row was restored *almost* correctly and the
corruption went unnoticed. It was found in Phase 6 while verifying page metadata, traced to
the shell quoting rather than to the application, and properly repaired. The application
itself round-trips UTF-8 correctly — see `AI-WORKLOG.md` entry 8.

Proposed commit: `feat: add product REST API with server-side validation`

---

## Phase 5 — Admin UI

Status: **COMPLETE**

Implemented:
- `lib/api.ts` — a typed API client. Every request sends `credentials: 'include'` so the
  httpOnly cookie travels with it; the token is never read by client code. `ApiError` carries
  the HTTP status so callers can distinguish 401 from 400, and a failed `fetch` (API not
  running) is turned into a readable message rather than an unhandled rejection.
- `LIMITS` mirrors the server's three limits for live character counters. Documented in the
  file as a convenience only — the server re-validates every field on every save.
- Login page (`/admin/login`): submits, redirects to the product list, and on failure shows
  the error **while leaving the typed credentials in place** so a typo can be corrected.
- Product list (`/admin/products`): name + status badge per row, linking to the editor.
- Editor (`/admin/products/[id]`): name and characteristics rendered as read-only text (no
  input element exists for them); description, SEO title, SEO description and status editable.
- Explicit **Save changes** button — disabled until something actually changes, and disabled
  while a field is empty or over its limit.
- Four distinct save states: idle, saving, saved, error. "Saved" appears **only** after the
  server confirms the write, and is cleared as soon as editing resumes so it can never sit
  next to unsaved edits. An "Unsaved changes" marker shows when the form is dirty.
- A failed save changes **only** `saveState` — nothing in the error path touches the form
  values, which is what keeps the user's edits on screen.
- A 401 during load or save redirects to the login page.
- Character counters per field, turning red past the limit.
- Responsive: mobile-first single column, `flex-wrap` on header/action rows, `sm:` breakpoints
  for padding, and `max-w-*` containers.
- Sign out in the admin header, which navigates to the login page even if the logout request
  itself fails — the server-side guard is what actually protects the data.

Supporting change — **frontend test infrastructure**: Vitest 5 + React Testing Library +
jsdom, with `vitest.config.mts` (the `.mts` extension avoids Vite's CJS config-loader warning
and cut the run from 27 s to 5 s) and a setup file that unmounts between tests.

Also updated `@types/node` from `^20` to `^24` in the frontend: Vitest 5 requires
`^22 || >=24`, and `^24` matches both the actual Node runtime (24.21.0) and the backend.

Verification (all actually run):
- **Frontend tests: 10/10 passing**, covering: read-only facts render as text with no input
  holding the name; typing alone never calls the API; Save disabled until dirty; **a failed
  save keeps the typed value character-for-character, shows the error, and shows no "Saved"**;
  the same when the server is unreachable; success reported only after the server confirms,
  with the exact payload asserted; a stale "Saved" cleared once editing resumes; empty and
  over-length fields block saving; a 401 redirects to login.
- **The critical behaviour was mutation-tested**: adding `setValues(valuesOf(product))` to the
  error path (i.e. making a failed save wipe the form) failed exactly the two
  data-preservation tests and nothing else. Reverted, suite green again.
- `npm run lint` → clean; `npm run typecheck` → clean; `npm run format:check` → clean;
  `npm run build` → succeeded, all five routes compiled.
- Both servers started together: backend `/health` → 200, `/admin/login` → 200,
  `/admin/products` → 200.
- The login page's server HTML contains the email/password fields; the admin list page's
  server HTML contains **no product data at all** (it loads client-side, behind the API
  guard), so nothing leaks to an unauthenticated viewer of the page source.
- The built client bundle was searched for `ChangeMe123`, the JWT secret and `SEED_ADMIN` —
  **no matches**. The only injected value is `http://localhost:3001`, which is intentionally
  public.

A lint rule worth recording: `react-hooks/set-state-in-effect` rejected the initial
`useCallback` + `useEffect` data-loading pattern because it called `setState` synchronously
inside the effect. Both pages were restructured to fetch inside the effect with a `cancelled`
guard and a `reloadToken` for the retry button — which also fixed a real latent bug, since the
original had no protection against a slow response resolving after unmount.

**Known verification gap (honest limitation):** there is no automated browser click-through of
login → edit → save, and the responsive layout has not been checked in a real browser at
mobile width. Playwright was deliberately rejected in Phase 0 as disproportionate to the time
budget. The editor's interactive behaviour is covered by the React Testing Library tests
above, and the API it calls is covered by the 55 backend e2e tests, but "it looks right in a
browser" is asserted by neither. This is recorded rather than glossed over.

Proposed commit: `feat: add admin product list and editor`

---

## Phase 6 — Public catalogue and product pages

Status: **COMPLETE**

Implemented:
- `lib/server-api.ts` — a separate server-side client for the public API. Deliberately not
  `lib/api.ts`: that one sends `credentials: 'include'`, which is meaningless here. These
  calls carry no cookie, so they can only ever see what an anonymous visitor sees.
- Both public fetches use `cache: 'no-store'`. Publishing or unpublishing must take effect
  immediately; a cached catalogue could keep serving a product the manager has just
  unpublished, which is exactly the leak the draft rule exists to prevent. This makes `/` a
  dynamic route, which is the correct trade-off here.
- Catalogue (`/`) — replaces the create-next-app landing page. Lists published products in a
  responsive grid (one column on mobile, two from `sm:`), each linking to its page.
- Product page (`/products/[slug]`) — name, description and a specifications list. `params` is
  awaited, as Next 16 requires in server components.
- `generateMetadata` sets `title` and `description` from the stored SEO fields. The fetch is
  wrapped in React's `cache()` so the page and its metadata share one request rather than
  relying on fetch memoisation behaving a particular way.
- A draft slug and an unknown slug both produce `notFound()` — the API returns 404 for both,
  so this layer cannot tell them apart either.
- `app/not-found.tsx` gives both cases the same page.
- Root layout metadata replaced (it still said "Create Next App").

Security — product content cannot execute:
- Content is rendered as React text nodes, which React escapes.
- **`react/no-danger` was added as an ESLint error**, so `dangerouslySetInnerHTML` fails the
  build anywhere in the frontend. This is a stronger guarantee than a test because it also
  covers code that has not been written yet. The rule was verified to actually fire by
  temporarily adding a component that used `dangerouslySetInnerHTML` — it errored, and the
  file was deleted.
- A backend e2e test pins the deliberate architectural choice that content is stored
  **verbatim** and escaped at render, rather than sanitised on input: there is then no
  sanitiser that can be wrong or bypassed. If input sanitising is added later, that test fails
  and forces the decision to be made consciously.

Verification (all actually run):
- Backend e2e: **56/56 passing** (one new test for verbatim storage).
- Frontend: 10/10 tests, lint clean, typecheck clean, format clean, build clean (6 routes).
- Against both servers running: the catalogue listed only the two published products (the
  draft was absent); `/products/nimbus-standing-desk-mat` (draft) → **404**;
  `/products/no-such-thing` → 404; `/products/aurora-wireless-headphones` → 200.
- Page metadata compared byte-for-byte against what the API stores: `<title>` and
  `<meta name="description">` both matched the stored `seoTitle` / `seoDescription`.
- **XSS verified end-to-end with a real stored payload.** A product's description was set to
  `<script>window.__XSS_EXECUTED__=true;alert("xss")</script> and <img src=x
  onerror="alert(1)"> and <b>bold</b>`, its `seoTitle` to `<script>alert("seo")</script>`, and
  its `seoDescription` to `"><script>alert("meta")</script>` — the last being the classic
  attribute-breakout attack. The rendered HTML contained: **zero** live `<script>` elements
  carrying the payload, no raw unescaped markup, no live `onerror` attribute, and the escaped
  form `&lt;script&gt;` present, proving it rendered as visible text. The `<title>` came
  through as `&lt;script&gt;alert(&quot;seo&quot;)&lt;/script&gt;` and the meta description as
  `&quot;&gt;&lt;script&gt;...`, so the breakout attempt was escaped too. The product was then
  restored.

Proposed commit: `feat: add public catalogue and product pages`

---

## Phase 7 — Security and edge-case audit

Status: **COMPLETE**

Every row of the S1–S9 table in `docs/DECISIONS.md` was checked against the running system,
not just read against the code.

| # | Property | How it was verified | Result |
|---|---|---|---|
| S1 | Admin routes reject unauthenticated requests | Enumerated every `@Get/@Post/@Patch` in `src/` and matched against guards; e2e tests | **Pass** — all three `/admin/products` routes covered by a controller-level guard; `/auth/me` guarded; `/auth/logout` intentionally unguarded so a stale cookie can still be cleared |
| S2 | Password stored hashed only | New e2e test asserting the stored value matches `^\$2[aby]\$\d{2}\$`, is 60 chars, and does not contain the plaintext | **Pass** |
| S3 | Secrets never reach the client | Rebuilt the frontend and grepped all of `.next/static` for the admin password, JWT secret, `SEED_ADMIN_PASSWORD` and `passwordHash` | **Pass** — no matches; only the API URL is inlined, which is intentionally public |
| S4 | Drafts invisible publicly | e2e tests (404 for draft, message identical to unknown slug) + manual check of the running catalogue | **Pass** |
| S5 | No mass assignment | e2e tests for `name`, `characteristics`, `slug`, `id` | **Pass** — all rejected with 400 |
| S6 | Content cannot execute | `react/no-danger` ESLint error (verified it fires), verbatim-storage e2e test, and a live XSS payload check in Phase 6 | **Pass** |
| S7 | Cookie hardened | Ran the API with `NODE_ENV=production` — previously untested | **Pass** — `HttpOnly; Secure; SameSite=Lax; Max-Age=3599; Path=/` |
| S8 | CORS locked to the frontend origin | Preflighted a `PATCH` from `http://evil.example.com` | **Pass** — the returned `Access-Control-Allow-Origin` is always the configured origin, so a foreign origin never gets a match and the browser blocks it |
| S9 | No user enumeration | e2e test comparing messages, plus timing measured in Phase 3 | **Pass** |

Additional probing beyond the table:

- **SQL injection** — four payloads (`' OR '1'='1`, `'; DROP TABLE Product;--`, a `UNION
  SELECT` against `User`, `' OR 1=1--`) sent as public slugs. All returned 404, no password
  hash appeared in any response, and the tables were intact afterwards. Prisma parameterises;
  now pinned by e2e tests.
- **Oversized input** — a ~200 KB and a ~5 MB body both returned **413**, and a 50 KB cookie
  returned **431**, so neither reaches application code.
- **Error leakage** — a genuine 500 was triggered by pointing a throwaway server on port 3002
  at an empty database. The response body was exactly
  `{"statusCode":500,"message":"Internal server error"}` — no stack frames, table names, file
  paths or Prisma detail. Malformed JSON, a null body, an array body and a wrong content type
  all returned clean 400s.
- **Secret hygiene** — `.env.example` contains only placeholders; `backend/.env` and
  `frontend/.env.local` are both confirmed git-ignored; no `.env`, `.pem` or `.key` file is
  tracked.

Finding fixed: **`X-Powered-By: Express`** was being returned on every response, advertising
the stack to anyone scanning the service. Disabled in `configureApp()`, and pinned by a
regression test. The test was mutation-checked — removing the fix caused exactly that one
test to fail.

New `backend/test/security.e2e-spec.ts` covers the header, the SQL-injection payloads, the
body-size limit, 404 bodies not leaking internals, and the password-hash format.

Verification totals after this phase: **backend e2e 65/65**, backend unit 1/1, frontend 10/10,
lint 0 errors both sides, builds clean, `npm audit` 0 vulnerabilities.

Known limitations carried forward (documented, not fixed):
- No login rate limiting / brute-force protection. Would need another dependency; the
  assignment does not require it.
- `secure` cookies require HTTPS, so a production deployment must terminate TLS.
- No automated browser click-through of the admin flow (from Phase 5).

Proposed commit: `fix: harden security and add audit regression tests`

---

## Phase 8 — Documentation and final verification

Status: NOT STARTED

Complete:
- `README.md`: prerequisites, clean setup, how to run both apps, how to run tests, how to log
  in as the test admin, technical decisions, testing rationale, **actual verification
  results**, known limitations, unfinished parts, actual time spent.
- `docs/DECISIONS.md`: final state of every decision.
- `AI-WORKLOG.md`: tools/models, AI contribution, candidate contribution, 2–3 concrete
  reviewed examples with verification, the role of tests in checking AI-written code.
- Technical-review checklist (architecture, auth, authorization, validation, database, API,
  React, testing, security, AI usage).

Verification:
- Full clean run: install → migrate → seed → lint → typecheck → build → tests, both apps.
- Follow the README from scratch as if reviewing it for the first time.

Proposed commit: `docs: finalize documentation and verification results`

---

## Phase 9 — Bonus (only if time remains)

Status: NOT STARTED

Only after Phases 1–8 are complete, tested and documented.

Preferred single bonus: LLM generation of description/SEO fields with an explicitly labelled
mock provider so a reviewer needs no API key, applying suggestions to the editor only
(never saving or publishing, never overwriting unsaved edits).

Excluded from this assignment unless explicitly requested: Shopify import, Figma workflow,
Docker/CI.
