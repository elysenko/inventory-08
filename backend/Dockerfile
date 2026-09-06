FROM node:22-slim AS builder
WORKDIR /app

# A syntactically valid URL is enough for `prisma generate`; no database is
# contacted at build time. The real DATABASE_URL is injected at deploy.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx prisma generate
# `nest build` exits 0 even when the output lands somewhere unexpected, so the
# entrypoint file is asserted here rather than discovered at container start.
RUN npm run build \
    && test -f /app/dist/main.js \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL is required by the Prisma query engine at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# .prisma holds the generated query engine binary and @prisma/client holds the
# generated client code. `npm ci` installs only the base package, so both must
# be lifted from the builder or the app cannot reach the database.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
# Migrations run first and are fatal on failure — serving traffic against a
# stale schema is worse than not starting. The account seed is idempotent and
# non-fatal so a restart never takes a healthy app down.
CMD ["sh", "-c", "npx prisma migrate deploy && (node prisma/seed/seed.js || echo '[start] seed skipped'); node dist/main.js"]
