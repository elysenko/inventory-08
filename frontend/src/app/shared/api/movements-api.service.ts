import { Injectable, inject } from '@angular/core';

import { Movement, MovementType } from '../../core/models';
import { ApiClient } from './api-client.service';

/** Body accepted by POST /api/movements (mirrors CreateMovementDto). */
export interface MovementPayload {
  type: MovementType;
  itemId: string;
  qty: number;
  /** Required for OUT and TRANSFER. */
  fromLocId?: string;
  /** Required for IN and TRANSFER. */
  toLocId?: string;
  note?: string;
}

/** Audit-log filters; `from`/`to` are ISO dates and `to` is inclusive. */
export interface MovementQuery {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class MovementsApi {
  private readonly api = inject(ApiClient);

  /**
   * The audit log, newest first. Manager-only — a clerk gets 403, which the
   * route guard normally prevents from ever being requested.
   */
  listMovements(query: MovementQuery = {}): Promise<Movement[]> {
    return this.api.get<Movement[]>('/movements', {
      itemId: query.itemId,
      type: query.type,
      from: query.from,
      to: query.to,
    });
  }

  /**
   * Record a movement. The server applies the balance change and writes the
   * audit row in one transaction and is the sole authority on stock: an
   * over-draw comes back as 400 "Insufficient stock" with nothing written.
   */
  createMovement(payload: MovementPayload): Promise<Movement> {
    return this.api.post<Movement>('/movements', payload);
  }
}
