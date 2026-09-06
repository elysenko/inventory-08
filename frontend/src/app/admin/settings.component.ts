import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ToastService } from '../core/toast.service';
import { SettingEntry } from '../core/models';
import { apiErrorMessage } from '../shared/api/api-client.service';
import { SettingsApi } from '../shared/api/settings-api.service';

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
export class SettingsComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly settingsApi = inject(SettingsApi);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal<string | null>(null);

  /** GET /api/admin/settings — values arrive masked. */
  readonly settings = signal<SettingEntry[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.settings.set(await this.settingsApi.listSettings());
    } catch (error) {
      this.error.set(
        apiErrorMessage(error, 'Could not load the service settings.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

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

  /**
   * Saves only the keys the admin actually edited in this section. The API
   * returns the whole refreshed (re-masked) list, so we replace rather than
   * merge and the "Configured" badges reflect what the server really resolved.
   */
  async save(group: ServiceGroup): Promise<void> {
    const edits = this.draft();
    const updates = group.entries
      .filter((entry) => edits[entry.key] !== undefined)
      .map((entry) => ({ key: entry.key, value: edits[entry.key] ?? '' }));

    if (updates.length === 0) {
      this.toast.success(`${group.label} credentials unchanged`);
      return;
    }

    this.saving.set(group.service);
    try {
      this.settings.set(await this.settingsApi.saveSettings(updates));
      // Clear the saved keys so the inputs fall back to the server's masked
      // values instead of echoing the secret the admin just typed.
      this.draft.update((current) => {
        const next = { ...current };
        for (const update of updates) {
          delete next[update.key];
        }
        return next;
      });
      this.toast.success(`${group.label} credentials saved`);
    } catch (error) {
      this.toast.error(
        apiErrorMessage(error, `Could not save the ${group.label} credentials.`),
      );
    } finally {
      this.saving.set(null);
    }
  }
}
