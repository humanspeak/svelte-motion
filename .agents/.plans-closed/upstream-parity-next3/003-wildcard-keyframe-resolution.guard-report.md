# Guard report — 003 wildcard-keyframe-resolution

**Recommendation: PASS (with a PLAN-DEFECT correction post-approval)** — red
probes verified (007's exact landings), execution disciplined, docs shipped.
The plan itself specified WRONG upstream semantics, corrected on-branch after
the adversarial review.
**Reviewed at** exec/parity-003 `fee642d` (integrated as `6b5bde4`) · 2026-07-23 · **Planned at** `0058f78`
**Integrated** — cherry-picked to feature-parity; shipped in PR #453 with corrections.

## Done criteria (at review)

| Criterion                                           | Result | Evidence                                               |
| --------------------------------------------------- | ------ | ------------------------------------------------------ |
| Red e2e failed with 007's landings, passed post-fix | met    | Guard red-run at `6a696b9` → both probes landed 0/none |
| Unit incl. updated pins                             | met    | 682; wildcard matrix green                             |
| Controls spec + composition with 002's expansion    | met    | 15/15; ordering documented                             |
| Docs section + demo, both themes                    | met    | keyframes FIG-002, auto-registered                     |

## Post-approval correction (plan defect, not executor error)

The plan specified `[0, null]` → `[0, live]` ("every null = current value"),
citing my misreading of the fidelity-007 follow-up. The executor MEASURED
bundled `fillWildcards` giving `[0, 0]` and flagged it; the plan overrode the
measurement. The Codex adversarial review re-verified upstream: the live value
feeds only `keyframes[0]`; later nulls fill forward. Corrected red-first on
feature-parity (`f14458d` + `21f78e6`), plus the declarative-settle gap the
review found in the same territory (`b7812f1` + `a3cad0a`) and the
`MotionAnimate` scalar-null typing gap (`187adbf`). Docs prose precision
updated (`2732869`).

**Process lesson recorded**: when an executor's measurement of the dependency
contradicts the plan's asserted semantics, the guard must arbitrate against
the SOURCE before approving — the plan is not upstream.

## Scope & conduct

Executor conduct exemplary throughout — including the measurement that later
proved the plan wrong, the honest `fillWildcards` rejection rationale, the
settle-composition discovery (recorded as follow-up), and clean 2-commit +
docs shape.
