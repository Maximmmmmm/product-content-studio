# Technical review checklist

Preparation notes for the technical interview. Each item is something you should be able to
explain from the code, plus the question an interviewer is most likely to ask about it.

---

## 1. Architecture

**What to say:** Two applications. NestJS owns the database and all the rules; Next.js is a
client of its API. The split gives one authorisation boundary — the API is the only thing that
touches data, and it enforces every rule regardless of who is calling.

**Where:** `backend/src/`, `frontend/app/`.

> *"Why not just use Next.js route handlers and skip Nest?"*
> It would work. The split was given for this assignment, and it buys a clear rule: the
> frontend holds no security responsibility at all. The cost is CORS configuration and two
> processes to run.

> *"Why is `configureApp()` a separate file?"*
> Because the e2e tests build the app through `TestingModule`, which never runs `main.ts`.
> Without sharing that function the tests would run with no cookie parser and no validation
> pipe — passing against a configuration that never ships.

---

## 2. Authentication

**What to say:** Login verifies a bcrypt hash, signs a short-lived JWT and returns it as an
httpOnly cookie. A small guard verifies it on every admin route. No Passport — a ~30-line
guard covers everything needed here.

**Where:** `backend/src/auth/`.

> *"Why a cookie and not a bearer token in localStorage?"*
> `localStorage` is readable by any script on the page, so one XSS gives up the session. An
> httpOnly cookie is not readable by JavaScript at all. The trade-off is that cookies are sent
> automatically, so CSRF has to be answered — see §9.

> *"What happens on logout?"*
> The cookie is cleared. It does **not** revoke the token — it is stateless, so a copy taken
> beforehand stays valid until it expires. That is a real limitation, it is documented, and
> there is a test asserting the actual behaviour so nobody mistakes it for revocation. A
> session table would be the fix if revocation were required.

> *"Why is the session lifetime in seconds rather than `'1h'`?"*
> `@nestjs/jwt` types the string form as the `ms` package's template-literal type, which a
> value read from the environment cannot satisfy without a cast. Environment variables are
> strings anyway, so the conversion is explicit and range-checked.

---

## 3. Authorization

**What to say:** `@UseGuards(JwtCookieGuard)` is applied at the **controller** level on
`AdminProductsController`, so every route inside it is protected by construction — a new
endpoint cannot be added unprotected by forgetting a decorator.

**Where:** `backend/src/products/admin-products.controller.ts`.

> *"How do you know the UI isn't what's protecting it?"*
> An e2e test sends an unauthenticated `PATCH` and then re-reads the row to confirm nothing
> was written — the 401 alone would only prove the response code.

> *"Why isn't logout guarded?"*
> So a stale or expired cookie can still be cleared. Guarding it would trap a user with a bad
> cookie.

---

## 4. Validation

**What to say:** DTOs validated by a global `ValidationPipe` with `whitelist` and
`forbidNonWhitelisted`. All four editable fields are required, so every save re-validates
everything. Values are trimmed before validation, so `"   "` fails the non-empty rule and
trailing whitespace does not count toward a limit.

**Where:** `backend/src/products/dto/update-product.dto.ts`, `backend/src/app-setup.ts`.

> *"What stops someone renaming a product through the API?"*
> `name` is not on the DTO, and `forbidNonWhitelisted` makes an unknown property a 400 rather
> than silently dropping it. The caller is told it was refused instead of getting a 200 and
> believing the rename worked.

> *"The frontend has the same limits — isn't that duplication?"*
> Yes, deliberately. The client copy drives character counters and disables the button early;
> it is a convenience. The server re-validates everything, and the boundary tests are issued
> directly against the API, not through the UI.

---

## 5. Database design

**What to say:** Two tables. `Product` holds the factual fields (read-only in the app) and the
editable content. `characteristics` is JSON-encoded text because SQLite has no JSON column.
`status` is an indexed string, not an enum, because the SQLite connector does not support
Prisma enums.

**Where:** `backend/prisma/schema.prisma`.

> *"Why SQLite?"*
> The assignment allows it and it makes the project run with no database server — which is
> what "reproducible local setup" asks for. Because Prisma abstracts the dialect, moving to
> PostgreSQL means changing the provider and connection string, not application code.

> *"What does SQLite cost you here?"*
> A real enum for `status`, enforced by the database. It is validated at the API layer instead
> and covered by tests. Be honest about this — it is the one genuine downside.

> *"Why pin Prisma to 6.19.3?"*
> npm's `latest` tag for `prisma` is currently a release candidate, so an unpinned install
> would pull a pre-release. Prisma 7 was measured and rejected: it pins the same vulnerable
> `deepmerge-ts`, adds a vulnerable `mysql2` this project never loads, and needs a native
> module for SQLite.

---

## 6. API design

**What to say:** Separate admin and public controllers. Public queries filter
`status = 'published'` **in the database query**, and every query uses an explicit Prisma
`select`.

**Where:** `backend/src/products/products.service.ts`.

> *"Why explicit `select` everywhere instead of excluding fields?"*
> Listing what goes out means a column added to the schema later cannot leak into a public
> response by default. The failure mode is a missing field, not an exposed one.

> *"Why 404 for a draft instead of 403?"*
> A 403 confirms something exists at that URL. The response body for a draft is byte-identical
> to an unknown slug, and there is a test asserting the two messages match.

---

## 7. React architecture

**What to say:** Public pages are server components fetching the API server-to-server. Admin
pages are client components calling the API directly with the cookie. No state-management
library — one form and one list do not need one.

**Where:** `frontend/app/`, `frontend/lib/api.ts` vs `frontend/lib/server-api.ts`.

> *"How do you guarantee a failed save doesn't wipe the user's edits?"* **(most likely
> question — know this one cold)**
> Three pieces of state: `values` (on screen), `savedValues` (server-confirmed), `saveState`.
> One rule: only a successful response may write to `values` or `savedValues`. The catch block
> touches `saveState` and nothing else. `saveState` resets on every keystroke, so a stale
> "Saved" can never sit next to unsaved edits.

> *"How do you know that actually works?"*
> It was mutation-tested — adding `setValues(...)` to the error path failed exactly the two
> data-preservation tests and nothing else.

> *"Why `cache: 'no-store'` on the public pages?"*
> Unpublishing must take effect immediately. A cached catalogue could keep serving a product
> the manager just withdrew — the same leak the draft rule exists to prevent, by another
> route. The cost is that `/` is a dynamic route.

---

## 8. Testing

**What to say:** 76 tests. Backend e2e over real HTTP against a real throwaway database is the
backbone, because the requirements are HTTP-level facts about what happens when someone
bypasses the UI. Frontend tests cover only genuinely client-side behaviour.

**Where:** `backend/test/`, `frontend/test/`.

> *"How do you know your tests actually test anything?"*
> The important ones were mutation-tested — deliberately broken to confirm they go red.
> Loosening `@MaxLength(60)` to 61 failed exactly one test; wiping the form on a failed save
> failed exactly two; removing the `X-Powered-By` fix failed exactly one.

> *"Did you write any tests you then threw away?"*
> Yes. A logout test that asserted `GET /auth/me` with no cookie returns 401 — which passes
> whether or not logout does anything, and implied a revocation guarantee that does not exist.
> It was replaced with three tests, one of which asserts the real weaker behaviour.

> *"Why no browser E2E?"*
> Judged disproportionate to the budget. It is listed as a known limitation rather than
> glossed over — there is no automated proof the UI looks right in a browser.

---

## 9. Security

**What to say:** Walk the S1–S10 table in `docs/DECISIONS.md`. Each row was verified against
the running system in Phase 7, not just read against the code.

> *"Cookie auth — what about CSRF?"*
> No token, deliberately. Two independent mechanisms already block it: `SameSite=Lax` means the
> cookie is not sent on cross-site POST/PATCH at all, and every state-changing request is JSON,
> making it non-simple so the browser must preflight — and CORS only ever returns the one
> configured origin. Verified with a preflight from a hostile origin. A token would be a third
> layer guarding nothing the first two let through.

> *"How is XSS prevented?"*
> Content is stored verbatim and escaped at render. There is no input sanitiser, so there is no
> sanitiser to get wrong or bypass. `react/no-danger` is an ESLint **error**, so
> `dangerouslySetInnerHTML` fails the build anywhere — including in code not yet written.
> Verified end-to-end with a stored payload combining `<script>`, `<img onerror>` and a `">`
> attribute breakout.

> *"Can you enumerate valid accounts?"*
> No. The message is identical for an unknown email and a wrong password, **and** bcrypt runs
> against a throwaway hash when no user is found so both take the same time. Measured: ~0.30 s
> either way.

> *"What would you add for production?"*
> Login rate limiting, TLS termination (the `Secure` flag needs it), and a session store if
> real logout revocation were required.

---

## 10. AI usage

**What to say:** AI wrote most of the implementation; the decisions, the review and the
verification standard were yours. `AI-WORKLOG.md` has the concrete examples.

> *"What did you reject from the AI?"*
> Have two or three ready. The strongest: the logout test that passed regardless of behaviour;
> the Prisma 7 upgrade proposal, rejected after measuring that it adds vulnerabilities rather
> than removing them; and lint-suppressing untyped test assertions, replaced with a typed
> helper instead.

> *"How did you check the AI's code was correct?"*
> Tests, plus running things. Two bugs were invisible to a green test suite: the missing
> `class-validator` package (lint, build and all tests passed while the app could not start,
> because none of them call `listen()`), and a `curl` restore that silently corrupted stored
> UTF-8. Both were caught by actually running the system.

---

## Things to be honest about

Do not oversell these — being straightforward about them is better than being caught:

1. Logout does not revoke a stateless token.
2. No browser E2E; no verified mobile rendering.
3. No login rate limiting.
4. SQLite gives no database-level enum for `status`.
5. Prisma is one major version behind current stable — a deliberate, measured choice.
