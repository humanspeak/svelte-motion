# Guard report — drag-single-writer 004

**Recommendation: PASS** — whilePan animates the VisualElement's values via
`animateTarget` with `getBaseTarget` restore; the hard boundary (no
animationState forks) held with zero `visualElementCore.ts` changes; the
gesture-era helper stack is down to one named-caller export.
**Reviewed at** `ea30666` · 2026-07-25 23:58 · **Plan planned at** `04418be`
**Integrated** — not pushed; batch finale (005) next.

## Done criteria

| Criterion                                          | Result | Evidence (guard-reproduced)                                                                                                                      |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gates green, matching baseline                     | met    | Guard re-run: unit **777 passed**; `e2e/motion e2e/drag e2e/reorder` **155/2/0** (the flaky pair did not trip)                                   |
| `liveGestureTransform` grep clean                  | met    | comments only                                                                                                                                    |
| `animateTarget` at whilePan sites                  | met    | both start/end sites                                                                                                                             |
| `hover.ts` survivors each have a named live caller | met    | ONE export remains: `readTransformChannels`, caller `readLiveChannelValue` (container `'+=N'` reader); its 5 tests intact                        |
| Coverage-thinness clause honored                   | met    | characterization pin ADDED FIRST (`47cf53e`, passes on old writer 4/4) covering apply-and-revert for animatable + non-animatable introduced keys |
| No animationState types added (hard boundary)      | met    | `git diff -- visualElementCore.ts` = 0 lines                                                                                                     |
| README row updated                                 | met    | 004 → DONE                                                                                                                                       |

## Spirit

Delivered as extension semantics, exactly per the rejected-findings fence:
`animateTarget` for start, per-key `getBaseTarget(key) ?? readValue` restore
(never a computed-style snapshot), restore transition matching the old
writer's pan-end behavior, and an in-code note saying what to do if upstream
ever grows a pan type. `pan.ts` proved untouchable in the good sense — the
gesture recognizer never needed changes; only the container's writer did.
Coverage math is honest: 29 white-box tests died WITH their subjects
(baseline computation is now motion-dom's `baseTarget`, exercised end-to-end
by the new pin and the whileDrag/whileHover suites); unit count 806 → 777.

## Scope & conduct

- In-scope only; the boundary grep is the cleanest possible (zero diff).
- **Flake investigation is the run's standout conduct**: the shared
  `maxJump < 4` smoothness assertion in the hover/pan authored-transforms
  twins fails under suite load. PROVEN pre-existing, not regression: the
  hover twin is unreachable by this diff (no pan surface on that page, hover
  has been setActive since the gestures batch) and failed pre-change; the
  pan twin failed 3/6 focused runs PRE-swap vs 2/6 post; 9/9 isolated
  passes. Neither spec was loosened (plan forbids it). Recommendation
  carried to the operator: make the smoothness assertions sampling-gap-aware
  as a STANDALONE change — recorded in batch follow-ups.
- `animateWithLifecycle` is now production-dead but lives in out-of-scope
  `animation.ts` — correctly left, flagged as a one-line follow-up.

## Residual risk / follow-ups

- Batch follow-ups ledger: (1) sampling-gap-aware smoothness assertions for
  the two authored-transforms twins; (2) retire `animateWithLifecycle`
  (production-dead, spec-only); (3) `transformComposer.ts` production
  surface after `splitGestureTransformValues` retirement — evaluate the
  module at batch close.
- whilePan priority remains by-construction (pan owns the pointer session) —
  documented in code, revisit only if upstream adds a pan AnimationType.
