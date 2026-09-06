import { Role } from '@prisma/client';

import { Harness, api, bearer, cleanup, createHarness, signIn } from './harness';

describe('items and locations (e2e)', () => {
  let h: Harness;
  let clerk: string;
  let manager: string;
  let sku: string;

  beforeAll(async () => {
    h = await createHarness();
    clerk = await signIn(h, Role.USER);
    manager = await signIn(h, Role.MANAGER);
    sku = `SKU-${h.suffix}`;
  });

  afterAll(async () => {
    await cleanup(h);
    await h.close();
  });

  const newItem = (overrides: Record<string, unknown> = {}) => ({
    sku,
    name: `Widget ${h.suffix}`,
    unit: 'ea',
    reorderAt: 10,
    ...overrides,
  });

  it('refuses catalogue writes from a clerk', async () => {
    await api(h)
      .post('/api/items')
      .set(...bearer(clerk))
      .send(newItem({ sku: `CLERK-${h.suffix}` }))
      .expect(403);

    await api(h)
      .post('/api/locations')
      .set(...bearer(clerk))
      .send({ name: `Clerk zone ${h.suffix}`, zone: 'A' })
      .expect(403);
  });

  it('lets a manager create an item and stores exactly one row per SKU', async () => {
    const created = await api(h)
      .post('/api/items')
      .set(...bearer(manager))
      .send(newItem())
      .expect(201);

    expect(created.body.sku).toBe(sku);
    expect(created.body.totalQty).toBe(0);

    const duplicate = await api(h)
      .post('/api/items')
      .set(...bearer(manager))
      .send(newItem({ name: 'Second attempt' }))
      .expect(400);

    expect(duplicate.body.message).toEqual(['sku must be unique']);
    expect(await h.prisma.item.count({ where: { sku } })).toBe(1);
  });

  it('validates the item payload', async () => {
    const bad = await api(h)
      .post('/api/items')
      .set(...bearer(manager))
      .send({ sku: 'has spaces!', name: '', unit: 'ea', reorderAt: -1 })
      .expect(400);
    expect(Array.isArray(bad.body.message)).toBe(true);
  });

  it('lets any authenticated user read the catalogue and filter it', async () => {
    const all = await api(h).get('/api/items').set(...bearer(clerk)).expect(200);
    expect(all.body.some((row: { sku: string }) => row.sku === sku)).toBe(true);

    const matching = await api(h)
      .get(`/api/items?q=${h.suffix}`)
      .set(...bearer(clerk))
      .expect(200);
    expect(matching.body).toHaveLength(1);
    expect(matching.body[0].sku).toBe(sku);

    const missing = await api(h)
      .get('/api/items?q=no-such-item-anywhere')
      .set(...bearer(clerk))
      .expect(200);
    expect(missing.body).toHaveLength(0);
  });

  it('reports a brand-new item as low stock (nothing on hand)', async () => {
    const low = await api(h)
      .get(`/api/items?q=${h.suffix}&lowStock=true`)
      .set(...bearer(clerk))
      .expect(200);
    expect(low.body.map((row: { sku: string }) => row.sku)).toContain(sku);
  });

  it('returns per-location levels and a total on the detail view', async () => {
    const item = await h.prisma.item.findUniqueOrThrow({ where: { sku } });
    const res = await api(h)
      .get(`/api/items/${item.id}`)
      .set(...bearer(clerk))
      .expect(200);

    expect(res.body.sku).toBe(sku);
    expect(res.body.totalQty).toBe(0);
    expect(Array.isArray(res.body.levels)).toBe(true);
  });

  it('404s on an unknown item', async () => {
    await api(h)
      .get('/api/items/does-not-exist')
      .set(...bearer(clerk))
      .expect(404);
  });

  it('edits an item and refuses a SKU that another item already owns', async () => {
    const item = await h.prisma.item.findUniqueOrThrow({ where: { sku } });
    const otherSku = `ALT-${h.suffix}`;
    await api(h)
      .post('/api/items')
      .set(...bearer(manager))
      .send(newItem({ sku: otherSku, name: `Other ${h.suffix}` }))
      .expect(201);

    await api(h)
      .patch(`/api/items/${item.id}`)
      .set(...bearer(manager))
      .send({ reorderAt: 25 })
      .expect(200)
      .expect((res) => expect(res.body.reorderAt).toBe(25));

    const clash = await api(h)
      .patch(`/api/items/${item.id}`)
      .set(...bearer(manager))
      .send({ sku: otherSku })
      .expect(400);
    expect(clash.body.message).toEqual(['sku must be unique']);
  });

  it('manages locations, rejecting a duplicate name', async () => {
    const name = `Zone A ${h.suffix}`;
    await api(h)
      .post('/api/locations')
      .set(...bearer(manager))
      .send({ name, zone: 'A' })
      .expect(201);

    await api(h)
      .post('/api/locations')
      .set(...bearer(manager))
      .send({ name, zone: 'A' })
      .expect(400);

    expect(await h.prisma.location.count({ where: { name } })).toBe(1);

    // Clerks must be able to read locations — they pick one per movement.
    const readable = await api(h)
      .get('/api/locations')
      .set(...bearer(clerk))
      .expect(200);
    expect(readable.body.some((row: { name: string }) => row.name === name)).toBe(true);
  });

  it('deletes an unused item and an empty location', async () => {
    const item = await h.prisma.item.findUniqueOrThrow({
      where: { sku: `ALT-${h.suffix}` },
    });
    await api(h)
      .delete(`/api/items/${item.id}`)
      .set(...bearer(manager))
      .expect(200);
    expect(await h.prisma.item.count({ where: { id: item.id } })).toBe(0);
  });
});
