# Guard log — 001 bump-motion-14-10-1

## Checkpoint 1 — 2026-11-06 12:51 — PLAN AMENDED

(no snapshot yet: executor stopped at Step 6; work in worktree t3-c06a6fcd)

- The executor hit a STOP correctly. On both 14.9.1 and 14.10.1, `e2e/drag/tap-during-drag.spec.ts` read `tap=1, tap-cancel=0` after a drag release.
- The guard confirmed this is a plan defect, not drift. Upstream `framer-motion/src/motion/features/definitions.ts` lists `drag` before `tap`. PanSession (`PanSession.ts:136-153`) and `press()` both listen for pointerup on `window` in the capture phase. Drag registers first, and `VisualElementDragControls.cancel` releases the lock before `press/index.ts:237` checks `isDragActive()`. Upstream React behaves the same as ours.
- The plan also had a broken command: `require('motion-dom/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED. The guard reproduced this.
- Action: plan amended with operator agreement (2026-11-06 revision note). The tap-during-drag page, e2e, link and changeset line were dropped; the version checks were fixed; `svelte-kit sync` was noted. README and plan 005's drift note were updated to match.
- Integration: in-scope hunks only (pins, lockfile, SSR mock, press types, `timelineFixes.spec.ts`). The tap-during-drag files and the `+page.svelte` link were left behind.
- The snapshot commit was blocked by the pre-commit trunk check: 2 new lint issues in `src/lib/utils/timelineFixes.spec.ts` (:120 `unbound-method`, :136 `no-misused-promises`). Plan Step 8 (trunk) had not been run. Sent a fix-dispatch for the lint fix, plus Step 7 and Step 8.
