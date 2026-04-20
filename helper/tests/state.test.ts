import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState, recordAnswer, applySkillDrift, summarizeSession } from '../src/state.js';
import { defaultState } from '../src/types.js';
import type { AnswerEntry } from '../src/types.js';

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

function answers(items: Array<Partial<AnswerEntry>>): AnswerEntry[] {
  return items.map((p, i) => ({
    type: p.type ?? 'A',
    module: p.module ?? 'm',
    verdict: p.verdict ?? 'correct',
    timestamp: `2026-04-20T10:${String(i).padStart(2, '0')}:00Z`,
  }));
}

describe('applySkillDrift', () => {
  it('keeps level when window is too small', () => {
    const s = { ...defaultState(), skillLevel: 'beginner' as const, rollingWindow: answers([{ verdict: 'correct' }]) };
    expect(applySkillDrift(s).skillLevel).toBe('beginner');
  });

  it('promotes beginner to intermediate when accuracy >= 80% AND >= 5 hard-type questions', () => {
    const window = answers([
      ...Array(10).fill({ type: 'A', verdict: 'correct' }),
      ...Array(6).fill({ type: 'C', verdict: 'correct' }),
      ...Array(4).fill({ type: 'A', verdict: 'wrong' }),
    ]);
    const s = { ...defaultState(), skillLevel: 'beginner' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('intermediate');
  });

  it('does not promote when accuracy is high but no hard-type questions', () => {
    const window = answers(Array(20).fill({ type: 'A', verdict: 'correct' }));
    const s = { ...defaultState(), skillLevel: 'beginner' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('beginner');
  });

  it('promotes intermediate to expert when accuracy >= 80% AND >= 5 type-D answers', () => {
    const window = answers([
      ...Array(11).fill({ type: 'B', verdict: 'correct' }),
      ...Array(5).fill({ type: 'D', verdict: 'correct' }),
      ...Array(4).fill({ type: 'B', verdict: 'wrong' }),
    ]);
    const s = { ...defaultState(), skillLevel: 'intermediate' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('expert');
  });

  it('demotes when wrong fraction >= 60%', () => {
    const window = answers([
      ...Array(8).fill({ verdict: 'correct' }),
      ...Array(12).fill({ verdict: 'wrong' }),
    ]);
    const s = { ...defaultState(), skillLevel: 'expert' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('intermediate');
  });

  it('does not demote below beginner', () => {
    const window = answers(Array(20).fill({ verdict: 'wrong' }));
    const s = { ...defaultState(), skillLevel: 'beginner' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('beginner');
  });

  it('counts partial as half-correct toward accuracy', () => {
    const window = answers([
      ...Array(10).fill({ verdict: 'partial' }),
      ...Array(10).fill({ verdict: 'wrong' }),
    ]);
    const s = { ...defaultState(), skillLevel: 'expert' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('expert');
  });
});

describe('summarizeSession', () => {
  it('returns empty-ish summary for an empty window', () => {
    const s = defaultState();
    const sum = summarizeSession(s);
    expect(sum.totalAnswered).toBe(0);
    expect(sum.score).toBe(0);
    expect(sum.accuracy).toBe(0);
    expect(sum.weakModules).toEqual([]);
    expect(sum.byType.A.total).toBe(0);
  });

  it('counts verdicts, computes weighted score and accuracy', () => {
    let s = defaultState();
    s = recordAnswer(s, { type: 'A', module: 'src/x', verdict: 'correct', timestamp: '2026-04-20T10:00:00Z' });
    s = recordAnswer(s, { type: 'B', module: 'src/y', verdict: 'partial', timestamp: '2026-04-20T10:01:00Z' });
    s = recordAnswer(s, { type: 'C', module: 'src/z', verdict: 'wrong', timestamp: '2026-04-20T10:02:00Z' });
    const sum = summarizeSession(s);
    expect(sum.totalAnswered).toBe(3);
    expect(sum.verdictCounts).toEqual({ correct: 1, partial: 1, wrong: 1 });
    expect(sum.score).toBe(1.5);
    expect(sum.accuracy).toBeCloseTo(0.5);
  });

  it('breaks down per type', () => {
    let s = defaultState();
    s = recordAnswer(s, { type: 'A', module: 'm', verdict: 'correct', timestamp: 't1' });
    s = recordAnswer(s, { type: 'A', module: 'm', verdict: 'wrong', timestamp: 't2' });
    s = recordAnswer(s, { type: 'D', module: 'm', verdict: 'correct', timestamp: 't3' });
    const sum = summarizeSession(s);
    expect(sum.byType.A).toEqual({ total: 2, correct: 1, partial: 0, wrong: 1 });
    expect(sum.byType.D).toEqual({ total: 1, correct: 1, partial: 0, wrong: 0 });
    expect(sum.byType.B.total).toBe(0);
  });

  it('identifies weak modules (>= 2 wrong) sorted by wrong count descending', () => {
    let s = defaultState();
    s = recordAnswer(s, { type: 'A', module: 'weak1', verdict: 'wrong', timestamp: 't1' });
    s = recordAnswer(s, { type: 'A', module: 'weak1', verdict: 'wrong', timestamp: 't2' });
    s = recordAnswer(s, { type: 'A', module: 'weak2', verdict: 'wrong', timestamp: 't3' });
    s = recordAnswer(s, { type: 'A', module: 'weak2', verdict: 'wrong', timestamp: 't4' });
    s = recordAnswer(s, { type: 'A', module: 'weak2', verdict: 'wrong', timestamp: 't5' });
    s = recordAnswer(s, { type: 'A', module: 'once', verdict: 'wrong', timestamp: 't6' });
    const sum = summarizeSession(s);
    expect(sum.weakModules).toEqual(['weak2', 'weak1']); // weak2 has 3 wrong, weak1 has 2, once has 1 (excluded)
  });

  it('restricts to entries after `since` timestamp when provided', () => {
    let s = defaultState();
    s = recordAnswer(s, { type: 'A', module: 'm', verdict: 'correct', timestamp: '2026-04-19T00:00:00Z' });
    s = recordAnswer(s, { type: 'A', module: 'm', verdict: 'wrong',   timestamp: '2026-04-20T00:00:00Z' });
    s = recordAnswer(s, { type: 'A', module: 'm', verdict: 'partial', timestamp: '2026-04-21T00:00:00Z' });
    const sum = summarizeSession(s, '2026-04-20T00:00:00Z');
    expect(sum.totalAnswered).toBe(2); // the 2026-04-20 and 2026-04-21 entries
    expect(sum.verdictCounts.correct).toBe(0);
  });
});
