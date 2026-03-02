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
- `pnpm build`: build all workspace packages/apps
- `pnpm lint`: lint all workspace packages/apps
- `pnpm typecheck`: typecheck all workspace packages/apps
- `pnpm test`: run all workspace tests
- `pnpm check`: codegen drift check + lint/type/test/build
- `pnpm contracts:validate`: basic OpenAPI/proto validation
- `pnpm codegen`: regenerate `packages/api-types`
- `pnpm codegen:check`: fail if generated artifacts are stale

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- TypeScript/Next.js checks + Playwright smoke test
- Go format/vet/test
- Rust fmt/clippy/test
- Contract validation and generation drift checks
