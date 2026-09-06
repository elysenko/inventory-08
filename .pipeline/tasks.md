# Pipeline Task Decomposition

## Summary
**StockRoom** is a warehouse stock-tracking app: a NestJS + Prisma/Postgres API and an Angular 19 standalone-component SPA. Authenticated users record stock movements (`IN`, `OUT`, `TRANSFER`) against items and locations; every movement is an immutable audit row that adjusts per-location `StockLevel` balances inside a single race-safe transaction. Managers/admins additionally manage the item and location catalogs, read the full audit log, and view a low-stock report (`SUM(StockLevel.qty) <= Item.reorderAt`). Auth is JWT bearer with role-based access (`USER` = clerk, `MANAGER`, `ADMIN`); every navigable state is URL-addressable (filters, wizard step, modals, and tabs live in query/route params) so deep links survive a hard refresh.

## Surface contract

### Backend routes (all under global prefix `/api`)
| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/health` | public |
| GET | `/api/health/deep` | public (`SELECT 1`, 503 on failure) |
| POST | `/api/auth/signup` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | authenticated |
| GET | `/api/items` | authenticated (`?q`, `?lowStock`, `?page`, `?pageSize`) |
| GET | `/api/items/:id` | authenticated (levels + totalQty) |
| POST | `/api/items` | MANAGER/ADMIN |
| PATCH | `/api/items/:id` | MANAGER/ADMIN |
| DELETE | `/api/items/:id` | MANAGER/ADMIN |
| GET | `/api/items/:id/movements` | authenticated |
| GET | `/api/locations` | authenticated |
| POST | `/api/locations` | MANAGER/ADMIN |
| PATCH | `/api/locations/:id` | MANAGER/ADMIN |
| DELETE | `/api/locations/:id` | MANAGER/ADMIN |
| POST | `/api/movements` | authenticated |
| GET | `/api/movements` | MANAGER/ADMIN (`?itemId`, `?type`, `?from`, `?to`, `?page`, `?pageSize`) |
| GET | `/api/reports/low-stock` | MANAGER/ADMIN |
| GET | `/api/admin/settings` | ADMIN |
| PATCH | `/api/admin/settings` | ADMIN |

### Frontend routes (`frontend/src/app/app.routes.ts`, each carrying `data.flow`)
- `/login` — public, `flow: 'auth.login'`, renders the **StockRoom** wordmark (smoke oracle)
- `/signup` — public, `flow: 'auth.signup'`
- `/403` — public, `flow: 'forbidden'`
- `''` → `ShellComponent`, `canActivate: [authGuard]`:
  - `''` → redirect to `items`
  - `items` — `flow: 'items.list'`; `?q`, `?lowStock`, `?page`, `?sort`, `?modal=create-item`
  - `items/:id` — `flow: 'items.detail'`; children `levels` (default) and `movements`; `?modal=edit-item`
  - `locations` — `flow: 'locations.list'`, `managerGuard`; `?modal=create-location|edit-location&id=`
  - `movements/new` — `flow: 'movements.new'`; `?step=1|2|3`, `?itemId`, `?type`
  - `movements` — `flow: 'movements.log'`, `managerGuard`; `?itemId`, `?type`, `?from`, `?to`, `?page`
  - `reports/low-stock` — `flow: 'reports.lowStock'`, `managerGuard`
  - `admin/settings` — `flow: 'admin.settings'`, `adminGuard`
- `**` → redirect to `''`

### Entities
`User(id, email, name?, passwordHash, role, createdAt, updatedAt)` · `ColossusAccount` (platform, exists) · `Item(id, sku, name, description?, unit, reorderAt, createdAt, updatedAt)` · `Location(id, name, zone, createdAt)` · `StockLevel(id, itemId, locationId, qty)` · `Movement(id, type, itemId, fromLocId?, toLocId?, qty, note?, userId, createdAt)` · `SystemSetting(key, value, updatedAt)`

### Roles
`enum Role { USER MANAGER ADMIN }`, `@default(USER)`. `USER` = the spec's *clerk*; `MANAGER` = the spec's *manager*; `ADMIN` has every manager permission plus `/admin/settings`. Manager-guarded surfaces accept `MANAGER` **or** `ADMIN`.

## db_agent tasks
- [ ] Extend `backend/prisma/schema.prisma`: keep the existing `User` model and `enum Role { USER MANAGER ADMIN }` with `role Role @default(USER)`; do not remove `ColossusAccount`.
- [ ] Add `enum MovementType { IN OUT TRANSFER }` to `backend/prisma/schema.prisma`.
- [ ] Add `Item(id String @id @default(cuid()), sku String @unique, name String, description String?, unit String, reorderAt Int @default(0), createdAt, updatedAt)`.
- [ ] Add `Location(id String @id @default(cuid()), name String @unique, zone String, createdAt)`.
- [ ] Add `StockLevel(id, itemId, locationId, qty Int @default(0))` with `@@unique([itemId, locationId])`, an index on `itemId`, and relations to `Item`/`Location`.
- [ ] Add `Movement(id, type MovementType, itemId, fromLocId String?, toLocId String?, qty Int, note String?, userId, createdAt)` with named relations `fromLoc`/`toLoc` to `Location`, a relation to `User`, and indexes on `([itemId, createdAt])` and `(createdAt)`.
- [ ] Add `SystemSetting(key String @id, value String, updatedAt DateTime @updatedAt)` for admin-configurable service credentials (postgresql, minio).
- [ ] Generate the initial migration under `backend/prisma/migrations/` so `npx prisma migrate deploy` creates every table from an empty database.
- [ ] Keep `backend/prisma/seed/seed.js` essential-only: it must continue to materialize `COLOSSUS_ACCOUNTS_JSON` into `colossus_accounts` + `User` rows (bcrypt, idempotent upsert) and must map contract roles `ADMIN`/`MANAGER`/`USER` onto the `Role` enum. Do **not** add item/location/movement sample rows.
- [ ] Verify `npx prisma generate` succeeds and the generated client exports `MovementType` and `Role` for the backend to import.

## backend_agent tasks
- [ ] Wire `backend/src/main.ts`: global `ValidationPipe({ whitelist: true, transform: true })`, `app.setGlobalPrefix('api')`, CORS for the dev origin, listen on `PORT` (default 3000).
- [ ] Update `backend/src/app.module.ts` to import the auth, users, items, locations, movements, reports, admin-settings and health modules and register `JwtAuthGuard` then `RolesGuard` as `APP_GUARD` (auth-then-role, in that order).
- [ ] Create `backend/src/common/decorators/public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`.
- [ ] Create `backend/src/common/guards/jwt-auth.guard.ts` (extends `AuthGuard('jwt')`, returns `true` when `@Public()` metadata is present on handler or class) and `roles.guard.ts` (reads `@Roles(...)`, throws `ForbiddenException` on mismatch, treats `ADMIN` as satisfying `MANAGER`).
- [ ] Create `backend/src/auth/` (`auth.module.ts`, `auth.service.ts`, `auth.controller.ts`, `jwt.strategy.ts`, `dto/login.dto.ts`, `dto/signup.dto.ts`): `POST /api/auth/signup` (bcrypt cost 10; role `MANAGER` iff `user.count() === 0`, else `USER`; 400 on duplicate email), `POST /api/auth/login` (401 `Invalid credentials`), `GET /api/auth/me`. Both mint `{ accessToken, user }` with 12h JWT payload `{sub, email, role}`. Logout is client-side only.
- [ ] `JwtStrategy` must re-read the user from the DB on every request (confirm `sub` still exists, take `role` from the row) so role changes take effect immediately; 401 when the user is gone.
- [ ] Flesh out `backend/src/users/users.service.ts` + `users.module.ts` with `findByEmail`, `findById`, `create`, `count` used by auth.
- [ ] Update `backend/src/health/health.controller.ts`: `GET /api/health` → `{status:'ok'}` and `GET /api/health/deep` → `SELECT 1` via Prisma, 503 on failure. Both `@Public()`.
- [ ] Create `backend/src/items/` module/service/controller with `GET /api/items` (`?q` sku/name contains insensitive, `?lowStock=true`, `?page`, `?pageSize`; each row returns `sku, name, unit, reorderAt, totalQty` from a `stockLevels` aggregate) and `GET /api/items/:id` (`levels: [{locationId, locationName, zone, qty}]` + `totalQty`, 404 when absent).
- [ ] Add `POST/PATCH/DELETE /api/items` (`@Roles(MANAGER)`) with `dto/create-item.dto.ts` (`sku` `@Matches(/^[A-Za-z0-9-]+$/)`, `name`, `unit` required, `description?`, `reorderAt` `@IsInt @Min(0)`) and `dto/update-item.dto.ts`; pre-check `findUnique({sku})` → `BadRequestException({message:['sku must be unique'], error:'Bad Request'})` and map Prisma `P2002` to the same 400; `DELETE` returns 400 when movements reference the item.
- [ ] Create `backend/src/locations/` module/service/controller: `GET /api/locations` authenticated, `POST/PATCH/DELETE` `@Roles(MANAGER)`; `dto/create-location.dto.ts` + `dto/update-location.dto.ts` (`name`, `zone` required); duplicate name → 400 (pre-check + `P2002`); `DELETE` returns 400 when any `StockLevel.qty > 0` or movements reference the location.
- [ ] Create `backend/src/movements/dto/create-movement.dto.ts` (`type` `@IsEnum(MovementType)`, `itemId`, `qty` `@IsInt @Min(1)`, `fromLocId?`, `toLocId?`, `note?` `@MaxLength(500)`) and `dto/query-movements.dto.ts` (`itemId?`, `type?`, `from?`, `to?`, `page?`, `pageSize?`).
- [ ] Implement shape validation in `movements.service.ts` before the transaction: `IN` requires `toLocId` and rejects `fromLocId`; `OUT` requires `fromLocId` and rejects `toLocId`; `TRANSFER` requires both and rejects `fromLocId === toLocId`. Violations → 400.
- [ ] Implement `POST /api/movements` (any authenticated) as one `prisma.$transaction`: debit first via conditional `tx.$executeRaw` `UPDATE "StockLevel" SET qty = qty - ${qty} WHERE "itemId"=… AND "locationId"=… AND qty >= ${qty}` → 0 rows affected throws `BadRequestException('Insufficient stock')`; then credit via `tx.stockLevel.upsert` (`increment`); then `tx.movement.create({...dto, userId})` so audit row and balances commit together. No read-then-write balance check, no `decrement`.
- [ ] Implement `GET /api/movements` (`@Roles(MANAGER)`): filters `itemId`, `type`, `from`/`to` (ISO, `to` inclusive to end-of-day), pagination, `createdAt desc`; each row includes `user.email`, `item.sku/name`, `type`, `qty`, `fromLoc.name`, `toLoc.name`, `note`, `createdAt`. Add `GET /api/items/:id/movements` (authenticated) for item-scoped history. No update/delete endpoints — movements are immutable.
- [ ] Create `backend/src/reports/` with `GET /api/reports/low-stock` (`@Roles(MANAGER)`): single raw query `SELECT i.*, COALESCE(SUM(s.qty),0) AS "totalQty" FROM "Item" i LEFT JOIN "StockLevel" s ON s."itemId"=i.id GROUP BY i.id HAVING COALESCE(SUM(s.qty),0) <= i."reorderAt" ORDER BY (COALESCE(SUM(s.qty),0) - i."reorderAt") ASC`, returning `{id, sku, name, unit, reorderAt, totalQty, deficit}`.
- [ ] Create `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; when the value is absent or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row for that key; returns `null` when neither is set. Export `ServiceUnconfiguredError` (mapped to HTTP 503) for callers that require a configured service.
- [ ] Create `backend/src/admin/settings.{module,service,controller}.ts`: `GET /api/admin/settings` lists the postgresql and minio credential keys with masked values and a `configured` boolean; `PATCH /api/admin/settings` upserts key/value pairs. Both `@Roles(ADMIN)`.
- [ ] Ensure static serving/deep-link fallback is correct for the deployed topology: `/api/*` must never be swallowed by the SPA fallback, and unknown non-API paths must serve `index.html` (Express 5 / Nest 11 `{*path}` syntax if `ServeStaticModule` is used; otherwise the nginx `try_files` rule in `frontend/nginx.conf`). Verify with `curl /api/health` against the built image.
- [ ] Update `README.md`: how to run (`docker compose up`), migrate/seed commands, the platform-account login model (`COLOSSUS_ACCOUNTS_JSON`, login at `/login`), and the role matrix.

## ui_agent tasks
- [ ] Rewrite `frontend/src/app/app.routes.ts` with the full route table from the surface contract, every entry carrying `data.flow`, guards attached, and `**` → `''`.
- [ ] Update `frontend/src/app/app.config.ts`: `provideRouter(routes, withComponentInputBinding())` and `provideHttpClient(withInterceptors([authInterceptor]))`.
- [ ] Set `frontend/src/index.html` `<title>StockRoom</title>` and write design tokens (colors, spacing, table/badge/form styles) in `frontend/src/styles.css`.
- [ ] Create `frontend/src/app/shell/shell.component.ts` — **StockRoom** brand header, role-aware nav (Items + Record Movement for everyone; Locations, Low Stock, Audit Log for managers/admins; Settings for admins), logout action, `<router-outlet>`.
- [ ] Create `frontend/src/app/auth/login.page.ts` — email/password form, renders the literal text **StockRoom** in the DOM (smoke oracle), inline 401 error, honours `?returnUrl=`.
- [ ] Create `frontend/src/app/auth/signup.page.ts` — email/password form with duplicate-email 400 rendered inline on the email control, link to `/login`.
- [ ] Create `frontend/src/app/shared/forbidden.page.ts` for `/403` with a link back to `/items`.
- [ ] Create `frontend/src/app/items/item-list.page.ts` — table of `sku · name · unit · reorderAt · totalQty` with a low-stock badge when `totalQty <= reorderAt`; search box and low-stock toggle write to `?q`/`?lowStock` query params (never local-only state); pagination via `?page`; loading, empty and error states; "New item"/edit/delete controls render only for managers/admins.
- [ ] Create `frontend/src/app/items/item-detail.page.ts` — item header, `levels` tab showing `location · zone · qty` plus a visible **Total** row equal to `totalQty`, `movements` tab with item history; both tabs are child routes so they are deep-linkable.
- [ ] Create `frontend/src/app/items/item-form.dialog.ts` — create/edit driven by `?modal=create-item|edit-item` (restored on reload), fields `sku, name, description, unit, reorderAt`, API 400 messages surfaced inline on the offending control (duplicate SKU shows on `sku`).
- [ ] Create `frontend/src/app/locations/location-list.page.ts` and `location-form.dialog.ts` — `name · zone` table, create/edit via `?modal=create-location|edit-location&id=`, duplicate-name 400 inline, delete-blocked 400 shown as a form-level error.
- [ ] Create `frontend/src/app/movements/movement-new.page.ts` — three-step wizard driven by `?step=1|2|3` with `?itemId=&type=`: (1) searchable item select, (2) type `IN|OUT|TRANSFER` with location controls shown/required per type and an available-qty hint per source location, (3) qty + note + confirm summary. Client-side blocks `qty > available` for `OUT`/`TRANSFER`; a server 400 renders as a form-level error and keeps the user on step 3; success navigates to `/items/:id/levels` with a success toast.
- [ ] Create `frontend/src/app/movements/movement-log.page.ts` — `when · who (email) · item · type · qty · from → to · note` table with item-select, type-select, from/to date inputs and paginator all bound to query params; empty state.
- [ ] Create `frontend/src/app/reports/low-stock.page.ts` — `sku · name · onHand · reorderAt · deficit` sorted by worst deficit, each row linking to the item detail, empty state "Everything is above its reorder threshold".
- [ ] Create `frontend/src/app/admin/settings.page.ts` at `/admin/settings` — one section per provisioned service (**postgresql**, **minio**) with a configured/unconfigured badge and a credential form per service; show the banner "The following need credentials to activate: …" for any service the API reports as unconfigured.
- [ ] Add `data-testid` attributes to every list, form, empty state and error region introduced above and register the new components/testIds in `.pipeline/surface.json`.

## service_agent tasks
- [ ] Create `frontend/src/app/core/models.ts` — typed interfaces for `User`, `Role`, `Item`, `ItemDetail`, `StockLevelRow`, `Location`, `Movement`, `MovementType`, `LowStockRow`, `Paginated<T>`, `SettingEntry`, matching the backend response shapes exactly.
- [ ] Create `frontend/src/app/core/api.ts` — typed `HttpClient` wrappers over every route in the surface contract (`base = '/api'`): auth, items (+ `:id/movements`), locations, movements, reports, admin settings; query params passed through `HttpParams` so component state maps 1:1 to URL state.
- [ ] Create `frontend/src/app/core/auth.service.ts` — signals `token`, `user`, computed `isAuthenticated`/`isManager`/`isAdmin`; hydrates from `localStorage` on construction; `login()`, `signup()`, `logout()` (clears storage, navigates to `/login`); `me()` refresh on boot when a token exists.
- [ ] Create `frontend/src/app/core/auth.interceptor.ts` — attaches `Authorization: Bearer <token>` when present; on 401 clears the session and redirects to `/login?returnUrl=<current url>`; on 403 redirects to `/403`.
- [ ] Create `frontend/src/app/core/auth.guard.ts`, `role.guard.ts` (`managerGuard` requires `MANAGER` or `ADMIN`, `adminGuard` requires `ADMIN`; both redirect to `/403`, unauthenticated → `/login?returnUrl=…`).
- [ ] Remove or bypass the scaffold's tRPC client wiring (`frontend/src/app/trpc-client.types.ts` and any `home.component.ts` usage) so the SPA talks only to the REST surface above, and confirm `frontend/proxy.conf.json` proxies `/api` to the backend in dev.

## tester tasks
- [ ] Backend e2e `backend/test/auth.e2e-spec.ts` — unauthenticated `GET /api/items` → 401; `GET /api/health` → 200 without a token; login with each seeded platform account → 200 + token; wrong password → 401; `GET /api/auth/me` returns the caller's role.
- [ ] Backend e2e `backend/test/items.e2e-spec.ts` — clerk (`USER`) `POST /api/items` → 403 and `POST /api/locations` → 403; manager → 201; duplicate SKU → 400 **and** `item.count({where:{sku}})` still 1; `GET /api/items?q=` and `?lowStock=true` return only matching rows.
- [ ] Backend e2e `backend/test/movements.e2e-spec.ts` — IN 50 into Zone A → level 50 plus one movement row carrying the acting user, qty, type, timestamp; OUT 20 → level 30; TRANSFER 10 A→B → A 20, B 10, `totalQty` unchanged; OUT 10 against a 5-unit level → 400 **and** the level re-reads as 5.
- [ ] Backend e2e `backend/test/reports.e2e-spec.ts` — item with `reorderAt` 10 and 12 on hand appears in `/api/reports/low-stock` after an OUT of 5, a 40-on-hand item does not; `/api/movements?itemId=` and `?from=&to=` return only matching rows; clerk hitting `/api/movements` → 403.
- [ ] Backend e2e for admin settings — `GET/PATCH /api/admin/settings` returns 403 for `USER`/`MANAGER`, 200 for `ADMIN`; a PATCHed key is readable through `resolveConfig` when the env var is absent or `PLACEHOLDER_CONFIGURE_IN_SETTINGS`.
- [ ] Frontend Playwright `frontend/e2e/smoke.spec.ts` — loading the app root while unauthenticated redirects to `/login` and the rendered DOM contains `StockRoom`.
- [ ] Frontend Playwright flow test — login → item list → record an `IN` through the wizard → item detail levels show the new balance; plus deep-link reload tests on `/items/:id/movements` and `/movements/new?step=2` and a manager-only route hit as a clerk landing on `/403`.
- [ ] Verify the deployed topology end-to-end from a clean volume: `npx prisma migrate deploy && node prisma/seed/seed.js` then `curl /api/health` → 200 JSON (not `index.html`) and a hard refresh on `/items` serving the SPA.

## Open questions
- **Scaffold layout differs from the spec.** The spec assumes `api/` + `web/` and a single multi-stage image serving the SPA from Nest; the scaffolder produced `backend/` + `frontend/` with separate Dockerfiles and an nginx front end (`serve_topology: nginx_frontend_plus_backend_supervisor`). Tasks above target the scaffolded paths — confirm the deep-link fallback is owned by `frontend/nginx.conf` rather than `ServeStaticModule`.
- **REST vs tRPC.** The scaffold ships a tRPC router (`backend/src/trpc/*`, `glue.api_client: "trpc"`) but the spec's surface is REST under `/api`. Tasks assume REST and retiring the tRPC sample; confirm no platform probe depends on `/trpc/*`. Note the stack's `backend_probe_path` is `/api/docs` — if that probe is enforced, a Swagger endpoint must be added (not in the spec).
- **Role vocabulary.** The spec uses `CLERK`/`MANAGER`; the platform contract mints `ADMIN`/`MANAGER`/`USER`. Tasks map clerk → `USER` and give `ADMIN` a superset of manager permissions. Confirm this mapping is acceptable rather than adding a fourth `CLERK` value.
- **Demo data.** The spec's seed (manager@demo / clerk@demo with `Demo1234!`, 8 items, 3 zones, opening stock levels) conflicts with the platform's essential-seed rule (no sample rows; logins come from `COLOSSUS_ACCOUNTS_JSON`). Tasks follow the platform rule, so the low-stock report and item list render empty states on first load — confirm the acceptance oracle does not require seeded items.
- **MinIO.** `spec_deployments` includes `minio`, but the spec declares no file uploads or object storage. Tasks only expose its credentials on `/admin/settings`; no storage client is built. Confirm whether item images/attachments are actually in scope.
- **Integrations.** `<spec_integrations>` lists a placeholder integration named `None` with key `NONE_API_KEY`; the spec explicitly states there are no third-party integrations, so no integration client module is scheduled.
- **Signup role bootstrap.** The spec grants `MANAGER` to the first signup when the user table is empty, but the platform seed always creates accounts first, so every real signup becomes `USER`. Confirm that is intended.
