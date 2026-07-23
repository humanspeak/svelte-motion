# Guard report — 007 controls-final-keyframe-resolution

**Recommendation: PASS (2B — finding REJECTED, correctly)** — the investigate-
first plan resolved on its sanctioned "not reproduced" branch with verbatim
probe evidence; one pinning unit test documents current behavior.
**Reviewed at** exec/plan-007 `d7f5b06` · 2026-07-22 · **Planned at** `6746859` (LOW confidence)
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Investigation outcome

| Probe                                       | Observation                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `start({ x: [0, null] })` from x=0 and x=64 | No garbage ever serialized; post-poke transform identical to post-animation (settle stable)           |
| `start({ x: '+=50' })`                      | Same — no corruption, no poke-induced jump                                                            |
| Time-sampling wildcard from x=64            | x snaps to 0 by t=60ms — WAAPI input normalization DURING the animation, not settle-writer corruption |

The hypothesized settle corruption does not exist; `resolveRestingValues` left
verbatim, pinned by `variants.spec.ts` cases so future changes are deliberate.

## Byproduct (recorded in batch index)

The probes surfaced a REAL, different divergence: wildcard keyframes land at 0
where upstream `resolveFinalValueInKeyframes` lands at the at-start value.
Out of this plan's scope (animation input layer, not settle); follow-up candidate.

## Scope & conduct

- Temporary probe wiring fully removed (test-page diff vs base empty); tree
  clean; single test-only commit. Guard reproduced the pinning spec: 45 passed.
- Exemplary 2B execution: no fix forced onto a non-bug.
