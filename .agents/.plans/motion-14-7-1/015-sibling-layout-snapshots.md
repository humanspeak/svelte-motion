# Plan 015: Layout siblings snapshot before a presence or list change, and cached layouts survive a container scroll

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4223**. Prefix every Playwright command with `PW_PORT=4223`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Requires plans 006 (with amendment A1), 007 and 008 (with amendments A1–A3), all merged into
> `feat/motion-14.7.1`.** Before starting, confirm each command prints at least one line, otherwise STOP:
> - `grep -n "switchLayoutId" src/lib/utils/motionDomProjection.ts` (006)
> - `grep -n "takeOverLiveLeadOnMount" src/lib/utils/motionDomProjection.ts` (006 A1)
> - `grep -n "layoutRoot?: boolean" src/lib/types.ts` (007)
> - `grep -n "schedulePopLayoutCorrection" src/lib/utils/presence.ts` (008)
> - `grep -n "pendingPop" src/lib/components/PresenceChild.svelte` (008 A1)
> - `grep -n "createPopLayoutPointCache" src/lib/utils/presence.ts` (008 A2)
> - `grep -n "Plan 015" e2e/animate-presence/pop-layout-container-move.spec.ts` (008 A3, the five `fixme`s)
>
> **Drift check (run first)**:
> `git diff --stat 30290164..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/layout.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte src/lib/components/PresenceChild.svelte e2e/animate-presence/pop-layout-container-move.spec.ts src/routes/+page.svelte`
> Expected: changes from 006, 007, 008 (and 013 if it merged first, see "Ordering"). Line numbers in this plan
> are at `30290164` (`feat/motion-14.7.1`, Motion 14.7.1 pins, plans 001–005, 009, 010 merged) unless they say
> otherwise. Those plans shift them, so **find every excerpt by content** (each one gives a `grep` anchor). If an
> excerpt's content is gone or different, STOP.

## Status

- **Priority**: P1 (ships in 2.7.0; a scrolled list jumps by the whole scroll distance)
- **Effort**: L
- **Risk**: MED-HIGH. Every observed layout commit now goes through a scroll rebase, and owned lists observe a
  wider DOM subtree. A sign or scale mistake makes elements in scroll containers jump. The guard suites below
  exist to catch that.
- **Depends on**: 006 + A1 (its `takeOverLiveLeadOnMount` reads `onScreenSnapshot()`, which this plan rebases;
  its `_MotionContainer.svelte` effects sit between this plan's regions), 007 (same `updateOptions` plumbing and
  `motionDomProjection.ts` regions), 008 + A1–A3 (this plan builds on 008's `presence.ts` helpers, 008's page,
  and un-fixmes 008's five cases).
- **Wave**: 4 (with 013), lane `siblings`, cut from `feat/motion-14.7.1` once 006 (with A1), 007 and 008 have
  merged.
- **Category**: bug (upstream parity)
- **Planned at**: commit `30290164` (`feat/motion-14.7.1`), 2026-10-28. The lane code it builds on was read at
  `lane/1471-layoutid` `d89c93d8` (006 + A1 in progress) and `lane/1471-presence` `01db40da` (008 A2 not yet
  committed).

## Why this matters

When a React parent re-renders, every `motion.*` child re-renders too. That includes an `AnimatePresence` child
leaving, an item being added, and any list re-render. Each child's `MeasureLayout` calls `projection.willUpdate()`
before the DOM changes and `root.didUpdate()` after. So every layout node takes its "before" box from the
moment before the change, and they all animate in one pass. Svelte doesn't re-render siblings. In svelte-motion
an element only takes a snapshot when its own inputs change. Otherwise its DOM observers notice the move after
the fact and diff it against a **cached** rect.

That leaves three visible bugs, and 008 marked five of its e2e cases `test.fixme` because of them:

1. **Owned path (`<AnimatePresence present>` per item).** The siblings never notice a `popLayout` pop. The pop
   rule is a `<style>` in `<head>` and each sibling sits in its own `display: contents` container, so none of
   their observers fire. When the pop clamps a scroll container (`#scroller`, which has no `layoutScroll`), the
   popped item animates its 70 px move and the item above it snaps. The gap is 50.9 px off at 100 ms (12.7 px
   in the `scale(0.5)` case).
2. **Owned path, item added in the same render.** The exiting element's own snapshot is a live read in its
   `$effect.pre`. That runs after the page's `{#each}` has already inserted the new toast, so the read sees
   item 0 pushed up 70 px. Its layout animation then starts about 69 px off (51 px at 100 ms).
3. **Clone path.** The cached rects date from before `#scroller` scrolled, so they are wrong by the whole scroll
   distance. Items 0, 2 and 3 never moved, yet they get 1392 px layout transforms (348 px in the `scale(0.5)`
   case). Any user who scrolls a list of `layout` items and then removes or adds one sees this.

4. **A `layout` node after the list** (a footer in the same component, no `LayoutGroup`). Upstream animates it
   when the list shrinks or grows, because its component re-renders. Ours observes only its own parent and
   ancestors, so it snaps to its new position.

Once this plan lands:

- every sibling of a presence or list change animates from where it was;
- a `layout` node after the changed list (for example a footer) animates too;
- a cached rect stays valid while its scroll container scrolls;
- an exit clone follows the same layout move its element would have animated.

## Current state

### Upstream (verified at `~/Github/motion`, read with `git show v14.7.1:<path>`)

- **When siblings snapshot.** In `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`:
  - `getSnapshotBeforeUpdate` (149-204) runs for every re-rendered node before React commits. It calls
    `projection.willUpdate()` (183) unless `layoutDependency` gates it (177-186: `drag ||` the dependency changed
    `|| layoutDependency === undefined ||` its own `isPresent` changed).
  - `componentDidUpdate` (206-218) calls `projection.root!.didUpdate()` (210).
  - `componentDidMount` (116-147) only calls `root.didUpdate()` (125-127), and only once any snapshot exists.
  - `componentWillUnmount` (220-235) calls `layoutGroup.group?.remove(projection)` (232).
  - Nothing here is keyed to "siblings". The re-render is what reaches them.
  - `AnimatePresence` (`components/AnimatePresence/index.tsx`) re-renders itself in the same render when its
    children change (`setRenderedChildren` + `setDiffedChildren`, then `return null`, 140-189). It renders a
    `PresenceChild` with the child elements for every child (252-270), so all present siblings re-render. When
    every exit completes it calls `forceRender?.()` (236-237) and re-diffs (244).
- **Groups.** `motion-dom/src/projection/node/group.ts`:
  - `nodeGroup()` (12-37) subscribes to each member's `"willUpdate"` event. One member's `willUpdate` calls
    `willUpdate(false)` on every member that isn't already dirty (`notify`, 3-4; `dirtyAll`, 16).
  - `remove()` also dirties all members (33).
  - `LayoutGroup` (`components/LayoutGroup/index.tsx`) owns one group (44-46) and passes down `forceRender` (31),
    which re-renders the subtree on the next frame (`utils/use-force-update.ts:19-22`, `frame.postRender`).
- **What a snapshot measures.** In `motion-dom/src/projection/node/create-projection-node.ts`:
  - `willUpdate()` (708-791) calls `root.startUpdate()` (735), then `updateScroll("snapshot")` for each node on
    the path (763), then `updateSnapshot()` (787). `updateSnapshot` (967-978) does `this.snapshot =
    this.measure()`, which is **live**.
  - `didUpdate()` (881-886) queues `update()` on `microtask.read`.
  - `update()` (794-877) runs `updateLayout` (980-1020) on every layout-dirty node in one pass, then
    `notifyLayoutUpdate`.
- **Scroll.**
  - `updateScroll(phase)` (1022-1043) only records offsets for nodes with `options.layoutScroll`.
  - `measure()` (1080-1101) is `measurePageBox()` (1105-1124: the viewport box plus the **root** scroll), then
    `removeElementScroll()` (1126-1156), which removes the offsets of `layoutScroll` path nodes only.
  - So a scroll container that is **not** `layoutScroll` is part of page space: scrolling it moves its contents'
    page boxes. That's harmless upstream, because snapshots are always live.
  - For a scroll clamp caused by the change, the snapshot is from before the clamp and the layout from after.
    Every node in the container animates by the clamp, the popped item and its siblings alike. That is what
    `tests/react/issue-2348.spec.ts` asserts ("moves with the content … scroll position is clamped": the offset
    between item 1 and item 0 stays constant).
- **Scale and the fixed stop for scroll.** `PopChild.tsx`:
  - `measureScale` (39-46) gives an element's on-screen scale.
  - `measurePoint` (63-80) walks `parentElement || parentNode.host`, adds each ancestor's scroll times that
    ancestor's scale, and stops after a `position: fixed` ancestor.
  - The root projection node is a `DocumentProjectionNode` with `layoutScroll: true`
    (`projection/node/HTMLProjectionNode.ts:11-19`). Its parent is the default parent of every top-level node.
  - The layout transition is `options.transition || visualElement.getDefaultTransition()`, read through
    `getValueTransition(layoutTransition, "layout")` (`create-projection-node.ts:581-584, 626`).

### svelte-motion: when we snapshot

- `src/lib/html/_MotionContainer.svelte` (planned-at lines; anchors in backticks):
  - The layout pre-update effect, 2229-2254 (anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`),
    takes a **live** snapshot (`measureLayoutRect('snapshot')`, then `motionDomProjection?.willUpdate()`). It
    only runs when this element's own tracked dependencies change: `trackLayoutProjectionDependencies`,
    2222-2228, which tracks `classProp`, `styleProp`, `scopedLayoutId`, `mergedTransition` and its **own**
    `presenceChildContext.isPresent`. The comment at 2221 says "A sibling's presence change is NOT this
    element's flip." Its commit is `runReactiveCommit`, 2314-2390.
  - The grouped `layoutId`-only pair, 2416-2446 (anchor `const shouldFanOutLayoutIdUpdate`), applies only
    inside a `LayoutGroup`.
  - Everything else comes from the DOM observer effect, 2519-2818 (anchor `const disconnectObservers =
    observeLayoutChanges`):
    - `lastRect` (declared at 2179) is the cached page-space rect.
    - `commitObservedLayout` (2612-2672) does `previous = lastRect; next = measureLayoutRect(); lastRect = next`,
      then, if they differ, `commitObservedLayoutChange(previous, …)` (2666).
    - The keyed-move restart commit at 2555-2566 uses `observerRestartRect`.
    - The grouped commit listener is at 2794-2799 (anchor `const offProjectionCommit`).
  - The 013 lines (`setCompositorHints` at 2567 and 2812-2814) are not this plan's.
- `src/lib/utils/layout.ts`: `observeLayoutChanges` (702-841) decides **when** the container diffs its cache.
  It wires:
  - the element's own `ResizeObserver` and attributes (657-660, 823-825);
  - `{ childList, subtree }` on the **immediate parent only** (`if (index === 0)`, 786-788);
  - style and class attributes on up to `MAX_OBSERVED_ANCESTORS = 4` ancestors (73, 797).

  It holds no rect cache itself and listens to no scroll events. (`measureRect`, 366-400, has a
  `scrollContainers` parameter, but only `layout.spec.ts` calls it.)

  Two consequences:
  - Inside `AnimatePresence`, the immediate parent is the `display: contents` `.animate-presence-container`.
    On the owned path every item has its own container, so a sibling being added, removed or exiting changes
    the `<ul>`'s child list, which no sibling observes.
  - An owned pop only sets `data-motion-pop-id` on the exiting element and adds a `<style>` to `<head>`. No
    sibling observer sees that.
- `src/lib/utils/motionDomProjection.ts` (the adapter around motion-dom's `HTMLProjectionNode`):
  - `willUpdate()` 535-543 and `didUpdate()` 590-595 wrap the upstream calls.
  - `measurePageRect()` 701-728 and `refreshLayout()` 640-662 measure in page space: viewport box plus root
    scroll, minus `layoutScroll` path offsets (`updatePathScroll`, 1457-1468).
  - `lastLayout` is the snapshot cache. It is set from `projection.layout` in `seedLayout` (614),
    `refreshLayout` (651), the grouped `'didUpdate'` listener (449-471) and `refreshCachedLayout` (1471-1485).
  - `latestLayoutBox` is set by `rememberLayoutBox` (919), from the `'measure'` listener (441) and from
    `measurePageRect`.
  - Where the caches are used as a "before" box:
    - `onScreenSnapshot()` 1246-1255 feeds `seedCachedSnapshotsForGroup()` 1207-1225 and
      `seedOwnOnScreenSnapshot()` 1228-1237;
    - `seedCachedSnapshotsForSubtree()` 1288-1323;
    - `commitObservedLayoutChange(previousRect)` 986-1018, through `measurementsFromRect`, 154-160;
    - `currentVisualPageRect()` 832-848, the 006 handoff rect;
    - 006 A1's `takeOverLiveLeadOnMount` (on the layoutid lane), which calls `leadAdapter.onScreenSnapshot()`.

    None of them correct for a scroll that happened after the cache was written.
  - `unmount()` 494-504 seeds the group's members from cache, as `nodeGroup.remove()` would.
  - `commitGroup()` 1038-1047 is LayoutGroup's `forceRender` (`LayoutGroup.svelte:79-81`).
- **Why ours differ from upstream, in one line each.**
  - Who: upstream snapshots every re-rendered node; ours snapshots the element whose inputs changed plus
    whatever its observers catch.
  - When: upstream reads live, before the commit; ours reads live in `$effect.pre` (after earlier DOM writes in
    the same flush) or uses a cache.
  - Scroll: upstream never caches, so a non-`layoutScroll` container scroll can't go stale; our cache includes
    that scroll and is never rebased.
- **The clone path** (`src/lib/utils/presence.ts`, on the presence lane; find it by content):
  - `unregisterChild` inserts the clone into the element's slot (`slotParent.insertBefore(clone, …)`).
  - It then calls `schedulePopLayoutCorrection(clone, …)` (008: `microtask.setup` + `microtask.read`).
  - The exit itself starts on the next `requestAnimationFrame` (`activeExit.frame = requestAnimationFrame(…)`),
    as `animate(clone, exitKeyframes, finalTransition)`.
  - The clone has no projection node, so it never animates a layout move.
  - `measurePopLayoutScale` (008) is upstream's `measureScale`.

### Baselines (008's executor, after A2)

| Case (`e2e/animate-presence/pop-layout-container-move.spec.ts`) | clone | owned |
| --- | --- | --- |
| "moves with the content when the scrollable element's scroll position is clamped" | 1392.4 px | 50.9 px |
| "… positioned scrollable element in a scale(0.5) ancestor …" | 348.1 px | 12.7 px |
| "exiting item stays put when an item is added in the same render" | passes | 51 px |

The five failing cells are `test.fixme`'d. The fixme sits in the clamp loop
(`const pending = query.includes('&scroller')`, anchor `Plan 015`) and on the owned same-render case.

### Conventions

- Test pages:
  - Pages live at `src/routes/tests/<area>/<name>/+page.svelte`, specs at `e2e/<area>/<name>.spec.ts`.
  - A page signals it's ready with `window.MotionIsMounted === true`.
  - Pages reviewed by hand get a `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`) that
    renders nothing under `?@isPlaywright=true`. Exemplar: `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`
    (`isTester` set in `onMount`, :25-29; panel :165-179).
  - Link each page from `src/routes/+page.svelte` (the `owned-pop-layout` link, ~1007, is the model).
- Painted-frame checks use CDP `Page.startScreencast` with `everyNthFrame: 1`, and decode the PNGs in the page.
  Exemplar: `e2e/independent-transforms/speed-change.spec.ts:226-280`. Count every frame, never sample rects.
- Read counting: wrap `Element.prototype.getBoundingClientRect` in `addInitScript` and count per `id`. Exemplar:
  `e2e/layout-id/read-budget.spec.ts:17-38`.
- Unit tests:
  - They run under jsdom (`vitest.config.ts`). jsdom keeps `scrollTop`/`scrollLeft` as plain writable numbers, so
    a test can set them and `dispatchEvent(new Event('scroll'))`.
  - Component specs mock `getBoundingClientRect` per `data-box` (exemplar: 006's
    `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts`).
  - Adapter specs use the `mount` helper of the
    `describe('MotionDomProjectionAdapter node-group gaps (plan 007 Step 4b)')` block in
    `motionDomProjection.spec.ts`.
- Comments cite upstream as `file:line @ v14.7.1`. Public functions, types and constants get Google-style JSDoc.

## Design

Three parts. All of them are bounded: nothing measures layout per frame, and nothing walks the whole tree.

**A. Scroll basis (cached rects survive container scrolls).** New module `src/lib/utils/scrollBasis.ts`.

- `getScrollAncestors(element)` lists the ancestors whose scroll moves `element` in page space and that the
  projection does not already fold in:
  - Walk `parentElement || (parentNode as ShadowRoot).host`, as `measurePoint` does.
  - Skip `document.documentElement`, `document.body` and `document.scrollingElement` (root scroll is in page
    space: `measurePageBox`).
  - Skip elements whose `visualElementStore.get(el)?.projection?.options.layoutScroll` is true
    (`removeElementScroll` removes those).
  - Include elements whose computed `overflowX` or `overflowY` is not `visible`/`clip`.
  - Stop after a `position: fixed` ancestor. If `element` itself is `position: fixed`, return `[]`.
  - Memoize computed style per element in a module `WeakMap`. One `getComputedStyle` per element per page;
    the `layoutScroll` check is not memoized.
- A tracker keeps `seen` (`WeakMap<Element, [x, y]>`): each known container's scroll as of the last moment
  before a change.
  - It is updated by one passive capture-phase `scroll` listener on `document`, filtered to known containers.
  - It is also updated by passive capture-phase `pointerdown`, `keydown` and `click` listeners on `window`. These
    re-read every connected known container, so a programmatic scroll followed by an input-driven change in the
    same frame is still seen. Browsers fire `scroll` at the next rendering opportunity, and 008's spec scrolls
    and clicks within a few milliseconds.
  - Install the listeners when the first container becomes known and remove them when none are left. Prune
    disconnected containers on each sample.
- `ScrollBasis = { ancestors, values }` holds the live offsets read right after a layout read
  (`readScrollBasis`).
- `scrollShift(basis, to = seenScrollBasis(basis.ancestors))` returns
  `{ x: −Σ (to.x − from.x) · scaleX, y: −Σ (to.y − from.y) · scaleY }`.
  - Scale is `measureScreenScale(container)`, upstream `measureScale`. It is read only for containers whose
    offset changed.
  - When `ancestors` is empty, everything is a no-op with zero reads. That is the common case.
- The adapter stamps a basis on every read, and rebases every cached "before" box with `scrollShift` before
  using it.
- The container stamps `lastRect` with the adapter's latest read basis and rebases `previous` before diffing it.

**B. Siblings see presence and list changes (the Svelte stand-in for the parent re-render).** The repo already
substitutes DOM observers for React's re-render (`_MotionContainer.svelte:2471-2476`). Extend their reach in
`observeLayoutChanges`:

- (a) Watch `{ childList, subtree }` on the **layout parent**, the nearest ancestor whose computed `display` is
  not `contents`, instead of always `parentElement`. Fall back to `parentElement` if no such ancestor is within
  `MAX_OBSERVED_ANCESTORS`. Siblings in separate `AnimatePresence` containers then see items being added,
  removed or finishing an exit. Plain and clone lists already get this cost class today, because their immediate
  parent is the list.
- (b) Watch `{ attributes, attributeFilter: ['data-motion-pop-id'], subtree }` on the layout parent, so an owned
  pop and its removal on re-entry reach the siblings. That attribute is set only on pop and re-entry, so it's
  rare.

Each sibling then commits from its rebased cached rect (part A). `commitObservedLayoutChange` calls
`root.didUpdate()`, and motion-dom runs every layout-dirty node in one `update()` pass. That is the
`willUpdate`/`didUpdate` pair, through the root, for exactly the nodes that moved. Gated (`layoutDependency`)
nodes keep their existing gate (`isObservedCommitGated`). Grouped nodes keep their group fan-out.

- (c) **The exiting element's own snapshot comes from its cache on its own presence flip.** In the layout
  pre-update effect, a run where `presenceChildContext.isPresent` changed seeds this node's snapshot from its
  rebased cached layout (`seedOwnSnapshotFromCache()`) instead of `measureLayoutRect('snapshot')` and
  `willUpdate()`. Grouped members are seeded from cache too, never live.
  - Reason: by this effect the flush may already have inserted DOM (case 2), and the cache is the last box seen
    before this update.
  - Every other pre-update run (own class/style/transition/`layoutId` changes) stays live and unchanged.

**C. Clone layout-follow.** After the clone is inserted and 008's correction is queued, `unregisterChild` queues
one more `microtask.read`. It runs after the correction's read, because the queue keeps order.

- It computes the clone's page-space move caused by non-`layoutScroll` containers: `scrollShift(preBasis,
  readScrollBasis(ancestors))`. Here `preBasis = seenScrollBasis(getScrollAncestors(slotParent))`, captured at
  the start of `unregisterChild` with no reads.
- If the move is non-zero, write the starting offset inline before paint. Start
  `animate(clone, { x: [dx, 0], y: [dy, 0] }, layoutTransition)` **in that microtask**, so it starts on the same
  timestamp as the siblings' projection animations. Convert to the clone's local px by dividing by
  `measureScreenScale(clone.offsetParent)`.
- `layoutTransition = getValueTransition(child.mergedTransition, 'layout') ?? child.mergedTransition`, mirroring
  `create-projection-node.ts:581-584, 626`.
- Stop it wherever the exit is cancelled or cleaned up.
- This is the projection-free equivalent of the exiting node's own layout animation upstream, for the pure
  translation a popped clone can have.

**D. Following nodes (the footer case).** Upstream, a `layout` node outside the list animates because the
component that owns the list state re-renders it. `getSnapshotBeforeUpdate` and `componentDidUpdate` run for it
like for any other node (`MeasureLayout.tsx:149-218 @ v14.7.1`), and its parent does not need to be the list.
Svelte gives no re-render signal, so 015 adds one bounded pass, triggered only by the structural observers from
part B:

- **Trigger.** `observeLayoutChanges` gains an optional third argument,
  `{ onLayoutParentChange?: (parent: Element, records: MutationRecord[]) => void }`. It is called from the
  layout parent's `CHILD_LIST_INIT` and `POP_ATTRIBUTE_INIT` handlers (part B). The container passes
  `MotionDomProjectionAdapter.seedFollowingLayout`.
  - It fires only on a child-list change or a pop-attribute change in a layout parent. It never fires on mount,
    on scroll, per frame, on resize, or on style or attribute changes.
- **Dedupe.** The adapter keeps a `WeakSet<MutationRecord[]>`. Every sibling's handler receives the same record
  batch, so the pass runs once per batch, whichever sibling's handler fires first.
- **Scope.**
  - Start at the projection node of the nearest motion ancestor of `parent`: walk
    `parentElement || (parentNode as ShadowRoot).host` and use `visualElementStore.get(el)?.projection`. If
    there is no motion ancestor, start at the projection root.
  - Visit that node's descendants through `children`. Skip any subtree whose `instance` is inside `parent`
    (`parent.contains`); those nodes are the siblings that part B already commits.
  - Pick nodes where `parent.compareDocumentPosition(instance) & Node.DOCUMENT_POSITION_FOLLOWING`. In normal
    flow, a change to `parent`'s content can only move boxes that come after it.
  - Of those, keep only nodes that are mounted, have `layout` or `layoutId`, are not already layout-dirty, are
    not gated (`layoutDependency` set and no drag, the same rule as `isLayoutMeasurementGated`), are not inside
    `[data-layout-size-animation]`, and have a cached layout.
- **Seed.** Call `root.startUpdate()` once. For each picked node, set its snapshot from its rebased
  `onScreenSnapshot()` (part A) with zero reads, run `prepareSnapshotPath`, set `isLayoutDirty = true`, and set
  `presenceSeeded = true` so its `'didUpdate'` listener (installed for every adapter, see Step 5b) refreshes
  `lastLayout` and fires the commit listeners. Then call `root.didUpdate()` once.
  - The update pass measures only the seeded nodes, one read each, once per structural change. This is the same
    work upstream's re-render does: one `willUpdate` per re-rendered node.
  - Nodes that didn't move cost that single read and nothing else. Motion-dom's `notifyLayoutUpdate` finds no
    change.
- **Cache in step.** The container's commit subscription (`onProjectionCommit`) becomes unconditional, so a
  footer that was animated by someone else's pass adopts the new rect, and its own observers don't commit it a
  second time. For an ungrouped adapter, the listener fires only when `presenceSeeded` is set, so ungrouped
  behaviour is otherwise unchanged.
- **Timing.** The MutationObserver callback runs before motion-dom's batcher processes `microtask.read`, so the
  seeded nodes join the same `update()` as the siblings' commits and 008's corrected pop. One pass.

**How this interacts with 006 A1.**
- A1 is a mount-time pass for one node taking over a live `resumeFrom`. 015 adds no mount or unmount trigger and
  never touches `resumeFrom`, stacks or `takeOverLiveLeadOnMount`.
- A1 does benefit from part A: its `leadAdapter.onScreenSnapshot()` is rebased.
- If a sibling's observer commit and an A1 takeover land in the same flush, both just set layout-dirty nodes
  before one `update()`. `didUpdate`'s `updateScheduled` guard and the `animationId <= animationCommitId` repeat
  guard (`create-projection-node.ts:812-815, 881-886`) keep it to one pass.
- Don't duplicate A1's logic anywhere.

**Considered and rejected.**
- A tree-wide live `willUpdate` on every presence change, or PresenceChild seeding the projection parent's
  subtree. On the clone path the DOM has already changed when any library code runs. On the owned path, live
  reads are wrong in case 2. Part D uses cached rects instead, and only for nodes after the changed parent.
- Running part D on every mount or unmount. That would cost a scan per mount, and an initial render of N items
  would be O(N²). Structural observers already batch one record list per change.
- Svelte `out:` transitions as a pre-removal hook. Spike 012 already refuted them for exits; they change when
  the DOM is removed.
- Implicitly treating every scroll container as `layoutScroll`. That diverges from upstream: siblings would jump
  with the clamp instead of animating.
- Refreshing caches on every scroll frame. That would be N reads per frame.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Lane setup | `git -C ../svelte-motion-1471 worktree add ../svelte-motion-1471-siblings -b lane/1471-siblings feat/motion-14.7.1` then `pnpm install --frozen-lockfile` in it | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4223 pnpm exec playwright test <paths>` | all pass (the web server builds first) |
| Build / package | `pnpm build` | exit 0 (runs `svelte-package` + `publint`) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues (`.trunk/trunk.yaml` is the authority; don't run prettier/eslint directly) |

## Scope

**In scope** (the only files you may modify or create):

- `src/lib/utils/scrollBasis.ts` (create) and `src/lib/utils/scrollBasis.spec.ts` (create)
- `src/lib/utils/motionDomProjection.ts`, for the basis stamps and rebases listed in Step 3 and the new public
  members:
  - `get lastReadScrollBasis(): ScrollBasis | null`;
  - `rebaseRect(rect, basis): RectLike`;
  - `seedOwnSnapshotFromCache(): RectLike | null`;
  - an optional `previousBasis` on `commitObservedLayoutChange`'s options;
  - `static seedFollowingLayout(parent: Element, records: MutationRecord[]): void` (part D), and the
    `'didUpdate'` listener installed for every adapter (acting for ungrouped adapters only when
    `presenceSeeded` is set).

  Also `src/lib/utils/motionDomProjection.spec.ts`, as new `describe` blocks only.
- `src/lib/utils/layout.ts`, only `observeLayoutChanges` (702-841) and a new `POP_ATTRIBUTE_INIT` next to the
  other inits (657-666). Also `src/lib/utils/layout.spec.ts`, as a new `describe` only.
- `src/lib/html/_MotionContainer.svelte`, only these regions (planned-at; locate by anchor):
  - R1: the observer-cache declarations, 2179-2181 (anchor `let lastRect: RectLike | null = null`);
  - R2: the layout pre-update effect, 2229-2254 (anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`);
  - R3: `runReactiveCommit`, 2314-2390 (only its `lastRect = next`, 2350);
  - R4: the observer effect, 2519-2818. Only:
    - the `lastRect`/`observerRestartRect` assignments (2524-2525, 2539, 2546, 2584, 2622, 2697, 2748, 2752,
      2796, 2809-2811);
    - `commitObservedLayout`'s diff (2612-2672) and the restart commit (2555-2566);
    - the `observeLayoutChanges(element!, …)` call (2758), which gets the part D option;
    - the `offProjectionCommit` subscription (2794-2799), which becomes unconditional. **Do not touch** 013's `setCompositorHints` lines (2567, 2812-2814) or anything
    006/007/008 added.
- `src/lib/utils/presence.ts`:
  - `unregisterChild`, between the clone insert and the exit's `requestAnimationFrame`, plus every place an
    active exit is cancelled or cleaned up (stop the follow);
  - the `ActiveExit` type (one optional `layoutFollow` field);
  - `measurePopLayoutScale`, whose body becomes a call to `measureScreenScale`. Keep its export and name.
- `src/lib/utils/presence.spec.ts`, new cases inside `describe('popLayout layout behavior')`
- `src/lib/components/__tests__/PresenceSiblingsHarness.svelte` (create),
  `src/lib/components/presenceSiblingSnapshots.spec.ts` (create)
- `e2e/animate-presence/pop-layout-container-move.spec.ts`, only removing the five `fixme`s and their
  `Plan 015` comments
- `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte` (create),
  `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (create)
- `src/routes/+page.svelte` (one link after the `pop-layout-container-move` link)
- `.changeset/sibling-layout-snapshots.md` (create)

**Out of scope** (do NOT touch):

- `src/lib/components/PresenceChild.svelte`, `AnimatePresence.svelte`, `src/lib/utils/presenceExitRegistry.ts`,
  `LayoutGroup.svelte`. The fix needs no PresenceChild code, and 012's prototypes edit these files.
- 006's `_MotionContainer.svelte` effects (handoff rect, consume, `switchLayoutId` pair), 007's option plumbing,
  008's lines 696 and 718-723, 013's `setCompositorHints` lines.
- `commitPresenceLayoutRelease` (wait-mode hold, `detail.previousRect`). It's the same staleness class, but a
  separate path with its own `viewportScrolledDuringHold` rule. Listed under Maintenance.
- `measureRect` in `layout.ts` (dead outside specs), 008's page, the 008 playground, `node_modules/motion-dom`,
  docs, `package.json` (`"version"`), PR labels.

## Git workflow

- Lane `lane/1471-siblings` in `../svelte-motion-1471-siblings`, created by hand (above). Don't use
  `isolation: 'worktree'`, which forks `origin/main`.
- Conventional commits, one per step. For example:
  - `test(layout): siblings snapshot before presence and list changes (plan 015)`
  - `fix(layout): rebase cached layouts across scroll-container scrolls`
  - `fix(layout): siblings in separate AnimatePresence containers observe list and pop changes`
  - `fix(presence): exit clones follow the layout move their element would animate`

  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

1. **Un-fixme 008's five cases** in `e2e/animate-presence/pop-layout-container-move.spec.ts`: remove the
   `pending` condition in the clamp loop and the owned same-render `fixme`, along with their `Plan 015` comments.
   Don't restructure the spec.
2. **`src/lib/utils/scrollBasis.spec.ts`.** Import from `./scrollBasis` (it doesn't exist yet). Cases:
   - `getScrollAncestors` includes `overflow: auto|scroll|hidden` ancestors and excludes `visible`;
   - it excludes `html`, `body` and `document.scrollingElement`;
   - it returns `[]` for a `position: fixed` element and stops after a fixed ancestor;
   - it crosses a shadow root via `host`;
   - it skips an element whose `visualElementStore` entry has `projection.options.layoutScroll === true`;
   - `seen` updates on a `scroll` event, and also on a `click` dispatched on `document` with no scroll event;
   - `scrollShift` gives `{ x: 0, y: -500 }` after `scrollTop` goes 0 → 500, and `-250` when the container
     measures at `scale(0.5)` (mock its `getBoundingClientRect` height to half its `offsetHeight`);
   - zero reads when there are no ancestors (spy on `getBoundingClientRect` and `getComputedStyle`: no
     `getBoundingClientRect` calls).
3. **`motionDomProjection.spec.ts`**, new
   `describe('MotionDomProjectionAdapter scroll-rebased snapshots (plan 015)')`, using a container
   `<div style="overflow:auto">` with mocked rects:
   - after `scroller.scrollTop = 500` plus a `scroll` event, and the element's mocked rect moved up 500,
     `MotionDomProjectionAdapter.commitGroup(group)` seeds a member's `projection.snapshot.layoutBox.y.min` at
     the **rebased** value (old − 500). **RED today** (the stale value).
   - `currentVisualPageRect()` after the same scroll is rebased. **RED.**
   - `commitObservedLayoutChange(previous, { previousBasis })` seeds the rebased rect. **RED** (the option
     is ignored or missing).
   - with no scroll ancestors, `lastReadScrollBasis` is `null` and the snapshots are unchanged. Guard.
4. **`layout.spec.ts`**, new `describe('observeLayoutChanges layout parent (plan 015)')`, using real
   `MutationObserver` (jsdom) and a stubbed `ResizeObserver`:
   - with the parent `display: contents`, appending a child to the grandparent calls `onChange`. **RED.**
   - setting `data-motion-pop-id` on a sibling under the layout parent calls `onChange`. **RED.**
   - a sibling's `style` change does not. Guard.
5. **Component spec "siblings snapshot on a presence change".** Create
   `src/lib/components/__tests__/PresenceSiblingsHarness.svelte`: a `motion.ul` with three items, each its own
   `<AnimatePresence present={items[i].present} mode={mode}>` with `child` = `<motion.li layout data-box="item-{i}" id="item-{i}">`.
   Props are `items` and `mode`, plus `addFirst`, which prepends a new item in the same update. Create
   `src/lib/components/presenceSiblingSnapshots.spec.ts`. Use the `onExitCompleteTiming.svelte.spec.ts` set-up
   (mock `motion`'s `animate`, stub `ResizeObserver`) and mock rects from `data-box`, moved by test state. Cases,
   each listening to `visualElementStore.get(item0).projection.addEventListener('didUpdate', …)`:
   - popLayout, item 1 exits, and the mocked rect of item 0 moves +70 once item 1 has `data-motion-pop-id`:
     item 0's `didUpdate` fires once, with `snapshot.layoutBox.y.min` at the old top and
     `layout.layoutBox.y.min` 70 lower. **RED** (it never fires).
   - sync, item 1's exit completes (its element is removed) and item 2 moves up 70: item 2's `didUpdate` fires
     with the pre-removal snapshot. **RED.**
   - popLayout, item 0 exits while an item is added in the same update, with item 0 mocked 70 up after the
     insert: item 0's own seeded snapshot equals its **pre-insert** box (`snapshot.layoutBox.y.min` unchanged).
     **RED** (the live read sees the inserted item).
   - a sibling with `layoutDependency={1}` (unchanged) gets no `didUpdate`. Guard.
   - **footer**: the harness's `footer` prop renders `<motion.div layout id="footer" data-box="footer">` after
     the `motion.ul`, in the same component, with no `LayoutGroup`. It also renders a
     `<motion.div layout id="header">` before the list. For both the owned path and a clone-path variant
     (`clone` prop: one `AnimatePresence` around a keyed `{#each}`), in sync mode, item 1's exit completes and
     the footer's mocked rect moves up 70. The footer's `didUpdate` fires once, with the pre-removal snapshot.
     **RED** (the footer snaps). The header gets no `didUpdate` and no `getBoundingClientRect` call in that pass.
     Guard.
   - Adapter unit, in `motionDomProjection.spec.ts`,
     `describe('MotionDomProjectionAdapter.seedFollowingLayout (plan 015)')`:
     - it seeds a following node from its rebased cache;
     - it skips preceding nodes, nodes inside `parent`, gated nodes, dirty nodes and unmounted nodes;
     - it runs once for the same `records` array passed twice;
     - it calls `root.didUpdate()` once;
     - it leaves `resumeFrom` and stack membership untouched.

     **RED** (method missing).
6. **Clone follow** in `presence.spec.ts`. Model it on 008's clone cases. A child in an `overflow:auto` scroller
   is tracked with `scrollTop = 500` (dispatch `scroll`), then unregistered. Before draining microtasks, set
   `scrollTop = 430` (the clamp) and give the clone a mocked rect 70 lower. Drain two microtasks. Expect the
   mocked `animate` to have been called with `{ y: [-70, 0] }` and the layout transition, **before** the exit's
   rAF call. **RED.** Guard case: with no scroll change, there is no follow `animate` call.
7. **New page and spec** (see Test plan for their content). Run them: **RED** on both paths.

**Verify**:
- `pnpm exec vitest run src/lib/utils/scrollBasis.spec.ts` → fails to import (module missing).
- The cases marked RED in items 3–6 fail with the stated values, and the guards pass.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → exactly the
  five un-fixmed cases fail, with numbers close to the baselines (clone 1392/348 px, owned 51/13 px, owned
  same-render 51 px). Record them. If any of the five passes now, or another case fails, STOP.

Commit (`test(layout): siblings snapshot before presence and list changes (plan 015)`).

### Step 2: `scrollBasis.ts`

Implement the module exactly as "Design A" describes, with Google-style JSDoc on every export (`ScrollBasis`,
`getScrollAncestors`, `readScrollBasis`, `seenScrollBasis`, `scrollShift`, `measureScreenScale`). The file
header cites `PopChild.tsx:39-46, 63-80` and `create-projection-node.ts:1022-1043, 1105-1156` @ v14.7.1, and
says why `seen` is also refreshed on input events. Make `presence.ts`'s `measurePopLayoutScale` delegate to
`measureScreenScale`. `scrollBasis.ts` must not import `presence.ts` (cycle).

**Verify**: `pnpm exec vitest run src/lib/utils/scrollBasis.spec.ts` → all pass;
`pnpm exec vitest run src/lib/utils/presence.spec.ts` → only Step 1.6's case still fails.

### Step 3: Rebase the adapter's caches

In `motionDomProjection.ts`:

1. `private scrollAncestors`: computed in `mount()` and recomputed in `seedLayout()`/`refreshLayout()` when
   `element.parentElement` differs from the one it was computed for. When it's empty, skip everything below.
2. Stamp a basis right after each read:
   - in the `'measure'` listener (441) → `projectionLayoutBasis`;
   - in `rememberLayoutBox` (919) → `latestReadBasis`.
   - Every `this.lastLayout = cloneMeasurements(this.projection.layout)` (seedLayout, refreshLayout, the
     `'didUpdate'` listener, both places in `refreshCachedLayout`) also sets
     `lastLayoutBasis = projectionLayoutBasis`.
3. Add a private `rebaseMeasurements(m, basis)`. It clones `m` and translates `layoutBox` and `measuredBox` on
   both axes with `translateAxis` (from motion-dom) by `scrollShift(basis)` (pattern: `shiftFollowingDescendants`,
   1265-1285). Apply it in:
   - `onScreenSnapshot()`: the target branch with `projectionLayoutBasis`, the cached branch with
     `lastLayoutBasis`;
   - `seedCachedSnapshotsForSubtree()`: each `adapter.lastLayout` with that adapter's `lastLayoutBasis`;
   - `currentVisualPageRect()`: on the base box, with the basis that matches the base it picked.
4. Public:
   - `get lastReadScrollBasis()`;
   - `rebaseRect(rect, basis)` (identity for a `null` basis);
   - `commitObservedLayoutChange(previousRect, { ownSubtreeChanged?, previousBasis? })` rebases `previousRect`
     before `measurementsFromRect`;
   - `seedOwnSnapshotFromCache()`: `root.startUpdate()`, then `seedOwnOnScreenSnapshot()`, then
     `seedCachedSnapshotsForGroup()`. It sets `hasTakenAnySnapshot = true` and returns the rebased page rect it
     seeded, or `null` if it couldn't seed.

   Each gets Google-style JSDoc with an `@example`.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts` → the Step 1.3 cases pass and
every existing case passes, including 006's `switchLayoutId` block and 007's node-group blocks.

### Step 4: The container uses rebased rects (R1–R4)

1. R1: add `let lastRectBasis: ScrollBasis | null = null`, `let observerRestartBasis: ScrollBasis | null = null`
   and
   `const setLastRect = (rect: RectLike | null) => { lastRect = rect; lastRectBasis = rect ? (motionDomProjection?.lastReadScrollBasis ?? null) : null }`.
2. R3/R4: replace every `lastRect = …` with `setLastRect(…)`. Save and restore `observerRestartBasis` alongside
   `observerRestartRect`.
3. In `commitObservedLayout`, use `previous = motionDomProjection?.rebaseRect(lastRect, lastRectBasis) ?? lastRect`
   **before** `hasRectChanged`, `isFollowingAncestorUpdate`, `emitProjectionUpdate` and `computeFlipTransforms`.
   Pass `{ previousBasis: null }` (it's already rebased), keeping `ownSubtreeChanged`. Do the same for the
   restart commit with `observerRestartBasis`.
4. R2: track `let lastSeenOwnPresence = presenceChildContext?.isPresent` (initialised untracked). On a run where
   `pass === 'update'` and the own presence value changed, call
   `explicitLayoutSnapshot = motionDomProjection?.seedOwnSnapshotFromCache() ?? measureLayoutRect('snapshot')`.
   Call `willUpdate()` only in the fallback. Every other run is unchanged. Comment it, citing
   `MeasureLayout.tsx:149-204 @ v14.7.1` (pre-commit snapshot) and case 2.

**Verify**:
- `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` → only the declaration and `setLastRect`'s body.
- `pnpm check` → 0 errors.
- `pnpm exec vitest run src/lib/html src/lib/components` → all pass except the Step 1.5 cases that need Step 5.
  Case 3 ("item added in the same update") must pass now.

### Step 5: Observers reach the siblings

In `layout.ts`:

- Add `POP_ATTRIBUTE_INIT = { attributes: true, attributeFilter: ['data-motion-pop-id'], subtree: true }`.
- In `wireAncestors`, resolve the layout parent: the first entry in `observedAncestors` whose
  `getComputedStyle(ancestor).display !== 'contents'`, or `observedAncestors[0]` if there's none.
- Acquire `CHILD_LIST_INIT` and `POP_ATTRIBUTE_INIT` on it instead of `childList` on index 0.
- Keep the ancestor attribute observers as they are.
- Update the JSDoc of `observeLayoutChanges` and the index-0 comment: why `display: contents` is skipped, and the
  upstream re-render this stands in for (`MeasureLayout.tsx:149-218 @ v14.7.1`).

**Verify**: `pnpm exec vitest run src/lib/utils/layout.spec.ts src/lib/components/presenceSiblingSnapshots.spec.ts`
→ all pass. Then
`PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → all **owned**
cases pass. Clone clamp cases: the 1392/348 px jumps are gone, but they may still fail by about 51/13 px until
Step 6. Record the numbers.

### Step 5b: Following nodes (part D)

1. `layout.ts`:
   - Add the optional `{ onLayoutParentChange }` argument to `observeLayoutChanges`, with JSDoc.
   - Give the layout parent's `CHILD_LIST_INIT` and `POP_ATTRIBUTE_INIT` subscriptions a handler that calls
     `schedule()` and then `onLayoutParentChange?.(layoutParent, records)`. The registry already passes
     `records` (`MutationHandler`).
2. `motionDomProjection.ts`:
   - Implement `static seedFollowingLayout` exactly as "Design D" says, with Google-style JSDoc that cites
     `MeasureLayout.tsx:149-218` and `create-projection-node.ts:708-791, 881-886` @ v14.7.1, and states the bound.
   - Install the `'didUpdate'` listener in `mount()` for every adapter. For an ungrouped adapter, act only when
     `presenceSeeded` is set, then clear the flag.
3. `_MotionContainer.svelte` R4:
   - Pass `{ onLayoutParentChange: MotionDomProjectionAdapter.seedFollowingLayout }` at the
     `observeLayoutChanges` call.
   - Make the `offProjectionCommit` subscription unconditional. Keep its body
     (`setLastRect(rect); observerCommitSerial += 1`).

**Verify**:
- `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts src/lib/components/presenceSiblingSnapshots.spec.ts src/lib/utils/layout.spec.ts`
  → all pass, including the footer cases.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-scroll-siblings.spec.ts -g footer`
  → passes on both paths.

### Step 6: Clone layout-follow

Implement "Design C" in `unregisterChild`:

- Capture `preBasis` at function entry, with no reads.
- Queue the `microtask.read` right after `schedulePopLayoutCorrection` (or right after the insert when there is no
  pop snapshot).
- Store the animation on `activeExit.layoutFollow`, and `stop()` it wherever `activeExit.cancelled` is set or the
  clone is removed.
- If `exitKeyframes` animates `x` or `y` itself, apply the follow as that track's start offset
  (`[from + d, target]`, with the exit's transition) instead of a second animation on that axis. Say so in a
  comment.

**Verify**: `pnpm exec vitest run src/lib/utils/presence.spec.ts` → all pass.
`PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
→ all pass on both paths.

### Step 7: Guards, changeset, gate

1. Guards, all must pass. Re-run a failing spec alone once before reporting it, and say so.

   `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/independent-transforms/layout-rotating-3d.spec.ts`

   This includes these read-count specs: `e2e/layout-id/read-budget.spec.ts`,
   `e2e/layout/layout-group-parity/layout-group-interrupt-measurements.spec.ts`,
   `e2e/layout/layout-group-parity/relative-child-measurements.spec.ts`, `e2e/layout/layout-dependency.spec.ts`,
   and the read-budget cases of the new spec. None of their budgets may be raised.
2. `.changeset/sibling-layout-snapshots.md`:
   ```md
   ---
   '@humanspeak/svelte-motion': patch
   ---

   Layout animations around `AnimatePresence` and list changes match Motion: siblings in separate
   `AnimatePresence` boundaries, and `layout` elements after the list (such as a footer), now animate when an
   item is added, removed, or popped out with `mode="popLayout"`, and an exiting element's own animation starts from where it was even when an item is
   added in the same update. Cached layouts now account for scroll containers that aren't `layoutScroll`, so
   scrolling a list and then changing it no longer makes its items jump by the scroll distance, and `popLayout`
   exit clones move with the content when the scroll position is clamped.
   ```
3. Gate, in order:
   - `trunk fmt` then `trunk check` on every changed file;
   - `pnpm check` → 0 errors;
   - `pnpm test:only` → all pass;
   - `pnpm build` → exit 0;
   - the Step 7.1 e2e set → all pass;
   - `git status` → only in-scope files.

## Test plan

- **Red anchors**:
  - 008's five un-fixmed cases (baselines above);
  - Step 1.3 (three rebase cases);
  - Step 1.4 (two observer cases);
  - Step 1.5 (three sibling or own-snapshot cases; this is the unit test that pins sibling snapshots on a
    presence change);
  - Step 1.6 (clone follow);
  - the new page's painted-frame cases.

  All of them pass after Step 6.
- **New page** `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`:
  - Header comment cites #2348, `MeasureLayout.tsx:149-218` and plan 015.
  - Query params: `path=owned|clone` (default `clone`), `mode=popLayout|sync` (default `popLayout`),
    `layoutScroll`.
  - Layout: a `#scroller` that is 320 px tall with `overflow: auto` (a `motion.div layoutScroll` when the param is
    set, otherwise a plain `div`). Inside it, a 600 px spacer, then a `motion.ul` of five `motion.li layout`
    items, 150×60 with a 10 px gap, `transition={{ type: 'spring' }}`, `exit={{ opacity: 0 }}`.
    - The `id`s are `sib-0` to `sib-4`.
    - Colours: `sib-1` `#0077ff`, `sib-2` (the one that exits) `#ff0088`, `sib-3` `#00aa44`, the rest `#888`.
    - The owned path wraps each item in its own `<AnimatePresence present child>`, as 008's page does.
  - Buttons: `data-testid="scroll-bottom"` and `data-testid="remove"` (removes `sib-2`).
  - `TesterPanel` (hidden under `?@isPlaywright=true`), with steps:
    1. "Scroll to bottom".
    2. "Remove the pink item". Expected: the blue item slides down together with the pink one, the gap between
       them never changes, and the green item doesn't move.
    3. Repeat with `?mode=sync`. Expected: after the fade, blue and the items above slide into the space; nothing
       jumps.
  - Live read-only verdict chips from an rAF sampler (for the human only): `GAP HOLDS · max drift Npx` and
    `NO JUMP · max frame step Npx`.
  - A status line: "Expected on this build: both chips green on both paths."
  - Link it from `src/routes/+page.svelte` as "popLayout siblings in a scroll container (plan 015)".
- **New spec** `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`, real clock, for each path:
  - "a sibling moves with a popped exit when the scroll container clamps". Painted frames: CDP screencast with
    `everyNthFrame: 1` from the click until 600 ms. For every frame, find the top row of each colour band (at
    least 20 matching pixels).
    - In every frame where pink is visible, `|(top_pink − top_blue) − gap₀| ≤ 2` CSS px.
    - In every frame, green's top is within 2 px of its pre-click top.
    - No colour moves more than 35 px between consecutive frames.
    - At the middle frame, `document.elementFromPoint` at blue's centre hits `#sib-1`.
  - "siblings slide, not jump, when a sync exit completes in a scrolled container" (`?mode=sync`): the same frame
    rules for blue and green, from the click until the exit has finished plus 600 ms.
  - "with layoutScroll the content just moves": the gap holds, no frame step is above 35 px, and no layout
    transform shows on blue (guard).
  - Read budget (wrapped `getBoundingClientRect`, counted per `id`):
    - Scrolling `#scroller` in 30 rAF-spaced steps makes **0** reads on `sib-0`, `sib-1`, `sib-3` and `sib-4`.
    - On the clone path, and on the owned path with `mode=sync`, a removal makes at most **3** reads per sibling
      within 500 ms, then **0** over the next 500 ms.
    - On owned `popLayout`, assert only the idle 0: 008 A2's resting-point cache samples per frame while things
      move, which is outside this plan.
  - **Footer scenario** (`?footer`):
    - Page: no scroller. A `motion.div layout id="header"` (`#aa00ff`) comes before the list, the same
      `motion.ul` list follows, and then `motion.div layout id="footer"` (`#ffaa00`), all in the page component
      with no `LayoutGroup`.
    - TesterPanel step: "Remove the pink item (sync). Expected: after the fade, the orange footer slides up 70 px;
      it never jumps."
    - "a layout footer after the list animates when an item leaves" (both paths, `mode=sync`): every painted
      frame from the click until the exit ends plus 600 ms. Orange never moves more than 35 px between
      consecutive frames, and ends 70 ± 2 px higher. **RED** today (one 70 px step).
    - The same with `mode=popLayout`: the footer slides as soon as the item pops. **RED.**
    - Read budget for part D: one removal costs the footer at most **2** reads within 500 ms and **0** over the
      next 500 ms. `#header` (before the list) gets **0** reads. Scrolling the page in 30 rAF-spaced steps gets
      **0** reads on header, footer and items.
- Structural models: `owned-pop-layout/+page.svelte`, `speed-change.spec.ts`, `read-budget.spec.ts`,
  `onExitCompleteTiming.svelte.spec.ts`, `layoutIdChange.svelte.spec.ts`.

## Done criteria

- [ ] `grep -n "Plan 015\|test.fixme" e2e/animate-presence/pop-layout-container-move.spec.ts` prints nothing, and
      that spec passes on both paths.
- [ ] `grep -n "export const scrollShift\|export const getScrollAncestors" src/lib/utils/scrollBasis.ts` prints
      two lines.
- [ ] `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` prints only the declaration and `setLastRect`.
- [ ] `grep -n "POP_ATTRIBUTE_INIT" src/lib/utils/layout.ts` prints at least two lines.
- [ ] `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` prints one line, and the
      footer unit, e2e and read-budget cases pass.
- [ ] The Step 1 unit cases and the new e2e spec pass. The Step 7.1 suites pass, with no read budget raised.
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` is clean.
- [ ] The page is linked from `src/routes/+page.svelte`, the changeset exists, and
      `git diff --name-only feat/motion-14.7.1...HEAD` lists only in-scope files.

## STOP conditions

- Any precondition grep prints nothing, or an excerpt's content no longer matches.
- **A fix seems to need a full-tree measure every frame, or any layout read per scroll frame.** Report instead.
  This also applies to part D: if it seems to need running on mount, unmount, resize or per frame, or measuring
  nodes before `parent`, STOP.
- A read-count guard (`read-budget`, `layout-group-interrupt-measurements`, `relative-child-measurements`,
  `layout-dependency`, `layout-rotating-3d`, the new spec's budget) needs its budget raised.
- One change animates twice, or fires `onProjectionUpdate` twice, or a running animation restarts from its
  origin. 006 already has this STOP; it applies here too.
- The owned `layout` cases of 008's spec drift by about the container move, meaning the projection measured
  before 008's correction. Report the microtask order you observed. Don't move the correction.
- The clone follow and the clone's exit interfere: the scale or opacity exit is lost, or the translate snaps in a
  painted frame. Report it rather than reshaping the exit animation.
- Part B(c) (the cached own snapshot) breaks any own-presence case that a live read passed before, for example a
  re-entry mid-exit. Report it; don't widen the cached path to other runs.
- The fix needs an out-of-scope file, PresenceChild.svelte in particular.
- Any guard suite fails twice after a reasonable fix inside scope.

## Ordering against 012 and 013 (recommendation)

- **013** edits the same observer effect (`setCompositorHints` at planned-at 2567 and 2812-2814), next to
  R4's assignments. It is S effort and LOW-MED risk.
- **012** (spike) prototypes in `presence.ts` `unregisterChild` and `PresenceChild.svelte`, where part C lives.
  Its crossfade measurements depend on how siblings snapshot.

**Recommended order**: cut this lane alongside 013's (both need 006 + A1, 007 and 008 merged) and run them in
parallel. **Merge 013 first, then 015, then let 012 start.**
- 015 merges `feat/motion-14.7.1` into its lane before merging back, resolves the observer-effect conflict
  (keep 013's deletions and 015's `setLastRect` calls), and re-runs the Step 7.1 suites.
- 012 merges `feat/motion-14.7.1` into its lane before starting, as the README already requires, so it
  prototypes on top of part C.

Reason: the smaller, surgical diff lands first and the larger one absorbs the conflict. 012's report and touch
list would be stale if written against a `presence.ts` without part C.

## Maintenance notes

- `getScrollAncestors` memoizes computed style per element for the page's lifetime. An ancestor whose `overflow`
  or `position` changes after its descendants first measured isn't re-detected until they remount. If that shows
  up, invalidate the memo from the `scroll` capture listener when an unknown element scrolls.
- `seen` is "last scroll before the change". A programmatic scroll and a DOM change in the same task, with no
  input event between them, still uses the older value. The upstream equivalent reads live.
- Part D's bound assumes normal flow: a change inside `parent` moves only the boxes after it. If a parity case
  shows a node *before* the list moving (for example the list sits inside an end-aligned flex column), widen the
  pick to "the following nodes, plus the preceding siblings of `parent`'s nearest flex or grid ancestor". Keep it
  a per-structural-change pass. Part D's cost is one read per seeded node per change; watch the read-budget case
  when it is touched.
- `commitPresenceLayoutRelease` (wait-mode hold) still diffs an un-rebased `previousRect`. Same class; follow-up.
- If 012's build gives exit clones a stand-in projection node, part C (`activeExit.layoutFollow`) becomes
  redundant. Delete it then.
- Reviewers should check:
  - the sign and scale in `scrollShift`;
  - that every `lastLayout` write updates `lastLayoutBasis`;
  - that `previous` is rebased before every comparison, not just before the commit;
  - that part C's microtask is queued after 008's correction.
