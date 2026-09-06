import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Item, MOVEMENT_TYPES, Movement } from '../core/models';
import { queryDefault, queryText } from '../core/query-params';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent {
  private readonly router = inject(Router);

  /* --- Filters live in the URL ------------------------------------------ */
  readonly itemId = input('', { transform: queryText });
  readonly type = input('', { transform: queryText });
  readonly from = input('', { transform: queryText });
  readonly to = input('', { transform: queryText });
  readonly page = input('1', { transform: queryDefault('1') });

  readonly types = MOVEMENT_TYPES;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<Item[]>([
    { id: 'itm-1001', sku: 'WH-1001', name: 'M8 Hex Bolt, Zinc Plated', unit: 'ea', reorderAt: 120, totalQty: 480 },
    { id: 'itm-1002', sku: 'WH-1002', name: 'Nitrile Gloves, Large', unit: 'box', reorderAt: 40, totalQty: 26 },
    { id: 'itm-1003', sku: 'WH-1003', name: 'Packing Tape 48mm', unit: 'roll', reorderAt: 60, totalQty: 12 },
    { id: 'itm-1004', sku: 'WH-1004', name: 'Euro Pallet 1200x800', unit: 'ea', reorderAt: 25, totalQty: 90 },
    { id: 'itm-1005', sku: 'WH-1005', name: 'Thermal Label 4x6', unit: 'roll', reorderAt: 30, totalQty: 30 },
    { id: 'itm-1006', sku: 'WH-1006', name: 'Stretch Wrap 500mm', unit: 'roll', reorderAt: 50, totalQty: 145 },
    { id: 'itm-1007', sku: 'WH-1007', name: 'Safety Goggles, Clear', unit: 'ea', reorderAt: 35, totalQty: 0 },
    { id: 'itm-1008', sku: 'WH-1008', name: 'Cable Tie 200mm', unit: 'pack', reorderAt: 80, totalQty: 320 },
  ]);

  readonly movements = signal<Movement[]>([
    { id: 'mv-31', type: 'OUT', itemId: 'itm-1003', itemSku: 'WH-1003', itemName: 'Packing Tape 48mm', qty: 18, fromLocName: 'Pick Face B2', toLocName: null, note: 'Outbound wave 4471', userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-05T15:42:00Z' },
    { id: 'mv-30', type: 'TRANSFER', itemId: 'itm-1001', itemSku: 'WH-1001', itemName: 'M8 Hex Bolt, Zinc Plated', qty: 60, fromLocName: 'Bulk Racking A1', toLocName: 'Pick Face B2', note: 'Pick face replenishment', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-09-05T11:08:00Z' },
    { id: 'mv-29', type: 'IN', itemId: 'itm-1006', itemSku: 'WH-1006', itemName: 'Stretch Wrap 500mm', qty: 100, fromLocName: null, toLocName: 'Bulk Racking A1', note: 'PO-88213 received', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-09-04T09:15:00Z' },
    { id: 'mv-28', type: 'OUT', itemId: 'itm-1002', itemSku: 'WH-1002', itemName: 'Nitrile Gloves, Large', qty: 14, fromLocName: 'Pick Face B2', toLocName: null, note: 'Issued to packing line', userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-03T16:30:00Z' },
    { id: 'mv-27', type: 'OUT', itemId: 'itm-1007', itemSku: 'WH-1007', itemName: 'Safety Goggles, Clear', qty: 12, fromLocName: 'Bulk Racking A1', toLocName: null, note: 'Site safety refresh', userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-09-03T08:05:00Z' },
    { id: 'mv-26', type: 'TRANSFER', itemId: 'itm-1003', itemSku: 'WH-1003', itemName: 'Packing Tape 48mm', qty: 8, fromLocName: 'Bulk Racking A1', toLocName: 'Pick Face B2', note: null, userEmail: 'sam.patel@stockroom.app', createdAt: '2026-09-02T13:20:00Z' },
    { id: 'mv-25', type: 'IN', itemId: 'itm-1004', itemSku: 'WH-1004', itemName: 'Euro Pallet 1200x800', qty: 90, fromLocName: null, toLocName: 'Goods-In Bay', note: 'Pallet return from carrier', userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-09-01T10:00:00Z' },
    { id: 'mv-24', type: 'IN', itemId: 'itm-1001', itemSku: 'WH-1001', itemName: 'M8 Hex Bolt, Zinc Plated', qty: 540, fromLocName: null, toLocName: 'Bulk Racking A1', note: 'PO-88190 received', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-08-31T07:45:00Z' },
    { id: 'mv-23', type: 'IN', itemId: 'itm-1008', itemSku: 'WH-1008', itemName: 'Cable Tie 200mm', qty: 320, fromLocName: null, toLocName: 'Bulk Racking A1', note: null, userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-08-29T12:10:00Z' },
    { id: 'mv-22', type: 'IN', itemId: 'itm-1005', itemSku: 'WH-1005', itemName: 'Thermal Label 4x6', qty: 30, fromLocName: null, toLocName: 'Pick Face B2', note: 'Short delivery — 20 rolls backordered', userEmail: 'dana.okafor@stockroom.app', createdAt: '2026-08-28T14:55:00Z' },
    { id: 'mv-21', type: 'TRANSFER', itemId: 'itm-1008', itemSku: 'WH-1008', itemName: 'Cable Tie 200mm', qty: 120, fromLocName: 'Bulk Racking A1', toLocName: 'Pick Face B2', note: 'Replen for line 2', userEmail: 'sam.patel@stockroom.app', createdAt: '2026-08-27T09:35:00Z' },
    { id: 'mv-20', type: 'OUT', itemId: 'itm-1006', itemSku: 'WH-1006', itemName: 'Stretch Wrap 500mm', qty: 25, fromLocName: 'Pick Face B2', toLocName: null, note: 'Consumed on despatch', userEmail: 'lee.morgan@stockroom.app', createdAt: '2026-08-26T17:02:00Z' },
  ]);

  readonly currentPage = computed(() => Math.max(1, Number(this.page()) || 1));

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
