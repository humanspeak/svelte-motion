# Guard report — 008 layout-single-commit-guard

**Recommendation: PASS** — the MED-confidence premise reproduced exactly as
audited (2 changed-projection events ~157ms apart: observer then reactive
re-commit); fix is the plan's serial-token guard, both conditions required.
**Reviewed at** exec/plan-008 `dac45f5` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                                                         | Result | Evidence                                                                         |
| ----------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `pnpm check` 0 errors; layout unit spec                           | met    | Guard reproduced: 34 passed                                                      |
| Exactly-one-event + monotonic-series + imperative-classList tests | met    | Guard reproduced on port 4318: full 31-test regression set passed                |
| Red authenticity                                                  | met    | Guard red-run at `115abab` → event-count test failed ("saw 2"); restored → green |
| No-delta idle-event contract preserved                            | met    | Serial bumps only on changed-rect observer commits; verified in diff read        |
| Scope held                                                        | met    | 3 in-scope files; `layout.ts` observer filters untouched                         |

## Spirit

`observerCommitSerial` + capture-at-schedule detects "observer already consumed
this change" (serial advanced AND `lastRect` rect-equal to `next`), skipping the
duplicate re-commit that restarted FLIPs from origin and double-fired
`onProjectionUpdate`. The over-suppression guard (imperative classList change
still FLIPs) protects the observer-only path.

## Scope & conduct

- Minor accepted deviation: a lint-driven one-line cast removal folded into the
  fix commit rather than rewriting the validated red-commit hash. Pre-commit
  hook timeouts handled per sanctioned `--no-verify` + manual trunk path.
- The plan's premise-may-be-wrong STOP was armed and did not trigger.
