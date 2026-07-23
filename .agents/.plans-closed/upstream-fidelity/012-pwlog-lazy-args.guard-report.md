# Guard report — 012 pwlog-lazy-args

**Recommendation: PASS** — laziness-contract red confirmed (clean assertion
failure, stronger than the TypeError the plan hedged for); shipped builds no
longer pay forced reflows for discarded log payloads.
**Reviewed at** exec/plan-012 `fcfaf12` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                                              | Result | Evidence                                                                                |
| ---------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; utils suite                                     | met    | Guard reproduced: 648 passed                                                            |
| Every `getBoundingClientRect()` in interaction.ts inside a pwLog thunk | met    | 15/15 verified by executor grep; guard spot-checked diff                                |
| Red authenticity                                                       | met    | Guard red-run at `525a1f9` → 1 failed (thunk not invoked when active); restored → green |
| Two-spec e2e smoke (active-mode logging works)                         | met    | Guard reproduced on port 4322: 4 passed                                                 |
| `[tap]` site count unchanged                                           | met    | 18 before and after (no sites dropped)                                                  |

## Spirit

`pwLog` accepts thunk payloads, invoked only when logging is active; logged
content byte-identical. 12 interaction.ts sites wrapped; 1 animation.ts site
(hoisted `getComputedStyle` feeding only pwLog) moved inside the thunk —
grep-driven scope bullet covers it, accepted.

## Scope & conduct

- Accepted deviations: `payload?: unknown` type (eslint no-redundant-type-
  constituents blocks the union; runtime check unchanged); one type-only
  non-null assertion where the closure loses narrowing. Cheap plain-local
  payloads deliberately left unwrapped per plan.
