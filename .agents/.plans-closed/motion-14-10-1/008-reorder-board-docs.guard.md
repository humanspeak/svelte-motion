# Guard log — 008 reorder-board-docs

## Checkpoint 1 — 2026-11-06 15:14 — ON TRACK

17c0a300 · final close-out (Opus executor in worktree t3-1118de1b)

- The diff is docs only (8 files, no `src/lib`): new `/docs/reorder-board` page; a Reorder page cross-link and Props table; `/examples/reorder-board` with Kanban and LimitedColumn demos; nav and examplesIndex entries. `compare-data.ts` has no Reorder rows, so it's unchanged, as the plan allows.
- Deviation reviewed: LimitedColumn's `canMove` is `to !== columns.doing || to.length < 3`. The plan's bare `to.length < 3` would have capped every column, which contradicts the demo's stated intent ("Doing" WIP limit). Acceptable.
- Green reproduced on the branch: `pnpm build` and docs build exit 0; docs check 0 errors; docs test 11/11; geo-seo exit 0; docs browser 12/12; a grep match in both `docsNav.ts` and `examplesIndex.ts`; `animated-tabs.json` reverted.
- The executor drove the demos with real mouse drags in Chromium using a throwaway script. That is not maintainer sign-off.
- The Keyboard section describes plan 007's behaviour. 007 is integrated next in this batch, before release.
- Action: README → DONE.
