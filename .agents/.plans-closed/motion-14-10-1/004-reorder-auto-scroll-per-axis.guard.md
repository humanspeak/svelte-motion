# Guard log — 004 reorder-auto-scroll-per-axis

## Checkpoint 1 — 2026-11-06 11:06 — ON TRACK

8cea2a85 · final close-out (Opus executor in a T3 worktree from 2b1ef67e; diff brought onto feat/motion-14.10.1 by the guard)

- Diff is a line-for-line port of upstream `auto-scroll.ts` @ v14.10.1 (`scrollStates`, real-overflow check, full reset); the deliberate client-coordinate convention, `selectAutoScrollAxis` and `frameData.delta` speed are untouched.
- Red reproduced by guard: the executor worktree with `autoScroll.ts` reverted to 2b1ef67e → 4 new tests fail (the nested-container and both-axes cases).
- Green reproduced: `autoScroll.spec.ts` 18/18; `pnpm test:only` 1574/1574; `pnpm check` 0 errors; `PW_PORT=4249 … e2e/reorder` 49 passed.
- Scope: 3 files, all in scope. Executor ran `svelte-kit sync` (gitignored output only) and added a `frameData.delta` reset to the ported blocks' `afterEach`, matching the existing blocks. Neither is a concern.
- Action: none needed. README row → DONE (the guard maintains the index).
