# Test Specification

> **WARNING — `.pipeline/surface.json` is stale.** The on-disk `surface.json` is the untouched
> scaffolder output: it lists three placeholder routes (`GET /health`, `GET /trpc/users.findAll`,
> `GET /trpc/users.findById`) and two template components (`app-root`, `app-home`) that belong to
> the tRPC sample app, **not** to StockRoom. The authoritative surface used below is the
> "Surface contract" table in `.pipeline/tasks.md` (which reconciles the spec with the scaffolded
> `backend/` + `frontend/` layout and the platform role vocabulary). All three stale routes are
> still covered — as *retirement* assertions (they must 404). `ui_agent` is tasked with rewriting
> `surface.json`; when it does, re-run this spec's coverage check against the new file.
>
> **Other reconciliations applied** (from `.pipeline/tasks.md`, `colossus.stack.json`):
> - Roles are `USER` (= the spec's *clerk*) / `MANAGER` / `ADMIN`. `ADMIN` satisfies every
>   `MANAGER` guard. There is no `CLERK` enum value.
> - Layout is `backend/` + `frontend/` with an **nginx** front end (`serve_topology:
>   nginx_frontend_plus_backend_supervisor`), not the spec's single Nest-serves-SPA image.
>   Deep-link fallback is owned by `frontend/nginx.conf` (`try_files … /index.html`), so the
>   SPA-fallback tests target nginx, not `ServeStaticModule`.
> - There is **no demo seed data** (platform essential-seed rule). Logins come from
>   `COLOSSUS_ACCOUNTS_JSON`; `manager@demo` / `clerk@demo` / `Demo1234!` / the 8 seeded items /
>   `Zone A|B|C` from the spec do **not** exist. Every fixture below is created through the API.
> - `/api/admin/settings` and `GET /api/docs` are platform requirements absent from the spec;
>   both are under test.

## Coverage summary
- Total cases: 223 (138 API · 70 UI/journey · 15 data integrity)
- API endpoints covered: 24 / 3 — `surface.json` lists only 3 routes and all 3 are covered
  (as retirement 404s); the other 21 are the real endpoints from `.pipeline/tasks.md`
  (20 REST routes + the `/api/docs` platform probe)
- User journeys covered: 14

## API tests

### Fixtures & preconditions
- **Accounts.** Three logins are injected via `COLOSSUS_ACCOUNTS_JSON` and materialized by
  `backend/prisma/seed/seed.js`: one `ADMIN`, one `MANAGER`, one `USER`. Tests read the emails
  and passwords from that env var — never from hard-coded literals. `USER` is referred to below
  as *clerk*.
- **Database.** Each suite runs against a Postgres test DB reset with `prisma migrate deploy` +
  `node prisma/seed/seed.js`, then truncates `Movement`, `StockLevel`, `Item`, `Location`
  between suites. `User` / `colossus_accounts` are left alone.
- **Fixture builder.** Suites that need catalog data create it as `MANAGER`:
  items `SKU-WID-1` "Widget" (unit `ea`, reorderAt 10), `SKU-BOLT-2` "Bolt" (unit `box`,
  reorderAt 0), `SKU-NUT-3` "Nut" (unit `ea`, reorderAt 5); locations `Zone A`, `Zone B`,
  `Zone C` (zones `A`/`B`/`C`). Opening balances are established by posting `IN` movements —
  never by writing `StockLevel` directly — so the audit trail stays truthful.
- **Base URL.** All API tests hit the Nest app under the global prefix `/api`. The topology
  tests additionally hit the nginx origin on port 80 to prove `/api/` is proxied and not
  swallowed by the SPA fallback.

---

### `GET /api/health`
- **Happy path**: `API-001` no token → `200` `{status:'ok'}` with `content-type:
  application/json` (JSON, *not* `text/html` — proves the SPA fallback does not swallow `/api`).
- **Validation failures**: `API-002` `POST /api/health` → `404` or `405`, never `200`.
- **Auth failures**: `API-003` request carrying `Authorization: Bearer garbage` → still `200`
  (`@Public()` short-circuits `JwtAuthGuard` before token parsing).
- **Idempotency / edge cases**: `API-004` the same request through the nginx front door
  (`http://localhost:80/api/health`) → `200` JSON, byte-identical body.

### `GET /api/health/deep`
- **Happy path**: `API-005` DB reachable → `200` with a body reporting the DB as up; a `SELECT 1`
  actually round-trips (assert by killing the DB in `API-007`, not by trusting the literal).
- **Validation failures**: n/a — no inputs.
- **Auth failures**: `API-006` no token → `200` (`@Public()`).
- **Idempotency / edge cases**: `API-007` with `DATABASE_URL` pointed at an unreachable host →
  `503`, JSON body, no unhandled `500`. `API-008` neither the `503` nor the `200` body leaks the
  connection string, password, or a stack trace.

### `POST /api/auth/signup`
- **Happy path**: `API-009` `{email:'new-clerk@test.local', password:'Passw0rd!'}` → `201` with
  `{accessToken, user:{id, email, role}}`; `passwordHash` absent from the body; the JWT decodes
  to `{sub, email, role}` with `exp - iat` ≈ 12 h.
  `API-010` because the seed creates accounts before any signup, `user.count() > 0`, so the new
  user's `role` is `USER` (the spec's "first signup becomes MANAGER" branch is unreachable in the
  deployed topology — assert `USER`).
  `API-016` immediately logging in with the same password → `200` (bcrypt hash written correctly).
- **Validation failures**: `API-011` signing up with the seeded MANAGER's email → `400`, and
  `user.count({where:{email}})` is still `1`.
  `API-012` `{email}` with no `password` → `400` with a `message` array.
  `API-013` `{email:'not-an-email', password:'Passw0rd!'}` → `400`.
  `API-014` **privilege escalation**: `{email, password, role:'ADMIN'}` → the `role` property is
  stripped by `ValidationPipe({whitelist:true})` and the created user is `USER`, not `ADMIN`.
- **Auth failures**: `API-015` no token required — the route is public.
- **Idempotency / edge cases**: `API-011` doubles as the not-idempotent-by-design case: a repeat
  signup is a `400`, never a silent overwrite of the existing password hash.

### `POST /api/auth/login`
- **Happy path**: `API-017` each of the three seeded accounts with its contract password → `200`
  `{accessToken, user}` and `user.role` equals the contract role (`ADMIN`/`MANAGER`/`USER`).
  `API-018` the returned token authenticates `GET /api/auth/me` → `200`.
- **Validation failures**: `API-019` `{password}` with no `email` → `400` (not `401`).
- **Auth failures**: `API-020` correct email + wrong password → `401` with message
  `Invalid credentials`.
  `API-021` unknown email → `401` with the **identical** status and body as `API-020`
  (no user enumeration via message or timing-obvious status split).
- **Idempotency / edge cases**: `API-022` no response from this route ever contains
  `passwordHash` or a bcrypt string.

### `GET /api/auth/me`
- **Happy path**: `API-023` MANAGER token → `200` `{id, email, role:'MANAGER'}`, no
  `passwordHash`.
- **Validation failures**: n/a — no inputs.
- **Auth failures**: `API-024` no `Authorization` header → `401`.
  `API-025` `Bearer not.a.jwt` → `401`.
  `API-026` a well-formed token whose `exp` is in the past → `401`.
  `API-027` a token signed with a different `JWT_SECRET` → `401`.
- **Idempotency / edge cases**: `API-028` **role freshness** — mint a token for the `USER`
  account, then update that row's `role` to `MANAGER` directly in the DB, then call `/me` with the
  *old, unchanged* token → response reports `MANAGER` (`JwtStrategy` re-reads the row per request).
  `API-029` delete the user row after the token is issued → `401`, not `500`.

### `GET /api/items`
- **Happy path**: `API-030` clerk token → `200` with a paginated envelope
  (`{data, page, pageSize, total}` — assert the exact agreed shape once, then reuse); each row
  carries `id, sku, name, unit, reorderAt, totalQty`.
  `API-031` immediately after a clean migrate+seed → `200` with an **empty** collection and
  `total: 0` — not a `404`, not an error (the platform ships no sample rows).
  `API-032` `SKU-WID-1` with `IN 20 → Zone A` and `IN 10 → Zone B` → its `totalQty` is `30`
  (aggregate spans locations).
  `API-033` `?q=wid` matches `SKU-WID-1`/"Widget" and `?q=WIDGET` matches it too
  (case-insensitive, matches on sku **or** name); `SKU-BOLT-2` is absent from both.
  `API-034` `?lowStock=true` returns exactly the items whose `totalQty <= reorderAt`
  (Widget at 30 vs reorderAt 10 is absent; Nut at 0 vs reorderAt 5 is present).
  `API-035` `?page=1&pageSize=2` returns 2 rows and `?page=2&pageSize=2` returns the next rows
  with zero id overlap; `total` reflects the filtered-but-unpaginated count.
- **Validation failures**: `API-036` `?pageSize=abc`, `?page=-1`, `?pageSize=0` → `400`
  (or documented clamping — whichever the implementation chooses, it must be deterministic and
  identical across `/api/items` and `/api/movements`).
- **Auth failures**: `API-037` no token → `401`.
  `API-038` clerk (`USER`) token → `200` — the catalog is open to every authenticated role.
- **Idempotency / edge cases**: read-only; repeated calls return identical bodies.

### `GET /api/items/:id`
- **Happy path**: `API-039` → `200` with the item header plus
  `levels: [{locationId, locationName, zone, qty}]` and `totalQty`, where
  `totalQty === sum(levels[].qty)` and `locationName`/`zone` match the `Location` rows.
  `API-040` an item that has never been moved → `levels: []` and `totalQty: 0`.
- **Validation failures**: `API-041` a well-formed but unknown id → `404`.
  `API-042` a syntactically invalid id (`'../etc'`, `''`, a 500-char string) → `404`, never `500`.
- **Auth failures**: `API-043` no token → `401`; clerk token → `200`.
- **Idempotency / edge cases**: covered by `API-040`.

### `POST /api/items`
- **Happy path**: `API-044` MANAGER posts
  `{sku:'SKU-WID-1', name:'Widget', unit:'ea', reorderAt:10, description:'…'}` → `201`; body
  echoes every field and assigns an `id`; `GET /api/items/:id` then returns it with `totalQty: 0`.
  `API-045` the same payload (different sku) as **ADMIN** → `201` (ADMIN satisfies the MANAGER
  guard).
- **Validation failures**: `API-046` **duplicate SKU** → `400` with body
  `{message:['sku must be unique'], error:'Bad Request'}` **and** `item.count({where:{sku}})`
  re-reads as `1`.
  `API-047` `sku:'SKU 001!'` (space and `!` violate `/^[A-Za-z0-9-]+$/`) → `400` naming `sku`.
  `API-048` missing `name` → `400`; missing `unit` → `400`; missing `sku` → `400`.
  `API-049` `reorderAt:-1` → `400`; `reorderAt:1.5` → `400`; `reorderAt` omitted → created with
  `0`.
  `API-050` `{…, totalQty:999, id:'forged'}` → the unknown properties are stripped by `whitelist`
  and the created row has a server-generated id and a derived `totalQty` of `0`.
- **Auth failures**: `API-051` clerk (`USER`) → `403`; no token → `401`.
- **Idempotency / edge cases**: `API-052` **race** — fire two concurrent `POST`s with the same
  `sku`; exactly one returns `201` and one returns the `API-046` `400` body (Prisma `P2002` mapped,
  not surfaced as `500`); `item.count({where:{sku}})` is `1`.

### `PATCH /api/items/:id`
- **Happy path**: `API-053` MANAGER updates `{name:'Widget Mk2', reorderAt:25}` → `200` with the
  new values; `sku` is unchanged because it was omitted.
  `API-054` a single-field patch leaves `description`, `unit` and existing `StockLevel` rows
  untouched.
- **Validation failures**: `API-055` patching `sku` to another item's existing sku → `400` with
  the `sku must be unique` body; **both** items re-read with their original skus.
  `API-056` `reorderAt:-5` → `400`; `reorderAt:'ten'` → `400`.
  `API-057` unknown id → `404`.
- **Auth failures**: `API-058` clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: patching with an unchanged payload twice → `200` both times, one
  row, no spurious `updatedAt`-only side effects asserted beyond `updatedAt` advancing.

### `DELETE /api/items/:id`
- **Happy path**: `API-059` MANAGER deletes an item with no movements → `200`/`204`; a subsequent
  `GET /api/items/:id` → `404` and the item is gone from `GET /api/items`.
- **Validation failures**: `API-062` unknown id → `404`.
- **Auth failures**: `API-063` clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: `API-060` **audit integrity** — delete an item that has at least
  one `Movement` row → `400`; the item is still readable via `GET /api/items/:id` and the
  `Movement` count is unchanged.
  `API-061` delete an item that has `StockLevel` rows but no movements → the implementation's
  chosen behaviour (cascade-remove the levels, or `400`) is asserted explicitly and consistently;
  in either case no orphaned `StockLevel` row survives.

### `GET /api/items/:id/movements`
- **Happy path**: `API-064` clerk token → `200` list of that item's movements ordered
  `createdAt desc`, each row carrying `type, qty, fromLoc.name, toLoc.name, note, user.email,
  createdAt`.
  `API-065` a movement recorded against a *different* item is absent from this response.
  `API-066` an item with no movements → `200` empty collection.
- **Validation failures**: `API-067` unknown item id → `404` (matching `GET /api/items/:id`,
  not a silent empty list).
- **Auth failures**: `API-068` no token → `401`; clerk → `200` (the item-detail history tab is
  open to clerks).
- **Idempotency / edge cases**: read-only.

### `GET /api/locations`
- **Happy path**: `API-069` clerk token → `200` list of `{id, name, zone}` — clerks need it to
  populate the movement wizard's location selects.
  `API-070` clean DB → `200` empty collection.
- **Validation failures**: n/a.
- **Auth failures**: `API-071` no token → `401`.
- **Idempotency / edge cases**: read-only.

### `POST /api/locations`
- **Happy path**: `API-072` MANAGER posts `{name:'Zone A', zone:'A'}` → `201`; the same call as
  ADMIN (different name) → `201`.
- **Validation failures**: `API-073` duplicate `name` → `400`;
  `location.count({where:{name}})` re-reads as `1`.
  `API-074` missing `name` → `400`; missing `zone` → `400`; `name:''` → `400`.
  `API-075` `{name, zone, id:'forged'}` → unknown property stripped, server-generated id.
- **Auth failures**: `API-076` clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: `API-077` two concurrent creates with the same `name` → exactly
  one `201`, one `400` (`P2002` mapped), count `1`.

### `PATCH /api/locations/:id`
- **Happy path**: `API-078` MANAGER renames `Zone A` → `Zone A1` → `200`; `GET /api/locations`
  reflects it; attached `StockLevel` rows keep their quantities.
- **Validation failures**: `API-079` rename to an existing location's name → `400`; both rows keep
  their original names.
  `API-080` unknown id → `404`.
- **Auth failures**: `API-081` clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: renaming to the current name → `200`, one row.

### `DELETE /api/locations/:id`
- **Happy path**: `API-082` MANAGER deletes a location with no stock and no movements →
  `200`/`204`; it disappears from `GET /api/locations`.
- **Validation failures**: `API-085` unknown id → `404`.
- **Auth failures**: `API-086` clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: `API-083` a location holding `StockLevel.qty > 0` → `400`; the
  location and its level are both intact afterwards.
  `API-084` a location whose balance has been drawn back to `0` but which is referenced by a
  `Movement.fromLocId`/`toLocId` → `400` (audit rows must never dangle).

### `POST /api/movements`
- **Happy path**: `API-087` **IN** — clerk posts `{type:'IN', itemId:widget, toLocId:zoneA,
  qty:50}` → `201`; `StockLevel(widget, zoneA).qty === 50`; exactly **one** `Movement` row exists
  with `type:'IN'`, `qty:50`, `toLocId:zoneA`, `fromLocId:null`, `userId` = the clerk's id, and a
  populated `createdAt`.
  `API-088` **OUT** — then `{type:'OUT', itemId:widget, fromLocId:zoneA, qty:20}` → `201`;
  level re-reads `30`.
  `API-089` **TRANSFER** — then `{type:'TRANSFER', itemId:widget, fromLocId:zoneA,
  toLocId:zoneB, qty:10}` → `201`; Zone A `20`, Zone B `10`, and the item's `totalQty` is
  unchanged at `30`.
  `API-090` a 500-character `note` round-trips and appears in `GET /api/movements`.
- **Validation failures**: `API-091` `IN` with a `fromLocId` → `400`; `IN` with no `toLocId` →
  `400`.
  `API-092` `OUT` with a `toLocId` → `400`; `OUT` with no `fromLocId` → `400`.
  `API-093` `TRANSFER` missing `fromLocId` → `400`; missing `toLocId` → `400`;
  `fromLocId === toLocId` → `400`.
  `API-094` `qty:0` → `400`; `qty:-5` → `400`; `qty:1.5` → `400`; `qty` omitted → `400`.
  `API-095` `type:'SHIP'` → `400` (not in `MovementType`).
  `API-096` a 501-character `note` → `400`.
  `API-097` unknown `itemId` → `4xx` (not `500`) **and** `Movement.count()` unchanged.
  `API-098` unknown `fromLocId`/`toLocId` → `4xx` **and** `Movement.count()` unchanged.
  In every failing case above, zero `StockLevel` rows are created or altered.
- **Auth failures**: `API-104` clerk (`USER`) → `201` — recording stock is a clerk's core job;
  no token → `401`.
- **Idempotency / edge cases**: `API-099` **insufficient stock** — level is `5`, post
  `OUT 10` → `400` `Insufficient stock`; the level re-reads as **exactly 5** and
  `Movement.count()` is unchanged (whole transaction rolled back).
  `API-100` **transfer never creates phantom stock** — Zone A level `5`, post
  `TRANSFER 10 A→B` → `400`; Zone A still `5` and Zone B is unchanged/absent (debit precedes
  credit inside the transaction).
  `API-101` `OUT` from a location that has **no** `StockLevel` row for that item → `400`
  `Insufficient stock` (the conditional `UPDATE` affects 0 rows), no row created.
  `API-102` **race** — level is `5`; fire two concurrent `OUT 5`; exactly one `201` and one `400`;
  the final level is `0` and never negative at any point; exactly one `Movement` row was added.
  `API-103` **immutability** — `PATCH /api/movements/:id` and `DELETE /api/movements/:id` →
  `404`/`405`; no route exists.
  `API-105` a body containing `userId:'<other user id>'` has it stripped; the persisted
  `Movement.userId` is the JWT `sub`.

### `GET /api/movements`
- **Happy path**: `API-106` MANAGER → `200` paginated, ordered `createdAt desc`; each row carries
  `createdAt, user.email, item.sku, item.name, type, qty, fromLoc.name, toLoc.name, note`
  (`fromLoc`/`toLoc` are `null` for the leg the type does not use).
  `API-107` `?itemId=<widget>` returns only Widget rows; a Bolt movement is absent.
  `API-108` `?type=OUT` returns only `OUT` rows.
  `API-109` `?from=<today>&to=<today>` includes a movement created today at 23:00 (`to` is
  inclusive to end-of-day); `?from=<tomorrow>` excludes it.
  `API-110` `?itemId=…&type=OUT&from=…&to=…` intersects (AND), returning only rows satisfying
  all four.
  `API-111` `?page`/`?pageSize` paginate with stable `createdAt desc` ordering and no overlap;
  `total` reflects the *filtered* count.
- **Validation failures**: `API-112` `?type=BOGUS` → `400`; `?from=not-a-date` → `400`;
  `?to` earlier than `?from` → `400` or an empty result (deterministic either way).
- **Auth failures**: `API-113` clerk (`USER`) → `403`; no token → `401`; ADMIN → `200`.
- **Idempotency / edge cases**: read-only.

### `GET /api/reports/low-stock`
- **Happy path**: `API-114` an item with `reorderAt:10` and `12` on hand, after `OUT 5`
  (→ `7` on hand), appears with `totalQty:7` and `deficit:3`.
  `API-115` an item with `reorderAt:10` and `40` on hand is **absent**.
  `API-116` **boundary** — `totalQty === reorderAt` → **included** (the predicate is `<=`).
  `API-117` **LEFT JOIN** — an item with zero `StockLevel` rows and `reorderAt:0` is included with
  `totalQty:0`, `deficit:0`.
  `API-118` rows are ordered worst-deficit-first (`totalQty - reorderAt` ascending).
  `API-119` row shape is `{id, sku, name, unit, reorderAt, totalQty, deficit}` and `totalQty`/
  `deficit` are JSON **numbers**, not strings (raw-query `BigInt`/`Decimal` coercion — a common
  `$queryRaw` regression).
  `API-120` when every item is above its threshold → `200` empty array.
- **Validation failures**: n/a — no inputs.
- **Auth failures**: `API-121` clerk → `403`; no token → `401`; ADMIN → `200`.
- **Idempotency / edge cases**: read-only; the report is derived, so a fresh `IN` that lifts an
  item above `reorderAt` removes it from the next call with no other write.

### `GET /api/admin/settings`
- **Happy path**: `API-122` ADMIN → `200` with an entry for each provisioned service key
  (**postgresql**, **minio**), each carrying a `configured` boolean and a value.
- **Validation failures**: n/a.
- **Auth failures**: `API-124` clerk → `403`; **MANAGER → `403`** (this is the one surface a
  manager may not reach); no token → `401`.
- **Idempotency / edge cases**: `API-123` a configured secret is returned **masked** — the
  response never contains the full plaintext value that was PATCHed.

### `PATCH /api/admin/settings`
- **Happy path**: `API-125` ADMIN patches a known key → `200`; the following `GET` reports
  `configured: true` for that key.
- **Validation failures**: `API-131` an unknown/unlisted key → `400` (or is ignored — asserted
  explicitly whichever way, so the behaviour is not accidental); an empty body → `400` or a no-op
  `200`, asserted.
- **Auth failures**: `API-132` MANAGER → `403`; clerk → `403`; no token → `401`.
- **Idempotency / edge cases**: `API-126` with the env var **unset**, `resolveConfig(key)` returns
  the PATCHed value.
  `API-127` with the env var set to the literal `PLACEHOLDER_CONFIGURE_IN_SETTINGS`,
  `resolveConfig(key)` still returns the PATCHed value.
  `API-128` with the env var set to a real value, `resolveConfig(key)` returns the **env** value
  (env wins over the `SystemSetting` row).
  `API-129` with neither set, `resolveConfig(key)` returns `null`, and a caller that requires the
  service raises `ServiceUnconfiguredError` which maps to HTTP `503` (not `500`).
  `API-130` PATCHing the same key twice leaves exactly one `SystemSetting` row holding the latest
  value.

### `GET /api/docs` (platform probe)
- **Happy path**: `API-133` → `200` HTML Swagger UI. This is `colossus.stack.json`'s
  `backend_probe_path`; if the probe is enforced, removing Swagger fails the deploy gate.
- **Validation failures**: n/a.
- **Auth failures**: `API-134` reachable with **no** token (the platform probe is unauthenticated).
- **Idempotency / edge cases**: `API-135` the generated document describes the REST surface
  (`/api/items`, `/api/movements`, …) and contains no `users.findAll`/`trpc` operations.

### Legacy scaffold surface (the 3 routes listed in `surface.json` — must be retired)
- **Happy path**: none — these routes must not serve.
- **Validation failures**: n/a.
- **Auth failures**: n/a.
- **Idempotency / edge cases**: `API-136` `GET /health` (unprefixed) → `404` once
  `setGlobalPrefix('api')` is in place; the live probe is `/api/health`.
  `API-137` `GET /trpc/users.findAll` → `404`/`410` (the sample tRPC router is removed).
  `API-138` `GET /trpc/users.findById` → `404`/`410`.

## UI / journey tests

All journeys use Playwright. Because the app is an Angular SPA behind nginx, waits use
`getAllAngularTestabilities().every(t => t.isStable())` (per `colossus.stack.json`
`browser_verify.wait_strategy`) — **never** `networkidle`. The acceptance contract
(`.colossus-acceptance.json`) requires `data-testid="app-ready"` to be present and forbids the
strings `home-title">Users<`, `Loading...` and `Failed to load users.` in the rendered DOM.

### Journey: Anonymous root → sign-in (smoke oracle)
- **Steps**: navigate to `/`; wait for Angular stability.
- **Expected outcomes**: `UI-001` the URL settles on `/login`.
  `UI-002` the rendered DOM contains the literal text `StockRoom` (the login view's wordmark —
  **not** only the `<title>` and **not** only the authenticated shell).
  `UI-003` `document.title === 'StockRoom'`.
  `UI-004` an element with `data-testid="app-ready"` is present.
  `UI-005` none of the reject signatures (`home-title">Users<`, `Loading...`,
  `Failed to load users.`) appear anywhere in the DOM.
- **Negative path**: `UI-006` navigating directly to `/items` while unauthenticated lands on
  `/login?returnUrl=%2Fitems`; no item table, row, or API-derived data is rendered at any point.

### Journey: Sign in
- **Steps**: go to `/login`; fill email + password; submit.
- **Expected outcomes**: `UI-007` MANAGER credentials → lands on `/items`; the shell header shows
  `StockRoom` and the nav shows Items, Record Movement, Locations, Low Stock and Audit Log.
  `UI-008` `USER` (clerk) credentials → nav shows **only** Items and Record Movement; no
  Locations / Low Stock / Audit Log / Settings links exist in the DOM.
  `UI-009` ADMIN credentials → nav additionally shows Settings.
  `UI-010` the token is written to `localStorage`; a hard reload keeps the user on `/items`
  (not bounced to `/login`).
  `UI-011` signing in from `/login?returnUrl=%2Freports%2Flow-stock` as MANAGER lands on
  `/reports/low-stock`, not `/items`.
- **Negative path**: `UI-012` a wrong password keeps the user on `/login`, renders an inline error
  region, and leaves `localStorage` with no token.
  `UI-013` submitting an empty form is blocked client-side — the error is shown and no
  `POST /api/auth/login` request is issued.

### Journey: Sign up
- **Steps**: go to `/signup`; enter a fresh email + password; submit.
- **Expected outcomes**: `UI-014` the account is created, the user is signed in automatically and
  lands on `/items` with the clerk-restricted nav (role `USER`).
  `UI-015` a link back to `/login` is present on the page.
- **Negative path**: `UI-016` signing up with an email that already exists surfaces the API `400`
  **inline on the email control**; the user stays on `/signup` and no session is created.

### Journey: Browse the item catalog
- **Steps**: sign in as MANAGER; go to `/items`; type in the search box; toggle low-stock;
  page forward.
- **Expected outcomes**: `UI-017` a table renders columns `sku · name · unit · reorderAt ·
  totalQty`.
  `UI-018` against a clean database the empty state is visible — not a permanent spinner and not
  an error banner.
  `UI-019` typing `wid` writes `?q=wid` into the URL; a hard reload restores the same filtered
  result set (filter state lives in the URL, never only in component state).
  `UI-020` the low-stock toggle writes `?lowStock=true`; a hard reload restores it.
  `UI-021` a low-stock badge renders on exactly those rows where `totalQty <= reorderAt`.
  `UI-022` the paginator writes `?page=2`; a hard reload restores page 2.
  `UI-023` signed in as a clerk, the "New item", row-edit and row-delete controls are absent from
  the DOM (not merely disabled).
- **Negative path**: `UI-024` with `GET /api/items` stubbed to `500`, an error region with a retry
  affordance renders instead of a blank table or an infinite spinner.

### Journey: Create and edit an item (manager)
- **Steps**: as MANAGER on `/items`, click "New item"; fill the form; submit. Then open a row's
  edit action.
- **Expected outcomes**: `UI-025` clicking "New item" adds `?modal=create-item` to the URL, and a
  hard reload at that URL re-opens the dialog.
  `UI-026` submitting `{sku, name, unit, reorderAt}` creates the item, closes the dialog, clears
  `?modal`, and the new row appears in the table.
  `UI-028` `?modal=edit-item` (with the row's id) pre-fills the current values; saving updates the
  row in place without a full navigation.
- **Negative path**: `UI-027` submitting a duplicate SKU renders the API `400` message **inline on
  the `sku` control**; the dialog stays open and no row is added to the table.
  `UI-029` a clerk navigating directly to `/items?modal=create-item` gets no usable manager dialog
  — either the dialog does not render, or a submit attempt yields the `403` redirect to `/403`.

### Journey: Item detail — levels and history tabs
- **Steps**: from `/items`, click a row; switch to the movements tab; hard-reload.
- **Expected outcomes**: `UI-030` `/items/:id` resolves to the `levels` child route
  (`/items/:id/levels`) by default.
  `UI-031` the levels tab lists `location · zone · qty` for each location plus a visible **Total**
  row whose value equals the item's `totalQty`.
  `UI-032` `/items/:id/movements` lists that item's movement history.
  `UI-033` a **hard refresh** on `/items/:id/movements` re-renders the movements tab (proves the
  nginx `try_files … /index.html` fallback serves the SPA for deep links).
- **Negative path**: `UI-034` `/items/does-not-exist` renders a not-found state with a way back to
  `/items` — not a blank page and not an uncaught error.

### Journey: Manage locations (manager)
- **Steps**: as MANAGER, go to `/locations`; create; edit; attempt a blocked delete.
- **Expected outcomes**: `UI-035` a `name · zone` table renders (with an empty state on a clean
  database).
  `UI-036` "New location" writes `?modal=create-location`; submitting creates the row.
  `UI-037` "Edit" writes `?modal=edit-location&id=<id>`; a hard reload restores the dialog
  pre-filled with that location.
- **Negative path**: `UI-036` (cont.) a duplicate name renders the API `400` inline on the `name`
  control and the dialog stays open.
  `UI-038` deleting a location that still holds stock surfaces the API `400` as a **form-level**
  error; the location remains in the table.
  `UI-039` a clerk navigating to `/locations` lands on `/403`, which renders a forbidden message
  and a link back to `/items`.

### Journey: Record a movement (three-step wizard)
- **Steps**: as a clerk, click "Record Movement"; pick an item; pick a type and locations;
  enter qty + note; confirm.
- **Expected outcomes**: `UI-040` the wizard opens at `/movements/new?step=1` with a searchable
  item select.
  `UI-041` selecting an item advances the URL to `?step=2&itemId=<id>`.
  `UI-042` choosing `IN` shows only the destination select; `OUT` shows only the source select;
  `TRANSFER` shows both; the chosen type is written to `&type=`.
  `UI-043` on step 2 for `OUT`/`TRANSFER`, each source location shows an available-quantity hint
  matching that item's per-location level.
  `UI-044` step 3 collects qty and note and renders a confirm summary naming the item, type,
  location(s) and quantity.
  `UI-045` a **hard refresh** at `/movements/new?step=2&itemId=<id>&type=OUT` restores the wizard
  at step 2 with that item and type still selected.
  `UI-046` a successful submit navigates to `/items/:id/levels`, shows a success toast, and the
  levels table reflects the new balance.
- **Negative path**: `UI-047` entering `qty` greater than the available quantity for `OUT`/
  `TRANSFER` is blocked client-side with an inline message before any request is sent.
  `UI-048` when the server returns `400` anyway (e.g. a concurrent draw emptied the location),
  the message renders as a form-level error, the user **stays on step 3**, and the entered values
  are preserved.

### Journey: Audit log (manager)
- **Steps**: as MANAGER, go to `/movements`; apply item, type and date filters; page forward.
- **Expected outcomes**: `UI-049` columns `when · who (email) · item · type · qty · from → to ·
  note` render, newest first.
  `UI-050` the item select, type select and from/to date inputs each write to their query params
  (`?itemId=&type=&from=&to=`); a hard reload restores the same filtered view.
  `UI-051` the paginator writes `?page=`; a hard reload restores the page.
  `UI-052` a filter combination that matches nothing renders an empty state, not an error.
- **Negative path**: `UI-053` a clerk navigating to `/movements` lands on `/403`.

### Journey: Low-stock report (manager)
- **Steps**: as MANAGER, go to `/reports/low-stock`; click through to an item.
- **Expected outcomes**: `UI-054` columns `sku · name · onHand · reorderAt · deficit` render,
  sorted worst-deficit-first.
  `UI-055` each row links into that item's detail page.
  `UI-056` when nothing is below threshold, the empty state reads
  "Everything is above its reorder threshold".
- **Negative path**: `UI-057` a clerk navigating to `/reports/low-stock` lands on `/403`.

### Journey: Admin settings
- **Steps**: as ADMIN, go to `/admin/settings`; fill and save a service's credentials; reload.
- **Expected outcomes**: `UI-058` one section per provisioned service (**postgresql**, **minio**),
  each with a configured/unconfigured badge and a credential form.
  `UI-059` the banner "The following need credentials to activate: …" lists exactly the services
  the API reports as unconfigured (and disappears when none are).
  `UI-060` saving credentials flips that service's badge to configured after a reload.
- **Negative path**: `UI-061` a MANAGER navigating to `/admin/settings` lands on `/403`; a clerk
  does too.

### Journey: Logout and session expiry
- **Steps**: sign in; use the logout action. Separately: tamper with the stored token, then
  trigger an API call.
- **Expected outcomes**: `UI-062` logout clears `localStorage` and navigates to `/login`; pressing
  the browser Back button does not restore authenticated data (the guard re-runs and redirects).
- **Negative path**: `UI-063` replacing the stored token with an invalid one and navigating to
  `/items` produces a `401`, which clears the session and redirects to
  `/login?returnUrl=%2Fitems`.
  `UI-064` an API `403` mid-session (clerk forcing a manager-only request) redirects to `/403`
  rather than leaving a half-rendered page.

### Journey: Deep links and SPA fallback (deployed topology)
- **Steps**: against the built image behind nginx, hard-load each URL directly.
- **Expected outcomes**: `UI-065` a hard refresh on `/items/:id/movements` returns
  `index.html` (HTTP 200) and the SPA re-renders that tab.
  `UI-066` a hard refresh on `/movements/new?step=2` restores step 2.
  `UI-067` fetching `/api/health` from the same browser origin returns **JSON**, not
  `index.html` — `/api/` is proxied to the backend and never swallowed by `try_files`.
- **Negative path**: `UI-068` an unknown path such as `/nope` redirects to `''` (landing on
  `/items` when authenticated, `/login` when not) rather than showing a raw 404 page.

### Journey: Scaffold retirement (acceptance-gate guard)
- **Steps**: crawl every route in the route table, authenticated and unauthenticated.
- **Expected outcomes**: `UI-069` the template `HomeComponent` is never rendered — no element with
  `data-testid="home-title"` containing `Users` exists on any route.
  `UI-070` the strings `Loading...` and `Failed to load users.` never appear in any rendered view
  (both are `.colossus-acceptance.json` reject signatures; a lingering template spinner fails the
  post-deploy render gate).
- **Negative path**: covered — these assertions *are* the negative path.

## Data integrity tests

These are asserted by re-reading the database (or the derived API) after each mutation, not by
trusting response bodies.

- `DATA-001` **Conservation** — a `TRANSFER` never changes `SUM(StockLevel.qty)` for that item;
  only its distribution across locations changes.
- `DATA-002` **Non-negativity** — after any sequence of movements, including the concurrent draws
  in `API-102`, no `StockLevel.qty` is ever below `0` at any observable point.
- `DATA-003` **Atomicity** — every rejected movement (shape violation, insufficient stock, unknown
  id) leaves zero new `Movement` rows **and** zero changed `StockLevel` rows; the whole
  `$transaction` rolls back.
- `DATA-004` **Audit completeness** — every committed `StockLevel` change is accompanied by
  exactly one `Movement` row created in the same transaction; there is no balance change without
  an audit row and no audit row without a balance change.
- `DATA-005` **Immutability** — `Movement` rows are never updated or deleted; across a full suite
  run `Movement.count()` is monotonically non-decreasing, and `createdAt` values are stable on
  re-read.
- `DATA-006` **Uniqueness** — after all duplicate-creation attempts, `Item.sku`, `Location.name`
  and `User.email` each have exactly one row per value.
- `DATA-007` **Level uniqueness** — `@@unique([itemId, locationId])` holds: three successive `IN`
  movements to the same item+location produce **one** `StockLevel` row with the summed quantity,
  not three rows (the `upsert` increments).
- `DATA-008` **Actor provenance** — every `Movement.userId` references an existing `User` and
  equals the `sub` of the token that created it, never a client-supplied value.
- `DATA-009` **Referential integrity** — because deletes are refused while references exist, no
  `Movement` has a dangling `itemId`, `fromLocId` or `toLocId`, and no `StockLevel` has a dangling
  `itemId`/`locationId`.
- `DATA-010` **Credential hygiene** — every `User.passwordHash` matches a bcrypt prefix
  (`$2a$`/`$2b$`) and is never plaintext; no API response body anywhere in the suite contains a
  `passwordHash` field or a `$2` string.
- `DATA-011` **Seed idempotency** — running `npx prisma migrate deploy && node
  prisma/seed/seed.js` twice from a clean volume leaves exactly one `colossus_accounts` row and
  one `User` row per contract account, and the platform-held passwords still authenticate after
  the second run.
- `DATA-012` **No sample business data** — after a clean migrate + seed, `Item`, `Location`,
  `StockLevel` and `Movement` are all empty (the platform essential-seed rule); the UI's empty
  states, not seeded rows, are what the first-load acceptance check sees.
- `DATA-013` **Derived totals** — for every item, the `totalQty` returned by `GET /api/items` and
  `GET /api/items/:id` equals a direct `SUM(StockLevel.qty)` for that item; `totalQty` is never
  persisted as a column.
- `DATA-014` **Report fidelity** — the set of items returned by `/api/reports/low-stock` is
  exactly the set produced by evaluating `COALESCE(SUM(s.qty),0) <= i."reorderAt"` in SQL over all
  items, including items with no `StockLevel` rows at all.
- `DATA-015` **Settings upsert** — `SystemSetting` holds exactly one row per `key` after repeated
  `PATCH /api/admin/settings` calls, with the latest value and an advanced `updatedAt`.

## Out of scope

- **`manager@demo` / `clerk@demo` / `Demo1234!` and the spec's 8-item, 3-zone demo seed.** The
  platform's essential-seed rule forbids sample business rows and mints logins from
  `COLOSSUS_ACCOUNTS_JSON`. Tests build their own fixtures through the API. Flagged as an open
  question in `.pipeline/tasks.md`.
- **"First signup becomes MANAGER".** The seed always creates accounts before any signup runs, so
  `user.count() === 0` is unreachable in the deployed topology. `API-010` asserts the reachable
  branch (`USER`) instead of the unreachable one.
- **Single multi-stage image with Nest serving the SPA.** The scaffold ships separate
  `backend/`/`frontend/` images with nginx in front (`serve_topology:
  nginx_frontend_plus_backend_supervisor`), so `ServeStaticModule` and its `/api/{*path}` exclusion
  are not exercised. The equivalent risk is covered against nginx by `UI-065`–`UI-067`.
- **MinIO / object storage behaviour.** `spec_deployments` provisions MinIO but the spec declares
  no uploads. Only its credential entry on `/admin/settings` is tested; no storage client exists.
- **Third-party integrations.** The spec states there are none; the `NONE_API_KEY` placeholder is
  not wired to anything, so there is nothing to test.
- **Email normalization / case-insensitive login.** The spec is silent on whether
  `User@x.com` and `user@x.com` are the same account; no case is asserted either way.
- **Rate limiting, lockout, password-strength policy, password reset, refresh tokens and token
  revocation.** The spec defines only a 12 h bearer token and client-side logout.
- **Concurrency beyond the two documented races** (`API-052` duplicate SKU, `API-102` concurrent
  draw). No sustained load, throughput or latency targets are specified, so none are asserted.
- **Accessibility, responsive breakpoints, browser matrix and visual regression.** The spec
  specifies hand-rolled CSS with no stated a11y or device targets; Playwright runs one desktop
  Chromium profile.
- **Localization / timezone handling of `?from`/`?to`.** `to` is asserted inclusive to
  end-of-day in server time only; multi-timezone semantics are unspecified.
- **`GET /api/docs` content correctness beyond `API-135`.** Swagger exists to satisfy the
  platform probe; its schema completeness is not a spec requirement.
- **`ColossusAccount` as an app-facing surface.** It is platform infrastructure; only its seed
  behaviour (`DATA-011`) is asserted, not any CRUD API.
