# Guard log: plan 012 (`Reorder.Item` re-registers a replaced value)

## 2026-11-20, round 1: STOP, then amended

- In jsdom, unit test 2 (tab stop) passed on unmodified code. The executor's probe confirmed the replaced item really is missing from `elements`: ArrowDown stays on `a`.
- **Amendment `4eb56526`:** unit test 2 became a guard, and the tab-stop red evidence moved to e2e test 2. The tab-stop claim would be dropped if Chromium didn't show the symptom.

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, resumed from Step 2.
- **Red reproduced by the guard:** with `Item.svelte` reverted, the unit spec failed test 1 with `expected 'c' to be 'b'`.
- **Green reproduced:** 3/3.
- **Executor-reported red in Chromium:** e2e test 1 `Expected "b", Received "c"` and test 2 `Expected "a", Received "b"`. The tab-stop symptom does show in Chromium, so the claim stays.
- **Diff read in full:**
  - In `Item.svelte`, `$effect.pre` tracks only `value`. Inside `untrack` it registers the element getter and, once the item has measured, its last slot.
  - `handleLayoutMeasure` keeps `lastLayout` current.
  - `Group.svelte` is unchanged.
  - The test page, the e2e spec, one `+page.svelte` link and the changeset are added.
- **Accepted deviations:**
  - The Replace buttons sit above `#before`; otherwise Tab lands on a button, not the group.
  - The e2e waits for each replacement to render before pressing keys.
- **Executor-reported, not re-run:**
  - the Reorder unit suite 172/172, the e2e spec 4/4, and the Reorder e2e gate 64/64 (run twice);
  - `pnpm check` 0 errors, `pnpm test:only` 1735 passed, Trunk clean.
- **Unblocks** plan 003 (wave 2).
- **Needs maintainer sign-off:** `/tests/reorder/immutable-values` is a new tester page.
- **Integrated:** `756ae806` on `fix/2.14.1`.
