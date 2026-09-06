import { Injectable, inject } from '@angular/core';

import { LowStockRow } from '../../core/models';
import { ApiClient } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiClient);

  /** Items at or below their reorder level, worst deficit first. Manager-only. */
  lowStock(): Promise<LowStockRow[]> {
    return this.api.get<LowStockRow[]>('/reports/low-stock');
  }
}
