# Plan 015: Layout nodes snapshot before a presence or list change the way upstream's re-render does, and cached layouts survive scrolls

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
> **Requires plans 006 (with amendment A1), 007 and 008 (with amendments A1–A3, `propagate` and the playground),
> all merged into `feat/motion-14.7.1`.** Before starting, confirm each command prints at least one line,
> otherwise STOP:
> - `grep -n "switchLayoutId" src/lib/utils/motionDomProjection.ts` (006)
> - `grep -n "takeOverLiveLeadOnMount" src/lib/utils/motionDomProjection.ts` (006 A1)
> - `grep -n "layoutRoot?: boolean" src/lib/types.ts` (007)
> - `grep -n "schedulePopLayoutCorrection" src/lib/utils/presence.ts` (008)
> - `grep -n "pendingPop" src/lib/components/PresenceChild.svelte` (008 A1)
> - `grep -n "createPopLayoutPointCache" src/lib/utils/presence.ts` (008 A2)
> - `grep -n "Plan 015" e2e/animate-presence/pop-layout-container-move.spec.ts` (008 A3: the `fixme`s)
>
> **Drift check (run first)**:
> `git diff --stat 30290164..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/layout.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte src/lib/components/PresenceChild.svelte e2e/animate-presence/pop-layout-container-move.spec.ts src/routes/+page.svelte`
> Expected: changes from 006, 007, 008 (and 013 if it merged first; see "Ordering"). Line numbers are at
> `30290164` (`feat/motion-14.7.1`) unless marked as lane lines. Lane lines are at `lane/1471-layoutid`
> `9d65b671` and `lane/1471-presence` `66dd8954`. Merges shift all of them, so **find every excerpt by content**
> (each has a `grep` anchor). If an excerpt's content is gone or different, STOP.

## Status

- **Priority**: P1 (ships in 2.7.0; a scrolled list jumps by the whole scroll distance)
- **Effort**: L
- **Risk**: MED-HIGH. Every observed layout commit goes through a scroll rebase, owned lists observe a wider
  subtree, and completed-exit removals change from "animate" to upstream's "snap" for nodes outside the exiting
  `AnimatePresence`. The guard suites exist to catch mistakes in each.
- **Depends on**:
  - 006 + A1. Its `takeOverLiveLeadOnMount` reads `onScreenSnapshot()`, which this plan rebases, and its
    `_MotionContainer.svelte` effects sit between this plan's regions.
  - 007. Same adapter plumbing.
  - 008 + amendments. This plan builds on 008's `presence.ts` helpers and page, and un-fixmes its five cases.
- **Wave**: 4, alongside 013. Lane `siblings`, cut from `feat/motion-14.7.1` once 006 (with A1), 007 and 008
  have merged.
- **Category**: bug (upstream parity)
- **Planned at**: commit `30290164` (`feat/motion-14.7.1`), 2026-10-28. Revised after a cold review against
  upstream v14.7.1, `30290164`, the layoutid lane at `9d65b671` and the presence lane at `66dd8954`.

## Why this matters

Upstream gets "snapshot before the DOM changes" for free from React's render model. svelte-motion gets it only
for an element whose own props change. Everything else is diffed after the fact against cached rects, and those
rects go stale when a scroll container without `layoutScroll` scrolls. The visible results, which also account
for 008's five `test.fixme`s:

1. **Owned popLayout siblings snap.** With each item in its own `<AnimatePresence present>`, the pop is a
   `data-motion-pop-id` attribute plus a `<style>` in `<head>`, and no sibling observes it. When the pop clamps
   `#scroller`, the exiting item animates its move and the item above it snaps: 50.9 px off (12.7 px at
   `scale(0.5)`).
2. **Owned exit plus an add in the same render.** The exiting element's own snapshot is a live read in
   `$effect.pre`. That runs after the page's `{#each}` inserted the new toast, so the read is about 69 px off
   (51 px at 100 ms).
3. **Clone path after a scroll.** Cached rects predate the scroll, so items that never moved get 1392.4 px layout
   transforms (348.1 px at `scale(0.5)`).
4. **A `layout` footer outside the list's parent snaps** when an item is added or popped. Upstream animates it,
   because the component that owns the list state re-renders it.

Once this plan lands, each node animates exactly when upstream's render model would make it `willUpdate`, from
where it was, and caches stay valid across scrolls. Where upstream **snaps**, this plan snaps too and pins that
with parity guards: siblings outside the `AnimatePresence` whose exit completed, without a `LayoutGroup`.

## Current state

### Upstream render model (verified at `~/Github/motion`, `git show v14.7.1:<path>`)

- **Who snapshots.** `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`:
  - `getSnapshotBeforeUpdate` (149-204) runs for every node in the render. It calls `willUpdate()` (183) unless
    `layoutDependency` gates it (177-186).
  - `componentDidUpdate` (206-218) calls `root.didUpdate()` (210).
  - `componentDidMount` (116-147) only calls `root.didUpdate()` (125-127).

  Which nodes are "in the render" depends on what changed:
  - **A state change in a component** (remove, add, cycle, or an owned `present` flip) re-renders that
    component's whole subtree. Siblings and a footer in that component all snapshot.
  - **An exit completing** re-renders only that `AnimatePresence`: `setDiffedChildren([])`
    (`components/AnimatePresence/index.tsx:244`).
    - Its own other children re-render only because `presenceAffectsLayout` gives each `PresenceChild` a new
      context object (`PresenceChild.tsx:91-98`), and their `MeasureLayout` consumes it through `usePresence`.
    - Nodes outside that `AnimatePresence` (a sibling in another boundary, a footer) do not re-render, so they
      **snap**.
    - Only inside a `LayoutGroup` does `forceRender?.()` (`index.tsx:206, 236-237`, deferred to
      `frame.postRender`, `utils/use-force-update.ts:19-22`) re-render the group so its members animate.
    - `scheduleCheckAfterUnmount` (`create-projection-node.ts:913-926`) only calls `didUpdate()` for a dirty
      node, i.e. one in a group.
- **Groups.** `motion-dom/src/projection/node/group.ts:12-37`. One member's `"willUpdate"` calls
  `willUpdate(false)` on every other member (`notify` 3-4, `dirtyAll` 16), and `remove()` does the same (33).
- **What a snapshot measures.** `motion-dom/src/projection/node/create-projection-node.ts`:
  - `willUpdate()` (708-791) runs `startUpdate()` (735), then `updateScroll("snapshot")` along the path (763),
    then `updateSnapshot()` (787 → 967-978, `this.measure()`, a **live** read).
  - `didUpdate()` (881-886) queues `update()` on `microtask.read`.
  - `update()` (794-877) skips repeats: `animationId <= animationCommitId` (825-828).
  - The default layout transition is `{ duration: 0.45, ease: [0.4, 0, 0.1, 1] }` (2546-2549). It is resolved as
    `options.transition || visualElement.getDefaultTransition() || defaultLayoutTransition` (581-584), then
    `getValueTransition(…, "layout")` (626).
- **Page space.**
  - `measurePageBox()` (1105-1124) is the viewport box plus the root scroll, unless a path node `wasRoot`.
  - `removeElementScroll()` (1126-1156) subtracts only `layoutScroll` path nodes.
  - `updateScroll()` (1022-1043) records offsets only for `layoutScroll` nodes.
  - `checkIsScrollRoot` is `position === "fixed"` (`HTMLProjectionNode.ts:23-24`). The root is a
    `DocumentProjectionNode` with `layoutScroll: true` (11-19).
  - Consequences:
    - (i) A non-`layoutScroll` scroller is part of page space. A clamp animates every node in it, as
      `tests/react/issue-2348.spec.ts` asserts.
    - (ii) With `layoutScroll`, the clamp is a content-space no-op: the nodes jump with the content in one frame.
    - (iii) A `position: fixed` element's page box moves with window scroll.
- **Scale and the fixed stop.** `PopChild.tsx`: `measureScale` (39-46) and `measurePoint` (63-80), which walks
  `parentElement || parentNode.host` and stops after a fixed ancestor.

### svelte-motion: when we snapshot

- `src/lib/html/_MotionContainer.svelte`:
  - `presenceChildContext` is declared at 303-304.
  - The layout pre-update effect, 2229-2254 (anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`),
    takes a live snapshot when the element's own tracked dependencies change (`trackLayoutProjectionDependencies`
    2222-2228). Those include its own `presenceChildContext.isPresent`. The comment at 2221 reads "A sibling's
    presence change is NOT this element's flip."
  - `runReactiveCommit` is at 2314-2390, with `lastRect = next` at 2350.
  - The grouped `layoutId` pair is at 2416-2446.
  - The observer effect is 2519-2818 (anchor `const disconnectObservers = observeLayoutChanges`). Its parts:
    - `suppressObservedLayoutCommit` (2488-2516). It writes `lastRect` at 2493 and 2509. Its placeholder branch
      (2502-2511) seeds without animating while an exit placeholder is present.
    - the restart commit (2555-2566);
    - `commitObservedLayout` (2612-2672);
    - the `observeLayoutChanges` call (2758);
    - the grouped-only `offProjectionCommit` (2794-2799);
    - 013's `setCompositorHints` lines (2567, 2812-2814), which are not this plan's.
- `src/lib/utils/layout.ts`, `observeLayoutChanges` (702-841):
  - It watches the element's own size, attributes and subtree (657-661, 823-825).
  - It watches `{ childList, subtree }` on the **immediate parent** (`if (index === 0)`, 786-788).
  - It watches style and class on up to `MAX_OBSERVED_ANCESTORS = 4` ancestors (73).
  - Observers are shared per `(target, JSON init)` by `acquireMutationObserver` (612-640).
  - No scroll or resize listeners, no record classification.

  Consequences:
  - A header, `motion.ul` and footer that **share a parent** already see every list mutation, so the footer
    commits and the header measures on each one. Part B(b) covers that case. Only nodes **outside** the list's
    parent need part D.
  - Inside `AnimatePresence` the immediate parent is the `display: contents` container. On the owned path that
    container holds a single item, so changes in the `<ul>` are unseen.
  - There's no way to tell an add from a completed-exit removal, so today a footer sharing the parent
    **animates** when a sync exit completes. Upstream snaps it.
- `src/lib/utils/motionDomProjection.ts`:
  - `lastLayout` is the snapshot cache, written in `seedLayout` (614), `refreshLayout` (651), the grouped
    `'didUpdate'` listener (449-471) and `refreshCachedLayout` (1471-1485).
  - `latestLayoutBox` is written by `rememberLayoutBox` (919).
  - Cached "before" boxes are used in:
    - `onScreenSnapshot()` 1246-1255, which feeds `seedCachedSnapshotsForGroup()` 1207-1225 and
      `seedOwnOnScreenSnapshot()` 1228-1237;
    - `seedCachedSnapshotsForSubtree()` 1288-1323;
    - `commitObservedLayoutChange(previousRect)` 986-1018 (`measurementsFromRect` 154-160);
    - `currentVisualPageRect()` 832-848;
    - 006 A1's `takeOverLiveLeadOnMount` (layoutid lane).

    None of them is rebased for a scroll.
- `src/lib/utils/presence.ts` (presence lane):
  - `canElementScroll`, `captureScrollSnapshot`, `measureScrollDelta` and `translateRectByScrollDelta`
    (760-818) are a second scroll helper set.
    - `canElementScroll` matches `/(auto|scroll|overlay)/` against `overflow + overflowX + overflowY`, because
      jsdom computes `overflowX`/`overflowY` as `visible` for `overflow: auto`.
    - The clone path uses them to re-express `child.lastRect`, at about lines 1600-1603.
  - `unregisterChild`:
    - inserts the clone (`slotParent.insertBefore(clone, …)`);
    - calls `schedulePopLayoutCorrection(clone, …)`;
    - starts the exit on the next `requestAnimationFrame` with `animate(clone, exitKeyframes, finalTransition)`;
    - later runs `clone.remove()` and `removeExitPlaceholder`.

    The clone carries `data-clone="true"` and `data-exiting="true"`.
  - `finishExit` (about 1108-1113) calls `forceRender?.()` once every exit has completed.

### 008's fixmes (presence lane, `e2e/animate-presence/pop-layout-container-move.spec.ts`)

- About line 126, inside "stays put when an item is added in the same render":
  `test.fixme(path === 'owned', 'Plan 015: …')` with a 4-line `// Plan 015:` comment above it.
- About line 166, inside the clamp loop:
  `test.fixme(query.includes('&scroller'), path === 'owned' ? … : …)` with a 4-line `// Plan 015:` comment.

Baselines with A2 (±10% is "the same failure"):

| Case | clone | owned |
| --- | --- | --- |
| scrollable element clamp | 1392.4 px | 50.9 px |
| positioned scrollable element in `scale(0.5)` | 348.1 px | 12.7 px |
| item added in the same render | passes | 51 px |

### Conventions

- **Test pages.**
  - Pages live at `src/routes/tests/<area>/<name>/+page.svelte`, specs at `e2e/<area>/<name>.spec.ts`.
  - A page signals it's ready with `window.MotionIsMounted === true`.
  - Hand-reviewed pages get a `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), hidden under
    `?@isPlaywright=true`. Exemplar: `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`
    (`isTester` 25-29, panel 165-179).
  - Link pages from `src/routes/+page.svelte`.
- **Painted frames.** CDP `Page.startScreencast` with `everyNthFrame: 1`, decoded in the page. Exemplar:
  `e2e/independent-transforms/speed-change.spec.ts:226-280`. Read counts: exemplar
  `e2e/layout-id/read-budget.spec.ts:17-38`.
- **Unit tests.**
  - jsdom (`vitest.config.ts`). jsdom keeps `scrollTop` writable. Define `offsetWidth`/`offsetHeight` with
    `Object.defineProperty` where scale matters.
  - Component set-up exemplar: `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`.
  - Rect mocking by `data-box`: `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts` (006).
  - Adapter `mount` helper: the `describe('MotionDomProjectionAdapter node-group gaps (plan 007 Step 4b)')`
    block in `src/lib/utils/motionDomProjection.spec.ts`.
- **Citations and docs.** Cite upstream as `file:line @ v14.7.1`. Google-style JSDoc on every new export.

## Design

Bounds that hold for every part:
- no layout read per frame or per scroll event;
- no full-tree measure;
- one forced style recalc per layout element at mount (the ancestor style walk, memoized per element);
- B(a): every sibling commits, one read each, per mutation batch in the layout parent's subtree. That's the same
  cost class plain and clone lists pay today.
- D: an O(motion nodes) JavaScript walk plus one read per picked node, per qualifying mutation batch.

### A. Scroll basis: cached rects survive container scrolls

New module `src/lib/utils/scrollBasis.ts`. It also takes over `presence.ts`'s scroll helpers (760-818):
`presence.ts` imports them from here, so there is one implementation.

- **`getScrollAncestors(element)`** returns `{ scrollers, fixed, sticky }`.
  - Walk `parentElement || (parentNode as ShadowRoot).host` (`PopChild.tsx:63-80`).
  - `scrollers`: ancestors whose `overflow + overflowX + overflowY` matches `/(auto|scroll|hidden|overlay)/`.
    That's the `canElementScroll` regex plus `hidden`, which scrolls programmatically, with no overflow-size test.
  - Exclude `document.scrollingElement`. Exclude `html` and `body` only when they are the scrolling element or
    their overflow is visible. So a body scroller under `html { overflow: hidden }` is included.
  - `fixed`: true if the element or an ancestor is `position: fixed`. The walk stops after it.
  - `sticky`: true if the element or any ancestor below the outermost scroller is `position: sticky`.
  - Computed style is memoized per element in a `WeakMap`. That's one recalc per element.
- **Folded-in containers are decided at read time, not at mount.** `readScrollBasis` and `scrollShift` take
  `isFoldedIn(container)`. The adapter passes `c => this.projection.path.some(n => n.options.layoutScroll &&
  n.instance === c)`, which is exactly what `removeElementScroll` subtracts. The clone path passes the nearest
  motion ancestor adapter's predicate, including that adapter's own node.
- **Root term.** When `fixed` is true and no `layoutScroll` path node `wasRoot`, add the document scrolling
  element with sign **+1**: `measurePageBox` adds root scroll, so a fixed box's page position moves with window
  scroll. Scrollers below the fixed node keep sign −1.
- **Tracker.**
  - `seen: WeakMap<Element, [x, y]>` holds the pre-change scroll. Its companion `known: Set<Element>` makes it
    iterable and is pruned when a container disconnects.
  - `epoch` is a counter that increments on every resample.
  - Resample sources:
    - one passive capture `scroll` listener on `document`, filtered to `known`;
    - passive capture `pointerdown`, `keydown` and `click` listeners on `window`. These catch a programmatic
      scroll followed by an input-driven change in the same frame; browsers fire `scroll` at the next rendering
      opportunity.
    - `scheduleResample()`, which queues one `microtask.postRender` after an update pass that rebased anything.
  - A window `resize` listener increments `resizeEpoch`.
  - Listeners are installed while `known` is non-empty.
- **`ScrollBasis`** = `{ scrollers, values, epoch, resizeEpoch, fixedRoot, unreliable }`, read live right after a
  layout read. `unreliable` is the `sticky` flag.
- **`scrollShift(basis, isFoldedIn)`**:
  - returns `null` if `unreliable`;
  - returns `{0, 0}` if `basis.epoch === epoch`. The read happened after the last resample, so it is at least as
    fresh as `seen`. This is the fix for the phantom shift: caches written after a change are never shifted
    toward the pre-change scroll.
  - otherwise returns `Σ sign · (seen − value) · scale`, with sign −1 for scrollers and +1 for the root term.
    Scale is `measureScreenScale(container)` (upstream `measureScale`), read only for terms that changed.
  - With no scrollers and no root term, everything is a no-op with zero reads. That's the common case.

### B. Siblings see the change the way upstream's render reaches them

- **(a) Owned-path reach.** `observeLayoutChanges` watches `{ childList, subtree }` on the **layout parent**: the
  nearest observed ancestor whose computed `display` is not `contents`, falling back to `parentElement`. That
  replaces the immediate parent. Siblings in separate owned `AnimatePresence` containers then see adds, removes
  and completions.
- **(b) Pop reach.** Also watch `POP_ATTRIBUTE_INIT = { attributes: true, attributeFilter: ['data-motion-pop-id'],
  subtree: true }` on the layout parent, so an owned pop and its removal on re-entry reach the siblings. A footer
  that shares the list's parent is covered by (a) and (b). Part D is only for nodes outside it.
- **(c) Completed exits snap outside their `AnimatePresence`.**
  - Classify each childList batch in `layout.ts`. A batch is `exit-complete` when every removed element is or
    contains `[data-exiting]` or `[data-presence-placeholder]`, and nothing was added.
  - Clones already carry `data-exiting`. Owned elements get it from a new container effect (R5): set
    `data-exiting` while `presenceChildContext.isPresent === false`, and remove it on re-entry.
  - The handler calls `onChange({ kind: 'exit-complete', boundaries })`, where `boundaries` holds the
    `.animate-presence-container` of each record target.
  - The container then **refreshes its cache silently** (`refreshGatedLayoutCache`, the snap) unless:
    - its own `closest('.animate-presence-container')` is in `boundaries` (the same `AnimatePresence`, which
      upstream re-renders through `presenceAffectsLayout`); or
    - it is grouped (`layoutGroupContext?.group`; `forceRender` → `commitGroup` animates it, as it does today).
  - The element is also marked, so a `ResizeObserver` delivery before the next animation frame gets the same
    treatment. The removal's resize has no cause attached, and upstream doesn't re-render the AnimatePresence's
    parent.
  - Adds, removes that start an exit (the clone appearing) and pops stay ordinary triggers.
- **(d) The exiting element's own snapshot.** In the layout pre-update effect, on a run where this element's own
  `presenceChildContext.isPresent` changed, use the rebased cache (`seedOwnSnapshotFromCache()`) **only if all of
  these hold**:
  - a structural change is pending in this flush. A layout-parent probe (a dedicated `MutationObserver` with
    `{ childList, subtree, attributes, attributeFilter: ['style', 'class'] }`, its callback a no-op) returns
    childList records from `takeRecords()`, and no attribute records. The result is kept for the rest of the
    microtask, so every node in the flush sees the same answer.
  - the cached basis has the current `resizeEpoch`.
  - no ancestor-attribute record has reached this element since its cache was written.
  - the basis isn't `unreliable`.

  Otherwise read live, exactly as today. That covers every sync exit and every popLayout exit with nothing
  inserted earlier in the flush. Grouped members are seeded from cache in the cached branch, and live
  (`willUpdate()`) in the live branch, as today.

### C. Clone layout-follow (the exiting node's own layout animation)

- At the start of `unregisterChild`, capture `preBasis = seenScrollBasis(slotParent)`. That needs no reads.
- Right after `schedulePopLayoutCorrection` (or right after the insert), queue one `microtask.read`. It runs after
  the correction's read.
- In it, compute the clone's screen move `move = scrollShift(preBasis → readScrollBasis(slotParent))`. If it is
  non-zero, the follow's start offset is `from = −move / measureScreenScale(clone.offsetParent)`. For the 008
  clamp that gives `y: [-70, 0]`.
- Transition: `layoutTransition = getValueTransition(child.mergedTransition ?? defaultLayoutTransition, 'layout')`.
  Define a local `defaultLayoutTransition = { duration: 0.45, ease: [0.4, 0, 0.1, 1] }`, citing
  `create-projection-node.ts:2546-2549, 581-584, 626`.
- **Composition with the exit.** A second `animate()` on the same element's independent transforms can fight
  the exit's `scale` on `transform`, because Motion groups independent transforms into one `transform`
  animation per call. So when `move` is non-zero, **merge**: start the exit in this microtask instead of the next
  rAF, as one call:
  `animate(clone, { ...exitKeyframes, x: [fromX, 0], y: [fromY, 0] }, { ...finalTransition, x: layoutTransition, y: layoutTransition })`.
  - Cancel the pending exit rAF. Resolve `resolveExit(getCustom())` there exactly as the rAF callback does, and
    keep `startExit()`, `activeExit.base` (now including `x` and `y`) and the completion wiring.
  - If the exit animates `x` or `y` itself, that track becomes `[from + current, target]` with the exit's
    transition.
  - When `move` is zero, nothing changes.
- Starting in the microtask also aligns the follow with the siblings' projection animations, which start in the
  same `update()`.

### D. Following nodes outside the list's parent (the footer)

Upstream animates a footer at exit start or on an add because the state-owning component re-renders it
(`MeasureLayout.tsx:149-218`). D stands in for that, triggered **only** by part B's layout-parent batches
(childList or pop attribute) that are **not** `exit-complete`. Never on mount, unmount, scroll, resize or per
frame.

- **Trigger.** `observeLayoutChanges(el, onChange, { onLayoutParentChange })`. The container passes
  `MotionDomProjectionAdapter.seedFollowingLayout(parent, records)`. A `WeakSet<MutationRecord[]>` dedupes, so
  the pass runs once per batch even though every sibling's handler receives the same records.
- **Walk.**
  - Start at the projection root and visit through `children`.
  - Prune a subtree whose `instance` precedes `parent` (`DOCUMENT_POSITION_PRECEDING`) without containing it.
  - Skip `parent` itself and its ancestors: their own observers see their own subtree change.
  - Skip descendants of `parent`: part B already commits them.
  - Pick nodes that follow `parent` (`DOCUMENT_POSITION_FOLLOWING`), are mounted, have `layout` or `layoutId`,
    aren't layout-dirty, aren't gated (`layoutDependency` set without drag, the `isLayoutMeasurementGated` rule),
    aren't inside `[data-layout-size-animation]`, have a reliable rebased cache, and **share `parent`'s nearest
    motion-ancestor element** (or the document, if `parent` has none). That last condition is the closest
    available stand-in for "the same component".
- **Seed.**
  - Call `root.startUpdate()` once.
  - For each picked node: set its snapshot from its rebased `onScreenSnapshot()` (zero reads), run
    `prepareSnapshotPath`, set `isLayoutDirty = true` and `presenceSeeded = true`.
  - Then call `root.didUpdate()` and `scheduleResample()`.
  - The update pass reads each picked node once.
  - `presenceSeeded` is a new private adapter field. The `'didUpdate'` listener is now installed for every
    adapter. For an ungrouped one it acts only when `presenceSeeded` is set: it refreshes `lastLayout` and
    `lastUpdate` and fires the commit listeners, then clears the flag. It does **not** run
    `shiftFollowingDescendants`, which stays grouped-only.
  - The container's `offProjectionCommit` becomes unconditional, so a footer animated by D adopts the new rect
    and doesn't commit it again from its own observers.
- **Divergence recorded.** Svelte leaves no component boundary in the DOM. A following node in another component
  under the same motion ancestor (or the document) is seeded where upstream would snap it. The motion-ancestor
  restriction narrows this. Maintenance has the follow-up.

### How this interacts with 006 A1

- A1 is the mount-time pass for a node taking over a live `resumeFrom`. 015 never touches `resumeFrom`, stacks or
  `takeOverLiveLeadOnMount`, and adds no mount trigger.
- A1's `leadAdapter.onScreenSnapshot()` becomes rebased.
- If an A1 takeover and a part-B or part-D seed land in the same flush, they only mark nodes layout-dirty before
  one `update()`. The `updateScheduled` guard (881-886) and the repeat guard (825-828) mean **no node animates
  twice**.

### Considered and rejected

- A live tree-wide `willUpdate` on presence changes. On the clone path the DOM has already changed; on the owned
  path it's wrong for case 2.
- Running D on every mount or unmount. That's a scan per mount, and O(N²) at initial render.
- Svelte `out:` transitions as a pre-removal hook. Spike 012 refuted them.
- Treating every scroller as `layoutScroll`. Siblings would jump instead of animating; see (i).
- Refreshing caches per scroll frame. That's N reads per frame.
- Consuming the shared observers' records with `takeRecords()`. That would starve the other subscribers. The
  probe in (d) is a separate observer.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Lane setup | `git -C /Users/jasonkummerl/Github/svelte-motion-1471 worktree add /Users/jasonkummerl/Github/svelte-motion-1471-siblings -b lane/1471-siblings feat/motion-14.7.1`, then `pnpm install --frozen-lockfile` in `/Users/jasonkummerl/Github/svelte-motion-1471-siblings` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4223 pnpm exec playwright test <paths>` | all pass (the web server builds first) |
| Build / package | `pnpm build` | exit 0 |
| Format / lint | `trunk fmt <files>`, then `trunk check <files>` | no new issues (Trunk is the authority) |

## Scope

**In scope** (only these):

- `src/lib/utils/scrollBasis.ts` and `scrollBasis.spec.ts` (create)
- `src/lib/utils/motionDomProjection.ts`:
  - basis stamps and rebases (Step 3);
  - new public members: `lastReadScrollBasis`, `rebaseRect` (returns `null` for a `null` rect),
    `seedOwnSnapshotFromCache`, `commitObservedLayoutChange`'s `previousBasis` option, and
    `static seedFollowingLayout`;
  - the private `presenceSeeded` field, and the `'didUpdate'` listener for every adapter.

  Also `motionDomProjection.spec.ts`, as new `describe` blocks only.
- `src/lib/utils/layout.ts`, `observeLayoutChanges` (702-841) and new inits next to 657-666: layout parent,
  `POP_ATTRIBUTE_INIT`, the probe, record classification, and `onChange(cause)` / `onLayoutParentChange`. Also
  `layout.spec.ts`, as a new `describe` only.
- `src/lib/html/_MotionContainer.svelte`, these regions only (planned-at; locate by anchor):
  - R1: 2179-2181, the cache declarations (`lastRectBasis`, `observerRestartBasis`, `setLastRect`);
  - R2: 2229-2254, the pre-update effect (part B(d));
  - R3: 2350 in `runReactiveCommit`;
  - R4: the observer effect 2488-2818:
    - every `lastRect`/`observerRestartRect` write (2493, 2509, 2524-2525, 2539, 2546, 2584, 2622, 2697, 2748,
      2752, 2796, 2809-2811);
    - `commitObservedLayout`'s diff (2612-2672) and the restart commit (2555-2566);
    - `scheduleProjectionCommit` (2723-2735), which receives `cause`;
    - the `observeLayoutChanges` call (2758);
    - `offProjectionCommit` (2794-2799).

    **Not** 013's lines 2567 and 2812-2814.
  - R5: one new `$effect` directly after 303-304 that sets and removes `data-exiting`.
- `src/lib/utils/presence.ts`:
  - delete 760-818 and import those helpers from `scrollBasis.ts`;
  - `unregisterChild` (part C, and the exit start it may merge);
  - the `ActiveExit` type;
  - every cancel or cleanup site (stop the follow);
  - `measurePopLayoutScale`, which delegates to `measureScreenScale`.

  Also `presence.spec.ts`, new cases only.
- `src/lib/components/__tests__/PresenceSiblingsHarness.svelte` and
  `src/lib/components/presenceSiblingSnapshots.spec.ts` (create)
- `e2e/animate-presence/pop-layout-container-move.spec.ts`: only the two `test.fixme(...)` calls and their
  `// Plan 015:` comments (Step 1.1)
- `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte` and
  `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `.changeset/sibling-layout-snapshots.md` (create)

**Out of scope**:
- `PresenceChild.svelte`, `AnimatePresence.svelte`, `presenceExitRegistry.ts`, `LayoutGroup.svelte`. 012
  prototypes in them, and nothing here needs them.
- 006's, 007's, 008's and 013's own `_MotionContainer.svelte` regions.
- `commitPresenceLayoutRelease`, the wait-mode hold. It has its own `viewportScrolledDuringHold` rule; see
  Maintenance.
- `measureRect` in `layout.ts`.
- 008's page and playground, `node_modules/motion-dom`, docs, `package.json`, PR labels.

## Git workflow

- Lane `lane/1471-siblings` in `/Users/jasonkummerl/Github/svelte-motion-1471-siblings`, created as above. Not
  `isolation: 'worktree'`.
- One conventional commit per step. Example messages:
  - `test(layout): siblings and following nodes snapshot like upstream's render (plan 015)`
  - `fix(layout): rebase cached layouts across scroll-container scrolls`
  - `fix(layout): completed exits snap outside their AnimatePresence, like upstream`
  - `fix(presence): exit clones follow the layout move their element would animate`

  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests and parity guards

Each case is labelled **RED** (fails today) or **GUARD** (passes today and must keep passing). Record the
actual outcome of every case. If one doesn't match its label, STOP.

1. **008's spec.** Delete the `test.fixme(path === 'owned', …)` call (about line 126) and the
   `test.fixme(query.includes('&scroller'), …)` call (about line 166), each with its `// Plan 015:` comment
   above it. Nothing else changes.
2. **`scrollBasis.spec.ts`**:
   - **RED** (module missing): ancestor rules:
     - `overflow:auto` is detected through the shorthand, even though jsdom reports `overflowX`/`overflowY` as
       `visible`;
     - `hidden` is included and `visible` excluded;
     - `scrollingElement` is excluded;
     - a body scroller under `html { overflow:hidden }` is included;
     - a fixed element or ancestor sets `fixed` and stops the walk;
     - a `sticky` node below the scroller sets `unreliable`;
     - the walk crosses a shadow `host`.
   - `isFoldedIn` is evaluated at read time: flipping it between two reads changes the result.
   - `seen` updates on `scroll`, and on a `document` `click` with no scroll event.
   - `scrollShift`:
     - 0 → 500 gives `y: -500`;
     - with the container's `getBoundingClientRect().height` mocked to half its defined `offsetHeight` it gives
       `-250`;
     - the fixed root term has sign +1;
     - a same-epoch basis gives `{0, 0}`;
     - an `unreliable` basis gives `null`.
   - No ancestors means zero `getBoundingClientRect` calls.
3. **`motionDomProjection.spec.ts`**, new `describe('MotionDomProjectionAdapter scroll-rebased snapshots (plan 015)')`,
   with an `overflow:auto` container and mocked rects:
   - **RED**, each currently giving the pre-scroll value: after `scrollTop = 500` and a `scroll` event,
     `commitGroup(group)`, `currentVisualPageRect()` and `commitObservedLayoutChange(prev, { previousBasis })`
     are each rebased by −500.
   - **GUARD, the phantom-shift tripwire.** Simulate a clamp (`scrollTop` 500 → 430 with no `scroll` event yet).
     Commit A with a pre-change stamp, then, in the same task, commit B with a rect measured after the clamp. B's
     seeded snapshot equals its rect exactly. No node animates twice: each node's `animationStart` listener fires
     at most once. This passes trivially today, and it is the check that a rebase without epochs would fail.
   - **GUARD**: a fixed element after a window scroll of 300 is rebased by +300.
   - **GUARD**: a sticky-path node is not rebased, and D skips it.
   - **GUARD**: with no scrollers, `lastReadScrollBasis` is `null`.
   - **RED** (method missing): new `describe('… seedFollowingLayout (plan 015)')`:
     - it seeds a following node from its rebased cache;
     - it prunes preceding subtrees and skips `parent`, its ancestors and descendants, gated, dirty, unmounted,
       unreliable and other-motion-ancestor nodes;
     - it runs once for the same `records` array passed twice;
     - it calls `root.didUpdate()` once;
     - it ignores an `exit-complete` batch;
     - it leaves `resumeFrom` and stack membership untouched.
4. **`layout.spec.ts`**, new `describe('observeLayoutChanges reach and causes (plan 015)')`, with jsdom's real
   `MutationObserver`:
   - **RED**: under a `display: contents` parent, an append to the grandparent calls `onChange`.
   - **RED**: setting `data-motion-pop-id` on a sibling calls `onChange`.
   - **RED** (cause missing): removing a `[data-exiting]` node passes `{ kind: 'exit-complete' }`.
   - **GUARD**: an add plus a removal in one batch is not `exit-complete`.
   - **GUARD**: a sibling's `style` change doesn't call `onChange`.
   - **RED** (option missing): `onLayoutParentChange` fires once per batch with the layout parent.
5. **Component spec**, `PresenceSiblingsHarness.svelte` plus `presenceSiblingSnapshots.spec.ts`, using the
   `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts` set-up and rects by `data-box`.
   - Harness: `<div id="head-wrap"><motion.div layout id="header" data-box="header"/></div>`, then a
     `motion.ul` of three items (owned path: each its own `<AnimatePresence present>`; with `clone`, one
     `AnimatePresence` around a keyed `{#each}`), then `<div id="foot-wrap"><motion.div layout id="footer"
     data-box="footer"/></div>`.
   - Props: `items`, `mode`, `clone`, `addFirst` (prepends in the same update), `layoutGroup` (wraps everything
     in a `LayoutGroup`).
   - Listen to `'didUpdate'` on each node's projection (`visualElementStore.get(el).projection`). Cases:
     1. **RED**. Owned popLayout, item 1 exits, and the mocked rect of item 0 moves +70 once item 1 has
        `data-motion-pop-id`. Item 0's `didUpdate` fires once, from the old top to 70 lower.
     2. **RED**. The same exit with the footer mocked 70 higher after the pop: the footer's `didUpdate` fires
        once (part D, owned and clone). The header gets no `didUpdate` and no `getBoundingClientRect` call
        (**GUARD** inside the case).
     3. **RED**. Clone path, an item is added and the footer moves 70: the footer animates (D).
     4. **RED**. Owned popLayout, item 0 exits with `addFirst`, and item 0 is mocked 70 up after the insert.
        Item 0's seeded snapshot is its **pre-insert** box.
     5. **GUARD**. Owned sync, item 1's exit completes and item 2 moves up 70, no `LayoutGroup`: item 2 gets
        **no** `didUpdate` (upstream snaps; nothing observes it today). With `layoutGroup`: item 2 animates.
     6. **RED**. Clone sync, the exit completes, the footer outside moves up 70, no `LayoutGroup`: the footer
        gets **no** `didUpdate` and its cache refreshes. Today it snaps too, unless it shares a parent, so add a
        variant with the footer directly in the `ul`'s parent: today it animates (**RED** for that variant), and
        upstream snaps.
     7. **GUARD**. Clone sync, the exit completes, item 2 (same `AnimatePresence`) animates.
     8. **GUARD**. A sibling with an unchanged `layoutDependency={1}` gets no `didUpdate`.
6. **`presence.spec.ts`**, clone follow:
   - **RED**. Track a scroller at 500, `unregisterChild`, set `scrollTop = 430` before draining, and mock the
     clone 70 lower. After two microtasks, the mocked `animate` received
     `expect.objectContaining({ y: [-70, 0] })` with the layout transition, as a single exit call before any rAF.
   - **GUARD**. With no scroll change, the exit still starts on the rAF with unchanged keyframes.
7. **New page and spec** (see Test plan). Run them and record per-case red and guard.

**Verify**:
- The labels in items 2–6 hold.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → exactly the
  five un-fixmed cases fail, within ±10% of the baselines, and nothing else fails.
- Otherwise STOP.

Commit (`test(layout): siblings and following nodes snapshot like upstream's render (plan 015)`).

### Step 2: `scrollBasis.ts`

Implement Design A with JSDoc. The header cites `PopChild.tsx:39-46, 63-80` and `create-projection-node.ts:1022-1043, 1105-1156`,
and explains the epoch and the input sampling. Move `canElementScroll`, `captureScrollSnapshot`,
`measureScrollDelta` and `translateRectByScrollDelta` from `presence.ts` (760-818) into it, export them, and
import them in `presence.ts`. Make `measurePopLayoutScale` delegate to `measureScreenScale`. No import from
`presence.ts` (that would be a cycle).

**Verify**: `pnpm exec vitest run src/lib/utils/scrollBasis.spec.ts src/lib/utils/presence.spec.ts` → the
`scrollBasis` cases pass, and only Step 1.6's RED case fails in `presence.spec.ts`.

### Step 3: Rebase the adapter's caches

1. Stamp `projectionLayoutBasis` in the `'measure'` listener (441) and `latestReadBasis` in `rememberLayoutBox`
   (919). Set `lastLayoutBasis` at every `this.lastLayout = cloneMeasurements(this.projection.layout)`:
   `seedLayout`, `refreshLayout`, the `'didUpdate'` listener, and both writes in `refreshCachedLayout`.
2. Add a private `rebaseMeasurements(m, basis)`: clone `m` and `translateAxis` its `layoutBox` and `measuredBox`
   (motion-dom export; pattern `shiftFollowingDescendants` 1265-1285). A `null` shift means "unreliable":
   callers that seed fall back to today's behaviour, and D skips the node.
3. Apply it in `onScreenSnapshot()` (target branch with `projectionLayoutBasis`, cache branch with
   `lastLayoutBasis`), `seedCachedSnapshotsForSubtree()` and `currentVisualPageRect()`.
4. Add the public members from Scope. After any non-zero rebase in a commit, call `scheduleResample()`.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts` → Step 1.3 passes except the
`seedFollowingLayout` block. Every existing block passes, including 006's and 007's.

### Step 4: The container uses rebased rects (R1, R3, R4)

1. Add `lastRectBasis`, `observerRestartBasis` and
   `setLastRect(rect)` (`lastRect = rect; lastRectBasis = rect ? motionDomProjection?.lastReadScrollBasis ?? null : null`).
   Replace every `lastRect =` write in R3 and R4 with it, and carry `observerRestartBasis` with
   `observerRestartRect`.
2. In `commitObservedLayout` and the restart commit, rebase `previous`
   (`motionDomProjection?.rebaseRect(lastRect, lastRectBasis) ?? lastRect`) **before** `hasRectChanged`,
   `isFollowingAncestorUpdate`, `emitProjectionUpdate` and `computeFlipTransforms`. Then pass
   `{ previousBasis: null }`.

**Verify**:
- `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` → only the declaration and `setLastRect`.
- `pnpm check` → 0 errors.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → the clone
  clamp cases no longer show 1392/348 px jumps. Record the numbers; they may still fail until Step 7.

### Step 5: Reach and causes (part B a–c, R5)

1. `layout.ts`:
   - Resolve the layout parent in `wireAncestors`, and acquire `CHILD_LIST_INIT` and `POP_ATTRIBUTE_INIT` on it
     through `acquireMutationObserver` (612-640).
   - Classify childList batches and call `onChange(cause)`. Existing callers ignore the argument.
   - Mark exit-complete causes for a ResizeObserver delivery before the next frame.
   - Update the JSDoc, citing `MeasureLayout.tsx:149-218`, `AnimatePresence/index.tsx:206, 236-244` and
     `PresenceChild.tsx:91-98`.
2. R5: add the `data-exiting` effect.
3. R4: `scheduleProjectionCommit(cause)` applies the exit-complete rule from B(c).

**Verify**:
- `pnpm exec vitest run src/lib/utils/layout.spec.ts src/lib/components/presenceSiblingSnapshots.spec.ts` →
  Step 1.4 and cases 1, 5, 6, 7 and 8 of Step 1.5 pass.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence` → the owned clamp cases pass, and the existing
  specs pass. Re-run a failing spec alone once before reporting it.

### Step 6: The exiting element's own snapshot (part B d, R2)

Add the probe in `layout.ts` (`hasPendingStructuralChange(el)`, cached for the microtask) and the
resize and ancestor-attribute bookkeeping. Then implement B(d) in R2, commented with a citation of
`MeasureLayout.tsx:149-204`.

**Verify**: Step 1.5 case 4 passes. 008's owned same-render case passes. The new spec's resize guard passes.

### Step 7: Clone follow (part C) and following nodes (part D)

Implement C in `presence.ts`, and D in the adapter, `layout.ts` (`onLayoutParentChange`) and R4 (the option, and
an unconditional `offProjectionCommit`).

**Verify**:
- `pnpm exec vitest run src/lib/utils src/lib/components` → all pass.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
  → all pass on both paths.

### Step 8: Guards, changeset, gate

1. Run:

   `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/projection/scroll-during-layout.spec.ts e2e/projection/sibling-swap.spec.ts e2e/projection/nested-ancestor.spec.ts e2e/independent-transforms/layout-rotating-3d.spec.ts`

   → all pass. That set includes the read-count specs (`e2e/layout-id/read-budget.spec.ts`,
   `layout-group-interrupt-measurements`, `relative-child-measurements`, `layout-dependency`) and the new spec's
   budgets. No budget may be raised. Re-run a failing spec alone once and say so.
2. `.changeset/sibling-layout-snapshots.md`:
   ```md
   ---
   '@humanspeak/svelte-motion': patch
   ---

   Layout animations around `AnimatePresence` and list changes follow Motion's render model. When a list changes
   (an item added, removed, or popped out with `mode="popLayout"`), its other items, including those in separate
   `AnimatePresence` boundaries, and `layout` elements after it (such as a footer) animate from where they were,
   and an exiting element's own animation starts from where it was even when an item is added in the same update.
   When an exit completes, only elements in the same `AnimatePresence` (or the same `LayoutGroup`) animate,
   as in Motion. Cached layouts now account for scroll containers that aren't `layoutScroll`, and for fixed
   elements on a scrolled page, so scrolling a list and then changing it no longer makes items jump by the
   scroll distance, and `popLayout` exit clones move with the content when the scroll position is clamped.
   ```
3. Gate, in order:
   - `trunk fmt` then `trunk check` on every changed file;
   - `pnpm check` → 0 errors;
   - `pnpm test:only` → all pass;
   - `pnpm build` → exit 0;
   - the Step 8.1 set → all pass;
   - `git status` → only in-scope files.

## Test plan

- **Red anchors.** 008's five cases; and the RED cases of Step 1.2–1.6. All pass after Step 7. Every GUARD stays
  green throughout.
- **Page** `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`:
  - Header comment cites #2348, `MeasureLayout.tsx:149-218`, `AnimatePresence/index.tsx:206, 236-244`,
    `PresenceChild.tsx:91-98` and plan 015.
  - Query params: `path=owned|clone`, `mode=popLayout|sync`, `layoutScroll`, `layoutGroup`, `footer`, `fixed`
    (no scroller: a 1500 px page spacer, then the list as `position: fixed; bottom: 20px`), and `sticky` (a
    `position: sticky` `motion.div layout` header as the first child of `#scroller`).
  - **Default layout**: a 320 px `#scroller` with `overflow:auto` (a `motion.div layoutScroll` when that param is
    set), then a 600 px spacer, then a `motion.ul` of five `motion.li layout` items, 150×60 with a 10 px gap,
    `transition={{ type: 'spring' }}`, `exit={{ opacity: 0 }}`.
    - `id`s are `sib-0` to `sib-4`.
    - Colours: `sib-1` `#0077ff` (blue), `sib-2` `#ff0088` (pink, the one that exits), `sib-3` `#00aa44`
      (green), the rest `#888`.
    - The owned path gives each item its own `<AnimatePresence present child>`.
  - **`?footer`**: no scroller. `#head-wrap > motion.div layout #header` (`#aa00ff`), then the list, then
    `#foot-wrap > motion.div layout #footer` (`#ffaa00`), all in the page component.
  - Buttons: `scroll-bottom`, `remove` (`sib-2`), `add`.
  - The page records `window.__removedAt` from a `MutationObserver` when `sib-2`'s node (or its clone) leaves the
    DOM.
  - `TesterPanel`, hidden under `?@isPlaywright=true`:
    - steps per scenario, each with its Expected text, including "sync, no LayoutGroup: after the fade the owned
      siblings and the footer **jump** into place (Motion does the same); with `?layoutGroup` they slide";
    - live read-only chips: `GAP HOLDS / DRIFTS`, `NO JUMP / JUMPED`, `SNAP (expected) / SLID`;
    - a status line saying what this build is expected to show.
  - Link from `src/routes/+page.svelte` as "Layout siblings and footers around exits (plan 015)".
- **Spec** `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`, real clock.
  - **Frame rules.** Screencast every frame. Detect each colour band's top row with at least 20 pixels within
    ±24 per channel of the target colour. Require at least 10 frames in which every asserted colour is detected,
    otherwise fail with "too few frames".
  - Cases (both paths unless noted):
    - "a sibling moves with a popped exit when the container clamps" (popLayout). **RED.**
      - Every frame: `|gap(pink − blue) − gap₀| ≤ 2` CSS px.
      - Green stays within 2 px of its start.
      - No band steps more than 35 px between frames.
      - Mid frame: `elementFromPoint` at blue's centre hits `#sib-1`.
    - "with layoutScroll the content just moves" (popLayout, `?layoutScroll`). **GUARD.**
      - Blue and pink each step by the clamp (70 ± 2) in the same frame.
      - The gap holds.
      - Blue never has a non-identity layout transform.
      - Green is not asserted.
    - "a sync exit completing in a scrolled container".
      - Clone, which is the same `AnimatePresence`: no band step above 35 px. **RED** (today's stale-cache
        jump).
      - Owned, no `LayoutGroup`: blue steps once by the freed space (70 ± 2) and has no layout transform
        (upstream snaps). **GUARD.**
      - Owned with `?layoutGroup`: no step above 35 px. **GUARD.**
    - "a footer outside the list animates when an item pops or is added" (`?footer`, popLayout remove and add):
      orange never steps more than 35 px and ends 70 ± 2 px away. **RED.**
    - "a footer outside the list snaps when a sync exit completes" (`?footer&mode=sync`, no `LayoutGroup`):
      orange steps once by 70 ± 2. **GUARD.** With `?layoutGroup` it slides. **GUARD.**
    - "a fixed toast list on a scrolled page stays put" (`?fixed`, with the page scrolled by 300 before the
      removal): no band step above 35 px and no
      phantom 300 px move. **GUARD.**
    - "a resize before an exit causes no phantom move" (resize the viewport 1920 → 1600, wait for two frames,
      then exit): no band moves on x by more than 2 px apart from the exit itself. **GUARD.**
    - "a sticky header inside the scroller doesn't break the rebase" (`?sticky`). After scroll and removal, no band steps more than 35 px. **GUARD.**
  - **Read budgets** (wrapped `getBoundingClientRect` per `id`):
    - 30 rAF-spaced scroll steps make **0** reads on every `sib-*`, `header` and `footer`.
    - Clone and owned sync: a removal costs each sibling at most **3** reads, counted from `__removedAt` for
      500 ms, then **0** over the next 500 ms.
    - `?footer`: the footer gets at most **2** reads per qualifying change, and `header` gets **0**.
    - Owned popLayout: only the idle 0 (008 A2's point cache samples per frame while things move).

## Done criteria

- [ ] `grep -n "Plan 015\|test.fixme" e2e/animate-presence/pop-layout-container-move.spec.ts` prints nothing,
      and the spec passes on both paths.
- [ ] `grep -n "export const scrollShift\|export const getScrollAncestors\|export const captureScrollSnapshot" src/lib/utils/scrollBasis.ts`
      prints three lines, and `grep -n "const captureScrollSnapshot" src/lib/utils/presence.ts` prints nothing.
- [ ] `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` → only the declaration and `setLastRect`.
- [ ] `grep -n "POP_ATTRIBUTE_INIT\|exit-complete" src/lib/utils/layout.ts` prints at least three lines.
      `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` prints one line.
- [ ] Every Step 1 RED case passes and every GUARD passes. The Step 8.1 suites pass with no budget raised.
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` is clean.
- [ ] The page is linked, the changeset exists, and `git diff --name-only feat/motion-14.7.1...HEAD` lists only
      in-scope files.

## STOP conditions

- A precondition grep prints nothing, or an excerpt's content doesn't match.
- A Step 1 label (RED or GUARD) doesn't hold.
- **A fix seems to need a full-tree measure every frame, or any layout read per scroll event or per frame.** For
  part D, that includes running it on mount, unmount, resize or per frame, measuring nodes that precede
  `parent`, or running it for an exit-complete batch.
- A read-count guard needs its budget raised.
- A node animates twice for one change, `onProjectionUpdate` fires twice, or an animation restarts from its
  origin.
- 008's owned `layout` cases drift by the container move, meaning the projection measured before 008's
  correction. Report the microtask order you saw.
- Part C's merged exit loses the scale or opacity exit, snaps in a painted frame, or breaks an existing
  `custom`/exit timing spec.
- B(c) makes any existing `e2e/animate-presence` or `e2e/layout` spec fail that animated a sibling on exit
  completion. Report the case: it may be an upstream-snap case that the existing spec encoded wrongly. The
  maintainer decides, following the failed-e2e review workflow in CLAUDE.md.
- B(d)'s cached branch fires in a case without a pending structural change, or breaks a re-entry mid-exit.
- The fix needs an out-of-scope file, especially `PresenceChild.svelte`.
- Any guard suite fails twice after a reasonable fix inside scope.

## Ordering against 012 and 013 (recommendation)

- **013** edits the same observer effect (`setCompositorHints` at planned-at 2567 and 2812-2814). It is S
  effort.
- **012** (spike) prototypes in `presence.ts` `unregisterChild` and `PresenceChild.svelte`, where part C lives,
  and its crossfades depend on how siblings snapshot.

**Recommended**: cut this lane alongside 013's and run them in parallel. Merge 013 first, then 015, then start
012.
- 015 merges `feat/motion-14.7.1` into its lane before merging back, keeps 013's deletions next to
  `setLastRect`, and re-runs Step 8.1.
- 012 merges `feat/motion-14.7.1` into its lane before starting.

Reason: the smaller diff lands first, and 012's report would be stale without part C.

## Maintenance notes

- `getScrollAncestors` memoizes computed style per element for the page's lifetime. An `overflow` or `position`
  change after a descendant first measured isn't seen until it remounts. If that matters, invalidate from the
  `scroll` capture listener when an unknown element scrolls.
- **`seen` and the epoch.** `seen` is the scroll as of the last resample. A programmatic scroll plus a DOM change
  in one task, with no input event, still uses the older value; upstream reads live. The epoch only protects
  reads taken after the last resample.
- **Part D's divergence.** It seeds following nodes in other components under the same motion ancestor (or the
  document) that upstream would snap, and it assumes normal flow, so only boxes after `parent` move. Either can
  be narrowed later with an explicit boundary marker (for example a `LayoutGroup`-like context set by the
  component that owns the state).
- `commitPresenceLayoutRelease` (wait mode) still diffs an un-rebased `previousRect`. Same class; follow-up.
- If 012's build gives exit clones a projection node, part C becomes redundant. Delete `activeExit.layoutFollow`
  and the merged-exit branch.
- Reviewers should check:
  - the signs in `scrollShift`, including the fixed root term;
  - that every `lastLayout` write updates `lastLayoutBasis`;
  - that `previous` is rebased before every comparison;
  - that part C is queued after 008's correction;
  - that the exit-complete classification can't swallow an add.
