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

For WalletConnect support in `apps/web`, set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env`.

## Root scripts

- `pnpm dev`: start the Next.js web app only
- `pnpm dev:all`: run all dev tasks in parallel (turbo)
- `pnpm dev:api:docker`: start Go API in Docker (deterministic reset on each startup)
- `pnpm dev:api:docker:stubs`: start Go API + optional Redis/Postgres stubs
- `pnpm dev:api:docker:down`: stop and remove Docker demo stack (including volumes)
- `pnpm dev:api:docker:logs`: follow Docker demo stack logs
- `pnpm build`: build all workspace packages/apps
- `pnpm lint`: lint all workspace packages/apps
- `pnpm typecheck`: typecheck all workspace packages/apps
- `pnpm test`: run all workspace tests
- `pnpm check`: codegen drift check + lint/type/test/build
- `pnpm contracts:validate`: basic OpenAPI/proto validation
- `pnpm codegen`: regenerate `packages/api-types`
- `pnpm codegen:check`: fail if generated artifacts are stale

## Local Docker demo

One-command startup for reproducible API demos:

```bash
pnpm dev:api:docker
```

The launcher expects `.env`. If missing, it auto-creates `.env` from `.env.example`.

API health:

```bash
curl http://localhost:8080/health
```

Enable optional Redis/Postgres stubs:

```bash
pnpm dev:api:docker:stubs
```

Stub connection details:

- Values come from `.env` (seeded from `.env.example` by default)
- Default Redis host port: `localhost:16379`
- Default Postgres host port: `localhost:15432`
- Default Postgres database: `dexera`
- Default Postgres user/password: `dexera` / `dexera`

Stop everything:

```bash
pnpm dev:api:docker:down
```

Notes:

- `pnpm dev:api:docker` resets stack state before startup (`down -v`) for deterministic demos.
- Redis/Postgres stubs are optional infrastructure placeholders. Current BFF endpoints do not require them yet.

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- TypeScript/Next.js checks + Playwright smoke test
- Go format/vet/test
- Rust fmt/clippy/test
- Contract validation and generation drift checks
