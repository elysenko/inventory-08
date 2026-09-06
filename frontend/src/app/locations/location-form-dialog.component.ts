import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Location } from '../core/models';

export interface LocationFormValue {
  name: string;
  zone: string;
}

@Component({
  selector: 'app-location-form-dialog',
  imports: [FormsModule],
  templateUrl: './location-form-dialog.component.html',
  styleUrl: './location-form-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormDialogComponent {
  readonly location = input<Location | null>(null);
  readonly saving = input(false);
  /** API 400 (duplicate name) rendered inline on the name control. */
  readonly serverError = input<string | null>(null);

  readonly save = output<LocationFormValue>();
  readonly dismiss = output<void>();

  private readonly touched = signal(false);
  private readonly draft = signal<Partial<LocationFormValue>>({});

  /** See ItemFormDialogComponent: a latched server error must not wedge the form. */
  private readonly serverErrorDismissed = signal(false);

  constructor() {
    effect(() => {
      this.serverError();
      this.serverErrorDismissed.set(false);
    });
  }

  private readonly activeServerError = computed(() =>
    this.serverErrorDismissed() ? null : this.serverError(),
  );

  readonly isEdit = computed(() => this.location() !== null);
  readonly name = computed(() => this.draft().name ?? this.location()?.name ?? '');
  readonly zone = computed(() => this.draft().zone ?? this.location()?.zone ?? '');

  readonly nameError = computed(() => {
    const serverError = this.activeServerError();
    if (serverError) {
      return serverError;
    }
    return this.touched() && !this.name().trim() ? 'Name is required.' : null;
  });

  readonly zoneError = computed(() =>
    this.touched() && !this.zone().trim() ? 'Zone is required.' : null,
  );

  patch<K extends keyof LocationFormValue>(
    key: K,
    value: LocationFormValue[K],
  ): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
    this.serverErrorDismissed.set(true);
  }

  submit(): void {
    this.touched.set(true);
    if (!this.name().trim() || !this.zone().trim()) {
      return;
    }
    this.save.emit({ name: this.name().trim(), zone: this.zone().trim() });
  }
}
