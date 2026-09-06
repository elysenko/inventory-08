import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { LowStockRow } from '../core/models';
import { apiErrorMessage } from '../shared/api/api-client.service';
import { ReportsApi } from '../shared/api/reports-api.service';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent implements OnInit {
  private readonly reportsApi = inject(ReportsApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * GET /api/reports/low-stock — every item whose summed balance across all
   * locations sits at or below its reorder level, including items with no
   * stock rows at all. Manager-only.
   */
  readonly rows = signal<LowStockRow[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.reportsApi.lowStock());
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Could not load the low-stock report.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Worst shortfall first, matching both the header copy and the API's own
   * ordering. `deficit` is `reorderAt - totalQty`, so it is *positive* when an
   * item is short and the biggest number is the most urgent — hence descending.
   * SKU breaks ties so the order is stable between loads.
   */
  readonly sorted = computed<LowStockRow[]>(() =>
    [...this.rows()].sort(
      (a, b) => b.deficit - a.deficit || a.sku.localeCompare(b.sku),
    ),
  );

  readonly outOfStock = computed(
    () => this.rows().filter((row) => row.totalQty === 0).length,
  );

  shortfall(row: LowStockRow): number {
    return Math.max(0, row.reorderAt - row.totalQty);
  }
}
