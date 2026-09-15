# AI Worklog

This document records the actual AI-assisted development of the Product Content Studio
assignment.

It exists to show which AI tools were used, what the AI contributed, what I personally
reviewed, changed or rejected, and how each result was verified.

Only work that actually happened is recorded here. No prompt, decision, test or result in this
file is invented, and entries are added as the work happens rather than reconstructed
afterwards.

---

## AI tools

### Claude Code

**Model:** Claude Opus 5 (`claude-opus-5`), running in the Claude Code VS Code extension.

**Primary role:** repository and requirements analysis, architectural proposals with
alternatives and trade-offs, implementation of code I approve, and verification runs
(tests, lint, build, direct API probes).

**How it is used:** the AI is treated as a coding assistant, not as the owner of decisions.
It is required to present each material decision as a recommendation plus realistic
alternatives and trade-offs, and to wait for my choice before implementing. It works one
phase at a time and stops after each phase for review.

**Working constraints I imposed:**
- No implementing the whole project in one pass — explicit phases only.
- No material technology decision without presenting alternatives first.
- No inventing requirements that are not in `test-task-junior.md`.
- No unnecessary abstractions, patterns, dependencies or infrastructure.
- Never claim something works without actually running it.
- Never weaken or delete a test to make the suite pass.

### Other AI tools

None used so far.

---

## Worklog entries

## 2026-09-14 — Entry 1: Phase 0, requirements and architecture analysis

### Task

Analyse `test-task-junior.md` and the existing repository, turn the assignment into phases
that can each be completed, tested and committed independently, and settle the remaining
technology decisions before any application code exists.

### AI contribution

Claude Code read the assignment and inspected the repository state: the NestJS 12 scaffold in
`backend/` (ESM, TypeScript 6, Vitest, oxlint), the Next.js 16.3.5 / React 19 scaffold in
`frontend/` (App Router, Tailwind v4, ESLint, no Prettier), and the empty documentation
templates.

It produced: a mandatory-requirement summary, a table of nine security-critical requirements
mapped to where each is enforced, a list of the critical test scenarios derived from the
assignment's own acceptance wording, a proposed stack, a proposed architecture with the REST
surface and data model, a testing strategy, a per-phase complexity estimate totalling about
eight hours, and a nine-phase implementation plan.

It also identified three gaps between the scaffold and the assignment that I had not noticed:

1. The assignment mandates **ESLint and Prettier**, but `backend/` was configured with
   **oxlint** and `frontend/` had no Prettier.
2. There was **no `README.md`** at the repository root, which is an explicitly required
   deliverable.
3. There was **no git repository at the root** — `backend/` and `frontend/` were two separate
   nested repositories, so neither would have been committed into a root repository.

### Candidate contribution

I set the working rules the AI operated under (phased execution, mandatory decision approval,
no over-engineering, honest verification). I reviewed the analysis and made every material
decision myself: SQLite + Prisma, JWT in an httpOnly cookie, browser-to-NestJS directly, and
the e2e-plus-unit-plus-component testing strategy — each chosen from the alternatives and
trade-offs presented.

I rejected the proposed repository handling as incomplete and required that the repository root
`test-task/` become the single GitHub repository root, and I explicitly authorised deleting the
two nested `.git` directories after being told exactly what they contained (zero commits in
`backend`, one create-next-app commit in `frontend`).

### Decision

The plan and stack recorded in `docs/DECISIONS.md` and `docs/IMPLEMENTATION-PLAN.md` were
accepted. No application code was written in this phase.

### Verification

Repository inspection commands were actually run: directory listing, `git status` / `git log`
in both nested repositories, and reading every `package.json`, `tsconfig.json`, lint config,
Vitest config and scaffold source file. Node 24.21.0 and npm 12.0.2 were confirmed present;
pnpm and yarn were confirmed absent, which is why npm was selected.

**Result:** the three gaps above were confirmed from the files themselves, not assumed, and
each is now assigned to Phase 1 of the plan.

### Repository evidence

`docs/IMPLEMENTATION-PLAN.md`, `docs/DECISIONS.md`, this file.

---

## 2026-09-14 — Entry 2: verifying Prisma's ESM compatibility instead of trusting it

### Task

The backend is true ESM (`"type": "module"`, `module: nodenext`), which is unusual for NestJS.
I asked whether using Prisma 6.19.3 in that setup would cause problems, and whether TypeORM
would be the easier choice.

### AI contribution

Claude Code first answered the TypeORM question analytically: TypeORM wins on having no
code-generation step and on decorator entities matching the NestJS style, but in this specific
setup ESM breaks its glob-based entity auto-discovery, migration generation needs extra CLI
ceremony, `synchronize: true` is not production-like, and it still requires the same native
`better-sqlite3` driver — so it would not remove the concern that prompted the question.

It then noticed that npm's `latest` tag for `prisma` currently points at **`8.0.0-rc.15`**, a
release candidate, meaning an unpinned `npm install prisma` would have installed a pre-release
into the project. It recommended pinning to `6.19.3`.

Rather than asserting that Prisma's CommonJS client works under ESM, it tested it:

```
npm pack @prisma/client@6.19.3     # inspect the real package
# exports["."].import.node  ->  ./default.js
# default.js                ->  module.exports = { ...require('.prisma/client/default') }
```

That export shape — a runtime spread of a `require` — is exactly what can defeat Node's
static named-export detection for CommonJS. It then built an isolated ESM scratch project,
installed `@prisma/client@6.19.3`, and ran the import both before and after reproducing the
generated client's export shape.

### Candidate contribution

I refused to accept a stack choice justified by a general claim about "ESM interop" and asked
directly whether it would break. I required evidence rather than reassurance, and I reviewed
the resulting test and its consequence for the setup instructions. The `postinstall` script is
in the plan because of this finding rather than as boilerplate.

### Decision

Prisma pinned to exactly `6.19.3` (no caret), with `"postinstall": "prisma generate"` in
`backend/package.json` so a clean clone works from a single `npm install`. Prisma 7.10.0 was
rejected because it requires a driver adapter plus the native `better-sqlite3` module, adding a
compilation step to a reviewer's clean install for no functional gain. TypeORM was rejected for
the reasons above.

### Verification

Commands actually run in an isolated scratch directory with `{"type":"module"}`:

```
node named.mjs   # import { PrismaClient } from '@prisma/client'
```

**Result, before the client is generated:**

```
SyntaxError: Named export 'PrismaClient' not found. The requested module
'@prisma/client' is a CommonJS module, which may not support all module.exports as
named exports.
```

**Result, after reproducing the generated client's export shape** (`.prisma/client/index.js`
exporting `PrismaClient` and an enum, re-exported through the same double spread):

```
NAMED IMPORT OK -> function
DEFAULT IMPORT OK -> function {"draft":"draft","published":"published"}
```

So named ESM imports of `PrismaClient` and of generated enums work correctly once
`prisma generate` has run; the only failure mode is importing before generation, which the
`postinstall` script prevents. The documented
`import pkg from '@prisma/client'; const { PrismaClient } = pkg;` fallback was confirmed to
work too, but is not needed.

This must still be re-confirmed against the real backend in Phase 2 — the scratch test
reproduced the generated client's export shape rather than running a genuinely generated
client.

### Repository evidence

`docs/DECISIONS.md` § 3; `docs/IMPLEMENTATION-PLAN.md` Phase 2.

---

## 2026-09-15 — Entry 3: catching a runtime-only failure that lint, build and tests all missed

### Task

Phase 1 wired up NestJS's global `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
true, transform: true })` in `main.ts`, ahead of the DTOs that will use it in Phase 4.

### AI contribution

Claude Code added the pipe, then — per the standing rule to never claim something works
without actually running it — started the real dev server (`npm run start:dev`) instead of
treating a clean lint/build/test run as sufficient evidence that the app worked.

The server crashed at boot:

```
[Nest] ERROR [PackageLoader] The "class-validator" package is missing. Please, make sure
to install it to use ValidationPipe.
```

`ValidationPipe` is a runtime dependency on `class-validator`/`class-transformer`; NestJS
does not declare them as hard dependencies of `@nestjs/common` because not every project uses
the pipe, so nothing in `tsc`, ESLint, or the existing unit/e2e tests could have caught the
missing packages — all three had already passed cleanly beforehand.

### Candidate contribution

None beyond the standing instruction that made this check happen at all: the working rules
for this project require every phase to actually run the app, not just its static checks,
before being reported as done.

### Decision

Installed `class-validator` and `class-transformer` as real dependencies (they were already
planned as the Phase 4 validation library per `docs/DECISIONS.md` §6, so this only moved the
installation earlier rather than changing the decision), then restarted the server.

### Verification

Before the fix: `npm run lint` clean, `npm run build` clean, `npm test` 1/1 passed,
`npm run test:e2e` 1/1 passed — none of these exercise `app.listen()`, so all four looked
green while the app could not actually start.

After installing the two packages: `npm run start:dev` booted successfully and
`curl http://localhost:3001/health` returned `200 {"status":"ok"}`.

### Repository evidence

`backend/package.json` (`class-validator`, `class-transformer` dependencies);
`backend/src/main.ts`; `docs/IMPLEMENTATION-PLAN.md` Phase 1.

---

## 2026-09-15 — Entry 4: re-testing the ORM choice instead of defending it

### Task

Before implementing Phase 2 I asked for the database layer to be tested rather than assumed:
does SQLite + Prisma 6 genuinely work inside an ESM NestJS backend, and if there are real
problems, would switching to PostgreSQL with the newest Prisma be better than shipping a
version that is a major release behind?

### AI contribution

Claude Code ran the stack for real instead of arguing from the Phase 0 decision, and reported
findings in both directions.

*It worked:* migrations, client generation and seeding all succeeded, and the ESM named
import of `PrismaClient` worked in every runtime this project uses — the compiled
`node dist/main` output, `tsx`, and vitest. `PrismaService extends PrismaClient` compiled
under `module: nodenext` and `$connect()` succeeded at boot. No workaround was needed.

*It also surfaced two problems that were not visible at planning time:*

1. `npm install` reported **3 high-severity vulnerabilities**, all tracing to
   `prisma` → `@prisma/config` → `deepmerge-ts@7.1.5`.
2. npm 12 blocks dependency install scripts by default, so `@prisma/engines`' postinstall
   never ran and the engine binaries were missing after install.

It then measured the proposed alternative rather than assuming the newer version was safer,
and found the upgrade argument did not survive contact with the data:

- npm's `latest` tag for `prisma` is `8.0.0-rc.15` — a *release candidate*, so "newest"
  really meant 7.10.0.
- Prisma 7.10.0 pins the **same** vulnerable `deepmerge-ts@7.1.5`, so upgrading fixes nothing.
- Prisma 7 is in fact *worse* here: its CLI carries `mysql2` and `postgres` as direct
  dependencies, and `mysql2@3.15.3` is itself vulnerable — taking the audit from 3 high to
  **4 high**, through a MySQL driver this project would never load. Prisma 6's CLI has
  neither dependency.
- Prisma 7 + SQLite additionally requires the native `better-sqlite3` module, whose install
  script npm 12 also blocks — risking a `node-gyp` compile on a reviewer's machine.

### Candidate contribution

I refused to let the Phase 0 decision stand unexamined simply because it had already been
approved, and I set the actual acceptance question: not "is Prisma 6 defensible?" but "is
there a real problem, and if so does upgrading fix it?". I also rejected the framing that
newer is automatically better once the audit data showed the opposite, and required that the
security finding be fixed on its own terms rather than used as a pretext for a major upgrade.

### Decision

Stay on Prisma 6.19.3 + SQLite. Fix the genuine finding directly with an npm `overrides`
entry forcing `deepmerge-ts` to `^8.0.2` (the advisory range is `<8.0.0`). PostgreSQL was
rejected because it needs Docker or a local server, which conflicts with the assignment's
requirement that the README be sufficient to run everything in a clean local environment.

The two accepted trade-offs are documented rather than hidden, in `docs/DECISIONS.md` §3a:
the `package.json#prisma` deprecation warning, and the lazy engine download on first CLI use.

### Verification

Commands actually run, with results:

```
npm audit                      3 high  ->  0 vulnerabilities   (after the override)
npx prisma generate            OK
npx prisma migrate status      "Database schema is up to date!"
npx prisma migrate deploy      OK (against a throwaway DATABASE_URL)
npm run prisma:seed            "Seeded 3 products (2 published, 1 draft)" — re-run to
                               confirm idempotency
npm run start:prod             PrismaModule initialized, /health -> 200
npm run lint / build           0 errors
npm test / test:e2e            1/1 and 1/1 passed
```

The override was specifically verified *not* to break the Prisma CLI — that was the risk of
overriding a transitive dependency of a major tool, so every Prisma command was re-run
afterwards rather than assuming a clean `npm audit` meant success.

Clean-slate reproducibility was proven by migrating and seeding a **throwaway** database at a
separate `DATABASE_URL` (`users: 1 | products: 3 | published: 2 | draft: 1`), then deleting
it. `prisma migrate reset` was *not* run: Prisma ships a guard that refuses destructive
migration commands invoked by an AI agent without the user's explicit consent, which is the
correct behaviour and was respected.

### Repository evidence

`backend/package.json` (exact Prisma pins, `overrides`); `backend/prisma/schema.prisma`;
`backend/prisma/seed.ts`; `backend/src/prisma/`; `docs/DECISIONS.md` §3a.

---

## 2026-09-15 — Entry 5: rejecting an AI-written test that passed for the wrong reason

### Task

Phase 3 added the login/logout/`me` endpoints and the guard, together with an e2e suite
covering them. This entry is about the *tests*, since the assignment specifically asks how AI
was used to write them and how their quality was judged.

### AI contribution

Claude Code generated the auth endpoints, the guard and a 17-case e2e suite. Two of its own
outputs did not survive review — one caught by the model itself before the suite was ever
run, and one caught only by the linter.

**1. A logout test that asserted nothing.** The generated test ended:

```ts
// And a request carrying no cookie is refused.
await request(app.getHttpServer()).get('/auth/me').expect(401);
```

This passes whether or not logout does anything at all — a request with no cookie was always
going to be 401. Worse, it was framed as proving that "logout means the cookie no longer
grants access", which for a **stateless JWT is simply not true**: logout clears the cookie in
the browser, but a token already copied elsewhere stays valid until it expires. The test
implied a security guarantee the implementation does not provide.

**2. Type-unsafe assertions.** Several assertions read `response.body.message` and used
`expect.any(String)`. supertest types `.body` as `any`, so those assertions were silently
unchecked — the linter flagged them as `no-unsafe-member-access` / `no-unsafe-assignment`
errors.

### Candidate contribution

I insisted the logout behaviour be described accurately rather than flatteringly, and that
the known stateless-JWT limitation be *tested* rather than merely mentioned in a document
where it could quietly drift out of date. I also rejected the option of silencing the
`no-unsafe-*` lint errors for test files — the easy fix — on the grounds that untyped
assertions are exactly where a test quietly stops testing anything.

### Decision

The single misleading logout test was replaced with three honest ones:

1. logout returns a cookie cleared with a 1970 expiry (what the server actually does);
2. a client that honours the clear instruction loses access;
3. **`does NOT revoke an already-issued token (known stateless-JWT limitation)`** — which
   asserts the real, weaker behaviour on purpose. If revocation is ever added, this test
   fails and forces both the code and `docs/DECISIONS.md` §4 to be brought back into line.

For the typing, a `bodyOf<T>()` helper plus declared `AdminBody` / `ErrorBody` interfaces
replaced the `any` access, so the assertions are type-checked rather than suppressed.

### Verification

`npm run test:e2e` → **18/18 passing** (17 auth + 1 health). `npm run lint` → 0 errors
(down from 6). `npm run build` → clean.

The limitation test was confirmed against the running server by hand, not just in the suite:
after `POST /auth/logout`, replaying the captured cookie against `/auth/me` returned **200**,
exactly as the test asserts and as the documentation states.

Two claims the code makes about itself were also checked by measurement rather than trusted:

- The timing-attack mitigation: known-email-wrong-password took 0.348 / 0.299 / 0.298 s and
  unknown-email took 0.306 / 0.305 / 0.320 s — indistinguishable, which is the point.
- Test isolation: after the suite ran, `prisma/test.db` had been removed by teardown and
  `prisma/dev.db` still contained only `admin@example.com`, proving the tests had not been
  reading or writing development data.

### Repository evidence

`backend/test/auth.e2e-spec.ts` (the three logout tests, including the explicitly-named
limitation test); `backend/test/create-test-app.ts` (`bodyOf`, `AdminBody`, `ErrorBody`);
`backend/src/auth/`; `docs/DECISIONS.md` §4a.

---

## 2026-09-15 — Entry 6: a verification that appeared to pass but proved nothing

### Task

Phase 4 added the product API. Two of the assignment's requirements are about behaviour that
a passing status code does not demonstrate: that invalid data "is not saved, including through
direct API requests", and that saved changes "remain after the application is restarted".

### AI contribution

Claude Code implemented the endpoints, the `UpdateProductDto` limits and a 37-case product
e2e suite, and then checked its own work in two ways that went beyond running the suite.

**1. Mutation-testing a boundary.** A green suite is not evidence that the tests constrain
anything. To check the limits actually bite, `@MaxLength(60)` on `seoTitle` was temporarily
changed to `@MaxLength(61)`. Exactly one test failed — `rejects 61 characters` — and the
change was reverted. That is the evidence the boundary tests are load-bearing.

**2. Catching an invalid verification of its own.** The restart requirement was tested by
saving a distinctive description, stopping the server, restarting it and re-reading the value.
The value came back, which looked like a pass. It was not:

```
Error: listen EADDRINUSE: address already in use :::3001
```

The background task's stop had killed the npm wrapper but left the `node` process running, so
the "restarted" server had failed to start and the **original process** answered the request.
The test proved only that a running server still had the data in memory-backed SQLite — not
that anything survived a restart.

The test was redone properly: the process holding port 3001 was killed directly, the absence
of any listener was *proven* (`curl` refused to connect, exit code 000) rather than assumed,
and only then was a fresh process started — a new PID, logging a clean boot — and the value
re-read. It was still there.

### Candidate contribution

The standing rule for this project — never report something as working without running it,
and treat a green result as a claim that itself needs checking — is what made both of these
happen. The second case is the more important one: the first restart test produced the
*expected output*, and only reading the background process's log revealed the result was
meaningless. Accepting a passing test at face value would have put a false verification claim
into this document.

### Decision

Both the mutation test and the corrected restart test were kept as recorded evidence rather
than quietly reported as "verified". `docs/IMPLEMENTATION-PLAN.md` Phase 4 states explicitly
that the first restart attempt was invalid and had to be redone.

### Verification

```
npm run test:e2e   55/55 passing (3 spec files)
mutation check     @MaxLength(60) -> (61) caused exactly 1 failure, then reverted
npm run lint       0 errors
npm run build      clean
```

Manual checks against the running API, beyond the suite: the public catalogue returned only
the two published products; the draft slug returned 404; `/admin/products` without a cookie
returned 401; a 1001-character description returned 400 and re-reading the record showed it
unchanged; `"name":"HACKED"` returned 400 `property name should not exist` and the name was
untouched; unpublishing removed the product from both the catalogue and its detail URL, and
republishing restored it. Development data was restored to its seeded values afterwards.

### Repository evidence

`backend/src/products/`; `backend/test/products.e2e-spec.ts`; `docs/DECISIONS.md` §6a.

---

## Required concrete examples

The assignment asks for 2–3 concrete examples of AI-generated solutions that were evaluated
rather than accepted blindly. Entry 2 above is the first. Further examples will be added from
the implementation phases, preferring the areas where a mistake would actually matter:

- authentication and the guard protecting admin routes,
- server-side validation and mass-assignment protection,
- database/API design,
- React form behaviour on a failed save,
- the automated tests themselves.

*Status: 3 of 3 recorded (entries 2, 3 and 4), satisfying the assignment's requirement for
2–3 concrete examples. Further examples will still be added as later phases produce them —
authentication and the product validation DTOs are the most likely sources — but the
requirement is already met with work that actually happened.*

---

## AI and automated testing

Standing rule for this project: a test is never weakened or deleted to make the suite green.

**What the tests currently cover.** The 18 e2e cases exercise AI-written authentication code
end-to-end over real HTTP against a real (throwaway) SQLite database: credential checking,
cookie flags, the guard on a protected route, tampered/foreign/garbage tokens, the validation
pipe's rejection of malformed and unknown fields, and logout.

**What they genuinely prove — and what they do not.** They prove the server's *observable*
behaviour: that `/auth/me` is unreachable without a valid cookie, that failed logins are
indistinguishable from unknown accounts in the response, and that unknown payload properties
are rejected rather than ignored. They do **not** prove the session cannot be stolen, and
they deliberately do not claim logout revokes a token — one test asserts the opposite, because
that is what a stateless JWT actually does.

**Whether the tests themselves have teeth.** A passing suite is a claim, not evidence. The
product boundary tests were mutation-tested: changing `@MaxLength(60)` to `@MaxLength(61)`
made exactly one test fail (`rejects 61 characters`), which is what proves that test is
actually constraining the limit. Several tests also assert the *stored row* rather than only
the status code — a 400 response does not by itself show that nothing was written.

**Where tests caught AI code, and where they did not.** Two AI mistakes in this project were
invisible to the test suite and were caught only by running things:

- the missing `class-validator` package (Entry 3) — lint, build and all tests passed while the
  application could not start, because none of them call `app.listen()`;
- the `deepmerge-ts` advisory (Entry 4) — no test can see a dependency vulnerability.

Two others were caught by tooling rather than by tests: the `@nestjs/jwt` `expiresIn` typing
and the `isolatedModules` decorator-import rule, both surfaced by `tsc`.

**AI-generated tests that were changed or rejected.** One was rejected outright: a logout test
that passed regardless of whether logout worked, and that implied a revocation guarantee the
implementation does not offer (Entry 5). Several others had assertions that read supertest's
`any`-typed body and were therefore unchecked; those were retyped rather than lint-suppressed.
The lesson recorded for the remaining phases is that a green suite says nothing on its own —
each test has to be read to see whether it could ever fail.

---

## Final AI usage summary

*To be completed at the end of the assignment.*

Tools/models actually used:

Main contributions from AI:

Main contributions from me:

Examples where AI output was changed or rejected:

How correctness was verified:

What I learned / what I would improve:

Actual development time:

Known limitations or unfinished work:
