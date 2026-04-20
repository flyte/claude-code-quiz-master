# claude-code-quiz-master — Design Spec

**Date:** 2026-04-20
**Status:** Draft for review

## Problem

Agentic coding lets users ship features without reading the code Claude writes. When Claude is unavailable (outage, token limits, offline work), the user is stranded in a codebase they don't actually understand. There is no feedback loop that incentivises comprehension.

`claude-code-quiz-master` is a Claude Code plugin that quizzes the user on their own codebase — forcing them to open files, read implementations, and reason about architecture — so that comprehension keeps pace with code volume.

## Goals

1. Make it trivially easy to start a quiz session (`/quiz`).
2. Ask questions that **require** reading the repo to answer, not guessable from priors.
3. Grade honestly; never invent ground truth from a stale map.
4. Offer a discussion escape hatch so the quiz teaches, not just tests.
5. Adapt to the user's growing skill so questions stay useful, not tedious.

## Non-Goals (v1)

- No hooks, SessionStart nudges, or auto-triggers. User-initiated only.
- No per-module skill tracking (global skill level only).
- No streaks, leaderboards, or gamification.
- No team / multi-user features.
- No external LLM calls, telemetry, or network access.
- No formal spaced-repetition scheduler.
- No cross-project state.

Likely v2 candidates (noted, not built): per-area skill tracking, SRS scheduling for missed questions, shared question banks.

---

## Architecture

A Claude Code plugin with three artefacts:

- `plugin.json` — manifest
- `/quiz` slash command → invokes the `quiz-master` skill
- `quiz-master` skill — all quiz logic expressed as Claude-executed instructions (Claude uses its own tools; plugin ships no custom runtime beyond unit-tested helpers)

Two on-disk files per project (created on first use, under `.claude/`):

- `.claude/quiz-state.json` — user skill level (seed + adjusted), session history, last-quiz commit SHA, rolling answer window
- `.claude/quiz-map.json` — cached codebase map (modules, key symbols, architecture notes, build-time commit SHA)

Plugin README recommends gitignoring both (user decides).

### Components (all inside the skill)

1. **Map manager** — builds/refreshes the codebase map; checks staleness on every quiz start.
2. **Question generator** — picks question type weighted by skill level; picks scope from focus arg → recent git diff → whole map.
3. **Subagent dispatcher** — wraps the Task tool. Dispatches a cheap-model subagent (Haiku by default; Sonnet for architecture-style questions) to ground each question in the *current* code before it's asked. Supports `run_in_background: true` for prefetch.
4. **Answer interface** — renders MCQ (last option always "✏️ Type your own answer"), show-me prompts, or free-form prompts.
5. **Grader** — exact-match path + fuzzy line (±2) + substring snippet for show-me; letter compare for MCQ; semantic pass/partial/fail for free-form.
6. **Discuss mode** — entered on wrong/partial answer (after offer), explicit `explain`/`idk`/`skip` input, or `/quiz discuss`. Claude explains using repo access; user asks follow-ups; no penalty; exit on `next`/`continue`/`ok`.
7. **State manager** — reads/writes `quiz-state.json`, maintains rolling-20 answer window, applies skill-drift rules.

---

## Data Flow — One `/quiz` Session

1. User: `/quiz` (or `/quiz <focus>`, e.g. `/quiz auth`).
2. Skill loads `quiz-state.json` + `quiz-map.json`; checks map staleness → refresh if triggered (see Cache Invalidation).
3. Skill pulls `git diff <last-quiz-SHA>..HEAD` (plus uncommitted changes) → builds recent-changes pool for type-D questions.
4. Skill picks Q<sub>1</sub> type + scope; dispatches grounding subagent (blocking wait).
5. **Loop until user types `stop`/`done`/`exit`:**
   a. Present Q<sub>n</sub> to user.
   b. Immediately dispatch Q<sub>n+1</sub>-grounding subagent with `run_in_background: true` (one-ahead prefetch; no deeper).
   c. Wait for user answer.
   d. Grade Q<sub>n</sub> using the subagent's ground truth:
      - MCQ letter → compare; "Type your own" → grade as free-form.
      - Show-me → exact path match; fuzzy ±2 for line numbers; substring for snippets.
      - Free-form → Claude semantic grade with explicit pass / partial / fail verdict.
   e. If wrong or partial → Claude offers: *"Want to discuss this one?"* → if yes, enter discuss mode.
   f. If user input is `idk` / `skip` / `explain` → auto-enter discuss mode, no penalty.
   g. Append result to session log; adjust skill-drift rolling window.
   h. Await Q<sub>n+1</sub> subagent result (usually already done); loop.
6. **On exit:** print summary — session score, question-type breakdown, discussed-but-missed questions flagged for later, suggested weak areas. Save current HEAD as new `last-quiz-SHA`. Persist state.

---

## Question Types & Weighting

Four question types:

- **A — Location:** *"Which file defines the rate limiter?"* Forces file navigation.
- **B — Behavior:** *"What does `processPayment` return when the card is declined?"* Forces reading logic.
- **C — Architecture:** *"Why does the cache layer depend on the event bus?"* Forces big-picture reasoning.
- **D — Recall-after-change:** *"Claude just modified `auth.ts`. Summarise the change and why."* Ties to the "losing sight" problem. Requires recent git diff.

### Weight table (starting values — tune via playtesting)

| Skill level | A Location | B Behavior | C Architecture | D Recall (if diff) |
|---|---|---|---|---|
| Beginner | 40% | 35% | 10% | 15% |
| Intermediate | 25% | 30% | 20% | 25% |
| Expert | 10% | 20% | 35% | 35% |

When no recent diff exists, D's weight redistributes proportionally across A/B/C.

### Answer-format mapping

- **A (Location)** → show-me (paste file path, optionally line number / snippet).
- **B (Behavior)** → MCQ by default (with "Type your own" escape), occasionally free-form for multi-step answers.
- **C (Architecture)** → free-form by default (MCQ generally flattens architecture nuance).
- **D (Recall)** → free-form.

Every MCQ ends with **"✏️ Type your own answer"** as the final option; selecting it routes to the free-form grader.

---

## Skill Tracking & Drift

- State stores a rolling window of the **last 20 answers**: `{type, module, verdict, timestamp}` where verdict ∈ `correct | partial | wrong`. The `module` field is the path of the primary module the question targeted (used only for remediation bias in scope resolution — **not** for per-module skill levels, which remain a v2 non-goal).
- Discuss-mode entries and skips count as `partial` (not `wrong`) — don't punish honest "I don't know" over guessing.
- **Promote** (beginner → intermediate, intermediate → expert): rolling accuracy ≥ 80% AND at least 5 questions at the current level's harder types (C or D for beginner→int; D for int→expert).
- **Demote**: rolling accuracy ≤ 40% → drop one level.
- **Seed**: first-run interactive prompt asks user to pick starting level (default: intermediate).

### Manual overrides

- `/quiz --level expert` — forces level for current session only; doesn't mutate state.
- `/quiz --set-level expert` — persists.

---

## Map Building, Cache Invalidation, Scope Resolution

### `quiz-map.json` structure

```json
{
  "schemaVersion": 1,
  "builtAtSha": "<commit sha at build time>",
  "builtAt": "<iso timestamp>",
  "fileCount": 123,
  "modules": [
    {
      "path": "src/auth",
      "summary": "JWT auth, session refresh, role checks",
      "keySymbols": ["login", "verifyToken", "refreshSession"],
      "entrypoints": ["src/auth/index.ts"]
    }
  ],
  "globalSymbols": [
    { "name": "RateLimiter", "file": "src/middleware/ratelimit.ts", "kind": "class", "summary": "…" }
  ],
  "architectureNotes": "free-form Claude-generated summary of how modules relate"
}
```

### Build process

Claude walks the repo: reads `package.json` / `tsconfig.json` / `README*` / `pyproject.toml` / equivalents first, enumerates top-level source dirs, samples representative files per module, produces the structure above. One-shot, cached.

### Staleness & refresh triggers

Refresh if **any** of:
- Current HEAD differs from `builtAtSha` **AND** ≥ 20 files changed between them.
- Map is more than 30 days old.
- User passes `--refresh`.
- Map's `schemaVersion` < the current skill's expected version.

If refresh fails mid-way: save partial map, flag incomplete, proceed with stale map, include "map may be stale" note in session summary.

### Scope resolution per question

1. If user passed `<focus>` arg → match against `modules[].path` / `.summary` by substring; error if no match.
2. Else if recent-changes pool is non-empty **and** chosen type is D → scope = changed files.
3. Else → whole map, weighted toward modules the user answered **wrong** on in the last window (gentle remediation bias).

---

## Subagent Grounding

Every question passes through the grounding step before being shown to the user.

### Flow

```
question candidate  ──►  dispatch Task subagent  ──►  ground truth + grading hints
  (type, scope)            (Haiku by default;           (file paths, snippets,
                            Sonnet for C-type)           expected answer outline)
```

### Subagent prompt shape

*"You're grounding a quiz question for a user. Here's the candidate question and the scope. Find the authoritative answer in the current codebase — exact file paths, line numbers, snippets. Return JSON with `{answer, files, lines, snippet, confidence}`. If the question is unanswerable from the code, say so."*

### Async prefetch

While user is answering Q<sub>n</sub>, the skill dispatches Q<sub>n+1</sub>'s grounding subagent with `run_in_background: true`. Depth is **one** — Q<sub>n+2</sub> is not pre-dispatched, since the user may stop at any time and we don't want to burn tokens on questions they'll never see.

### Fallback behaviour

- Subagent fails / times out → fall back to map-only grounding for that question; flag the session log entry as `lower_confidence: true`.
- Subagent's ground truth contradicts the map (e.g., symbol moved files) → trust the subagent; at session end, nudge user to run `--refresh`.

### Model configuration

- Default: Haiku for A/B/D grounding, Sonnet for C (architecture reasoning benefits from the stronger model).
- Override via plugin config in `plugin.json` or `.claude/quiz-state.json`.

---

## Edge Cases

- **Empty repo / no source files** — `/quiz` refuses: *"not enough code to quiz on yet"*.
- **Non-git directory** — recent-changes pool is always empty; type-D questions disabled; A/B/C work normally.
- **Uncommitted changes** — included in recent-changes pool (diff against HEAD includes working tree).
- **Ambiguous user answer** (e.g., types `auth.ts` when the question wants a full path) — grader gives benefit of the doubt, asks **one** clarifying follow-up before marking wrong.
- **Grader genuinely can't decide** — marks partial, shows ground truth, moves on; doesn't count against skill drift.
- **Map build fails partway** — persist partial map, flag incomplete, warn user, proceed.
- **State file corrupted / unreadable** — back up the broken file to `quiz-state.bak.json`, regenerate fresh with defaults, warn user.
- **User runs `/quiz` mid-work** — skill acts on its own conversational turn; does not interfere with any in-flight tool calls.

---

## Security & Privacy

- No network calls.
- No telemetry.
- Subagent calls stay on the user's configured Claude Code provider — no out-of-band data flow.
- Skill reads files only inside the project root (same restrictions as Claude itself).
- README recommends gitignoring `.claude/quiz-state.json` and `.claude/quiz-map.json` (both may embed code snippets).

---

## Testing Strategy

### Deterministic unit tests

- State manager: load, save, skill promotion/demotion math, rolling-window update, corrupted-file recovery.
- Map staleness decision: (map SHA, head SHA, changed-file count, age) → refresh y/n.
- Show-me grader: exact path match, fuzzy line match (±2), substring snippet match.
- MCQ grader: letter compare, "Type your own" fallback routing.
- Scope resolver: focus arg → module match, empty recent-changes fallback.

### LLM-in-the-loop (fuzzy) tests

- **Golden-set fixtures:** small hand-curated repo + hand-written questions with expected verdicts. Run grader against the set, assert ≥ 85% verdict agreement. Manual review when thresholds slip.
- **Smoke test:** `/quiz --smoke` runs one of each applicable question type end-to-end against the current repo (D skipped in non-git / no-diff projects), no crashes, output logged for manual eyeball review.
- **Dogfooding:** run the plugin on this repo and 1–2 real projects; iterate on skill-file prompt wording.

### Test layout

- Unit tests — deferred language decision to plan time (likely TS/JS matching Claude Code plugin ecosystem, or plain JSON fixtures + a runner script).
- Fixtures checked into `tests/fixtures/`.
- No CI on day 1 — local `npm test` (or equivalent) is enough.

---

## CLI Surface Summary

| Invocation | Effect |
|---|---|
| `/quiz` | Start interactive loop, whole-repo scope. |
| `/quiz <focus>` | Start loop, scope narrowed to matching module. |
| `/quiz --level <level>` | Override skill level for this session only. |
| `/quiz --set-level <level>` | Persist new skill level. |
| `/quiz --refresh` | Force map rebuild before starting. |
| `/quiz --smoke` | Run one of each question type, log output, no grading. |
| `stop` / `done` / `exit` (mid-loop) | End session, print summary. |
| `next` / `continue` / `ok` (in discuss mode) | Exit discuss mode, next question. |
| `idk` / `skip` / `explain` (on a question) | Enter discuss mode, no penalty. |

---

## Open Questions For Implementation Plan

- Final choice of language/runtime for the deterministic helpers (TS vs plain JSON-fixture runner).
- Exact subagent prompt wording (iterate during dogfooding).
- Whether `plugin.json` needs any declared permissions beyond read/write on `.claude/`.
- Whether skill's first run should offer a short "tutorial" quiz or just start normally.
