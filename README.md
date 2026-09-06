# StockRoom

Warehouse inventory tracking: a catalogue of stock items, the storage locations
they sit in, per-location balances, and an immutable audit log of every
movement between them.

- **`backend/`** — NestJS 11 REST API on Prisma/PostgreSQL, JWT auth, role-based access.
- **`frontend/`** — Angular 19 standalone-component SPA; every navigable state has its own URL.

## Roles

| Role | Can do |
| --- | --- |
| `USER` (clerk) | Browse the catalogue and locations, record IN / OUT / TRANSFER movements, read an item's history |
| `MANAGER` | Everything a clerk can, plus manage items and locations, read the full audit log and the low-stock report |
| `ADMIN` | Everything a manager can, plus the service-credential settings screen |

Logins are platform-owned: `backend/prisma/seed/seed.js` materialises one
account per entry in `COLOSSUS_ACCOUNTS_JSON`. Self-service signup is open at
`POST /api/auth/signup` and yields a clerk (the very first account in an
otherwise empty database becomes a manager so a fresh install is usable).

## Running locally

```bash
docker compose up -d postgres          # Postgres 16 on :5432

cd backend
npm install
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_development"
export JWT_SECRET="local-dev-secret"
npx prisma migrate deploy              # apply the schema
npx prisma generate                    # regenerate the client after schema edits
COLOSSUS_ACCOUNTS_JSON='[{"role":"ADMIN","email":"admin@example.com","password":"ChangeMe123!","login_path":"/login"}]' \
  node prisma/seed/seed.js             # idempotent; re-run any time
npm run start:dev                      # API on :3001, Swagger at /api/docs

cd ../frontend
npm install
npx ng serve                           # SPA on :4200, proxying /api to :3001
```

The app ships with no sample data — the catalogue, locations and audit log all
render their empty state until you add the first item.

## API

Everything lives under `/api` and needs a `Authorization: Bearer <token>` header
except where marked public. Interactive docs: `/api/docs`.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/health` | public — liveness |
| `GET` | `/api/health/deep` | public — readiness, 503 when the database is unreachable |
| `POST` | `/api/auth/signup` | public |
| `POST` | `/api/auth/login` | public |
| `GET` | `/api/auth/me` | any signed-in user |
| `GET` | `/api/items` | any — supports `?q=` and `?lowStock=true` |
| `GET` | `/api/items/:id` | any — includes the per-location breakdown |
| `GET` | `/api/items/:id/movements` | any — that item's history |
| `POST` `PATCH` `DELETE` | `/api/items[/:id]` | manager |
| `GET` | `/api/locations`, `/api/stock-levels` | any |
| `POST` `PATCH` `DELETE` | `/api/locations[/:id]` | manager |
| `POST` | `/api/movements` | any — clerks record stock |
| `GET` | `/api/movements` | manager — `?itemId=` `?type=` `?from=` `?to=` |
| `GET` | `/api/reports/low-stock` | manager |
| `GET` | `/api/users` | manager |
| `GET` `PUT` | `/api/admin/settings` | admin |

### Rules the API enforces

- **Stock can never go negative.** A withdrawal is a single conditional
  `UPDATE … WHERE qty >= :qty`; if it touches no row the whole transaction
  rolls back with `400 Insufficient stock` and the stored balance is untouched.
  Concurrent draws against the same balance cannot both win.
- **Transfers are atomic and conserving.** The debit runs before the credit
  inside one transaction, so a failed withdrawal never leaves phantom stock at
  the destination, and the audit row commits with the balances or not at all.
- **Movements are immutable.** There is no update or delete endpoint, and an
  item or location referenced by the audit log refuses deletion (`400`).
- **Duplicate `sku` / location `name` → `400`** with a validation-shaped body so
  the UI can pin the message to the offending field.
- Missing or invalid token → `401`; wrong role → `403`; unknown id → `404`.

## Tests

```bash
cd backend
npm test              # unit tests — no database required
npx tsc --noEmit      # type check

# End-to-end API tests. These run against a real PostgreSQL database, because
# what they check — the conditional decrement behind "stock can never go
# negative", the unique constraints behind the duplicate-SKU 400, the aggregate
# behind the low-stock report — lives in the database. Each suite namespaces its
# fixtures and deletes exactly what it created, so it is safe against a shared
# database and leaves no rows behind.
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_development"
npm run test:e2e
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Signing key for access tokens |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `12h` |
| `PORT` | no | Listen port, default `3001` |
| `COLOSSUS_ACCOUNTS_JSON` | seed only | Platform-minted logins |
| `MINIO_*` | no | Optional object storage; absent keys degrade that feature, never the app |

Third-party credentials are resolved at call time — environment variable first,
then the override an admin saved at `/admin/settings`. A missing one yields a
`503` from the feature that needs it rather than a failed boot.
