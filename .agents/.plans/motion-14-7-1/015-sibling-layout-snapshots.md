# Plan 015: Layout nodes snapshot before a presence or list change the way upstream's re-render does, and cached layouts survive scrolls and resizes

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
> **Requires 006 (with A1; merged at `3365c175`), 007, and 008 (with A1–A3, `propagate` and the playground),
> all merged into `feat/motion-14.7.1`.** Before starting, confirm each command prints at least one line, otherwise
> STOP:
> - `grep -n "takeOverLiveLeadOnMount" src/lib/utils/motionDomProjection.ts` (006 A1)
> - `grep -n "layoutRoot?: boolean" src/lib/types.ts` (007)
> - `grep -n "schedulePopLayoutCorrection" src/lib/utils/presence.ts` (008)
> - `grep -n "pendingPop" src/lib/components/PresenceChild.svelte` (008 A1)
> - `grep -n "createPopLayoutPointCache" src/lib/utils/presence.ts` (008 A2)
> - `grep -n "Plan 015" e2e/animate-presence/pop-layout-container-move.spec.ts` (008 A3)
> - `test -f src/routes/tests/animate-presence/pop-layout-playground/+page.svelte && echo playground` (008)
>
> **Drift check (run first)**:
> `git diff --stat 3365c175..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/layout.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte src/lib/components/PresenceChild.svelte e2e/animate-presence src/routes/tests/animate-presence src/routes/+page.svelte`
> Expected: 007 and 008 (and 013 if it merged first; see "Ordering").
> - Feat-branch line numbers are at `3365c175` (`feat/motion-14.7.1` with 006 merged).
> - Presence-lane line numbers are at `lane/1471-presence` `4e90127c` and are marked "(presence lane)".
> - Merges shift both, so **find every excerpt by content**; each one has an anchor.
> - If an excerpt's content is gone or different, STOP.

## Status

- **Priority**: P1 (ships in 2.7.0; a scrolled list jumps by the whole scroll distance)
- **Effort**: L
- **Risk**: MED-HIGH. Three things change at once:
  - every observed layout commit is rebased for scroll and resize;
  - owned lists observe a wider subtree;
  - completed-exit removals change from "animate" to upstream's "snap" for nodes outside the exiting
    `AnimatePresence`, which changes two existing demos (listed under "Expected parity changes").
- **Depends on**:
  - 006 + A1: its `takeOverLiveLeadOnMount` reads `onScreenSnapshot()`, which this plan rebases.
  - 007: the same adapter plumbing.
  - 008 + amendments: helpers, page, playground, and the five `fixme`s.
- **Wave**: 4, alongside 013, in lane `siblings`.
- **Category**: bug (upstream parity)
- **Planned at**: commit `3365c175` (`feat/motion-14.7.1`, 006 merged), 2026-10-28. Revised after two cold
  reviews against upstream v14.7.1, `3365c175`, and the presence lane at `4e90127c`.

## Why this matters

Upstream gets "snapshot before the DOM changes" from React's render model. svelte-motion gets it only for an
element whose own props change. Every other change is diffed against cached rects after the DOM has already
moved, and those rects go stale on a scroll or a resize. This causes:

1. **Owned popLayout siblings snap.** The pop is an attribute plus a `<style>` in `<head>`, and no sibling sees
   it. It fails by 50.9 px (12.7 px at `scale(0.5)`).
2. **The owned exiting element's own snapshot is taken after an earlier DOM change in the same flush.** It fails
   by 51 px when a toast is added in the same render. 008's playground shows the same thing for its owned
   "Toast queue" and unscrolled "Scrolled page that shrinks" presets: one row (70 px) of drift each.
3. **Clone path after a scroll.** The cache predates the scroll, giving 1392.4 px (348.1 px) layout transforms.
4. **A `layout` footer outside the list's parent snaps** when an item is added or popped. Upstream animates it.

When this plan lands, each node animates exactly when upstream's render model would make it `willUpdate`, and
starts from where it was. Where upstream **snaps**, we snap too, and parity guards pin it.

008's playground presets "Rapid removals" and "Rotated ancestor" (owned), and "Rotated ancestor" (clone), are
upstream's own "Still wrong with the fix" cases (`dev/react/src/tests/pop-layout-playground.tsx`). This plan
leaves them alone.

## Current state

### Upstream render model (verified at `~/Github/motion`, `git show v14.7.1:<path>`)

- **Who snapshots.** `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`:
  - `getSnapshotBeforeUpdate` (149-204) runs for every node in the render and calls `willUpdate()` (183) unless
    `layoutDependency` gates it (177-186).
  - `componentDidUpdate` (206-218) calls `root.didUpdate()` (210).
  - `componentDidMount` (116-147) only calls `root.didUpdate()` (125-127).

  Which nodes are in the render:
  - **A state change** (remove, add, cycle, or an owned `present` flip) re-renders that component's subtree. Its
    siblings and its footer snapshot.
  - **An exit completing** re-renders only that `AnimatePresence`: `setDiffedChildren([])`
    (`components/AnimatePresence/index.tsx:244`).
    - Its other children re-render because `presenceAffectsLayout` gives each `PresenceChild` a new context
      object (`PresenceChild.tsx:91-98`), and `MeasureLayout` reads it through `usePresence`.
    - `usePresence` always reads `PresenceContext` (`use-presence.ts:40-43`, and `index.tsx:58` for a nested
      boundary), so **a node inside an inner `AnimatePresence` that sits in a re-rendered child also
      re-renders**.
    - Nodes outside the boundary snap.
    - Inside a `LayoutGroup`, `forceRender?.()` (`index.tsx:206, 236-237`; `utils/use-force-update.ts:19-22`)
      re-renders **only the boundary's nearest `LayoutGroup`**. Its context is memoized on `[key]`
      (`LayoutGroup/index.tsx:50-53`), and `group.ts:26-33` dirties only that group's members.
    - `scheduleCheckAfterUnmount` (`create-projection-node.ts:913-926`) only acts on a dirty node.
  - **Per-child vs batch removal.** Upstream removes every completed exit in one render (`index.tsx:171-176`).
- **Snapshot and pass.** `create-projection-node.ts`:
  - `willUpdate()` (708-791) → `updateSnapshot()` (787 → 967-978, a live `measure()`).
  - `didUpdate()` (881-886) queues `update()` (794-877). The repeat guard is at 825-828.
  - **Resize block.** A window resize whose `innerWidth` changed blocks updates for 250 ms (511-532,
    `delay(resizeUnblockUpdate, 250)`; `isUpdateBlocked` 690). A blocked `update()` force-measures without
    animating (797-820).
  - **Layout transition.** `options.transition || visualElement.getDefaultTransition() || defaultLayoutTransition`
    (581-584, where `defaultLayoutTransition` is `{ duration: 0.45, ease: [0.4, 0, 0.1, 1] }` at 2546-2549), then
    `getValueTransition(…, "layout")` (626).
- **Page space.**
  - `measurePageBox()` (1105-1124) adds the root scroll unless a path node `wasRoot`.
  - `removeElementScroll()` (1126-1156) subtracts only `layoutScroll` path nodes.
  - A fixed element counts as a scroll root (`HTMLProjectionNode.ts:23-24`).

  Consequences:
  - (i) A clamp in a non-`layoutScroll` scroller animates every node in it (`tests/react/issue-2348.spec.ts`).
  - (ii) With `layoutScroll`, the clamp is a one-frame content jump.
  - (iii) A fixed element's page box moves with window scroll.
- **Scroll walk.** `PopChild.tsx`: `measureScale` (39-46) and `measurePoint` (63-80), which stops after a fixed
  ancestor.

### svelte-motion today

- `src/lib/html/_MotionContainer.svelte` (anchors in backticks):
  - `presenceChildContext` is declared at 303 (`const presenceChildContext = getPresenceChildContext()`).
  - The `data-layout` / `data-layout-id` attributes are spread at 1659-1662. `cloneNode` copies them onto clones.
  - The pre-update effect is 2242-2267 (`explicitLayoutSnapshot = measureLayoutRect('snapshot')`). It reads live
    when its own tracked dependencies change (`trackLayoutProjectionDependencies` 2235-2241), and those include
    its own `presenceChildContext.isPresent`.
  - `runReactiveCommit` is 2327-2403, with `lastRect = next` at 2363.
  - Observer region 2596-2925:
    - `suppressObservedLayoutCommit` 2596-2624. Its writes are at 2601 and 2617; its placeholder branch seeds
      without animating.
    - the observer effect starts at about 2627. Its `lastRect`/`observerRestartRect` writes are at 2632-2633,
      2647, 2654, 2692, 2730, 2805, 2856, 2860, 2904 and 2917-2919.
    - the restart commit is 2663-2674.
    - `commitObservedLayout` is 2720-2780 (`const previous = lastRect` 2729).
    - `scheduleProjectionCommit` is 2831-2843. Its `rafId` throttle drops calls.
    - the `observeLayoutChanges(element!, () => scheduleProjectionCommit())` call is at 2866.
    - the grouped-only `offProjectionCommit` is 2902-2907.
    - 013's `setCompositorHints` lines are 2675 and 2920-2922. Not this plan's.
- `src/lib/utils/layout.ts`, `observeLayoutChanges` (702-841):
  - It observes the element's size, attributes and subtree (657-661, 823-825; the self-subtree childList is
    825).
  - It observes `{ childList, subtree }` on the **immediate parent** only (786-788).
  - It observes style and class on up to `MAX_OBSERVED_ANCESTORS = 4` ancestors (73).
  - Observers are shared per `(target, JSON init)` by `acquireMutationObserver` (612-640).
  - `schedule()`'s throttle (730-731: `if (pendingRaf !== null || releaseTimeout !== null) return`) drops calls,
    and no handler sees records.

  Consequences:
  - A header, `motion.ul` and footer that **share a parent** already see every list mutation. Part B(b) covers
    that; part D is only for nodes outside the list's parent.
  - Adds and completed exits look the same, so today a footer sharing the parent **animates** when a sync exit
    completes. Upstream snaps it.
- `src/lib/utils/motionDomProjection.ts`:
  - `updatePathScroll` (1673-1685) re-reads the root and the `layoutScroll` path scroll on every read. So
    window scroll is already invariant for in-flow nodes, a **fixed** node's cached page box goes stale on window
    scroll, and a non-`layoutScroll` scroller has no handling at all.
  - Cache writers: the `'measure'` listener (573) → `rememberLayoutBox` (1135); `lastLayout` in `seedLayout`
    (823), `refreshLayout` (856), the grouped `'didUpdate'` listener (about 586-609) and `refreshCachedLayout`
    (1687).
  - Cache readers:
    - `onScreenSnapshot()` 1462, which feeds `seedCachedSnapshotsForGroup()` 1423 and
      `seedOwnOnScreenSnapshot()` 1444;
    - `seedCachedSnapshotsForSubtree()` 1504;
    - `commitObservedLayoutChange()` 1202 (`measurementsFromRect` 154);
    - `currentVisualPageRect()` 1048;
    - 006 A1's `takeOverLiveLeadOnMount`.

    None of them rebases.
- `src/lib/components/AnimatePresence.svelte:102-106`: `.animate-presence-container { display: contents; }` is
  component CSS. Vitest uses `css.include: []`, so **jsdom never sees `display: contents`**.
- `src/lib/utils/presence.ts` (presence lane):
  - `canElementScroll`, `captureScrollSnapshot`, `measureScrollDelta` and `translateRectByScrollDelta` are at
    760-818. `canElementScroll` matches `/(auto|scroll|overlay)/` against `overflow + overflowX + overflowY`.
  - `unregisterChild` inserts the clone, calls `schedulePopLayoutCorrection`, starts the exit on the next rAF,
    and later runs `clone.remove()` and `removeExitPlaceholder` per clone.
  - Clones carry `data-clone="true"` and `data-exiting="true"`. Clones of `layout` elements also carry
    `data-layout`/`data-layout-id`.
  - `finishExit` (1374-1379) calls `forceRender?.()`.
  - `grep -rn "data-exiting" src e2e` finds only `presence.ts`.
- The wait-mode hold release `commitPresenceLayoutRelease` animates the parent on its own logic, which is not
  `MeasureLayout.tsx:116-127`'s (see Maintenance).

### 008's fixmes (presence lane, `e2e/animate-presence/pop-layout-container-move.spec.ts`)

- About line 126: `test.fixme(path === 'owned', 'Plan 015: …')`, plus the 4-line `// Plan 015:` comment above
  it.
- About line 166: `test.fixme(query.includes('&scroller'), path === 'owned' ? … : …)`, plus its 4-line comment.

Baselines with A2. Within ±10% counts as the same failure.

| Case | clone | owned |
| --- | --- | --- |
| scrollable element clamp | 1392.4 px | 50.9 px |
| positioned scrollable element in `scale(0.5)` | 348.1 px | 12.7 px |
| item added in the same render | passes | 51 px |
| playground `toast` (Toast queue) | holds | ~70 px |
| playground `scroll-mirror`, unscrolled | holds | ~70 px |

### Expected parity changes (operator pre-decided: match upstream)

- `src/routes/tests/animate-presence/layout-button`: the sync-mode `ModeButton` label snaps when its exit
  completes. Update the `sync` prefix of "moves the readable active label without one-frame jumps"
  (`e2e/animate-presence/layout-button.spec.ts`, about line 1067) to assert that single completion step. Cite
  `AnimatePresence/index.tsx:244` and `PresenceChild.tsx:91-98`.
- `src/routes/tests/animate-presence/modes`: in sync mode, the RIGHT pill snaps after the exit. Update the
  `flowNote` text in `ModeExample.svelte` (about line 168, "RIGHT should wait, then move after exit") to say it
  moves after the exit, and cite the same lines. If `e2e/animate-presence/modes.spec.ts` asserts a slide for
  `flow-right-sync`, change only that assertion, the same way.
- **Any other demo whose visible behaviour changes is a STOP.**

### Conventions

- **Pages.**
  - Pages live at `src/routes/tests/<area>/<name>/+page.svelte`, specs at `e2e/<area>/<name>.spec.ts`.
  - A page signals it's ready with `window.MotionIsMounted`.
  - `TesterPanel` comes from `src/routes/tests/layout/_parity/TesterPanel.svelte` and is hidden under
    `?@isPlaywright=true`. Exemplar: `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`.
- **Painted frames.** Exemplar `e2e/independent-transforms/speed-change.spec.ts:226-280`.
- **Read counts.** Exemplar `e2e/layout-id/read-budget.spec.ts:17-38`.
- **Unit tests.**
  - jsdom, with `scrollTop` writable. Window scroll is `document.documentElement.scrollTop = n` (jsdom doesn't
    implement `scrollTo`), then dispatch `scroll` on `document`.
  - Define `offsetWidth`/`offsetHeight` with `Object.defineProperty`.
  - Exemplars: `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`,
    `src/lib/html/__tests__/layoutIdChange.svelte.spec.ts`, and the plan-007 Step 4b `mount` helper in
    `src/lib/utils/motionDomProjection.spec.ts`.
- **Citations and docs.** Cite upstream as `file:line @ v14.7.1`. Google-style JSDoc on every new export.

## Design

**Bounds.** Nothing reads layout per frame or per scroll event, and nothing measures the whole tree. Every cost:

| Path | Cost |
| --- | --- |
| Mount | One forced style recalc per layout element (the ancestor style walk, memoized per element). |
| Tracker resample (`scroll`, `pointerdown`, `keydown`, `click`) | Reads `scrollLeft`/`scrollTop` of the scroll event's target, or of every connected known container on input events (typically 1–3). No rect reads. |
| Resize | One silent refresh read per mounted layout node, 250 ms after the last resize event (part A). Once per resize gesture. |
| B(a) | Every sibling commits, one read each, per non-exit-complete mutation batch in the layout parent's subtree. The same class plain and clone lists pay today. |
| B(d) probe | O(mutations under the probe target) record objects per microtask, drained by a no-op callback. While descendants animate, motion's inline style writes add about one record per animated element per frame. The probe is installed only for layout elements inside an owned `PresenceChild`. |
| D | An O(motion nodes) JavaScript walk plus one read per picked node, per qualifying batch. On exit-complete batches it runs in refresh mode: one silent read per picked node. |

### A. Scroll basis and resize: cached rects stay valid

New module `src/lib/utils/scrollBasis.ts`. It absorbs `presence.ts` 760-818, which then imports from it.

- **`getScrollAncestors(element)`** returns `{ scrollers, fixed, sticky }`.
  - Walk `parentElement || (parentNode as ShadowRoot).host` (`PopChild.tsx:63-80`).
  - A scroller is an element whose `overflow + overflowX + overflowY` matches `/(auto|scroll|hidden|overlay)/`.
  - Exclude `document.scrollingElement`. Exclude `html` and `body` when they are the scrolling element or
    `overflow: visible`. A body scroller under `html { overflow: hidden }` is included.
  - `fixed`: the element or an ancestor is `position: fixed`. The walk stops after it.
  - `sticky`: any `position: sticky` node from the element up to the outermost scroller.
  - Computed style is memoized per element.
- **Folded-in containers, decided at read time.** Reads take `isFoldedIn(container)`:
  - the adapter passes `c => this.projection.path.some(n => n.options.layoutScroll && n.instance === c)`;
  - the clone path passes the predicate of the slot parent's nearest motion ancestor adapter, including that
    adapter's own node.
- **Root term.** If `fixed` is set and no `layoutScroll` path node `wasRoot`, add the document scrolling element
  with sign +1 (`measurePageBox` adds root scroll). Scrollers keep sign −1.
- **Tracker.**
  - `seen: WeakMap<Element, [x, y]>` holds the pre-change scroll, and `known: Set<Element>` is its iterable
    companion.
  - `epoch` increments on every resample.
  - Resample sources:
    - a passive capture `scroll` listener on `document`, which resamples only the event target if it's known;
    - passive capture `pointerdown`, `keydown` and `click` listeners on `window`, which resample every connected
      known container;
    - `scheduleResample()`, one `microtask.postRender` after a pass that rebased anything.
  - Listeners stay installed while `known` is non-empty.
- **Resize** (mirrors 511-532, 690, 797-820).
  - A window `resize` whose `innerWidth` changed increments `resizeEpoch`, then (re)arms a 250 ms timer.
  - When the timer fires, every registered adapter silently refreshes its cache (`refreshLayout({ silent: true })`)
    and notifies its container (`onCacheRefresh`) so the container updates `lastRect`.
  - Until then `isResizeBlocked()` is true, and a commit seen by the container refreshes silently instead of
    animating. That is upstream's blocked update.
- **`ScrollBasis`** = `{ scrollers, values, epoch, resizeEpoch, fixedRoot, unreliable }`, read live right after a
  layout read. `unreliable` is the `sticky` flag.
- **`scrollDelta(from, to, isFoldedIn)`** is a pure function: `Σ sign · (to − from) · scale` per axis. Scale is
  `measureScreenScale(container)` (upstream `measureScale`), read only for terms that changed. No epochs.
- **`scrollShift(basis, isFoldedIn)`**:
  - `null` if `unreliable` or `basis.resizeEpoch !== resizeEpoch`;
  - `{0, 0}` if `basis.epoch === epoch`, meaning the read came after the last resample and is post-change. This
    is the phantom-shift fix.
  - otherwise `scrollDelta(basis, seen, isFoldedIn)`, negated into a box shift.
  - Zero reads when there are no terms.

### B. Siblings see the change the way upstream's render reaches them

- **(a) Owned-path reach.** Replace the immediate-parent childList observer with `{ childList, subtree }` on the
  **layout parent**: the nearest observed ancestor that is neither `.animate-presence-container` (checked by
  class, because jsdom never sees the component CSS) nor computed `display: contents`. Fall back to
  `parentElement`.
- **(b) Pop reach.** `POP_ATTRIBUTE_INIT = { attributes: true, attributeFilter: ['data-motion-pop-id'],
  subtree: true }` on the layout parent.
- **(c) Completed exits snap outside their boundary.**
  - **Marker.** R5 adds the element to a module-level `exitingElements: WeakMap<Element, { boundary, group }>`
    while `presenceChildContext.isPresent === false`. It is exported from `layout.ts` as `markExiting` and
    `unmarkExiting`. `boundary` is `element.closest('.animate-presence-container')`, and `group` is
    `layoutGroupContext?.group`. The entry is removed only on re-entry, never in a teardown, because Svelte
    removes the DOM before child teardowns (`svelte/src/internal/client/reactivity/effects.js:511-525`) and
    MutationObserver callbacks run after both.
  - Clone exits register their clone the same way from `presence.ts`, using the boundary and group of the
    element they replace.
  - **Classification** applies to **both** childList observers: the self-subtree one (`layout.ts:825`) and the
    layout-parent one. A batch is `exit-complete` when nothing was added and every removed element node is
    either a marker (in `exitingElements`, or a `[data-presence-placeholder]`) or was removed from a record
    target that is the marker's `boundary` container.
  - The cause carries the markers' `{ boundary, group }` pairs.
  - **Throttles.** `schedule()` and `scheduleProjectionCommit` both merge a pending cause **before** their
    throttle checks. The merged cause is `exit-complete` only if every coalesced batch was. The flush uses the
    merged cause and resets it.
  - ResizeObserver deliveries carry no cause. An element that saw an `exit-complete` cause keeps it for
    ResizeObserver deliveries until a **double rAF** has passed, because rAF runs before that frame's
    ResizeObserver delivery.
  - **Rule.** On an `exit-complete` cause the container refreshes silently (the snap), unless:
    - some cause `boundary` **contains** this element (the same boundary, or an inner `AnimatePresence` inside
      it; `use-presence.ts:40-43`); or
    - this element's `layoutGroupContext.group` is one of the cause's `group`s (`index.tsx:206`, `group.ts:26-33`).
  - Adds, exit starts (a clone appearing) and pops are ordinary triggers.
- **(d) The exiting element's own snapshot.** On a pre-update run where this element's own
  `presenceChildContext.isPresent` changed, use `seedOwnSnapshotFromCache()` only if all of these hold:
  - a **structural change is pending in this flush**. The probe is one shared `MutationObserver` per target, with
    `{ childList, subtree, attributes, attributeFilter: ['style', 'class'] }` and a no-op callback. The target is
    the **outermost observed ancestor**, not the layout parent, because the `scroll-mirror` preset removes mirror
    rows that are siblings of the `ul`. `takeRecords()` must contain childList records, and no attribute record
    whose target is outside a node added in the same batch. The answer is cached for the microtask.
  - the cached basis's `resizeEpoch` is current and `!isResizeBlocked()`;
  - no ancestor-attribute record reached this element since its cache was written;
  - the basis is reliable.

  Otherwise read live, exactly as today. The probe is installed only for layout elements with an owned
  `presenceChildContext`.

### C. Clone layout-follow (only for layout clones)

- Applies only when the clone matches `[data-layout], [data-layout-id]`. A clone without them moves with the
  content, as upstream's non-layout exit does.
- At the start of `unregisterChild`: `preBasis = seenScrollBasis(slotParent)`. No reads.
- After `schedulePopLayoutCorrection` (or right after the insert), queue one `microtask.read`. In it:
  - `move = scrollDelta(preBasis, readScrollBasis(slotParent), isFoldedIn)` is the screen move.
  - `from = −move / measureScreenScale(clone.offsetParent)`. The 008 clamp gives `y: [-70, 0]`.
- `layoutTransition = getValueTransition(t, 'layout')`, where `t` is `child.mergedTransition` when it is defined
  and has at least one key, otherwise the local `defaultLayoutTransition`. That mirrors 581-584, 626 and
  2546-2549.
- **One animation.** When `move` is non-zero, start the exit in this microtask instead of the next rAF:
  `animate(clone, { ...exitKeyframes, x: [fromX, 0], y: [fromY, 0] }, { ...finalTransition, x: layoutTransition, y: layoutTransition })`.
  - Cancel the rAF. Resolve `resolveExit(getCustom())` as the rAF callback does, keep `startExit()` and the
    completion wiring, and include `x`/`y` in `activeExit.base`.
  - If the exit animates `x` or `y` itself, that track becomes `[from + current, target]`.
  - When `move` is zero, nothing changes.
  - One `animate()` call keeps Motion's single grouped transform animation, so the follow and the exit's `scale`
    don't fight.

### D. Following nodes outside the list's parent (the footer)

- **Trigger.** Only part B's layout-parent batches, through `observeLayoutChanges(el, onChange, { onLayoutParentChange })`.
  The container passes `MotionDomProjectionAdapter.seedFollowingLayout(parent, records, cause)`. A
  `WeakSet<MutationRecord[]>` dedupes per batch. Never on mount, unmount, scroll, resize or per frame.
- **Walk.**
  - Start at the projection root.
  - Prune any subtree whose `instance` precedes `parent` without containing it.
  - Skip `parent` itself and its ancestors: their own observers see their subtree change.
  - Skip `parent`'s descendants: part B commits them.
- **Pick** nodes that follow `parent` and are mounted, `layout || layoutId`, not dirty, not gated
  (`isLayoutMeasurementGated`), not inside `[data-layout-size-animation]`, with a reliable basis in the current
  `resizeEpoch` (part A), and sharing `parent`'s nearest motion-ancestor element (or the document).
- **Seed mode** (any cause except `exit-complete`).
  - Call `root.startUpdate()` once.
  - For each picked node: seed its snapshot from the rebased `onScreenSnapshot()`, run `prepareSnapshotPath`,
    and set `isLayoutDirty = presenceSeeded = true`.
  - Call `root.didUpdate()` and `scheduleResample()`.
- **Refresh mode** (`exit-complete` cause).
  - For each picked node that isn't covered by the cause's boundary or group rule: `refreshLayout({ silent: true })`
    and notify `onCacheRefresh`.
  - No seeding, no animation. That is upstream's snap.
  - It keeps the cache true, so a later add slides the footer from where it now is. Upstream measures live in
    `willUpdate` (787, 967-978).
- **`presenceSeeded`** is a private adapter field.
  - The `'didUpdate'` listener is installed for every adapter. For ungrouped adapters it acts only when the flag
    is set: it refreshes `lastLayout` and `lastUpdate`, fires the commit listeners, and clears the flag. It does
    not run `shiftFollowingDescendants`.
  - `offProjectionCommit` becomes unconditional.

### How this interacts with 006 A1

- A1 is the mount-time pass for a node taking over a live `resumeFrom`. 015 never touches `resumeFrom`, stacks or
  `takeOverLiveLeadOnMount`, and adds no mount trigger.
- A1's `onScreenSnapshot()` becomes rebased.
- Same-flush seeds only mark nodes dirty before one `update()` (881-886, 825-828), so **no node animates twice**.

### Considered and rejected

- A live tree-wide `willUpdate`: the clone path's DOM has already changed, and it gets case 2 wrong.
- D on mount or unmount: a scan per mount, O(N²) at initial render.
- Svelte `out:` transitions: spike 012 refuted them.
- Treating every scroller as `layoutScroll`: contradicts (i).
- Refreshing per scroll frame: N reads per frame.
- Stealing the shared observers' records: that starves the other subscribers.
- A `data-exiting` DOM attribute: a cleanup-form effect erases it before classification.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Lane setup | `git -C /Users/jasonkummerl/Github/svelte-motion-1471 worktree add /Users/jasonkummerl/Github/svelte-motion-1471-siblings -b lane/1471-siblings feat/motion-14.7.1`, then `pnpm install --frozen-lockfile` in `/Users/jasonkummerl/Github/svelte-motion-1471-siblings` | exit 0 |
| Unit | `pnpm exec vitest run <path>` / `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4223 pnpm exec playwright test <paths>` | all pass |
| Build | `pnpm build` | exit 0 |
| Format / lint | `trunk fmt <files>`, then `trunk check <files>` | no new issues |

## Scope

**In scope**:

- `src/lib/utils/scrollBasis.ts` and its spec (create)
- `src/lib/utils/motionDomProjection.ts`:
  - basis stamps and rebases;
  - new public members: `lastReadScrollBasis`, `rebaseRect` (returns `null` for a `null` rect),
    `seedOwnSnapshotFromCache`, `commitObservedLayoutChange`'s `previousBasis`, `onCacheRefresh`, and
    `static seedFollowingLayout`;
  - registration with the resize refresh;
  - `presenceSeeded`, and the `'didUpdate'` listener for every adapter.

  Also its spec, new `describe`s only.
- `src/lib/utils/layout.ts`, `observeLayoutChanges` (702-841) and new inits next to 657-666: the layout parent,
  `POP_ATTRIBUTE_INIT`, the probe, classification, merged causes, `markExiting`/`unmarkExiting`, and
  `onLayoutParentChange`. Also its spec, new `describe` only.
- `src/lib/html/_MotionContainer.svelte`, these regions only (lines at `3365c175`, locate by anchor):
  - R1: 2192-2194, cache declarations and `setLastRect`;
  - R2: 2242-2267, pre-update effect;
  - R3: 2363;
  - R4: 2596-2925, but only these:
    - every `lastRect`/`observerRestartRect` write listed above;
    - the restart commit and `commitObservedLayout`;
    - `scheduleProjectionCommit`;
    - the 2866 call;
    - `offProjectionCommit`;
    - an `onCacheRefresh` subscription.

    **Not** 2675 or 2920-2922 (013).
  - R5: one new `$effect` after 303 (mark and unmark exiting).
- `src/lib/utils/presence.ts`:
  - delete 760-818 (import them from `scrollBasis.ts`);
  - `unregisterChild` (C, and the clone marker);
  - `ActiveExit`;
  - cancel and cleanup sites;
  - `measurePopLayoutScale` delegates.

  Also `presence.spec.ts`, new cases.
- `src/lib/components/__tests__/PresenceSiblingsHarness.svelte` and `src/lib/components/presenceSiblingSnapshots.spec.ts`
  (create)
- `e2e/animate-presence/pop-layout-container-move.spec.ts`: only the two `test.fixme(...)` calls and their
  comments
- `src/routes/tests/animate-presence/pop-layout-playground/+page.svelte`: only the preset `note` texts and tester
  copy that say "plan 015", rewritten to the fixed behaviour
- the expected parity changes: `e2e/animate-presence/layout-button.spec.ts` (the `sync` completion assertion),
  `src/routes/tests/animate-presence/modes/ModeExample.svelte` (`flowNote`), and `e2e/animate-presence/modes.spec.ts`
  (only the `flow-right-sync` slide assertion, if one exists)
- `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte` and
  `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `.changeset/sibling-layout-snapshots.md` (create)

**Out of scope**:

- `PresenceChild.svelte`, `AnimatePresence.svelte`, `presenceExitRegistry.ts`, `LayoutGroup.svelte`
- other plans' `_MotionContainer.svelte` regions
- `commitPresenceLayoutRelease`
- `measureRect`
- the rest of 008's pages
- `node_modules`, docs, `package.json`, labels

## Git workflow

- Lane `lane/1471-siblings` in `/Users/jasonkummerl/Github/svelte-motion-1471-siblings`. Not
  `isolation: 'worktree'`.
- One conventional commit per step, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Record
  the Step 1 commit SHA, which the done criteria use.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests and parity guards

Each case is labelled **RED** (fails today) or **GUARD** (passes today and must stay green), **per path where it
differs**. Record every outcome. If a label doesn't hold, STOP.

1. **008's spec.** Delete the two `test.fixme(...)` calls and their `// Plan 015:` comments. Nothing else changes.
2. **`scrollBasis.spec.ts`.** Every case is RED today because the module is missing, but each states the behaviour
   it pins:
   - 2a: `overflow:auto` is detected through the shorthand, even though jsdom reports `overflowX`/`overflowY` as
     `visible`.
   - 2b: `hidden` is included and `visible` excluded.
   - 2c: `scrollingElement` is excluded.
   - 2d: a body scroller under `html { overflow: hidden }` is included.
   - 2e: a fixed element or ancestor sets `fixed` and stops the walk.
   - 2f: a sticky node below the scroller sets `sticky`.
   - 2g: the walk crosses a shadow `host`.
   - 2h: flipping `isFoldedIn` between two reads changes the result, so it's evaluated at read time.
   - 2i: `seen` updates on a `scroll` event.
   - 2j: `seen` updates on a `document` `click` with no scroll event.
   - 2k: `scrollDelta` for 0 → 500 is 500.
   - 2l: with `getBoundingClientRect().height` mocked to half of a defined `offsetHeight`, it is 250.
   - 2m: the fixed root term has sign +1 (`documentElement.scrollTop`).
   - 2n: a same-epoch basis shifts by `{0, 0}`.
   - 2o: an `unreliable` basis, and a stale-`resizeEpoch` basis, both shift by `null`.
   - 2p: no terms means zero `getBoundingClientRect` calls.
   - 2q: after a `resize` with a changed `innerWidth`, `isResizeBlocked()` is true for 250 ms (fake timers),
     and the refresh callbacks fire once.
3. **`motionDomProjection.spec.ts`**, `describe('… scroll-rebased snapshots (plan 015)')`:
   - 3a **RED**: after a scroller scrolls 0 → 500, `commitGroup` seeds the rebased (−500) snapshot.
   - 3b **RED**: the same for `currentVisualPageRect()`.
   - 3c **RED**: the same for `commitObservedLayoutChange(prev, { previousBasis })`.
   - 3d **RED**: a fixed element after a window scroll of 300 (`documentElement.scrollTop`) is rebased by +300.
     Today it gets the stale box.
   - 3e **GUARD (phantom tripwire)**: after a simulated clamp (500 → 430, no scroll event), commit A with a
     pre-change stamp and then commit B with a post-clamp rect in the same task. B's snapshot equals its rect, and
     no node animates twice (each `animationStart` listener fires at most once). It passes trivially today; it is
     the case a rebase without epochs would fail.
   - 3f **GUARD**: a node on a sticky path keeps its unrebased cache. That's today's behaviour, kept.
   - 3g **GUARD**: with no scrollers, `expect(adapter.lastReadScrollBasis).toBeFalsy()`.
   - `describe('… seedFollowingLayout (plan 015)')`, all **RED** (method missing):
     - 3h: it seeds a following node.
     - 3i: it prunes preceding subtrees and skips `parent`, its ancestors and descendants, gated, dirty,
       unmounted, sticky-path, stale-`resizeEpoch` and other-motion-ancestor nodes.
     - 3j: it runs once per `records` array.
     - 3k: it calls `root.didUpdate()` once.
     - 3l: in refresh mode it calls `refreshLayout({ silent: true })` and seeds nothing.
     - 3m: it leaves `resumeFrom` and stacks untouched.
4. **`layout.spec.ts`**, `describe('observeLayoutChanges reach and causes (plan 015)')`, with real jsdom
   MutationObservers. The harness injects no CSS; the class rule must suffice.
   - 4a **RED**: under an `.animate-presence-container` parent, an append to the grandparent calls `onChange`.
   - 4b **RED**: setting `data-motion-pop-id` on a sibling calls `onChange`.
   - 4c **RED**: removing a `markExiting` element passes `{ kind: 'exit-complete' }`, through both the self-subtree
     and the layout-parent observers.
   - 4d **GUARD**: an add plus a removal in one batch is not exit-complete.
   - 4e **RED**: two batches coalesced by the throttle (one exit-complete, one add) give a non-exit-complete
     merged cause.
   - 4f **RED**: `onLayoutParentChange` fires once per batch.
   - 4g **GUARD**: a sibling's `style` change doesn't call `onChange`.
5. **Component spec.** `PresenceSiblingsHarness.svelte` + `presenceSiblingSnapshots.spec.ts`.
   - **Harness**:
     - `#head-wrap > motion.div layout #header`, a `motion.ul` of three items, then
       `#foot-wrap > motion.div layout #footer`, all with `data-box`;
     - the owned path gives each item its own `<AnimatePresence present>`; with `clone`, one `AnimatePresence`
       wraps a keyed `{#each}`;
     - props `items`, `mode`, `clone`, `addFirst` (prepends in the same update), `layoutGroup` (wraps
       everything), `footerInList` (puts the footer directly in the `ul`'s parent), `nested` (item 2 holds an
       inner `AnimatePresence` with a `motion.div layout #inner`).
   - **Set-up**: `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`. Listen to each node's
     projection `'didUpdate'`.
   - **Cases**:
     1. **RED, owned popLayout**: item 1 exits and item 0 is mocked +70 once the pop applies. Item 0's
        `didUpdate` fires once, from the old top to 70 lower.
     2. **RED, both paths, popLayout**: the footer is mocked 70 higher after the pop; the footer animates
        (part D). Within it, **GUARD**: the header has no `didUpdate` and no `getBoundingClientRect` call.
     3. **RED, clone add**: the footer moves 70 and animates.
     4. **RED, owned popLayout with `addFirst`**: the prepend pushes item 0 **down** 70 before its pre-update
        effect. Item 0's seeded snapshot is its pre-insert box.
     5. **GUARD, owned sync completion with no `LayoutGroup`**: item 2 has no `didUpdate` (upstream snaps;
        nothing observes it today). **RED** with `layoutGroup`: item 2 animates. Today it doesn't see the
        completion; group membership via `commitGroup` covers only same-group fan-out. Record the outcome. If it
        already animates today, relabel it GUARD and say so in your report.
     6. **Clone sync completion with no `LayoutGroup`**:
        - **GUARD**: the footer outside has no `didUpdate`.
        - **RED, `footerInList`**: no `didUpdate`. Today it animates.
        - **RED, the N1 sequence** (completion, then an add): the footer's `didUpdate` snapshot equals its
          **post-completion** box. Today it equals the pre-completion cache.
     7. **GUARD, clone sync completion**: item 2 (same `AnimatePresence`) animates.
     8. **`nested`, sync, item 1 completes, no `LayoutGroup`.** `#inner` sits in an inner `AnimatePresence`
        inside item 2, and is mocked 70 up after the removal.
        - **Clone path, RED**: item 2 shares item 1's boundary, so the boundary *contains* `#inner`, which
          animates (`use-presence.ts:40-43`). Today `#inner`'s immediate parent is its own inner container, so
          it never sees the removal, and it snaps.
        - **Owned path, GUARD**: item 2 is in a different boundary, so `#inner` snaps (no `didUpdate`). That's
          true today, and must stay true after B(a).
     9. **GUARD**: a sibling with an unchanged `layoutDependency={1}` gets no `didUpdate`.
     10. **RED, a real owned completion**: the removal record is classified `exit-complete` (spy on the
         container's silent refresh). This checks the marker survives Svelte's teardown order.
6. **`presence.spec.ts`**:
   - 6a **RED**: a layout clone (`data-layout="true"`) in a scroller tracked at 500, `scrollTop = 430` before
     draining, and the clone mocked 70 lower. The mocked `animate` received
     `expect.objectContaining({ y: [-70, 0] })` as the single exit call, before any rAF.
   - 6b **GUARD**: a non-layout clone gets no follow, and the exit starts on the rAF.
   - 6c **GUARD**: no scroll change means no follow.
7. **Page and spec** (see Test plan). Run them and record each case's label per path.

**Verify**:
- All labels hold.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → exactly the
  five cases fail, within ±10% of the baselines.

Otherwise STOP. Commit, and record the SHA.

### Step 2: `scrollBasis.ts`

Implement Design A, including the resize block and refresh registry, with JSDoc. The header cites
`PopChild.tsx:39-46, 63-80` and `create-projection-node.ts:511-532, 690, 797-820, 1022-1043, 1105-1156`. Move
the four helpers out of `presence.ts`, and make `measurePopLayoutScale` delegate to `measureScreenScale`. No
import from `presence.ts`.

**Verify**: Step 1.2 passes. In `presence.spec.ts`, only 6a fails.

### Step 3: Rebase the adapter's caches

1. Stamp a basis in the `'measure'` listener and in `rememberLayoutBox`, and set `lastLayoutBasis` at every
   `lastLayout` write.
2. Add a private `rebaseMeasurements` (using `translateAxis`; pattern `shiftFollowingDescendants` 1481). Apply it
   in `onScreenSnapshot`, `seedCachedSnapshotsForSubtree` and `currentVisualPageRect`. A `null` shift falls back
   to today's unrebased cache.
3. Add the public members, the resize registration, and `scheduleResample()`.

**Verify**: Step 1.3, cases 3a–3g, pass. The existing blocks, including 006's and 007's, pass.

### Step 4: The container uses rebased rects (R1, R3, R4 writes)

1. Add `setLastRect` and route every `lastRect`/`observerRestartRect` write through it, carrying the basis.
2. Rebase `previous` before `hasRectChanged`, `isFollowingAncestorUpdate`, `emitProjectionUpdate` and
   `computeFlipTransforms`.
3. Add the `onCacheRefresh` subscription, and refresh silently while `isResizeBlocked()`.

**Verify**:
- `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` → only the declaration and `setLastRect`.
- `pnpm check` → 0 errors.
- The clone clamp cases no longer jump 1392/348 px. Record their numbers.

### Step 5: Reach and causes (B a–c, R5, the R4 cause plumbing)

Implement the layout-parent resolver, `POP_ATTRIBUTE_INIT`, the markers (R5 and the clone), classification on
both observers, merged causes across both throttles, the double-rAF ResizeObserver window, and the
boundary-contains and same-group rule in `scheduleProjectionCommit`.

**Verify**: Step 1.4, cases 4a–4e and 4g, pass, and Step 1.5 cases 1, 5, 6 (the first two bullets), 7, 8, 9 and
10 pass. (4f, 2, 3 and the N1 bullet of case 6 need Step 7.) Then run
`PW_PORT=4223 pnpm exec playwright test e2e/animate-presence`:
- the owned clamp cases pass;
- `layout-button` and `modes` change as listed. Apply the expected parity changes now.
- every other spec passes.

### Step 6: The exiting element's own snapshot (B d, R2)

Add the probe (`hasPendingStructuralChange(el)`, cached per microtask) and the ancestor-attribute bookkeeping.
Implement B(d) in R2, citing `MeasureLayout.tsx:149-204`.

**Verify**: Step 1.5 case 4 passes. 008's owned same-render case passes, and the playground `toast` and
`scroll-mirror` cases pass.

### Step 7: Clone follow (C) and following nodes (D)

Implement C in `presence.ts`. Implement D in the adapter, `layout.ts` (`onLayoutParentChange`) and R4 (the
option, and `offProjectionCommit` unconditional).

**Verify**: `pnpm exec vitest run src/lib/utils src/lib/components` → all pass.
`PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
→ all pass on both paths.

### Step 8: Playground notes, guards, changeset, gate

1. Rewrite the playground preset notes and tester copy that say "plan 015" to describe the fixed behaviour. Keep
   the three "Still wrong with the fix" notes.
2. Run:

   `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/projection/scroll-during-layout.spec.ts e2e/projection/sibling-swap.spec.ts e2e/projection/nested-ancestor.spec.ts e2e/independent-transforms/layout-rotating-3d.spec.ts`

   → all pass, with no read budget raised. That set includes `read-budget`,
   `layout-group-interrupt-measurements`, `relative-child-measurements` and `layout-dependency`. Re-run a
   failing spec alone once.
3. `.changeset/sibling-layout-snapshots.md`:
   ```md
   ---
   '@humanspeak/svelte-motion': patch
   ---

   Layout animations around `AnimatePresence` and list changes follow Motion's render model. When a list changes
   (an item added, removed, or popped out with `mode="popLayout"`), its other items, including those in separate
   `AnimatePresence` boundaries, and `layout` elements after it (such as a footer) animate from where they were,
   and an exiting element's own animation starts from where it was even when other DOM changed in the same
   update. When an exit completes, only elements in the same `AnimatePresence`, or in its `LayoutGroup`, animate;
   others move instantly, as in Motion. Cached layouts now account for scroll containers that aren't
   `layoutScroll`, fixed elements on a scrolled page, and window resizes, so scrolling or resizing and then
   changing a list no longer makes items jump.
   ```
4. Gate, in order:
   - `trunk fmt` then `trunk check` on every changed file;
   - `pnpm check` → 0 errors;
   - `pnpm test:only` → all pass;
   - `pnpm build` → exit 0;
   - the Step 8.2 set → all pass;
   - `git status` → only in-scope files.

## Test plan

- **Red anchors**: 008's five cases, the two playground cases, and the RED cases of Step 1. All pass after Step 7,
  and every GUARD stays green.
- **Page** `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`:
  - The header comment cites #2348, `MeasureLayout.tsx:149-218`, `AnimatePresence/index.tsx:206, 236-244` and
    `PresenceChild.tsx:91-98`.
  - Params: `path=owned|clone`, `mode=popLayout|sync`, `layoutScroll`, `layoutGroup`, `footer`, `fixed`,
    `sticky`.
  - **Default.** A 320 px `#scroller` (`overflow: auto`; a `motion.div layoutScroll` with that param) centred
    with `margin-inline: auto`, so a window resize moves it on x. Inside: a 600 px spacer, then a `motion.ul`
    with five `motion.li layout` items `sib-0`…`sib-4`, 150×60 with a 10 px gap,
    `transition={{ type: 'spring' }}`, `exit={{ opacity: 0 }}`.
    - Colours: `sib-1` `#0077ff` (blue), `sib-2` `#ff0088` (pink, exits), `sib-3` `#00aa44` (green), the rest
      `#888`.
    - The owned path gives each item its own `<AnimatePresence present child>`.
  - **`?footer`.** No scroller. `#head-wrap > motion.div layout #header` (`#aa00ff`), the list,
    `#foot-wrap > motion.div layout #footer` (`#ffaa00`).
  - **`?fixed`.** No scroller. A 1500 px page spacer, then the list `position: fixed; bottom: 20px`.
  - **`?sticky`.** A `position: sticky` `motion.div layout` header as the first child of `#scroller`.
  - Buttons: `scroll-bottom`, `remove` (`sib-2`), `add`.
  - The page records `window.__removedAt` when `sib-2` (or its clone) leaves the DOM.
  - `TesterPanel` (hidden under `?@isPlaywright=true`):
    - steps with Expected text, including "sync without LayoutGroup: after the fade, owned siblings and the
      footer **jump** into place, as in Motion; with `?layoutGroup` they slide";
    - chips `GAP HOLDS/DRIFTS`, `NO JUMP/JUMPED`, `SNAP (expected)/SLID`;
    - a status line.
  - Link it from `src/routes/+page.svelte`: "Layout siblings and footers around exits (plan 015)".
- **Spec** `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (real clock; Playwright viewport 1920×1080).
  - **Frame rules.** Screencast every frame. A colour band's top row is the first row with at least 20 pixels
    within ±24 per channel of the colour. Require at least 10 frames with every asserted colour, otherwise fail
    with "too few frames".
  - **Cases.**
    - **Clamp, popLayout.** Every frame: the pink−blue gap is within 2 px of its start, green is within 2 px, no
      step is above 35 px, and `elementFromPoint` at blue's mid-frame centre hits `#sib-1`. **RED** on both
      paths (clone: stale-cache jump; owned: sibling snap).
    - **`?layoutScroll`, popLayout.** Blue and pink each step by 70 ± 2 in the same frame, the gap holds, blue
      has no layout transform, green isn't asserted. **GUARD** on both paths.
    - **Sync completion in a scrolled container.**
      - Clone: no step above 35. **RED** (stale-cache jump).
      - Owned without `LayoutGroup`: blue steps once by 70 ± 2 with no layout transform. **GUARD**.
      - Owned with `?layoutGroup`: no step above 35. Same label as Step 1.5 case 5.
    - **`?footer`, popLayout remove and add.** Orange never steps above 35 and ends 70 ± 2 away. **RED** on both
      paths.
    - **`?footer&mode=sync`, completion.** Orange steps once by 70 ± 2. **GUARD**. With `?layoutGroup` it slides.
      **GUARD**.
    - **N1: `?footer&mode=sync`, remove, wait for completion, then add.** Orange slides 70 ± 2 with no step above
      35. **RED** (today it snaps).
    - **`?fixed`, window scrolled by 300, remove.** No step above 35 and no 300 px phantom. **RED** on both paths
      (clone: a ~300 px phantom FLIP; owned: siblings snap 70).
    - **Resize.** Resize the viewport 1920 → 1600, wait 400 ms (more than upstream's 250 ms block), then remove
      in popLayout without a scroll. No band moves on x by more than 2 px. **RED, clone** (stale-x phantom
      slide). **GUARD, owned** (today siblings don't commit; after part B they do, so this pins the refresh).
    - **`?sticky`, scroll, remove.** No step above 35. **RED** on both paths (clone: stale cache; owned: sibling
      snap; the sticky header itself is a sibling, not on blue's path).
    - **Non-layout clone in a clamped scroller** (a test-only `motion.li` without `layout`, `?nolayout`). Pink
      steps with the content by the clamp in one frame. **GUARD**.
    - **Playground, `?preset=toast&path=owned`**, click `pg-cycle`: `drift-0` is ≤ 1 px. **RED** (~70).
    - **Playground, `?preset=scroll-mirror&path=owned`**, unscrolled, click `pg-item-1`: `drift-1` is ≤ 1 px.
      **RED** (~70).
  - **Read budgets** (wrapped `getBoundingClientRect` per `id`):
    - 30 rAF-spaced scroll steps → **0** reads on every `sib-*`, `header` and `footer`.
    - Clone and owned sync → at most **3** reads per sibling in 500 ms from `__removedAt`, then **0** over the
      next 500 ms.
    - `?footer` → the footer gets at most **2** reads per qualifying change (seed or refresh), and `header` gets
      **0**.
    - Resize → each node gets exactly **1** refresh read in total, 250 ms after the last resize event, and **0**
      during the resize.
    - Owned popLayout → only the idle 0 (008 A2's point cache samples while moving).

## Done criteria

- [ ] `grep -n "Plan 015\|test.fixme" e2e/animate-presence/pop-layout-container-move.spec.ts` prints nothing,
      and that spec passes.
- [ ] `grep -n "export const scrollShift\|export const scrollDelta\|export const getScrollAncestors\|export const captureScrollSnapshot" src/lib/utils/scrollBasis.ts`
      prints four lines, and `grep -n "const captureScrollSnapshot" src/lib/utils/presence.ts` prints nothing.
- [ ] `grep -n "lastRect = " src/lib/html/_MotionContainer.svelte` → the declaration and `setLastRect` only.
      `grep -rn "data-exiting" src/lib/html` prints nothing (the marker is a WeakMap).
- [ ] `grep -n "POP_ATTRIBUTE_INIT\|exit-complete\|markExiting" src/lib/utils/layout.ts` prints at least four
      lines. `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` prints one.
- [ ] `git diff <step-1 SHA>..HEAD -- src/lib/utils/scrollBasis.spec.ts src/lib/utils/motionDomProjection.spec.ts src/lib/utils/layout.spec.ts src/lib/components/presenceSiblingSnapshots.spec.ts src/lib/utils/presence.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
      shows no removed or weakened assertion (no deleted `expect`, no loosened tolerance, no `fixme`/`skip`).
      Relabels recorded in Step 1 are the only exception, and the report lists them.
- [ ] Every Step 1 RED passes and every GUARD passes. The Step 8.2 suites pass with no budget raised. Only the
      listed parity changes were applied.
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` is clean; the page is
      linked; the changeset exists; only in-scope files changed.

## STOP conditions

- A precondition grep prints nothing, or an excerpt doesn't match.
- A Step 1 label doesn't hold, beyond the relabels Step 1 explicitly allows.
- **A fix seems to need a full-tree measure every frame, or any layout read per scroll event or frame.** For D,
  that includes running it on mount, unmount, scroll, resize or per frame, measuring nodes that precede `parent`,
  or seeding on an exit-complete batch.
- A read budget needs raising.
- A node animates twice for one change, `onProjectionUpdate` fires twice, or an animation restarts from its
  origin.
- 008's owned layout cases drift by the container move (the projection measured before 008's correction).
- Part C loses or snaps the exit, or breaks a `custom`/exit-timing spec.
- **A demo's visible behaviour changes without a spec failing, and it isn't in "Expected parity changes".**
  Report it for the maintainer's sign-off. The same applies when an existing spec fails that isn't in that list;
  use CLAUDE.md's failed-e2e review workflow.
- **B(d) never takes the cached branch in Step 1.5 case 4**, or takes it without a pending structural change.
- The class-based layout-parent rule doesn't make Step 1.4 case 4a pass in jsdom. Don't inject CSS to force it;
  report.
- Classification misses a real owned completion (Step 1.5 case 10).
- The fix needs an out-of-scope file, especially `PresenceChild.svelte`.
- A guard suite fails twice after a reasonable fix in scope.

## Ordering against 012 and 013 (recommendation)

- 013 edits the same observer effect (2675, 2920-2922), and is S effort.
- 012 (spike) prototypes in `presence.ts` `unregisterChild` and `PresenceChild.svelte`, where part C lives.

**Recommended**: run in parallel with 013. Merge 013 first, then 015 (merge `feat/motion-14.7.1` into the lane
first, keep 013's deletions next to `setLastRect`, re-run Step 8.2), then start 012 (merge the feat branch first).
Reason: the smaller diff lands first, and 012's report would be stale without part C.

## Maintenance notes

**Recorded divergences from upstream:**
- **Component boundaries.** D seeds following nodes in other components under the same motion ancestor (or the
  document) that upstream would snap. Svelte leaves no component boundary in the DOM. D also assumes normal flow:
  only boxes after `parent` move.
- **Clone exits without `exit`** are removed at once, with no clone. The siblings then see a plain removal, which
  is classified as a state-change trigger, not exit-complete. Upstream renders those through a completion
  render too.
- **Per-clone removal.** Each clone leaves on its own, so each completion is its own batch. Upstream removes all
  completed exits in one render (`index.tsx:171-176`).
- **`presenceAffectsLayout={false}`** isn't supported. Same-boundary siblings always animate on completion.
- **Plain non-motion lists** never trigger D. Its trigger is a motion element's layout-parent observer.
- **Wait mode.** `commitPresenceLayoutRelease` (wait-mode hold release) uses its own animation rule, not
  `MeasureLayout.tsx:116-127`'s mount-time `didUpdate`, and still diffs an un-rebased `previousRect`. That is an
  existing divergence; follow-up.
- **`seen`** is the scroll as of the last resample. A programmatic scroll plus a DOM change in one task, with no
  input event between them, still uses the older value. The epoch only protects reads taken after the last
  resample.

**Upkeep:**
- The computed-style memo isn't invalidated. If an `overflow` or `position` change matters, invalidate from the
  `scroll` capture listener when an unknown element scrolls.
- If 012's build gives clones a projection node, delete part C.
- Reviewers should check:
  - signs, including the fixed root term;
  - every `lastLayout` write updating its basis;
  - `previous` rebased before every comparison;
  - C queued after 008's correction and gated on `data-layout`;
  - merged causes surviving both throttles;
  - the boundary-contains and same-group rule.
