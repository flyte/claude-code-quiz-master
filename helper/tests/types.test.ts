import { describe, it, expect } from 'vitest';
import { StateSchema, MapSchema, defaultState } from '../src/types.js';

describe('StateSchema', () => {
  it('validates a complete state object', () => {
    const valid = {
      schemaVersion: 1,
      skillLevel: 'intermediate',
      lastQuizSha: 'abc123',
      rollingWindow: [
        { type: 'A', module: 'src/auth', verdict: 'correct', timestamp: '2026-04-20T10:00:00Z' },
      ],
      sessionHistory: [],
    };
    expect(StateSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid skillLevel', () => {
    const invalid = { ...defaultState(), skillLevel: 'wizard' };
    expect(() => StateSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid verdict', () => {
    const invalid = {
      ...defaultState(),
      rollingWindow: [
        { type: 'A', module: 'x', verdict: 'maybe', timestamp: '2026-04-20T10:00:00Z' },
      ],
    };
    expect(() => StateSchema.parse(invalid)).toThrow();
  });
});

describe('MapSchema', () => {
  it('validates a minimal map', () => {
    const valid = {
      schemaVersion: 1,
      builtAtSha: 'abc123',
      builtAt: '2026-04-20T10:00:00Z',
      fileCount: 0,
      modules: [],
      globalSymbols: [],
      architectureNotes: '',
    };
    expect(MapSchema.parse(valid)).toEqual(valid);
  });
});

describe('defaultState', () => {
  it('returns a valid state object', () => {
    expect(() => StateSchema.parse(defaultState())).not.toThrow();
  });

  it('defaults to intermediate skill', () => {
    expect(defaultState().skillLevel).toBe('intermediate');
  });
});
