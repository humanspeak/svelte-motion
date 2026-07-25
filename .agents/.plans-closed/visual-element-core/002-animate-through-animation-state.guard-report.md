# Guard report — 002 animate-through-animation-state

**Recommendation: PASS** — the declarative + imperative animation writers now
run through one VisualElement/animationState; every done criterion reproduced
green by guard, with exactly two named failures owned by plan 004.
**Reviewed at** `cad0d2c` · 2026-07-24 21:40 · **Plan planned at** `7eba0bd`
**Integrated** — no PR by operator policy: this repo requires the operator to
drive the live demo before any push/PR (see repo memory "Sign-off before PR");
publication is deferred to batch close-out. The reviewed snapshot is committed
on `issue-449-visual-element-core`.

## Done criteria

| Criterion                                                                                                    | Result                   | Evidence (guard-reproduced)                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                                                                                         | met                      | `1056 FILES 0 ERRORS 33 WARNINGS` (warning count = pre-plan baseline)                                                                                                                                            |
| `trunk check` no new issues                                                                                  | met                      | pre-commit hooks green on every landed commit; guard ran `trunk check` at checkpoints #4–#8                                                                                                                      |
| `pnpm test:only` exits 0                                                                                     | met                      | 844 passed / 71 files (guard re-run at close-out)                                                                                                                                                                |
| Targeted e2e suites exit 0 vs baseline                                                                       | met (2 named exclusions) | Guard ran the ENTIRE `e2e/` directory: **375 passed, 2 failed, 2 skipped** — the 2 failures are exactly `layout-button.spec.ts:424` and `:460`, documented known-failures owned by plan 004 (revision #4 ruling) |
| grep `executeAnimation\|applyAnimateRestingStyle\|lastAnimatePropJson\|objectAnimateRanOnMount` → no matches | met                      | 6 hits remain, all explanatory comments (`_MotionContainer.svelte:445/498/1164/1194/1952/2059`), no code references                                                                                              |
| `animateChanges` present in container                                                                        | met                      | props effect + mount effect call `ve.animationState.animateChanges()`                                                                                                                                            |
| SSR spec passes byte-identical                                                                               | met                      | `_MotionContainer.ssr.spec.ts` 4 passed, no snapshot changes                                                                                                                                                     |
| No files outside in-scope list                                                                               | met                      | Diffs at every checkpoint confined to `_MotionContainer.svelte`, `_MotionContainer.spec.ts`, `visualElementCore.ts`, `animationControls`-bridge code, plan docs                                                  |
| README status row updated                                                                                    | met                      | 002 → DONE (`cad0d2c`)                                                                                                                                                                                           |

## Spirit

Delivered. The plan's "Why this matters" named the fragile machinery to
delete — duration-0 snaps, JSON dedup flags, the `renderedInlineStyle` phase
machine, `applyAnimateRestingStyle` — and all of it is gone as code (surviving
only in explanatory comments). The container shrank 3,612 → 2,981 lines while
GAINING behavior: velocity-continuous interrupts via MotionValue retargeting
(measured: an interrupted controls animation freezes at translateX 16.032px
with correct velocity), upstream dedup via `prevResolvedValues`,
`initial={false}` via `blockInitialAnimation`, and imperative controls driving
the same node as declarative animation. Two deviations from the original steps
were guard-ruled, not silent: Step 6 (SVG migration) skipped because `e2e/svg`
is fully green and the migration was churn against a passing suite; the
wait-mode key-change exit half deferred to plan 004, which owns the two
excluded specs.

## Scope & conduct

- In-scope only: yes, at every checkpoint (verified by diffstat each round).
- STOP conditions respected: yes — eight runs, six STOPs, every one
  evidence-based and correct; zero improvised boundary crossings. The
  executor twice preserved red work on side branches rather than landing it.
- Plan amendments during execution: nine dated revisions, all by guard, all
  constraint-tightening or re-sequencing (log has each with rationale). The
  batch-level bar never dropped: the two excluded specs remain owned by 004's
  done criteria.
- One process incident: a `git reset --hard` past the executor's own commits
  dropped guard checkpoint `1f3ba85`; restored by cherry-pick (`c0a26cb`),
  classified as process error (reflog evidence; plan text never edited), and
  a binding never-reset-past-foreign-commits rule added in revision #9. The
  executor verified all 9 guard checkpoints present before its final report.

## Residual risk / follow-ups

- **The two `layout-button` specs are red on this branch by design** until
  plan 004 lands its exit coordination. 004 runs next (guard re-order).
- **Step 6 follow-up issue** at batch close: migrate `svgEffect`/path drawing
  onto the VE (currently legacy but fully green).
- **Controls-as-`props.animate` parity gap**: upstream passes the controls
  object through `props.animate` (skipped via `isAnimationControls`); our
  props shape can't without breaking `isControllingVariants` — the guard
  lives in the props effect instead. Documented in the Step-7 commit; a
  future parity plan must handle variant-node consequences first.
- **Binding constraints for later plans** (recorded in revisions #4–#9):
  never memoize the animated-style slot; never skip the first
  `animateChanges()` pass; per-commit flush is `scheduleRenderMicrotask()`;
  adapter `updateOptions` must stay `untrack`ed inside the mount effect
  (reactive style must never remount the VE — mount rewinds values).
- Reviewer attention in the eventual PR: the three-bug Step-7 commit
  (`8d89017`) and the atomic writer-swap commit (`dc2d197`) carry the risk;
  both have measured evidence in their messages.
