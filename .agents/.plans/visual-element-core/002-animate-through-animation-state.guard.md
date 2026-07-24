# Guard log — 002-animate-through-animation-state

## Checkpoint 2026-07-24 — STOP review (executor run 1)

- **Snapshot**: commits `36adbca` (retained Step-2 slice), `c6b336b` (BLOCKED
  status) on `issue-449-visual-element-core`; working tree clean at review.
- **Verdict**: **ON TRACK** (executor) + **PLAN AMENDED** (guard). The STOP was
  correct, evidence-based, and exactly what the STOP-condition design exists
  for. No drift; the defect was in the guard's own revision-#1 mandate.

### What the executor did right

- Ran the mandatory Step-1 characterization baseline before touching code
  (unit 844; e2e main 195+1 skipped; animate-presence 62).
- Landed the independently-valuable slice (`36adbca`): VE as single writer for
  style MotionValues + `transformTemplate` carried on props. Guard re-verified:
  `pnpm check` 0 errors; `pnpm test:only` 844 passed; e2e spot
  (`e2e/vanilla-values e2e/motion e2e/svg`) re-run by guard.
- Hit the seed-flip failure, made ONE principled fix attempt
  (`scheduleRenderMicrotask()` per upstream `use-visual-element.ts:148`), then
  observed the live page per CLAUDE.md's failed-e2e workflow instead of
  guessing: clone at `2.36px` = 128px × scale 0.018 — `latestValues` frozen at
  the `initial` target because nothing drives it until `animateChanges()` is
  wired AND the legacy WAAPI writer is deleted.
- Reverted the unsafe change, re-verified green against baseline, marked the
  README row BLOCKED, and reported with measurements. Did not improvise around
  a guard mandate — correctly identified it as the reviewer's call.

### Classification

**Plan defect (guard's revision #1).** "Flip the seed in the same step that
makes the VE the renderer" was right as a constraint, wrong as a Step-2
mandate: Step 2 makes the VE the renderer of style MotionValues only; animated
keys become VE-driven only when `animateChanges()` runs and the legacy writer
is gone (former Steps 3+4). An intermediate seeded-but-undriven state is
unreachable-green by construction.

### PLAN AMENDED (revision #2)

- Former Steps 2/3/4 restructured: Step 2 marked landed (`36adbca`); new
  ATOMIC Step 3 = seed flip + `scheduleRenderMicrotask()` + `animateChanges()`
  wiring + legacy-writer deletion + `renderedInlineStyle` collapse (retaining
  the gesture splice, wait-mode holds, pathLength hold) in one commit, with
  the full e2e gate on that step; former Step 4 merged in.
- Executor's line-reference corrections (~+123 shift) and the `skipAnimations`
  answer (nothing to wire) recorded in the revision note.
- No done criterion was weakened; the amendment re-sequences, adds gates.
- README row 002: BLOCKED → TODO (amended, ready for re-dispatch).

## Checkpoint 2026-07-24 #2 — STOP review (executor run 2, atomic Step 3)

- **Snapshot**: working branch carries only `2efc9a2` (BLOCKED docs) since the
  last checkpoint — guard verified `git diff e4f05a4..HEAD --stat` = README
  only, `pnpm test:only` 844 passed, tree clean. The full Step-3 attempt is
  preserved off-branch at `plan002-step3-attempt` / `129a394`
  (−497/+308 lines in the container).
- **Verdict**: **ON TRACK** (executor) + **PLAN AMENDED** (guard, revision #3).
  Correct STOP on "verification fails twice"; the residual failures were
  provably outside Step 3's fixable scope.

### Findings

1. **Gate mis-scoped (plan defect)**: Step 3's gate included `e2e/variants`,
   whose subject (variant tree/stagger through the VE tree) is Step 5's work.
   Unsatisfiable by construction. Gate re-scoped in revision #3.
2. **Un-enumerated 5th writer (plan defect)**: the key-change transition
   (`runKeyTransition`) was missing from Step 3c's deletion list; its enter
   no-ops under `animateChanges` (no prop change). New sub-item 3e with the
   reset+jump mechanism.
3. **Library extension gap (plan defect)**: `'+=N'` relative keyframes are a
   svelte-motion extension with no motion-dom equivalent; the deleted
   `executeAnimation` was its only resolver. New sub-item 3f.
4. **White-box unit specs**: 6 `_MotionContainer.spec.ts` tests pin the
   mocked legacy `animate()` call counts — mechanism assertions, not
   behavior. New sub-item 3g to rewrite them.
5. **Executor quality notes**: inherited-variant fix (declarative-only
   `animate` prop + `getVariantContext(parent)`) matches upstream and
   recovered 2 failures; branch hygiene excellent (no red commit on the
   working branch, attempt preserved for cherry-pick). Disclosed process
   slip (two self-corrected file corruptions, never committed) — verified
   harmless via clean diffstat + green suite; lesson recorded in revision #3.
