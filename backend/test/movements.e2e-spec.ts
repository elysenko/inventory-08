import { Role } from '@prisma/client';

import {
  Harness,
  api,
  bearer,
  cleanup,
  createHarness,
  fixtureEmail,
  signIn,
} from './harness';

describe('stock movements (e2e)', () => {
  let h: Harness;
  let clerk: string;
  let manager: string;
  let itemId: string;
  let zoneA: string;
  let zoneB: string;

  beforeAll(async () => {
    h = await createHarness();
    clerk = await signIn(h, Role.USER);
    manager = await signIn(h, Role.MANAGER);

    const item = await api(h)
      .post('/api/items')
      .set(...bearer(manager))
      .send({
        sku: `MOV-${h.suffix}`,
        name: `Pallet ${h.suffix}`,
        unit: 'ea',
        reorderAt: 10,
      })
      .expect(201);
    itemId = item.body.id;

    const a = await api(h)
      .post('/api/locations')
      .set(...bearer(manager))
      .send({ name: `Zone A ${h.suffix}`, zone: 'A' })
      .expect(201);
    zoneA = a.body.id;

    const b = await api(h)
      .post('/api/locations')
      .set(...bearer(manager))
      .send({ name: `Zone B ${h.suffix}`, zone: 'B' })
      .expect(201);
    zoneB = b.body.id;
  });

  afterAll(async () => {
    await cleanup(h);
    await h.close();
  });

  const record = (body: Record<string, unknown>) =>
    api(h)
      .post('/api/movements')
      .set(...bearer(clerk))
      .send(body);

  const balanceAt = async (locationId: string): Promise<number> => {
    const level = await h.prisma.stockLevel.findUnique({
      where: { itemId_locationId: { itemId, locationId } },
    });
    return level?.qty ?? 0;
  };

  it('credits the destination on an IN and writes one audit row', async () => {
    await record({ type: 'IN', itemId, toLocId: zoneA, qty: 50 }).expect(201);

    expect(await balanceAt(zoneA)).toBe(50);

    const movements = await h.prisma.movement.findMany({
      where: { itemId },
      include: { user: true },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('IN');
    expect(movements[0].qty).toBe(50);
    expect(movements[0].toLocId).toBe(zoneA);
    expect(movements[0].user.email).toBe(fixtureEmail(h, Role.USER));
    expect(movements[0].createdAt).toBeInstanceOf(Date);
  });

  it('debits the source on an OUT', async () => {
    await record({ type: 'OUT', itemId, fromLocId: zoneA, qty: 20 }).expect(201);
    expect(await balanceAt(zoneA)).toBe(30);
  });

  it('conserves the total across a TRANSFER', async () => {
    const before = (await balanceAt(zoneA)) + (await balanceAt(zoneB));

    await record({
      type: 'TRANSFER',
      itemId,
      fromLocId: zoneA,
      toLocId: zoneB,
      qty: 10,
      note: 'rebalancing',
    }).expect(201);

    expect(await balanceAt(zoneA)).toBe(20);
    expect(await balanceAt(zoneB)).toBe(10);
    expect((await balanceAt(zoneA)) + (await balanceAt(zoneB))).toBe(before);
  });

  it('refuses an over-draw and leaves the stored balance untouched', async () => {
    const before = await balanceAt(zoneB);
    expect(before).toBe(10);

    const res = await record({
      type: 'OUT',
      itemId,
      fromLocId: zoneB,
      qty: before + 5,
    }).expect(400);
    expect(String(res.body.message)).toMatch(/insufficient stock/i);

    expect(await balanceAt(zoneB)).toBe(before);
  });

  it('rolls a TRANSFER back whole when the debit fails — no phantom stock', async () => {
    const fromBefore = await balanceAt(zoneB);
    const toBefore = await balanceAt(zoneA);
    const auditBefore = await h.prisma.movement.count({ where: { itemId } });

    await record({
      type: 'TRANSFER',
      itemId,
      fromLocId: zoneB,
      toLocId: zoneA,
      qty: fromBefore + 1,
    }).expect(400);

    expect(await balanceAt(zoneB)).toBe(fromBefore);
    expect(await balanceAt(zoneA)).toBe(toBefore);
    expect(await h.prisma.movement.count({ where: { itemId } })).toBe(auditBefore);
  });

  it('rejects malformed movement shapes', async () => {
    const cases: Record<string, unknown>[] = [
      { type: 'IN', itemId, fromLocId: zoneA, qty: 1 }, // IN must not have a source
      { type: 'IN', itemId, qty: 1 }, // IN needs a destination
      { type: 'OUT', itemId, toLocId: zoneA, qty: 1 }, // OUT must not have a destination
      { type: 'OUT', itemId, qty: 1 }, // OUT needs a source
      { type: 'TRANSFER', itemId, fromLocId: zoneA, qty: 1 }, // TRANSFER needs both
      { type: 'TRANSFER', itemId, fromLocId: zoneA, toLocId: zoneA, qty: 1 }, // same place
      { type: 'IN', itemId, toLocId: zoneA, qty: 0 }, // qty must be >= 1
      { type: 'IN', itemId, toLocId: zoneA, qty: -5 },
      { type: 'SHRINKAGE', itemId, toLocId: zoneA, qty: 1 }, // unknown type
    ];

    for (const body of cases) {
      await record(body).expect(400);
    }
  });

  it('404s when the item or location does not exist', async () => {
    await record({ type: 'IN', itemId: 'nope', toLocId: zoneA, qty: 1 }).expect(404);
    await record({ type: 'IN', itemId, toLocId: 'nope', qty: 1 }).expect(404);
  });

  it('keeps the audit log manager-only and filterable', async () => {
    await api(h).get('/api/movements').set(...bearer(clerk)).expect(403);

    const all = await api(h)
      .get(`/api/movements?itemId=${itemId}`)
      .set(...bearer(manager))
      .expect(200);
    expect(all.body).toHaveLength(3);
    expect(all.body[0].userEmail).toBe(fixtureEmail(h, Role.USER));
    expect(all.body[0].itemSku).toBe(`MOV-${h.suffix}`);
    // Newest first.
    expect(new Date(all.body[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(all.body[1].createdAt).getTime(),
    );

    const outsOnly = await api(h)
      .get(`/api/movements?itemId=${itemId}&type=OUT`)
      .set(...bearer(manager))
      .expect(200);
    expect(outsOnly.body).toHaveLength(1);
    expect(outsOnly.body[0].type).toBe('OUT');

    const future = await api(h)
      .get(`/api/movements?itemId=${itemId}&from=2099-01-01`)
      .set(...bearer(manager))
      .expect(200);
    expect(future.body).toHaveLength(0);

    const past = await api(h)
      .get(`/api/movements?itemId=${itemId}&to=2000-01-01`)
      .set(...bearer(manager))
      .expect(200);
    expect(past.body).toHaveLength(0);

    await api(h)
      .get('/api/movements?type=NOT-A-TYPE')
      .set(...bearer(manager))
      .expect(400);
  });

  it('exposes item-scoped history to clerks', async () => {
    const res = await api(h)
      .get(`/api/items/${itemId}/movements`)
      .set(...bearer(clerk))
      .expect(200);
    expect(res.body).toHaveLength(3);
  });

  it('protects the audit trail: an item or location with history cannot be deleted', async () => {
    await api(h)
      .delete(`/api/items/${itemId}`)
      .set(...bearer(manager))
      .expect(400);
    await api(h)
      .delete(`/api/locations/${zoneA}`)
      .set(...bearer(manager))
      .expect(400);
  });

  it('offers no way to edit or erase a recorded movement', async () => {
    const [movement] = await h.prisma.movement.findMany({ where: { itemId }, take: 1 });
    await api(h)
      .patch(`/api/movements/${movement.id}`)
      .set(...bearer(manager))
      .send({ qty: 1 })
      .expect(404);
    await api(h)
      .delete(`/api/movements/${movement.id}`)
      .set(...bearer(manager))
      .expect(404);
  });
});
