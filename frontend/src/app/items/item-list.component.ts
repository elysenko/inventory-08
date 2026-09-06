import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { Item } from '../core/models';
import { queryDefault, queryText } from '../core/query-params';
import { apiErrorMessage } from '../shared/api/api-client.service';
import { ItemsApi } from '../shared/api/items-api.service';
import { ItemFormDialogComponent, ItemFormValue } from './item-form-dialog.component';

const PAGE_SIZE = 6;

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemFormDialogComponent],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly itemsApi = inject(ItemsApi);

  readonly isManager = this.auth.isManager;

  /* --- URL-bound state (query params -> component inputs) ---------------- */
  readonly q = input('', { transform: queryText });
  readonly lowStock = input('', { transform: queryText });
  readonly page = input('1', { transform: queryDefault('1') });
  readonly sort = input('sku', { transform: queryDefault('sku') });
  readonly modal = input('', { transform: queryText });
  readonly id = input('', { transform: queryText });

  /* --- Server-backed data ------------------------------------------------ */
  readonly items = signal<Item[]>([]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  /**
   * The whole catalogue in one call. Search, the low-stock toggle and paging
   * are applied below against this list rather than re-querying per keystroke —
   * the filters stay in the URL either way, so a deep link still resolves.
   */
  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.itemsApi.listItems());
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not load the item catalog.'));
    } finally {
      this.loading.set(false);
    }
  }

  /* --- Derived view ------------------------------------------------------ */
  readonly lowStockOn = computed(() => this.lowStock() === 'true');
  readonly currentPage = computed(() => Math.max(1, Number(this.page()) || 1));

  readonly filtered = computed<Item[]>(() => {
    const term = this.q().trim().toLowerCase();
    const onlyLow = this.lowStockOn();
    const key = this.sort();
    const rows = this.items().filter((item) => {
      const matches =
        !term ||
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term);
      return matches && (!onlyLow || this.isLow(item));
    });
    return [...rows].sort((a, b) => {
      if (key === 'qty') return a.totalQty - b.totalQty;
      if (key === 'name') return a.name.localeCompare(b.name);
      return a.sku.localeCompare(b.sku);
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)),
  );

  readonly visible = computed<Item[]>(() => {
    const start = (Math.min(this.currentPage(), this.totalPages()) - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly lowStockCount = computed(
    () => this.items().filter((item) => this.isLow(item)).length,
  );

  /* --- Modal state, restored from the URL on reload ---------------------- */
  readonly dialogOpen = computed(
    () => this.modal() === 'create-item' || this.modal() === 'edit-item',
  );
  readonly editing = computed<Item | null>(
    () => this.items().find((item) => item.id === this.id()) ?? null,
  );
  readonly deleting = computed<Item | null>(() =>
    this.modal() === 'delete-item'
      ? this.items().find((item) => item.id === this.id()) ?? null
      : null,
  );

  isLow(item: Item): boolean {
    return item.totalQty <= item.reorderAt;
  }

  /* --- URL writers ------------------------------------------------------- */
  setSearch(value: string): void {
    this.patchQuery({ q: value || null, page: null }, true);
  }

  toggleLowStock(): void {
    this.patchQuery({ lowStock: this.lowStockOn() ? null : 'true', page: null });
  }

  setSort(key: string): void {
    this.patchQuery({ sort: key, page: null });
  }

  goToPage(page: number): void {
    this.patchQuery({ page: page <= 1 ? null : String(page) });
  }

  openCreate(): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: 'create-item', id: null });
  }

  openEdit(item: Item): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: 'edit-item', id: item.id });
  }

  confirmDelete(item: Item): void {
    this.patchQuery({ modal: 'delete-item', id: item.id });
  }

  closeModal(): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: null, id: null });
  }

  private patchQuery(
    queryParams: Record<string, string | null>,
    replaceUrl = false,
  ): void {
    void this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  /* --- Mutations --------------------------------------------------------- */
  /**
   * The API owns uniqueness: a duplicate SKU comes back as 400
   * "sku must be unique" with nothing written, and that message is handed to
   * the dialog so it renders inline on the SKU control.
   */
  async save(value: ItemFormValue): Promise<void> {
    const editing = this.editing();
    this.saving.set(true);
    this.dialogError.set(null);
    try {
      if (editing) {
        await this.itemsApi.updateItem(editing.id, value);
        this.toast.success(`${value.sku} updated`);
      } else {
        await this.itemsApi.createItem(value);
        this.toast.success(`${value.sku} added to the catalog`);
      }
      this.closeModal();
      await this.load();
    } catch (error) {
      this.dialogError.set(apiErrorMessage(error, 'Could not save that item.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Refused with 400 when a recorded movement references the item. */
  async remove(item: Item): Promise<void> {
    this.closeModal();
    try {
      await this.itemsApi.deleteItem(item.id);
      this.toast.success(`${item.sku} removed`);
      await this.load();
    } catch (error) {
      this.toast.error(apiErrorMessage(error, `Could not delete ${item.sku}.`));
    }
  }
}
