/**
 * `withComponentInputBinding` writes `undefined` into an input whenever its
 * query param is absent — including after a redirect — which overrides the
 * declared default and makes `computed()`s that call string methods throw.
 * Every URL-bound input therefore normalises its value through one of these.
 */

/** `undefined | null -> ''`, everything else stringified. */
export function queryText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Same, but substitutes `fallback` for a missing or empty param. */
export function queryDefault(fallback: string): (value: unknown) => string {
  return (value: unknown) => {
    const text = queryText(value);
    return text === '' ? fallback : text;
  };
}
