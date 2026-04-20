import { describe, it, expect } from 'vitest';
import { shouldRefreshMap } from '../src/map.js';

describe('shouldRefreshMap', () => {
  const baseInput = {
    mapSchemaVersion: 1,
    expectedSchemaVersion: 1,
    mapSha: 'abc',
    headSha: 'abc',
    changedFileCount: 0,
    mapAgeDays: 1,
    forceRefresh: false,
  };

  it('does not refresh when nothing changed', () => {
    expect(shouldRefreshMap(baseInput)).toEqual({ refresh: false });
  });

  it('refreshes when force flag is set', () => {
    expect(shouldRefreshMap({ ...baseInput, forceRefresh: true })).toEqual({
      refresh: true,
      reason: 'force',
    });
  });

  it('refreshes when schema version is outdated', () => {
    expect(shouldRefreshMap({ ...baseInput, mapSchemaVersion: 0, expectedSchemaVersion: 1 })).toEqual({
      refresh: true,
      reason: 'schema',
    });
  });

  it('refreshes when SHA differs AND >= 20 files changed', () => {
    expect(shouldRefreshMap({ ...baseInput, mapSha: 'abc', headSha: 'xyz', changedFileCount: 25 })).toEqual({
      refresh: true,
      reason: 'drift',
    });
  });

  it('does not refresh when SHA differs but only 5 files changed', () => {
    expect(shouldRefreshMap({ ...baseInput, mapSha: 'abc', headSha: 'xyz', changedFileCount: 5 })).toEqual({
      refresh: false,
    });
  });

  it('refreshes when map is older than 30 days', () => {
    expect(shouldRefreshMap({ ...baseInput, mapAgeDays: 31 })).toEqual({
      refresh: true,
      reason: 'age',
    });
  });

  it('reports the strongest reason when multiple apply (force > schema > age > drift)', () => {
    const all = { ...baseInput, mapSchemaVersion: 0, mapAgeDays: 100, mapSha: 'a', headSha: 'b', changedFileCount: 100, forceRefresh: true };
    expect(shouldRefreshMap(all).reason).toBe('force');
  });
});
