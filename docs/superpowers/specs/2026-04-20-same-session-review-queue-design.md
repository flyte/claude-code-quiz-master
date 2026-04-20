# Same-Session Review Queue

**Date:** 2026-04-20  
**Status:** Design approved, pending implementation

## Problem

When a user gets a question wrong, they see the ground truth in discuss mode, but there's no mechanism to verify they retained it. The answer is shown once and never revisited.

## Solution

Add a same-session review queue that resurfaces missed questions after a spacing interval, testing whether the user retained what they learned.

## Scope

- Same-session only — no cross-session persistence
- Orchestrator working memory — no helper CLI changes, no filesystem state
- Minimal SKILL.md changes — new section + loop modification

## Design

### Review Queue Structure

The orchestrator tracks an in-memory list during the quiz session:

```
reviewQueue: [
  {
    questionText: string       // exact question shown to user
    questionType: A|B|C|D
    module: string
    groundedAnswer: {
      answer: string           // prose answer from subagent
      files: string[]          // cited file paths
      lines?: number[]         // line numbers if available  
      snippet?: string         // code snippet proving the answer
    }
    missedAtIndex: number      // question # when missed
  }
]
```

Also track `currentQuestionIndex` (starts at 0, increments after each question answered).

### Adding to Queue

**When:** After grading, if:
- Verdict is `wrong` or `partial`
- Question is NOT already a review question (prevents infinite loops)
- User did NOT skip via `idk`/`skip`/`explain` (those go to discuss mode with `partial` verdict but shouldn't resurface)

**What:** Capture the question text, type, module, and the grounded answer that was used for grading.

**Where in flow:** After `state record-answer`, before continuing the loop.

### Resurfacing Logic

**Check timing:** At the start of each loop iteration, before presenting a question.

**Due condition:** Any queue item where `currentQuestionIndex - missedAtIndex >= 5`

**Selection:** If multiple items are due, pick the oldest (lowest `missedAtIndex`) — FIFO order.

**Prefetch interaction:** The existing async prefetch of the next new question continues unchanged. If a review question is due, present that instead; the prefetched question simply gets used on the following turn. No discarding.

### Presentation

- Prefix review questions with "(Review)" — e.g., "(Review) Which file defines the JWT verification function?"
- Same question text as original (identical, not rephrased)
- Same answer format expectations (MCQ, show-me, free-form)
- No re-grounding needed — use the stored grounded answer

### Grading Review Questions

**Correct:** Brief acknowledgment ("Got it this time."), record verdict as `correct`, question is done.

**Wrong or partial:**
1. Do NOT re-queue (one and done)
2. Explain the ground truth differently — rephrase the explanation, simpler language, highlight the key insight
3. Offer discuss mode: "Want to dig into this one more?"
4. Record verdict as normal (`wrong` or `partial`)

### Modified Session Loop

```
1. Load state, check map staleness, build/refresh if needed
2. Compute recent-changes pool
3. Generate Q1 + ground it (blocking)
4. Initialize: reviewQueue = [], currentQuestionIndex = 0
5. Loop until user exits:
   a. Check reviewQueue for due items (currentQuestionIndex - missedAtIndex >= 5)
   b. If due item exists:
      - Pop oldest due item from queue
      - Present with "(Review)" prefix
      - Mark this question as isReview = true
   c. Else:
      - Present the prefetched new question (or Q1 on first iteration)
      - isReview = false
   d. Dispatch next new question grounding in background
   e. Wait for user's answer
   f. Grade (MCQ via helper, show-me via helper, free-form semantically)
   g. If wrong/partial:
      - If isReview: explain differently, offer discuss, do NOT re-queue
      - Else: offer discuss as normal, add to reviewQueue
   h. Call state record-answer
   i. Increment currentQuestionIndex
   j. Loop
6. On exit: session summary, persist lastQuizSha
```

## SKILL.md Changes

1. **New section "Review queue"** after "Grading" — documents the queue structure, add/resurface logic, and "(Review)" prefix convention.

2. **Modify "Session lifecycle" step 6** — integrate the queue check and isReview flag into the loop description.

3. **Modify "Discuss mode"** — note that on second failure (review question wrong), explain differently and don't re-queue.

## Out of Scope

- Cross-session persistence of missed questions
- Rephrasing questions on resurface
- Adaptive spacing intervals
- Helper CLI changes

## Success Criteria

- Missed questions resurface after 5 new questions
- "(Review)" prefix clearly marks resurfaced questions
- Second failure triggers different explanation, not re-queuing
- Existing prefetch pattern unchanged
- No new files created, no helper modifications
