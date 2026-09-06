import { Injectable, inject } from '@angular/core';

import { Location, StockLevelRow } from '../../core/models';
import { ApiClient } from './api-client.service';

/** Body accepted by POST/PATCH /api/locations (mirrors CreateLocationDto). */
export interface LocationPayload {
  name: string;
  zone: string;
}

/** GET /api/locations and the flat /api/stock-levels balance feed. */
@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly api = inject(ApiClient);

  /** Readable by every signed-in user — clerks pick locations when recording. */
  listLocations(): Promise<Location[]> {
    return this.api.get<Location[]>('/locations');
  }

  getLocation(id: string): Promise<Location> {
    return this.api.get<Location>(`/locations/${encodeURIComponent(id)}`);
  }

  /**
   * Per-item, per-location balances. Scoped to one item this is what the
   * movement wizard reads for its "only N available here" hints.
   */
  listStockLevels(itemId?: string): Promise<StockLevelRow[]> {
    return this.api.get<StockLevelRow[]>('/stock-levels', { itemId });
  }

  createLocation(payload: LocationPayload): Promise<Location> {
    return this.api.post<Location>('/locations', payload);
  }

  updateLocation(id: string, payload: Partial<LocationPayload>): Promise<Location> {
    return this.api.patch<Location>(`/locations/${encodeURIComponent(id)}`, payload);
  }

  /** Refused with 400 while the location still holds stock or is referenced. */
  deleteLocation(id: string): Promise<{ id: string }> {
    return this.api.delete<{ id: string }>(`/locations/${encodeURIComponent(id)}`);
  }
}
