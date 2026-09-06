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

import { ToastService } from '../core/toast.service';
import { queryDefault, queryText } from '../core/query-params';
import {
  Item,
  Location,
  MOVEMENT_TYPES,
  MovementType,
  StockLevelRow,
} from '../core/models';

@Component({
  selector: 'app-movement-new',
  imports: [FormsModule, RouterLink],
  templateUrl: './movement-new.component.html',
  styleUrl: './movement-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementNewComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /* --- Every step of the wizard is addressable ------------------------- */
  readonly step = input('1', { transform: queryDefault('1') });
  readonly itemId = input('', { transform: queryText });
  readonly type = input('', { transform: queryText });
  readonly fromLocId = input('', { transform: queryText });
  readonly toLocId = input('', { transform: queryText });
  readonly qty = input('', { transform: queryText });
  readonly q = input('', { transform: queryText });

  readonly types = MOVEMENT_TYPES;
  readonly note = signal('');
  readonly submitting = signal(false);
  /** Server 400 (e.g. "Insufficient stock") — keeps the user on step 3. */
  readonly formError = signal<string | null>(null);

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

  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Bulk Racking A1', zone: 'Zone A' },
    { id: 'loc-b', name: 'Pick Face B2', zone: 'Zone B' },
    { id: 'loc-c', name: 'Cold Store C1', zone: 'Zone C' },
    { id: 'loc-d', name: 'Goods-In Bay', zone: 'Zone A' },
  ]);

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

  /* --- Derived state ---------------------------------------------------- */
  readonly selectedItem = computed<Item | null>(
    () => this.items().find((item) => item.id === this.itemId()) ?? null,
  );

  readonly movementType = computed<MovementType | null>(() => {
    const value = this.type();
    return (MOVEMENT_TYPES as string[]).includes(value)
      ? (value as MovementType)
      : null;
  });

  /** A step is only reachable once its prerequisites are satisfied. */
  readonly activeStep = computed(() => {
    const requested = Math.min(3, Math.max(1, Number(this.step()) || 1));
    if (!this.selectedItem()) return 1;
    if (requested >= 3 && !this.movementType()) return 2;
    return requested;
  });

  readonly matches = computed<Item[]>(() => {
    const term = this.q().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (item) =>
        item.sku.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term),
    );
  });

  readonly needsFrom = computed(() => {
    const type = this.movementType();
    return type === 'OUT' || type === 'TRANSFER';
  });

  readonly needsTo = computed(() => {
    const type = this.movementType();
    return type === 'IN' || type === 'TRANSFER';
  });

  /** Per-location availability hints for the source control. */
  readonly sourceOptions = computed<StockLevelRow[]>(() =>
    this.levels().filter((row) => row.itemId === this.itemId() && row.qty > 0),
  );

  readonly available = computed(() => {
    const source = this.sourceOptions().find(
      (row) => row.locationId === this.fromLocId(),
    );
    return source?.qty ?? 0;
  });

  readonly quantity = computed(() => Number(this.qty()) || 0);

  readonly sameLocation = computed(
    () =>
      this.movementType() === 'TRANSFER' &&
      !!this.fromLocId() &&
      this.fromLocId() === this.toLocId(),
  );

  readonly locationsReady = computed(() => {
    if (this.sameLocation()) return false;
    if (this.needsFrom() && !this.fromLocId()) return false;
    if (this.needsTo() && !this.toLocId()) return false;
    return true;
  });

  /** Client-side guard; the server remains the authority on stock. */
  readonly qtyError = computed(() => {
    if (this.quantity() <= 0) {
      return 'Enter a quantity of at least 1.';
    }
    if (this.needsFrom() && this.quantity() > this.available()) {
      return `Only ${this.available()} available at ${this.locationName(this.fromLocId())}.`;
    }
    return null;
  });

  readonly canSubmit = computed(
    () => this.locationsReady() && !this.qtyError() && !this.submitting(),
  );

  locationName(id: string): string {
    return this.locations().find((loc) => loc.id === id)?.name ?? '—';
  }

  typeLabel(type: MovementType): string {
    if (type === 'IN') return 'Goods in';
    if (type === 'OUT') return 'Goods out';
    return 'Transfer';
  }

  typeHint(type: MovementType): string {
    if (type === 'IN') return 'Receive stock into a location';
    if (type === 'OUT') return 'Issue or ship stock out';
    return 'Move stock between two locations';
  }

  /* --- URL writers ------------------------------------------------------ */
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

  search(value: string): void {
    this.patchQuery({ q: value || null }, true);
  }

  chooseItem(item: Item): void {
    this.formError.set(null);
    this.patchQuery({
      itemId: item.id,
      step: '2',
      fromLocId: null,
      toLocId: null,
      qty: null,
    });
  }

  chooseType(type: MovementType): void {
    this.formError.set(null);
    this.patchQuery({ type, fromLocId: null, toLocId: null });
  }

  setFrom(value: string): void {
    this.patchQuery({ fromLocId: value || null });
  }

  setTo(value: string): void {
    this.patchQuery({ toLocId: value || null });
  }

  setQty(value: string | number): void {
    this.patchQuery({ qty: value === '' ? null : String(value) }, true);
  }

  goToStep(step: number): void {
    this.patchQuery({ step: String(step) });
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    const item = this.selectedItem();
    const type = this.movementType();
    if (!item || !type) {
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    // The service layer swaps this for POST /api/movements. A 400 from the
    // server (e.g. "Insufficient stock") sets formError and leaves the
    // reviewer on step 3 with their input intact.
    this.levels.update((rows) => this.applyMovement(rows, item, type));
    this.submitting.set(false);
    this.toast.success(
      `${type} of ${this.quantity()} ${item.unit} recorded against ${item.sku}`,
    );
    void this.router.navigate(['/items', item.id, 'levels']);
  }

  private applyMovement(
    rows: StockLevelRow[],
    item: Item,
    type: MovementType,
  ): StockLevelRow[] {
    const amount = this.quantity();
    let next = rows;
    if (type === 'OUT' || type === 'TRANSFER') {
      next = next.map((row) =>
        row.itemId === item.id && row.locationId === this.fromLocId()
          ? { ...row, qty: row.qty - amount }
          : row,
      );
    }
    if (type === 'IN' || type === 'TRANSFER') {
      const target = this.toLocId();
      const exists = next.some(
        (row) => row.itemId === item.id && row.locationId === target,
      );
      next = exists
        ? next.map((row) =>
            row.itemId === item.id && row.locationId === target
              ? { ...row, qty: row.qty + amount }
              : row,
          )
        : [
            ...next,
            {
              itemId: item.id,
              locationId: target,
              locationName: this.locationName(target),
              zone: this.locations().find((l) => l.id === target)?.zone ?? '',
              qty: amount,
            },
          ];
    }
    return next;
  }
}
