# Architecture

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL)

## Scaffolding status
- `enterprise` — ✅ newly scaffolded from `template-enterprise/` (project directory was empty except for `.git`, `.github`, and a stub `README.md`).

## Layout
- `frontend/` — Angular 19 standalone-component SPA (project name `frontend` in `angular.json`), built to `dist/frontend/browser`.
- `backend/` — NestJS API with `nestjs-trpc` router composition, Prisma ORM, health checks (`/health`) via `@nestjs/terminus`.
- `docker-compose.yml` — local dev orchestration.
- `.pipeline/surface.json` — generated route/component/test-id manifest consumed by the test_spec agent and Playwright test generator.
- `.colossus-acceptance.json` — acceptance contract read by the post-deploy render gate.
- `colossus.yaml` — build manifest read by deploy agents (framework: angular, backend: nestjs on port 3001).

## Next steps for the developer / build agents
1. Implement the StockRoom feature set described in the technical plan (auth, items, locations, movements, reports) on top of this scaffold — the plan's technologies (NestJS + Prisma/Postgres + Angular) match this template's stack directly.
2. Update `backend/prisma/schema.prisma` with the StockRoom data model (`User`, `Item`, `Location`, `StockLevel`, `Movement`) and run `npx prisma migrate dev` from `backend/` once a database is available.
3. Replace the template's demo `users` tRPC router / `HomeComponent` with the real StockRoom modules (auth, items, locations, movements, reports) per the plan.
4. Keep `frontend/package.json` dependencies verbatim unless a new dependency is genuinely required by a plan feature (see prebaked node_modules note in Dockerfile).
5. Update `.pipeline/surface.json` and `.colossus-acceptance.json` as real routes/components/test-ids replace the placeholder ones — downstream test generation depends on these being accurate.
6. Run `docker compose up` for local dev once environment variables (`DATABASE_URL`, `JWT_SECRET`, `PORT`) are configured.

## Template sources
- `template-enterprise/` from the scaffold-templates library (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL).
