# Same-Session Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-session spaced repetition to resurface missed quiz questions after 5 new questions.

**Architecture:** Pure orchestrator state — Claude tracks a review queue in working memory during the quiz session. No helper CLI changes, no persistence. Three edits to SKILL.md: new section, modified loop, modified discuss mode.

**Tech Stack:** Markdown (skill instructions)

---

## File Structure

- Modify: `skills/quiz-master/SKILL.md`
  - Add new "Review queue" section after "Grading" (around line 130)
  - Replace "Session lifecycle" step 6 loop (lines 42-54)
  - Add review-question handling to "Discuss mode" section (lines 133-142)

---

### Task 1: Add Review Queue Section

**Files:**
- Modify: `skills/quiz-master/SKILL.md:130` (after "Grading" section)

- [ ] **Step 1: Add the Review queue section after Grading**

Insert the following after line 131 (after the "For ambiguous user inputs..." paragraph in Grading):

```markdown

## Review queue

Track missed questions in working memory during the session. This is orchestrator state — not persisted, not in the helper.

**Queue structure (conceptual):**
```
reviewQueue: [
  {
    questionText: string       // exact question shown
    questionType: A|B|C|D
    module: string
    groundedAnswer: {          // from subagent grounding
      answer: string
      files: string[]
      lines?: number[]
      snippet?: string
    }
    missedAtIndex: number      // question # when missed
  }
]
currentQuestionIndex: number   // starts at 0, increments after each answer
```

**Adding to queue:** After grading, if verdict is `wrong` or `partial` AND:
- Question is NOT already a review question (prevents loops)
- User did NOT skip via `idk`/`skip`/`explain` (those shouldn't resurface)

Capture the question text, type, module, and grounded answer.

**Resurfacing:** At the start of each loop iteration, before presenting a question, check if any queue item is due: `currentQuestionIndex - missedAtIndex >= 5`. If multiple are due, pick the oldest (FIFO).

**Presenting review questions:**
- Prefix with "(Review)" — e.g., "(Review) Which file defines the JWT verification function?"
- Same question text, same answer format
- No re-grounding — use the stored grounded answer

**Grading review questions:**
- Correct: "Got it this time." Record `correct`.
- Wrong/partial: Explain ground truth differently (simpler, highlight key insight), offer discuss mode, do NOT re-queue.
```

- [ ] **Step 2: Verify the section is placed correctly**

Read `skills/quiz-master/SKILL.md` and confirm "Review queue" appears after "Grading" and before "Discuss mode".

- [ ] **Step 3: Commit**

```bash
git add skills/quiz-master/SKILL.md
git commit -m "feat(quiz): add review queue section to SKILL.md"
```

---

### Task 2: Modify Session Lifecycle Loop

**Files:**
- Modify: `skills/quiz-master/SKILL.md:42-54` (step 6 in Session lifecycle)

- [ ] **Step 1: Replace the loop in step 6**

Find the current step 6 (starts with "6. **Loop until user types..."):

```markdown
6. **Loop until user types `stop` / `done` / `exit`:**
   1. Present Q<sub>n</sub>.
   2. Immediately dispatch the Q<sub>n+1</sub> grounding subagent with `run_in_background: true`. Depth: one only.
   3. Wait for user's answer.
   4. Grade via the helper (`grade mcq` or `grade show-me`); for free-form, you grade semantically yourself and emit `correct | partial | wrong`.
   5. If wrong/partial, offer: *"Want to discuss this one?"* If yes → discuss mode. If user typed `idk` / `skip` / `explain` → enter discuss mode automatically, no penalty.
   6. Call `state record-answer --type X --module Y --verdict V` (use `partial` for skipped/discussed-without-resolution).
   7. Await Q<sub>n+1</sub> subagent (usually already done); loop.
```

Replace with:

```markdown
6. **Initialize session state:** `reviewQueue = []`, `currentQuestionIndex = 0`.
7. **Loop until user types `stop` / `done` / `exit`:**
   1. **Check review queue:** If any item has `currentQuestionIndex - missedAtIndex >= 5`, pop the oldest (FIFO) and mark `isReview = true`. Otherwise `isReview = false`.
   2. **Present question:**
      - If `isReview`: show the queued question with "(Review)" prefix.
      - Else: present the prefetched new question (or Q1 on first iteration).
   3. Dispatch next new question grounding with `run_in_background: true`. (Always prefetch — if a review question is due next turn, the prefetched question just waits.)
   4. Wait for user's answer.
   5. Grade via helper or semantically.
   6. **Handle wrong/partial:**
      - If `isReview`: explain ground truth differently (rephrase, simpler language), offer discuss mode, do NOT add back to queue.
      - Else: offer discuss as normal. If user didn't skip (`idk`/`skip`/`explain`), add to `reviewQueue` with current `questionText`, `questionType`, `module`, `groundedAnswer`, and `missedAtIndex = currentQuestionIndex`.
   7. Call `state record-answer --type X --module Y --verdict V`.
   8. If `isReview` and verdict is `correct`: brief acknowledgment — "Got it this time."
   9. Increment `currentQuestionIndex`.
   10. Loop.
```

- [ ] **Step 2: Update the subsequent step number**

The old step 7 ("On exit") becomes step 8. Find:

```markdown
7. **On exit**:
```

Replace with:

```markdown
8. **On exit**:
```

- [ ] **Step 3: Verify numbering is correct**

Read the Session lifecycle section and confirm steps are numbered 1-8 with no gaps or duplicates.

- [ ] **Step 4: Commit**

```bash
git add skills/quiz-master/SKILL.md
git commit -m "feat(quiz): integrate review queue into session loop"
```

---

### Task 3: Update Discuss Mode Section

**Files:**
- Modify: `skills/quiz-master/SKILL.md:133-142` (Discuss mode section)

- [ ] **Step 1: Add review-question handling to Discuss mode**

Find the "Discuss mode" section. After the line "No grading, no penalty. Record verdict as `partial`." add:

```markdown

**Review questions in discuss mode:** If a review question (already resurfaced once) is answered wrong/partial and the user enters discuss mode, explain the ground truth using different framing than the first time — simpler language, highlight the core insight, or approach from a different angle. Do not add the question back to the review queue; it has had its one retry.
```

- [ ] **Step 2: Verify the section reads coherently**

Read the full Discuss mode section and confirm the new paragraph fits naturally.

- [ ] **Step 3: Commit**

```bash
git add skills/quiz-master/SKILL.md
git commit -m "feat(quiz): add review-question guidance to discuss mode"
```

---

### Task 4: Final Review and Squash (Optional)

**Files:**
- Review: `skills/quiz-master/SKILL.md`

- [ ] **Step 1: Read the full SKILL.md and verify coherence**

Check that:
- Review queue section exists after Grading
- Session lifecycle has steps 1-8 with review queue logic in step 7
- Discuss mode mentions review-question handling
- No contradictions between sections

- [ ] **Step 2: Run smoke test (manual)**

If desired, run `/quiz --smoke` in a test project to verify the skill still loads and runs. (This tests parsing, not the review queue logic itself — that's orchestrator behavior.)

- [ ] **Step 3: Squash commits (optional)**

If you prefer a single commit:

```bash
git rebase -i HEAD~3
# Mark the second and third commits as "squash"
# Edit message to: "feat(quiz): add same-session review queue"
```

Or keep the atomic commits — both are fine.

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add Review queue section | `feat(quiz): add review queue section to SKILL.md` |
| 2 | Modify Session lifecycle loop | `feat(quiz): integrate review queue into session loop` |
| 3 | Update Discuss mode section | `feat(quiz): add review-question guidance to discuss mode` |
| 4 | Final review (optional squash) | — |
