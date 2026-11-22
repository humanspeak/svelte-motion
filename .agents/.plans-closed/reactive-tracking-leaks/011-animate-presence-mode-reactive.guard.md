# Guard log: plan 011 (`AnimatePresence` `mode` is read live)

## 2026-11-21, rounds 1–2: STOP, then amended

- **Round 1:** e2e case 5 failed 5/12. If the mode left `wait` before `runAnimation()` ran, a child held before mount was never released. Step 3b sent such a child through the wait-release branch.
- **Round 2:** case 5 failed 7/12, the other way round: it was released too early, because `isEnterBlocked` returned `false` once the mode wasn't `wait`. Upstream doesn't re-diff on a mode change alone, so the child stays unrendered until the exits end. Step 3c keeps a held child blocked while an exit that started under `wait` is in flight.

## 2026-11-21, round 3, final: PASS

- **Red reproduced by the guard:** with `presence.ts` and `AnimatePresence.svelte` reverted, the mode specs failed 7 (`animatePresenceMode` case 1 and `presence.spec` plan-011 cases 1–6).
- **Green reproduced:** `animatePresenceMode.spec.ts` plus `presence.spec.ts` → 134/134.
- **Executor-reported:**
  - mode-switch e2e passed 72/72 with `--repeat-each=12` after Step 3c;
  - Step 4 revert proof: e2e cases 2, 3 and 5 fail on reverted code;
  - `boundary-teardown` passes 18/18 without the remount;
  - `pnpm test:only` 1810, `pnpm check` 0 errors;
  - `e2e/animate-presence` 215 passed, with 1 failure in `pop-layout-container-move` that passed alone (35/35);
  - Trunk no new issues.
- **Diff read in full:**
  - `readMode()` reads through `untrack`.
  - Every internal `mode` read is live; `unregisterChild` and `registerChild` take one local each.
  - `finishExit`/`cancelExit` release by state.
  - `syncModeTracking` handles popLayout caches.
  - The returned object's `mode` is now a getter. `notifyExitCancel` is untouched.
  - `AnimatePresence.svelte` passes `getMode`/`subscribeMode` and adds a `$effect.pre` that notifies.
  - `_MotionContainer.svelte` changes one condition (Step 3b).
- **Accepted deviations:**
  - Step 3b's condition was reshaped to `context && (…)` so TypeScript still narrows `context`; behaviour is the same.
  - A `trunk-ignore` was added for the plain `modeListeners` Set.
  - A duplicate import in `PresenceModeProbe.svelte` was merged.
  - The 12× run predates the reshape. Single runs after it, including the full folder, passed.
- **Needs maintainer sign-off:** `/tests/animate-presence/mode-switch` is a new tester page.
- **Integrated:** `24b858fb` on `fix/2.14.1`.
