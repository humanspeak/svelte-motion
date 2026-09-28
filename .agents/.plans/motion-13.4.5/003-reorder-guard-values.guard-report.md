# Guard report — 003-reorder-guard-values

**Recommendation: PASS** — guard clears on values change only; unit red (2 calls) and e2e red (24 calls) reproduced by executor, green reproduced by guard
**Reviewed at** 4144edf7 · 2026-09-28 16:25 · **Plan planned at** 67815169
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch (batch convention: one branch → one PR after maintainer sign-off)

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| no requestAnimationFrame/reorderingFrame in Group.svelte | met | grep → none |
| old rejection test removed | met | grep -c → 0 |
| pnpm test / pnpm check | met | 953/953; 0 errors |
| e2e/reorder all pass | met | 24 passed |
| only in-scope files | met | git show --stat 4144edf7 |

## Spirit

Matches upstream Group.tsx semantics exactly; deferred page assertions mirror upstream reorder-transition.ts verbatim (≥1, ≤3 calls, no consecutive duplicates — upstream asserts no final order).

## Scope & conduct

- In-scope only: yes
- STOP conditions respected: yes (none fired)
- Plan amendments: none

## Residual risk / follow-ups

- Behavior change (by design, maintainer-approved): a rejected proposal isn't re-sent until values changes.
- Upstream's slow-render busy() label not ported; the 120ms deferred apply alone reproduces (24 calls pre-fix).
- Maintainer visual sign-off still required before PR.
