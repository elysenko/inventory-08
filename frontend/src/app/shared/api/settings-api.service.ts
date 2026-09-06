import { Injectable, inject } from '@angular/core';

import { SettingEntry } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface SettingUpdate {
  key: string;
  value: string;
}

/**
 * Admin-only credential management for the backing services (PostgreSQL,
 * MinIO). Secret values arrive masked and env-provisioned keys keep winning on
 * read, so saving here never shadows platform-managed infrastructure config.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiClient);

  listSettings(): Promise<SettingEntry[]> {
    return this.api.get<SettingEntry[]>('/admin/settings');
  }

  /** Returns the full refreshed list, so callers replace rather than merge. */
  saveSettings(settings: SettingUpdate[]): Promise<SettingEntry[]> {
    return this.api.put<SettingEntry[]>('/admin/settings', { settings });
  }
}
