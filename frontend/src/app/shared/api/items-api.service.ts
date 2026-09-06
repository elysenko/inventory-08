import { Injectable, inject } from '@angular/core';

import { Item, ItemDetail, Movement } from '../../core/models';
import { ApiClient } from './api-client.service';

/** Body accepted by POST/PATCH /api/items (mirrors CreateItemDto). */
export interface ItemPayload {
  sku: string;
  name: string;
  description?: string;
  unit: string;
  reorderAt: number;
}

export interface ItemQuery {
  q?: string;
  /** `true` restricts the catalogue to totalQty <= reorderAt. */
  lowStock?: boolean;
}

/** GET /api/items and friends. Reads are open to any signed-in user; writes are manager-only and answer 403 otherwise. */
@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private readonly api = inject(ApiClient);

  listItems(query: ItemQuery = {}): Promise<Item[]> {
    return this.api.get<Item[]>('/items', {
      q: query.q,
      lowStock: query.lowStock ? 'true' : undefined,
    });
  }

  /** One item plus its per-location breakdown. 404 when the id is unknown. */
  getItem(id: string): Promise<ItemDetail> {
    return this.api.get<ItemDetail>(`/items/${encodeURIComponent(id)}`);
  }

  /** Item-scoped audit history, newest first. */
  listItemMovements(id: string): Promise<Movement[]> {
    return this.api.get<Movement[]>(`/items/${encodeURIComponent(id)}/movements`);
  }

  createItem(payload: ItemPayload): Promise<Item> {
    return this.api.post<Item>('/items', payload);
  }

  updateItem(id: string, payload: Partial<ItemPayload>): Promise<Item> {
    return this.api.patch<Item>(`/items/${encodeURIComponent(id)}`, payload);
  }

  /** Refused with 400 when a recorded movement references the item. */
  deleteItem(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/items/${encodeURIComponent(id)}`);
  }
}
