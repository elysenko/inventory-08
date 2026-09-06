import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SettingEntry } from '../common/api-types';
import {
  CONFIG_CATALOG,
  RuntimeConfigService,
  maskValue,
} from '../common/config/runtime-config.service';
import { SettingUpdateDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: RuntimeConfigService,
  ) {}

  /**
   * Every catalogued key with its effective value. Secrets are masked on the
   * way out — the settings screen shows whether a credential is present, never
   * what it is.
   */
  async list(): Promise<SettingEntry[]> {
    return Promise.all(
      CONFIG_CATALOG.map(async (descriptor) => {
        const value = await this.config.resolveConfig(descriptor.key);
        const source = await this.config.sourceOf(descriptor.key);
        return {
          service: descriptor.service,
          key: descriptor.key,
          label: descriptor.label,
          value: value === null ? '' : maskValue(value, descriptor.secret),
          configured: value !== null,
          source,
        };
      }),
    );
  }

  /**
   * Writes admin overrides to SystemSetting. Env-provisioned keys keep winning
   * on read (see RuntimeConfigService), so a saved row never silently shadows
   * platform-managed infrastructure config.
   */
  async update(updates: SettingUpdateDto[]): Promise<SettingEntry[]> {
    const known = new Set(CONFIG_CATALOG.map((entry) => entry.key));
    const unknown = updates.filter((update) => !known.has(update.key));
    if (unknown.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: [`unknown setting key(s): ${unknown.map((u) => u.key).join(', ')}`],
      });
    }

    for (const update of updates) {
      const value = update.value.trim();
      if (value === '') {
        await this.prisma.systemSetting.deleteMany({ where: { key: update.key } });
        continue;
      }
      await this.prisma.systemSetting.upsert({
        where: { key: update.key },
        update: { value },
        create: { key: update.key, value },
      });
    }

    return this.list();
  }
}
