# Plan 012: Exiting `AnimatePresence` children keep a live projection node: `layoutId` children take part in shared layout (relegate, promote, crossfade, held removal) and `layout` children keep animating, on both exit paths

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> Report to the dispatcher when done; lanes never edit the batch README.
>
> **Never use `git stash`** (one stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4216**. Every Playwright command starts with `PW_PORT=4216`.
> Never use or kill port 4198 (the maintainer's sign-off browser). Never set `PW_REUSE_SERVER`. Parallel lanes
> compete for CPU: re-run a failing spec alone once before reporting it, and say that you re-ran it.
>
> **This was a spike; the operator approved converting it into a build (2026-10-28).** The design below is
> decided. Step 3 is a short, time-boxed probe of the two load-bearing assumptions of the clone path, one for
> `layoutId` clones and one for `layout`-only clones, before the full build. If the probe refutes either, STOP
> (see "STOP conditions" and "Fallbacks").
>
> **Operator rulings (2026-10-28, standing rules: adopt upstream; don't defer cheap edge cases):**
> - (1) The parity change (held `layoutId` exits crossfade, even with no `exit`) is accepted, and the batch's
>   live sign-off covers it.
> - (2) Re-homed clones keep their `id`.
> - (3) The node move also covers `layout`-only clones, and **015a's part C is deleted in this plan**. Its e2e
>   cases stay as GUARDs.
> - (4) The `layout-shared-lightbox-crossfade` port, with the child scale and border-radius correction it
>   needs, is in this plan.
>
> **Lane setup (requires 015a and 015b merged into `feat/motion-14.7.1`).** Batch order is
> 015a → 015b → **012** → 015c. In `/Users/jasonkummerl/Github/svelte-motion-1471-layoutid` (branch
> `lane/1471-layoutid`):
>
> 1. `git status --short` is empty (if not, STOP).
> 2. `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`.
> 3. Each of these prints at least one line, otherwise STOP:
>    - `grep -n "switchLayoutId" src/lib/utils/motionDomProjection.ts` (006)
>    - `grep -n "seedDepartingLeadSnapshot" src/lib/utils/motionDomProjection.ts` (007 A1)
>    - `grep -n "layoutRoot?: boolean" src/lib/types.ts` (007)
>    - `grep -n "schedulePopLayoutCorrection" src/lib/utils/presence.ts` (008)
>    - `grep -n "export const scrollShift" src/lib/utils/scrollBasis.ts` (015a)
>    - `grep -n "static foldedInFor" src/lib/utils/motionDomProjection.ts` (015a)
>    - `grep -n "Plan 015a, part C" src/lib/utils/presence.ts` (015a's clone layout-follow)
>    - `grep -n "static seedFollowingLayout" src/lib/utils/motionDomProjection.ts` (015b)
>    - `grep -n "markExiting" src/lib/utils/layout.ts` (015b)
> 4. The seven fixmes this plan removes are present:
>    `grep -c "^test.fixme(" e2e/layout/layout-root.spec.ts` prints `6`, and
>    `grep -n "test.fixme('closing then shrinks the card into thumbnail two'" e2e/layout-id/open-change.spec.ts`
>    prints one line. Otherwise STOP.
> 5. 015c should **not** be merged yet: `grep -n "seedOwnSnapshotFromCache" src/lib/utils/motionDomProjection.ts`
>    prints nothing. If it prints a line, 015c landed first: continue, but in Step 4 read its R2 code and keep
>    this plan's presence effects declared **after** R2 (see "Hand-offs").
>
> **Drift check (run after the merge)**: record `M=$(git rev-parse --short HEAD)` (the merge commit) and
> `git log --oneline b21e938a..HEAD -- src/lib/utils/presence.ts src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte src/lib/types.ts e2e/layout/layout-root.spec.ts e2e/layout-id/open-change.spec.ts src/routes/tests/layout-root/+page.svelte src/routes/tests/layout-id/open-change/+page.svelte`.
> Expected: only 015a's and 015b's commits (and 013's, if it merged). Line numbers in this plan are at
> `b21e938a` unless marked otherwise, and 015a/015b shift them: **locate every excerpt by its anchor text**. If
> an anchor is missing or its content differs from the excerpt, STOP.

## Status

- **Priority**: P1 (every `layoutId` + `AnimatePresence` crossfade; closes 7 `fixme`s left by 006 and 007)
- **Effort**: L
- **Risk**: HIGH. It changes when exiting `layoutId` elements are removed (they are now held until the shared
  animation ends, as upstream), which is visible on several demos. It keeps a projection node alive on every
  `layout`/`layoutId` exit clone, and it replaces 015a's part C with that node.
- **Depends on**: 006, 007 (same lane, merged: `switchLayoutId`, `seedDepartingLeadSnapshot`, the #1935 page and
  its fixmes), 008 (presence helpers), 015a (scroll-rebased caches, part C in `unregisterChild`), 015b (clone
  marker, `registerChild`'s `layoutGroup` argument, exit-complete causes). 012 edits the same `presence.ts` and
  `_MotionContainer.svelte` functions as 015a/015b, after them.
- **Wave**: 5, lane `layoutid`, after 015b merges; 015c runs after this plan merges.
- **Category**: bug (upstream parity)
- **Planned at**: commit `b21e938a` (`feat/motion-14.7.1`, after 007), 2026-10-28, with 015a in progress on
  `lane/1471-siblings` (`c1533f92` plus uncommitted part C) and 015b planned.

## Why this matters

Upstream, an `AnimatePresence` child with a `layoutId` keeps its element and projection node while it exits.
Its `MeasureLayout` sees `isPresent` flip to `false`, **relegates** the node in its shared-layout stack (an
earlier present member is promoted, e.g. the thumbnail a modal came from), and holds removal (`safeToRemove`)
until the new lead's layout animation completes. So the old element follows the new one and fades out while
the new one fades in. That is the crossfade in the docs' tabs and lightbox examples, "close the modal, it
shrinks back into the thumbnail", and "a removed element isn't removed until the animation completes", even
with no `exit` prop.

svelte-motion does none of this. A direct child exits as a detached clone with no projection node, and with no
`exit` it is removed at once. A child on the owned path (`present` + `child` snippet) keeps its node, but nothing
tells the node it is exiting, so 006's takeover hides it instantly. 007 left six #1935 crossfade cases as
`test.fixme`, and 006 left the open-change "closing shrinks the card" case. This plan ports upstream's mechanism
on both paths and turns all seven green.

The same applies to `layout`-only exits. Upstream an exiting `layout` element keeps its node, so a layout change
during the exit (e.g. a `popLayout` scroll clamp) animates through projection. 015a's part C imitates that for
clones with a hand-written `x`/`y` follow. Once the clone carries the real node, part C is redundant, and it is
deleted here.

## Decided design

### Owned path (`<AnimatePresence present={…}>{#snippet child()}…`): port `MeasureLayout`'s presence logic

The element and its projection node stay mounted. The container does what upstream `MeasureLayout` does,
line for line:

- **Register** (`componentDidMount` 136-143 plus `usePresence` 52-57): while `measureLayoutMounted` is true,
  the adapter is mounted and there is a `presenceChildContext`, register one participant with
  `presenceChildContext.register(id)`. `id` has its own namespace, `measure-${componentHydrationId}`, so it
  never collides with the exit feature's numeric ids. Install
  `projection.addEventListener('animationComplete', safeToRemove)` and
  `projection.setOptions({ ...projection.options, onExitComplete: safeToRemove })`. Unregister on teardown.
- **Pre-update** (`getSnapshotBeforeUpdate` 163, 177-201), when this element's own
  `presenceChildContext.isPresent` changed: `projection.isPresent = isPresent`, then `willUpdate()`, then
  `isPresent ? projection.promote() : !projection.relegate() && frame.postRender(() => projection.getStack()?.members.length || safeToRemove())`.
- **Post-update** (`componentDidUpdate` 206-217): `projection.root.didUpdate()`, then
  `microtask.postRender(() => { if (!projection.currentAnimation && projection.isLead()) safeToRemove() })`.
- **`safeToRemove`** (`usePresence` 59-64): a no-op while present. While exiting it calls the cycle's
  `onExitComplete(id)`, captured when the flip was seen (as `buildPresenceContext` captures it today).
  - **The adapter latches release once per exit cycle.** `setPresence(false)` and `handOffToExitClone` arm a
    latch. The first release signal fires it and disarms it. `setPresence(true)`, `cancel()` and unmount disarm
    it. Every later signal in the same cycle is a no-op inside the adapter.
  - This is what keeps #3233 (`onExitComplete` once) fixed, even though `NodeStack.exitAnimationComplete`
    calls every member's `onExitComplete` (stack.ts 76-81) and the `animationComplete` and microtask checks can
    fire too.
  - `createPresenceExitRegistry` ignoring a completed id or a stale cycle is only a backstop. Unit 9c asserts
    the latch itself: the adapter calls its `safeToRemove` callback exactly once.

`PresenceChild.svelte` needs no change. It already holds its children until every registered participant
completes.

### Clone path (direct children): re-home the departing node onto the exit clone

Svelte detaches the element before any teardown runs, so the element can't stay. The **same** VisualElement and
projection node stay alive, re-pointed at the exit clone, until the shared animation releases them. Upstream
never recreates the node either: it unmounts only after `safeToRemove`.

- **Registration (P5, blocker B1).** Today the container registers a direct child only when it has an `exit`.
  The `$effect` with anchor `context.registerChild(` (`_MotionContainer.svelte:868-870`) is gated on
  `exitProp !== undefined`, so `unregisterChild` returns "child not found" for every no-`exit` child
  (`presence.ts:1664`).
  - P5 widens the gate to `exitProp !== undefined || measureLayoutMounted`.
  - It passes the hand-off as the **last** `registerChild` parameter, located by name, `layoutHandOff`. 015b
    adds `layoutGroup` before it; don't rely on positions.
  - The hand-off is an object with three members:
    - `canHandOff(): boolean`. True when the adapter is mounted, **not already handed off**, and
      `measureLayoutMounted`. It runs during teardown, where it reads the `$derived` `measureLayoutMounted`;
      Svelte serves a destroyed derived its last value through `old_values`. So a `layoutId` cleared in the
      same flush as the removal reads the pre-flush value, as upstream's `MeasureLayout` still renders with its
      last props. 10d-ii covers this. Once an adapter is handed off, it returns `false`, so a second
      `unregisterChild` for the same key can't re-home it twice (10i).
    - `layoutRect(): PopLayoutSnapshot | undefined`. The held clone's placement (see Placement). It is called
      right after `canHandOff()`, before any clone work.
    - `handOff(clone, release): ExitLayoutHold | undefined`.
- **Which children.** Every child whose `MeasureLayout` would be rendered upstream, i.e. the container's
  `measureLayoutMounted` (`layout || layoutId`, or `drag`, with the features loaded). `layout`-only children
  are included (ruling 3).
- In `unregisterChild`:
  - **Decide `canHandOff()` first, before any clone work**, then read `layoutRect()`. A child that won't be held
    and has no `exit` keeps today's immediate removal, so a non-held no-`exit` child never flashes a clone.
  - **No connected slot parent → no clone (N4).** Today a detached child whose `insertionParent` is gone falls
    back to `doc.body` (`const slotParent = insertionParent ?? doc.body`, `presence.ts:1817`). Instead,
    `unregisterChild` builds no clone, settles a hold it would have taken (none is taken), and removes the
    child at once, held or not (10j).
  - For a held child, the no-`exit` early return is skipped, and the exit is **resolved synchronously at
    hand-off time**. Today the container always passes `resolvePresenceExit`, which can return `undefined`,
    and the rAF's `!resolvedExit` branch (`presence.ts:1963`) removes the clone. For a held child that branch
    instead **settles the exit flag** of the hold/exit join and leaves the clone to the hold.
  - After the clone is inserted and positioned (and after 008's `schedulePopLayoutCorrection` is queued), call
    the hand-off with the clone.
  - **Placement (M1).** Once `visualElement.current` is the clone, the VisualElement renders the element's
    transforms (`x`, `scale`, …) and its `style` motion values onto it each frame. Today the clone is placed
    from the element's **transformed** rect and frozen styles (`presence.ts:1704-1706, 1871-1875`), so those
    transforms and any `style` layout keys (`top`, `left`, `width`, `height`, `margin*`) would be applied twice.
    A held clone is therefore placed from an **untransformed, offsetParent-relative, margin-aware** box. That is
    008's `measurePopLayoutSnapshot` (`presence.ts:526-555`: raw `offsetTop`/`offsetLeft`/`offsetWidth`
    against `offsetParent`, as upstream `PopChild` measures). Following the operator's rule (dedup to the
    strongest existing variant), 012 reuses it rather than the adapter's `latestLayoutBox`. That box keeps
    style transforms whenever `latestLayoutKeepsTransforms` is set (`motionDomProjection.ts:385`), as
    `seedDepartingLeadSnapshot` has to correct for (819-823).
    - **Capture in every mode.** For a child whose `canHandOff()` would be true, the container records
      `measurePopLayoutSnapshot(element, getComputedStyle(element))` in **every** mode, not only `popLayout`.
      It reads only at its existing post-commit layout reads (the adapter's commit/measure listeners, where
      layout is already clean), so it costs no extra forced layout. `layoutRect()` returns the latest record.
    - `unregisterChild` places a held clone from `layoutRect()` exactly as it places a `popLayout` clone today
      (absolute, `top`/`left`/`width`/`height`), whatever the mode. In sync/wait mode the placeholder keeps the
      slot.
    - **Fallback, only if the offset snapshot can't be exact in sync/wait mode** (3d shows it): the adapter's
      cached box through `removeTransform` when `latestLayoutKeepsTransforms` is set, then converted
      page → offsetParent. Record in the report why the offset snapshot failed.
    - For held clones, `unregisterChild` does **not** force `positioningParent.style.position = 'relative'`
      (`presence.ts:1843-1847`): the offset snapshot is already against the real `offsetParent`, as in
      `popLayout` today.
    - Step 3 probes this (3d).
  - **Paint order (M2).** Held clones get no z-index lift. Today `presence.ts:1897-1913` raises exiting clones,
    which inverts upstream, where the exiting child renders first (earlier in the tree,
    `AnimatePresence/index.tsx:155-164`) and the entering one paints over it. Held clones keep the element's
    own stacking and slot. Non-held clones keep today's lift.
  - A `layout`-only node has no stack. Upstream it is released by the same `frame.postRender` /
    `microtask.postRender` checks (`relegate()` is `false`, `getStack()` is `undefined`, `isLead()` is `true`).
    With no layout change it is therefore released in the microtask after the update, before the next paint,
    as upstream. When the update moved it (the clamp), it is released when that layout animation completes.
- The adapter's `handOffToExitClone(clone, release)`:
  1. seeds the departing snapshot from cache. A `layoutId` node uses 007 A1's `seedDepartingLeadSnapshot`,
     unchanged. A `layout`-only node uses the existing private `seedOwnOnScreenSnapshot()`
     (`motionDomProjection.ts:1614`; it reads 015a's rebased `onScreenSnapshot()`), preceded by
     `root.startUpdate()` when the root isn't updating. No new seed method;
  2. sets `projection.isPresent = false`;
  3. re-points `projection.instance` and `visualElement.current` at the clone, and sets
     `visualElementStore.set(clone, visualElement)`. Now `animate(clone, exitKeyframes)` drives this
     VisualElement's values, so the exit and the projection share one renderer, as upstream
     (framer-motion `animation/animate/subject.ts:144-159`: "An element already owned by a VisualElement …
     animates its values so they share one renderer");
  4. runs the same `relegate()` / `frame.postRender` / `root.didUpdate()` / `microtask.postRender` sequence as
     the owned path, with the same `animationComplete` and `onExitComplete` release wiring. The
     `root.didUpdate()` must measure the clone **after** 008's `schedulePopLayoutCorrection` has rewritten the
     pop rule, as part C was queued after it. Otherwise the projection animates the correction itself. Queue it
     the way part C queued its `microtask.read`, after the correction, and assert the order in unit 10e;
  5. defers `unmount()`. When the container's teardown calls `adapter.unmount()` while the node is handed off,
     it only records the request. On release or cancel the **whole** `unmount()` body runs, while the clone is
     still connected: `scheduleCheckAfterUnmount`, the group leave, the departing seed, the listener removal,
     `visualElement.unmount()` and the store cleanup.
     - Upstream the VisualElement unmounts through the ref callback when React detaches the element
       (`motion/utils/use-motion-ref.ts:39`), and `MeasureLayout.componentWillUnmount` handles the group and
       stack. Both happen only after `safeToRemove`. The deferred body is that pair.
     - **The adapter's `this.element` moves to the clone** for the hold, so the deferred `unmount()` and the
       store cleanup act on the clone. The original element is recorded separately so its
       `visualElementStore` entry is deleted at hand-off;
- Removal of the clone waits for **both** the exit animation (if any) and the hold's release, then runs the
  existing completion tail once: `clone.remove()`, placeholder removal, `children.delete`, `finishExit()`, plus
  015b's clone marker and D refresh. `startExit()` and `finishExit()` bracket the whole hold, so wait mode and
  `onExitComplete` wait as upstream does (`AnimatePresence/index.tsx:171-179, 219-249`).
- Re-entry (`takeExitHandoff`), boundary `dispose`, and `containsStatefulCloneContent` cancel or skip the hold.
  Cancel unmounts the node at once. `takeExitHandoff` reads the clone's animated values (`readAnimatedValues`)
  **before** `hold.cancel()`, because cancelling unmounts the VisualElement that renders them (m9).
- **015a's part C is deleted.** It was the clone's own scroll-clamp follow: `startExitAnimation`'s `follow`
  parameter, the `microtask.read` block after the anchor `Plan 015a, part C`, and its keyframe and transition
  merge. The re-homed node now animates the clamp's move through projection, with the element's own layout
  transition (`create-projection-node.ts:581-584, 626`). Delete any import that only part C used. Keep 015a's
  `scrollBasis.ts` helpers that other code still imports.
- A handed-off clone keeps its `id` (ruling 2), because upstream keeps the real element. Other clones still
  drop it.

### Nested shared-layout children and the lightbox port (ruling 4)

Upstream's lightbox fixture (`dev/react/src/tests/layout-shared-lightbox-crossfade.tsx`) is the case of nested
`layoutId` nodes: a gallery `li` (`layoutId={color}`) with a child (`layoutId={child-${color}}`), and a
`SingleImage` with the same pair.
- The `AnimatePresence` child is `SingleImage`, a plain component. It contains the overlay and the nested
  `motion` nodes, not a `motion` element.
- In Svelte that shape is the owned syntax (`present` + `child` snippet). The clone syntax needs a `motion.*`
  direct child, so the port uses the owned syntax. Note the deviation in the page header.
- On the owned path every nested node stays mounted and registers its own participant (P2). Each therefore
  relegates and holds like the outer one, as upstream, where each nested `MeasureLayout` has its own
  `usePresence`.
- The correction the cypress spec checks comes from motion-dom: the follower's border radius
  (`"8.33333% / 12.5%"`) and its child's (`50%`) while the parent is scaled. motion-dom 14.7.1 installs the
  default scale correctors (`correctBorderRadius`, `correctBoxShadow`) itself in `createProjectionNode`
  (`node_modules/motion-dom/dist/es/projection/node/create-projection-node.mjs:86-95`).
- svelte-motion needs only two things for it to apply:
  - `borderRadius` in the `style` prop reaches `latestValues`. `updateOptions` binds `style` motion values,
    see its comment;
  - the child's projection parent is the `li`'s node.
- **Expected size: no new mechanism.** If Step 1 shows the radius or child-scale assertions failing for a
  reason other than the missing hold or relegate, measure it in Step 4.
  - One fix in the in-scope files (e.g. a missing style binding) is in scope.
  - More than one new mechanism is a STOP: report the size, and don't drop the case.

### Nested `motion` descendants on the clone path (operator ruling: build it)

Upstream keeps every nested node of an exiting child: each nested `MeasureLayout` has its own `usePresence`.
012 re-homes them too, in four parts:

1. **Teardown order (P6).**
   - Today the presence teardown is an `onDestroy` (anchor `context.unregisterChild(presenceKey)`). That is a
     user effect created at the component's `pop()`, after the template, so it runs **after** the descendants
     have torn down.
   - Replace it with a script-level
     `$effect.pre(() => () => untrack(() => { …propagated check…; context.unregisterChild(presenceKey) }))`,
     declared where the `onDestroy` is now. Keep the `propagated` check exactly.
   - `user_pre_effect` is a render effect created during the script (`effects.js:243-251`), before the
     template. Children are destroyed first to last (`destroy_effect_children`, 464-488), so its teardown runs
     before the descendants' teardowns, and before this component's own projection `$effect` cleanup.
2. **Pair the subtrees.** In the hand-off, walk the detached element's subtree and the clone side by side.
   `cloneNode(true)` keeps the structure, after the strip in part 4 is applied to both walks.
   - **Every** original descendant with a VisualElement in `visualElementStore` is re-homed onto its paired
     clone element (operator ruling: adopt upstream, where every nested node stays mounted with its element).
     Its adapter is found through a new static lookup (`MotionDomProjectionAdapter.adapters.get(ve.projection)`).
     A descendant with no adapter (no projection) has only its VisualElement re-pointed
     (`current`, `visualElementStore`).
   - **Which descendants hold.** A descendant holds only when it measures layout (`layout || layoutId`, or
     `drag`) **and** belongs to the same presence scope as the exiting child, i.e. no
     `.animate-presence-container` lies between them. These relegate and hold exactly like the child.
   - **Below a nested `AnimatePresence` boundary,** stop the relegate-and-hold, as upstream. A nested
     `AnimatePresence` gives its children their own `PresenceContext`, and its `PresenceChild`'s `isPresent`
     doesn't change when an ancestor exits (`AnimatePresence/index.tsx:213-217`, `propagate && !isParentPresent`
     is the only exception). Descendants below such a boundary are re-homed with `isPresent` unchanged and no
     hold, and are unmounted when the outer hold releases.
   - **The `propagate` exception.** When the nested boundary is a `propagate` boundary, its children are
     exiting with the parent (`index.tsx:213-215`). They are treated as in-scope: `isPresent = false`, relegate,
     hold.
   - Descendants that don't measure layout get no hold. They are re-homed (so their VisualElement keeps
     rendering the clone, as upstream keeps rendering the element) and unmounted when the outer hold releases.
   - The clone is removed once **every** hold in the subtree and the exit have settled. Holding descendants are
     released by their own signals, as upstream (every nested `MeasureLayout` must call `safeToRemove` before
     `PresenceChild` completes, `PresenceChild.tsx:67-75`).
3. **Later teardowns defer by themselves.** When the descendants' own teardowns run afterwards, two existing
   guards make them no-ops for now: the VisualElement effect's `if (visualElement.current === mounted)` (now the
   clone), and the adapter's deferred-unmount branch.
4. **Strip nested artifacts, from every clone (N3).** Since P6, nested boundaries are still present when
   `cloneNode(true)` runs, so **every** clone, held or not, copies their in-flight `[data-clone]` and
   `[data-presence-placeholder]` nodes. Remove those copies from every clone right after `cloneNode(true)`, and
   skip them in both walks. They belong to nested `AnimatePresence` boundaries that tear down with the subtree.
   GUARD 10k covers a non-layout child.

Step 3c probes this, with a STOP. **Fallback, which needs approval:** re-home only the direct child (as 3a)
and record that nested crossfades on the direct-child path need the owned syntax.

### Why this design (and not the spike's alternatives)

- **Upstream fidelity.** Both paths now run upstream's `MeasureLayout` presence code against motion-dom's own
  `NodeStack`, `relegate`, `promote` and crossfade. svelte-motion adds no crossfade math.
- **Re-homing beats a fresh stand-in node (spike option B1).** The stack's order is what `relegate` walks
  (stack.ts 34-43). `resumingFrom`/`prevLead` links, `latestValues`/`animationValues` (an interrupted layout
  animation continues), `options` (transition, `crossfade`, `layoutDependency`) and the node's parent all
  survive unchanged. A stand-in would have to copy each of these and splice itself into `members` at the
  departing node's index, and the departing node's `unmount()` would `stack.remove()` it and promote
  mid-handoff (stack.ts 25-32).
- **Ordering works in Svelte** (confirmed by the cold review; Step 1's 11a guards it).
  - After P6, the presence teardown is a script-level `$effect.pre` created before the template and before the
    projection `$effect` (anchor `motionDomProjection.unmount()`). Svelte destroys child effects in creation
    order (`node_modules/svelte/src/internal/client/reactivity/effects.js:464-488`, after DOM removal at
    514-521). So `unregisterChild` runs while this node **and its descendants' nodes** are still mounted,
    before any adapter `unmount()`.
  - **`BranchManager.ensure` caveat** (`node_modules/svelte/src/internal/client/dom/blocks/branches.js:186-240`,
    `#commit` 131-160). When one block swaps branches (`{#key}`, `{#if}…{:else}`), the new branch is created
    **before** `#commit` destroys the old one. So the arriving element's script, DOM and `$effect.pre`s run
    before the departing teardown; only its projection mount (a user `$effect`) runs after.
  - That is still the order the design needs. The arriving node registers with the stack after the hand-off,
    finds the re-homed node as a connected member with a snapshot, `NodeStack.add` (stack.ts 9-23) keeps it, and
    `promote` gives the arriving node `resumeFrom` = the re-homed node and its snapshot.
  - With Svelte's async batching (`should_defer_append()`, `operations.js:227-233`, only under
    `experimental.async`) the commit is deferred to the batch's `oncommit`. That could put the departing
    teardown after the arriving mount. This repo's `svelte.config.js` doesn't enable it. See Maintenance
    notes.
- **006's takeover rule is reached as upstream intended.** `liveResumeFrom()` and `switchLayoutId`'s takeover
  both skip a lead with `isPresent === false` (`MeasureLayout.tsx:98`, commit `fd97ac411` "Animate from an
  exiting lead"). Nothing set `isPresent` before this plan.
- **Out-of-flow svelte-motion registry.** `mountedFromSharedSnapshot` (006/007) already makes the arriving node
  only drop the `layoutId` registry entry when motion-dom resumes from a snapshot. So the registry handoff and
  the motion-dom crossfade never both animate one change (GUARD in Step 1).

### Fallbacks (only if Step 3 refutes an assumption)

STOP and report in either case. Each fallback needs the operator's approval.

- **Re-homing refuted for `layoutId` clones.** Spike option B1:
  - mount a fresh `HTMLVisualElement` and `HTMLProjectionNode` on the clone;
  - copy the departing node's `latestValues`, snapshot, `options` and parent;
  - splice it into the stack at the departing node's index with `isPresent = false`;
  - unmount the departing node without `stack.remove` side effects;
  - then run the same relegate/hold sequence.

  The owned path (Step 4) is independent of this and can still ship.
- **Re-homing works for `layoutId` clones but a `layout`-only clone needs something structurally different.**
  For example, the clamp move is only visible to a read that runs before 008's correction, or the extra update
  pass breaks sibling animations. In that case, re-home only `layoutId` clones and **keep part C**, gated to
  clones without a hold (`clone.matches('[data-layout], [data-layout-id]') && !activeExit.layoutHold`).

### Hand-offs with neighbouring plans

- **015a part C** (`presence.ts`, `unregisterChild`, anchor `Plan 015a, part C`; and `presence.spec.ts` cases
  6a–6c). 012 **deletes** part C, following 015a's maintenance note ("If 012's build gives clones a projection
  node, delete part C"). This hand-off covers:
  - **015a's unit cases.** 6a asserts part C's mechanism (`animate` called with `y: [-70, 0]` before any rAF).
    It is replaced by 10e, which asserts the same move through the re-homed node's projection. 6b (no follow
    for a non-layout clone) and 6c (no follow without a scroll change) stay as GUARDs, re-pointed at the
    projection: no layout animation.
  - **015a's e2e cases stay GUARDs and must stay green unchanged:**
    - 008's two clone `&scroller` clamp cases in `e2e/animate-presence/pop-layout-container-move.spec.ts`;
    - the clone cases of `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`.

  015a's `ActiveExit.base` handling for `x`/`y` goes too. `readAnimatedValues` and the completion wiring stay.
- **015b** (clone marker and D refresh in `unregisterChild`; `registerChild`'s `layoutGroup` argument; R5 owned
  marker effect after the `layoutGroupContext` declaration). 012 appends one argument to the `registerChild`
  call after 015b's, and routes held clones through the same completion tail, so 015b's marker and D refresh
  apply to them unchanged. 012 does not edit `layout.ts`.

  015b's maintenance line "Clone exits without `exit` are removed immediately, so they read as plain removals"
  no longer holds for `layout`/`layoutId` children.
  - Before: a held child's DOM batch was a plain removal.
  - After: the clone appears (an exit start, an ordinary trigger), and once it is released the clone and
    placeholder are removed, which 015b classifies as **exit-complete**. Siblings inside the boundary or its
    `LayoutGroup` animate, and others snap. That is upstream's render model (015b's B(c)).
  - Spec failures that are exactly this are expected parity changes (Step 5). Anything else is a STOP.
  - Note it in the report.
- **015c** (R2, the pre-update effect with anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`, and
  `seedOwnSnapshotFromCache`). 012 does **not** edit R2. Its presence effects are a new pair declared **after**
  006's `layoutId` switch pair. `projection.willUpdate()` returns early once a node is layout-dirty
  (`create-projection-node.ts:737`), so when R2 has already snapshotted a `layout` element on its presence flip
  (015c's cached snapshot, once it lands), 012's `willUpdate()` is a no-op and R2's snapshot wins. 015c must
  keep R2 declared before 012's pair.
  - **015c's drift check and dependencies change because of 012.** 012 edits `_MotionContainer.svelte` and
    `presence.ts` after 015b, so 015c's `git diff <015b merge>..HEAD` would STOP. This plan's edit of
    `015c-exiting-element-own-snapshot.md` re-baselines that check to 012's merge SHA, adds 012 to its "Depends
    on", and points its `seedOwnSnapshotFromCache` at the existing `seedOwnOnScreenSnapshot` (which 012's
    `layout`-only hand-off also reuses).

## Current state

### Upstream (`~/Github/motion`, cite as `git show v14.7.1:<path>`)

framer-motion paths are under `packages/framer-motion/src/`; motion-dom paths under `packages/motion-dom/src/`.

- `motion/features/layout/MeasureLayout.tsx`:
  - `switchLayoutId` takeover, 98: `resumeFrom?.isPresent !== false && …` (an exiting lead is animated from).
  - `componentDidMount` 116-147: `layoutGroup.group?.add`, `hasTakenAnySnapshot && root.didUpdate()` (125-127),
    then `addEventListener("animationComplete", () => this.safeToRemove())` (136-138) and
    `setOptions({ …, onExitComplete: () => this.safeToRemove() })` (139-143).
  - `getSnapshotBeforeUpdate` 149-204: `projection.isPresent = isPresent` (163); `willUpdate()` when
    `drag || layoutDependency changed || layoutDependency === undefined || prevProps.isPresent !== isPresent`,
    else `safeToRemove()` (177-186); on a flip, `isPresent ? projection.promote() : !projection.relegate() &&
    frame.postRender(() => projection.getStack()?.members.length || this.safeToRemove())` (188-201).
  - `componentDidUpdate` 206-218: `takeOver?.()`, `root.didUpdate()`, then
    `microtask.postRender(() => { if (!projection.currentAnimation && projection.isLead()) this.safeToRemove() })`.
  - `componentWillUnmount` 220-235; `safeToRemove` 237-239; `MeasureLayout` uses `usePresence()` (246-260).
- `components/AnimatePresence/use-presence.ts:40-65`: `register(id)` in an effect (52-57); `safeToRemove` =
  `onExitComplete(id)` (59-62); returns `[false, safeToRemove]` only while not present (64).
- `components/AnimatePresence/PresenceChild.tsx:60-113`: per-id completion map; `onExitComplete` fires only
  when every registered id is complete (67-75); `register` (76-87); immediate completion when nobody registered
  (108-113).
- `components/AnimatePresence/index.tsx`: exiting children stay rendered until all exits complete (155-179);
  `onExit` (219-249) runs `forceRender`, then re-diffs.
- `motion/features/animation/exit.ts:58-82`: the exit feature registers too (80-82) and completes as soon as
  `setActive("exit", true)` resolves. With no `exit` prop that is immediate, so `MeasureLayout`'s registration
  is what holds a `layoutId` element.
- `projection/shared/stack.ts`: `add` 9-23 (prunes disconnected members that have no snapshot), `remove`
  25-32, `relegate` 34-43 (promotes the nearest **earlier** member that is present and connected), `promote`
  45-74 (sets `resumeFrom`, copies the snapshot, marks the node layout-dirty if the root is updating),
  `exitAnimationComplete` 76-81 (every member's `onExitComplete`, and its `resumingFrom`'s).
- `projection/node/create-projection-node.ts`: `willUpdate` 708-791 (idempotent once dirty at 737); `unmount`
  668-678; layout-animation options with `onLayoutAnimationStart` / `onLayoutAnimationComplete` read from
  `visualElement.getProps()` (586-589) and passed as `onPlay` / `onComplete` (626-628); non-animating lead calls
  `onExitComplete` (660); `startAnimation` 1806-1854 (shares `currentAnimation` with `resumingFrom`, 1848-1850);
  `completeAnimation` 1856-1868 (`stack.exitAnimationComplete()`, then `"animationComplete"`);
  `registerSharedNode` 1938-1953; `isLead` 1955-1958; `promote` 1975-1991; `relegate` 1993-1995; follower opacity
  in `applyProjectionStyles` ~2124-2150 (`opacityExit`, `preserveOpacity`); `notifyLayoutUpdate`'s lead-only
  `onExitComplete` 2373-2375; `setOptions` merges 1237-1245.
- `animation/animate/subject.ts:144-159`: `animate(element)` drives the element's VisualElement when
  `visualElementStore` has one.
- Specs ported here: `tests/react/issue-1935.spec.ts` (the six crossfades, already ported by 007);
  `tests/react/issue-1411-open-change.spec.ts` (closing, ported by 006);
  `packages/framer-motion/cypress/integration/layout-shared.ts:65-86` with fixture
  `dev/react/src/tests/layout-shared-animate-presence.tsx` ("removed element isn't removed until animation is
  complete"); `packages/framer-motion/cypress/integration/animate-presence-exit-complete-multiple.ts` with
  fixture `dev/react/src/tests/animate-presence-exit-complete-multiple.tsx` (#3233; it uses
  `onLayoutAnimationComplete`, line 66); `packages/framer-motion/cypress/integration/layout-shared-lightbox-crossfade.ts`
  (`runScriptCrossfade`, run with `&instant=true` and with the default `{ duration: 0.01 }`) with fixture
  `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx`:
  - three gallery `motion.li` items (`layoutId={color}`, `borderRadius: 0`), each holding a
    `layoutId={child-${color}}` `motion.div` (`borderRadius: 25`, `opacity: 0.5`);
  - a `SingleImage` (an overlay, plus `#parent` with `borderRadius: 50` and its `#child`) inside
    `<AnimatePresence>` keyed by colour.
  - Checks after open (+50 ms): `#item-parent` is `opacity 0`, has radius `"8.33333% / 12.5%"` and keeps its
    box; `#item-child` has radius `50%`; `#parent` and `#child` sit at their own boxes.
  - Checks after the overlay click: `#item-parent` is back to `opacity 1`, radius `0px`, its own box;
    `#item-child` has radius `25px`, `opacity 0.5`.
- motion-dom's default scale correctors (`correctBorderRadius`, `correctBoxShadow`) are installed by
  `createProjectionNode` itself (`packages/motion-dom/src/projection/node/create-projection-node.ts`, the
  `Object.assign(scaleCorrectors, { ...defaultScaleCorrectors, ...scaleCorrectors })` at the top of the
  function; built at `node_modules/motion-dom/dist/es/projection/node/create-projection-node.mjs:86-95`).

### svelte-motion (anchors; line numbers at `b21e938a`)

- **`src/lib/html/_MotionContainer.svelte`**:
  - `presenceChildContext` / `inPresenceChild` (305-306). `buildPresenceContext` (380-394). Its JSDoc (366-379)
    says "the clone is detached and has no VisualElement": update it in Step 5.
  - `shouldRegisterPresenceExit` (731-736). The presence `onDestroy`, which calls
    `context.unregisterChild(presenceKey)` (758-765). The `context.registerChild(` call (~884, plus 015b's
    `layoutGroup` argument).
  - The projection mount `$effect` (anchor `motionDomProjection.mount(mountTarget, {`, ~1975-2011). Its cleanup
    calls `motionDomProjection.unmount()`. The VisualElement `$effect`'s cleanup
    `if (visualElement.current === mounted) visualElement.unmount()` (~2071): after re-homing, `current` is the
    clone, so this skips, and the deferred release must unmount.
  - `measureLayoutMounted` (2161-2163) is upstream's "MeasureLayout is rendered" condition.
  - `trackLayoutProjectionDependencies` reads `presenceChildContext?.isPresent` (~2253-2259). R2, the pre-update
    effect (~2265-2290, anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`), is 015c's. Don't
    edit it.
  - 006's `layoutId` switch pair (~2528-2580): `$effect.pre` (anchor `pendingLayoutIdTakeOver = adapter.switchLayoutId(next)`)
    and `$effect` (anchor `measuredBeforeLayoutIdChange = measured`). That is the pattern for the presence pair,
    which goes right after it, before `// Cancel a pending reactive commit when the component tears down.`
  - `buildMotionNodeProps` (562) builds the VisualElement props. motion-dom reads `onLayoutAnimationStart` /
    `onLayoutAnimationComplete` from them.
- **`src/lib/utils/motionDomProjection.ts`**:
  - `MotionDomProjectionAdapter`, `private static adapters` (~331), `mount` (~598-665), `unmount` (~677-718),
    `willUpdate` (~729-737), `didMount` (~756-767), `seedDepartingLeadSnapshot` (private, ~801-840; it returns
    early when `element.isConnected` or a snapshot exists), `liveResumeFrom` (~883-891:
    `if (lead.isPresent === false) return null`), `switchLayoutId` (~471-560), `didUpdate`.
  - `grep -rn "relegate\|\.promote(\|projection.isPresent" src/lib --include=*.ts --include=*.svelte | grep -v spec`
    prints nothing today.
- **`src/lib/utils/presence.ts`**:
  - `startExit` (~1437-1445, takes a `holdLayoutIdHandoffs()` hold), `finishExit` (~1466-1480).
  - `registerChild` (~1533-1600; 015b adds `layoutGroup`). The `PresenceChild` record type is near 41/964.
  - `unregisterChild` (~1652). The no-exit early return (anchor `no exit animation, removing immediately`,
    ~1683-1690). `containsStatefulCloneContent` (~1692). The clone (anchor `const clone = child.element.cloneNode(true)`;
    the next line removes `id`). The insert (anchor `slotParent.insertBefore(clone,`, from 008/015a).
    `startExitAnimation` and its `!resolvedExit` branch (which removes the clone at once). The completion tail
    in `exitAnimation.finished … .finally`. `takeExitHandoff`. `dispose`.
  - **Part C** (015a; it was uncommitted on `lane/1471-siblings` when this plan was written, so read the merged
    code):
    - `startExitAnimation(follow?)`'s `followAxes` / `getValueTransition(…, 'layout')` merge;
    - the `if (clone.matches('[data-layout], [data-layout-id]'))` block after the comment
      `// Plan 015a, part C:`, which runs `seenScrollBasis`, `foldedInFor`, `microtask.read` and `scrollDelta`,
      then `startExitAnimation({ x: move.x, y: move.y })`.

    012 deletes it (ruling 3). 015a's unit cases for it are `presence.spec.ts` 6a–6c. Its e2e GUARDs are 008's
    clone `&scroller` cases and the clone cases of `pop-layout-scroll-siblings.spec.ts`.
  - As committed on `lane/1471-siblings` (`f8e6c47b`), part C passes the raw scroll move
    (`startExitAnimation({ x: move.x, y: move.y })`). It does **not** divide by `measureScreenScale`: a projection
    node never corrects for a CSS-scaled ancestor without a node, so neither does part C. The re-homed node's
    own projection gives the same units.
- **Registration gate (B1).** `_MotionContainer.svelte:868-870`:
  `$effect(() => { if (element && shouldRegisterPresenceExit && exitProp !== undefined) { const resolvePresenceExit = … ; context.registerChild(…) } })`.
  So no-`exit` children are never registered, and `unregisterChild` logs "child not found" (`presence.ts:1664`).
  A registered child always carries `resolvePresenceExit`, so a no-`exit` one reaches the rAF's `!resolvedExit`
  branch (`presence.ts:1963`), which removes the clone.
- **Clone placement and paint order** (`presence.ts` at `b21e938a`):
  - the clone's rect is the element's transformed `getBoundingClientRect()` (1704-1706);
  - the frozen-style copy skips transforms and keeps everything else (1785-1800);
  - placement is absolute in the slot (1871-1875);
  - the z-index lift is at 1897-1913.
- **Svelte teardown order** (`node_modules/svelte/src/internal/client/reactivity/effects.js` @ 5.56.10):
  - `destroy_effect` removes the DOM (514-521), then destroys children first to last (`destroy_effect_children`,
    464-488), then runs its own teardown.
  - A component's template, including its child components, is created before its user effects, which are
    queued until `pop()`; `onDestroy` is one of them.
  - So nested `motion` descendants are torn down before an ancestor's `onDestroy`.
  - `$effect.pre` is `user_pre_effect` (`effects.js:243-251`): a `RENDER_EFFECT` created immediately during the
    script, i.e. before the template, so its teardown runs before the descendants'. P6 relies on this (see
    "Nested `motion` descendants on the clone path").
  - `BranchManager.ensure` (`dom/blocks/branches.js:186-240`) creates the new branch before `#commit` (131-160)
    destroys the old one; with `should_defer_append()` (async mode only) the commit waits for the batch.
- **`src/lib/components/PresenceChild.svelte`** holds while any participant registered through
  `exitRegistry.register` is incomplete (`presenceExitRegistry.ts:26-34, 49-65, 78-92`). No change needed.
- **`src/lib/types.ts`**: layout props block with `onLayoutMeasure` (~765-771). `grep -rn "onLayoutAnimation" src/lib`
  prints nothing. motion-dom types them (`node_modules/motion-dom/dist/index.d.ts:361-362, 925-931`).
  `docs/src/routes/docs/animate-layout/+page.svx:171` already claims `onLayoutAnimationComplete` exists.
- **The seven fixmes**:
  - `e2e/layout/layout-root.spec.ts`, each preceded by the comment `// Plan 012: no relegate on the exit clone.`:
    - `Crossfading shared layout animation inside a layoutRoot animates relative to it` (107);
    - `Crossfading from a translated box outside a layoutRoot keeps the old underline on the new one` (227);
    - `Crossfading from a translated box inside a layoutRoot keeps the old underline on the new one` (275);
    - `Crossfading inside a scrolled layoutScroll box in a layoutRoot animates relative to it` (316);
    - `Crossfading translated underlines inside a layoutRoot keeps their translate` (338);
    - `Crossfading inside a scaled ancestor of a layoutRoot animates relative to it` (358).
  - `e2e/layout-id/open-change.spec.ts:94`, `closing then shrinks the card into thumbnail two`, with its comment
    at 91-93.
  - Their pages: `src/routes/tests/layout-root/+page.svelte` (`?exit=true` gives the underline
    `exit={{ opacity: 0 }}`; TesterPanel status at ~354 says "The exit=true crossfades wait for plan 012"; the
    tester `judge` at ~175) and `src/routes/tests/layout-id/open-change/+page.svelte` (no TesterPanel; the card
    has no `exit`).
- **Conventions**:
  - Painted-frame recording: `e2e/independent-transforms/speed-change.spec.ts:215-260` (CDP `Page.startScreencast`,
    frames sorted by `metadata.timestamp`), and 015a's `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`
    (`record()` with screencast plus per-rAF `elementFromPoint` hit tests where the screencast drops frames).
  - Tester pages: `src/routes/tests/layout/_parity/TesterPanel.svelte` (it renders nothing under
    `?@isPlaywright=true`), used by `src/routes/tests/layout-root/+page.svelte`. Steps, expected result and a live
    verdict.
  - Component harnesses: `src/lib/components/__tests__/AnimatePresenceOwnedChildHarness.svelte`,
    `OwnedPresenceGroupHarness.svelte`. Unit rect mocking: `motionDomProjection.spec.ts` (existing
    `getBoundingClientRect` stubs).
  - Commits: conventional, e.g. `fix(layout): hand a departing layoutId lead's snapshot to motion-dom (#1935 A1)`.
    Use `(plan 012)` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Google-style JSDoc on every new public function, type and prop, with `@param`, `@returns` and `@example`,
    and upstream `file:line @ v14.7.1` citations in comments, as in `switchLayoutId`'s JSDoc.

## Commands you will need

Run everything in `/Users/jasonkummerl/Github/svelte-motion-1471-layoutid`.

| Purpose | Command | Expected |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Unit | `pnpm exec vitest run <paths>` / `pnpm test:only` | as each step says / all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4216 pnpm exec playwright test <paths>` | as each step says |
| Build | `pnpm build` (runs `package`, `publint`) | exit 0 |
| Docs | `pnpm --dir docs check` then `pnpm --dir docs build` | exit 0; restore `docs/static/r/animated-tabs.json` if the build rewrote it (`git checkout -- docs/static/r/animated-tabs.json`) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

The **guard set** (used in Steps 1 and 7):
`PW_PORT=4216 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/utilities/use-presence.spec.ts e2e/utilities/use-presence-data.spec.ts e2e/reorder e2e/drag e2e/animate-layout e2e/projection`

## Scope

**In scope** (only these):

- `src/lib/utils/motionDomProjection.ts`: new public `setPresence`, `commitPresence`, `handOffToExitClone`,
  `cancelExitHandOff` (or a `cancel` on the returned hold), the private safe-to-remove wiring installed in
  `mount`, the per-cycle release latch, an `isHandedOff` getter, the deferred-unmount branch at the top of
  `unmount()`, and a static lookup from a VisualElement's projection to its adapter (for the nested walk). It reuses the existing
  `seedDepartingLeadSnapshot` and `seedOwnOnScreenSnapshot` unchanged, with no new seed method. Export a
  `ExitLayoutHold` type. Don't change `switchLayoutId` or 015a/015b/015c members.
  `motionDomProjection.spec.ts`: new `describe`s only.
- `src/lib/html/_MotionContainer.svelte`, these regions only:
  - P1: the new presence `$effect.pre` / `$effect` pair right after 006's switch pair;
  - P2: the participant registration (new `$effect` next to P1);
  - P3: the `registerChild(` call: append `layoutHandOff` (`canHandOff`, `layoutRect`, `handOff`) as the
    **last** parameter, located by name, after 015b's `layoutGroup`. Plus the every-mode offset-snapshot
    record (`lastOffsetSnapshot`), written from the adapter's existing commit/measure listeners;
  - P5: that registration `$effect`'s gate (anchor `exitProp !== undefined`), widened to
    `exitProp !== undefined || measureLayoutMounted`;
  - P6: the presence teardown. Replace the `onDestroy` (anchor `context.unregisterChild(presenceKey)`) with a
    script-level `$effect.pre` teardown in the same place, keeping the `propagated` check;
  - P4: destructure and forward `onLayoutAnimationStart` / `onLayoutAnimationComplete` (props destructuring and
    `buildMotionNodeProps`);
  - the `buildPresenceContext` JSDoc.
- `src/lib/utils/presence.ts`:
  - the `registerChild` hand-off parameter and record field;
  - in `unregisterChild`:
    - the `canHandOff()` decision before any clone work;
    - the no-exit branch for held children, and the synchronous exit resolve;
    - the `!resolvedExit` branch settling the exit flag for held children;
    - held-clone placement from `layoutRect()`, with no z-index lift and no forced `position: relative`;
    - no clone without a connected slot parent (instead of falling back to `doc.body`);
    - the nested artifact strip, for every clone, and the paired subtree walk with the boundary and
      `propagate` rules;
    - the hand-off call after the insert;
    - the hold/exit join before the completion tail;
    - `id` kept on held clones;
  - **deleting 015a's part C** (its block, `startExitAnimation`'s `follow` parameter and merge, and imports only
    it used);
  - `takeExitHandoff` (read values, then cancel) and `dispose` (cancel holds).
  `presence.spec.ts`: new cases, plus replacing 015a's 6a and re-pointing 6b/6c (see "Hand-offs").
- `src/lib/types.ts`: `onLayoutAnimationStart?` / `onLayoutAnimationComplete?` in the layout props block, with
  JSDoc.
- Tests and harnesses (create): `src/lib/components/__tests__/PresenceSharedLayoutHarness.svelte`,
  `src/lib/components/presenceSharedLayout.spec.ts`, `e2e/_helpers/paintedFrames.ts`.
- E2E: `e2e/layout/layout-root.spec.ts` (un-fixme 6, owned twins), `e2e/layout-id/open-change.spec.ts`
  (un-fixme 1, owned twin), new `e2e/layout-id/presence-crossfade.spec.ts`,
  `e2e/layout-id/exit-complete-once.spec.ts`, `e2e/layout-id/lightbox-crossfade.spec.ts`,
  `e2e/layout-id/nested-crossfade.spec.ts`.
- Pages: `src/routes/tests/layout-root/+page.svelte` (`?owned=true`, verdict reads the lead underline, status
  text), `src/routes/tests/layout-id/open-change/+page.svelte` (`?owned=true`, add a TesterPanel), new
  `src/routes/tests/layout-id/presence-crossfade/+page.svelte`,
  `src/routes/tests/layout-id/exit-complete-once/+page.svelte`,
  `src/routes/tests/layout-id/lightbox-crossfade/+page.svelte` and
  `src/routes/tests/layout-id/nested-crossfade/+page.svelte`, each with a TesterPanel.
  `src/routes/+page.svelte`: four links, next to the other `tests/layout-id` links.
- Only if Step 4 finds the lightbox's radius/scale correction needs exactly one fix: that fix, in the in-scope
  files above (container `style` binding or adapter). More than one new mechanism is a STOP.
- Docs:
  - `docs/src/routes/docs/animate-presence/+page.svx` (a "Shared layout" section: held removal, crossfade,
    both syntaxes);
  - `docs/src/routes/docs/layout-animations/+page.svx` (the `layoutId` + `AnimatePresence` crossfade, and the
    two new props);
  - one example: `docs/src/lib/examples/presence-crossfade/` (demo component) and
    `docs/src/routes/examples/presence-crossfade/+page.svelte` (+ `+page.ts`, copied from
    `docs/src/routes/examples/shared-layout-animation/`), registered in `docs/src/lib/examplesIndex.ts`. Keep
    every other plan's entries.
- `.changeset/presence-shared-layout.md` (create).

**Out of scope** (do NOT touch):

- `src/lib/components/PresenceChild.svelte`, `AnimatePresence.svelte`, `presenceExitRegistry.ts`. Their
  existing contract already supports a measure participant.
- `src/lib/utils/layout.ts` (015b/015c), `src/lib/utils/scrollBasis.ts` (015a), R2 (015c), 015a's R1/R3/R4 and
  015b's R5/R7 container regions.
- `src/lib/utils/layoutId.ts`. The registry contract stays. Only its consumption is checked by a GUARD.
- Changing the public `AnimatePresence` API, Svelte `out:` transitions (refuted by
  `.agents/.plans/clone-exit-migration/spike-report.md` §2-§4), `package.json` (no version change), PR labels,
  and the batch README.

## Git workflow

- Lane branch `lane/1471-layoutid` in `/Users/jasonkummerl/Github/svelte-motion-1471-layoutid`. Don't use
  `isolation: 'worktree'`. Don't push or open a PR.
- One commit per step, conventional messages ending with the `Co-Authored-By` line above. Record the Step 1 SHA
  (`RED_SHA`) in your report.

## Steps

### Step 1: Red tests and guards (no changes to library source)

Write all of these, run them on the merged lane, and check each label. **RED** must fail for the stated reason.
**GUARD** must pass now and after the fix. If a label doesn't hold, STOP and report the case, its failure and
your reading of it.

- **What may change.** No library source changes in this step: nothing in `src/lib` outside `*.spec.ts` and
  `src/lib/components/__tests__/`. The new spec and harness under `src/lib/components` (U11) are test files
  and are allowed.
- **Keep `pnpm check` at 0 errors (B2).** The RED unit tests call APIs that don't exist yet:
  - `setPresence`, `commitPresence`, `handOffToExitClone`;
  - the new static adapter lookup;
  - `registerChild`'s `layoutHandOff` / `canHandOff`.

  `tsconfig.json` covers `src/**`, so write those calls through a local typed cast, e.g.
  `type PresenceApi = { setPresence(isPresent: boolean, safeToRemove: () => void): void; … }` and
  `(adapter as unknown as PresenceApi).setPresence(…)`. Then they fail at runtime
  (`TypeError: … is not a function`), the intended RED, and not in typecheck. Remove the casts in the step
  that adds each API.

**E2E, un-fixme (the seven):**

1. Remove `test.fixme` → `test` and the `// Plan 012: …` comments from the six `layout-root.spec.ts` cases.
   **RED** (all six): the exit clone has no projection node, so it fades where Tomato was instead of following
   the new underline. `expect(underlines[0]).toBeCloseTo(underlines[1], 0)` fails (in `expectCrossfade` or
   inline). The "translated box inside" case must fail in `expectCrossfade`, after its slide check passes
   (the slide half is already green as its own A1 test).
2. Remove the `fixme` from `open-change.spec.ts` `closing then shrinks the card into thumbnail two`. **RED**:
   the card has no `exit`, so it is removed at once and thumbnail two reappears at its own size.
   `expect(mid.width).toBeGreaterThan(two.width + 40)` fails.

**E2E, owned twins.** Add `?owned=true` to both pages. With it, each underline (and the outside box's) renders
as `<AnimatePresence present={item === selected}>{#snippet child()}<motion.div class="underline" layoutId="underline" …/>{/snippet}</AnimatePresence>`
instead of `{#if}`. The open-change card renders as `<AnimatePresence present={!!open}>{#snippet child()}…`.

**Owned ports read a latched value (M3; Svelte deviation, documented in each page header).**
- Upstream, a held exiting child keeps the props of its last render, because React re-renders it from the
  stored element. A Svelte snippet reads **live** state instead, so a held child would see the new value:
  - open-change: `layoutId={open}` would go `null` and fire `switchLayoutId(undefined)`;
  - lightbox: `color={open}` would go falsy;
  - presence-crossfade: `id="shape-{count}"` would rename the held shape.
- So every owned port reads a value latched while it is present:
  - for example, `let shown = $state(open)`, plus `$effect.pre(() => { if (open) shown = open })`;
  - the snippet reads `shown`;
  - for presence-crossfade, each boundary latches the `count` it was shown with.

For each case in 1 and 2, add a twin with `&owned=true` and the name suffixed ` (owned)`:

3. Six layout-root owned twins. **RED or GUARD: record what you see. A pass is not a STOP.**
   - 006's mount takeover (`takeOverLiveLeadOnMount`, `motionDomProjection.ts:910-951`) **animates from** the
     still-mounted old lead; it doesn't hide it. So the slide may already pass on the owned path.
   - Whether the crossfade assertions pass depends on whether the old underline is held and follows (its exit
     feature completes at once today).
   - Record pass/fail per case and per assertion.
4. Open-change closing (owned). **RED** (expected): nothing relegates the card, and the card isn't held (its exit
   feature completes at once).

**E2E, new ports:**

5. `src/routes/tests/layout-id/presence-crossfade/+page.svelte`, a port of
   `dev/react/src/tests/layout-shared-animate-presence.tsx`. Keep upstream's styles, the 10 s transition with
   `ease: () => 0.25`, the `animate` array, `initial={false}`, ids `shape-${count}`, and click-to-cycle.
   - The clone syntax is `<AnimatePresence>{#key count}<motion.div key="shape-{count}" id="shape-{count}" …/>{/key}</AnimatePresence>`.
   - `?owned=true` uses two alternating owned boundaries (A present when `count` is even, B when it is odd).
     Each boundary latches the `count` (and so the `id`, styles and `animate` entry) it was shown with (M3).
     Note both deviations in the header.
   - A TesterPanel with steps, expected results and a live verdict (both shapes are mounted, and the old one
     sits on the new one).

   `e2e/layout-id/presence-crossfade.spec.ts`:
   - 5a: the verbatim port of `layout-shared.ts:65-86`: after the click (+50 ms), `#shape-0` still exists with
     `style.opacity === "1"` and `#shape-1` has `style.opacity === "0.433013"`. Clone syntax. **RED**: `#shape-0`
     is removed (no `exit`), and even a held clone drops its `id`.
   - 5b: the same, `(owned)`. **RED** (expected): the exit feature completes at once and `PresenceChild`
     unrenders.
6. **Painted-frame crossfade**, in `e2e/layout-id/presence-crossfade.spec.ts`, using a new
   `e2e/_helpers/paintedFrames.ts`. The helper exports
   `recordPainted(page, action, ms, probes)`:
   - it runs a CDP screencast (`everyNthFrame: 1`, PNG, frames sorted by `metadata.timestamp`, as in
     `speed-change.spec.ts:215-260`);
   - in the page, it runs a rAF loop that records `document.elementFromPoint` hits at the given probe points on
     **every** frame;
   - it returns `{ frames, hits }`.

   Cases 6a (clone) and 6b (owned), on the presence-crossfade page with the `ease: () => 0.25` freeze.

   **Precondition (M2), asserted first in each case:**
   - the held old shape's computed `z-index` equals its pre-exit value (no lift);
   - on every rAF, `elementFromPoint` at the overlap centre hits the **new** shape (`#shape-1`), which paints on
     top, as upstream renders the exiting child first.

   If the precondition fails after the fix, the paint order is wrong. That's a failure, not a calibration
   issue.

   Then judge **every** frame from 100 ms after the click to `ms`:
   - Every screencast frame has exactly **one** connected non-background region inside the fixture. The old
     shape sits on the new one, so the two are never painted apart.
   - In every screencast frame, the region's centre pixel differs from both pure state colours (`#09f` and
     `#90f`, after the frozen 25% colour mix) by at least 20 in some channel, so both layers are painted.
     Calibrate the two reference colours once from frames painted with `?solo=0` and `?solo=1` (a page param
     that renders only one shape). Don't calibrate the threshold.
   - On every rAF, `elementFromPoint` at the new shape's centre hits `#shape-1` (see the precondition), never
     the background.
   - For a frame step across a screencast gap longer than 50 ms, judge the `elementFromPoint` hits instead (015a
     amendment A1). Don't skip it.

   **RED** (both): today the old shape vanishes at once (clone), or is hidden by the takeover (owned), so the
   centre pixel equals the new colour.
7. `src/routes/tests/layout-id/exit-complete-once/+page.svelte`, a port of
   `dev/react/src/tests/animate-presence-exit-complete-multiple.tsx` (#3233). It uses `onLayoutAnimationComplete`,
   which Step 2 adds, so mark its spec `test.fixme('… (plan 012 Step 2)')` in this step and keep the page
   type-clean (comment the prop out with a `TODO(plan 012 Step 2)`). Spec `e2e/layout-id/exit-complete-once.spec.ts`
   ports the cypress case verbatim: `#done-count` is `0` after 2 s, then click `#start-1`, wait 3 s, and it is
   `1`. Clone and `(owned)` variants. Labels are set in Step 2. Add a TesterPanel.
8. `src/routes/tests/layout-id/lightbox-crossfade/+page.svelte`, a port of
   `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx`.
   - Keep the styles, the three colours, the ids, `?instant=true` (`{ type: false }`), and the default
     `{ duration: 0.01 }`.
   - `SingleImage` becomes the owned child: `<AnimatePresence present={open !== false}>{#snippet child()}<SingleImage …/>{/snippet}</AnimatePresence>`.
     The header notes why: upstream's child is a plain component, which only the owned syntax expresses. Drop
     upstream's `key={openColor}`; record that it can't change while open in this fixture.
   - `SingleImage` reads a colour latched while open (M3): `color={shownColor}`, never the live `open`, which
     goes `false` while the lightbox is held.
   - Use `useIsPresent()` for the overlay's `pointerEvents`, as upstream does.
   - Add a TesterPanel.

   `e2e/layout-id/lightbox-crossfade.spec.ts` ports `runScriptCrossfade` verbatim (every `expectBbox`, opacity
   and `borderRadius` assertion), with two tests, `&instant=true` and default. Use Playwright `expect.poll` for
   each cypress `.should` block, within the same 50 ms wait plus Playwright's default poll timeout. Labels:
   - **RED** (expected, both tests), in the close half. Nothing relegates `#parent`, so `#item-parent` isn't
     promoted: it stays hidden (`opacity 0`, where `1` is expected) once `PresenceChild` drops the lightbox,
     or the lightbox is removed before the shared animation.
   - The **open half** is a **GUARD** if it passes today: the arriving lightbox promotes over present gallery
     items, which 006/007 already handle.
   - Record separately whether the radius assertions (`"8.33333% / 12.5%"`, `50%`, `25px`, `0px`) pass in the
     open half. If they fail there, the correction gap exists apart from presence. Step 4 sizes it (see
     "Nested shared-layout children and the lightbox port").
9. **Nested `layoutId` crossfade on the direct-child (clone) path** (operator ruling).
   `src/routes/tests/layout-id/nested-crossfade/+page.svelte`: the lightbox's nested pairs in clone syntax.
   - a gallery of `motion.li layoutId={color}`, each with a `motion.div layoutId="child-{color}"`;
   - `<AnimatePresence>{#if open}<motion.div key="lightbox" id="parent" layoutId={shownColor} …><motion.div id="child" layoutId="child-{shownColor}" …/></motion.div>{/if}</AnimatePresence>`,
     where `shownColor` is the latched colour;
   - a 1 s linear transition, and a TesterPanel;
   - `?inner=boundary` wraps the lightbox's `#child` in a nested `<AnimatePresence>`, and `?inner=propagate`
     uses `<AnimatePresence propagate>` (for N3/N4).

   `e2e/layout-id/nested-crossfade.spec.ts` uses `recordPainted` with probes on `#item-child`'s box:
   - N1 (close): from the overlay click until the end, on every frame:
     - the held `#child` copy (inside the clone) follows `#item-child`, whose rAF-recorded rects grow out of
       the lightbox child;
     - at least 20 frames show both mounted with the clone child's centre within 1 px of `#item-child`'s;
     - `elementFromPoint` at `#item-child`'s centre never hits the background.

     **RED**: the nested node is torn down before the direct child's `onDestroy`, so the clone's inner copy has
     no node and fades in place.
   - N2 **RED**: the outer pair (`#parent` → `#item-parent`) follows and crossfades like case 1. Same reason as
     case 1: the clone has no node.
   - N3 **RED** (nested boundary): the lightbox child sits inside a nested `<AnimatePresence>`. On close, the
     inner `#child` is **not** relegated: `#item-child` doesn't grow out of it. The inner copy stays in the
     clone at its own box, following the outer node's projection, until the outer hold releases. Then both are
     removed together. Today the whole clone fades in place without an outer follow.
   - N4 **RED** (`propagate`): the same with `<AnimatePresence propagate>`. The inner `#child` is relegated and
     crossfades into `#item-child`, like N1.
10. Link the four new pages from `src/routes/+page.svelte`.

**Part C GUARDs (ruling 3).** These are 015a's cases; they must pass now, unchanged, and after part C is
deleted:
- 008's two clone `&scroller` clamp cases in `e2e/animate-presence/pop-layout-container-move.spec.ts`;
- the clone cases of `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`.

Record their measured jump values now, so Step 5 can compare.

**Unit:**

U9. `motionDomProjection.spec.ts`, `describe('presence in shared layout (plan 012)')`, with two adapters sharing a
   `layoutId` and mocked rects:
   - 9a **RED** (`setPresence` missing): B is an earlier present member and A is the lead. `A.setPresence(false)`
     then `A.commitPresence()`: B becomes the lead, `B.projection.resumeFrom === A.projection`, and B has A's
     snapshot.
   - 9b **RED**: A is alone in its stack. `setPresence(false)` then `commitPresence()`: release fires once,
     from the microtask lead check (`MeasureLayout.tsx:212-216`: no `currentAnimation`, and `isLead()`).
     `relegate()` returns `false` here, and the `frame.postRender` empty-stack check finds A itself, so it
     doesn't release.
   - 9c **RED**: B mounts after A's `setPresence(false)` and animates. A's `safeToRemove` callback (a spy
     passed straight to the adapter, with no registry in between) is not called before B's animation
     completes, and is called **exactly once** after it. That holds even though `exitAnimationComplete`
     notifies every member and `animationComplete` fires too: the adapter's per-cycle latch, not registry
     dedup. Then `setPresence(true)`, `setPresence(false)` and another completion call it once more: a new
     cycle re-arms the latch.
   - 9d **RED**: `handOffToExitClone(clone, release)` on a detached A: `A.projection.instance === clone`,
     `A.visualElement.current === clone`, `visualElementStore.get(clone) === A.visualElement`,
     `A.projection.isPresent === false`, and A has a snapshot from cache. A later `A.unmount()` doesn't unmount
     the VisualElement. Release unmounts it exactly once.
   - 9e **RED**: `cancel()` on the hold unmounts at once, and a later release is a no-op.
   - 9f **GUARD**: an adapter never given a presence keeps today's `unmount()`, unchanged.
U10. `presence.spec.ts`, `describe('exit holds (plan 012)')`:
    - 10a **RED**: a child registered with a hand-off that returns a hold, and with no `exit`, gets a clone
      (`[data-clone]` connected) that stays until the hold releases. Then the completion tail runs once:
      `onExitComplete` once, and `startExit`/`finishExit` balanced.
    - 10b **RED**: with an `exit`, the clone is removed only after **both** the exit animation finishes and the
      hold releases, in either order.
    - 10c **RED**: `takeExitHandoff` (re-entry) and `dispose()` cancel the hold.
    - 10d **RED**: a held clone keeps its `id`, has no z-index lift, and its positioning parent isn't forced to
      `position: relative`. It is placed from the hand-off's `layoutRect()`: stub it to return a snapshot whose
      `left` is 30 px less than the element's transformed rect's, and the clone's `left` is that snapshot's.
      This works in `sync` mode, not just `popLayout`.
    - 10d-ii **RED** (B1, N7): a child registered without `exit` whose `canHandOff()` is `true` resolves its exit
      synchronously at hand-off. The rAF's `!resolvedExit` branch settles the exit flag and doesn't remove the
      clone. With `canHandOff()` `false`, no clone is ever inserted (spy on `insertBefore`).

      Component level (in `presenceSharedLayout.spec.ts`): a direct child whose `layoutId` is cleared **in the
      same flush** as its removal is still handed off. Its `canHandOff()` reads the pre-flush
      `measureLayoutMounted`.
    - 10d-iii **RED** (nested): a clone of an element with a nested `motion` descendant (an adapter mounted on
      the inner element) re-homes the descendant onto the paired clone element. Nested `[data-clone]` and
      `[data-presence-placeholder]` copies are stripped, and the clone is removed only after both holds
      release.
    - 10e **RED** (replaces 015a's 6a; delete 6a in Step 5, not here). Use 015a's 6a setup: a `data-layout`
      clone in a scroller tracked at 500, `scrollTop = 430` before draining, the clone mocked 70 px lower.
      1. The clone is handed off to a hold.
      2. The hold's update pass measures the clone **after** 008's correction callback ran (record call order
         with spies).
      3. The node starts one layout animation whose delta is the 70 px move: read `layoutDelta` from the
         projection's `didUpdate` listener (`animationStart` passes no data, `create-projection-node.ts:1807`).
         This needs a real `MotionDomProjectionAdapter` mounted on the element in `presence.spec.ts`, with the
         `registerChild` hand-off wired to it, not a stub hold.
      4. No `animate(clone, …)` call carries `x`/`y` follow keyframes.
    - 10f **GUARD**: a child with no hand-off and no `exit` is still removed at once.
    - 10g-i **GUARD** (015a's 6b, re-pointed in Step 5): a non-layout clone gets no hold and no follow, and its
      exit still starts on the rAF.
    - 10g-ii **RED** (015a's 6c, re-pointed in Step 5): with no scroll change, a held `layout` clone starts no
      layout animation and is released in the microtask after the update. It is RED because no hold exists
      today.
    - 10h **RED**: a `layout`-only child (no `layoutId`) with no `exit` is handed off, and is released and
      removed in the same task's microtasks when nothing moved: the clone is gone before the next rAF.
    - 10i **RED** (N4, double hand-off): after one hand-off, the adapter's `canHandOff()` is `false`. A second
      `unregisterChild` for the same key (the record re-registered with the same element) builds no second
      hold, and `handOffToExitClone` is called once.
    - 10j **RED** (N4, no slot parent): a detached child whose element parent and `insertionParent` are both
      disconnected builds **no** clone. Nothing is inserted into `document.body`, and the child is removed at
      once. Today it falls back to `doc.body`.
    - 10k **GUARD** (N3): a **non-layout** direct child (no hand-off) containing a nested `AnimatePresence`
      with an exit in flight (a `[data-clone]` and a `[data-presence-placeholder]` inside it) gets a clone with
      neither copy. **GUARD** if Step 1 shows today's clone already lacks them (P6 not yet in). Otherwise
      **RED**. Record which.
    - 10l **RED** (nested boundary): a held child with a `layoutId` descendant inside a nested
      `.animate-presence-container` (non-`propagate`) re-homes that descendant with `isPresent` unchanged
      (`!== false`), takes **no** hold for it, never calls its `relegate`, and unmounts it when the outer hold
      releases.
    - 10m **RED** (`propagate`): the same with the nested boundary marked `propagate`. The descendant gets
      `isPresent = false`, relegates and holds.
    - 10n **RED** (non-measuring descendants): a descendant `motion` node with neither `layout` nor `layoutId`
      nor `drag` is re-homed (its `visualElement.current` is the paired clone element and
      `visualElementStore.get(cloneEl)` is its VisualElement), takes no hold, and is unmounted when the outer
      hold releases.
U11. `presenceSharedLayout.spec.ts` with `PresenceSharedLayoutHarness.svelte` (a clone-syntax `{#if}` swap of two
    `layoutId` siblings). Spy on `MotionDomProjectionAdapter.prototype.unmount` and `.mount` and on the
    context's `unregisterChild`:
    - 11a **GUARD** (the design's ordering assumption): for one swap, the departing element's `unregisterChild`
      runs before its adapter's `unmount`, and both run before the arriving adapter's `mount`. Use both an
      `{#if}…{:else}` swap in one block (the `BranchManager.ensure` order) and two separate `{#if}` blocks.
    - 11b **RED** (P6): with a nested `motion` child inside the departing element, `unregisterChild` runs
      **before** the nested adapter's `unmount`. Today the `onDestroy` runs after it.

**Guard suites:** run the guard set. **GUARD**: everything passes except the cases above that are labelled RED,
and 008's remaining `fixme` (015c's same-render case), which reports as skipped.

**Verify**: every label holds (paste a table: case, label, observed failure). Commit
(`test(presence): red tests for exiting layout children in shared layout (plan 012)`) and record `RED_SHA`.

### Step 2: `onLayoutAnimationStart` / `onLayoutAnimationComplete`

1. Add both to the layout props block in `src/lib/types.ts`. Use upstream's meaning: called when this element's
   layout animation starts or completes. Give each Google-style JSDoc with `@example`, citing
   `create-projection-node.ts:586-589, 626-628 @ v14.7.1`.
2. In `_MotionContainer.svelte` (P4), destructure them with the other props and add them to
   `buildMotionNodeProps`, so `visualElement.getProps()` carries them. Don't spread them onto the DOM.
3. Unit test, `motionDomProjection.spec.ts` or the existing container spec, whichever already builds a VE with
   props. **RED** before step 2.2: a `layout` element's layout animation calls both, once each.
4. Restore the prop on the exit-complete-once page and remove its `test.fixme`. Now label it:
   - clone variant **RED** (expected): a no-`exit` child is never registered (B1: the registration `$effect` is
     gated on `exitProp !== undefined`). So `unregisterChild` finds nothing, `finishExit()` never runs,
     `onExitComplete` never fires, and `#done-count` stays `0`;
   - owned variant **GUARD** (expected): `PresenceChild` completes once.

   If the owned variant fails, or the clone variant passes, record what you saw in the report and continue.
   This is not a STOP: the props are independent of the hold.

**Verify**: the 2.3 unit test passes. `pnpm check` gives 0 errors. The exit-complete labels are recorded.
Commit `feat(motion): onLayoutAnimationStart and onLayoutAnimationComplete (plan 012)`.

### Step 3: Probe the clone-path design (time box: about three hours)

Implement only:
- `handOffToExitClone` (Decided design, steps 1-5, including the `layout`-only seed through
  `seedOwnOnScreenSnapshot`), its latch and hold, and the deferred unmount, in `motionDomProjection.ts`;
- P5 (the registration gate) and P6 (the presence teardown as a script-level `$effect.pre`);
- a **minimal** call from `unregisterChild`, without nested descendants until 3c:
  - `canHandOff()` first, then the synchronous exit resolve;
  - held-clone placement from the untransformed box, with no z-index lift;
  - hand off after the insert and keep the clone until release;
  - for the probe only, skip part C for held clones (Step 5 deletes it).

**3a: `layoutId`.** Run:
- 9d, 9e, 10d, 10d-ii, 10i, 10j, 11a, 11b;
- `PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts -g "Crossfading shared layout animation inside a layoutRoot animates relative to it$"`;
- 6a.

Confirmed when all three of these hold:
- 9d, 9e and 11a pass;
- the clone visibly follows the new underline: the layout-root case passes, or fails only on a tolerance,
  not on a static clone;
- 6a's frames show one blended region.

Refuted when any of these holds:
- motion-dom won't project or render a node whose `instance` and `current` were re-pointed. For example, the
  follower's `layout` is never measured, or VisualElement render throws or writes to the detached element.
- `NodeStack.add` drops the re-homed node.
- 11a's ordering doesn't hold in a real flush.

**3b: `layout`-only.** Run 10e and 10h, then the part C GUARDs:
`PW_PORT=4216 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`.

Confirmed when 10e and 10h pass and the clone `&scroller` cases still pass, with part C skipped, within the
Step 1 values.

Needs something structurally different (the second fallback) when the move can't come from the projection
without a new mechanism. For example:
- the clamp is only measurable before 008's correction;
- the hand-off's update pass must be split from the siblings' pass;
- 015b's sibling cases start animating twice.

**3c: nested descendants.** Add the paired subtree walk and the artifact strip. Run 10d-iii, 11b and
`PW_PORT=4216 pnpm exec playwright test e2e/layout-id/nested-crossfade.spec.ts`.
- Confirmed when 10d-iii, 10l, 10m, 10n and 11b pass, N1's nested child follows `#item-child` on every painted
  frame, and N3/N4 hold.
- Refuted when either of these holds:
  - P6's `$effect.pre` teardown doesn't run before the descendants' teardowns in a real flush;
  - the paired walk can't find the descendant's VisualElement (for example, its store entry is gone by then).

  STOP, and report with the **fallback**: re-home only the direct child, and record that nested crossfades on
  the direct-child path need the owned syntax.

**3d: placement (M1).** Add two probe cases to `e2e/layout-id/presence-crossfade.spec.ts`, kept as permanent
GUARDs after Step 5:
- 3d-i: a sync-mode exit of a `layout` child with `exit={{ opacity: 0 }}` and `transition={{ duration: 1 }}`,
  so the clone paints for a second. It interrupts its enter mid-flight: `initial={{ x: -100, scale: 0.5 }}`,
  `animate={{ x: 0, scale: 1 }}` over 1 s, click to remove at ~40%. Next to it is a **control** element with
  the same `initial`/`animate`/`transition`, mounted at the same moment and never removed.
  - The re-homed VisualElement keeps running the interrupted enter, as upstream keeps animating the exiting
    element.
  - Assert, on painted frames: the first frame after the removal is within 1 px of the element's last box
    before the removal (no jump, no double `x` or `scale`).
  - From then until the clone is gone, the clone's box tracks the control's box (offset by their fixed layout
    distance) within 1 px on every frame.
- 3d-ii: a `layout`-only child (no `layoutId`) with an `exit` (`exit={{ opacity: 0 }}`, 1 s), whose `style`
  object has layout keys: `{ position: 'absolute', top: 40, left: 60, width: 120, marginLeft: 10 }`. On every
  painted frame until the clone is gone, the clone's box equals the element's last painted box within 1 px.

The probe is confirmed when both pass. Otherwise fix the placement:
- first within the offset-snapshot rule (`layoutRect()`);
- then the `removeTransform` fallback, recording why;
- if neither is exact, STOP and report the measured offsets.

**Outcomes.**
- On a 3a refutation, STOP and report the evidence and the first fallback. Don't implement B1 without the
  operator.
- On a 3b refutation alone, STOP and report. With approval, the plan continues with re-homing for `layoutId`
  clones only, and keeps part C gated to clones without a hold (second fallback).
- On a 3c refutation, STOP and report. With approval, continue on the nested fallback.
- On a 3d failure that neither the offset snapshot nor the `removeTransform` fallback can fix, STOP and report.
- On confirmation of all four, commit
  `fix(presence): re-home an exiting layout node onto its exit clone (plan 012)` and continue.

### Step 4: Owned path

1. `motionDomProjection.ts`:
   - `setPresence(isPresent, safeToRemove)` is the pre-update half
     (`MeasureLayout.tsx:163, 183, 188-201`): set `projection.isPresent`, call `this.willUpdate()` (which
     returns at once for a dirty node), then `promote()`, or `relegate()` with the `frame.postRender`
     empty-stack release.
   - `commitPresence()` is the post half (206-217): `root.didUpdate()`,
     `visualElement.scheduleRenderMicrotask()`, `refreshCachedLayout()`, then the `microtask.postRender` lead
     check.
   - The safe-to-remove wiring: one `animationComplete` listener and `setOptions({ ...projection.options,
     onExitComplete })` per adapter, installed in `mount`, removed in `unmount`. Every signal goes through the
     adapter's **per-cycle latch** (Decided design, `safeToRemove`), so the callback runs at most once per exit
     cycle. Share the release code with Step 3's hand-off; don't duplicate it.
   - Import `frame` and `microtask` from `motion-dom`, as the adapter already imports from it.
2. `_MotionContainer.svelte`:
   - **P2**: an `$effect` that registers a participant with
     `presenceChildContext.register('measure-' + componentHydrationId)` while `presenceChildContext`,
     `measureLayoutMounted` and a mounted adapter (`motionDomProjection?.isMounted`) all hold, and unregisters
     on cleanup. Untrack the register call. The `measure-` namespace keeps it apart from the exit feature's
     numeric ids.
   - **P1**: a pre/post pair after the switch pair. The `$effect.pre` reads `presenceChildContext?.isPresent`.
     On a change from the last seen value, while the adapter is mounted and `measureLayoutMounted`, it captures
     the cycle's `presenceChildContext.onExitComplete` and calls `adapter.setPresence(isPresent, () => !isPresent && capturedOnExitComplete(id))`.
     The `$effect` then calls `adapter.commitPresence()` for that flip.
   - Ignore the first run: a mount is not a flip, matching `getSnapshotBeforeUpdate`'s `prevProps`.
   - Cite the upstream lines in comments, matching the switch pair's comment style.

3. **Lightbox.** Run `PW_PORT=4216 pnpm exec playwright test e2e/layout-id/lightbox-crossfade.spec.ts`. Every
   nested `motion` node in `SingleImage` registers its own participant (P2), so the close relegates both
   `#parent` → `#item-parent` and `#child` → `#item-child`.
   - If only radius or scale assertions still fail, find the cause.
     - Is `borderRadius` in `latestValues`? Is `#item-child`'s projection parent `#item-parent`'s node? Do
       motion-dom's default correctors run in the render?
     - **One** fix in the in-scope files is part of this step. Cite the upstream behaviour it restores.
   - Needing more than one new mechanism is a STOP: report each mechanism, the files it would touch and an
     estimate. Don't drop or weaken the case.

**Verify**:
- 9a, 9b, 9c and 9f pass.
- Item 4's owned twin, 5b and 6b pass.
- Item 3's owned twins pass (whatever their Step 1 result was).
- Both lightbox tests pass.
`PW_PORT=4216 pnpm exec playwright test e2e/animate-presence/owned-child.spec.ts e2e/animate-presence/owned-pop-layout.spec.ts e2e/utilities/use-presence.spec.ts e2e/animate-presence/modes.spec.ts`
→ all pass. Commit `fix(presence): owned exiting layout children relegate and hold for the crossfade (plan 012)`.

### Step 5: Clone path, complete

In `presence.ts`:

1. The `registerChild` parameter is `layoutHandOff?: { canHandOff(): boolean; layoutRect(): PopLayoutSnapshot | undefined; handOff(clone: HTMLElement, release: () => void): ExitLayoutHold | undefined }`.
   It is the **last** parameter, located by name (after 015b's `layoutGroup`). Store it on the record.
2. In `unregisterChild`:
   - Call `child.layoutHandOff?.canHandOff()` **before any clone work**. When it is `false` and there's no
     `exit`, keep today's immediate removal: no clone is built.
   - For a held child, the no-`exit` early return is skipped. `containsStatefulCloneContent` still removes at
     once (documented deviation).
   - Resolve the exit **synchronously** for a held child (`child.resolveExit?.(getCustom()) ?? child.exit`).
     In `startExitAnimation`, the `!resolvedExit` branch for a held child **settles the exit flag** and does
     not remove the clone.
   - Keep the `id` on held clones. Skip the z-index lift and the forced `position: relative` on the
     positioning parent for them. Place them from `layoutRect()` (the 3d rule).
   - With no connected slot parent, build no clone (N4).
   - Strip nested `[data-clone]` / `[data-presence-placeholder]` copies from **every** clone (N3). Then, for held
     clones, call the hand-off for the child and re-home each paired descendant (the 3c walk, with the boundary
     and `propagate` rules), right after the clone is inserted and 008's correction is scheduled, before the
     exit rAF.
   - Join the exit animation and every hold in the subtree: each settles one flag, and the existing
     completion tail runs once when all are settled. A held child with no exit keyframes calls `startExit()` at hand-off time and
     settles the exit flag at once. Reuse `createPresenceExitRegistry()` for the join if it fits; otherwise
     use a two-flag join. Don't copy the tail.
   - **Delete part C**:
     - the block after `// Plan 015a, part C:`;
     - `startExitAnimation`'s `follow` parameter, its `followAxes` and `getValueTransition(…, 'layout')` merge,
       and the follow axes in `activeExit.base`;
     - every import only these used.

     Then `grep -n "Plan 015a, part C\|followAxes" src/lib/utils/presence.ts` prints nothing. In
     `presence.spec.ts`:
     - delete 015a's 6a (10e replaces it);
     - re-point 6b and 6c as 10g-i and 10g-ii describe.
   - Store the hold on `ActiveExit`.
3. `takeExitHandoff` reads the clone's animated values first, then calls `hold.cancel()` on every hold in the
   subtree, then removes the clone (m9). `dispose` cancels every hold.
4. `_MotionContainer.svelte`:
   - P3 passes
     `{ canHandOff: () => !!motionDomProjection?.isMounted && !motionDomProjection.isHandedOff && measureLayoutMounted, layoutRect: () => lastOffsetSnapshot, handOff: (clone, release) => motionDomProjection?.handOffToExitClone(clone, release) }`,
     so `layout`, `layoutId` and `drag` children are all included, as upstream renders `MeasureLayout` for each.
     `lastOffsetSnapshot` is recorded by the container in every mode (Placement), from its existing
     post-commit reads;
   - P5's gate is in place;
   - P6 is in place (both from Step 3).
5. Update `buildPresenceContext`'s JSDoc: direct children's projection nodes now move to their clone.

**Verify**:
- 10a–10n (including 10d-ii, 10d-iii, 10g-i and 10g-ii), 11a and 11b pass.
- 1, 2, 5a, 6a and N1–N4 pass, and 3d-i and 3d-ii still pass.
- The clone exit-complete-once variant passes.
- The part C GUARDs pass within their Step 1 values.
- `PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts e2e/layout-id e2e/animate-presence`
  → all pass apart from the parity changes listed below.

For each failure outside the cases above, follow CLAUDE.md's failed-e2e review workflow:
- record what the page demonstrates, what the test asserted, and what is now painted.
- It is an **expected parity change** when it is one of:
  - a held `layoutId` exit that upstream also holds (two elements during the shared animation);
  - a `layout` sibling that now snaps on exit completion outside the boundary, per 015b's B(c), because the
    held clone's removal is now classified exit-complete.

  List it for the operator and don't edit the test.
- Anything else is a STOP.

Commit `fix(presence): exit clones keep their projection node and hold until the shared animation lands (plan 012)`.

### Step 6: Pages, docs, example, changeset

1. Layout-root page:
   - the `judge` verdict and `readout` read the **lead** underline (the last in document order), because the
     held clone is now a second `.underline`;
   - the TesterPanel status says the crossfades pass on this build;
   - add steps for `?exit=true` and `&owned=true`.
2. Open-change page: add a TesterPanel (steps "Open one", "Next", "Close"; expected results from the spec's
   comments; a live verdict that, during Close, judges thumbnail two growing out of the card from the
   recorded frames).
3. Docs. Every claim cites the upstream behaviour it mirrors.
   - `animate-presence/+page.svx` gets a "Shared layout" section: an exiting `layoutId` child stays until the
     new lead's animation ends, even with no `exit`, in both syntaxes. It notes that with the `present` +
     `child` syntax a snippet reads live state, so props that change on exit (`layoutId={open}`) must read a
     value latched while present. It shows the latch.
   - `layout-animations/+page.svx` gets the crossfade and the two new props.
4. Example: `docs/src/lib/examples/presence-crossfade/` (a gallery whose card closes back into its thumbnail,
   in the owned syntax) and `docs/src/routes/examples/presence-crossfade/`, registered in `examplesIndex.ts`.
5. `.changeset/presence-shared-layout.md` (`minor`, because it adds two props):

   > `AnimatePresence` children with a `layoutId` now take part in shared layout animations while they exit,
   > as in Motion. The exiting element follows the new one and crossfades out, and it stays mounted until that
   > animation finishes, even without an `exit` prop. Closing a card shrinks it back into the thumbnail it came
   > from. Works with direct children and with the `present` + `child` syntax. Exiting `layout` elements keep
   > animating their layout during the exit, through the same projection as before. Adds
   > `onLayoutAnimationStart` and `onLayoutAnimationComplete`.

**Verify**: `pnpm --dir docs check` passes and `pnpm --dir docs build` succeeds (restore
`docs/static/r/animated-tabs.json`). Under `?@isPlaywright=true`, no TesterPanel renders: the existing specs
still pass. Commit `docs(presence): shared layout with exiting elements (plan 012)`.

### Step 7: Gate

1. `trunk fmt` then `trunk check` on every changed file: no new issues.
2. `pnpm check` gives 0 errors. `pnpm test:only` passes. `pnpm build` exits 0.
3. Run the guard set: all pass, except 008's remaining `fixme` and the operator-listed parity changes. Re-run
   any failure alone once.
4. `git diff --name-only <M>..HEAD` lists only in-scope files.
5. `grep -n "fixme" e2e/layout/layout-root.spec.ts e2e/layout-id/open-change.spec.ts e2e/layout-id/presence-crossfade.spec.ts e2e/layout-id/exit-complete-once.spec.ts e2e/layout-id/lightbox-crossfade.spec.ts e2e/layout-id/nested-crossfade.spec.ts`
   prints nothing, and `grep -rn "Plan 012" e2e src/routes` prints no line that says the behaviour is pending.
6. `grep -n "Plan 015a, part C\|followAxes" src/lib/utils/presence.ts` prints nothing.
7. `grep -rn "PresenceApi\|as unknown as Presence" src/lib --include=*.spec.ts` prints nothing: the Step 1
   casts were removed once their APIs landed.

Report:
- `RED_SHA` and the Step 1 table;
- the Step 3 probe results (3a, 3b, 3c, 3d);
- the exit-complete labels;
- the lightbox radius result and any correction fix;
- the parity-change list;
- every re-run.

## Test plan

- **Red anchors**: the seven un-fixmed cases (1, 2), their owned twins (3, 4), the presence-crossfade port
  (5a/5b), the painted-frame crossfade (6a/6b), the exit-complete-once clone variant (7), the lightbox close
  half (8), the nested crossfades (N1–N4), and unit cases 9a–9e, 10a–10e, 10d-ii, 10d-iii, 10g-ii, 10h–10j, 10l–10n, 11b and
  Step 2.3. Each fails at `RED_SHA` for its stated reason and passes after its step. Item 3's owned twins are
  recorded, not labelled.
- **Guards**: 9f, 10f, 10g-i, 10k (if GUARD at `RED_SHA`), 11a; 3d-i and 3d-ii once added; the exit-complete-once owned variant; the lightbox
  open half (if it passed at
  `RED_SHA`); the part C e2e GUARDs (008's clone `&scroller` cases, `pop-layout-scroll-siblings` clone cases);
  the guard set. The guard set includes the
  non-crossfade #1935 cases. Upstream holds non-`exit` underlines too, so these now see two underlines; they
  read `underlines[0]` or the last underline, and both are correct when the old one follows.
- **Patterns**: `e2e/layout/layout-root.spec.ts` (frame records), `speed-change.spec.ts` and 015a's
  `pop-layout-scroll-siblings.spec.ts` (painted frames), `motionDomProjection.spec.ts` (rect mocks),
  `AnimatePresenceOwnedChildHarness.svelte` (harness).
- **Painted frames** are the authority for the crossfade (6a/6b). No crossfade assertion may rely on sampled
  rects alone.

## Done criteria

- [ ] The seven former `fixme` cases are plain `test`s and pass. No `fixme` remains in the six specs listed in
      Step 7.5.
- [ ] Owned twins (3, 4), 5a/5b, 6a/6b (with the paint-order precondition), both exit-complete-once variants,
      both lightbox tests, the nested crossfades (N1–N4) and the placement GUARDs 3d-i/3d-ii pass.
- [ ] Unit 9a–9f, 10a–10n (with 10d-ii, 10d-iii, 10g-i, 10g-ii), 11a, 11b and Step 2.3 pass. 015a's 6a is
      deleted and 6b/6c are re-pointed. `pnpm test:only` passes, and Step 7.7's cast grep prints nothing.
- [ ] P5 and P6 are in place: `grep -n "exitProp !== undefined || measureLayoutMounted" src/lib/html/_MotionContainer.svelte`
      prints a line, and `context.unregisterChild(presenceKey)` sits inside an `$effect.pre` teardown, not an
      `onDestroy`.
- [ ] Part C is deleted: `grep -n "Plan 015a, part C\|followAxes" src/lib/utils/presence.ts` prints nothing.
      008's clone `&scroller` cases and the `pop-layout-scroll-siblings` clone cases pass, unchanged.
- [ ] `grep -rn "relegate()\|\.promote()\|projection.isPresent =" src/lib/utils/motionDomProjection.ts` shows
      the ported calls, each with an upstream `file:line` comment.
- [ ] `grep -n "onLayoutAnimationComplete" src/lib/types.ts src/lib/html/_MotionContainer.svelte` prints a line
      in each.
- [ ] The guard set passes, apart from 008's `fixme` and the operator-listed parity changes.
- [ ] `pnpm check` gives 0 errors, `pnpm build` exits 0, `pnpm --dir docs check` passes, and `trunk check`
      reports no new issues on changed files.
- [ ] The four new pages and the open-change page have a TesterPanel, and the four new pages are linked from
      `src/routes/+page.svelte`.
- [ ] `.changeset/presence-shared-layout.md` exists. `package.json` `"version"` is unchanged.
- [ ] `git diff --name-only <M>..HEAD` ⊆ the in-scope list.

## STOP conditions

- A lane precondition, the fixme count, or an anchor doesn't match.
- A Step 1 label doesn't hold. In particular: a RED case passes before the fix, or a GUARD (including 11a)
  fails.
- Step 3a refutes the re-homing design. Report; don't build B1.
- Step 3b shows the `layout`-only move needs something structurally different. Report; with approval,
  continue on the second fallback (keep part C).
- Step 3c refutes the nested re-homing (P6's order, or the paired walk). Report; with approval, continue on the
  nested fallback.
- Step 3d's placement can't be made exact from the cached box. Report the offsets.
- A held clone paints over the entering element (6a/6b's precondition fails after the fix).
- The lightbox's radius or child-scale correction needs more than one new mechanism. Report the size; don't
  drop the case.
- A part C GUARD (008's clone `&scroller` cases, the `pop-layout-scroll-siblings` clone cases) fails or drifts
  past its Step 1 value after part C is deleted.
- The fix needs `node_modules` patched, or an out-of-scope file (`PresenceChild.svelte`, `layout.ts`, R2,
  `layoutId.ts`).
- A held node is never released: an exit hangs, wait mode never unblocks, or `onExitComplete` never fires or
  fires twice.
- An element animates twice for one change (the `layoutId` registry handoff **and** motion-dom's resume), or
  `onProjectionUpdate` fires twice.
- A ported upstream number (`0.433013`, the #1935 offsets, the #3233 count) fails while the painted-frame
  crossfade passes. Report the measured value; don't change the assertion.
- A failure in the guard set that is neither a held `layoutId` exit that upstream also holds nor an
  exit-complete snap per 015b's B(c). Use CLAUDE.md's failed-e2e review workflow.
- A step's verification fails twice after a reasonable fix.

## Maintenance notes

- **Visible parity change (needs the maintainer's live sign-off before any PR).** Every `layoutId` child of
  `AnimatePresence`, even one with no `exit`, now stays mounted and crossfades into the new lead, as upstream.
  Pages to drive:
  - `src/routes/tests/layout-root`, `tests/layout-id`, `tests/layout-id/scrolled`, `tests/layout-id/open-change`,
    `tests/layout/group`;
  - docs examples `shared-layout-animation`, `tab-select`, `layout-root` (SidebarTabs), `layout-group`, and
    `animated-tabs`;
  - `docs/src/lib/shadcn/ui/tabs/tabs-trigger.svelte`.
- **Part C (015a) is gone.** An exiting `layout` clone now follows layout changes through its own projection
  node, as upstream keeps every exiting `layout` node. If the second fallback was taken in Step 3, part C stays,
  gated to clones without a hold. Record that here, with the 3b evidence.
- **Nested descendants on the clone path** are re-homed through P6 and the paired walk. P6 depends on
  `$effect.pre` being a render effect created during the script. If a Svelte upgrade changes that, 11b fails
  first.
- **Async batching.** Under Svelte's `experimental.async`, `BranchManager` defers `#commit` to the batch
  (`should_defer_append`), so the departing teardown could run after the arriving projection mount. The
  arriving node would then take over a still-present lead instead of resuming from a re-homed one. This repo
  doesn't enable async. If it ever does, re-run 11a with async on.
- **Owned ports latch their props** (M3) because snippets read live state. Consumer code using the owned
  syntax with a value that changes on exit (`layoutId={open}`) needs the same latch. The docs'
  "Shared layout" section says so.
- **015c** must keep R2 declared before 012's presence pair, so its cached snapshot is the one `willUpdate()`
  keeps.
- **Order inside one flush.** `projection.isPresent` is written in each component's own pre effect, in tree
  order. Upstream writes it in each component's `getSnapshotBeforeUpdate`, also in tree order. If a
  `layoutId` switch and a presence flip of different nodes in one flush ever disagree, compare against
  `MeasureLayout.tsx:163-167`.
- **Deviations kept.**
  - `containsStatefulCloneContent` children are still removed at once.
  - Held clones are placed from the container's last offset snapshot, not a live read.
  - **Held clones are still absolutely positioned**, so they paint above non-positioned siblings that follow
    them in the slot. Upstream's real element stays in flow. This matches today's clones and is a kept
    structural deviation: an absolutely positioned stand-in is the only way to keep the slot (placeholder)
    without the real node.
  - `canHandOff()` relies on Svelte serving destroyed `$derived` values from `old_values` during teardown (N7).
    10d-ii fails first if a Svelte upgrade changes that.
  - A re-entering clone-path child gets a new node; upstream re-promotes the same one.
  - `presenceAffectsLayout={false}` isn't supported.
- **Reviewers should check**:
  - release runs once per cycle (the adapter latch; the registry dedup is only a backstop);
  - held clones have no z-index lift, and their placement doesn't double transforms;
  - the deferred unmount always runs (release, cancel, `dispose`);
  - `visualElementStore` has no clone entries after release;
  - the hand-off's update pass measures the clone after 008's correction;
  - no `layout` sibling animates twice now that held clones are classified exit-complete;
  - the registry handoff is only dropped when motion-dom resumes.
