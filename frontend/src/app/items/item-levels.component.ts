import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { StockLevelRow } from '../core/models';
import { queryText } from '../core/query-params';
import { LocationsApi } from '../shared/api/locations-api.service';

@Component({
  selector: 'app-item-levels',
  imports: [RouterLink],
  templateUrl: './item-levels.component.html',
  styleUrl: './item-levels.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLevelsComponent {
  private readonly locationsApi = inject(LocationsApi);

  /** Inherited from the parent `items/:id` route. */
  readonly id = input('', { transform: queryText });

  /** GET /api/stock-levels?itemId= — the item's balance in each location. */
  readonly levels = signal<StockLevelRow[]>([]);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        void this.load(id);
      } else {
        this.levels.set([]);
      }
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.levels.set(await this.locationsApi.listStockLevels(id));
    } catch {
      // No banner here: the tab sits inside the detail page, which already
      // reports a failed load. An empty list renders the "nothing on hand"
      // state, which is also the truthful answer for a brand-new item.
      this.levels.set([]);
    }
  }

  readonly rows = computed<StockLevelRow[]>(() =>
    this.levels().filter((row) => !row.itemId || row.itemId === this.id()),
  );

  readonly total = computed(() =>
    this.rows().reduce((sum, row) => sum + row.qty, 0),
  );
}
