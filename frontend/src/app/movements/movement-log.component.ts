import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Item, MOVEMENT_TYPES, Movement } from '../core/models';
import { queryDefault, queryText } from '../core/query-params';
import { apiErrorMessage } from '../shared/api/api-client.service';
import { ItemsApi } from '../shared/api/items-api.service';
import { MovementsApi } from '../shared/api/movements-api.service';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly movementsApi = inject(MovementsApi);
  private readonly itemsApi = inject(ItemsApi);

  /* --- Filters live in the URL ------------------------------------------ */
  readonly itemId = input('', { transform: queryText });
  readonly type = input('', { transform: queryText });
  readonly from = input('', { transform: queryText });
  readonly to = input('', { transform: queryText });
  readonly page = input('1', { transform: queryDefault('1') });

  readonly types = MOVEMENT_TYPES;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Populates the item filter dropdown. */
  readonly items = signal<Item[]>([]);

  /** GET /api/movements — the immutable audit log, newest first. */
  readonly movements = signal<Movement[]>([]);

  ngOnInit(): void {
    void this.loadItems();
  }

  constructor() {
    // Filters live in the URL, so the query is driven by the router-bound
    // inputs: a deep link with ?itemId=&type=&from=&to= fetches exactly that
    // slice, and editing a filter re-fetches it.
    effect(() => {
      void this.loadMovements({
        itemId: this.itemId(),
        type: this.type(),
        from: this.from(),
        to: this.to(),
      });
    });
  }

  private async loadItems(): Promise<void> {
    try {
      this.items.set(await this.itemsApi.listItems());
    } catch {
      // A failed item list only costs the filter dropdown its labels; the log
      // itself reports its own failure below.
      this.items.set([]);
    }
  }

  private async loadMovements(query: {
    itemId: string;
    type: string;
    from: string;
    to: string;
  }): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.movements.set(await this.movementsApi.listMovements(query));
    } catch (error) {
      this.movements.set([]);
      this.error.set(apiErrorMessage(error, 'Could not load the audit log.'));
    } finally {
      this.loading.set(false);
    }
  }

  readonly currentPage = computed(() => Math.max(1, Number(this.page()) || 1));

  /**
   * The API has already applied these filters; re-checking them here keeps the
   * pager honest during the moment between a filter change and its response.
   */
  readonly filtered = computed<Movement[]>(() =>
    this.movements().filter((row) => {
      if (this.itemId() && row.itemId !== this.itemId()) return false;
      if (this.type() && row.type !== this.type()) return false;
      const stamp = row.createdAt.slice(0, 10);
      if (this.from() && stamp < this.from()) return false;
      // `to` is inclusive to the end of the selected day, mirroring the API.
      if (this.to() && stamp > this.to()) return false;
      return true;
    }),
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)),
  );

  readonly visible = computed<Movement[]>(() => {
    const start = (Math.min(this.currentPage(), this.totalPages()) - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly hasFilters = computed(
    () => !!(this.itemId() || this.type() || this.from() || this.to()),
  );

  badgeClass(type: Movement['type']): string {
    if (type === 'IN') return 'badge badge-in';
    if (type === 'OUT') return 'badge badge-out';
    return 'badge badge-transfer';
  }

  setFilter(key: string, value: string): void {
    this.patchQuery({ [key]: value || null, page: null });
  }

  goToPage(page: number): void {
    this.patchQuery({ page: page <= 1 ? null : String(page) });
  }

  clearFilters(): void {
    this.patchQuery({ itemId: null, type: null, from: null, to: null, page: null });
  }

  private patchQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
