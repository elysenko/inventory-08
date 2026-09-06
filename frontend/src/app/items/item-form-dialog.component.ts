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

import { Item } from '../core/models';

export interface ItemFormValue {
  sku: string;
  name: string;
  description: string;
  unit: string;
  reorderAt: number;
}

@Component({
  selector: 'app-item-form-dialog',
  imports: [FormsModule],
  templateUrl: './item-form-dialog.component.html',
  styleUrl: './item-form-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormDialogComponent {
  /** `null` = create mode; an item = edit mode. */
  readonly item = input<Item | null>(null);
  readonly saving = input(false);
  /** API validation message, rendered inline on the offending control. */
  readonly serverError = input<string | null>(null);

  readonly save = output<ItemFormValue>();
  readonly dismiss = output<void>();

  private readonly touched = signal(false);
  private readonly draft = signal<Partial<ItemFormValue>>({});

  /**
   * A server rejection ("sku must be unique") is latched onto the field until
   * the user edits the form again. Without this the stale message keeps
   * `skuError()` truthy, `submit()` returns early forever and the dialog can
   * never be resubmitted — even with a corrected SKU.
   */
  private readonly serverErrorDismissed = signal(false);

  constructor() {
    // Each fresh rejection re-arms the inline message.
    effect(() => {
      this.serverError();
      this.serverErrorDismissed.set(false);
    });
  }

  /** The server error, unless the user has since edited the form. */
  private readonly activeServerError = computed(() =>
    this.serverErrorDismissed() ? null : this.serverError(),
  );

  readonly isEdit = computed(() => this.item() !== null);

  readonly sku = computed(() => this.draft().sku ?? this.item()?.sku ?? '');
  readonly name = computed(() => this.draft().name ?? this.item()?.name ?? '');
  readonly description = computed(
    () => this.draft().description ?? this.item()?.description ?? '',
  );
  readonly unit = computed(() => this.draft().unit ?? this.item()?.unit ?? 'ea');
  readonly reorderAt = computed(
    () => this.draft().reorderAt ?? this.item()?.reorderAt ?? 0,
  );

  readonly skuError = computed(() => {
    if (this.activeServerError()?.includes('sku')) {
      return 'That SKU is already in use.';
    }
    if (!this.touched()) {
      return null;
    }
    if (!this.sku().trim()) {
      return 'SKU is required.';
    }
    if (!/^[A-Za-z0-9-]+$/.test(this.sku().trim())) {
      return 'Use letters, numbers and hyphens only.';
    }
    return null;
  });

  readonly nameError = computed(() =>
    this.touched() && !this.name().trim() ? 'Name is required.' : null,
  );

  readonly unitError = computed(() =>
    this.touched() && !this.unit().trim()
      ? 'Unit is required (ea, box, roll…).'
      : null,
  );

  patch<K extends keyof ItemFormValue>(key: K, value: ItemFormValue[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
    this.serverErrorDismissed.set(true);
  }

  submit(): void {
    this.touched.set(true);
    if (this.skuError() || this.nameError() || this.unitError()) {
      return;
    }
    this.save.emit({
      sku: this.sku().trim(),
      name: this.name().trim(),
      description: this.description().trim(),
      unit: this.unit().trim(),
      reorderAt: Math.max(0, Number(this.reorderAt()) || 0),
    });
  }
}
