import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState, recordAnswer } from '../src/state.js';
import { defaultState } from '../src/types.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qm-state-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadState', () => {
  it('returns defaults when file does not exist', () => {
    const state = loadState(join(dir, 'missing.json'));
    expect(state).toEqual(defaultState());
  });

  it('parses a valid state file', () => {
    const path = join(dir, 'state.json');
    copyFileSync('tests/fixtures/state-valid.json', path);
    const state = loadState(path);
    expect(state.skillLevel).toBe('expert');
    expect(state.lastQuizSha).toBe('deadbeef');
  });

  it('backs up and recovers from corrupted JSON', () => {
    const path = join(dir, 'state.json');
    copyFileSync('tests/fixtures/state-corrupt.json', path);
    const state = loadState(path);
    expect(state).toEqual(defaultState());
    expect(readdirSync(dir).some(f => /^state\.bak\.\d+\.json$/.test(f))).toBe(true);
  });

  it('backs up and recovers from schema mismatch', () => {
    const path = join(dir, 'state.json');
    writeFileSync(path, JSON.stringify({ skillLevel: 'wizard' }));
    const state = loadState(path);
    expect(state).toEqual(defaultState());
    expect(readdirSync(dir).some(f => /^state\.bak\.\d+\.json$/.test(f))).toBe(true);
  });
});

describe('saveState', () => {
  it('writes state atomically and re-reads identically', () => {
    const path = join(dir, 'state.json');
    const s = { ...defaultState(), skillLevel: 'expert' as const };
    saveState(path, s);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(s);
  });

  it('does not leave temp files behind', () => {
    const path = join(dir, 'state.json');
    saveState(path, defaultState());
    const tempPattern = /\.tmp$/;
    const files = readdirSync(dir);
    expect(files.filter((f: string) => tempPattern.test(f))).toHaveLength(0);
  });
});

describe('recordAnswer', () => {
  it('appends a new entry to the rolling window', () => {
    const s = defaultState();
    const next = recordAnswer(s, { type: 'A', module: 'src/auth', verdict: 'correct', timestamp: '2026-04-20T10:00:00Z' });
    expect(next.rollingWindow).toHaveLength(1);
    expect(next.rollingWindow[0].verdict).toBe('correct');
  });

  it('caps the rolling window at 20 entries (FIFO)', () => {
    let s = defaultState();
    for (let i = 0; i < 25; i++) {
      s = recordAnswer(s, {
        type: 'A',
        module: `mod-${i}`,
        verdict: 'correct',
        timestamp: `2026-04-20T10:${String(i).padStart(2, '0')}:00Z`,
      });
    }
    expect(s.rollingWindow).toHaveLength(20);
    expect(s.rollingWindow[0].module).toBe('mod-5');
    expect(s.rollingWindow[19].module).toBe('mod-24');
  });

  it('does not mutate the input state', () => {
    const s = defaultState();
    recordAnswer(s, { type: 'A', module: 'x', verdict: 'correct', timestamp: '2026-04-20T10:00:00Z' });
    expect(s.rollingWindow).toHaveLength(0);
  });
});
