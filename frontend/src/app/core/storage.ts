/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin at `/<mockup_id>/` and Web Storage is
 * origin-scoped (not path-scoped), so an unprefixed `user` key collides with
 * every other mockup the reviewer has opened in the same browser. Every read
 * and write in the app goes through these helpers — never touch
 * localStorage/sessionStorage directly.
 */

/**
 * First path segment of the deployment, used as the storage namespace.
 * Under a preview build the `<base href>` is `/<mockup_id>/`, which is exactly
 * the first URL path segment the screenshot harness prefixes its seeded keys
 * with. In a production build served from the root we fall back to a constant
 * so the namespace stays stable across routes.
 */
export const STORAGE_NS: string = (() => {
  const baseHref =
    document.querySelector('base')?.getAttribute('href') ?? '/';
  const fromBase = baseHref.split('/').filter(Boolean)[0];
  if (fromBase) {
    return fromBase;
  }
  if (COLOSSUS_PREVIEW) {
    return window.location.pathname.split('/').filter(Boolean)[0] ?? 'app';
  }
  return 'app';
})();

/** `foo` -> `<mockup_id>:foo`. The colon separator is load-bearing. */
export function nsKey(key: string): string {
  return `${STORAGE_NS}:${key}`;
}

export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(nsKey(key), value);
  } catch {
    /* private mode / quota — the UI must stay usable regardless */
  }
}

export function removeKeys(...keys: string[]): void {
  try {
    for (const key of keys) {
      window.localStorage.removeItem(nsKey(key));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Parse JSON from storage defensively. Anything unrecognised — malformed JSON,
 * a value written by an older build, a shape that fails `isValid` — resolves to
 * `null` so callers can clear it and continue to a usable screen. This never
 * throws; a restore path that throws blanks the page.
 */
export function readJson<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  const raw = readRaw(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
