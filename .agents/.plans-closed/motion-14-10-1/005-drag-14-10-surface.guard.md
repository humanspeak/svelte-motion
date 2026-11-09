# Guard log — 005 drag-14-10-surface

## Checkpoint 1 — 2026-11-06 14:30 — ON TRACK

4e3e025d · final close-out (Opus executor in worktree t3-39b190d7)

- Step 1 was red, so Step 2 ran. `vanillaDrag.ts` is a type-only cast (`drag === motion's drag`), following the `effects.ts` precedent. `index.ts` moves `drag` into the re-typed exports and adds `SvelteDragOptions`. The `types.ts` change is the `DragControls.start` JSDoc only.
- Red reproduced by guard (worktree, `index.ts` reverted to f34664f2): `pnpm check` gives 2 errors, `AugmentedMotionValue<number>` not assignable to `MotionValue<number>` (the type spec and the headless vanilla page).
- Green reproduced on the branch:
  - `pnpm check`: 0 errors.
  - `pnpm test:only`: 1586/1586.
  - `PW_PORT=4250 … e2e/drag`: 121 passed, 1 skipped (the existing `fixme`).
  - immediate greps: types.ts 2, dragControls.ts 1, drag docs 2.
  - getProps in the docs: 2.
  - Docs build exits 0; docs check reports 0 errors.
- Deviations reviewed:
  - The `immediate` section on the controls page is `position: fixed`, to avoid shifting two pixel-exact specs. It's on a test page and doesn't weaken any assertion. Acceptable.
  - The point-constraint spec has an extra `constraint-calls` assertion. That's stronger than the plan asked for, which is fine.
- Action: README → DONE.
