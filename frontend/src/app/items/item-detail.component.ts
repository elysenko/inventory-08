import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { Item } from '../core/models';
import { queryText } from '../core/query-params';
import { ItemFormDialogComponent, ItemFormValue } from './item-form-dialog.component';

@Component({
  selector: 'app-item-detail',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ItemFormDialogComponent,
  ],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly isManager = this.auth.isManager;

  /** `:id` route param and `?modal=` query param, bound by the router. */
  readonly id = input('', { transform: queryText });
  readonly modal = input('', { transform: queryText });

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
  readonly dialogError = signal<string | null>(null);

  /** Falls back to the first item so a stale deep link still renders a screen. */
  readonly item = computed<Item | null>(
    () => this.items().find((row) => row.id === this.id()) ?? this.items()[0] ?? null,
  );

  readonly isLow = computed(() => {
    const item = this.item();
    return !!item && item.totalQty <= item.reorderAt;
  });

  readonly dialogOpen = computed(() => this.modal() === 'edit-item');

  openEdit(): void {
    this.dialogError.set(null);
    void this.router.navigate([], {
      queryParams: { modal: 'edit-item' },
      queryParamsHandling: 'merge',
    });
  }

  closeModal(): void {
    void this.router.navigate([], {
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  save(value: ItemFormValue): void {
    const current = this.item();
    if (!current) {
      return;
    }
    const clash = this.items().some(
      (row) => row.sku.toLowerCase() === value.sku.toLowerCase() && row.id !== current.id,
    );
    if (clash) {
      this.dialogError.set('sku must be unique');
      return;
    }
    this.items.update((rows) =>
      rows.map((row) => (row.id === current.id ? { ...row, ...value } : row)),
    );
    this.toast.success(`${value.sku} updated`);
    this.closeModal();
  }
}
