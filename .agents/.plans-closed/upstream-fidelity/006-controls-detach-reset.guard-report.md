# Guard report — 006 controls-detach-reset

**Recommendation: PASS** — red confirmed (idle controls re-attach resurrects the
stale 0.66 target; upstream is last-writer-wins), fix is a minimal
identity-guarded detach effect.
**Reviewed at** exec/plan-006 `72d8555` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                        | Result | Evidence                                                                                       |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; full unit suite           | met    | Guard reproduced: 757 passed                                                                   |
| Red re-attach test + over-eager-clear guard test | met    | Guard red-run at `ea4db8e` → re-attach FAILED, guard test passed (by design); restored → 12/12 |
| Full controls spec green incl. plan-005 tests    | met    | Guard reproduced on port 4316: 12 passed                                                       |
| Scope held                                       | met    | 3 in-scope files                                                                               |

## Spirit

Settle flags now live for one attachment session (upstream motion-value
lifetimes bound to the VisualElement): identity change or detach clears;
same-object re-renders keep state (tripwired by the guard test + plan 005's
suite). The executor's red-test timing correction — first draft accidentally
passed by catching a transient frame; diagnosed with a throwaway spec proving
the bug before adding the settle wait — was rigorous, documented conduct, not
improvisation.

## Scope & conduct

- In-scope only; ternary and `applyAnimationControlsTarget` untouched per plan.
- Identity-observability STOP was explicitly checked (poke doesn't re-run the
  effect) rather than assumed. Executor: opus, single pass.
