# Guard log — 001 bump-motion-14-10-1

## Checkpoint 1 — 2026-11-06 12:51 — PLAN AMENDED

(no snapshot yet: executor stopped at Step 6; work in worktree t3-c06a6fcd)

- The executor hit a STOP correctly. On both 14.9.1 and 14.10.1, `e2e/drag/tap-during-drag.spec.ts` read `tap=1, tap-cancel=0` after a drag release.
- The guard confirmed this is a plan defect, not drift. Upstream `framer-motion/src/motion/features/definitions.ts` lists `drag` before `tap`. PanSession (`PanSession.ts:136-153`) and `press()` both listen for pointerup on `window` in the capture phase. Drag registers first, and `VisualElementDragControls.cancel` releases the lock before `press/index.ts:237` checks `isDragActive()`. Upstream React behaves the same as ours.
- The plan also had a broken command: `require('motion-dom/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED. The guard reproduced this.
- Action: plan amended with operator agreement (2026-11-06 revision note). The tap-during-drag page, e2e, link and changeset line were dropped; the version checks were fixed; `svelte-kit sync` was noted. README and plan 005's drift note were updated to match.
- Integration: in-scope hunks only (pins, lockfile, SSR mock, press types, `timelineFixes.spec.ts`). The tap-during-drag files and the `+page.svelte` link were left behind.
- The snapshot commit was blocked by the pre-commit trunk check: 2 new lint issues in `src/lib/utils/timelineFixes.spec.ts` (:120 `unbound-method`, :136 `no-misused-promises`). Plan Step 8 (trunk) had not been run. Sent a fix-dispatch for the lint fix, plus Step 7 and Step 8.

## Checkpoint 2 — 2026-11-06 14:16 — ON TRACK

988f2e01 · final close-out. The fix-dispatch fixed the 2 lint issues and ran Steps 7–8; the snapshot was committed after an amendment commit (9b8c77a5).

- Fix-dispatch changes: `timelineFixes.spec.ts` swapped the rAF capture for `vi.spyOn(...).mockImplementation` and made the setup callback a block body. The assertions are unchanged (guard read the diff). The changeset matches the amended Step 7.
- The first commit attempt was blocked by trunk/grype on `pnpm-lock.yaml`. Cause: a corrupted grype DB cache (`bad db checksum`), most likely from parallel trunk runs. Guard rebuilt the tool cache (`grype db delete && grype db update`); grype then reported no issues. This was an environment problem, not a finding against the code.
- Red reproduced by guard: `timelineFixes.spec.ts` against motion-dom 14.9.1 (the 003 worktree) → 3/3 fail.
- Green reproduced: pins and version `2.10.0 14.10.1 14.10.1`; timeline, SSR, index and dependency specs 29/29; `pnpm check` 0 errors; `pnpm test:only` 1584/1584 (with 003 merged); `pnpm build` and the docs build exit 0.
- Full chromium e2e (PW_PORT=4250, run while 3 executors loaded the machine): 920 passed, 2 skipped, 2 failed.
  - `disable-from-ondrag.spec.ts:61` → 3/3 on re-run.
  - `pop-layout-scroll-siblings.spec.ts:909` → the failures were frame-capture starvation (9 frames < 10 minimum; then "source image could not be decoded"), not the jump assertions. It was 6/6 on 14.9.1 and 5/6 on 14.10.1 under the same load.
  - The fix-dispatch's own full run had 921 passed / 0 failed.
  - Classified as load flake; re-check in the batch-final quiet run.
- Lockfile diff: only motion, motion-dom and framer-motion, plus integrity hashes.
- Action: README → DONE.
