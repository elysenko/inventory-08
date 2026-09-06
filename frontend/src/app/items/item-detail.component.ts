import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { ItemDetail } from '../core/models';
import { queryText } from '../core/query-params';
import { apiErrorMessage, apiErrorStatus } from '../shared/api/api-client.service';
import { ItemsApi } from '../shared/api/items-api.service';
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
  private readonly itemsApi = inject(ItemsApi);

  readonly isManager = this.auth.isManager;

  /** `:id` route param and `?modal=` query param, bound by the router. */
  readonly id = input('', { transform: queryText });
  readonly modal = input('', { transform: queryText });

  /** GET /api/items/:id — the item plus its per-location breakdown. */
  readonly item = signal<ItemDetail | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);

  constructor() {
    // The id arrives as a router-bound input, so the fetch is driven by it
    // rather than by ngOnInit — navigating between two items re-reads.
    effect(() => {
      const id = this.id();
      if (id) {
        void this.load(id);
      } else {
        this.item.set(null);
      }
    });
  }

  /**
   * A 404 is not an error banner: an unknown id means the item no longer
   * exists, which the template already renders as its own empty state.
   */
  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.item.set(await this.itemsApi.getItem(id));
    } catch (error) {
      this.item.set(null);
      if (apiErrorStatus(error) !== 404) {
        this.error.set(apiErrorMessage(error, 'Could not load that item.'));
      }
    } finally {
      this.loading.set(false);
    }
  }

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

  async save(value: ItemFormValue): Promise<void> {
    const current = this.item();
    if (!current) {
      return;
    }
    this.dialogError.set(null);
    try {
      await this.itemsApi.updateItem(current.id, value);
      this.toast.success(`${value.sku} updated`);
      this.closeModal();
      await this.load(current.id);
    } catch (error) {
      // Duplicate SKU comes back as 400 "sku must be unique" and is rendered
      // inline on the SKU control by the dialog.
      this.dialogError.set(apiErrorMessage(error, 'Could not save that item.'));
    }
  }
}
