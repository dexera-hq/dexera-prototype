# Dexera monorepo bootstrap

Polyglot monorepo scaffold for Dexera with a TypeScript/Next.js-first frontend and service runtime in Go + Rust.

## Workspace layout

- `apps/web`: Next.js TypeScript frontend (app router)
- `apps/bff-go`: Go BFF with `/health` and `/api/v1/placeholder`
- `services/market-data`: Rust scaffold with health/ping behavior
- `services/execution`: Rust scaffold with health/ping behavior
- `services/portfolio`: Rust scaffold with health/ping behavior
- `packages/shared-types`: hand-written shared TS domain types
- `packages/api-types`: generated TS types from OpenAPI/proto contracts
- `packages/config-eslint`: reusable ESLint presets
- `packages/config-typescript`: reusable TS config presets
- `contracts/openapi`: public BFF OpenAPI contracts
- `contracts/proto`: internal proto contracts

## Quick start

```bash
pnpm install
pnpm codegen
pnpm check
```

## Root scripts

- `pnpm dev`: run all dev tasks in parallel (turbo)
- `pnpm dev:docker`: start frontend + backend in Docker (deterministic reset on each startup)
- `pnpm dev:docker:stubs`: start frontend + backend + optional Redis/Postgres stubs
- `pnpm dev:docker:down`: stop and remove Docker demo stack (including volumes)
- `pnpm dev:docker:logs`: follow Docker demo stack logs
- `pnpm dev:api:docker*`: compatibility aliases to the `dev:docker*` commands above
- `pnpm build`: build all workspace packages/apps
- `pnpm lint`: lint all workspace packages/apps
- `pnpm typecheck`: typecheck all workspace packages/apps
- `pnpm test`: run all workspace tests
- `pnpm check`: codegen drift check + lint/type/test/build
- `pnpm contracts:validate`: basic OpenAPI/proto validation
- `pnpm codegen`: regenerate `packages/api-types`
- `pnpm codegen:check`: fail if generated artifacts are stale

## Local Docker demo

One-command startup for reproducible frontend + backend demos:

```bash
pnpm dev:docker
```

The launcher expects `.env`. If missing, it auto-creates `.env` from `.env.example`.

Frontend and backend health:

```bash
curl http://localhost:3000
curl http://localhost:8080/health
```

Enable optional Redis/Postgres stubs:

```bash
pnpm dev:docker:stubs
```

Stub connection details:

- Values come from `.env` (seeded from `.env.example` by default)
- Default Redis host port: `localhost:16379`
- Default Postgres host port: `localhost:15432`
- Default Postgres database: `dexera`
- Default Postgres user/password: `dexera` / `dexera`

Stop everything:

```bash
pnpm dev:docker:down
```

Notes:

- `pnpm dev:docker` resets stack state before startup (`down -v`) for deterministic demos.
- Redis/Postgres stubs are optional infrastructure placeholders. Current BFF endpoints do not require them yet.

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- TypeScript/Next.js checks + Playwright smoke test
- Go format/vet/test
- Rust fmt/clippy/test
- Contract validation and generation drift checks
