import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthResponse, Role, User } from './models';
import { readJson, readRaw, removeKeys, writeJson, writeRaw } from './storage';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export interface AuthResult {
  ok: boolean;
  message?: string;
  field?: 'email' | 'password';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.?[^\s@]*$/;

/** Untrusted-input guard for anything restored from browser storage. */
function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['email'] === 'string' &&
    (v['role'] === 'USER' || v['role'] === 'MANAGER' || v['role'] === 'ADMIN')
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly role = computed<Role>(() => this.user()?.role ?? 'USER');
  readonly isManager = computed(
    () => this.role() === 'MANAGER' || this.role() === 'ADMIN',
  );
  readonly isAdmin = computed(() => this.role() === 'ADMIN');

  constructor() {
    this.restore();
  }

  /**
   * Rehydrate the session from storage. Every failure mode — malformed JSON, a
   * stale shape, storage being unavailable — clears the offending keys and
   * leaves the app on a usable screen rather than throwing during bootstrap.
   */
  private restore(): void {
    try {
      const stored = readJson<User>(USER_KEY, isUser);
      if (stored) {
        this.user.set(stored);
        this.token.set(readRaw(TOKEN_KEY));
        return;
      }
      removeKeys(TOKEN_KEY, USER_KEY);
    } catch {
      removeKeys(TOKEN_KEY, USER_KEY);
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const shape = validateCredentials(email, password);
    if (!shape.ok) {
      return shape;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/login', { email, password }),
      );
      this.setSession(res.user, res.accessToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Invalid credentials.' };
    }
  }

  async signup(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthResult> {
    const shape = validateCredentials(email, password);
    if (!shape.ok) {
      return shape;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/signup', {
          email,
          password,
          name,
        }),
      );
      this.setSession(res.user, res.accessToken);
      return { ok: true };
    } catch {
      return {
        ok: false,
        field: 'email',
        message: 'That email address is already registered.',
      };
    }
  }

  /**
   * Preview-build-only shortcut: seeds the same signed-in state the login form
   * would, with no credentials involved. Gated on the `COLOSSUS_PREVIEW`
   * build-time constant (declared in src/preview.d.ts, folded by esbuild), so
   * this call is a no-op — and the branch is dead-code-eliminated entirely —
   * in the production bundle that actually ships.
   */
  previewSignIn(): void {
    if (COLOSSUS_PREVIEW) {
      this.setSession(
        {
          id: 'preview-user',
          email: 'reviewer@preview.local',
          name: 'Preview Reviewer',
          role: 'ADMIN',
        },
        'preview-session',
      );
    }
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  /**
   * The API rejected our token (401). Drop the session and bounce to sign-in,
   * remembering where the user was so they resume there after re-authenticating.
   * Called by the HTTP interceptor, never by a component.
   */
  expireSession(returnUrl?: string): void {
    this.clearSession();
    const target = returnUrl && !returnUrl.startsWith('/login') ? returnUrl : null;
    void this.router.navigate(
      ['/login'],
      target ? { queryParams: { returnUrl: target } } : {},
    );
  }

  private clearSession(): void {
    this.user.set(null);
    this.token.set(null);
    removeKeys(TOKEN_KEY, USER_KEY);
  }

  private setSession(user: User, token: string): void {
    this.user.set(user);
    this.token.set(token);
    writeJson(USER_KEY, user);
    writeRaw(TOKEN_KEY, token);
  }
}

function validateCredentials(email: string, password: string): AuthResult {
  if (!email.trim()) {
    return { ok: false, field: 'email', message: 'Enter your email address.' };
  }
  if (!EMAIL_RE.test(email.trim())) {
    return {
      ok: false,
      field: 'email',
      message: 'Enter a valid email address.',
    };
  }
  if (!password) {
    return { ok: false, field: 'password', message: 'Enter your password.' };
  }
  if (password.length < 8) {
    return {
      ok: false,
      field: 'password',
      message: 'Password must be at least 8 characters.',
    };
  }
  return { ok: true };
}
