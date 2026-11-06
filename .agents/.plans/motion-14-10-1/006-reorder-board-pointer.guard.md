# Guard log — 006 reorder-board-pointer

## Checkpoint 1 — 2026-11-06 14:47 — ON TRACK

5011a60a · final close-out (Opus executor in worktree t3-c9d1e51e)

- The Step 1 spike gate passed with no core edits. The executor observed that the child VE mount and `updateFeatures()` run before the parent `$effect` in the same flush. Hazard 1 (the store entry is gone before receive) was confirmed and handled by capturing `handoff.visualElement`.
- `board.ts` is a near-verbatim port of upstream `Board.tsx` (pointer path), with `// Svelte:` deviation markers. The microtask.read handoff → `controls.cancel()`/`stop()` → `start(event, { immediate: true })` sequence matches upstream (`board.ts:289-326`).
- `Item.svelte`: `isContinued` onDragStart skip, `board.drag || updateOrder`, double-axis scroll with `board.column`, `board.end` in dragEnd and grab, and a one-shot receive `$effect`. Plain groups behave as before. `Group.svelte`: context members and `board.add` only; `onKeyDown` is untouched.
- Mutation checks reproduced by guard (worktree, reverted afterwards):
  - copying from `visualElementStore.get(latest.element)` → "carries how the item looks into its new group" fails;
  - removing the `isContinued` skip → "…ends the drag once" fails.
- Green reproduced on the branch:
  - 0 changes to `_MotionContainer.svelte` / `visualElementCore.ts`; `Board` is in `reorder.ts` and `m.ts`.
  - `pnpm check` 0 errors; `pnpm test:only` 1625/1625.
  - `PW_PORT=4250 … e2e/reorder e2e/lazy-motion` 73/73.
  - Consumer (types, tree-shaking, SSR): pass.
- Minor discrepancy: the executor said warnings were "same as baseline", but they went 32 → 34. Both new ones are `state_referenced_locally` in the test harness `BoardHarness.svelte:64`. Non-blocking.
- No upstream pointer tests were skipped. "callback ref that returns a cleanup" was adapted to "with a bound ref".
- Action: README → DONE. The drift bug the executor found is recorded as a follow-up in the report.
