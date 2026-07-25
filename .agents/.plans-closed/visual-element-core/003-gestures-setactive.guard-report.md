# Guard report — 003 gestures-setactive

**Recommendation: PASS** — gestures are event wiring flipping
`animationState.setActive`; the coordinator layer and per-gesture animation
stacks are deleted, and velocity handoff is structural, not hand-tuned.
**Reviewed at** `5470b80` · 2026-07-25 00:04 · **Plan planned at** `7eba0bd`
**Integrated** — no PR by operator policy (live-demo sign-off precedes any
push/PR); publication deferred to batch close-out.

## Done criteria

| Criterion                                                                              | Result | Evidence (guard-reproduced)                                                                                                                           |
| -------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                                                                   | met    | `1052 FILES 0 ERRORS 33 WARNINGS`                                                                                                                     |
| `trunk check` no new issues                                                            | met    | pre-commit hooks green on both commits                                                                                                                |
| `pnpm test:only` exits 0                                                               | met    | 813 passed / 69 files (851 → 813: specs deleted WITH their subjects — reviewed decision, replacement coverage audited below)                          |
| `pnpm test:e2e e2e/motion e2e/armed-buttons e2e/variants e2e/drag e2e/reorder` exits 0 | met    | Guard re-run: **162 passed, 2 skipped, 0 failed** — both hard-bar handoff specs (`hover-tap-multichannel-handoff`, `hover-velocity-continuity`) green |
| `gestureCoordinator.ts`, `interaction.ts`, `focus.ts` no longer exist                  | met    | `ls` → No such file ×3                                                                                                                                |
| `useInView` hook still exported and covered                                            | met    | exported from `index.ts`; 13 tests remain in `inView.svelte.spec.ts`                                                                                  |
| `setActive` covers all four types in `gestures.ts`                                     | met    | grep: whileHover, whileTap, whileFocus, whileInView                                                                                                   |
| No files outside in-scope list                                                         | met    | diff confined to gesture files + container + specs + plan docs; `transformComposer.ts` correctly retained (drag imports it)                           |
| README status row updated                                                              | met    | 003 → DONE (`5470b80`)                                                                                                                                |

Executor's whole-directory confirmation: 377 passed / 0 failed / 2 skipped —
identical to the plan-004 reference.

## Spirit

Delivered. The plan's premise — "the entire layer collapses into event
wiring" — held: four thin attachers (~upstream-shaped, with citations),
per-props gating mirroring upstream's feature-enable lists, and the
hand-tuned velocity handoff replaced by the animationState retargeting the
same MotionValues. Both hard-bar continuity specs passed FIRST TRY once the
real bug (the skipped first `animateChanges()` pass) was fixed — strong
evidence the continuity is structural now. Three plan assumptions failed and
were handled as documented deviations serving the intent: `hover.ts` survives
as a helpers module (drag/pan import its baseline utilities — plan 005's
subject), `liveGestureTransform` is drag's channel and stays for 005, and
`inView` was ported directly (motion-dom doesn't export it).

## Scope & conduct

- In-scope only: yes; the retained files are justified by grep-verified
  live importers, exactly as the plan's own escape hatches anticipated.
- STOP conditions respected: yes. Notably the executor SELF-REPORTED
  violating the recorded never-skip-the-first-`animateChanges` constraint
  (it implemented the flag without running the pass), measured the failure
  (`setActive` fired, `whileHover` true, `latestValues` stayed `{}`), fixed
  it on both paths, and disclosed it unprompted.
- Plan amendments during execution: none required; the dispatch carried
  context adjustments (raw while-props, moved line numbers) that all held.
- One necessary bridge added: drag's composed channels mirrored into the
  node (only channels the node does not already own — the bound-value
  double-apply case was caught and handled). Explicitly marked for deletion
  in plan 005.

## Residual risk / follow-ups

- **The drag-channel mirror is temporary scaffolding** — plan 005 must
  delete it when drag writes through the VE, along with the
  `data-svelte-motion-drag-active` guard (replaced by motion-dom's drag
  lock).
- Coverage shape changed: 38 fewer unit tests, deleted with their subjects;
  replacement is `gestures.spec.ts` (15 tests incl. both `:focus-visible`
  paths, inView `once`, drag guard, disabled buttons) + three container
  whileHover specs rewritten to assert `latestValues` (incl. the #349
  variant-label cases now exercising animationState's own resolution).
  Adequate for the thin layer; the deleted machinery no longer exists to
  regress.
- `whilePan` still uses `hover.ts` helpers + the container's legacy path —
  untouched here; folds into plan 005's scope naturally.
