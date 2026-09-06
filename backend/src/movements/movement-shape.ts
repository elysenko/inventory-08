import { MovementType } from '@prisma/client';

export interface MovementShape {
  type: MovementType;
  fromLocId?: string | null;
  toLocId?: string | null;
}

/**
 * Structural rules for a movement, kept as a pure function so they can be
 * unit-tested without a database and reused by the wizard's confirm step.
 *
 *   IN       credits toLoc            — fromLoc must be absent
 *   OUT      debits  fromLoc          — toLoc must be absent
 *   TRANSFER debits fromLoc, credits toLoc — both required and distinct
 *
 * Returns the offending message, or null when the shape is valid.
 */
export function validateMovementShape(movement: MovementShape): string | null {
  const from = movement.fromLocId || null;
  const to = movement.toLocId || null;

  switch (movement.type) {
    case 'IN':
      if (!to) {
        return 'toLocId is required for an IN movement';
      }
      if (from) {
        return 'fromLocId must be omitted on an IN movement';
      }
      return null;

    case 'OUT':
      if (!from) {
        return 'fromLocId is required for an OUT movement';
      }
      if (to) {
        return 'toLocId must be omitted on an OUT movement';
      }
      return null;

    case 'TRANSFER':
      if (!from || !to) {
        return 'fromLocId and toLocId are both required for a TRANSFER';
      }
      if (from === to) {
        return 'a TRANSFER must move stock between two different locations';
      }
      return null;

    default:
      return 'type must be one of IN, OUT, TRANSFER';
  }
}
