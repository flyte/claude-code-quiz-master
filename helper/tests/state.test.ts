import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState } from '../src/state.js';
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
    expect(existsSync(join(dir, 'state.bak.json'))).toBe(true);
  });

  it('backs up and recovers from schema mismatch', () => {
    const path = join(dir, 'state.json');
    writeFileSync(path, JSON.stringify({ skillLevel: 'wizard' }));
    const state = loadState(path);
    expect(state).toEqual(defaultState());
    expect(existsSync(join(dir, 'state.bak.json'))).toBe(true);
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
