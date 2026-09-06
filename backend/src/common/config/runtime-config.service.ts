import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { ServiceUnconfiguredError } from './service-unconfigured.error';

const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/** A credential the admin settings screen knows how to render. */
export interface ConfigDescriptor {
  service: string;
  key: string;
  label: string;
  /** Secret values are masked before they leave the process. */
  secret: boolean;
}

/**
 * Every key the settings screen groups and renders. Application-owned config
 * (DATABASE_URL, JWT_SECRET) is provisioned by the platform; third-party keys
 * are optional and degrade the owning feature when absent.
 */
export const CONFIG_CATALOG: ConfigDescriptor[] = [
  { service: 'postgresql', key: 'DATABASE_URL', label: 'Connection URL', secret: true },
  { service: 'minio', key: 'MINIO_ENDPOINT', label: 'Endpoint', secret: false },
  { service: 'minio', key: 'MINIO_ACCESS_KEY', label: 'Access key', secret: true },
  { service: 'minio', key: 'MINIO_SECRET_KEY', label: 'Secret key', secret: true },
  { service: 'minio', key: 'MINIO_BUCKET', label: 'Bucket name', secret: false },
];

/**
 * Resolves a config value: environment variable first (mounted from the
 * platform secret at deploy time), then the SystemSetting row an admin edited,
 * then null. Never throws for a missing key — callers decide whether the
 * absence is fatal for their feature.
 */
@Injectable()
export class RuntimeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveConfig(key: string): Promise<string | null> {
    const fromEnv = process.env[key];
    if (usable(fromEnv)) {
      return fromEnv as string;
    }
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return usable(row?.value) ? (row as { value: string }).value : null;
  }

  /** Source of the effective value, for the lock/edit affordance in the UI. */
  async sourceOf(key: string): Promise<'env' | 'db' | null> {
    if (usable(process.env[key])) {
      return 'env';
    }
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return usable(row?.value) ? 'db' : null;
  }

  /** Same as resolveConfig but raises the 503 contract when unset. */
  async requireConfig(service: string, key: string): Promise<string> {
    const value = await this.resolveConfig(key);
    if (value === null) {
      throw new ServiceUnconfiguredError(service, key);
    }
    return value;
  }

  async isConfigured(key: string): Promise<boolean> {
    return (await this.resolveConfig(key)) !== null;
  }
}

function usable(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim() !== '' && value !== PLACEHOLDER;
}

/**
 * Masks a value for transport. Connection URLs keep their shape (host and
 * database stay readable) with only the password blanked; everything else
 * collapses to a fixed-width dot run so nothing sensitive reaches the browser.
 */
export function maskValue(value: string, secret: boolean): string {
  if (!secret) {
    return value;
  }
  const url = value.match(/^([a-z0-9+.-]+:\/\/[^:/@]+:)([^@]*)(@.*)$/i);
  if (url) {
    return `${url[1]}••••••••${url[3]}`;
  }
  return '••••••••';
}
