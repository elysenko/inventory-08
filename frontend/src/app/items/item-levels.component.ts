import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { StockLevelRow } from '../core/models';
import { queryText } from '../core/query-params';

@Component({
  selector: 'app-item-levels',
  imports: [RouterLink],
  templateUrl: './item-levels.component.html',
  styleUrl: './item-levels.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLevelsComponent {
  /** Inherited from the parent `items/:id` route. */
  readonly id = input('', { transform: queryText });

  readonly levels = signal<StockLevelRow[]>([
    { itemId: 'itm-1001', locationId: 'loc-a', locationName: 'Bulk Racking A1', zone: 'Zone A', qty: 300 },
    { itemId: 'itm-1001', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 180 },
    { itemId: 'itm-1002', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 26 },
    { itemId: 'itm-1003', locationId: 'loc-a', locationName: 'Bulk Racking A1', zone: 'Zone A', qty: 4 },
    { itemId: 'itm-1003', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 8 },
    { itemId: 'itm-1004', locationId: 'loc-d', locationName: 'Goods-In Bay', zone: 'Zone A', qty: 90 },
    { itemId: 'itm-1005', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 30 },
    { itemId: 'itm-1006', locationId: 'loc-a', locationName: 'Bulk Racking A1', zone: 'Zone A', qty: 100 },
    { itemId: 'itm-1006', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 45 },
    { itemId: 'itm-1008', locationId: 'loc-a', locationName: 'Bulk Racking A1', zone: 'Zone A', qty: 200 },
    { itemId: 'itm-1008', locationId: 'loc-b', locationName: 'Pick Face B2', zone: 'Zone B', qty: 120 },
  ]);

  readonly rows = computed<StockLevelRow[]>(() =>
    this.levels().filter((row) => !row.itemId || row.itemId === this.id()),
  );

  readonly total = computed(() =>
    this.rows().reduce((sum, row) => sum + row.qty, 0),
  );
}
