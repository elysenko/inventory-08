import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { ToastService } from '../core/toast.service';
import { Location } from '../core/models';
import { queryText } from '../core/query-params';
import {
  LocationFormDialogComponent,
  LocationFormValue,
} from './location-form-dialog.component';

@Component({
  selector: 'app-location-list',
  imports: [LocationFormDialogComponent],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** `?modal=create-location|edit-location` and `?id=`. */
  readonly modal = input('', { transform: queryText });
  readonly id = input('', { transform: queryText });

  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Bulk Racking A1', zone: 'Zone A' },
    { id: 'loc-b', name: 'Pick Face B2', zone: 'Zone B' },
    { id: 'loc-c', name: 'Cold Store C1', zone: 'Zone C' },
    { id: 'loc-d', name: 'Goods-In Bay', zone: 'Zone A' },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  /** Form-level error, e.g. the API refusing a delete that still holds stock. */
  readonly pageError = signal<string | null>(null);

  readonly zones = computed(() => {
    const seen = new Set(this.locations().map((loc) => loc.zone));
    return [...seen].sort();
  });

  readonly dialogOpen = computed(
    () => this.modal() === 'create-location' || this.modal() === 'edit-location',
  );

  readonly editing = computed<Location | null>(
    () => this.locations().find((loc) => loc.id === this.id()) ?? null,
  );

  readonly deleting = computed<Location | null>(() =>
    this.modal() === 'delete-location'
      ? this.locations().find((loc) => loc.id === this.id()) ?? null
      : null,
  );

  openCreate(): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: 'create-location', id: null });
  }

  openEdit(location: Location): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: 'edit-location', id: location.id });
  }

  confirmDelete(location: Location): void {
    this.pageError.set(null);
    this.patchQuery({ modal: 'delete-location', id: location.id });
  }

  closeModal(): void {
    this.dialogError.set(null);
    this.patchQuery({ modal: null, id: null });
  }

  private patchQuery(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  save(value: LocationFormValue): void {
    const editing = this.editing();
    const clash = this.locations().some(
      (loc) =>
        loc.name.toLowerCase() === value.name.trim().toLowerCase() &&
        loc.id !== editing?.id,
    );
    if (clash) {
      this.dialogError.set('A location with that name already exists.');
      return;
    }

    if (editing) {
      this.locations.update((rows) =>
        rows.map((row) => (row.id === editing.id ? { ...row, ...value } : row)),
      );
      this.toast.success(`${value.name} updated`);
    } else {
      this.locations.update((rows) => [
        ...rows,
        { id: `loc-${Date.now()}`, ...value },
      ]);
      this.toast.success(`${value.name} added`);
    }
    this.closeModal();
  }

  remove(location: Location): void {
    // The API refuses to delete a location that still holds stock or is
    // referenced by a movement; the mock mirrors that with the same message.
    if (location.id === 'loc-a' || location.id === 'loc-b') {
      this.pageError.set(
        `${location.name} still holds stock and is referenced by recorded movements, so it cannot be deleted. Move its stock elsewhere first.`,
      );
      this.closeModal();
      return;
    }
    this.locations.update((rows) => rows.filter((row) => row.id !== location.id));
    this.toast.success(`${location.name} removed`);
    this.closeModal();
  }
}
