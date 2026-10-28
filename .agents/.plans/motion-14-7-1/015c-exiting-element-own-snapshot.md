# Plan 015c: An owned exiting element's layout snapshot is taken from before the update's DOM changes

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its
> expected result before moving on. If anything under "STOP conditions" happens, stop and report. Do not
> improvise. Report to the dispatcher; lanes never edit the batch README.
>
> **Never use `git stash`.** Use **Port 4223** (`PW_PORT=4223`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Third of three plans split from the old 015.** It runs in lane `siblings` after 015b has merged. In the lane,
> run `git merge --no-ff feat/motion-14.7.1` and then `pnpm install --frozen-lockfile`.
>
> **Precondition B1: 008's A2 fix is merged.** 008's A2 resting-point cache used to observe the
> `display: contents` container. The fix (presence lane `c817fe6e`, lane now at `6972dac3`) walks past
> `display: contents`, observes `{childList, subtree}` on the real container, calls `refresh()` on track, and adds
> a `peek()`. The fix already exists on the lane; this precondition checks it reached feat. Confirm each prints at
> least one line, otherwise STOP:
> - `grep -n "peek(" src/lib/utils/presence.ts`
> - `grep -n "display === 'contents'" src/lib/utils/presence.ts`
> - `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` (015b merged)
> - `grep -n "Plan 015" e2e/animate-presence/pop-layout-container-move.spec.ts` (the same-render `fixme` is
>   still there)
>
> **Re-pin the presence line numbers.** Presence-side lines are cited at `6972dac3`, as "008's merge SHA (to be
> pinned)". Re-locate each one by its anchor at the merged SHA before you start.
>
> **Drift check**: `git diff --stat <015b merge SHA>..HEAD -- src/lib/utils/layout.ts src/lib/html/_MotionContainer.svelte src/lib/utils/presence.ts`
> should show only 008's A2 fix. The `_MotionContainer.svelte` line numbers below are at `3365c175`, so locate
> each excerpt by its anchor. If an anchor's content differs, STOP.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED. It changes the snapshot source of one effect run.
- **Depends on**: 015a (rebased caches and `onScreenSnapshot`, which this plan's new `seedOwnSnapshotFromCache`
  builds on), 015b (`layout.ts` edits in the same function), and 008's A2 fix.
- **Wave**: after 015b, same lane.
- **Category**: bug (upstream parity)
- **Planned at**: `3365c175`, with 015a and 015b on top, 2026-10-28.

## Why this matters

Upstream snapshots the exiting element in `getSnapshotBeforeUpdate`, before React commits anything
(`packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx:149-204`). In svelte-motion, an owned
element's snapshot is a **live** read in its `$effect.pre`, and that runs after earlier blocks in the same flush
have already changed the DOM. Two examples:

- the page's `{#each}` inserts a new toast (008's "item added in the same render");
- the playground's `scroll-mirror` preset removes mirror rows that are siblings of the `ul`.

Each read comes back a row off, so the exit's layout animation starts about 70 px away from where the element
actually was.

**Expect B(d) to be needed.** 008's A2 fix corrects the *pop point*, but the motion element's own *projection
snapshot* is still taken live after the insert. 008's spec says so at lines 122-125: "the owned item's layout
animation starts ~69px off. The #2348 correction itself is right here (its pop rule stays at 0px)". Step 1
re-measures to confirm. If the fixed 008 somehow makes every case pass, the plan reduces to a re-baseline and
un-fixme (Step 1.4).

## Current state

- `src/lib/html/_MotionContainer.svelte` (`3365c175`):
  - The pre-update effect is at 2242-2267 (anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`). It
    reads live and calls `motionDomProjection?.willUpdate()` when its own tracked dependencies change
    (`trackLayoutProjectionDependencies`, 2235-2241). Those dependencies include its own
    `presenceChildContext.isPresent`.
  - `presenceChildContext` is declared at 303.
- `src/lib/utils/layout.ts`: `observeLayoutChanges`, as extended by 015b. Its observers are shared through
  `acquireMutationObserver` (619).
- 015a already provides `onScreenSnapshot()` rebasing, `ScrollBasis.resizeEpoch` and `isResizeBlocked()`.
- **Baselines, to re-baseline in Step 1.** These numbers were measured on the old A2 cache: the 008 owned
  same-render case at 51 px, playground `?preset=toast&path=owned` at about 70 px, and
  `?preset=scroll-mirror&path=owned` (unscrolled) at about 70 px.

## Design (B(d))

On a pre-update run where this element's own `presenceChildContext.isPresent` changed, take the snapshot from the
rebased cache (`seedOwnSnapshotFromCache()`) instead of a live read, but **only if all of these hold**:

1. **A structural change is pending in this flush.**
   - The probe is one shared `MutationObserver` per target, with `{ childList: true, subtree: true }` and a no-op
     callback. There is no `attributes` option (m5): childList records are the only DOM changes that can move the
     element earlier in the same flush. Style or class writes earlier in the flush fall back to a live read, which
     is today's behaviour.
   - The target is the element's **outermost observed ancestor** (up to `MAX_OBSERVED_ANCESTORS`), not its layout
     parent. The `scroll-mirror` rows are siblings of the `ul`, so the layout parent wouldn't see them.
   - `takeRecords()` must return records. The answer is cached for the rest of the microtask, because
     `takeRecords()` drains the queue.
   - The probe is installed only for `layout` elements that have an owned `presenceChildContext`.
2. The cached basis's `resizeEpoch` is current, and `!isResizeBlocked()`.
3. No ancestor-attribute record has reached this element since its cache was written.
4. The basis is reliable (not sticky).

Otherwise read live, exactly as today. In the cached branch, grouped members are seeded from cache. In the live
branch they are seeded live (`willUpdate()`), as today.

**Bounds.** Per microtask, the probe allocates one record per childList mutation under its target, and the no-op
callback drains them. It reads no layout, does nothing per frame while idle, and adds no reads.

## Scope

**In scope**:
- `src/lib/utils/layout.ts`: the probe (`hasPendingStructuralChange(el)`), next to 015b's code. Its spec gets a new
  `describe`.
- `src/lib/html/_MotionContainer.svelte` R2 (the pre-update effect, 2242-2267).
- The ancestor-attribute bookkeeping: `layout.ts`'s `onAncestorAttributes` handler records a per-element
  "ancestor changed" stamp, and the adapter clears it when its cache is written. That bookkeeping is in
  `layout.ts` and `motionDomProjection.ts` (both listed in this scope).
- `src/lib/utils/motionDomProjection.ts`: `seedOwnSnapshotFromCache()`, which runs `startUpdate`, then
  `seedOwnOnScreenSnapshot`, then `seedCachedSnapshotsForGroup`, and returns the rect. Its spec gets a new case.
- `src/lib/components/presenceSiblingSnapshots.spec.ts` and its harness: case 4.
- `e2e/animate-presence/pop-layout-container-move.spec.ts`: delete only the same-render `test.fixme` and its
  comment.
- `e2e/animate-presence/pop-layout-container-move.spec.ts`: the two playground cases, inside the existing
  `test.describe('popLayout playground (#2348)', …)` block (about line 333), next to the smoke test.
- `src/routes/tests/animate-presence/pop-layout-playground/+page.svelte`: only the preset notes and tester copy that
  cite plan 015, at about lines 71, 80, 88, 97, 284, 290 and 463 (presence lane `44989ca5`). This plan runs last,
  so it rewrites **all** of them. That includes the scrollable-element notes (88, 97), whose presets 015a (clone)
  and 015b (owned) fixed; neither of those plans edits the playground. Keep the three "Still wrong with the fix"
  notes.
- `.changeset/exiting-element-own-snapshot.md` (create).

**Out of scope**: the regions 015a and 015b own (their `_MotionContainer.svelte` regions, `scrollBasis.ts`, and
the observer-reach and cause code in `layout.ts`), `PresenceChild.svelte`, and `presence.ts`.

## Git workflow

Same lane. Make one commit per step, ending each message with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Record the Step 1 SHA.** Don't push.

## Steps

### Step 1: Re-baseline on the fixed 008 (expect B(d))

1. Temporarily delete the same-render `test.fixme` (don't commit yet), then run
   `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts -g "same render"`.
2. Add the two playground cases to the `popLayout playground (#2348)` describe in
   `pop-layout-container-move.spec.ts`, next to the smoke test, and run them:
   - `?preset=toast&path=owned`: click `pg-cycle`; `drift-0` must be ≤ 1 px.
   - `?preset=scroll-mirror&path=owned`, unscrolled: click `pg-item-1`; `drift-1` must be ≤ 1 px.
3. Add component case 4 to `presenceSiblingSnapshots.spec.ts`. It uses owned popLayout, and item 0 exits while
   `addFirst` prepends an item in the same update. The prepend pushes item 0 **down** 70 px before item 0's
   pre-update effect runs. Expected: item 0's seeded snapshot is its **pre-insert** box.
4. **Decision.**
   - **Expected outcome: they fail** (the projection snapshot is ~69 px off; see "Why this matters"). Continue
     with the second bullet.
   - **If all three e2e cases and case 4 pass on the fixed 008**, don't implement B(d):
     - commit the un-fixme, the playground cases, case 4 and the notes;
     - record the new numbers in your report;
     - mark the plan done ("B(d) not needed: 008's A2 fix covers it").
   - **If they fail**, record the re-baselined numbers and whether each failure is a pop case or a non-pop case.
     B(d) stays in scope only if a failing case is justified as the exiting element's **own layout snapshot**:
     one where 008's pop point is right, so the pop rule stays put, but the layout animation starts off. Commit
     them as RED, put the `fixme` back on the 008 case until Step 2, and record the SHA.
   - If the failure is in 008's pop point instead, STOP and report it as an 008 issue.

### Step 2: B(d)

Implement the design and comment it, citing `MeasureLayout.tsx:149-204`.

**Verify**:
- Case 4 passes.
- The 008 same-render case (its `fixme` now deleted) and both playground cases pass.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence e2e/layout` passes in full.

### Step 3: Notes, changeset, gate

1. Rewrite every playground note and tester line that cites plan 015 (about lines 71, 80, 88, 97, 284, 290 and
   463) so it describes the fixed behaviour.
2. Changeset (patch): "An exiting element's own layout animation starts from where it was, even when other
   elements were added or removed in the same update, as in Motion."
3. Gate:
   - `trunk fmt` / `trunk check` on the changed files;
   - `pnpm check`;
   - `pnpm test:only`;
   - `pnpm build`;
   - `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/projection/scroll-during-layout.spec.ts e2e/projection/sibling-swap.spec.ts e2e/projection/nested-ancestor.spec.ts e2e/independent-transforms/layout-rotating-3d.spec.ts`,
     which must pass in full with no budget raised.

## Done criteria

- [ ] `grep -n "Plan 015\|test.fixme" e2e/animate-presence/pop-layout-container-move.spec.ts` prints nothing.
- [ ] The owned same-render case, the `toast` playground case and the `scroll-mirror` playground case pass.
- [ ] Case 4 passes.
- [ ] Either B(d) is implemented, with `grep -n "hasPendingStructuralChange" src/lib/utils/layout.ts` printing at
      least 2 lines, or the report says it was dropped and why.
- [ ] `git diff <step-1 SHA>..HEAD` on the Step 1 test files removes or weakens no assertion.
- [ ] The gate passes, and only in-scope files have changed.

## STOP conditions

- A precondition grep prints nothing, or 008's A2 fix isn't merged.
- In Step 1, the failure is in 008's pop point rather than the element's own snapshot.
- **B(d) never takes the cached branch in case 4**, or it takes the cached branch when no structural change is
  pending.
- The probe needs `attributes` to make a case pass. Report the case instead of adding it.
- Any per-frame read, or a read budget that has to be raised.
- A guard suite fails twice.

## Maintenance notes

- B(d) trusts the cache only when a childList change is pending in this flush. A style or class change earlier in
  the same flush that moves the element still reads live, so it can be one change off. Upstream reads before the
  commit and has no such gap.
- If 008's pop-point cache grows a general "resting box" API, B(d) can read that instead of the adapter cache.
