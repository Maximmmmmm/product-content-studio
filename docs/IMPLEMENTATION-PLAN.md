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

Status: NOT STARTED

Implement:
- `POST /auth/login` — bcrypt compare, sign JWT, set httpOnly cookie
  (`httpOnly`, `sameSite`, `secure` in production, explicit expiry).
- `POST /auth/logout` — clear the cookie.
- `GET /auth/me` — current admin, for the admin UI.
- `JwtCookieGuard` applied to every admin route.
- Generic error message for both unknown user and wrong password.
- No registration, no password recovery, no roles.

Verification (e2e):
- Valid credentials → 200 and a `Set-Cookie` with `HttpOnly`.
- Wrong password → 401, same message as unknown user.
- Admin route without a cookie → 401.
- Admin route with a tampered/expired token → 401.
- After logout, the previously working request → 401.

Proposed commit: `feat: add admin authentication with httpOnly JWT cookie`

---

## Phase 4 — Product API and server-side validation

Status: NOT STARTED

Implement:
- `GET /admin/products` — id, name, status (guarded).
- `GET /admin/products/:id` — full record (guarded).
- `PATCH /admin/products/:id` — description, seoTitle, seoDescription, status only (guarded).
- `GET /products` — published only.
- `GET /products/:slug` — published only, otherwise 404.
- `UpdateProductDto` with the assignment's limits: description non-empty ≤ 1000,
  seoTitle non-empty ≤ 60, seoDescription non-empty ≤ 160, status in `draft|published`.
- `whitelist` + `forbidNonWhitelisted` so `name`, `characteristics` and `id` cannot be
  modified through the API (mass-assignment protection).
- Public queries filter `status = 'published'` in the database query itself.

Verification (e2e):
- Each boundary: empty, 1000 ok / 1001 rejected, 60 ok / 61 rejected, 160 ok / 161 rejected.
- A rejected update leaves the stored row byte-for-byte unchanged.
- An attempt to change `name` via `PATCH` is rejected, not silently ignored.
- `GET /products` never contains a draft; `GET /products/:draftSlug` → 404 (not 403).
- A successful update persists and changes public visibility when the status changes.

Proposed commit: `feat: add product REST API with server-side validation`

---

## Phase 5 — Admin UI

Status: NOT STARTED

Implement:
- Login page; redirect to the product list on success; clear error on failure.
- Product list showing name and status, linking to the editor.
- Editor: name and characteristics read-only; description, SEO fields and status editable.
- Explicit Save button — nothing is persisted without it.
- Distinct idle / saving / saved / error states.
- A failed save keeps every character the user typed and is never presented as success.
- Character counters against the shared limit constants.
- Responsive layout for desktop and mobile.
- Logout.

Verification:
- Manual: edit → save → reload → the change is still there.
- Manual: with the backend stopped, save → error shown, input preserved.
- React Testing Library: failed save preserves input and shows an error.
- Manual: usable at mobile width.
- Manual: admin pages are unusable without a valid session.

Proposed commit: `feat: add admin product list and editor`

---

## Phase 6 — Public catalogue and product pages

Status: NOT STARTED

Implement:
- Catalogue page listing published products with links.
- Product page showing name, characteristics and the saved description.
- `generateMetadata` producing the page title and description from the stored SEO fields.
- A draft slug calls `notFound()`.
- Product content is rendered as React text nodes — no `dangerouslySetInnerHTML` anywhere.

Verification:
- Published products appear; drafts do not.
- A draft URL returns 404.
- The rendered HTML contains `<title>` and `<meta name="description">` from the SEO fields.
- A `<script>` payload stored in a description appears as visible text, not executed.

Proposed commit: `feat: add public catalogue and product pages`

---

## Phase 7 — Security and edge-case audit

Status: NOT STARTED

Review every row of the security table in `docs/DECISIONS.md` (S1–S9) against the real code:
authentication, authorization, validation, public/private boundary, XSS, secret exposure,
cookie flags, CORS, error handling, invalid ids, failed writes.

Verification:
- Targeted negative tests for anything not already covered.
- Build the frontend and grep the client bundle for the admin password and the JWT secret.
- Confirm `.env` is ignored by git and `.env.example` contains only placeholders.

Proposed commit: `fix: harden validation and security`

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
