# Guard report — 003 reorder-home-end

**Recommendation: PASS** — upstream Home/End port. Red was reproduced in both the unit tests and the e2e; all criteria are green.
**Reviewed at** f34664f2 · 2026-11-06 14:16 · **Plan planned at** f93a1d92 (amended 2026-11-06)
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `'Home', 'End'` in Group.svelte | met | `Group.svelte:183` |
| `key > 3` in checkReorder.ts | met | `checkReorder.ts:141` |
| `pnpm test:only` all pass | met | 1584/1584 |
| `e2e/reorder` all pass | met | all reorder specs passed in the full run (PW_PORT=4250) |
| `pnpm check` 0 errors | met | 0 errors |
| Only in-scope files | met | the 7 planned files plus the changeset |

## Spirit

Keyboard users can now move a grabbed item to either end in one keystroke, and Home/End no longer scroll the page. This matches upstream on every axis. The two guard tests protect the synchronous grab that makes upstream's React race impossible here.

## Scope & conduct

- In scope: yes. STOP respected: none fired.
- Plan amendments: 2026-11-06, the premise correction and the changeset text (operator agreed).

## Residual risk / follow-ups

- Plan 007 restructures this `onKeyDown` again for Reorder.Board.
