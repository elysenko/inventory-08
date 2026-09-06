/**
 * Shared harness for the API e2e suites.
 *
 * The suites run against a real PostgreSQL database (the same one the app uses)
 * because the behaviour under test — the conditional decrement that makes an
 * over-draw impossible, the unique constraints behind the duplicate-SKU 400,
 * the aggregate behind the low-stock report — lives in the database, not in the
 * service layer. A mocked Prisma client would assert nothing about any of it.
 *
 * Every suite namespaces its fixtures with a random suffix and removes exactly
 * what it created in `afterAll`, so suites are safe to run against a shared
 * database and leave no rows behind.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/** Password used for every fixture account. Test-only, never shipped or seeded. */
export const TEST_PASSWORD = 'e2e-Fixture-Password-1';

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  /** Unique per suite run, so parallel/repeat runs never collide on unique keys. */
  suffix: string;
  close: () => Promise<void>;
}

/** supertest agent bound to this suite's running Nest instance. */
export function api(h: Harness) {
  return request(h.app.getHttpServer() as never);
}

/**
 * Boots the real AppModule with the same global prefix and validation pipe
 * `main.ts` installs, so status codes and error bodies match production.
 */
export async function createHarness(): Promise<Harness> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for the e2e suites — export it before `npm run test:e2e`',
    );
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

  return {
    app,
    prisma,
    suffix,
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Creates a fixture account at the requested role and returns its bearer token.
 * The row is written directly (not through /auth/signup) because signup only
 * ever mints MANAGER for the very first account in an empty database.
 */
export async function signIn(h: Harness, role: Role): Promise<string> {
  const email = fixtureEmail(h, role);
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await h.prisma.user.upsert({
    where: { email },
    update: { role, passwordHash },
    create: { email, role, passwordHash, name: `e2e ${role}` },
  });

  const res = await api(h)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`fixture login failed for ${role}: ${res.status} ${res.text}`);
  }
  return res.body.accessToken as string;
}

export function fixtureEmail(h: Harness, role: Role): string {
  return `e2e-${role.toLowerCase()}-${h.suffix}@stockroom.test`;
}

export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

/**
 * Deletes every row this suite created, in dependency order: movements first
 * (they restrict item/location deletes), then balances, then the catalogue and
 * the fixture accounts. Keyed off the suite suffix so nothing else is touched.
 */
export async function cleanup(h: Harness): Promise<void> {
  const items = await h.prisma.item.findMany({
    where: { sku: { contains: h.suffix } },
    select: { id: true },
  });
  const locations = await h.prisma.location.findMany({
    where: { name: { contains: h.suffix } },
    select: { id: true },
  });
  const itemIds = items.map((i) => i.id);
  const locationIds = locations.map((l) => l.id);

  await h.prisma.movement.deleteMany({
    where: {
      OR: [
        { itemId: { in: itemIds } },
        { fromLocId: { in: locationIds } },
        { toLocId: { in: locationIds } },
      ],
    },
  });
  await h.prisma.stockLevel.deleteMany({
    where: { OR: [{ itemId: { in: itemIds } }, { locationId: { in: locationIds } }] },
  });
  await h.prisma.item.deleteMany({ where: { id: { in: itemIds } } });
  await h.prisma.location.deleteMany({ where: { id: { in: locationIds } } });
  await h.prisma.user.deleteMany({ where: { email: { contains: h.suffix } } });
}
