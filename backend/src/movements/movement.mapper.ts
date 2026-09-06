import { Prisma } from '@prisma/client';

import { MovementRow } from '../common/api-types';

/**
 * The relations every movement row needs to render the audit log: who recorded
 * it, which item, and the human-readable location names on each side.
 */
export const MOVEMENT_INCLUDE = {
  item: { select: { sku: true, name: true } },
  fromLoc: { select: { name: true } },
  toLoc: { select: { name: true } },
  user: { select: { email: true } },
} satisfies Prisma.MovementInclude;

type MovementWithRelations = Prisma.MovementGetPayload<{
  include: typeof MOVEMENT_INCLUDE;
}>;

export function toMovementRow(movement: MovementWithRelations): MovementRow {
  return {
    id: movement.id,
    type: movement.type,
    itemId: movement.itemId,
    itemSku: movement.item.sku,
    itemName: movement.item.name,
    qty: movement.qty,
    fromLocName: movement.fromLoc?.name ?? null,
    toLocName: movement.toLoc?.name ?? null,
    note: movement.note,
    userEmail: movement.user.email,
    createdAt: movement.createdAt.toISOString(),
  };
}
