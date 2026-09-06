import {
  ChangeDetectionStrategy,
  Component,
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
import { ItemFormDialogComponent, ItemFormValue } from './item-form-dialog.component';

const PAGE_SIZE = 6;

@Component({
  selector: 'app-item-list',
  imports: [FormsModule, RouterLink, ItemFormDialogComponent],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isManager = this.auth.isManager;

  /* --- URL-bound state (query params -> component inputs) ---------------- */
  readonly q = input('', { transform: queryText });
  readonly lowStock = input('', { transform: queryText });
  readonly page = input('1', { transform: queryDefault('1') });
  readonly sort = input('sku', { transform: queryDefault('sku') });
  readonly modal = input('', { transform: queryText });
  readonly id = input('', { transform: queryText });

  /* --- Server-backed data ------------------------------------------------ */
  readonly items = signal<Item[]>([
    { id: 'itm-1001', sku: 'WH-1001', name: 'M8 Hex Bolt, Zinc Plated', description: 'Grade 8.8 structural bolt, 40mm shank.', unit: 'ea', reorderAt: 120, totalQty: 480 },
    { id: 'itm-1002', sku: 'WH-1002', name: 'Nitrile Gloves, Large', description: 'Powder-free, blue, 100 per box.', unit: 'box', reorderAt: 40, totalQty: 26 },
    { id: 'itm-1003', sku: 'WH-1003', name: 'Packing Tape 48mm', description: 'Clear polypropylene, 66m roll.', unit: 'roll', reorderAt: 60, totalQty: 12 },
    { id: 'itm-1004', sku: 'WH-1004', name: 'Euro Pallet 1200x800', description: 'Heat-treated hardwood, ISPM-15 stamped.', unit: 'ea', reorderAt: 25, totalQty: 90 },
    { id: 'itm-1005', sku: 'WH-1005', name: 'Thermal Label 4x6', description: 'Direct thermal, 250 labels per roll.', unit: 'roll', reorderAt: 30, totalQty: 30 },
    { id: 'itm-1006', sku: 'WH-1006', name: 'Stretch Wrap 500mm', description: '23 micron hand pallet wrap.', unit: 'roll', reorderAt: 50, totalQty: 145 },
    { id: 'itm-1007', sku: 'WH-1007', name: 'Safety Goggles, Clear', description: 'Anti-fog polycarbonate, EN166.', unit: 'ea', reorderAt: 35, totalQty: 0 },
    { id: 'itm-1008', sku: 'WH-1008', name: 'Cable Tie 200mm', description: 'Natural nylon, 100 per pack.', unit: 'pack', reorderAt: 80, totalQty: 320 },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly dialogError = signal<string | null>(null);

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

  /* --- Mutations (mock: the service layer swaps these for API calls) ----- */
  save(value: ItemFormValue): void {
    const editing = this.editing();
    const clash = this.items().some(
      (item) => item.sku.toLowerCase() === value.sku.toLowerCase() && item.id !== editing?.id,
    );
    if (clash) {
      this.dialogError.set('sku must be unique');
      return;
    }

    if (editing) {
      this.items.update((rows) =>
        rows.map((row) => (row.id === editing.id ? { ...row, ...value } : row)),
      );
      this.toast.success(`${value.sku} updated`);
    } else {
      this.items.update((rows) => [
        { id: `itm-${Date.now()}`, totalQty: 0, ...value },
        ...rows,
      ]);
      this.toast.success(`${value.sku} added to the catalog`);
    }
    this.closeModal();
  }

  remove(item: Item): void {
    this.items.update((rows) => rows.filter((row) => row.id !== item.id));
    this.toast.success(`${item.sku} removed`);
    this.closeModal();
  }
}
