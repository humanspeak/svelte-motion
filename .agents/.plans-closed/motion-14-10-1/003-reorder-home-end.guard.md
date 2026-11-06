# Guard log — 003 reorder-home-end

## Checkpoint 1 — 2026-11-06 14:16 — ON TRACK

f34664f2 · final close-out (Opus executor in worktree t3-d7ffb0ce; the changeset was corrected by a one-line fix-dispatch after the amendment)

- Diff is a faithful port of upstream `keyTarget` (the 3-line diff) and `onKeyDown` `isAlongAxis`. The key list is a local `keys` constant so it fits on one line for the grep criterion; it behaves the same.
- The executor flagged a wrong plan premise. The guard verified it at 2b1ef67e `Group.svelte:196-206`: the old port already prevented along-axis keys with nowhere to go. The plan was amended (operator agreed) and the changeset dropped that sentence.
- Red reproduced by guard (worktree, old Group/checkReorder/context): 4 unit tests fail, and the new End/Home e2e fails. The executor hadn't seen that e2e fail.
- Green reproduced on the branch: `pnpm test:only` 1584/1584; `pnpm check` 0 errors; the docs build exits 0 (`animated-tabs.json` reverted); both done-criteria greps match (`Group.svelte:183`, `checkReorder.ts:141`). Reorder e2e passed in the full run.
- Action: README → DONE.
