import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Single transport for every call to the NestJS API.
 *
 * The SPA and the API share an origin in production (nginx proxies `/api/` to
 * the backend) and under `ng serve` (proxy.conf.json does the same), so a
 * relative base is correct in both and needs no build-time environment file.
 * Bearer tokens are attached by `core/auth.interceptor.ts`, not here — this
 * class stays a thin, auth-agnostic transport.
 */
export const API_BASE = '/api';

export type QueryValue = string | number | boolean | null | undefined;

/** Drops empty/absent values so `?q=` never reaches the API as a blank filter. */
function toParams(query?: Record<string, QueryValue>): HttpParams | undefined {
  if (!query) {
    return undefined;
  }
  let params = new HttpParams();
  let used = false;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    params = params.set(key, String(value));
    used = true;
  }
  return used ? params : undefined;
}

function url(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return firstValueFrom(this.http.get<T>(url(path), { params: toParams(query) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(url(path), body ?? {}));
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(url(path), body ?? {}));
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(url(path), body ?? {}));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(url(path)));
  }
}

/** HTTP status behind a failed call, or `null` if it never reached the server. */
export function apiErrorStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * Turn a Nest error body into one line a user can act on.
 *
 * Nest's ValidationPipe answers `{statusCode, error, message: string[]}` and
 * the services throw the same shape for domain refusals ("sku must be unique",
 * "Insufficient stock"), so the array branch is the common case — those strings
 * are written to be shown verbatim, including inline on the offending control.
 */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  // status 0 = the request never completed: offline, DNS, CORS, server down.
  if (error.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }

  const body: unknown = error.error;

  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }

  if (body && typeof body === 'object') {
    const message: unknown = (body as Record<string, unknown>)['message'];
    if (Array.isArray(message)) {
      const lines = message.filter((entry): entry is string => typeof entry === 'string');
      if (lines.length > 0) {
        return lines.join(' ');
      }
    }
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}
