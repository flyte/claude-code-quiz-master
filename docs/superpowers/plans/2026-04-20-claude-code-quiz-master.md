# claude-code-quiz-master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `claude-code-quiz-master` Claude Code plugin — a `/quiz` slash command + `quiz-master` skill that quizzes the user on their codebase, backed by a small Node.js helper CLI that owns the deterministic logic (state, grading, map staleness).

**Architecture:** Plugin is a flat directory holding `plugin.json`, a slash-command markdown file, a skill markdown file, and a `helper/` Node.js project. The skill drives the conversation (question generation, subagent grounding via the Task tool, async prefetch, discuss mode). The helper CLI handles state I/O, deterministic grading, map staleness checks, and git diffs — invoked by the skill via Bash. Helper ships with a committed `dist/` so end-users don't need a build step.

**Tech Stack:**
- Node.js ≥ 20 + TypeScript (strict)
- vitest for unit tests
- zod for JSON schema validation
- commander for CLI argument parsing
- tsx for dev-mode execution; tsc for production build

---

## File Structure

```
claude-code-quiz-master/
├── plugin.json                          # Plugin manifest
├── README.md                            # Install + usage
├── .gitignore
├── commands/
│   └── quiz.md                          # /quiz slash command
├── skills/
│   └── quiz-master/
│       └── SKILL.md                     # Main skill instructions
├── helper/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── cli.ts                       # CLI entry point + subcommand dispatch
│   │   ├── types.ts                     # Zod schemas for state + map
│   │   ├── state.ts                     # Load/save/recordAnswer/skill drift
│   │   ├── grader.ts                    # MCQ + show-me graders
│   │   ├── map.ts                       # Staleness decision + scope resolver
│   │   └── git.ts                       # git diff helpers
│   ├── tests/
│   │   ├── state.test.ts
│   │   ├── grader.test.ts
│   │   ├── map.test.ts
│   │   ├── git.test.ts
│   │   ├── cli.test.ts
│   │   └── fixtures/
│   │       ├── state-valid.json
│   │       ├── state-corrupt.json
│   │       └── map-sample.json
│   └── dist/                            # Built JS, committed (no end-user build)
└── docs/
    └── superpowers/
        ├── specs/2026-04-20-claude-code-quiz-master-design.md
        └── plans/2026-04-20-claude-code-quiz-master.md
```

**Each file's responsibility:**
- `plugin.json` — Claude Code plugin manifest, declares commands + skills.
- `commands/quiz.md` — Routes `/quiz` invocations to the skill.
- `skills/quiz-master/SKILL.md` — All Claude-side orchestration: question generation, subagent dispatch, prefetch, discuss mode, summary.
- `helper/src/types.ts` — Zod schemas + inferred TS types for `quiz-state.json` and `quiz-map.json`. Single source of truth for shapes.
- `helper/src/state.ts` — Pure functions over state; atomic file I/O; corruption recovery.
- `helper/src/grader.ts` — Pure grading functions (no I/O).
- `helper/src/map.ts` — Pure staleness + scope-resolution functions (no I/O beyond reading the map JSON).
- `helper/src/git.ts` — Thin wrapper around `git diff` and `git rev-parse HEAD`.
- `helper/src/cli.ts` — Commander dispatch; the only file that does process exit, stdin/stdout JSON I/O.

---

## Task 1: Bootstrap helper package

**Files:**
- Create: `helper/package.json`
- Create: `helper/tsconfig.json`
- Create: `helper/vitest.config.ts`
- Create: `helper/.gitignore`
- Create: `helper/src/cli.ts` (placeholder)
- Create: `helper/tests/sanity.test.ts`
- Create: `.gitignore` (root)

- [ ] **Step 1: Write the failing sanity test**

Create `helper/tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Create package.json**

Create `helper/package.json`:

```json
{
  "name": "claude-code-quiz-master-helper",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "quiz-helper": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `helper/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `helper/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Step 5: Create placeholder cli.ts**

Create `helper/src/cli.ts`:

```typescript
#!/usr/bin/env node
console.log('quiz-helper: not yet implemented');
process.exit(0);
```

- [ ] **Step 6: Create helper/.gitignore**

Create `helper/.gitignore`:

```
node_modules/
*.log
.DS_Store
```

(`dist/` is intentionally NOT gitignored — we ship the build.)

- [ ] **Step 7: Create root .gitignore**

Create `.gitignore` at the repo root:

```
.claude/quiz-state.json
.claude/quiz-state.bak.json
.claude/quiz-map.json
.DS_Store
*.log
```

- [ ] **Step 8: Install dependencies**

Run:
```bash
cd helper && npm install
```
Expected: `node_modules/` populated, no errors.

- [ ] **Step 9: Run the sanity test**

Run:
```bash
cd helper && npm test
```
Expected: `1 passed`.

- [ ] **Step 10: Commit**

```bash
git add .gitignore helper/
git commit -m "chore: bootstrap helper package with vitest"
```

---

## Task 2: Define zod schemas + inferred types

**Files:**
- Create: `helper/src/types.ts`
- Create: `helper/tests/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `helper/tests/types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: FAIL with module-not-found errors for `../src/types.js`.

- [ ] **Step 3: Implement types.ts**

Create `helper/src/types.ts`:

```typescript
import { z } from 'zod';

export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const QuestionTypeSchema = z.enum(['A', 'B', 'C', 'D']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const VerdictSchema = z.enum(['correct', 'partial', 'wrong']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const AnswerEntrySchema = z.object({
  type: QuestionTypeSchema,
  module: z.string(),
  verdict: VerdictSchema,
  timestamp: z.string(),
});
export type AnswerEntry = z.infer<typeof AnswerEntrySchema>;

export const SessionEntrySchema = z.object({
  startedAt: z.string(),
  endedAt: z.string(),
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
});
export type SessionEntry = z.infer<typeof SessionEntrySchema>;

export const StateSchema = z.object({
  schemaVersion: z.literal(1),
  skillLevel: SkillLevelSchema,
  lastQuizSha: z.string().nullable(),
  rollingWindow: z.array(AnswerEntrySchema).max(20),
  sessionHistory: z.array(SessionEntrySchema),
});
export type State = z.infer<typeof StateSchema>;

export const ModuleSchema = z.object({
  path: z.string(),
  summary: z.string(),
  keySymbols: z.array(z.string()),
  entrypoints: z.array(z.string()),
});
export type Module = z.infer<typeof ModuleSchema>;

export const GlobalSymbolSchema = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.enum(['function', 'class', 'const', 'type', 'other']),
  summary: z.string(),
});
export type GlobalSymbol = z.infer<typeof GlobalSymbolSchema>;

export const MapSchema = z.object({
  schemaVersion: z.literal(1),
  builtAtSha: z.string(),
  builtAt: z.string(),
  fileCount: z.number().int().nonnegative(),
  modules: z.array(ModuleSchema),
  globalSymbols: z.array(GlobalSymbolSchema),
  architectureNotes: z.string(),
});
export type CodebaseMap = z.infer<typeof MapSchema>;

export const CURRENT_STATE_SCHEMA_VERSION = 1;
export const CURRENT_MAP_SCHEMA_VERSION = 1;

export function defaultState(): State {
  return {
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    skillLevel: 'intermediate',
    lastQuizSha: null,
    rollingWindow: [],
    sessionHistory: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd helper && npm test
```
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/types.ts helper/tests/types.test.ts
git commit -m "feat(helper): add zod schemas for state and map"
```

---

## Task 3: State manager — load and save (with corruption recovery)

**Files:**
- Create: `helper/src/state.ts`
- Create: `helper/tests/state.test.ts`
- Create: `helper/tests/fixtures/state-valid.json`
- Create: `helper/tests/fixtures/state-corrupt.json`

- [ ] **Step 1: Create fixtures**

Create `helper/tests/fixtures/state-valid.json`:

```json
{
  "schemaVersion": 1,
  "skillLevel": "expert",
  "lastQuizSha": "deadbeef",
  "rollingWindow": [],
  "sessionHistory": []
}
```

Create `helper/tests/fixtures/state-corrupt.json`:

```json
{ this is not valid json
```

- [ ] **Step 2: Write the failing test**

Create `helper/tests/state.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
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
    const files = require('node:fs').readdirSync(dir);
    expect(files.filter((f: string) => tempPattern.test(f))).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: FAIL with module-not-found for `../src/state.js`.

- [ ] **Step 4: Implement state.ts (load + save only)**

Create `helper/src/state.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { State, StateSchema, defaultState } from './types.js';

export function loadState(path: string): State {
  if (!existsSync(path)) {
    return defaultState();
  }
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(path);
    return defaultState();
  }
  const result = StateSchema.safeParse(parsed);
  if (!result.success) {
    backupCorrupt(path);
    return defaultState();
  }
  return result.data;
}

export function saveState(path: string, state: State): void {
  StateSchema.parse(state); // throw on programmer error
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, path);
}

function backupCorrupt(path: string): void {
  const dir = dirname(path);
  const base = basename(path, '.json');
  const backup = join(dir, `${base}.bak.json`);
  copyFileSync(path, backup);
}
```

- [ ] **Step 5: Run tests to verify all pass**

Run:
```bash
cd helper && npm test
```
Expected: All previous tests still pass + 6 new state tests pass.

- [ ] **Step 6: Commit**

```bash
git add helper/src/state.ts helper/tests/state.test.ts helper/tests/fixtures/
git commit -m "feat(helper): state load/save with corruption recovery"
```

---

## Task 4: State manager — record answer (rolling window)

**Files:**
- Modify: `helper/src/state.ts`
- Modify: `helper/tests/state.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `helper/tests/state.test.ts`:

```typescript
import { recordAnswer } from '../src/state.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd helper && npm test
```
Expected: 3 new tests fail with `recordAnswer is not a function`.

- [ ] **Step 3: Implement recordAnswer**

Append to `helper/src/state.ts`:

```typescript
import { AnswerEntry } from './types.js';

const ROLLING_WINDOW_SIZE = 20;

export function recordAnswer(state: State, entry: AnswerEntry): State {
  const next = [...state.rollingWindow, entry];
  const trimmed = next.length > ROLLING_WINDOW_SIZE
    ? next.slice(next.length - ROLLING_WINDOW_SIZE)
    : next;
  return { ...state, rollingWindow: trimmed };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/state.ts helper/tests/state.test.ts
git commit -m "feat(helper): rolling window recordAnswer"
```

---

## Task 5: State manager — skill drift (promote/demote)

**Files:**
- Modify: `helper/src/state.ts`
- Modify: `helper/tests/state.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `helper/tests/state.test.ts`:

```typescript
import { applySkillDrift } from '../src/state.js';
import type { AnswerEntry } from '../src/types.js';

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
    // 16 correct of 20, with 6 of the correct being type C/D (hard for beginner)
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

  it('demotes when accuracy <= 40%', () => {
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
    // 10 partial + 10 wrong = 50% -> no demotion (threshold is <=40%)
    const window = answers([
      ...Array(10).fill({ verdict: 'partial' }),
      ...Array(10).fill({ verdict: 'wrong' }),
    ]);
    const s = { ...defaultState(), skillLevel: 'expert' as const, rollingWindow: window };
    expect(applySkillDrift(s).skillLevel).toBe('expert');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd helper && npm test
```
Expected: 7 new tests fail.

- [ ] **Step 3: Implement applySkillDrift**

Append to `helper/src/state.ts`:

```typescript
import { SkillLevel, QuestionType } from './types.js';

const MIN_WINDOW_FOR_DRIFT = 10;
const PROMOTE_ACCURACY = 0.8;
const DEMOTE_ACCURACY = 0.4;
const HARD_TYPE_MIN = 5;

const HARD_TYPES_FOR_LEVEL: Record<SkillLevel, QuestionType[]> = {
  beginner: ['C', 'D'],
  intermediate: ['D'],
  expert: [],
};

const NEXT_LEVEL_UP: Record<SkillLevel, SkillLevel | null> = {
  beginner: 'intermediate',
  intermediate: 'expert',
  expert: null,
};

const NEXT_LEVEL_DOWN: Record<SkillLevel, SkillLevel | null> = {
  beginner: null,
  intermediate: 'beginner',
  expert: 'intermediate',
};

export function applySkillDrift(state: State): State {
  const w = state.rollingWindow;
  if (w.length < MIN_WINDOW_FOR_DRIFT) return state;

  const score = w.reduce((acc, e) => {
    if (e.verdict === 'correct') return acc + 1;
    if (e.verdict === 'partial') return acc + 0.5;
    return acc;
  }, 0);
  const accuracy = score / w.length;

  if (accuracy >= PROMOTE_ACCURACY) {
    const hardTypes = HARD_TYPES_FOR_LEVEL[state.skillLevel];
    const hardCorrect = w.filter(e => hardTypes.includes(e.type) && e.verdict === 'correct').length;
    const next = NEXT_LEVEL_UP[state.skillLevel];
    if (next && hardCorrect >= HARD_TYPE_MIN) {
      return { ...state, skillLevel: next };
    }
  }

  if (accuracy <= DEMOTE_ACCURACY) {
    const next = NEXT_LEVEL_DOWN[state.skillLevel];
    if (next) {
      return { ...state, skillLevel: next };
    }
  }

  return state;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/state.ts helper/tests/state.test.ts
git commit -m "feat(helper): skill drift promotion and demotion logic"
```

---

## Task 6: Grader — MCQ

**Files:**
- Create: `helper/src/grader.ts`
- Create: `helper/tests/grader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `helper/tests/grader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gradeMcq } from '../src/grader.js';

describe('gradeMcq', () => {
  it('returns correct on matching letter (case-insensitive)', () => {
    expect(gradeMcq({ userInput: 'a', correctLetter: 'A' })).toEqual({
      verdict: 'correct',
      routedToFreeForm: false,
    });
    expect(gradeMcq({ userInput: 'B', correctLetter: 'B' })).toEqual({
      verdict: 'correct',
      routedToFreeForm: false,
    });
  });

  it('returns wrong on mismatching letter', () => {
    expect(gradeMcq({ userInput: 'b', correctLetter: 'A' })).toEqual({
      verdict: 'wrong',
      routedToFreeForm: false,
    });
  });

  it('routes to free-form when user picks the "type your own" option', () => {
    expect(
      gradeMcq({ userInput: 'D', correctLetter: 'A', typeYourOwnLetter: 'D' })
    ).toEqual({ verdict: null, routedToFreeForm: true });
  });

  it('treats empty input as wrong', () => {
    expect(gradeMcq({ userInput: '', correctLetter: 'A' })).toEqual({
      verdict: 'wrong',
      routedToFreeForm: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: 4 new tests fail.

- [ ] **Step 3: Implement gradeMcq**

Create `helper/src/grader.ts`:

```typescript
import { Verdict } from './types.js';

export interface McqGradeInput {
  userInput: string;
  correctLetter: string;
  typeYourOwnLetter?: string;
}

export interface McqGradeResult {
  verdict: Verdict | null;
  routedToFreeForm: boolean;
}

export function gradeMcq(input: McqGradeInput): McqGradeResult {
  const u = input.userInput.trim().toUpperCase();
  if (input.typeYourOwnLetter && u === input.typeYourOwnLetter.toUpperCase()) {
    return { verdict: null, routedToFreeForm: true };
  }
  if (u === input.correctLetter.toUpperCase()) {
    return { verdict: 'correct', routedToFreeForm: false };
  }
  return { verdict: 'wrong', routedToFreeForm: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/grader.ts helper/tests/grader.test.ts
git commit -m "feat(helper): MCQ grader"
```

---

## Task 7: Grader — show-me (path + line + snippet)

**Files:**
- Modify: `helper/src/grader.ts`
- Modify: `helper/tests/grader.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `helper/tests/grader.test.ts`:

```typescript
import { gradeShowMe } from '../src/grader.js';

describe('gradeShowMe', () => {
  it('returns correct on exact path match', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns wrong on path mismatch', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/logout.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'wrong' });
  });

  it('treats leading ./ as equivalent', () => {
    expect(gradeShowMe({
      userInput: './src/auth/login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns partial when only filename matches (not full path)', () => {
    expect(gradeShowMe({
      userInput: 'login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'partial' });
  });

  it('matches line number within ±2', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts:42',
      expectedPath: 'src/auth/login.ts',
      expectedLine: 40,
    })).toEqual({ verdict: 'correct' });
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts:46',
      expectedPath: 'src/auth/login.ts',
      expectedLine: 40,
    })).toEqual({ verdict: 'partial' });
  });

  it('matches snippet by case-insensitive substring', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts | function VerifyToken',
      expectedPath: 'src/auth/login.ts',
      expectedSnippet: 'function verifyToken',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns wrong if path correct but snippet completely missing', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts | doSomethingElse',
      expectedPath: 'src/auth/login.ts',
      expectedSnippet: 'function verifyToken',
    })).toEqual({ verdict: 'partial' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd helper && npm test
```
Expected: 7 new tests fail.

- [ ] **Step 3: Implement gradeShowMe**

Append to `helper/src/grader.ts`:

```typescript
export interface ShowMeGradeInput {
  userInput: string;
  expectedPath: string;
  expectedLine?: number;
  expectedSnippet?: string;
}

export interface ShowMeGradeResult {
  verdict: Verdict;
}

const LINE_TOLERANCE = 2;

export function gradeShowMe(input: ShowMeGradeInput): ShowMeGradeResult {
  const u = input.userInput.trim();
  const expectedPathNorm = normalizePath(input.expectedPath);

  // Try to extract `path:line` and snippet (separated by `|` or whitespace)
  const pathPart = u.split(/[|\s]/)[0] ?? '';
  const [rawPath, rawLine] = pathPart.split(':');
  const userPath = normalizePath(rawPath);
  const userLine = rawLine ? Number.parseInt(rawLine, 10) : undefined;

  const pathExact = userPath === expectedPathNorm;
  const filenameOnly = !pathExact && basename(userPath) === basename(expectedPathNorm);

  if (!pathExact && !filenameOnly) {
    return { verdict: 'wrong' };
  }

  let verdict: Verdict = pathExact ? 'correct' : 'partial';

  if (input.expectedLine !== undefined && userLine !== undefined) {
    const lineDelta = Math.abs(userLine - input.expectedLine);
    if (lineDelta > LINE_TOLERANCE) verdict = 'partial';
  }

  if (input.expectedSnippet) {
    const snippetMatches = u.toLowerCase().includes(input.expectedSnippet.toLowerCase());
    if (!snippetMatches) verdict = 'partial';
  }

  return { verdict };
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/\\/g, '/');
}

function basename(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/grader.ts helper/tests/grader.test.ts
git commit -m "feat(helper): show-me grader with path, line tolerance, snippet"
```

---

## Task 8: Map manager — staleness decision

**Files:**
- Create: `helper/src/map.ts`
- Create: `helper/tests/map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `helper/tests/map.test.ts`:

```typescript
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

  it('refreshes when SHA differs AND ≥ 20 files changed', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: 7 new tests fail.

- [ ] **Step 3: Implement shouldRefreshMap**

Create `helper/src/map.ts`:

```typescript
export interface StalenessInput {
  mapSchemaVersion: number;
  expectedSchemaVersion: number;
  mapSha: string;
  headSha: string;
  changedFileCount: number;
  mapAgeDays: number;
  forceRefresh: boolean;
}

export type RefreshReason = 'force' | 'schema' | 'age' | 'drift';

export interface StalenessResult {
  refresh: boolean;
  reason?: RefreshReason;
}

const DRIFT_FILE_THRESHOLD = 20;
const MAX_AGE_DAYS = 30;

export function shouldRefreshMap(input: StalenessInput): StalenessResult {
  if (input.forceRefresh) return { refresh: true, reason: 'force' };
  if (input.mapSchemaVersion < input.expectedSchemaVersion) {
    return { refresh: true, reason: 'schema' };
  }
  if (input.mapAgeDays > MAX_AGE_DAYS) return { refresh: true, reason: 'age' };
  if (input.mapSha !== input.headSha && input.changedFileCount >= DRIFT_FILE_THRESHOLD) {
    return { refresh: true, reason: 'drift' };
  }
  return { refresh: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/map.ts helper/tests/map.test.ts
git commit -m "feat(helper): map staleness decision"
```

---

## Task 9: Map manager — scope resolution (focus + remediation bias)

**Files:**
- Modify: `helper/src/map.ts`
- Modify: `helper/tests/map.test.ts`
- Create: `helper/tests/fixtures/map-sample.json`

- [ ] **Step 1: Create sample map fixture**

Create `helper/tests/fixtures/map-sample.json`:

```json
{
  "schemaVersion": 1,
  "builtAtSha": "abc",
  "builtAt": "2026-04-20T10:00:00Z",
  "fileCount": 12,
  "modules": [
    { "path": "src/auth", "summary": "JWT auth", "keySymbols": ["login", "verifyToken"], "entrypoints": ["src/auth/index.ts"] },
    { "path": "src/payments", "summary": "Stripe billing", "keySymbols": ["charge", "refund"], "entrypoints": ["src/payments/index.ts"] },
    { "path": "src/cache", "summary": "Redis cache", "keySymbols": ["get", "set"], "entrypoints": ["src/cache/index.ts"] }
  ],
  "globalSymbols": [],
  "architectureNotes": "auth and payments share a session middleware"
}
```

- [ ] **Step 2: Add failing tests**

Append to `helper/tests/map.test.ts`:

```typescript
import { resolveScope } from '../src/map.js';
import { readFileSync } from 'node:fs';
import type { CodebaseMap, AnswerEntry } from '../src/types.js';

const map: CodebaseMap = JSON.parse(readFileSync('tests/fixtures/map-sample.json', 'utf8'));

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
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
cd helper && npm test
```
Expected: 6 new tests fail.

- [ ] **Step 4: Implement resolveScope**

Append to `helper/src/map.ts`:

```typescript
import { CodebaseMap, Module, AnswerEntry } from './types.js';

export interface ScopeInput {
  map: CodebaseMap;
  focus: string | undefined;
  recentChangedFiles: string[];
  rollingWindow: AnswerEntry[];
}

export type ScopeSource = 'focus' | 'recent' | 'map';

export interface ScopeResult {
  modules: Module[];
  source: ScopeSource;
}

export function resolveScope(input: ScopeInput): ScopeResult {
  if (input.focus !== undefined) {
    const needle = input.focus.toLowerCase();
    const matches = input.map.modules.filter(m =>
      m.path.toLowerCase().includes(needle) || m.summary.toLowerCase().includes(needle)
    );
    return { modules: matches, source: 'focus' };
  }

  if (input.recentChangedFiles.length > 0) {
    const matches = input.map.modules.filter(m =>
      input.recentChangedFiles.some(f => f.startsWith(m.path + '/') || f === m.path)
    );
    if (matches.length > 0) return { modules: matches, source: 'recent' };
  }

  // Fall through: whole map, biased by recently-wrong modules
  const wrongModules = new Set(
    input.rollingWindow.filter(e => e.verdict === 'wrong').map(e => e.module)
  );
  const sorted = [...input.map.modules].sort((a, b) => {
    const aw = wrongModules.has(a.path) ? 1 : 0;
    const bw = wrongModules.has(b.path) ? 1 : 0;
    return bw - aw;
  });
  return { modules: sorted, source: 'map' };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add helper/src/map.ts helper/tests/map.test.ts helper/tests/fixtures/map-sample.json
git commit -m "feat(helper): scope resolution with focus and remediation bias"
```

---

## Task 10: Git helper — diff since SHA

**Files:**
- Create: `helper/src/git.ts`
- Create: `helper/tests/git.test.ts`

- [ ] **Step 1: Write the failing test**

Create `helper/tests/git.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFilesSince, getHeadSha, isGitRepo } from '../src/git.js';

let dir: string;

function git(args: string): string {
  return execSync(`git -C ${dir} ${args}`, { encoding: 'utf8' });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qm-git-'));
  git('init -q -b main');
  git('config user.email t@t');
  git('config user.name t');
  writeFileSync(join(dir, 'a.txt'), 'a');
  git('add .');
  git('commit -q -m initial');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('isGitRepo', () => {
  it('returns true inside a git repo', () => {
    expect(isGitRepo(dir)).toBe(true);
  });

  it('returns false outside a git repo', () => {
    const nonGit = mkdtempSync(join(tmpdir(), 'qm-nongit-'));
    try {
      expect(isGitRepo(nonGit)).toBe(false);
    } finally {
      rmSync(nonGit, { recursive: true, force: true });
    }
  });
});

describe('getHeadSha', () => {
  it('returns the current HEAD sha', () => {
    const sha = getHeadSha(dir);
    expect(sha).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe('changedFilesSince', () => {
  it('returns empty when nothing changed since the given sha', () => {
    const sha = getHeadSha(dir);
    expect(changedFilesSince(dir, sha)).toEqual([]);
  });

  it('returns committed file changes since the sha', () => {
    const sha = getHeadSha(dir);
    writeFileSync(join(dir, 'b.txt'), 'b');
    git('add .');
    git('commit -q -m second');
    expect(changedFilesSince(dir, sha)).toEqual(['b.txt']);
  });

  it('includes uncommitted (working tree) changes', () => {
    const sha = getHeadSha(dir);
    writeFileSync(join(dir, 'c.txt'), 'c');
    expect(changedFilesSince(dir, sha)).toContain('c.txt');
  });

  it('returns all files when sha is null', () => {
    const files = changedFilesSince(dir, null);
    expect(files).toContain('a.txt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: New git tests fail with module-not-found.

- [ ] **Step 3: Implement git.ts**

Create `helper/src/git.ts`:

```typescript
import { execFileSync } from 'node:child_process';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

export function isGitRepo(cwd: string): boolean {
  try {
    git(cwd, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

export function getHeadSha(cwd: string): string {
  return git(cwd, ['rev-parse', 'HEAD']);
}

export function changedFilesSince(cwd: string, sinceSha: string | null): string[] {
  if (sinceSha === null) {
    const tracked = git(cwd, ['ls-files']).split('\n').filter(Boolean);
    return tracked;
  }
  const committed = git(cwd, ['diff', '--name-only', `${sinceSha}..HEAD`]).split('\n').filter(Boolean);
  const unstaged = git(cwd, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  return Array.from(new Set([...committed, ...unstaged, ...untracked]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/git.ts helper/tests/git.test.ts
git commit -m "feat(helper): git diff and head-sha helpers"
```

---

## Task 11: CLI — wire all subcommands

**Files:**
- Modify: `helper/src/cli.ts`
- Create: `helper/tests/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Create `helper/tests/cli.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd helper && npm test
```
Expected: CLI tests fail.

- [ ] **Step 3: Implement cli.ts**

Replace `helper/src/cli.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, readFileSync } from 'node:fs';
import { loadState, saveState, recordAnswer, applySkillDrift } from './state.js';
import { gradeMcq, gradeShowMe } from './grader.js';
import { shouldRefreshMap, resolveScope } from './map.js';
import { isGitRepo, getHeadSha, changedFilesSince } from './git.js';
import { defaultState, AnswerEntry, QuestionType, Verdict, SkillLevel, MapSchema } from './types.js';

const program = new Command();
program.name('quiz-helper').description('Deterministic helpers for quiz-master plugin');

const state = program.command('state');

state.command('init')
  .requiredOption('--path <path>')
  .action((opts) => {
    saveState(opts.path, defaultState());
  });

state.command('get')
  .requiredOption('--path <path>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(loadState(opts.path)));
  });

state.command('record-answer')
  .requiredOption('--path <path>')
  .requiredOption('--type <type>')
  .requiredOption('--module <module>')
  .requiredOption('--verdict <verdict>')
  .action((opts) => {
    const entry: AnswerEntry = {
      type: opts.type as QuestionType,
      module: opts.module,
      verdict: opts.verdict as Verdict,
      timestamp: new Date().toISOString(),
    };
    let s = loadState(opts.path);
    s = recordAnswer(s, entry);
    s = applySkillDrift(s);
    saveState(opts.path, s);
    process.stdout.write(JSON.stringify({ skillLevel: s.skillLevel }));
  });

state.command('set-level')
  .requiredOption('--path <path>')
  .requiredOption('--level <level>')
  .action((opts) => {
    const s = loadState(opts.path);
    saveState(opts.path, { ...s, skillLevel: opts.level as SkillLevel });
  });

state.command('set-last-sha')
  .requiredOption('--path <path>')
  .requiredOption('--sha <sha>')
  .action((opts) => {
    const s = loadState(opts.path);
    saveState(opts.path, { ...s, lastQuizSha: opts.sha });
  });

const grade = program.command('grade');

grade.command('mcq')
  .requiredOption('--user-input <input>')
  .requiredOption('--correct-letter <letter>')
  .option('--type-your-own-letter <letter>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(gradeMcq({
      userInput: opts.userInput,
      correctLetter: opts.correctLetter,
      typeYourOwnLetter: opts.typeYourOwnLetter,
    })));
  });

grade.command('show-me')
  .requiredOption('--user-input <input>')
  .requiredOption('--expected-path <path>')
  .option('--expected-line <line>', undefined, parseInt)
  .option('--expected-snippet <snippet>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(gradeShowMe({
      userInput: opts.userInput,
      expectedPath: opts.expectedPath,
      expectedLine: opts.expectedLine,
      expectedSnippet: opts.expectedSnippet,
    })));
  });

const map = program.command('map');

map.command('check-staleness')
  .requiredOption('--map-schema-version <n>', undefined, parseInt)
  .requiredOption('--expected-schema-version <n>', undefined, parseInt)
  .requiredOption('--map-sha <sha>')
  .requiredOption('--head-sha <sha>')
  .requiredOption('--changed-file-count <n>', undefined, parseInt)
  .requiredOption('--map-age-days <n>', undefined, parseInt)
  .option('--force')
  .action((opts) => {
    process.stdout.write(JSON.stringify(shouldRefreshMap({
      mapSchemaVersion: opts.mapSchemaVersion,
      expectedSchemaVersion: opts.expectedSchemaVersion,
      mapSha: opts.mapSha,
      headSha: opts.headSha,
      changedFileCount: opts.changedFileCount,
      mapAgeDays: opts.mapAgeDays,
      forceRefresh: !!opts.force,
    })));
  });

map.command('save')
  .requiredOption('--path <path>')
  .action((opts) => {
    const raw = readFileSync(0, 'utf8'); // stdin
    const parsed = MapSchema.parse(JSON.parse(raw));
    writeFileSync(opts.path, JSON.stringify(parsed, null, 2));
  });

map.command('resolve-scope')
  .requiredOption('--map-path <path>')
  .requiredOption('--state-path <path>')
  .option('--focus <focus>')
  .option('--recent <files>', 'comma-separated')
  .action((opts) => {
    const map = MapSchema.parse(JSON.parse(readFileSync(opts.mapPath, 'utf8')));
    const state = loadState(opts.statePath);
    process.stdout.write(JSON.stringify(resolveScope({
      map,
      focus: opts.focus,
      recentChangedFiles: opts.recent ? opts.recent.split(',').filter(Boolean) : [],
      rollingWindow: state.rollingWindow,
    })));
  });

const git = program.command('git');

git.command('head-sha')
  .requiredOption('--cwd <cwd>')
  .action((opts) => {
    if (!isGitRepo(opts.cwd)) {
      process.stdout.write(JSON.stringify({ headSha: null, isGitRepo: false }));
      return;
    }
    process.stdout.write(JSON.stringify({ headSha: getHeadSha(opts.cwd), isGitRepo: true }));
  });

git.command('changed-since')
  .requiredOption('--cwd <cwd>')
  .option('--since <sha>')
  .action((opts) => {
    if (!isGitRepo(opts.cwd)) {
      process.stdout.write(JSON.stringify({ files: [], isGitRepo: false }));
      return;
    }
    process.stdout.write(JSON.stringify({
      files: changedFilesSince(opts.cwd, opts.since ?? null),
      isGitRepo: true,
    }));
  });

program.parseAsync().catch((err) => {
  process.stderr.write(`quiz-helper: ${err.message}\n`);
  process.exit(1);
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd helper && npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add helper/src/cli.ts helper/tests/cli.test.ts
git commit -m "feat(helper): wire commander CLI for state, grade, map, git"
```

---

## Task 12: Build + commit dist/

**Files:**
- Create: `helper/dist/*` (built JS — committed)

- [ ] **Step 1: Build the helper**

Run:
```bash
cd helper && npm run build
```
Expected: `dist/cli.js` and other compiled `.js` files appear.

- [ ] **Step 2: Verify the built CLI works**

Run:
```bash
node helper/dist/cli.js --help
```
Expected: Help text listing `state`, `grade`, `map`, `git` subcommands.

- [ ] **Step 3: Commit dist/**

```bash
git add helper/dist/
git commit -m "build(helper): commit dist/ so end-users skip the build step"
```

---

## Task 13: Plugin manifest

**Files:**
- Create: `plugin.json`

- [ ] **Step 1: Create plugin.json**

Create `plugin.json` at the repo root:

```json
{
  "name": "claude-code-quiz-master",
  "version": "0.1.0",
  "description": "Quiz the user on their own codebase to counter agentic context loss.",
  "author": "claude-code-quiz-master@failcode.co.uk",
  "commands": ["./commands/quiz.md"],
  "skills": ["./skills/quiz-master/SKILL.md"]
}
```

- [ ] **Step 2: Commit**

```bash
git add plugin.json
git commit -m "feat: add plugin manifest"
```

---

## Task 14: /quiz slash command

**Files:**
- Create: `commands/quiz.md`

- [ ] **Step 1: Create commands/quiz.md**

Create `commands/quiz.md`:

```markdown
---
description: Start an interactive codebase comprehension quiz
argument-hint: "[focus] [--level <level>] [--set-level <level>] [--refresh] [--smoke]"
---

You have been invoked via the `/quiz` slash command.

Invoke the `quiz-master` skill immediately. Pass any user arguments through to the skill.

User arguments: $ARGUMENTS
```

- [ ] **Step 2: Commit**

```bash
git add commands/quiz.md
git commit -m "feat: add /quiz slash command"
```

---

## Task 15: SKILL.md — main loop and helper invocation

**Files:**
- Create: `skills/quiz-master/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

Create `skills/quiz-master/SKILL.md`:

````markdown
---
name: quiz-master
description: Quizzes the user on their codebase to counter agentic context loss. Loads cached map, dispatches subagents to ground questions in current code, async-prefetches the next question while the user answers, grades via the deterministic helper CLI, persists adaptive skill state. Invoked by the /quiz slash command.
---

# quiz-master

You quiz the user on their own codebase. The user has explicitly opted in by running `/quiz`. Your job is to make them open files, read implementations, and reason about architecture.

## Helper CLI

All deterministic operations (state I/O, grading math, map staleness, git diff) go through the helper CLI:

```
node ${CLAUDE_PLUGIN_ROOT}/helper/dist/cli.js <subcommand> [options]
```

**Always invoke the helper for these operations — never reproduce its logic inline.** The helper is the source of truth. If you find yourself doing path normalisation, line-tolerance math, or rolling-window arithmetic in your head, stop and call the helper.

State file: `.claude/quiz-state.json` (project-relative).
Map file: `.claude/quiz-map.json` (project-relative).

## Argument parsing

User arguments are passed through from `/quiz`. Parse:

- Bare positional → focus area (e.g., `auth`).
- `--level <beginner|intermediate|expert>` → session-only override (do not call `state set-level`).
- `--set-level <level>` → call `state set-level` and exit.
- `--refresh` → force map rebuild before starting.
- `--smoke` → run smoke test (see "Smoke test" section), do not enter quiz loop.

## Session lifecycle

1. **Load state.** If the state file is missing, the helper returns defaults (intermediate); on a true first-run, briefly ask the user to confirm or pick their starting level, then `state set-level`.
2. **Check map staleness.** Get HEAD via `git head-sha --cwd .`. If non-git, no map needed (recent-changes pool will be empty). Else compare against `quiz-map.json`'s `builtAtSha`, file-change count (`git changed-since --cwd . --since <mapSha>`), and age. Call `map check-staleness` to decide.
3. **Build / refresh the map** when needed (see "Map building" below). On `--refresh`, force.
4. **Compute recent-changes pool.** `git changed-since --cwd . --since <lastQuizSha>` (or all files if no prior quiz). This pool feeds type-D questions.
5. **Generate Q1 + ground it (blocking subagent).** See "Question generation" and "Subagent grounding".
6. **Loop until user types `stop` / `done` / `exit`:**
   1. Present Q<sub>n</sub>.
   2. Immediately dispatch the Q<sub>n+1</sub> grounding subagent with `run_in_background: true`. Depth: one only.
   3. Wait for user's answer.
   4. Grade via the helper (`grade mcq` or `grade show-me`); for free-form, you grade semantically yourself and emit `correct | partial | wrong`.
   5. If wrong/partial, offer: *"Want to discuss this one?"* If yes → discuss mode. If user typed `idk` / `skip` / `explain` → enter discuss mode automatically, no penalty.
   6. Call `state record-answer --type X --module Y --verdict V` (use `partial` for skipped/discussed-without-resolution).
   7. Await Q<sub>n+1</sub> subagent (usually already done); loop.
7. **On exit**: print summary (score, type breakdown, weak areas, discussed questions). Then persist the new `lastQuizSha`: get HEAD via `git head-sha --cwd .`, then `state set-last-sha --path .claude/quiz-state.json --sha <sha>`. Skip this step in non-git directories.

## Question generation

### Type weighting (by current skill level)

| Skill level | A Location | B Behavior | C Architecture | D Recall |
|---|---|---|---|---|
| beginner | 40 | 35 | 10 | 15 |
| intermediate | 25 | 30 | 20 | 25 |
| expert | 10 | 20 | 35 | 35 |

If recent-changes pool is empty, redistribute D's weight proportionally to A/B/C.

Pick a type by weighted random.

### Scope selection

Call `map resolve-scope --map-path .claude/quiz-map.json --state-path .claude/quiz-state.json --focus <focus> --recent <comma,separated>`. Use the returned modules.

### Question phrasing

Compose a question targeting the chosen module(s) and type. Be specific — name files, function names, or behavioural conditions. Bad: *"How does auth work?"* Good: *"Which file defines the function that verifies a JWT, and what does it return on an expired token?"*

For each question, also draft the **expected ground truth** as a stub (file path, snippet hint, expected answer outline). The grounding subagent will verify and refine this.

## Subagent grounding

Dispatch a Task subagent for **every** question before showing it to the user. The subagent's job is to find the authoritative answer in the **current** code, not the cached map.

**Model selection:**
- A, B, D → Haiku (`claude-haiku-4-5-20251001`)
- C → Sonnet (`claude-sonnet-4-6`)

**Subagent prompt template:**

> You are grounding a quiz question for a user about their codebase at `${PROJECT_ROOT}`.
>
> Question: `<the question text>`
> Type: `<A|B|C|D>`
> Scope: `<module paths>`
>
> Find the authoritative answer in the current code. Open files, read implementations. Return JSON only:
>
> ```json
> {
>   "answer": "<the correct answer in plain prose>",
>   "files": ["<file paths cited>"],
>   "lines": [<line numbers, optional>],
>   "snippet": "<short code snippet that proves the answer>",
>   "confidence": "high | medium | low",
>   "unanswerable": false
> }
> ```
>
> If the question cannot be answered from the code, set `unanswerable: true` and explain in `answer`.

**Async prefetch:** Dispatch Q<sub>n+1</sub>'s subagent with `run_in_background: true` immediately after presenting Q<sub>n</sub>. Do not pre-dispatch deeper than one question ahead.

**Fallback on subagent failure / timeout:** Use the cached map plus your own best inference; mark the session log entry as `lower_confidence`.

**Subagent disagrees with map:** Trust the subagent. At session end, suggest the user run `/quiz --refresh`.

## Answer formats

- **A (Location)** → show-me. Prompt: *"Reply with the file path. Optionally include `:line` and `| <snippet>`."*
- **B (Behavior)** → MCQ with 4 options + a 5th "✏️ Type your own answer". Generate plausible distractors from the grounded answer.
- **C (Architecture)** → free-form. *"Explain in your own words."*
- **D (Recall)** → free-form.

Always include the "Type your own" escape on every MCQ. If the user picks it, route to free-form grading.

## Grading

- **MCQ**: `grade mcq --user-input <letter> --correct-letter <letter> --type-your-own-letter <letter>`. Honour the `routedToFreeForm` flag.
- **Show-me**: `grade show-me --user-input <input> --expected-path <path> [--expected-line N] [--expected-snippet "..."]`.
- **Free-form**: you grade semantically. Compare the user's answer against the grounded `answer`. Emit `correct` for substantially right, `partial` for partially right or right-but-vague, `wrong` for off-base. If you can't decide → `partial`, show the ground truth, move on.

For ambiguous user inputs (e.g., bare filename when the question wanted a full path), ask exactly **one** clarifying follow-up before grading wrong.

## Discuss mode

Entered on: wrong/partial answer (after offer accepted), explicit `idk`/`skip`/`explain`, or user typing `discuss`.

In discuss mode you:
- State the ground truth, citing files/lines from the subagent's grounding.
- Answer follow-up questions using your tools (read files, search).
- Wait for the user to type `next`, `continue`, `ok`, or otherwise signal they're ready.
- No grading, no penalty. Record verdict as `partial`.

## Map building

When the helper says refresh:

1. Walk the repo: read `package.json` / `tsconfig.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `README*` first to ID stack and entrypoints.
2. Glob top-level source dirs (`src/`, `lib/`, `app/`, `pkg/`, etc.). Sample 2-3 representative files per top-level module.
3. Compose the map JSON matching the schema (see `helper/src/types.ts MapSchema`).
4. Write via stdin: `echo '<map json>' | node ${CLAUDE_PLUGIN_ROOT}/helper/dist/cli.js map save --path .claude/quiz-map.json`.
5. If a partial map is the best you can do (e.g., file-read errors), save what you have and warn the user.

## Smoke test

`/quiz --smoke`:

1. Build a tiny scope (use `resolve-scope` with no focus).
2. Generate one question of each applicable type (skip D if no git diff or empty pool).
3. For each: ground via subagent, present, accept any answer, grade, log.
4. Print all questions + verdicts to the user. Do not write to state. Exit.

## Edge cases

- **No source files at all** — refuse: *"This repo doesn't have enough code to quiz on yet."*
- **Non-git directory** — D-type disabled; rest works.
- **State file corrupted** — helper auto-backs up and returns defaults; mention this to the user.
- **Map build fails partway** — proceed with partial map, warn, recommend `--refresh` later.
- **User runs `/quiz` mid-conversation** — start cleanly on this turn; don't interfere with anything in flight.

## Style

Be terse. Quiz questions should be one sentence each. Don't pad with encouragement — get to the next question. Show ground truth only when grading wrong/partial or in discuss mode.
````

- [ ] **Step 2: Commit**

```bash
git add skills/quiz-master/SKILL.md
git commit -m "feat: add quiz-master skill"
```

---

## Task 16: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

Create `README.md`:

````markdown
# claude-code-quiz-master

A Claude Code plugin that quizzes you on your own codebase.

Agentic coding lets you ship features without reading the code Claude writes. When Claude is unavailable, you're stranded in a codebase you don't actually understand. This plugin counters that — it quizzes you on architecture, behaviour, file locations, and what Claude just changed, forcing you to open files and read implementations.

## Install

1. Clone or copy this directory into your Claude Code plugins folder.
2. The helper CLI is shipped pre-built in `helper/dist/`. No build step required.
3. Restart Claude Code.

## Usage

```
/quiz                     # Whole-repo quiz, interactive loop
/quiz auth                # Focused on the auth module
/quiz --level expert      # Override skill level for this session
/quiz --set-level expert  # Persist new skill level
/quiz --refresh           # Rebuild the codebase map first
/quiz --smoke             # Run one question of each type, no grading
```

In a quiz session:
- Type your answer to a question.
- `idk` / `skip` / `explain` → enter discuss mode (no penalty).
- `next` / `continue` / `ok` (in discuss mode) → next question.
- `stop` / `done` / `exit` → end session, print summary.

## State

Per-project state is written to:

- `.claude/quiz-state.json` — your skill level + recent answer history.
- `.claude/quiz-map.json` — cached codebase map.

Both are gitignored by default. If you want a shared team-level skill record, remove them from `.gitignore`.

## Development

```
cd helper
npm install
npm test          # vitest unit tests
npm run build     # rebuild dist/
```
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Task 17: End-to-end manual smoke test

**Files:** none modified.

- [ ] **Step 1: Run the smoke command on this repo**

In Claude Code, run:
```
/quiz --smoke
```

Expected: plugin loads, builds the map (or uses cached if present), generates one question per applicable type (D will be skipped on the first run since `lastQuizSha` is null and there's no diff to compare against — that's fine), grounding subagents fire, questions are presented, smoke output is printed, no state writes occur.

- [ ] **Step 2: Run a real quiz**

```
/quiz
```

Expected: interactive loop starts. Answer 2-3 questions (one MCQ, one show-me, one free-form). Type `stop`. Confirm summary appears and state file is written.

- [ ] **Step 3: Note any issues**

Append any observed issues to `docs/superpowers/specs/2026-04-20-claude-code-quiz-master-design.md` under a new "## Implementation Notes" section. Common issues to watch for:
- Subagent prompts producing low-quality groundings (iterate prompt wording).
- Map build too slow / too shallow (tune sampling).
- `lastQuizSha` not being persisted (v1.1).

- [ ] **Step 4: Commit any fixes**

```bash
git add <changed files>
git commit -m "fix: <issue> from smoke test"
```

---

## Notes for the executor

- This is a greenfield repo. There are no existing patterns to match — you set them.
- The helper CLI is the only place with executable code; everything else is markdown or JSON config.
- Do not add features outside the spec. If a question comes up, ask before extending scope.
- The golden-set fuzzy-grading fixtures from the spec's testing section are deferred to a follow-up task once dogfooding has produced real questions worth fixturing.
