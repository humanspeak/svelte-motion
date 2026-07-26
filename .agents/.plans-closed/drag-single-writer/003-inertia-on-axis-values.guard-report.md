# Guard report — drag-single-writer 003

**Recommendation: PASS** — release animations (momentum + no-momentum settle)
drive the axis MotionValues directly; the detached-value piping is gone;
velocity continuity is structural; boundary physics untouched.
**Reviewed at** `17d7ac6` · 2026-07-25 22:34 · **Plan planned at** `04418be`
**Integrated** — not pushed; batch continues (004–005).

## Done criteria

| Criterion                                                                          | Result | Evidence (guard-reproduced)                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate + unit + typecheck green, matching baseline                                   | met    | Guard re-run: unit **806 passed**; `e2e/drag e2e/reorder` **83/1/0** (= baseline); executor's five-suite run 180/2/0                                             |
| `setXYImmediate` no longer called from release paths; remaining callers enumerated | met    | seven one-shot callers listed (pointermove, adjustOrigin, snapToCursor, rescale, settled repaint, settle paint, fallback-axis); `grep renderLatest` → no matches |
| `stopInertia` uses per-channel `value.stop()`                                      | met    | constraint-ledger compliant (motion-dom's own freeze machinery)                                                                                                  |
| `createDragInertiaGenerator` kept (spec sampling contract)                         | met    | plus `createDragInertiaOptions` as the shared builder                                                                                                            |
| Boundary-physics math untouched                                                    | met    | same inputs to `deriveBoundaryPhysics`/options builder — the STOP never fired                                                                                    |
| Glide acceptance spec stays green on the retargeted physics                        | met    | guard ran it **3× consecutive: green** (the values 003 retargeted now drive the glide 002's spec measures)                                                       |
| README row updated                                                                 | met    | 003 → DONE                                                                                                                                                       |

## Spirit

Delivered. The finding of the run is the `canAnimate` flattening trap: seed
keyframes `[v, v]` + a non-`isGenerator` inertia read as "nothing to
animate", silently flattening releases to instant landings (11 red specs).
The fix uses motion-dom's own `isSync: true` — the same `JSAnimation` path
`animateValue` took before the retarget, so the signed-off physics are
bit-for-bit preserved — documented in-code as REQUIRED-not-preference with
upstream's different dodge noted, and tripwired by a unit test pinning
`duration > 0.1` so a re-flatten fails loudly. The no-VE fallback stayed
functional AND exercised (jsdom specs) rather than becoming untested code;
value-space vs offset-space bookkeeping (`value = applied + base`, bounds
shifted by base) is the reviewer-flagged subtlety and is spelled out in the
report and code. Bonus consistent with #421: bound style MotionValues now
track the momentum glide, so `y.get()` mid-glide reads the real position.

## Scope & conduct

In-scope only; math untouched; one commit; drift clean; nothing pushed.
The unit-string normalization (`value.jump` before release, matching
upstream's `stopAnimation()` point) is a documented behavior-preserving
detail, not a deviation.

## Residual risk / follow-ups

- The `isSync` requirement is coupled to motion-dom's `canAnimate`
  internals — a motion-dom upgrade that changes async-path resolution should
  re-run the duration tripwire first (it will fail loudly if the trap
  returns in either direction).
- Plans 004/005 unchanged: whilePan next; `splitGestureTransformValues`
  retirement rides 004.
