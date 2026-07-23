# Guard report — 010 base-transform-order

**Recommendation: PASS** — red confirmed (3 perspective-ordering unit cases
fail against pre-fix composer: perspective emitted last); fix hoists simple
`perspective(<length>)` tokens into upstream's canonical first slot.
**Reviewed at** exec/plan-010 `f52b1c0` · 2026-07-22 · **Planned at** `6746859`
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Done criteria

| Criterion                           | Result | Evidence                                                                    |
| ----------------------------------- | ------ | --------------------------------------------------------------------------- |
| Unit spec ≥5 new cases              | met    | 7 cases; guard reproduced full utils suite green                            |
| Red authenticity                    | met    | Guard red-run at `d27c633` → exactly 3 failed; restored → 7/7               |
| Three authored-transforms e2e specs | met    | Guard reproduced on port 4320: 7 passed                                     |
| JSDoc `@example` matches output     | met    | Updated to `'perspective(600px) scale(1.2) rotateX(20deg)'`                 |
| Caller-dependency STOP checked      | met    | `drag.ts` inspected — no base-last dependence; `perspective(var` grep empty |

## Spirit

Only the perspective slot reorders; other opaque base functions keep their
position (full-parser boundary documented in JSDoc, citing `transformPropOrder`).
Non-perspective bases are byte-identical to before.

## Scope & conduct

- Accepted deviation, better than plan: regex `[^()]*` instead of the plan's
  `[^)]*` — the plan's own `perspective(var(--p))` passthrough case REQUIRES it
  (the suggested regex would capture a corrupt partial). Documented in code.
