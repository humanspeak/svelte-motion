# Guard report — 011 gesture-layout-cleanup-leaks

**Recommendation: PASS** — both leak reds confirmed (post-unmount rAF resurrects
`lastLayout`; stopped channel animation leaves its stopper in the coordinator
Set); fixes mirror upstream's frame-cancellation discipline.
**Reviewed at** exec/plan-011 `331956b` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                               | Result     | Evidence                                                                                                                      |
| --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; utils suite      | met        | Guard reproduced: 647 passed                                                                                                  |
| rAF handle stored + cancelled           | met        | `refreshRafId` field; cancel in `unmount()`; callback no-ops when unmounted                                                   |
| Red authenticity                        | met        | Guard red-run at `26684bf` → exactly 2 failed; restored → green                                                               |
| Two-spec e2e smoke                      | met        | Guard reproduced on port 4321: 4 passed                                                                                       |
| Escape hatch (adapter constructibility) | not needed | Adapter unit-constructed directly; deterministic single-frame test via seedLayout + private access (established repo pattern) |

## Spirit

`channelAnimations` entries carry `{ stop, unregister }`; teardown and
replacement paths drain both. The executor also drained the old entry's
unregister on live-channel replacement — same leak class, in scope, accepted.

## Scope & conduct

- In-scope only; coordinator API untouched. Sync-completing mock faithfully
  models the stopped-mid-flight leak (reasoning documented in the spec).
