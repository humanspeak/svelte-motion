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

## Checkpoint 2026-07-24 #3 — landing ruling (executor run 3, Step 3 complete)

- **Snapshot**: working branch carries only `7cce600` (docs) since `37e59a0`;
  guard verified tree clean + docs-only diff. Full Step 3 (incl. sub-items
  3e/3f/3g) preserved at `plan002-step3-attempt` / `e4fe515`
  (+522/−565, net −43 lines).
- **Executor verdict**: **ON TRACK** — gate 157/159; the 2 failures are one
  root cause (wait-mode key-change exit coordination) that the plan's
  Out-of-scope section assigns to plan 004. Correct STOP rather than
  improvising past the boundary.
- **Guard ruling: ACCEPT-AND-LAND** (`PLAN AMENDED`, revision #4). Folding the
  exit half into 002 would execute plan 004's core ad hoc; instead the two
  specs become documented known-failures excluded BY NAME from 002's gates,
  owned by 004's done criteria, and 004 is re-ordered before 003 to minimize
  the known-red window. No other criterion weakened; the batch-level bar
  (those specs pass before the batch completes) is unchanged.
- **Correction to checkpoint #2's review**: the `renderedInlineStyle` collapse
  approved there was correct in intent but carried a reactivity bug the
  executor found and fixed itself — a `$derived` slot over mutable
  `latestValues` computes once and freezes at the seed. The slot must be a
  plain function (never memoized). Recorded as a constraint in revision #4.
- Landing + Steps 5–8 delegated back to the executor under revision #4;
  guard verifies the landed state at the next checkpoint.

## Checkpoint 2026-07-24 #4 — STOP review (executor run 4, Steps 3 landed + 5 partial)

- **Snapshot**: `dc2d197` (Step 3, guard-accepted), `91d31d9` (Step 5 partial),
  `bc2c5be` (docs) on the working branch; tree clean; guard re-ran
  `pnpm test:only` → 844 passed.
- **Verdict**: **ON TRACK** (executor) + **PLAN AMENDED** (guard, revision #5).
  The material finding is a GUARD DEFECT: the revision-#3/#4 Step-3 gate
  omitted `e2e/utilities` (which the original Step-8 gate included), masking
  3 real Step-3 regressions (reduced-motion policy ×2, transformTemplate
  removal ×1). The executor found this adversarially — stashing its Step-5
  work and re-running utilities at exactly `dc2d197` (7 failures there).
  Checkpoint #3's ACCEPT ruling stands, but its gate basis was too narrow;
  the acceptance is repaired by revision #5's Step 3h completion items rather
  than reverted (the landed swap is still strictly closer to done and the
  regressions are enumerated, owned, and gated).
- **Step 5 partial accepted**: strictly-better-by-every-suite, labelled, with
  the load-bearing props-vs-context inheritance model and the
  never-skip-first-`animateChanges` constraint recorded in revision #5.
- Current full-suite state: 280 passed / 7 failed = 2 documented 004
  exclusions + 3 Step-3h items + 1 Step-5 remainder (stagger-interrupt) +
  1 Step-7 subject (controls re-attach).

## Checkpoint 2026-07-24 #5 — STOP review (executor run 5, 3h partial + Step 5 done)

- **Snapshot**: `6bda8bc`, `b14859d`, `6193fb3` since last checkpoint; tree
  clean; guard re-ran unit suite (844 passed) and reproduced the single real
  e2e failure in isolation.
- **Verdict**: **ON TRACK** (executor) + **PLAN AMENDED** (guard, revision #6).
  Full-suite 283/287: only the two 004 exclusions, the named Step-7
  allowance, and one real failure remain. Step 5 is DONE (7/7 variants,
  stagger-interrupt fixed by the per-commit microtask flush).
- **Guard investigation of `policy='always'`**: the executor's remount
  hypothesis was WRONG (the page defaults to `always`, so `.check()` is a
  no-op and `{#key}` never fires) — but its refusal to modify the spec was
  right. Guard reproduced: assertion read opacity **0.0198** AFTER the wait
  helper (which requires > 0.99) returned — the fade completes then RE-RUNS.
  Real behavioral bug (double-fade flash), spec correct. Prime suspect: the
  one-shot post-mount policy strip. Recorded in revision #6 with fix
  directions and a 3-consecutive-run verify.
- **Step 6 SKIPPED by guard ruling** (executor's recommendation accepted):
  `e2e/svg` is fully green; migration is churn with no observable gain.
  Becomes a follow-up issue at batch close-out.
- **Constraints recorded**: per-commit flush must be
  `scheduleRenderMicrotask()` (frameloop variant provably leaves renderState
  stale when idle); controls flush-guard removal is part of Step 7's commit.
- Notable executor quality: bisected the flush regression on the controls
  path (12/13 → 9/13) instead of shipping it guarded-by-luck; disclosed an
  unproven hypothesis as unproven.
