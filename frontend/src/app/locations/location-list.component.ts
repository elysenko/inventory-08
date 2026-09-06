import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { ToastService } from '../core/toast.service';
import { Location } from '../core/models';
import { queryText } from '../core/query-params';
import { apiErrorMessage } from '../shared/api/api-client.service';
import { LocationsApi } from '../shared/api/locations-api.service';
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
export class LocationListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly locationsApi = inject(LocationsApi);

  /** `?modal=create-location|edit-location` and `?id=`. */
  readonly modal = input('', { transform: queryText });
  readonly id = input('', { transform: queryText });

  /** GET /api/locations — readable by any signed-in user, ordered by name. */
  readonly locations = signal<Location[]>([]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  /** Form-level error, e.g. the API refusing a delete that still holds stock. */
  readonly pageError = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.locations.set(await this.locationsApi.listLocations());
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not load storage locations.'));
    } finally {
      this.loading.set(false);
    }
  }

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

  /**
   * The API owns name uniqueness — a clash comes back as 400 and is rendered
   * inline on the name control by the dialog.
   */
  async save(value: LocationFormValue): Promise<void> {
    const editing = this.editing();
    this.dialogError.set(null);
    try {
      if (editing) {
        await this.locationsApi.updateLocation(editing.id, value);
        this.toast.success(`${value.name} updated`);
      } else {
        await this.locationsApi.createLocation(value);
        this.toast.success(`${value.name} added`);
      }
      this.closeModal();
      await this.load();
    } catch (error) {
      this.dialogError.set(
        apiErrorMessage(error, 'Could not save that location.'),
      );
    }
  }

  /**
   * Refused with 400 while the location still holds stock or is referenced by
   * a recorded movement; the server's explanation is shown on the page.
   */
  async remove(location: Location): Promise<void> {
    this.pageError.set(null);
    this.closeModal();
    try {
      await this.locationsApi.deleteLocation(location.id);
      this.toast.success(`${location.name} removed`);
      await this.load();
    } catch (error) {
      this.pageError.set(
        apiErrorMessage(error, `Could not delete ${location.name}.`),
      );
    }
  }
}
