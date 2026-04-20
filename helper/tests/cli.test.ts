import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = ['tsx', 'src/cli.ts'];

function run(args: string[], input?: string): string {
  return execFileSync('npx', [...cli, ...args], {
    encoding: 'utf8',
    input,
  });
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qm-cli-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('cli: state', () => {
  it('init writes default state to the given path', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    expect(existsSync(path)).toBe(true);
    const s = JSON.parse(readFileSync(path, 'utf8'));
    expect(s.skillLevel).toBe('intermediate');
  });

  it('get prints state JSON to stdout', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    const out = run(['state', 'get', '--path', path]);
    const s = JSON.parse(out);
    expect(s.skillLevel).toBe('intermediate');
  });

  it('record-answer appends to rolling window', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    run(['state', 'record-answer', '--path', path, '--type', 'A', '--module', 'src/x', '--verdict', 'correct']);
    const s = JSON.parse(readFileSync(path, 'utf8'));
    expect(s.rollingWindow).toHaveLength(1);
  });

  it('set-level persists a new level', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    run(['state', 'set-level', '--path', path, '--level', 'expert']);
    const s = JSON.parse(readFileSync(path, 'utf8'));
    expect(s.skillLevel).toBe('expert');
  });

  it('set-last-sha persists a new SHA', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    run(['state', 'set-last-sha', '--path', path, '--sha', 'deadbeef']);
    const s = JSON.parse(readFileSync(path, 'utf8'));
    expect(s.lastQuizSha).toBe('deadbeef');
  });
});

describe('cli: grade', () => {
  it('mcq prints a JSON verdict', () => {
    const out = run(['grade', 'mcq', '--user-input', 'A', '--correct-letter', 'A']);
    expect(JSON.parse(out)).toEqual({ verdict: 'correct', routedToFreeForm: false });
  });

  it('show-me prints a JSON verdict', () => {
    const out = run(['grade', 'show-me', '--user-input', 'src/x.ts', '--expected-path', 'src/x.ts']);
    expect(JSON.parse(out)).toEqual({ verdict: 'correct' });
  });
});

describe('cli: map', () => {
  it('check-staleness returns refresh decision JSON', () => {
    const out = run([
      'map', 'check-staleness',
      '--map-schema-version', '1',
      '--expected-schema-version', '1',
      '--map-sha', 'a',
      '--head-sha', 'a',
      '--changed-file-count', '0',
      '--map-age-days', '1',
    ]);
    expect(JSON.parse(out)).toEqual({ refresh: false });
  });
});
