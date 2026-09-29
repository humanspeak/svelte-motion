# Guard report — 001-pan-final-move

**Recommendation: PASS** — pending move flushed before end(); red reproduced by executor (x 10→100, offset 10→60), green reproduced by guard
**Reviewed at** 5ab97b49 · 2026-09-28 16:25 · **Plan planned at** 67815169
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch (batch convention: one branch → one PR after maintainer sign-off)

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| hasPendingMove ≥3 lines | met | grep -c → 4 |
| frameData.timestamp only in constructor | met | pan.ts:405 only |
| pnpm test exit 0, new same-frame tests pass | met | full suite 953/953 (combined branch) |
| release-before-frame e2e 2 passed | met | part of e2e/drag 94 passed, 1 pre-existing fixme skip |
| pnpm check 0 errors / trunk check | met | 0 errors, 35 pre-existing warnings; trunk via pre-commit hook passed |
| only in-scope files | met | git show --stat 5ab97b49 |

## Spirit

Delivers the upstream fix verbatim (hasPendingMove, flush before end(), time.now(), seconds rename). The release-before-frame page rests at +100 where it rested at +10 before.

## Scope & conduct

- In-scope only: yes
- STOP conditions respected: yes (none fired)
- Plan amendments: none

## Residual risk / follow-ups

- Executor fixed readout width on the demo page so a centered layout doesn't shift the draggable (documented in-page).
- Pan unit test uses the fake-timer harness from the existing deterministic velocity test instead of real rAF + mocked clock (mixed clocks gave −1200); assertions unchanged.
- Link placed after the last drag entry (the plan's anchor link doesn't exist).
- Maintainer visual sign-off still required before PR.
