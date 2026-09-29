# Guard log — 007-layout-group-node-groups

## Checkpoint 1 — 2026-09-28 20:40 — ON TRACK (checkpoint; awaiting operator)

8cc9119a on branch guard/plan-007-checkpoint (executor worktree; NOT integrated onto chore/motion-13.4.5) · after Step 4 (mandatory checkpoint)

- D1–D6 implemented as designed; diff read (motionDomProjection.ts +222, _MotionContainer.svelte context/adapter/D4/D6 hunks). Scope: in-scope files only; parity page status text not changed.
- Guard rerun: vitest 977/977; parity suite --repeat-each=3 → 39 passed, 3 failed = one case ×3.
- Flipped to test(): layout-group "clicked twice with delay"; relative-child "doesn't measure a child that isn't animating", "…without a relative target". Assertions unchanged (verified in diff).
- Regression within parity suite: relative-child "child finished while parent still animating" green → red (~2.9px drift), because #parent now animates and the stale relativeTarget/targetDelta is what motion-dom 13.4.5 syncRelativeLayout drops (executor claim, not verifiable until 13.4.5 is installable).
- Still red: layout-group jump ×2 (layoutId-only trigger lacks pre-patch fan-out; RO commits a frame late), interrupt (D5b seeds cached layout of a mid-animation member), interrupt-measurements ×2 (reads come from the pre-existing per-frame layoutId rect-capture loop, _MotionContainer.svelte:748-770, not observer detection), unmount sibling (Svelte removes DOM before teardown, so group.remove() snapshots post-removal), relative-child ×2 (need 13.4.5).
- Executor-identified design gaps (a)–(d) beyond the plan; see report to operator.
- Full e2e (executor): 490 passed / 2 skipped / 2 failed / 1 flaky; non-parity failures pass in isolation on both trees.
- Guard snapshot commit used --no-verify on the throwaway worktree branch (not the shared branch).
- Action: reported to operator; awaiting decision before Steps 5–6.

## Checkpoint 2 — 2026-09-29 — PLAN AMENDED

- Operator decisions: close gaps (a)–(d) in Step 4b; read-count specs move to Plan 008 (release blocker); run 006 bump first, then resume. Revision note added; snapshot rebased onto c79955c3.

## Checkpoint 3 — 2026-09-29 04:23 — ON TRACK

4a69292c · final close-out (Steps 1–6 cumulative)

- Whitespace-insensitive diff of flipped parity specs: only markers/titles/comments changed; no assertion touched.
- Guard rerun: vitest 986/986; check 0 errors (33 warnings); parity --repeat-each=3 48 passed; full e2e 495 passed / 2 pre-existing skips / 0 failed.
- Remaining test.fail: interrupt-measurements ×2 (Plan 008), interrupt ×1 — executor evidence: Playwright's click actionability waits for the 10s animation to be "stable" (~7s), unlike Cypress (5px/frame threshold); a native/force click passes 3/3. Spec-port defect in 005's port, not behavior.
- Noted pre-existing: presence placeholder lets #b jump 40px while #a is still exiting on layout-group-presence (out of scope).
- New page layout-group-presence not linked from the index (out of 007 scope).
- Action: reported to operator; follow-up dispatch for the interrupt click semantics.
