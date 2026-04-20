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
