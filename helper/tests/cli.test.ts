import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
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

  it('load is an alias for get', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    const out = run(['state', 'load', '--path', path]);
    expect(JSON.parse(out).skillLevel).toBe('intermediate');
  });

  it('session-summary prints summary JSON', () => {
    const path = join(dir, 'state.json');
    run(['state', 'init', '--path', path]);
    run(['state', 'record-answer', '--path', path, '--type', 'A', '--module', 'src/x', '--verdict', 'correct']);
    run(['state', 'record-answer', '--path', path, '--type', 'B', '--module', 'src/y', '--verdict', 'wrong']);
    const out = run(['state', 'session-summary', '--path', path]);
    const sum = JSON.parse(out);
    expect(sum.totalAnswered).toBe(2);
    expect(sum.verdictCounts.correct).toBe(1);
    expect(sum.verdictCounts.wrong).toBe(1);
    expect(sum.byType.A.correct).toBe(1);
    expect(sum.byType.B.wrong).toBe(1);
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

  it('check-staleness with --map-path returns {refresh, reason:"missing"} when map file absent', () => {
    const out = run([
      'map', 'check-staleness',
      '--map-path', join(dir, 'does-not-exist.json'),
      '--expected-schema-version', '1',
      '--head-sha', 'abc',
      '--changed-file-count', '0',
    ]);
    expect(JSON.parse(out)).toEqual({ refresh: true, reason: 'missing' });
  });

  it('check-staleness with --map-path reads sha + version + age from file', () => {
    const mapPath = join(dir, 'm.json');
    const mapJson = JSON.stringify({
      schemaVersion: 1,
      builtAtSha: 'sha-x',
      builtAt: '2026-04-20T10:00:00Z',
      fileCount: 0,
      modules: [],
      globalSymbols: [],
      architectureNotes: '',
    });
    run(['map', 'save', '--path', mapPath], mapJson);
    const out = run([
      'map', 'check-staleness',
      '--map-path', mapPath,
      '--expected-schema-version', '1',
      '--head-sha', 'sha-x',
      '--changed-file-count', '0',
    ]);
    expect(JSON.parse(out)).toEqual({ refresh: false });
  });

  it('check-staleness with --map-path returns {refresh, reason:"corrupt"} when map JSON invalid', () => {
    const mapPath = join(dir, 'm-bad.json');
    writeFileSync(mapPath, '{ not json');
    const out = run([
      'map', 'check-staleness',
      '--map-path', mapPath,
      '--expected-schema-version', '1',
      '--head-sha', 'abc',
      '--changed-file-count', '0',
    ]);
    expect(JSON.parse(out)).toEqual({ refresh: true, reason: 'corrupt' });
  });

  it('save writes valid map JSON from stdin to the given path', () => {
    const mapPath = join(dir, 'quiz-map.json');
    const mapJson = JSON.stringify({
      schemaVersion: 1,
      builtAtSha: 'abc',
      builtAt: '2026-04-20T10:00:00Z',
      fileCount: 1,
      modules: [{ path: 'src/x', summary: 's', keySymbols: [], entrypoints: [] }],
      globalSymbols: [],
      architectureNotes: '',
    });
    run(['map', 'save', '--path', mapPath], mapJson);
    expect(existsSync(mapPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(mapPath, 'utf8'));
    expect(parsed.modules).toHaveLength(1);
  });

  it('resolve-scope prints module list from focus arg', () => {
    const statePath = join(dir, 'state.json');
    const mapPath = join(dir, 'quiz-map.json');
    run(['state', 'init', '--path', statePath]);
    const mapJson = JSON.stringify({
      schemaVersion: 1,
      builtAtSha: 'abc',
      builtAt: '2026-04-20T10:00:00Z',
      fileCount: 0,
      modules: [
        { path: 'src/auth', summary: 'jwt', keySymbols: [], entrypoints: [] },
        { path: 'src/payments', summary: 'stripe', keySymbols: [], entrypoints: [] },
      ],
      globalSymbols: [],
      architectureNotes: '',
    });
    run(['map', 'save', '--path', mapPath], mapJson);
    const out = run(['map', 'resolve-scope', '--map-path', mapPath, '--state-path', statePath, '--focus', 'auth']);
    const r = JSON.parse(out);
    expect(r.source).toBe('focus');
    expect(r.modules.map((m: { path: string }) => m.path)).toEqual(['src/auth']);
  });
});
