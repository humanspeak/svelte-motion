# Guard report — 004 reorder-auto-scroll-per-axis

**Recommendation: PASS** — upstream port is faithful and the red→green was reproduced by the guard. All gates are green.
**Reviewed at** 8cea2a85 · 2026-11-06 11:06 · **Plan planned at** f93a1d92
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch: the batch ships as one PR when the last plan passes.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| No `currentGroupElement\|initialScrollLimits\|activeScrollEdge` in autoScroll.ts | met | grep count 0 |
| `scrollWidth > element.clientWidth` present | met | `autoScroll.ts:84` |
| `pnpm test:only` all pass incl. 4 new tests | met | 113 files, 1574 tests passed |
| `PW_PORT=… e2e/reorder` all pass | met | 49 passed (2.6m), port 4249 |
| Only in-scope files changed | met | `git diff 2b1ef67e..8cea2a85 --stat`: autoScroll.ts, autoScroll.spec.ts, changeset |

## Spirit

It delivers what the plan asked for. A wrapper with `overflow:auto` but no overflow on the drag axis is no longer picked as the scroller. x and y keep separate edge and limit state. Reset clears what was actually recorded, not a re-derived guess. This is also the per-axis groundwork that plan 006 (Board) relies on.

## Scope & conduct

- In-scope only: yes.
- STOP conditions respected: yes; none fired.
- Plan amendments: none.

## Residual risk / follow-ups

- There's no e2e for the "overflow-x wrapper around a vertical list" case. It is covered by jsdom unit tests only.
