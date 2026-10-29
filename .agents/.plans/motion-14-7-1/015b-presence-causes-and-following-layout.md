# Plan 015b: Siblings and following `layout` nodes snapshot when upstream's render would reach them, and snap on exit completion where upstream snaps

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> Report to the dispatcher; lanes never edit the batch README.
>
> **Never use `git stash`.** Use **port 4223** (`PW_PORT=4223`). Never use or kill 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Second of three plans split from the old 015. Requires 015a merged into `feat/motion-14.7.1`.** In the lane,
> run `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`. Confirm each of these prints a
> line, otherwise STOP:
> - `grep -n "export const scrollShift" src/lib/utils/scrollBasis.ts` (015a)
> - `grep -n "setLastRect" src/lib/html/_MotionContainer.svelte` (015a)
> - `grep -n "onCacheRefresh" src/lib/utils/motionDomProjection.ts` (015a)
> - `grep -n "Plan 015b" e2e/animate-presence/pop-layout-container-move.spec.ts` (015a's re-pointed fixme)
> - `grep -n "static foldedInFor" src/lib/utils/motionDomProjection.ts` (015a)
>
> **Re-pin the presence line numbers.** Presence-side lines (`presence.ts`, `PresenceChild.svelte`,
> `AnimatePresence.svelte`, 008's spec) are cited at presence lane `6972dac3`, as "008's merge SHA (to be pinned)".
> Once 008 is in feat, re-locate each one by its anchor at the merged SHA. If an anchor is gone, STOP.
>
> **Drift check**: `git diff --stat <015a merge SHA>..HEAD -- src/lib/utils/layout.ts src/lib/utils/motionDomProjection.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte e2e/animate-presence src/routes/tests/animate-presence docs/src/lib/examples/multi-state-badge`
> should be empty. Line numbers below are at `3365c175` (feat) or `6972dac3` (presence lane, i.e. 008's merge SHA
> to be pinned).
> 015a and 008 shift them, so **locate every excerpt by its anchor**. If an anchor's content differs, STOP.
>
> **Not in scope yet**: plan 007's finding that `seedCachedSnapshotsForSubtree` has no descendant `isLayoutDirty`
> check. The dispatcher will say if it joins this plan.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED-HIGH. It widens owned lists' observers, and it turns exit completion from "animate" into
  upstream's "snap" outside the exiting boundary, which changes several demos (listed under "Expected parity
  changes").
- **Depends on**: 015a (rebased caches, `setLastRect`, `onCacheRefresh`, the shared page)
- **Wave**: after 015a, same lane (`siblings`)
- **Category**: bug (upstream parity)
- **Planned at**: `3365c175` with 015a on top, 2026-10-28. Split from the old 015 after round 3.

## Why this matters

React re-renders the component whose state changed, and every `motion.*` in that render calls `willUpdate()`
before the DOM changes. Svelte re-renders nothing, so svelte-motion has two gaps.

**Siblings that should animate don't:**
- On the owned path, each item sits in its own `AnimatePresence`, so siblings miss each other's pops and adds.
- A `layout` footer outside the list's parent never hears about the list at all.

**Siblings animate where upstream snaps.** When an exit completes, upstream re-renders only that
`AnimatePresence`. Its other children animate; everything outside it **snaps**. Ours can't tell a completed exit
from an add, so a footer that shares the list's parent animates.

This plan matches upstream both ways.

## Current state

### Upstream render model (`git show v14.7.1:<path>`; framer-motion paths under `packages/framer-motion/src/`)

- **Snapshots.** `motion/features/layout/MeasureLayout.tsx`:
  - `getSnapshotBeforeUpdate` (149-204) → `willUpdate()` (183), subject to `layoutDependency` (177-186);
  - `componentDidUpdate` (206-218) → `root.didUpdate()`.
- **A state change** re-renders the owning component's subtree, including its siblings and footer.
- **An exit completing** re-renders only that `AnimatePresence`: `components/AnimatePresence/index.tsx:244`
  (`setDiffedChildren([])`).
  - Its other children re-render because `presenceAffectsLayout` gives each `PresenceChild` a new context
    (`components/AnimatePresence/PresenceChild.tsx:91-98`), and `usePresence` always reads it
    (`components/AnimatePresence/use-presence.ts:40-43`; nested boundary `index.tsx:58`). So a node in an inner
    `AnimatePresence` inside a re-rendered child re-renders too.
  - Nodes outside the boundary snap.
  - In a `LayoutGroup`, `forceRender?.()` (`index.tsx:206, 236-237`; `utils/use-force-update.ts:19-22`)
    re-renders **only the boundary's nearest group**. `components/LayoutGroup/index.tsx:50-53` memoizes the group
    on `[key]`, and `packages/motion-dom/src/projection/node/group.ts:26-33` dirties only that group's members.
  - Completed exits are removed in one render (`index.tsx:171-176`).
- `packages/motion-dom/src/projection/node/create-projection-node.ts`:
  - `willUpdate` (708-791) → `updateSnapshot` (787 → 967-978), a live measure;
  - `didUpdate` (881-886), with the repeat guard at 825-828;
  - `scheduleCheckAfterUnmount` (913-926) only acts on a dirty node.

### svelte-motion (feat `3365c175` + 015a; presence lane `6972dac3`)

- **`src/lib/utils/layout.ts`, `observeLayoutChanges` (702-841):**
  - It observes its own size, attributes and subtree. The self-subtree `childList` observer is at 825.
  - It observes `{ childList, subtree }` on the **immediate parent** only (786-788), and style/class on up to 4
    ancestors (73).
  - Observers are shared per `(target, JSON init)` by `acquireMutationObserver` (619).
  - `schedule()`'s throttle (730-731: `if (pendingRaf !== null || releaseTimeout !== null) return`) drops calls.
    Its trailing rAF call carries nothing, and no handler sees records.
  - **Consequence 1:** a header, `motion.ul` and footer that share a parent already see every list mutation.
    That's part (a)/(b) territory; part D is only for nodes outside the list's parent.
  - **Consequence 2:** today a footer that shares the parent animates when a sync exit completes. Upstream snaps
    it.
- **`src/lib/components/AnimatePresence.svelte`:**
  - 223-225 (after 008; 102-106 before): `.animate-presence-container { display: contents; }` is component CSS.
    Vitest's `css.include: []` blanks it, so **jsdom never sees `display: contents`**.
  - 182 (after 008; 77 before) passes `forceRender: getLayoutGroupContext()?.forceRender`.
- **`src/lib/html/_MotionContainer.svelte`:**
  - `presenceChildContext` is declared at 303; `layoutGroupContext` at 314 (`const layoutGroupContext = getLayoutGroupContext()`).
  - `context.registerChild(presenceKey, element, filteredExit, …)` is at about 875.
  - Observer effect: `scheduleProjectionCommit` 2831-2843 (a `rafId` throttle that drops calls); the
    `observeLayoutChanges(element!, () => scheduleProjectionCommit())` call at 2866; the grouped-only
    `offProjectionCommit` at 2902-2907.
  - 015a's `setLastRect`, `onCacheRefresh` and rebase are in the same region.
- **`src/lib/utils/motionDomProjection.ts`:**
  - the `'didUpdate'` listener is grouped-only (about 586-609);
  - `commitGroup` is 1253-1262;
  - `seedCachedSnapshotsForSubtree` is 1503-1537. It seeds a committer's descendants from cache.
- **`src/lib/utils/presence.ts`:**
  - `registerChild` captures `insertionParent`, the element's parent at registration.
  - The two `motionDomProjection.updateOptions({ … })` calls are at 1930 and 1958 (`3365c175`). The adapter knows
    nothing about `layoutDependency`. `isLayoutMeasurementGated(layoutDependencyProp, dragProp)` is a container
    `$derived` (2215-2216).
  - Feat-branch `finishExit` is at 1108-1114 (reached from 1748); in the presence lane it is at 1374-1379. It calls
    `forceRender?.()` → `LayoutGroup.svelte:79-81` → `commitGroup` at postRender.
  - Clones carry `data-clone` / `data-exiting`. `clone.remove()` and `removeExitPlaceholder` run per clone.
- **`src/lib/components/PresenceChild.svelte`** (presence lane `6972dac3`): `removePop` deletes
  `data-motion-pop-id` on completion (about line 270). The `{#if}` that unrenders content is at about line 378.

### Baselines (from 008; **owned values to re-baseline** after 008's A2 fix lands)

| Case | owned |
| --- | --- |
| scrollable element clamp | 50.9 px |
| positioned scrollable element in `scale(0.5)` | 12.7 px |

### Expected parity changes (operator pre-decided: match upstream)

Exit completion snaps outside the boundary. The pre-assessment below comes from reading each test against
`ModeButton.svelte`: the shell `motion.button layout` wraps a `motion.span` that wraps `AnimatePresence`. In sync
mode the shell is outside the boundary, so on completion it snaps.

| Item | Change |
| --- | --- |
| `e2e/animate-presence/layout-button.spec.ts`, about 1067 "moves the readable active label without one-frame jumps" | **Expected to fail** in its `sync` branch (shell snap). Update only that branch to assert one completion step; cite `index.tsx:244`, `PresenceChild.tsx:91-98`. |
| same file, about 1176 "keeps sync shell anchored while both states are present" | **Pre-assessed unaffected**: both states are present, before completion. |
| about 1261 "keeps sync shell anchored during reset" | **Pre-assessed: may fail** at the completion frames (label centre vs snapped shell, 8.5 px cap). If it fails, update only its completion window, the same way. |
| about 1359 "keeps sync return icon and text centered as one unit" (4 px per-frame delta) | **Pre-assessed unaffected**: icon and text share the boundary. |
| about 1442 "does not leave the sync copy icon overlapping the copied label" | **Pre-assessed unaffected**: icon and label share the boundary. |
| about 1982 "coordinates layout participation by presence mode" | **Pre-assessed: may fail** for `sync`. If it fails, update only its `sync` expectation. |
| `src/routes/tests/animate-presence/modes/ModeExample.svelte:168` | Change the sync `flowNote` to "MID keeps its layout slot while fading; RIGHT then jumps into place when the exit completes (as in Motion)." |
| `e2e/animate-presence/modes.spec.ts` | **No change needed.** It asserts overlap and opacity, not a RIGHT slide. If it fails, that's a STOP. |
| `docs/src/lib/examples/multi-state-badge/Label.svelte:37-80` (`motion.span layout` around `AnimatePresence mode="sync"`) | The span's width **will snap** on completion. **Needs operator sign-off** (CLAUDE.md has a MultiStateBadge parity section). Before 015b merges, the dispatcher checks that motion.dev's live MultiStateBadge snaps too. Don't edit the component. |
| `armed-buttons/archive` (popLayout), `armed-buttons/delete-wait` (no `layout`), `animate-presence/grid-exit` (cards share the boundary) | **Checked: no visible change expected.** |

## Design

**Bounds.**
- No layout read per frame and no full-tree **measure**. D walks the projection tree in JavaScript without
  reading layout, and measures only the nodes it picks.
- **B(a)**: every sibling commits, one read each, per non-exit-complete childList batch in the layout parent's
  subtree. That's the same cost plain and clone lists pay today.
- **D**: an O(motion nodes) walk, plus one read per picked follower, per qualifying batch (N followers → at most N
  reads). Exit-complete batches use refresh mode, also one silent read per picked follower.

### B(a) Owned-path reach

Replace the immediate-parent childList observer with `{ childList, subtree }` on the **layout parent**: the
nearest observed ancestor that is neither `.animate-presence-container` (checked by class, because jsdom never
sees the CSS) nor computed `display: contents`. Fall back to `parentElement`.

### B(b) Pop reach

`POP_ATTRIBUTE_INIT = { attributes: true, attributeFilter: ['data-motion-pop-id'], subtree: true }` on the layout
parent.

### B(c) Completed exits snap outside their boundary

- **Marker.** A module-level `exitingElements: WeakMap<Element, { boundary, group }>`, exported from `layout.ts`
  as `markExiting` / `unmarkExiting`. The marker is not a DOM attribute: Svelte removes the DOM before child
  teardowns (`svelte/src/internal/client/reactivity/effects.js:511-525`), and MutationObserver callbacks run after
  both.
  - **Owned (R5, a new `$effect` after 314).** Mark the element when its own `presenceChildContext.isPresent`
    flips true → false, while it is connected and not `[data-presence-wait-hidden]`. That rules out a wait-mode
    child that was never shown (`PresenceChild.svelte:378`). Unmark only on re-entry, never in a teardown.
    - `boundary` = `element.closest('.animate-presence-container')`.
    - `group` = `layoutGroupContext?.group`.
  - **Clone (M3).** The element is detached before `unregisterChild`, so the boundary comes from the
    `insertionParent` captured at registration (`insertionParent.closest('.animate-presence-container')`, or
    `insertionParent` itself). Add a `layoutGroup` parameter to `registerChild`, passed from
    `_MotionContainer.svelte:875` (region R6) as `layoutGroupContext?.group`. `unregisterChild` marks the clone
    with both.
- **Classification.** It applies to **both** childList observers: the self-subtree one (825) and the
  layout-parent one. A batch is `exit-complete` when:
  - it adds nothing;
  - every removed element node either is a marker, or a `[data-presence-placeholder]`, or has a marker in its
    removed subtree (walk the removed subtree; the cost is bounded by its size); or was removed from a record
    target that is the marker's `boundary`;
  - and every `data-motion-pop-id` attribute record it contains is on a marker. Completion's `removePop` is part
    of the same completion (`PresenceChild.svelte:270`).

  The cause carries the markers' `{ boundary, group }`.
- **Throttles keep the cause.** `schedule()` (`layout.ts:730-731`) and `scheduleProjectionCommit` (2831-2843)
  both merge into a pending cause **before** their throttle checks. The merged cause is `exit-complete` only if
  every coalesced batch was. A cause-less call (the trailing rAF, a ResizeObserver delivery) on an element that
  saw an exit-complete cause inherits it until a **double rAF** has passed. rAF runs before that frame's
  ResizeObserver delivery.
- **Rule.** On an exit-complete cause, the container refreshes silently (the snap: `refreshLayout({ silent: true })`
  then `setLastRect`) **unless** either:
  - some cause `boundary` **contains** the element (`use-presence.ts:40-43`); or
  - the element's `layoutGroupContext.group` is one of the cause's groups (`index.tsx:206`, `group.ts:26-33`).

  Adds, exit starts (a clone appearing) and pops stay ordinary triggers.
- **Gated committers inside the boundary (M1).** Take a node that is `layoutDependency`-gated and contained by a
  cause boundary. Upstream still re-renders it: `index.tsx:58` → `use-presence.ts:40-43`. Its own box stays gated,
  but its descendants re-render and snapshot.
  - So on an exit-complete cause, such a node refreshes its own cache silently, as the gate requires, and then
    seeds its **descendants that are inside the same boundary** from their rebased caches
    (`seedCachedSnapshotsForSubtree`, restricted to `boundary.contains(instance)`). Then `root.didUpdate()`.
  - This is what makes clone case 8 animate `#inner`.

### D. Following nodes outside the list's parent

- **Trigger.** Only layout-parent childList records **whose target is the layout parent itself**, plus
  pop-attribute records. Delivered through `observeLayoutChanges(el, onChange, { onLayoutParentChange })` →
  `MotionDomProjectionAdapter.seedFollowingLayout(parent, records, cause)`. A `WeakSet<MutationRecord[]>` dedupes
  per batch. Never on mount, scroll, resize or per frame.
- **Last-item completions (M5).** When the list's last item completes, no sibling observer remains to deliver the
  batch. So the marked element's own container teardown also calls
  `seedFollowingLayout(layoutParentCapturedAtMount, null, { kind: 'exit-complete', … })`. For clones,
  `presence.ts` makes the same call right after `clone.remove()`. This only happens for marked elements, and only
  post-change.
  - **Dedupe (M2).** Both the teardown call and the observer-delivered call go through a per-(layout parent,
    microtask) guard. A `Set` is filled on the first call and cleared by a `queueMicrotask`, so whichever arrives
    first runs and the other is a no-op.
  - The guard keeps the footer's refresh at ≤ 1 read per change.
- **Walk.**
  - Start at the projection root.
  - Prune subtrees whose `instance` precedes `parent` without containing it.
  - Skip `parent`, its ancestors and its descendants.
  - **Pick** nodes that follow `parent` and are: mounted; `layout || layoutId`; not dirty; not gated
    (the new per-node adapter field `measurementGated`, see below); not inside `[data-layout-size-animation]`; have a reliable basis in the current
    `resizeEpoch` (015a's `scrollShift` is not `null`); and share `parent`'s nearest motion-ancestor element (or
    the document).
- **Seed mode** (any cause other than exit-complete):
  - `root.startUpdate()`;
  - for each picked node: rebased `onScreenSnapshot()`, then `prepareSnapshotPath`, then
    `isLayoutDirty = presenceSeeded = true`;
  - `root.didUpdate()`, then `scheduleResample()`.
- **Refresh mode** (exit-complete): for each picked node not covered by the boundary/group rule, call
  `refreshLayout({ silent: true })` and `onCacheRefresh`. That's the snap. It keeps the cache true, so a later add
  slides from where the node now is (upstream measures live: `create-projection-node.ts:787, 967-978`).
- **`measurementGated`** is a new adapter option. Pass `measurementGated: layoutMeasurementGated` in both
  `updateOptions` calls (1930, 1958), and store it on the adapter. That is region R7. It mirrors upstream passing
  `layoutDependency` into the projection options (`MeasureLayout.tsx:43-52`).
- **`presenceSeeded`** is a private adapter field.
  - The `'didUpdate'` listener is installed for every adapter. For an ungrouped adapter it acts only when the flag
    is set: refresh `lastLayout`/`lastUpdate`, fire the commit listeners, clear the flag. It never runs
    `shiftFollowingDescendants`.
  - `offProjectionCommit` becomes unconditional.

## Commands you will need

Same as 015a: `pnpm exec vitest run <path>`, `pnpm test:only`, `pnpm check`,
`PW_PORT=4223 pnpm exec playwright test <paths>`, `pnpm build`, `trunk fmt` / `trunk check`.

## Scope

**In scope**:
- **`src/lib/utils/layout.ts`**, `observeLayoutChanges` and new inits next to 657-666:
  - the layout parent;
  - `POP_ATTRIBUTE_INIT`;
  - classification;
  - merged causes;
  - the double-rAF inherit window;
  - `markExiting` / `unmarkExiting`;
  - `onLayoutParentChange`.

  Also `layout.spec.ts` (new `describe` only).
- **`src/lib/utils/motionDomProjection.ts`**: `static seedFollowingLayout` (with the M2 dedupe), the M1
  boundary-restricted descendant seed, the `measurementGated` option, `presenceSeeded`, and the `'didUpdate'`
  listener for every adapter. Its spec gets new `describe`s only.
- **`src/lib/html/_MotionContainer.svelte`**:
  - R5: a new `$effect` after 314;
  - R6: the `registerChild` call at about 875 (add the `layoutGroup` argument);
  - R4: `scheduleProjectionCommit` (cause plumbing and rule), the 2866 call (cause and option), the teardown call
    for marked elements in the observer effect's cleanup, and `offProjectionCommit`;
  - R7: the two `updateOptions({ … })` calls (1930, 1958): add `measurementGated`.
- **`src/lib/utils/presence.ts`**: `registerChild`'s `layoutGroup` parameter, the clone marker in
  `unregisterChild`, and the D refresh call after `clone.remove()`. Its spec gets new cases.
- **`src/lib/components/__tests__/PresenceSiblingsHarness.svelte`**,
  **`src/lib/components/presenceSiblingSnapshots.spec.ts`** (create).
- **`e2e/animate-presence/pop-layout-container-move.spec.ts`**: delete the about-line-166
  `test.fixme(path === 'owned' && query.includes('&scroller'), 'Plan 015b: …')` and its comment.
- **`src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`** (add `footer`, `items`,
  `followers`, `countReads` and `TesterPanel` steps) and its spec (new cases).
- **The parity changes, exactly as listed**: `layout-button.spec.ts` (the named branches/windows only) and
  `ModeExample.svelte:168`.
- **`.changeset/presence-causes-following-layout.md`** (create).

**Out of scope**: `PresenceChild.svelte`, `AnimatePresence.svelte`, `presenceExitRegistry.ts`,
`LayoutGroup.svelte`, `scrollBasis.ts` (015a's), the pre-update effect R2 (015c's), the MultiStateBadge docs
component, `commitPresenceLayoutRelease`, `measureRect` in `layout.ts` (dead outside specs), `package.json`.

## Considered and rejected

- **A live tree-wide `willUpdate` on presence changes.** On the clone path the DOM has already changed by then,
  and on the owned path a live read sees earlier DOM changes in the same flush.
- **Running D on every mount or unmount.** That's a scan per mount, O(N²) at initial render.
- **Svelte `out:` transitions as a pre-removal hook.** Spike 012 refuted them.
- **Stealing the shared observers' records with `takeRecords()`.** That starves the other subscribers.
- **A `data-exiting` DOM attribute as the marker.** Svelte's teardown order erases it before classification.
- **Recording case 8 as a divergence.** M1's boundary-restricted descendant seed matches upstream instead.

## Git workflow

Same lane. One commit per step, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
**Record the Step 1 SHA.** Don't push.

## Steps

### Step 1: Red tests and guards

Label each case **RED** (fails today) or **GUARD** (passes today, must stay green), per path. Record every
outcome; a label that doesn't hold is a STOP.

0. **008's spec.** Delete the about-line-166
   `test.fixme(path === 'owned' && query.includes('&scroller'), …)` call and its comment. Nothing else changes.
1. **`layout.spec.ts`**, `describe('observeLayoutChanges reach and causes (plan 015b)')`. Real jsdom
   `MutationObserver`; no CSS injected.
   - 4a **RED**: under an `.animate-presence-container` parent, an append to the grandparent calls `onChange`.
   - 4b **RED**: setting `data-motion-pop-id` on a sibling calls `onChange`.
   - 4c **RED**: removing a `markExiting` element gives `{ kind: 'exit-complete' }` through the self-subtree
     observer and through the layout-parent observer.
   - 4d **GUARD**: an add plus a removal in one batch is not exit-complete.
   - 4e **RED**: two coalesced batches (one exit-complete, one add) give a merged cause that is not exit-complete,
     and a trailing cause-less call inside the double-rAF window inherits exit-complete.
   - 4f **RED**: `onLayoutParentChange` fires once per batch, only for records targeting the layout parent.
   - 4g **GUARD**: a sibling's `style` change doesn't call `onChange`.
2. **`motionDomProjection.spec.ts`**, `describe('… seedFollowingLayout (plan 015b)')`. All **RED** (the method is
   missing):
   - 3h: seeds a following node.
   - 3i: prunes preceding subtrees; skips `parent`, its ancestors and descendants, gated, dirty, unmounted,
     sticky-path, stale-`resizeEpoch` and other-motion-ancestor nodes.
   - 3j: runs once per `records` array.
   - 3k: calls `root.didUpdate()` once.
   - 3l: in refresh mode, calls `refreshLayout({ silent: true })` and seeds nothing.
   - 3m: leaves `resumeFrom` and stacks untouched.
3. **Component spec** (`PresenceSiblingsHarness.svelte` + `presenceSiblingSnapshots.spec.ts`).
   - **Set-up**: `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`, with rects by `data-box`
     (exemplar `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts`).
   - **Harness**: `#head-wrap > motion.div layout #header`, a `motion.ul` of `items` items (default 3; owned path
     gives each its own `<AnimatePresence present>`; `clone` wraps a keyed `{#each}` in one `AnimatePresence`),
     then `#foot-wrap > motion.div layout #footer`.
   - **Props**:
     - `items`, `mode`, `clone`;
     - `addLast` (appends in the same update);
     - `layoutGroup` (wraps everything);
     - `footerInList` (footer directly in the `ul`'s parent);
     - `nested` (item 2 holds an inner `AnimatePresence` with `motion.div layout #inner`);
     - `gateItem2` (`layoutDependency={1}` on item 2).
   - **Listen** to each projection's `'didUpdate'`.
   - **Cases** (numbered as in the old 015; case 4, the exiting element's own snapshot, is 015c's):
     1. **RED (owned, popLayout).** Item 1 exits. Once the pop applies, item 2 is mocked **70 px higher** (it
        closes the gap). Item 2's `didUpdate` fires once, from its old top to 70 higher.
     2. **RED (both paths, popLayout).** The footer is mocked 70 higher after the pop, and the footer animates
        (part D). Inside it, a **GUARD**: the header has no `didUpdate` and no `getBoundingClientRect` call.
     3. **RED (clone).** `addLast` with the footer mocked 70 lower: the footer animates.
     5. **Owned sync completion** (item 1 completes, item 2 mocked 70 higher):
        - **GUARD**: without `layoutGroup`, item 2 has no `didUpdate`. Upstream snaps, and today nothing observes
          it.
        - **GUARD (M1)**: with `layoutGroup`, item 2 animates. Today: `finishExit` → `forceRender` →
          `commitGroup` seeds it.
     6. **Clone sync completion, without `layoutGroup`:**
        - **GUARD**: a footer outside the list's parent has no `didUpdate`.
        - **RED (`footerInList`)**: the footer, mocked 70 higher, sits directly in the `ul`'s parent and must get
          no `didUpdate`. Today it animates.
        - **RED (N1)**: after the completion (footer now 70 higher), `addLast`. The footer's `didUpdate` snapshot
          is its **post-completion** box. Today the footer gets **no `didUpdate` at all** on the add, because it
          doesn't observe the `ul`.
        - **RED (M5)**: `items: 1`. Remove the only item, let it complete, then `addLast`. The footer slides from
          its post-completion box.
     7. **GUARD (clone sync completion).** Item 2, in the same `AnimatePresence`, animates.
     8. **`nested` + `gateItem2`, sync, item 1 completes, `#inner` mocked 70 up, no `layoutGroup`:**
        - **RED (clone)**: item 2 is gated, so its own commit seeds nothing. `#inner` animates only through M1:
          item 2 is a gated committer inside item 1's boundary, so it seeds its in-boundary descendants
          (`index.tsx:58` → `use-presence.ts:40-43`).
        - **GUARD (owned)**: `#inner` is in a different boundary, so it snaps.
        - (Without `gateItem2`, the clone case passes today through item 2's `seedCachedSnapshotsForSubtree`
          (1503-1537). That's why the gate is there.)
     9. **GUARD.** A sibling with an unchanged `layoutDependency={1}` gets no `didUpdate`.
     10. **RED.** A real owned completion is classified exit-complete (spy on the container's silent refresh).
         This checks that the marker survives teardown order.
4. **Page and spec additions** (see Test plan). Run them.

**Verify**:
- Every label holds.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts`: exactly the two
  owned `&scroller` cases fail (owned baselines **to re-baseline**: record the new numbers). The same-render case
  stays `fixme`.
- New spec: exactly the cases marked RED below fail.

Commit and record the SHA.

### Step 2: Layout parent and pop reach (B a, b)

Implement the layout-parent resolver (class rule plus computed `display: contents`), and add the `CHILD_LIST_INIT`
and `POP_ATTRIBUTE_INIT` observers on the layout parent through `acquireMutationObserver` (619).

**Verify**:
- 4a, 4b and 4g pass; component case 1 passes.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence`:
  - the two owned `&scroller` clamp cases in `pop-layout-container-move.spec.ts` now pass;
  - **no spec fails**. The parity-table tests still pass, because completion isn't classified until Step 3.

### Step 3: Markers, classification, causes and the rule (B c, R5, R6)

**Verify**:
- 4c, 4d, 4e and component cases 5, 6 (the first two bullets), 7, 8, 9 and 10 pass.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence`: the failures are exactly the
  "expected to fail" / "may fail" rows of the parity table.
  - Apply those updates now. Change only the named branches and windows, and cite the upstream lines.
  - Then re-run: all pass.
  - Any other failure is a STOP.

### Step 4: D and the last-item path

Implement D (seed and refresh modes, the M2 dedupe), the teardown call for marked elements, the call after
`clone.remove()`, `measurementGated` (R7) and the unconditional `offProjectionCommit`.

**Verify**:
- 4f, 3h–3m and component cases 2, 3 and 6 (the N1 and M5 bullets) pass.
- The new spec's footer, N1 and M5 cases pass.

### Step 5: Guards, changeset, gate

1. **Guards.** Run the full set from 015a's Step 6.1:

   `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/projection/scroll-during-layout.spec.ts e2e/projection/sibling-swap.spec.ts e2e/projection/nested-ancestor.spec.ts e2e/independent-transforms/layout-rotating-3d.spec.ts`

   → all pass, except 008's same-render `fixme` (015c's). No budget may be raised.
2. **Changeset** (patch):

   > Layout animations around `AnimatePresence` and list changes follow Motion's render model. Adding, removing
   > or popping out an item now animates the other items, including those in separate `AnimatePresence`
   > boundaries, and `layout` elements after the list such as a footer. When an exit completes, only elements in
   > the same `AnimatePresence`, or in its `LayoutGroup`, animate; others move instantly, as in Motion.

3. **Gate**:
   - `trunk fmt` / `trunk check`, `pnpm check`, `pnpm test:only`, `pnpm build`, and the Step 5.1 set all pass.
   - The edited-spec diff check in Done criteria passes.

## Test plan

**Page additions.**
- `?followers=N` renders N `layout` footers in `#foot-wrap` (ids `footer`, `footer-2`, …).
- `?countReads`: the page wraps `HTMLProjectionNode.prototype.measure` (imported from `motion-dom`) at module top
  level, before any child mounts. Each call does `window.__projectionReads[this.instance?.id] += 1`.
  - Every adapter or projection read goes through `measure`: `measurePageRect`, `updateLayout`, and so
    `refreshLayout`. 008's point cache doesn't go through it.
  - That gives per-id **projection** reads, which `layoutMeasureStats` (one global counter) can't give.
- `?footer`: no scroller. `#head-wrap > motion.div layout #header` (`#aa00ff`), the list, then
  `#foot-wrap > motion.div layout #footer` (`#ffaa00`).
- `?items=N` sets the list length.
- An `add` button.
- `window.__removedAt` is recorded when `sib-2` (or its clone) leaves the DOM.
- `TesterPanel` steps for each case below, including "sync, no LayoutGroup: owned siblings and the footer **jump**
  into place after the fade (as in Motion); with `?layoutGroup` they slide". Add a `SNAP (expected) / SLID` chip.

**Spec additions.** Use 015a's frame rules.
- **Owned, clamp, popLayout.** The gap holds every frame, no step is above 35 px, and green holds. **RED** (the
  sibling snaps).
- **Owned, `?layoutScroll`, popLayout.** Blue and pink each step by 70 ± 2 px in the same frame, the gap holds, and
  blue has no layout transform. **GUARD.**
- **Owned, `?fixed`, window scrolled by 300, remove.** Siblings slide instead of snapping (no step above 35 px),
  with no 300 px phantom. **RED** (today the owned siblings snap 70).
- **Owned, resize** (1920 → 1600, wait 400 ms, remove). No band moves on x by more than 2 px. **GUARD**: today the
  owned siblings don't commit, so there's no stale-x slide. After B(a) they do commit, so this pins 015a's
  resize refresh on the owned path.
- **Owned, `?sticky`, scroll, remove.** No step above 35 px. **RED** (the sibling snaps).
- **Owned, sync completion, no `layoutGroup`.** Blue steps once by 70 ± 2 px and has no layout transform.
  **GUARD.**
- **`?footer`, popLayout remove, and add.** Orange never steps more than 35 px and ends 70 ± 2 px away. **RED** on
  both paths.
- **`?footer&mode=sync`, completion.** Orange steps once by 70 ± 2 px. **GUARD.** With `?layoutGroup` it slides.
  **GUARD.**
- **N1, `?footer&mode=sync`: remove, wait for completion, add.** Orange slides 70 ± 2 px with no step above 35 px.
  **RED.**
- **M5, `?footer&mode=sync&items=1`: remove, complete, add.** Orange slides. **RED.**
- **Read budgets.** Clone path and owned sync: wrapped `getBoundingClientRect` per `id`. Owned popLayout:
  `?countReads` per-id projection reads, because 008 A2's point cache also calls `getBoundingClientRect`.
  - 30 rAF-spaced page and `#scroller` scroll steps → **0** reads on `header`, `footer` and every `sib-*`.
    **GUARD**.
  - Owned and clone sync: at most **3** reads per sibling in the 500 ms from `__removedAt`, then **0** over the
    next 500 ms.
  - `?footer`: at most **1** read per follower per qualifying change. With `?footer&followers=3` (three footers),
    at most 3 reads in total. `header`: **0**.

## Done criteria

- [ ] `grep -n "POP_ATTRIBUTE_INIT\|exit-complete\|markExiting" src/lib/utils/layout.ts` prints ≥ 4 lines.
- [ ] `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` prints 1 line.
- [ ] `grep -n "exitingElements" src/lib/utils/layout.ts` prints at least one line, and
      `grep -rn "markExiting" src/lib/html/_MotionContainer.svelte src/lib/utils/presence.ts` prints at least two.
- [ ] `grep -n "measurementGated" src/lib/html/_MotionContainer.svelte` prints at least two lines.
- [ ] `grep -n "Plan 015b" e2e/animate-presence/pop-layout-container-move.spec.ts` prints nothing; the owned
      clamp cases pass.
- [ ] 4a–4g, 3h–3m and component cases 1–3 and 5–10 pass, with the labels above. The new spec's 015b cases pass.
- [ ] **No weakening**: `git diff <step-1 SHA>..HEAD -- src/lib/utils/layout.spec.ts src/lib/utils/motionDomProjection.spec.ts src/lib/components/presenceSiblingSnapshots.spec.ts src/lib/utils/presence.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
      removes or loosens no assertion.
- [ ] **Edited existing specs**: `git diff <step-1 SHA>..HEAD -- e2e/animate-presence/layout-button.spec.ts`
      touches only the `sync` branch or completion window of the tests named in the parity table, and each change
      cites `index.tsx:244`.
- [ ] **Allow-list**: `git diff --stat <step-1 SHA>..HEAD -- e2e src/routes docs` lists only
      `e2e/animate-presence/layout-button.spec.ts`, `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`,
      `e2e/animate-presence/pop-layout-container-move.spec.ts`,
      `src/routes/tests/animate-presence/modes/ModeExample.svelte` and
      `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`.
- [ ] Gate passes. The MultiStateBadge sign-off is recorded before merge.

## STOP conditions

- A precondition or anchor doesn't match, or a Step 1 label doesn't hold.
- D needs to run on mount, scroll, resize or per frame; needs to measure nodes that precede `parent`; or needs to
  seed on an exit-complete batch.
- Any fix needs a full-tree measure or a per-frame read.
- A read budget needs raising.
- A node animates twice for one change, `onProjectionUpdate` fires twice, or an animation restarts from its
  origin.
- 008's owned layout cases drift by the container move (the projection measured before 008's correction). Report
  the microtask order you observed.
- **A demo's visible behaviour changes and it isn't in the parity table**, or a spec fails that isn't in it. Report
  for sign-off, and use CLAUDE.md's failed-e2e review workflow.
- The class-based layout-parent rule doesn't make 4a pass without injected CSS.
- A real owned completion isn't classified (case 10).
- The fix needs `PresenceChild.svelte`, `AnimatePresence.svelte` or R2.
- A guard suite fails twice.

## Maintenance notes

Divergences from upstream that this plan records rather than closes:
- **Component boundaries.** D seeds followers in other components under the same motion ancestor (or the
  document) that upstream would snap. Svelte has no component boundaries in the DOM. D also assumes normal flow.
- **Unattributed ResizeObserver deliveries (m9).** A delivery caused by a completion, on a node that got no
  MutationObserver record (so no cause), animates where upstream snaps.
- **Clone exits without `exit`** are removed immediately, so they read as plain removals.
- **Per-clone removal.** Upstream removes in a batch (`index.tsx:171-176`).
- **`presenceAffectsLayout={false}`** isn't supported.
- **Plain non-motion lists** never trigger D.
- **Wait mode.** `commitPresenceLayoutRelease` keeps its own rule (not `MeasureLayout.tsx:116-127`) and an
  un-rebased `previousRect`.

Reviewers: check the merged causes across both throttles, the boundary-contains and same-group rule, the
completion-teardown D call (it runs only for marked elements), and the parity diff allow-list.

## Amendments

### A1 (2026-10-29, operator-approved)

Answers the Step 2–4 STOP (Step 1 at `92fc6a0a`; the Steps 2–4 work stays uncommitted in the lane and continues
from there). Upstream behaviour comes from a React 18 + `framer-motion@14.7.1` repro measured frame by frame
(`/tmp/fm1471-repro`: `src/shell.tsx`, `src/footer.tsx`, `src/issue2348.tsx`; it serves on a free port such as
4224 or 4225). Where this amendment and the body disagree, this amendment wins.

**1. D runs on an add, including an add to an empty list (replaces "Never on mount" for this one case).**
- Upstream: an add re-renders the list's parent, so a following `layout` footer snapshots in
  `MeasureLayout.getSnapshotBeforeUpdate` (`MeasureLayout.tsx:149-186`) and animates, with or without a
  `LayoutGroup`. The repro confirms this for an add to an empty list.
- With an empty list no sibling observer exists to deliver the batch (M5's add half). So a `layout` container that
  mounts **after its layout parent was already connected and observed by an earlier render** (that is, an add, not
  the initial render) calls `seedFollowingLayout(layoutParent, null, { kind: 'add' })` once, through the same M2
  per-(layout parent, microtask) dedupe. N items mounting in one flush give one walk.
- Seed mode uses each follower's rebased cached snapshot, never a live read, because the DOM has already changed by
  mount time.
- Initial render must not seed: followers mount after the list, so at that point they're unmounted or have no cache,
  and the walk skips them. Add a GUARD unit case: mounting a list of N items plus a footer in one render calls
  `seedFollowingLayout` at most once per layout parent and gives the footer no `didUpdate`.
- The STOP condition "D needs to run on mount" now reads "D needs to run on the **initial** mount, on scroll, on
  resize or per frame". Update "Considered and rejected" to say that D runs on an add, not on every mount.

**2. Wait mode follows upstream (operator: "match upstream").**
- Upstream (`src/shell.tsx`, no `LayoutGroup`, `mode="wait"`): the `motion.button layout` shell **snaps** to the
  new width when the new label mounts (32.6 → 167.5 px in one frame). The exit's completion re-renders only
  `AnimatePresence` (`index.tsx:244`), so the shell has no snapshot and snaps (`create-projection-node.ts:507-509`,
  825-833). Inside a `LayoutGroup`, it animates (`LayoutGroup/index.tsx:31,50-53`, `group.ts`).
- **Mirror ModeButton exactly first.** Change the repro's `Shell` (or add a sibling component) to ModeButton's
  real structure: the same elements, `layout` props, transitions, padding and labels from
  `src/routes/tests/animate-presence/layout-button/ModeButton.svelte`. Record upstream's painted frames for the
  wait swap: shell width per frame, and the active label's centre against the shell's centre per frame.
  - Ours must paint what upstream paints. If our label's centring (`:898`, 15.7 px against an 8.5 px cap) differs
    from upstream's frames, that's a bug in ours: fix it. Don't loosen the cap.
  - If upstream's own label leaves the 8.5 px cap at the snap frame, update only the `wait` branch of `:898` to
    upstream's measured worst case plus 2 px, and cite the repro numbers and `index.tsx:244`.
- `layout-button.spec.ts:1641` "animates button width instead of snapping to the final size" (wait only): change it
  to assert upstream's snap (the final width within one frame of the label swap, with no in-between widths), and
  cite `index.tsx:244`.
- **Add a LayoutGroup variant.** Give `ModeButton.svelte` an optional `layoutGroup` prop that wraps the shell in
  `LayoutGroup`, and add a `Wait (LayoutGroup)` row to the page (`testIdPrefix="wait-group"`). Add a spec case
  asserting it **animates** (at least 3 in-between widths and no step above 35 % of the width change), as
  upstream does. Label it RED or GUARD when you first run it. If it can't animate without touching
  `commitPresenceLayoutRelease`, `PresenceChild.svelte` or `AnimatePresence.svelte`, STOP.
- If any other `layout-button` test fails in its `wait` branch, handle it the same way: record upstream, match it,
  and edit only that branch. Any other failure is a STOP.
- Add these rows to the parity table's intent. The Done criteria's "edited existing specs" check now also allows
  the `wait` branches and the new `wait-group` case. The allow-list adds
  `src/routes/tests/animate-presence/layout-button/ModeButton.svelte` and
  `src/routes/tests/animate-presence/layout-button/+page.svelte`.

**3. The 240 px drift is a bug: fix it, red first.**
- Case: 008's `e2e/animate-presence/pop-layout-container-move.spec.ts:307`, owned path, a `scale(0.5)` wrapper,
  page scrolled, popLayout exit. Upstream holds still, with 0.0 px drift every frame (`dev/react/src/tests/issue-2348.tsx`,
  repro `src/issue2348.tsx`, `m-q3.mjs`). Ours drifts 240 px.
- Hypothesis to confirm before fixing (and record what you find):
  - (a) Step 2's `POP_ATTRIBUTE_INIT` subtree observer delivers the item's **own** pop attribute, so the popped
    owned element commits its own layout. Upstream never re-snapshots a popped exiting element for its own pop.
  - (b) In that commit, `scrollDelta` applies the `fixedRoot` term, because `getScrollAncestors` stops at the
    `position: fixed` `ul`. That `ul`'s containing block is the transformed ancestor, so it scrolls with the page.
    480 px of scroll × 0.5 = 240 px.
- Fix both:
  - a popped owned element (its own `data-motion-pop-id` set) doesn't self-commit from pop-attribute records or
    from its own ancestors' childList records while it's popped;
  - **`scrollBasis.ts` comes into scope for this one check only**: a `position: fixed` box whose containing block
    is a transformed, filtered, `perspective`, `will-change: transform` or `contain: paint` ancestor isn't a
    fixed root. It scrolls with that ancestor's scroll chain.
- Red first: a `scrollBasis.spec.ts` case (a fixed element under a `transform` ancestor isn't a fixed root), a
  `layout.spec.ts` or component case for (a), and the existing `:307` e2e. Then fix, and all three go green.
- If the drift has a different cause, STOP and report it with the frames.

**4. The two regressed GUARDs must pass, unchanged.**
- These are owned `?layoutScroll` popLayout (5 frames < 10) and owned clamp (green step 59 px > 35) in
  `pop-layout-scroll-siblings.spec.ts`.
- They're expected to be the same self-commit as 3(a). Don't raise a budget or a frame count. If 3 doesn't fix
  them, diagnose with painted frames and STOP with the cause.

**Not changed.** MultiStateBadge (`mode="sync"`, width through `animate.width`) needs no snap. Its operator
sign-off stays in Done criteria.
