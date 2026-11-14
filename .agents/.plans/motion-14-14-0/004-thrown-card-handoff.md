# Plan 004: A dragged card that hands off to a `layoutId` twin starts where it was drawn and keeps its throw velocity

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4274**. Prefix every Playwright command with `PW_PORT=4274`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Revision 2026-11-14 (dispatcher, third run: replaces the `isDrawn` approach):** the `isDrawn` switch broke 5 tests in `e2e/layout/layout-root.spec.ts` (`:133`, `:260`, `:274`, `:298`, `:348`; off by exactly the ancestor offsets 50/80/58). `isDrawn` is computed from `latestValues` at read time, and Svelte mounts children before parents, so at a child's seed read an ancestor's inline transform is already painted while its `latestValues` may still be empty: the ancestor transform is then applied a second time. So:
> 1. **Revert the `isDrawn` switch and restore `keepsTransforms`** exactly as on the lane base (field, doc comment, `cachedVisualBase()` member and return sites, `rememberLayoutBox` parameter, both callers). `git diff 40048b07 -- src/lib/utils/motionDomProjection.ts` must then show only the changes below.
> 2. **Record the node's own translate at each read.** Add a private field (e.g. `latestLayoutOwnTranslate: { x: number; y: number } | undefined`), set wherever `rememberLayoutBox` stores a box: take `this.projection.latestValues.x` / `.y`, keep each only if it is a finite number, otherwise store `undefined` for the whole field. Document it next to `latestLayoutKeepsTransforms`.
> 3. **In `seedDepartingLeadSnapshot`, when `keepsTransforms` is true,** shift the cached box by the change in the node's own translate since that read: `dx = currentX − readX`, `dy = currentY − readY` (current values from `projection.latestValues`, finite numbers only; if either side is missing, apply no shift). Copy the box and `translateAxis` it by `dx` / `dy`, then continue exactly as today (`addElementScroll`, `removeTransform`, …). When `keepsTransforms` is false, keep `applyTransform` as today. Comment why: an unstripped seed shows the transforms as they were at the read, so a drag that moved the element since (the thrown card) must be added. Ancestors and the node's scale/rotate are assumed unchanged since the read, the same assumption as before this plan.
> 4. Keep `recordSnapshotVelocity(projection)` after the snapshot assignment, and keep the authorized test edits from the second run: `atSwap` = removed node's `300 + translateX`; the unit test with `x = 80` before the seed (90 / 10); the new "applies a transform added after an untransformed seed (thrown card)" test (170 / 90). Both unit tests must pass under this approach unchanged.
> 5. Verify:
>    - the throw spec `--repeat-each=3`;
>    - **`e2e/layout/layout-root.spec.ts` alone, 28/28**;
>    - `pnpm check`;
>    - `pnpm test:only`;
>    - the layout family;
>    - trunk.
>
>    Then commit. This is the last fix round in the guard's budget: if anything else regresses, STOP with numbers and leave it uncommitted.
>
> **Revision 2026-11-14 (dispatcher, second run, after the `isDrawn` fix tripped two existing tests):** both are stale test assumptions, not regressions. The guard authorizes these two test edits, and only these:
> 1. **`e2e/layout-id/throw.spec.ts` `atSwap`.** Upstream's snapshot is the card where the DOM has it at unmount (`willUpdate()`). In Svelte, drag inertia writes one more step (`translateX(101.6px)`) in the same frame as the swap, before paint, so the card's DOM position at unmount is 401.6, not the release position 390. In React the card is painted there first, so upstream's own `atSwap` equals 401.6. Redefine `atSwap` as the card's **last DOM position before removal**: in the page, observe the red card's removal (a `MutationObserver` with `childList`/`subtree` on its parent), read the removed node's `style.transform` (still readable on the detached node), parse its `translateX`, and set `atSwap = 300 + translateX` (300 is the card's undragged `left`; if the transform also carries `translateY`, ignore it, since the tests compare x). Use that one definition for every test in the file that reads `atSwap`. Do not change any threshold. Update the comment that explains `atSwap` to say why.
> 2. **`motionDomProjection.spec.ts` "removes the transforms from the layout box but keeps them in the measured box".** Its mock rect (90) pretends the seed read already included `x = 80`, but it sets `x` after the read: that is this bug's pattern. Keep the test's intent (a read taken while transformed → `measuredBox` 90, `layoutBox` 10) by giving the lead its `x = 80` **before** the seed read, so `hasPathTransforms()` sees it and `isDrawn` is true. Find how the `mount()` helper in that `describe` lets you do that (e.g. a style `x` motion value, or setting `latestValues.x` before `seedLayout` runs). If nothing allows it without changing the helper, you may add an optional parameter to the local `mount()` helper; nothing else. Then **add one new test** next to it, "applies a transform added after an untransformed seed (thrown card)": the current order (seed at 90 with no transform, then `latestValues.x = 80`) expects `measuredBox.x.min` 170 and `layoutBox.x.min` 90.
> Then re-run: the throw spec (all tests `--repeat-each=3`), `pnpm test:only`, `pnpm check`, the layout family, trunk; commit as the plan says.
>
> **Revision 2026-11-14 (dispatcher, after the first run stopped at Step 2 with case (c)):** the throw handoff runs through `seedDepartingLeadSnapshot`, not `takeOverLiveLeadOnMount`. Root cause, confirmed by the dispatcher in code: `seedDepartingLeadSnapshot` decides whether the cached box already shows the transforms with `cachedVisualBase().keepsTransforms`, which is `true` for **any** `seedLayout` unstripped read, even one taken at mount with no transform (drag `x` = 0). So the current drag offset (`x` ≈ 102) is never applied, and the snapshot is the undragged box (300–400). `cachedVisualBase()` also returns `isDrawn` (`readingUnstripped && hasPathTransforms()`, set in the `'measure'` listener next to `rememberLayoutBox`), which is true only when the read actually had a transform on the node or an ancestor. `currentVisualPageRect` already uses `isDrawn` for exactly this decision (plan 015a). **Case (c) is no longer a STOP. Do this instead of Step 3:**
> 1. In `seedDepartingLeadSnapshot`, take `isDrawn` from `cachedVisualBase()` and use it in place of `keepsTransforms`: `const drawn = isDrawn ? box : projection.applyTransform(box, true)`. Add a comment citing `currentVisualPageRect` and why: an unstripped read with no transform is transform-free. Behaviour changes only for an unstripped read with no transform, the bug. A transformed seed (both flags true) and a stripped read (both false) are unchanged.
> 2. `keepsTransforms` is then unused. Remove it: the `latestLayoutKeepsTransforms` field and its doc comment, the `keepsTransforms` member of `cachedVisualBase()`'s return type and its three return sites, and the `keepsTransforms` parameter of `rememberLayoutBox` with its two call sites (the `'measure'` listener and the one near `:1674`). Fold any still-true sentence of the removed doc comment into `latestLayoutIsDrawn`'s. Verify with `grep -c "keepsTransforms\|KeepsTransforms" src/lib/utils/motionDomProjection.ts` → `0`.
> 3. Step 4 (velocity) applies as written: `recordSnapshotVelocity(projection)` right after `projection.snapshot = {...}` in `seedDepartingLeadSnapshot`.
> 4. Leave `takeOverLiveLeadOnMount` untouched (it never runs here). Known remaining edge, not in scope: an `isDrawn` seed whose transforms changed afterwards is still stale. Mention it in your report; don't fix it.
> Then continue from Step 4/5 as written, including removing the `test.fixme()` from "A thrown card hands its velocity to a layoutId element". STOP if any existing `layoutId` / presence spec in the layout family regresses.
>
> **Revision 2026-11-14 (dispatcher, pre-flight for wave 3):** plan 003 marked test 13 ("A thrown card hands its velocity to a layoutId element") with `test.fixme()`, not `test.fail()`, and changed `atSwap` to start at the card's left edge at release (Svelte applies the swap before the spec's first rAF sample). Plans 002 and 007 changed `_MotionContainer.svelte`; this plan doesn't touch it. Plan 005 runs **in parallel** from the same base. Skip any full-suite run and run the layout family instead: `e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/projection e2e/animate-layout`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- src/lib/utils/motionDomProjection.ts e2e/layout-id/throw.spec.ts src/routes/tests/layout-id/throw`
> Expected changes: plan 003 added `readSnapshotVelocity` / `recordSnapshotVelocity` to `motionDomProjection.ts` (shifting later line numbers by roughly 60) and created the spec and the page. Find the functions named below by name, not by line. If `takeOverLiveLeadOnMount` or `seedDepartingLeadSnapshot` themselves changed, compare against the excerpts; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. The fix is in the shared-layout handoff, which the `layoutId` e2e suite covers heavily; the root cause below is a reading of the code backed by one measurement, not a proven fix.
- **Depends on**: 003-layout-velocity.md (it creates the page, the spec, and `recordSnapshotVelocity`, and both plans edit `motionDomProjection.ts`)
- **Wave**: 3
- **Category**: bug (upstream divergence) + migration
- **Planned at**: commit `4665b907`, 2026-11-14

## Why this matters

Upstream's layout-velocity tests include a card that is dragged, thrown, and replaced on release by a detail view with the same `layoutId`. In Motion the detail view starts exactly where the card was let go and, with a spring, keeps moving in the direction of the throw before travelling to its own place. In svelte-motion the detail view starts at the card's **undragged** position, a visible jump backwards of however far the card was dragged, and it carries no throw velocity. The jump is older than this release (it happens on Motion 14.12.0 too); the velocity half is new in 14.13. Both come from the same snapshot, so they are fixed together.

## Current state

- **Fixture and tests** (created by plan 003): `src/routes/tests/layout-id/throw/+page.svelte` and `e2e/layout-id/throw.spec.ts`. The red card (`#box`, `layoutId="card"`, `drag`, at `left: 300px; top: 100px`) is replaced on drag end by a blue `#box` with the same `layoutId` at `left: 50px; top: 400px`. Plan 003 marked "A thrown card hands its velocity to a layoutId element" with `test.fixme()` and a comment naming this plan.
- **Measured at planning time** (scratch copy of the fixture, vite dev server, Chromium; `R`/`B` is the red or blue box, then its left edge and width per frame). The card is dragged from 300 to 390 and released:
  ```
  R310 R330 R350 R370 R390  UP  B300 B300 B297 B292 B285 B278 …
  ```
  The blue box's first frame is at 300, not 390. The same jump was measured on unmodified `main` with motion-dom 14.12.0 (`?resize` fixture: `R390 UP B300/100 B298/102 …`). Upstream's test expects the first three frames to reach past `atSwap + 4`, where `atSwap` is the card's last left edge (about 390).
- **Upstream** (`git -C ~/Github/motion show v14.14.0:packages/motion-dom/src/projection/node/create-projection-node.ts`):
  - The departing lead is measured while still attached: `unmount()` → `willUpdate()` → `updateSnapshot()` (`:1046`). `measuredBox` is the page box with the element's own transforms in it (so the drag's `x`), and `layoutBox` has them removed.
  - `updateSnapshot()` also records `snapshot.velocity` (`:1059-1091`); entries 4 and 5 are the velocities of the element's `x` and `y` motion values (the throw).
  - `setAnimationOrigin` (`:1880-1915`) adds those to the edge velocities only for a shared handoff:
    ```ts
    const v = velocity.slice(0, 4).map(
        (edge, i) => edge + (isSharedLayoutAnimation ? velocity[4 + (i >> 1)] : 0)
    )
    ```
- **svelte-motion**, `src/lib/utils/motionDomProjection.ts`:
  - `takeOverLiveLeadOnMount(lead)` runs when a `layoutId` node mounts while the previous lead is still on screen (called from `didMount()`). Its core, at `:1400-1418` before plan 003:
    ```ts
    // `promote` measured the lead (`updateSnapshot`), as upstream's
    // `willUpdate()` would, transforms included. Keep that unless this
    // mount already moved the lead's layout, then fall back to its
    // cached pre-mount box.
    const leadAdapter = MotionDomProjectionAdapter.adapters.get(lead)
    const cached = leadAdapter?.onScreenSnapshot()
    const measured = lead.snapshot
    if (
        leadAdapter &&
        cached &&
        (!measured || !sameBox(measured.layoutBox, cached.layoutBox))
    ) {
        leadAdapter.prepareSnapshotPath(lead)
        lead.snapshot = cached
    }
    lead.isLayoutDirty = true
    if (lead.snapshot) {
        projection.snapshot = lead.snapshot
        projection.snapshot.latestValues = lead.animationValues || lead.latestValues
    }
    ```
    `cached` comes from `onScreenSnapshot()` → `measurementsFromRect(…)` (`:204-210`), which sets `measuredBox` and `layoutBox` to the **same** cached layout rect. That rect has no drag offset in it, and the snapshot has no `velocity`.
  - `seedDepartingLeadSnapshot(element)` (`:1297-1327`) builds the snapshot for a lead whose DOM was already detached. It does apply the element's transforms to get the page box (`projection.applyTransform(box, true)`), but sets no `velocity`.
- **Working hypothesis** (confirm it in Step 2 before changing anything): in the throw fixture the handoff goes through `takeOverLiveLeadOnMount`, the `sameBox` check fails, and the measured snapshot (transforms included) is replaced by `cached`, whose `measuredBox` is the undragged layout box. A shared handoff animates from `snapshot.measuredBox`, so the detail view starts at 300.
- **Conventions**: no `as any` in library source; reach untyped node fields through a narrow local type. Exported functions carry Google-style JSDoc. `recordSnapshotVelocity(projection)` (plan 003) assigns `velocity` / `relativeVelocity` onto `projection.snapshot` from that node's own state.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0; `motion-dom` is 14.14.0 |
| Types | `pnpm check` | `0 ERRORS` |
| All unit tests | `pnpm test:only` | all pass |
| The throw spec | `PW_PORT=4274 pnpm exec playwright test --project=chromium e2e/layout-id/throw.spec.ts` | as stated per step |
| Shared-layout e2e | `PW_PORT=4274 pnpm exec playwright test --project=chromium e2e/layout-id e2e/layout e2e/animate-presence e2e/drag e2e/reorder` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope:**
- `src/lib/utils/motionDomProjection.ts`: `takeOverLiveLeadOnMount()` and `seedDepartingLeadSnapshot()` only
- `e2e/layout-id/throw.spec.ts`: one new test, and removing one `test.fixme()`
- `src/lib/components/presenceSharedLayout.spec.ts` or `src/lib/utils/motionDomProjection.spec.ts`: unit coverage, if the fix adds or changes a function that can be tested without a browser
- `.changeset/thrown-card-handoff.md` (create)

**Out of scope:**
- `onScreenSnapshot()`, `commitObservedLayoutChange()`, `measurementsFromRect()` and anything in `_MotionContainer.svelte` (plan 005 works there).
- The four `recordSnapshotVelocity` call sites plan 003 added.
- The fixture page, except to fix a mistake in its port of upstream.
- Changing any upstream threshold.

## Git workflow

- Lane branch `lane/14140-throw`, cut from `feat/motion-14.14.0` after plan 003 is merged.
- Conventional commits, for example `test(layout-id): a thrown card's twin starts where the card was (red)` and `fix(layout-id): shared handoff keeps the lead's drawn box and velocity`.
- Do not push.

## Steps

### Step 1: Write the failing test for the jump

In `e2e/layout-id/throw.spec.ts`, add a test of our own next to upstream's three: "the detail view starts where the card was released". Reuse the spec's `throwCard` helper (drag from 350 to 440 at y 150, one move per frame). Sample the blue box's left edge on its first painted frame and assert it is within 20 px of `atSwap` (the red card's last left edge). The 20 px allows one frame of throw travel; the bug is a jump of about 90 px. Run it with `?tween` as well, so the assertion does not depend on velocity.

**Verify**: `PW_PORT=4274 pnpm exec playwright test --project=chromium e2e/layout-id/throw.spec.ts` → the new test FAILS for both variants with the blue box about 90 px left of `atSwap` (measured: 300 against 390). "A thrown card hands its velocity…" is still an expected failure. If the new test passes, STOP: the jump is not reproducible on a built package and the hypothesis is wrong.

### Step 2: Confirm the path

Add temporary `console.debug` lines (remove them before committing) at the top of `takeOverLiveLeadOnMount`, inside its `lead.snapshot = cached` branch, and at the top of `seedDepartingLeadSnapshot`, printing `measured?.measuredBox.x`, `measured?.layoutBox.x`, `cached?.layoutBox.x` and the lead's `latestValues.x`. Open the throw page in the Playwright run (`page.on('console', …)` in a throwaway test, or `--headed`) and note which function runs and whether the `cached` branch is taken.

**Verify**: your report states which of these is true:
- (a) `takeOverLiveLeadOnMount` runs and replaces the measured snapshot with `cached` (the hypothesis);
- (b) it runs and keeps `measured`, but `measured.measuredBox` has no drag offset;
- (c) the handoff goes through `seedDepartingLeadSnapshot` or another path.

For (c), or for (b) when the offset is missing because the lead was measured after its transforms were reset, STOP and report what you found: the fix is outside what this plan specifies.

### Step 3: Keep the lead's drawn box

For case (a): the `cached` fallback exists for a lead whose **layout** moved during the mount. A drag does not move the layout; it moves the element with a transform. So the fallback must not throw away the transforms. Make the snapshot handed to the new node match what upstream's `updateSnapshot()` produces:
- `layoutBox`: the lead's layout box (cached, transform-free), as now;
- `measuredBox`: that box **with the lead's own transforms applied**, in page space. `seedDepartingLeadSnapshot` already does this from the same cache (`cachedVisualBase()`, then `projection.applyTransform(box, true)` unless the cached read `keepsTransforms`, then `addElementScroll`). Use the same steps; extract them into one private method both functions call instead of copying them.

Decide between "keep `measured` when only its transform-free `layoutBox` matches `cached`" and "rebuild `measuredBox` on the `cached` snapshot" from what Step 2 printed, and say which in your report. Keep the existing comment's intent and update its wording.

**Verify**: `PW_PORT=4274 pnpm exec playwright test --project=chromium e2e/layout-id/throw.spec.ts` → the Step 1 test PASSES for both variants.

### Step 4: Hand on the throw velocity

In `takeOverLiveLeadOnMount`, after the lead's snapshot is final and before `projection.snapshot = lead.snapshot`, call `recordSnapshotVelocity(lead)`: the velocity must be read from the **lead** (the dragged element's `x`/`y` motion values and any layout animation it was running), not from the mounting node. In `seedDepartingLeadSnapshot`, call `recordSnapshotVelocity(projection)` after its `projection.snapshot = { … }` assignment; there `projection` is the departing lead.

Remove the `test.fixme()` line and its comment from "A thrown card hands its velocity to a layoutId element".

**Verify**: `PW_PORT=4274 pnpm exec playwright test --project=chromium e2e/layout-id/throw.spec.ts` → all tests PASS, including "A thrown card hands its velocity…" (`Math.max(...samples.slice(0, 3)) > atSwap + 4`), "A layoutId tween starts from rest" (`< atSwap + 1`) and "A thrown card keeps its size…" (width stays within 99 to 401).

If "hands its velocity" still fails after Step 3 passed, print `lead.snapshot.velocity` at the call. If entries 4 and 5 are 0, the drag's `x` value had stopped reporting velocity by the time of the mount (its last update was more than a frame ago): STOP and report the timing you measured.

### Step 5: Changeset and gate

Create `.changeset/thrown-card-handoff.md` (`patch`): "A dragged element that hands off to another element with the same `layoutId` now starts from where it was released, and a spring layout transition continues the throw."

Run `pnpm check`, `pnpm test:only`, the shared-layout e2e group from the commands table, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; the e2e group passes except known skips and any remaining `test.fixme()` cases owned by plan 005. Re-run a failing spec alone once before reporting it. An existing `layoutId` spec that fails after Step 3 or 4 and passed before is a STOP.

## Test plan

- **Red-first anchor**: "the detail view starts where the card was released" (Step 1), failing by about 90 px on current code, in both spring and tween variants.
- **Flipped from expected-failure to passing**: upstream's "A thrown card hands its velocity to a layoutId element".
- **Guards that must stay green**: upstream's "A layoutId tween starts from rest" and "A thrown card keeps its size between the card and the detail view"; the whole of `e2e/layout-id`.
- Unit: if Step 3 extracts a method that can run in jsdom with a fake box, add cases for it beside the existing adapter tests; otherwise say in your report that the behaviour is covered by e2e only and why.

## Done criteria

- [ ] `e2e/layout-id/throw.spec.ts` passes with no `test.fixme()` in it (`grep -c "test.fixme" e2e/layout-id/throw.spec.ts` → `0`)
- [ ] The Step 1 test exists and was recorded failing before Step 3
- [ ] `pnpm check` → 0 errors; `pnpm test:only` → all pass
- [ ] `e2e/layout-id`, `e2e/layout`, `e2e/animate-presence`, `e2e/drag`, `e2e/reorder` → no new failures
- [ ] `grep -n "console.debug" src/lib/utils/motionDomProjection.ts` → no output
- [ ] `git status` shows only in-scope files

## STOP conditions

- `recordSnapshotVelocity` does not exist in `motionDomProjection.ts` (plan 003 is not merged into your base).
- The Step 1 test passes on unmodified code.
- Step 2 finds case (c), or case (b) with the cause outside the two in-scope functions.
- The fix needs a change to `onScreenSnapshot()`, `measurementsFromRect()` or `_MotionContainer.svelte`.
- An existing `layoutId`, presence, drag or Reorder spec regresses.

## Maintenance notes

- The comment in `takeOverLiveLeadOnMount` records why a cached box is used at all (a mount that already moved the lead's layout). Whoever changes that fallback again must keep both properties: the layout box from before the mount, and the transforms the element was drawn with.
- Plan 005 edits `onScreenSnapshot()` and the commit path in the same file. If both lanes run at once, merge this plan first and have 005 rebase.
- A `Reorder.Item` dragged and released does not go through this path (it is one element, not a `layoutId` pair).
- Reviewer: confirm the velocity is read from the lead, and that no threshold in `throw.spec.ts` differs from upstream's.
