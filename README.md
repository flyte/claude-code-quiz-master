# claude-code-quiz-master

A Claude Code plugin that quizzes you on your own codebase.

Agentic coding lets you ship features without reading the code Claude writes. When Claude is unavailable, you're stranded in a codebase you don't actually understand. This plugin counters that — it quizzes you on architecture, behaviour, file locations, and what Claude just changed, forcing you to open files and read implementations.

## Install

In Claude Code:

```
/plugin marketplace add flyte/claude-code-quiz-master
/plugin install claude-code-quiz-master@flyte
```

The helper CLI ships pre-built in `helper/dist/` — no build step required. After install, `/quiz` is available in any session.

### Local / dev install

If you've cloned the repo and want to iterate locally:

```
claude --plugin-dir /path/to/claude-code-quiz-master
```

Run `/reload-plugins` in Claude Code after edits.

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
