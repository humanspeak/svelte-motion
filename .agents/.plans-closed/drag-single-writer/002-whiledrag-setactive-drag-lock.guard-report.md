# Guard report — drag-single-writer 002

**Recommendation: PASS** — whileDrag is a real animationState priority, the
global drag lock replaces the per-gesture dataset guard with a four-route
leak audit, and the operator's hover-during-glide acceptance criterion is
delivered red-first.
**Reviewed at** `8a36552` · 2026-07-25 21:50 · **Plan planned at** `04418be`
**Integrated** — not pushed; batch continues (003–005); PR at batch close
after operator sign-off (tour page pending).

## Done criteria

| Criterion                                                  | Result                      | Evidence (guard-reproduced)                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; `trunk check` clean                 | met                         | hooks green on all four commits                                                                                                                                                                                                                   |
| `pnpm test:only` exits 0                                   | met                         | **805 passed** (guard re-run; +4 = lock-leak route pins)                                                                                                                                                                                          |
| Four-suite gate exits 0                                    | met                         | Guard ran SIX suites (added layout+projection for the container changes): **184 passed / 2 skipped / 0 failed**                                                                                                                                   |
| `hover-during-glide.spec.ts` red-first, 3× green after     | met                         | RED at scale 1.001 (re-established against pre-002 code with the FINAL fixture — evidence not stale); executor 3× green; guard re-run green in the suite                                                                                          |
| `svelteMotionDragActive` gone from src                     | met WITH JUSTIFIED RESIDUAL | gestures.ts clean; survives ONLY as the container's per-element layout-observer marker (`:2373-2404` — a global lock cannot answer "is THIS element dragging"), session-scoped, documented in drag.ts:505                                         |
| `setActive('whileDrag')` present                           | met                         | at upstream's exact drag start/end points                                                                                                                                                                                                         |
| `setDragLock` present, release provably on pointer-up path | met                         | guard-audited: idempotent `releaseDragLockIfHeld`, stale-lock release before re-acquire, released in `finishDrag` BEFORE momentum (the glide-hover mechanism) and in teardown; four routes pinned by unit tests against the real `isDragActive()` |
| Mirror bridge gone                                         | met                         | `onVisualUpdate`, `liveGestureTransform`, splice, `splitSerializedTransform` all deleted — licensed by 001's measured inertness                                                                                                                   |
| README row updated                                         | met                         | 002 → DONE                                                                                                                                                                                                                                        |

## Spirit

Delivered, including the batch's headline: **hover now responds during the
post-release glide** — the operator's live-sign-off criterion from #449 —
because the lock releases at session end (upstream semantics) and the VE
composes hover scale WITH the in-flight translate (single writer). The
whileDrag machinery collapsed into `setActive` exactly as plans 003 (gestures
batch) did for hover/tap. The dataset-guard residual is a model deviation:
discovered a second consumer the plan missed, justified it (per-element vs
global semantics), scoped it down (session-scoped, no longer a gesture
guard), and fixed a stranded-clear bug the deletion would have created.

## Scope & conduct

- In-scope only; gestures.ts's own recognizer-level check was REMOVED after
  verifying in installed sources that motion-dom's `hover`/`press` filter on
  the lock themselves (`isValidHover`, `isValidPressEvent`) — checked, not
  assumed, as instructed.
- Red-first discipline exemplary: when the fixture evolved, the executor
  re-established RED against pre-002 code so the evidence wasn't stale; a
  measurement artifact (card sliding out from under the pointer reading as
  partial engagement, peak 1.013) was caught and fixed with live-position
  chasing rather than a loosened threshold.
- Documented minimal-diff deviation: whileDrag deactivation sits at the end
  of `finishDrag` rather than upstream's pre-`startAnimation` ordering — no
  observable difference for transform channels; noted, accepted.
- Operator note carried (not edited unprompted): the ve-signoff tour §7
  amber KNOWN panel about hover-during-glide is now stale — update it at
  batch close alongside the new drag tour page.

## Residual risk / follow-ups

- `transformComposer.ts`'s `splitGestureTransformValues` is spec-only now —
  plan 004 retires it.
- hover.ts survivors: `computeHoverBaseline`/`splitHoverDefinition` used
  only by the container's whilePan wiring — plan 004's subject.
- The dataset marker's remaining consumer (layout-observer cursor pinning)
  is plan 005-adjacent; if 005's FLIP work touches that branch, revisit
  whether the marker can become internal drag state instead of a DOM
  attribute.
