# Guard report — 001 hover-composed-default-transitions

**Recommendation: PASS** — every done criterion reproduced green in the executor
worktree; the two red tests confirmed failing against pre-fix `hover.ts`
(overshoot ≈1.5 never exceeded; 1.8 waypoint never observed); fix delivers
upstream per-value defaults via motion-dom's own exported `getDefaultTransition`.
**Reviewed at** exec/plan-001 `56f5027` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                        | Result | Evidence                                                                       |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| `pnpm check` 0 errors                            | met    | Reproduced by guard: `0 ERRORS` (33 pre-existing warnings)                     |
| Unit suite green                                 | met    | Reproduced: 49 files / 636 passed incl. 6 new `parseUnitValue` cases           |
| Red spec exists, failed at plan time, passes now | met    | Guard red-run: `git checkout 5c0e671 -- hover.ts` → 2 failed; restored → green |
| Six-spec e2e regression set                      | met    | Reproduced on executor port 4311: 11 passed                                    |
| Scope held                                       | met    | `git diff --stat` = 4 in-scope files; playwright port edit uncommitted         |

## Spirit

Default-transition hovers with scale now spring like framer-motion (550/30
critically-damped, x/y/rotate 500/25), keyframe arrays play their waypoints with
the 800ms keyframes default, and unit-suffixed targets mix via `mixNumber` on
shared units. Empty `{}` merged transitions correctly count as "no explicit
transition"; a user-supplied duration is honored verbatim (guarded by test).

## Scope & conduct

- One intent-improving deviation, accepted: `'-50%'` was routed OUT of the
  numeric path before `getFinalNumber` (which would have silently animated it
  as bare −50 — a trap the plan itself missed). Documented in code.
- STOP conditions all respected; overshoot threshold held across 3 runs with no
  loosening. Executor: opus, single pass, no revisions.
