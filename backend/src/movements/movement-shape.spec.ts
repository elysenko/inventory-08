import { validateMovementShape } from './movement-shape';

/**
 * The structural rules run before any transaction opens, so they are the
 * cheapest place to reject a malformed movement. Kept database-free on purpose.
 */
describe('validateMovementShape', () => {
  describe('IN', () => {
    it('accepts a receipt into a destination', () => {
      expect(validateMovementShape({ type: 'IN', toLocId: 'loc-a' })).toBeNull();
    });

    it('rejects a receipt with no destination', () => {
      expect(validateMovementShape({ type: 'IN' })).toMatch(/toLocId is required/);
    });

    it('rejects a receipt that also names a source', () => {
      expect(
        validateMovementShape({ type: 'IN', fromLocId: 'loc-a', toLocId: 'loc-b' }),
      ).toMatch(/fromLocId must be omitted/);
    });
  });

  describe('OUT', () => {
    it('accepts an issue from a source', () => {
      expect(validateMovementShape({ type: 'OUT', fromLocId: 'loc-a' })).toBeNull();
    });

    it('rejects an issue with no source', () => {
      expect(validateMovementShape({ type: 'OUT' })).toMatch(/fromLocId is required/);
    });

    it('rejects an issue that also names a destination', () => {
      expect(
        validateMovementShape({ type: 'OUT', fromLocId: 'a', toLocId: 'b' }),
      ).toMatch(/toLocId must be omitted/);
    });
  });

  describe('TRANSFER', () => {
    it('accepts a move between two distinct locations', () => {
      expect(
        validateMovementShape({ type: 'TRANSFER', fromLocId: 'a', toLocId: 'b' }),
      ).toBeNull();
    });

    it('rejects a half-specified move', () => {
      expect(validateMovementShape({ type: 'TRANSFER', fromLocId: 'a' })).toMatch(
        /both required/,
      );
      expect(validateMovementShape({ type: 'TRANSFER', toLocId: 'b' })).toMatch(
        /both required/,
      );
    });

    it('rejects a move onto itself, which would be a no-op audit row', () => {
      expect(
        validateMovementShape({ type: 'TRANSFER', fromLocId: 'a', toLocId: 'a' }),
      ).toMatch(/two different locations/);
    });
  });

  it('treats an empty-string location as absent, not as a location id', () => {
    expect(validateMovementShape({ type: 'IN', toLocId: '' })).toMatch(
      /toLocId is required/,
    );
  });
});
