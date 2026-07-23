# Guard report — 005 controls-stop-freeze

**Recommendation: PASS** — all three red cases confirmed (completed-start revert
to 0.66; first-start revert to base; idle-stop snap of resting variant), fix
freezes stop() at the instantaneous value like upstream's per-value `value.stop()`.
**Reviewed at** exec/plan-005 `08627af` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                              | Result | Evidence                                                        |
| -------------------------------------- | ------ | --------------------------------------------------------------- |
| `pnpm check` 0 errors; full unit suite | met    | Guard reproduced: 68 files / 757 passed                         |
| Three new e2e cases pass               | met    | Guard reproduced: full spec 10 passed on port 4315              |
| Red authenticity                       | met    | Guard red-run at `2c08bc9` → exactly 3 failed; restored → green |
| Existing controls tests green          | met    | Non-neutral-hold + pre-existing cases in same run               |
| Scope held                             | met    | 3 in-scope files; templated path untouched per STOP #2          |

## Spirit

`activeAnimationControlsKeys` (captured at start, cleared on completion AND stop)
bounds `snapshotFrozenControlsValues` to exactly the mid-flight channels, read
from the committed computed matrix (hand-parsed — DOMMatrix absent in jsdom) and
folded into `lastAnimationControlsTarget` with `enterAnimationSettled = true`.
Idle stop is a true no-op — the flag is no longer set unconditionally.

## Scope & conduct

- Documented deviation, accepted: the first-start red case moved from beam
  (scaleX) to card (translateX) because the executor DISCOVERED a separate
  pre-existing bug (first-ever start wipes a non-neutral idle from-value —
  animates 1→1 invisibly). Out of scope, properly deviated around, recorded in
  the batch index as a follow-up candidate. Exemplary conduct.
