import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { LowStockRow } from '../core/models';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = signal<LowStockRow[]>([
    { id: 'itm-1007', sku: 'WH-1007', name: 'Safety Goggles, Clear', unit: 'ea', reorderAt: 35, totalQty: 0, deficit: -35 },
    { id: 'itm-1003', sku: 'WH-1003', name: 'Packing Tape 48mm', unit: 'roll', reorderAt: 60, totalQty: 12, deficit: -48 },
    { id: 'itm-1002', sku: 'WH-1002', name: 'Nitrile Gloves, Large', unit: 'box', reorderAt: 40, totalQty: 26, deficit: -14 },
    { id: 'itm-1005', sku: 'WH-1005', name: 'Thermal Label 4x6', unit: 'roll', reorderAt: 30, totalQty: 30, deficit: 0 },
  ]);

  /** Worst deficit first, exactly as the API orders it. */
  readonly sorted = computed<LowStockRow[]>(() =>
    [...this.rows()].sort((a, b) => a.deficit - b.deficit),
  );

  readonly outOfStock = computed(
    () => this.rows().filter((row) => row.totalQty === 0).length,
  );

  shortfall(row: LowStockRow): number {
    return Math.max(0, row.reorderAt - row.totalQty);
  }
}
