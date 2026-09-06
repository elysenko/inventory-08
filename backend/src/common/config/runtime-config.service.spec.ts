import { maskValue } from './runtime-config.service';

describe('maskValue', () => {
  it('leaves non-secret values readable', () => {
    expect(maskValue('stockroom-media', false)).toBe('stockroom-media');
  });

  it('blanks only the password inside a connection URL', () => {
    expect(maskValue('postgresql://app:hunter2@db:5432/stockroom', true)).toBe(
      'postgresql://app:••••••••@db:5432/stockroom',
    );
  });

  it('collapses an opaque secret to a fixed-width run, leaking no length', () => {
    expect(maskValue('sk-short', true)).toBe('••••••••');
    expect(maskValue('sk-considerably-longer-key-value', true)).toBe('••••••••');
  });
});
