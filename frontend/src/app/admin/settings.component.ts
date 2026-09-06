import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../core/toast.service';
import { SettingEntry } from '../core/models';

interface ServiceGroup {
  service: string;
  label: string;
  blurb: string;
  configured: boolean;
  entries: SettingEntry[];
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal<string | null>(null);

  /** GET /api/admin/settings — values arrive masked. */
  readonly settings = signal<SettingEntry[]>([
    { service: 'postgresql', key: 'DATABASE_URL', label: 'Connection URL', value: 'postgresql://stockroom:••••••••@app-db:5432/stockroom', configured: true },
    { service: 'minio', key: 'MINIO_ENDPOINT', label: 'Endpoint', value: '', configured: false },
    { service: 'minio', key: 'MINIO_ACCESS_KEY', label: 'Access key', value: '', configured: false },
    { service: 'minio', key: 'MINIO_SECRET_KEY', label: 'Secret key', value: '', configured: false },
    { service: 'minio', key: 'MINIO_BUCKET', label: 'Bucket name', value: '', configured: false },
  ]);

  /** Local edits, keyed by setting key, until the section is saved. */
  private readonly draft = signal<Record<string, string>>({});

  private readonly meta: Record<string, { label: string; blurb: string }> = {
    postgresql: {
      label: 'PostgreSQL',
      blurb: 'Primary datastore for items, locations, stock levels and the movement audit trail.',
    },
    minio: {
      label: 'MinIO object storage',
      blurb: 'Object storage for item photographs and delivery paperwork attached to movements.',
    },
  };

  readonly groups = computed<ServiceGroup[]>(() => {
    const services = [...new Set(this.settings().map((entry) => entry.service))];
    return services.map((service) => {
      const entries = this.settings().filter((entry) => entry.service === service);
      return {
        service,
        label: this.meta[service]?.label ?? service,
        blurb: this.meta[service]?.blurb ?? '',
        configured: entries.every((entry) => entry.configured),
        entries,
      };
    });
  });

  readonly unconfigured = computed(() =>
    this.groups().filter((group) => !group.configured),
  );

  valueFor(entry: SettingEntry): string {
    return this.draft()[entry.key] ?? entry.value;
  }

  patch(key: string, value: string): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  save(group: ServiceGroup): void {
    this.saving.set(group.service);
    const edits = this.draft();
    this.settings.update((rows) =>
      rows.map((row) =>
        row.service === group.service
          ? {
              ...row,
              value: edits[row.key] ?? row.value,
              configured: !!(edits[row.key] ?? row.value).trim(),
            }
          : row,
      ),
    );
    this.saving.set(null);
    this.toast.success(`${group.label} credentials saved`);
  }
}
