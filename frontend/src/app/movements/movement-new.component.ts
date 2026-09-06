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
import { apiErrorMessage } from '../shared/api/api-client.service';
import { ItemsApi } from '../shared/api/items-api.service';
import { LocationsApi } from '../shared/api/locations-api.service';
import { MovementsApi } from '../shared/api/movements-api.service';

@Component({
  selector: 'app-movement-new',
  imports: [FormsModule, RouterLink],
  templateUrl: './movement-new.component.html',
  styleUrl: './movement-new.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementNewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly itemsApi = inject(ItemsApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly movementsApi = inject(MovementsApi);

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

  /** Catalogue for step 1's searchable picker. */
  readonly items = signal<Item[]>([]);

  /** Every storage location, for the step-2 source/destination controls. */
  readonly locations = signal<Location[]>([]);

  /** The selected item's balance per location — the availability hints. */
  readonly levels = signal<StockLevelRow[]>([]);

  ngOnInit(): void {
    void this.loadCatalogue();
  }

  constructor() {
    // The chosen item lives in ?itemId=, so its balances are re-read whenever
    // that param changes — including on a cold deep link straight into step 2.
    effect(() => {
      const itemId = this.itemId();
      if (itemId) {
        void this.loadLevels(itemId);
      } else {
        this.levels.set([]);
      }
    });
  }

  private async loadCatalogue(): Promise<void> {
    try {
      const [items, locations] = await Promise.all([
        this.itemsApi.listItems(),
        this.locationsApi.listLocations(),
      ]);
      this.items.set(items);
      this.locations.set(locations);
    } catch (error) {
      this.formError.set(
        apiErrorMessage(error, 'Could not load items and locations.'),
      );
    }
  }

  private async loadLevels(itemId: string): Promise<void> {
    try {
      this.levels.set(await this.locationsApi.listStockLevels(itemId));
    } catch {
      // Without balances the availability hint is simply absent; the server
      // still refuses any over-draw, so correctness does not depend on this.
      this.levels.set([]);
    }
  }

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

  /**
   * POST /api/movements. The server applies the balance change and writes the
   * audit row in one transaction, and it is the sole authority on stock: an
   * over-draw comes back as 400 "Insufficient stock" having written nothing,
   * which is shown as a form-level error with the user left on step 3 and
   * their input intact (it all lives in the URL).
   */
  async submit(): Promise<void> {
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

    const qty = this.quantity();
    const note = this.note().trim();

    try {
      await this.movementsApi.createMovement({
        type,
        itemId: item.id,
        qty,
        // Sent only where the type allows them — the API rejects a
        // fromLocId on an IN, and a toLocId on an OUT.
        ...(this.needsFrom() ? { fromLocId: this.fromLocId() } : {}),
        ...(this.needsTo() ? { toLocId: this.toLocId() } : {}),
        ...(note ? { note } : {}),
      });
      this.toast.success(
        `${type} of ${qty} ${item.unit} recorded against ${item.sku}`,
      );
      // The detail page re-reads from the API, so the balance shown there is
      // the committed one rather than anything predicted here.
      void this.router.navigate(['/items', item.id, 'levels']);
    } catch (error) {
      this.formError.set(
        apiErrorMessage(error, 'Could not record that movement.'),
      );
      // Re-read the balances: a rejection often means they moved underneath us.
      void this.loadLevels(item.id);
    } finally {
      this.submitting.set(false);
    }
  }
}
