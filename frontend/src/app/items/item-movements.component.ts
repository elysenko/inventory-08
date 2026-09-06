import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Movement } from '../core/models';
import { queryText } from '../core/query-params';
import { ItemsApi } from '../shared/api/items-api.service';

@Component({
  selector: 'app-item-movements',
  imports: [DatePipe, RouterLink],
  templateUrl: './item-movements.component.html',
  styleUrl: './item-movements.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemMovementsComponent {
  private readonly itemsApi = inject(ItemsApi);

  /** Inherited from the parent `items/:id` route. */
  readonly id = input('', { transform: queryText });

  /**
   * GET /api/items/:id/movements — newest first. Unlike the manager-only audit
   * log, this item-scoped history is readable by clerks too.
   */
  readonly movements = signal<Movement[]>([]);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        void this.load(id);
      } else {
        this.movements.set([]);
      }
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.movements.set(await this.itemsApi.listItemMovements(id));
    } catch {
      // The parent detail page owns the error banner; an empty history renders
      // the "no movements recorded yet" state.
      this.movements.set([]);
    }
  }

  readonly rows = computed<Movement[]>(() =>
    this.movements().filter((row) => row.itemId === this.id()),
  );

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }
}
