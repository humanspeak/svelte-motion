# Guard report — 006-bump-motion-13-4-5

**Recommendation: PASS** — Motion/motion-dom 13.4.5 installed; unit, check, build, docs, full e2e green; React reference confirms plan 002 snap numbers
**Reviewed at** 30b0088e · 2026-09-29 02:47 · **Plan planned at** 67815169 (amended 2026-09-28/29)
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| motion-dom version 13.4.5 | met | fs read → 13.4.5 |
| no parity case awaiting 13.4.5 alone | met (revised Step 2) | parity 25 passed incl. expected failures; none flipped |
| pnpm test / check / build / docs / full e2e | met | guard 957/957; executor check 0 errors, build ok, docs 0 errors, e2e 493/0 failed |
| reference snap matches ±1px | met | exact: (716,-202), (766,-172) |
| README row | met | updated by guard |

## Spirit

Delivers the inherited 13.4.5 fixes (projection syncRelativeLayout, spring guard, scroll rewrite) with no regressions, and independently confirms plan 002's React parity.

## Scope & conduct

- In-scope only: yes (docs artifact churn reverted by executor). STOPs respected. Amendments: two, operator-approved.

## Residual risk / follow-ups

- #3839 benefit only observable once 007 separates LayoutGroup node groups.
