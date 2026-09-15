# Technical Decisions

This file records the material technical decisions taken for the Product Content Studio
assignment, each with the alternatives that were considered, the trade-off, and a short
explanation suitable for a technical interview.

Decision protocol used: the assistant proposes a recommended option plus realistic
alternatives and trade-offs → the candidate decides → the decision is recorded here →
implementation starts only afterwards.

Decisions 1–4 and 10 were approved on 2026-09-14. Decisions 5–9 were accepted as proposed
defaults.

---

## 1. Frontend/backend separation — DECIDED (given)

**Decision:** NestJS in `backend/`, Next.js (App Router) in `frontend/`, two separate
applications.

This was fixed before the assignment work began and was not reconsidered. The assignment
allows any full-stack React framework and any Node.js backend, so the split satisfies the
requirements.

**Interview explanation:** the split keeps one clear authorization boundary — the API is the
only thing that talks to the database, and it enforces every rule. The frontend is a client
of that API and holds no security responsibility.

---

## 2. Database — DECIDED: SQLite

**Decision:** a SQLite file (`backend/prisma/dev.db`).

**Alternatives considered:**
- *PostgreSQL* — more production-like, but requires Docker or a locally installed server. The
  assignment scope explicitly excludes infrastructure work, and the setup must be reproducible
  in a clean environment with minimum friction.
- *MySQL* — same objection as PostgreSQL, with no advantage here.

**Trade-off:** SQLite is not what this application would use in production, and it does not
exercise concurrent-write behaviour. For a single-admin content editor with a handful of rows
that is irrelevant.

**Interview explanation:** the assignment asks for a relational SQL database accessed through
an ORM, and SQLite satisfies that while keeping `git clone && npm install` enough to run the
project. Because the ORM abstracts the dialect, moving to PostgreSQL would mean changing the
`provider` and the connection string, not the application code.

---

## 3. ORM — DECIDED: Prisma, pinned to 6.19.3

**Decision:** Prisma, with `prisma` and `@prisma/client` pinned to exactly `6.19.3`.

**Alternatives considered:**
- *Prisma 7.10.0* — the current stable line, with a natively ESM-generated client. Rejected
  because Prisma 7 removed the bundled query engine in favour of driver adapters, so SQLite
  additionally needs `@prisma/adapter-better-sqlite3` and the native `better-sqlite3` module.
  That adds a native compilation step to a reviewer's clean install for no functional gain.
- *TypeORM* — raised explicitly during planning. It wins on having no code-generation step and
  on decorator entities that match the NestJS style, and `@nestjs/typeorm` is first-party.
  Rejected because in *this* setup it is not actually simpler: the backend is ESM, which breaks
  TypeORM's glob-based entity auto-discovery (entities must be imported explicitly), migration
  generation needs extra DataSource/CLI ceremony, `synchronize: true` is convenient but not
  production-like, its types are weaker than Prisma's generated client, and it still requires
  the same native `better-sqlite3` driver — so it does not even avoid the native-build concern
  that motivated the question.
- *Drizzle* — lighter and SQL-first, but the migration and seeding tooling would be
  hand-rolled, which costs time in a 6–8 hour budget.

**Why the version is pinned:** npm's `latest` tag for `prisma` currently points at
`8.0.0-rc.15`, a release candidate. An unpinned `npm install prisma` would install a
pre-release into the project. Both packages are therefore pinned exactly, with no caret.

**ESM compatibility — verified, not assumed:** the backend is true ESM (`"type": "module"`),
and Prisma 6 ships a CommonJS client, so this was tested before the choice was locked in.
`@prisma/client@6.19.3` resolves its `import` condition to `default.js`, whose body is
`module.exports = { ...require('.prisma/client/default') }`. Before `prisma generate` has run
that spread target does not exist and `import { PrismaClient } from '@prisma/client'` fails
with `SyntaxError: Named export 'PrismaClient' not found`. Once the client has been generated,
Node's `cjs-module-lexer` follows the spread chain and named imports link correctly — this was
reproduced and confirmed. The practical consequence is a `postinstall: prisma generate` script
so a clean clone works from a single `npm install`. Full detail in `AI-WORKLOG.md`, entry 2.

**Interview explanation:** Prisma gives a typed client generated from a single schema file,
plus one-command migrations and seeding, which is the fastest safe path for a small project.
The version pin exists because the package's `latest` tag is a release candidate — pinning is
what makes a reviewer's install reproducible.

### 3a. Re-evaluated in Phase 2: should we move to PostgreSQL and the newest Prisma?

The question was raised again before implementation: Prisma 6 is a major version behind, so
would PostgreSQL plus the newest Prisma be the better choice and avoid shipping something
old? This was settled by measurement rather than opinion.

**Does Prisma 6 + SQLite actually work in this ESM NestJS backend? Yes — verified.**
`prisma migrate dev`, `prisma generate` and `prisma db seed` all succeed; the ESM named
import of `PrismaClient` works in all three runtimes the project uses (compiled
`node dist/main`, `tsx`, and vitest); `PrismaService extends PrismaClient` compiles under
`module: nodenext` and `$connect()` succeeds at boot. No workaround of any kind was needed.

**What "newest" actually means.** npm's `latest` tag for `prisma` is `8.0.0-rc.15` — a
release candidate. Prisma's own CLI prints an upgrade banner pointing at it, so
`npm i prisma@latest` installs a pre-release. Shipping an RC in an assignment is not
defensible, so the real comparison is Prisma 6.19.3 against **7.10.0**, the newest stable.

**Measured comparison:**

| | Prisma 6.19.3 (chosen) | Prisma 7.10.0 | Prisma 8 |
|---|---|---|---|
| Release channel | previous stable | current stable | release candidate |
| `npm audit`, as installed | 3 high | **4 high** | not evaluated |
| Vulnerable packages | `deepmerge-ts@7.1.5` | `deepmerge-ts@7.1.5` **+ `mysql2@3.15.3`** | — |
| SQLite support | built-in engine, no native module | requires `@prisma/adapter-better-sqlite3` + native `better-sqlite3` | — |
| Generated client | CommonJS (verified working from ESM) | native ESM | — |
| Config location | `package.json#prisma` (deprecation warning) | requires `prisma.config.ts` | — |

**The decisive findings:**

1. **Upgrading fixes no security issue.** Prisma 7.10.0 pins the *same* vulnerable
   `deepmerge-ts@7.1.5`. It is also *worse*: the Prisma 7 CLI carries `mysql2` and `postgres`
   as direct dependencies, and `mysql2@3.15.3` is itself vulnerable — so Prisma 7 raises the
   audit count from 3 to 4, entirely through a MySQL driver this project would never load.
   Prisma 6's CLI has neither dependency.
2. **The one real finding was fixable independently of the version.** An npm
   `overrides` entry forcing `deepmerge-ts` to `^8.0.2` (the patched line; the advisory range
   is `<8.0.0`) takes the project to **0 vulnerabilities**. The override was then verified not
   to break anything: `prisma generate`, `prisma migrate status`, `prisma migrate deploy`,
   `prisma db seed` and a full app boot all still work.
3. **PostgreSQL would cost the assignment's reproducibility requirement.** It needs Docker or
   a locally installed server, while the assignment requires a README sufficient to run the
   app and tests "in a clean local environment", and our own scope rule defers Docker to the
   bonus section. The assignment explicitly lists SQLite as an acceptable choice.
4. **Prisma 7 + SQLite would add a native module.** `better-sqlite3` ships an install script
   (`prebuild-install || node-gyp rebuild`). Under **npm 12 those dependency install scripts
   are blocked by default** — a change that affects any reviewer on npm 12 — which turns a
   working install into a possible `node-gyp` compile on the reviewer's machine. Prisma 6's
   SQLite support needs no native module at all.

**Decision: stay on Prisma 6.19.3 + SQLite, with the `deepmerge-ts` override.** The upgrade
would add reviewer friction and more audit findings while fixing nothing that the override
does not already fix.

**Known minor trade-offs, accepted and documented rather than hidden:**
- Prisma 6 warns that `package.json#prisma` is deprecated and moves to `prisma.config.ts` in
  Prisma 7. It is a warning only and does not affect behaviour on 6.x.
- npm 12 blocks `@prisma/engines`' postinstall, so the engine binaries are not fetched during
  `npm install`. Prisma downloads them lazily on the first CLI command instead (~40 MB), so
  the first `prisma` command needs network access. This is recoverable and does not break the
  install. Our *own* `postinstall: prisma generate` is unaffected — npm 12 blocks dependency
  scripts, not the root project's own — verified by deleting the generated client and
  re-running `npm install`.
- SQLite has no native enum, so `Product.status` is a `String` validated at the API layer
  rather than constrained by the database. PostgreSQL would give a real enum type; app-level
  validation plus tests is the accepted substitute.

**Interview explanation:** "newest" is not automatically safer. Measured against the current
stable release, the upgrade would have added a vulnerable MySQL driver we never use and a
native build step for SQLite, while leaving the one genuine advisory untouched — that advisory
was in a transitive dependency and was fixed directly with an npm override, which is both
smaller and more targeted than a major version bump.

---

## 4. Authentication — DECIDED: JWT in an httpOnly cookie

**Decision:** on login, NestJS verifies the password with bcrypt, signs a short-lived JWT, and
sets it as an `httpOnly` cookie (`sameSite`, `secure` in production, explicit expiry). A small
custom NestJS guard verifies the cookie on every admin route. No Passport.

**Alternatives considered:**
- *Database-backed session* — the session id is opaque and logout truly invalidates it
  server-side. Rejected as more machinery (a session table plus a store) than this assignment
  needs; no requirement depends on server-side invalidation.
- *JWT in `localStorage`* — simplest client wiring, but any XSS can read the token. This
  conflicts directly with the assignment's security requirements, so it was rejected outright.

**Known trade-off (documented in the README):** because the token is stateless, logout clears
the cookie but cannot invalidate a token that has already been copied elsewhere; such a token
stays valid until it expires. This is mitigated with a short token lifetime. A session table
would be the fix if real invalidation were required.

**Where auth state lives:** only in the cookie. The token is never readable by JavaScript, is
never placed in `localStorage`, and the signing secret exists only in the backend environment.

**Interview explanation:** an httpOnly cookie is the XSS-safe place to keep a credential,
because page JavaScript cannot read it. The cost is that cookies are attached automatically,
so CSRF must be considered — handled by `sameSite` on the cookie and by CORS restricted to the
single frontend origin, with state-changing routes being non-simple JSON requests.

### 4a. Implementation details settled in Phase 3

- **Cookie lifetime is derived from the token.** `signSession()` signs the JWT, then decodes
  its `exp` claim and uses that to set the cookie's `maxAge`. Setting the two independently
  would let them drift, leaving either a cookie that outlives its token or a token the browser
  discards early.
- **The signing secret has no default.** `JWT_SECRET` missing throws with an explicit message.
  A fallback default would mean a misconfigured deployment silently signs tokens with a value
  an attacker could guess — failing loudly is safer than running insecurely.
- **Session lifetime is `JWT_EXPIRES_IN_SECONDS`, a number, not a string like `1h`.** Two
  reasons: `@nestjs/jwt` types the string form as the `ms` package's template-literal type,
  which a value read from the environment cannot satisfy without a cast; and environment
  variables are always strings, so the conversion has to be explicit and validated rather
  than assumed. The value is range-checked on use.
- **Login answers 200, not 201.** Nest defaults POST to 201 Created; authenticating creates
  no resource.
- **The token never appears in a response body** — only in the httpOnly cookie. Two e2e tests
  assert this, one for the token and one for the password hash.
- **User enumeration is mitigated in two places.** The error message is identical for an
  unknown email and a wrong password, *and* bcrypt is run against a throwaway hash when no
  user is found so the two paths take the same time. The message alone would not be enough:
  measured, the unknown-email path would otherwise return in milliseconds against bcrypt's
  ~300 ms. Verified by measurement — 0.30 s on both paths.
- **No Passport.** A ~30-line guard calling `AuthService.verifySession()` covers everything
  this assignment needs; Passport would add two dependencies and a strategy indirection for
  no gain.

**Not implemented, and why:** login rate limiting / brute-force protection. It would need
another dependency (`@nestjs/throttler`) and the assignment does not ask for it. It is
recorded as a known limitation in the README rather than silently omitted — a real deployment
of this should have it.

---

## 5. API architecture — DECIDED: browser calls NestJS directly

**Decision:** the browser calls NestJS directly with `credentials: 'include'`, and NestJS
enables CORS for the frontend origin only, with credentials. Next.js server components fetch
the public API server-to-server.

**Alternatives considered:**
- *Next.js Route Handlers as a BFF proxy* — same-origin cookies and no CORS configuration, and
  the API URL never reaches the client. Rejected because it is a second API layer to write,
  maintain and test that enforces nothing extra.
- *Next.js Server Actions* — fewer client fetches, but it hides the REST surface the assignment
  asks for and makes "validation must hold for direct API requests" harder to demonstrate.

**REST endpoints:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | – | Verify credentials, set the cookie |
| POST | `/auth/logout` | cookie | Clear the cookie |
| GET | `/auth/me` | cookie | Identify the current admin for the UI |
| GET | `/admin/products` | cookie | List: id, name, status |
| GET | `/admin/products/:id` | cookie | Full record for the editor |
| PATCH | `/admin/products/:id` | cookie | Update description, SEO fields, status |
| GET | `/products` | – | Published products only |
| GET | `/products/:slug` | – | One published product, otherwise 404 |

**Public vs private boundary:** the public endpoints filter `status = 'published'` inside the
database query. A draft is therefore not "hidden in the UI" — it is never selected. A draft or
unknown slug returns **404 rather than 403**, so the public API does not reveal that a draft
with that slug exists.

**Error strategy:** NestJS's standard HTTP exceptions — 400 for validation failures (with the
per-field messages the editor displays), 401 for missing or invalid authentication, 404 for
anything not publicly visible.

**Interview explanation:** authorization is enforced in exactly one place, the API. The UI only
decides what to show; it never decides what is allowed.

---

## 6. Validation — DECIDED: class-validator with a global ValidationPipe

**Decision:** DTOs validated by class-validator/class-transformer through a global
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. The three
length limits are also exported as shared constants on the frontend for inline character
counters.

**Alternative considered:** Zod, which would allow one schema shared by both applications.
Rejected as less idiomatic in NestJS; the duplicated values here are three integers, and the
server remains the only authority.

**Where validation happens:** on the server, in the DTO layer, before anything reaches the
database. The client-side limits exist purely for user experience and are never trusted.

**Why `whitelist` and `forbidNonWhitelisted` matter:** they strip and reject properties that
are not on the DTO, so a direct API request cannot modify `name`, `characteristics` or `id`
even though those columns exist. This is the mass-assignment protection.

**Interview explanation:** the browser form is a convenience, not a control. Every rule the
assignment states — non-empty, ≤ 1000, ≤ 60, ≤ 160 — is enforced server-side and covered by
tests issued directly against the API rather than through the UI.

### 6a. Implementation details settled in Phase 4

- **Values are trimmed before validation.** Without it, `"   "` would satisfy a non-empty
  check while being empty to a reader, and trailing whitespace would count toward the length
  limits. Trimming first means the value that is validated is exactly the value stored.
- **All four editable fields are required on `PATCH`.** The editor saves the whole form in one
  explicit action, so requiring them guarantees every save re-validates every field — there is
  no code path that writes a product without checking all of the assignment's limits.
- **Read-only fields are rejected, not ignored.** `forbidNonWhitelisted` answers a payload
  containing `name` with 400 `property name should not exist`. Silently dropping it would
  return 200 and let the caller believe a rename had succeeded.
- **Every query uses an explicit Prisma `select`.** Listing the fields that go out, rather
  than excluding the ones that must not, means a column added to the schema later cannot leak
  into a public response by default — the failure mode is a missing field, not an exposed one.
- **The published filter lives in the database query.** `findFirst({ where: { slug, status:
  'published' } })` rather than loading by slug and checking status afterwards: a draft is
  never read, so it cannot survive a later refactor of the response mapping.
- **Drafts answer 404, never 403, with a message identical to an unknown slug.** A 403 would
  confirm that a draft exists at that slug, which is itself information the public should not
  have. An e2e test asserts the two messages match.
- **Separate admin and public controllers.** They have different audiences and different
  response shapes; keeping them apart means a public route cannot accidentally inherit an
  admin response shape or lose its published-only filter.
- **The guard is applied at controller level.** `@UseGuards(JwtCookieGuard)` on
  `AdminProductsController` protects every route it contains by construction, so a new
  endpoint cannot be added unauthenticated by forgetting a decorator.
- **`characteristics` is parsed defensively.** It is JSON text because SQLite has no JSON
  column; a malformed value yields an empty list so the product page still renders, rather
  than turning a display concern into a 500.

---

## 7. UI and styling — DECIDED: Tailwind v4, no component library

**Decision:** Tailwind v4 (already present in the Next.js scaffold) with hand-written
components.

**Alternative considered:** a component library (MUI, shadcn/ui). Rejected as a dependency and
a learning surface that the assignment does not ask for.

**Responsive strategy:** a mobile-first single-column layout that becomes a two-column editor
at larger breakpoints, using Tailwind's responsive prefixes. Verified by hand at mobile width.

**Interview explanation:** the assignment grades responsive layout and clear states, not visual
sophistication. Hand-written Tailwind keeps every style decision explainable.

---

## 8. Client state management — DECIDED: none

**Decision:** React local state only. No Redux, Zustand, React Query or similar.

**What is local state:** the editor form fields and the save status (idle / saving / saved /
error). This is what makes "a failed save must not erase the user's edits" work — the form
state is owned by the component and is never reset by a failed request; only a successful
response updates the saved baseline.

**What is server state:** the products themselves, read through server components for public
pages and through fetches for admin pages.

**Why no library:** there is one form and one list. A global store would add indirection with
no benefit, and the assignment explicitly warns against unnecessary abstraction.

---

## 9. Security and content handling — DECIDED

| # | Requirement | How it is enforced |
|---|---|---|
| S1 | Admin endpoints reject unauthenticated requests | A NestJS guard on every admin route — never UI-only |
| S2 | Admin password stored hashed | bcrypt hash created by the seed; the plaintext comes from `.env` and is never committed |
| S3 | Secrets stay server-side | JWT secret and admin credentials live in the backend `.env`; never in a `NEXT_PUBLIC_*` variable or the client bundle |
| S4 | Drafts are invisible publicly | Public queries filter `status = 'published'`; a draft or unknown slug returns 404, never 403 |
| S5 | No mass assignment | `whitelist` + `forbidNonWhitelisted` — `name`, `characteristics` and `id` are not on the update DTO |
| S6 | No XSS from product content | Content is stored as plain text and rendered as React text nodes; `dangerouslySetInnerHTML` is not used anywhere; SEO fields go through Next's `generateMetadata`, which escapes them |
| S7 | Hardened cookie | `httpOnly`, `sameSite`, `secure` in production, explicit expiry; logout clears it |
| S8 | CORS restricted | Enabled for the frontend origin only, with credentials |
| S9 | No user enumeration | The same generic message for an unknown user and a wrong password |

**How user content is stored and rendered:** stored exactly as typed, with no HTML sanitisation
on the way in and no HTML interpretation on the way out. React escapes text nodes by default,
so a stored `<script>` tag is displayed as literal characters. This is verified by a test, not
assumed.

**Interview explanation:** the safe default is to treat product content as text everywhere.
Storing raw text and escaping at render time means there is no sanitiser to get wrong, and no
code path where stored content can become executable markup.

---

## 10. Repository layout — DECIDED: one repository at the root

**Decision:** a single git repository rooted at `test-task/`, containing `backend/`,
`frontend/`, `docs/`, `README.md` and `AI-WORKLOG.md`.

**Starting state:** the root was not a repository at all; `backend/` and `frontend/` were two
separate nested repositories (`backend` with zero commits, `frontend` with a single
create-next-app commit). Both nested `.git` directories are removed — approved by the
candidate — because git treats a nested repository as an untracked directory, so their contents
would never be committed to the root repository.

**Package manager:** npm, with independent installs in `backend/` and `frontend/` and a root
`package.json` holding delegating convenience scripts. npm workspaces were considered and
rejected: hoisting adds a failure mode for Prisma's generated client and Next.js resolution,
for a project with exactly two packages.

**Interview explanation:** the assignment requires one reviewable repository containing code,
tests and documentation. Keeping the two applications as plain directories with their own
`package.json` keeps them independently installable and buildable without a monorepo tool.

---

## 11. Git workflow — PROCESS

Small, meaningful milestone commits, one per completed phase.

- No commits named `changes`, `fix stuff` or `update`.
- Before each milestone commit the assistant reports what is stable, what was verified, what
  the commit should contain, and the proposed message.
- The candidate reviews the diff and creates the commit.
- Published history is never rewritten unless explicitly instructed.

Planned milestones: repository/tooling setup → schema and seed → authentication → product API
→ admin UI → public catalogue → security hardening → tests → documentation.

---

## 12. Scope and bonus policy — PROCESS

Mandatory requirements always take priority. Bonus work begins only after the mandatory scope
is complete, tested and documented.

Guiding principle: a smaller, fully understood and well-tested solution beats a larger one the
candidate cannot confidently explain. Shopify import, Figma workflow and Docker/CI are out of
scope for this submission.
