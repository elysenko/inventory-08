import { Role } from '@prisma/client';

import {
  Harness,
  TEST_PASSWORD,
  api,
  bearer,
  cleanup,
  createHarness,
  fixtureEmail,
  signIn,
} from './harness';

describe('auth and the global guard (e2e)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await cleanup(h);
    await h.close();
  });

  it('serves health without a token', async () => {
    await api(h).get('/api/health').expect(200, { status: 'ok' });
  });

  it('reports database reachability on the deep check', async () => {
    const res = await api(h).get('/api/health/deep');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  it('rejects an unauthenticated read of the catalogue', async () => {
    await api(h).get('/api/items').expect(401);
  });

  it('rejects a malformed bearer token', async () => {
    await api(h)
      .get('/api/items')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('issues a token for valid credentials', async () => {
    const email = fixtureEmail(h, Role.USER);
    await signIn(h, Role.USER);

    const res = await api(h)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe(Role.USER);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('refuses a wrong password without revealing whether the account exists', async () => {
    const email = fixtureEmail(h, Role.USER);
    await signIn(h, Role.USER);

    const wrongPassword = await api(h)
      .post('/api/auth/login')
      .send({ email, password: 'definitely-not-the-password' })
      .expect(401);
    const unknownAccount = await api(h)
      .post('/api/auth/login')
      .send({ email: `nobody-${h.suffix}@stockroom.test`, password: TEST_PASSWORD })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownAccount.body.message);
  });

  it('returns the caller behind the token from /auth/me', async () => {
    const token = await signIn(h, Role.MANAGER);
    const res = await api(h).get('/api/auth/me').set(...bearer(token)).expect(200);
    expect(res.body.email).toBe(fixtureEmail(h, Role.MANAGER));
    expect(res.body.role).toBe(Role.MANAGER);
  });

  it('re-reads the role on every request, so a demotion takes effect at once', async () => {
    const token = await signIn(h, Role.MANAGER);
    await api(h).get('/api/movements').set(...bearer(token)).expect(200);

    await h.prisma.user.update({
      where: { email: fixtureEmail(h, Role.MANAGER) },
      data: { role: Role.USER },
    });

    // Same (still unexpired) token, now carrying a stale role claim.
    await api(h).get('/api/movements').set(...bearer(token)).expect(403);
  });

  it('signs a new account up as a clerk and rejects the duplicate', async () => {
    const email = `signup-${h.suffix}@stockroom.test`;

    const created = await api(h)
      .post('/api/auth/signup')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    expect(created.body.user.role).toBe(Role.USER);

    const duplicate = await api(h)
      .post('/api/auth/signup')
      .send({ email, password: TEST_PASSWORD })
      .expect(400);
    expect(duplicate.body.message).toEqual(['email is already registered']);

    expect(await h.prisma.user.count({ where: { email } })).toBe(1);
  });
});
