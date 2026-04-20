import { describe, it, expect } from 'vitest';
import { shouldRefreshMap, resolveScope } from '../src/map.js';
import { readFileSync } from 'node:fs';
import type { CodebaseMap, AnswerEntry } from '../src/types.js';

const map: CodebaseMap = JSON.parse(readFileSync('tests/fixtures/map-sample.json', 'utf8'));

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

describe('resolveScope', () => {
  it('returns whole map when no focus and no recent changes', () => {
    const r = resolveScope({ map, focus: undefined, recentChangedFiles: [], rollingWindow: [] });
    expect(r.modules.map(m => m.path)).toEqual(['src/auth', 'src/payments', 'src/cache']);
    expect(r.source).toBe('map');
  });

  it('matches focus arg by substring (case-insensitive)', () => {
    const r = resolveScope({ map, focus: 'auth', recentChangedFiles: [], rollingWindow: [] });
    expect(r.modules.map(m => m.path)).toEqual(['src/auth']);
    expect(r.source).toBe('focus');
  });

  it('matches focus arg by summary substring', () => {
    const r = resolveScope({ map, focus: 'stripe', recentChangedFiles: [], rollingWindow: [] });
    expect(r.modules.map(m => m.path)).toEqual(['src/payments']);
  });

  it('returns empty when focus matches nothing', () => {
    const r = resolveScope({ map, focus: 'nonsense', recentChangedFiles: [], rollingWindow: [] });
    expect(r.modules).toHaveLength(0);
    expect(r.source).toBe('focus');
  });

  it('uses recent changes when present and no focus', () => {
    const r = resolveScope({
      map,
      focus: undefined,
      recentChangedFiles: ['src/payments/charge.ts'],
      rollingWindow: [],
    });
    expect(r.modules.map(m => m.path)).toEqual(['src/payments']);
    expect(r.source).toBe('recent');
  });

  it('biases module ordering toward recently-wrong modules', () => {
    const window: AnswerEntry[] = [
      { type: 'A', module: 'src/cache', verdict: 'wrong', timestamp: '2026-04-20T10:00:00Z' },
      { type: 'A', module: 'src/cache', verdict: 'wrong', timestamp: '2026-04-20T10:01:00Z' },
    ];
    const r = resolveScope({ map, focus: undefined, recentChangedFiles: [], rollingWindow: window });
    expect(r.modules[0].path).toBe('src/cache');
  });
});
