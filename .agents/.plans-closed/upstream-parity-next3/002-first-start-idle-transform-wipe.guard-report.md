# Guard report — 002 first-start-idle-transform-wipe

**Recommendation: PASS** — red verified (beam teleported to scaleX 1 at ~111ms
on first start), fix is race-free and root-cause-driven, full controls spec
26/26 including plans 005/006 tripwires.
**Reviewed at** exec/parity-002 `0f8055c` (integrated as `7693c80`) · 2026-07-23 · **Planned at** `0058f78`
**Integrated** — cherry-picked to feature-parity; shipped in PR #453.

## Done criteria (at review)

| Criterion                                                 | Result | Evidence                                                                 |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Red test failed at plan time ×verbatim capture, passes ×3 | met    | Guard red-run at `10f8ff2` → teleport failure reproduced; green post-fix |
| Full animation-controls spec ×2                           | met    | Guard reproduced: 26/26                                                  |
| Unit + typecheck                                          | met    | 796 / 0 errors                                                           |
| Docs verification                                         | met    | Beam demo probe: first launch sweeps 0.16→0.94; no docs change needed    |

## Spirit

The plan's prescribed ternary fallback was empirically insufficient (WAAPI
from-capture race, `parseValueFromTransform` defaulting on `none`); the
executor implemented and PROVED the race-free `[from, to]` expansion within
the plan's declared seeding allowance, keeping the ternary fallback as a
render-layer belt. Documented deviation accepted on merit — the plan's
mechanism was wrong, its intent delivered.

## Scope & conduct

In-scope only; maintainer signed off the beam sweep on the live docs page.
No post-approval defects attributable to this plan.
