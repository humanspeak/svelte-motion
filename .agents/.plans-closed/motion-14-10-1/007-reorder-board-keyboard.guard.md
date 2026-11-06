# Guard log — 007 reorder-board-keyboard

## Checkpoint 1 — 2026-11-06 15:56 — ON TRACK

8008cc06 · final close-out (Opus executor in worktree t3-8d9c7702)

- `board.ts`: `origin`, `key`, `restore`, `isMoving` and the receive `keys` branch, ported line for line from `Board.tsx` @ v14.10.1. `Group.svelte` `onKeyDown` follows upstream's branch order (isMoving wait; Escape → grab then `board.restore`, falling back to local restore; `board.key` before handing an arrow to the browser) and keeps the Svelte `committed` contract.
- `Item.svelte`: the blur guard `if (board?.isMoving(event.currentTarget)) return`, the Svelte-only deviation the plan prescribed.
- Red reproduced by guard (worktree, the 4 source files reverted to 4839c572): `board.component.spec.ts` → 10 failed / 28 passed. The 5 keyboard tests that pass from the start are negative assertions, which matches the executor's account.
- Blur-guard mutation reproduced: guard removed → the 3 keyboard e2e cases fail in Chromium (focus lost). Restored afterwards.
- Fixture deviation reviewed: the keyboard setup adds `layout: false` because a jsdom FLIP transform doesn't settle depending on test order. Upstream's fixture (`board.test.tsx` ~:885) comments "Without layout animations" with `transition={{ type: false }}`. Same intent, same assertions, so this doesn't weaken the tests. It's a jsdom-only residual.
- All 15 upstream keyboard tests are ported, with none skipped. No Firefox project exists (per the pre-flight revision).
- Green on the branch, from the batch-final run: `pnpm check` 0 errors; `pnpm test` 1649/1649; full chromium e2e 935 passed / 2 skipped / 0 failed (including `e2e/reorder/board.spec.ts`); trunk clean.
- Action: README → DONE.
