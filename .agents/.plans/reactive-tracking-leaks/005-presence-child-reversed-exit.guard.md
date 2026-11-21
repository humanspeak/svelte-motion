# Guard log: plan 005 (a reversed `PresenceChild` exit fires nothing)

## 2026-11-20, round 1: STOP, then amended

- Step 5's full unit run failed 3 specs in `_MotionContainer.spec.ts`. They asserted that a reversed exit fires `onExitComplete` once. With line 381 put back, the file passed 45/45, so this plan's change was the only cause.
- **Amendment (Step 5a):** update only those expected counts, to match upstream v14.14.0. That version deletes a re-entered key, and `onExitComplete` fires only once every exit has completed.

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, resumed at Step 5a.
- **Red reproduced by the guard:** with `PresenceChild.svelte` reverted, `vitest run src/lib/utils/usePresence.spec.ts` → 3 failed, 27 passed.
- **Green reproduced:** `usePresence.spec.ts` plus `_MotionContainer.spec.ts` → 75/75.
- **Diff read in full:**
  - `notifyExitCancel` is added to the context type, with JSDoc, and to the returned object behind the `!disposed` guard. It calls the existing `cancelExit`.
  - `PresenceChild.svelte`'s re-entry branch calls it.
  - The 3 specs change only their expected counts: 1/1/2 → 0/0/1 and 1/1/2/2 → 0/0/1/1. The final removal assertions are unchanged, so the parent's pending-exit count is shown to stay balanced.
- **Executor-reported, not re-run:** `pnpm check` 0 errors, `pnpm test:only` 1735 passed, `e2e/animate-presence` 210/210 on port 4215, Trunk clean.
- **Next:** plan 011 depends on this plan and 010, and changes one line of this context object (the `mode` getter).
- **Integrated:** `358b1f86` on `fix/2.14.1`.
