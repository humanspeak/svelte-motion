# Guard report — 009 layout-ancestor-observation

**Recommendation: PASS** — red confirmed (grandparent align-toggle snaps: 0
intermediate positions); fix delivers the bounded ancestor walk + re-parent
rebinding, with plan 008's guard proven to hold under the added traffic.
**Reviewed at** exec/plan-009 `b728efb` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                            | Result | Evidence                                                                                                                     |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; layout unit spec ≥5 new cases | met    | Guard reproduced: 39 passed (grandparent fires / transform-only doesn't / bound cutoff / re-parent rebind / cleanup no-leak) |
| Red spec fails pre-fix, passes post-fix              | met    | Guard red-run at `aa2f991` → snap (no intermediates); restored → green                                                       |
| 32-test e2e regression set incl. 008's spec          | met    | Guard reproduced on port 4319: 32 passed, no commit storms                                                                   |
| `observeLayoutChanges` signature unchanged           | met    | Verified in diff                                                                                                             |

## Spirit

`MAX_OBSERVED_ANCESTORS = 4` approximates upstream's tree-global measurement
with an explicit, documented cost cap; `stripNonChildLayoutStyle` filtering
applies at EVERY level (commit-storm guard); `rewireIfReparented` runs before
the throttle gate so portals/imperative moves never leave stale observers.
Higher-level childList deliberately skipped with rationale.

## Scope & conduct

- Accepted deviation: commit boundaries rebuilt once via `reset --soft` +
  explicit re-staging (no interactive rebase available) so formatting landed in
  the correct commits — contents byte-identical to the verified tree.
- Test-environment judgment (real timers, stubbed ResizeObserver, patched rAF)
  documented and consistent with existing repo patterns.
