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
>   cases stay as GUARDs (the clone-branch scroll-siblings ones follow ruling 5).
> - (4) The `layout-shared-lightbox-crossfade` port, with the child scale and border-radius correction it
>   needs, is in this plan.
> - (5) 2026-10-30: held clones paint without a z-index lift, as upstream; the clone-branch scroll-siblings
>   assertions follow the owned branch's rules.
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
> `git log --oneline d9fd6ca5..HEAD -- src/lib/utils/presence.ts src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte src/lib/types.ts src/lib/utils/scrollBasis.ts e2e/layout/layout-root.spec.ts e2e/layout-id/open-change.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts src/routes/tests/layout-root/+page.svelte src/routes/tests/layout-id/open-change/+page.svelte`.
> Expected: only the lane merge `M`. (`d9fd6ca5` is 015b's merge into `feat/motion-14.7.1`; 013, 015a, 016 and
> 015b are all below it.) Line numbers in this plan are at `d9fd6ca5` unless marked otherwise (re-baselined
> 2026-10-30, pre-flight E1-E17). **Locate every excerpt by its anchor text** anyway. If an anchor is missing
> or its content differs from the excerpt, STOP.

## Status

- **Priority**: P1 (every `layoutId` + `AnimatePresence` crossfade; closes 7 `fixme`s left by 006 and 007)
- **Effort**: L
- **Risk**: HIGH. It changes when exiting `layoutId` elements are removed (they are now held until the shared
  animation ends, as upstream), which is visible on several demos. It keeps a projection node alive on every
  `layout`/`layoutId` exit clone, and it replaces 015a's part C with that node.
- **Depends on**: 006, 007 (same lane, merged: `switchLayoutId`, `seedDepartingLeadSnapshot`, the #1935 page and
  its fixmes), 008 (presence helpers), 015a (scroll-rebased caches, part C in `unregisterChild`), 015b (clone
  marker, `registerChild`'s `layoutGroup` argument, exit-complete causes), 016 (merged `77c6e448`:
  `visualElement` and `motionDomProjection` are nullable `$state.raw`, and presence registration is gated on the
  node; see its "Merge hazards"). 012 edits the same `presence.ts` and `_MotionContainer.svelte` functions as
  015a/015b/016, after them.
- **Wave**: 5, lane `layoutid`, after 015b merges; 015c runs after this plan merges.
- **Category**: bug (upstream parity)
- **Planned at**: commit `b21e938a` (`feat/motion-14.7.1`, after 007), 2026-10-28, with 015a in progress on
  `lane/1471-siblings` (`c1533f92` plus uncommitted part C) and 015b planned. **Re-baselined** 2026-10-30 at
  `d9fd6ca5` (015b merged with amendments A1-A5; 016 merged at `77c6e448`), pre-flight edits E1-E17.

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
  The `$effect` with anchor `context.registerChild(` (`_MotionContainer.svelte:942-975`) is gated on
  `element && visualElement && shouldRegisterPresenceExit && exitProp !== undefined` (`:943`; 016 added
  `visualElement`), so `unregisterChild` returns "child not found" for every no-`exit` child
  (`presence.ts:1623`).
  - P5 widens the gate to
    `element && visualElement && shouldRegisterPresenceExit && (exitProp !== undefined || measureLayoutMounted)`.
    Keep 016's `visualElement` guard: a featureless `m` never registers (016 "Merge hazards").
  - It passes the hand-off as the **last** `registerChild` parameter, `layoutHandOff`, the 7th, after 015b's
    `layoutGroup` (`layoutGroupContext?.group`, `:972`). Add it to both the `AnimatePresenceContext` type
    (`presence.ts:914-921`) and the implementation (`:1489-1496`), and store it on the record next to the
    `layoutGroup` field (`:91-95`, `:1545`).
  - The hand-off is an object with three members:
    - `canHandOff(): boolean`. True when the adapter is mounted, **not already handed off**, and
      `measureLayoutMounted`. It runs during teardown, where it reads the `$derived` `measureLayoutMounted`.
      Reading a destroyed derived during teardown **recomputes** it from its dependencies, and each of those
      (`layoutProp`, `scopedLayoutId`, …) returns its `old_values` entry, the value from before this flush. So a
      `layoutId` cleared in the same flush as the removal still yields the pre-flush result, as upstream's
      `MeasureLayout` still renders with its last props. 10d-ii covers this. Once an adapter is handed off, it returns `false`, so a second
      `unregisterChild` for the same key can't re-home it twice (10i).
    - `ownedLayoutKeys(): ReadonlySet<string>`. Which layout keys are `style` motion values the VisualElement
      writes. That covers the insets (`top`, `right`, `bottom`, `left`), `width`/`height`, `margin*` and
      `padding*`, as camelCase keys. It replaces round 2's `layoutRect()` and round 3's `ownedInsets()`. It is
      called right after `canHandOff()`, before any clone work. Placement needs no other container data (see
      Placement).
    - `handOff(clone, release): ExitLayoutHold | undefined`.
- **Which children.** Every child whose `MeasureLayout` would be rendered upstream, i.e. the container's
  `measureLayoutMounted` (`layout || layoutId`, or `drag`, with the features loaded). `layout`-only children
  are included (ruling 3).
- In `unregisterChild`:
  - **Decide `canHandOff()` first, before any clone work**, then read `ownedLayoutKeys()`. A child that won't be held
    and has no `exit` keeps today's immediate removal, so a non-held no-`exit` child never flashes a clone.
  - **No connected slot parent → no clone (N4).** Today a detached child whose `insertionParent` is gone falls
    back to `doc.body` (`const slotParent = insertionParent ?? doc.body`, `presence.ts:1776`). Instead,
    `unregisterChild` builds no clone, settles a hold it would have taken (none is taken), and removes the
    child at once, held or not (10j).
  - For a held child, the no-`exit` early return is skipped, and the exit is **resolved synchronously at
    hand-off time**. Today the container always passes `resolvePresenceExit`, which can return `undefined`,
    and the rAF's `!resolvedExit` branch (`presence.ts:1936-1946`) removes the clone. For a held child that
    branch instead **settles the exit flag** of the hold/exit join and leaves the clone to the hold.
    - That branch runs no `finishExit()` and no 015b D call (it never called `startExit()`). A held no-`exit`
      clone must therefore complete through the **shared** completion tail, never through this branch's own
      removal, or the `layout` followers after the list never snap (E8; unit 10a asserts it).
  - After the clone is inserted and positioned (and after 008's `schedulePopLayoutCorrection` is queued), call
    the hand-off with the clone.
  - **Placement (M1).** Once `visualElement.current` is the clone, the VisualElement renders the element's
    transforms (`x`, `scale`, …) and its `style` motion values onto it each frame. Today the clone is placed
    from the element's **transformed** rect and frozen styles (`presence.ts:1661-1664, 1832-1837`), so those
    transforms and any `style` layout keys (`top`, `left`, `width`, `height`, `margin*`) would be applied twice.
    A held clone is therefore placed by an exact rule that adds **no extra forced layout** (review rounds 2–4).
    Its only extra reads are computed-style and geometry reads, all in one read pass before any write, in
    places that already read layout:
    - in `updateChildState`, computed `width`/`height`/`boxSizing`/insets from the `CSSStyleDeclaration` its
      callers already pass;
    - in `unregisterChild`'s existing read pass: the placeholder rect (made unconditional for held clones); the
      computed styles of the ancestors walked to find the containing block; and that block's rect,
      `clientLeft`/`clientTop`, `scrollLeft`/`scrollTop` and `offsetWidth`/`offsetHeight` (the last two for
      `measurePopLayoutScale`).

    The rule:
    - **Why not 008's offset snapshot in every mode.**
      - It forces reads in the wrong phase: `measurePopLayoutPoint` (`presence.ts:509-527`) reads rects,
        computed styles and scroll, and would run in the notify phase after `resetTransformStyle` writes.
      - It goes stale when an element moves without a projection update.
      - It isn't exact in sync/wait mode: the margin is applied twice (`presence.ts:1852-1854` already sets
        `margin: 0` on the clone, while `offsetTop` excludes the margin), and `offsetParent` can be `<body>` or a
        table cell while the clone's real containing block is the initial containing block.
    - **Size (every held clone): exact, from computed style.**
      - Extend `snapshotLayoutStyle` (`presence.ts:141-152`) with computed `width`, `height`, `top`, `right`,
        `bottom` and `left`. It already records `boxSizing` and `margin`. These are used, fractional,
        untransformed values, so there is no integer `offsetWidth` rounding.
      - When a computed `width`/`height` isn't a length (e.g. `auto` on an `inline` element), fall back to the
        rect, as `measurePopLayoutSnapshot` does with `readNumericStyle` (`presence.ts:472`, used at 550-557). Reuse that helper.
        The rect read is in the same record, so it is no extra forced layout.
      - `updateChildState` (`presence.ts:1573-1592`) already stores this record in every mode, from the
        container's ResizeObserver callback (`_MotionContainer.svelte:985-998`) and its rAF capture (855),
        whose callers already read layout. So the record adds no forced layout. Registration takes it too.
      - The held clone gets that `width`/`height` **with the element's frozen `box-sizing`**. Don't force
        `border-box` (`presence.ts:1855`) on held clones: with `content-box`, a computed `width` excludes
        padding and border.
      - Keys in `ownedLayoutKeys()` (e.g. a `style` `width` or `padding` motion value) aren't written on the
        clone, because the VisualElement writes them.
    - **Placeholder size (every clone, not just held ones).** The sync/wait placeholder is sized from that
      recorded computed size, with the element's `box-sizing` (it already copies it). Today it uses the
      transformed `rect.width` / `rect.height` (anchor ``placeholder.style.width = `${rect.width}px` ``), so an
      exit that interrupts a scale-up shrinks the slot. Upstream's element keeps its untransformed slot. Case
      10o covers this.
    - **Position, sync/wait (in flow, with a placeholder).**
      - Read the placeholder's `getBoundingClientRect()` (the existing read, anchor
        `const slotRect = placeholder.getBoundingClientRect()`, made unconditional for held clones).
      - In the same read pass, find the clone's containing block. Start **at the slot parent itself** and walk
        up, skipping `display: contents`. Take the first element whose computed style makes it a containing
        block for an absolute box: `position !== 'static'`, or anything that makes it the containing block of
        a fixed box. Otherwise use the initial containing block.
        - **One predicate for "containing block of a fixed box" (E13).** 008's `createsContainingBlockForFixed`
          (`presence.ts:573-578`) misses `backdrop-filter`, which 015b A5's `holdsFixedDescendants`
          (`scrollBasis.ts:99-113`, private; transform, filter, backdrop-filter, perspective, their
          `will-change`, and `contain: layout|paint|strict|content`) has. Export `holdsFixedDescendants` from
          `scrollBasis.ts` (in scope for this one export) and use it for this walk and for
          `popLayoutPointFollowsScroll` (`presence.ts:605`). Delete `createsContainingBlockForFixed`. This walk
          adds the `position !== 'static'` check on top.
      - Offsets: `left = (slot.left − cb.left) / sx − cb.clientLeft + cb.scrollLeft`, and the same for `top`,
        with `[sx, sy] = measurePopLayoutScale(cb)`. For the initial containing block, `cb.left/top =
        −scrollX/−scrollY`, `sx = sy = 1`, and there is no border or element scroll.
      - Set `margin: 0`, as non-`popLayout` clones already get. When `ownedLayoutKeys()` includes a margin key,
        the VisualElement will write that margin on the clone: subtract it from the matching offset
        (`marginLeft` from `left`, `marginTop` from `top`). For a `margin` shorthand with several values,
        expand it by CSS rules (1–4 values: top, right, bottom, left), then subtract the **top** component from
        `top` and the **left** component from `left`.
    - **Position, out of flow (no placeholder: `position: absolute | fixed`, not `popLayout`).**
      - Keep the element's **own resolved insets** from the recorded computed style (`top`/`right`/`bottom`/
        `left`) and its own `position`: `fixed` stays `fixed`. The clone sits in the same slot, so its
        containing block, whether from a positioned ancestor, `transform`, `filter` or `contain`, is the
        element's.
      - Don't use `offsetTop`/`offsetLeft`. They are wrong under transform/filter/contain containing blocks,
        `null`-based for `fixed`, and stale when the element moves without resizing.
      - Insets in `ownedLayoutKeys()` aren't written: the VisualElement's own values win.
      - Keep the element's **frozen margin**. The `margin = '0'` at `presence.ts:1852-1854` must not apply to
        out-of-flow held clones: their resolved insets position the margin box, as the element's do.
    - **`popLayout`: unchanged.** It keeps 008's snapshot and correction.
    - For held clones, `unregisterChild` does **not** force `positioningParent.style.position = 'relative'`
      (`presence.ts:1802-1807`): the offsets are computed against the real containing block.
    - Step 3 probes this (3d-i to 3d-v). There is no fallback rule. If it can't be exact, that's a STOP that
      reports the measured offsets.
  - **Paint order (M2).** Held clones get no z-index lift. Today `presence.ts:1857-1875` raises exiting clones,
    which inverts upstream, where the exiting child renders first (earlier in the tree,
    `AnimatePresence/index.tsx:155-164`) and the entering one paints over it. Held clones keep the element's
    own stacking and slot. Non-held clones keep today's lift.
    - **This includes `popLayout` held clones (ruling 5).** Upstream's `PopChild` inserts only position and
      size, with no z-index (`PopChild.tsx:167-168 @ v14.7.1`), so a later transformed sibling paints over the
      popped exiting element. 015b A2.3 measured exactly this on the owned path.
    - **Consequence for 015a's clone GUARDs.** The clone branches of
      `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` assume "pink (the exit clone, drawn above the
      others)" (spec header `:20-23`, band filter `:257-262`). Their items are `layout` with an `exit`, so 012
      holds them, and green now paints over pink as on the owned branch. See "Hand-offs" (015a) for the spec
      edit.
  - A `layout`-only node has no stack. Upstream it is released by the same `frame.postRender` /
    `microtask.postRender` checks (`relegate()` is `false`, `getStack()` is `undefined`, `isLead()` is `true`).
    With no layout change it is therefore released in the microtask after the update, before the next paint,
    as upstream. When the update moved it (the clamp), it is released when that layout animation completes.
- The adapter's `handOffToExitClone(clone, release)`:
  1. seeds the departing snapshot from cache. A `layoutId` node uses 007 A1's `seedDepartingLeadSnapshot`,
     unchanged. A `layout`-only node uses the existing private `seedOwnOnScreenSnapshot()`
     (`motionDomProjection.ts:2147`; it reads 015a's rebased `onScreenSnapshot()`), preceded by
     `root.startUpdate()` when the root isn't updating. No new seed method.
     - Since 015b A2.2 it returns `0` for a size-animating host (`isSizeAnimatingHost()`, `:2120-2122`: the
       element carries `data-layout-size-animation`). Such a node hands off with **no** seed, starts no layout
       animation, and is released in the microtask after the update. Unit 10t is a GUARD for this;
  2. sets `projection.isPresent = false`;
  3. re-points `projection.instance` and `visualElement.current` at the clone, and sets
     `visualElementStore.set(clone, visualElement)`. Now `animate(clone, exitKeyframes)` drives this
     VisualElement's values, so the exit and the projection share one renderer, as upstream
     (framer-motion `animation/animate/subject.ts:144-159`: "An element already owned by a VisualElement …
     animates its values so they share one renderer"). It also moves `MotionDomProjectionAdapter.byElement`
     (`:352`) from the original element to the clone: 015a's `foldedInFor` (`:515-530`) and 015b's
     `followersOf` (`:1810-1840`) look adapters up by element, and `unmount` deletes the entry keyed by
     `this.element` (`:851-853`), which is the clone after re-homing;
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
  existing completion tail once.
  - **Order:** first release every hold and run every deferred unmount in the subtree (the child's and each
    re-homed descendant's), while the clone is still connected. Only then run the existing tail, in its
    current order (`presence.ts:2016-2071`): reset the z-index, `clone.remove()`, `children.delete`,
    `removeExitPlaceholder`, 015b's D refresh
    (`seedFollowingLayout(followParent, null, { kind: 'exit-complete', markers: [exitMarker] })`), then
    `finishExit()`.
    - The D refresh stays **after** the placeholder removal: in sync mode the placeholder still holds the slot.
    - 015b's clone marker is not part of the tail. It is set when the clone is created
      (`markExiting(clone, exitMarker)`, `:1881-1891`), before the insert, so a held clone's removal is
      classified exit-complete unchanged.
    - The deferred unmount's group seed (`seedCachedSnapshotsForGroup` + `root.didUpdate()`, `unmount`
      `:830-834`) now runs while the placeholder still holds the slot, so it sees no move. The grouped
      siblings' animation then comes from the exit-complete observer commit (same group, so not snapped).
      GUARD 10u checks it animates exactly once.
  - Upstream unmounts the nodes while their element is still attached. NC3's promotion animates from
    `#child`'s last box because `projection.unmount()` → `willUpdate()` can still measure it. 10r covers the
    order. `startExit()` and `finishExit()` bracket the whole hold, so wait mode and
  `onExitComplete` wait as upstream does (`AnimatePresence/index.tsx:171-179, 219-249`).
- Re-entry (`takeExitHandoff`), boundary `dispose`, and `containsStatefulCloneContent` cancel or skip the hold.
  Cancel unmounts the node at once. `takeExitHandoff` reads the clone's animated values (`readAnimatedValues`)
  **before** `hold.cancel()`, because cancelling unmounts the VisualElement that renders them (m9).
- **015a's part C is deleted.** It was the clone's own scroll-clamp follow: `startExitAnimation`'s `follow`
  parameter, the `microtask.read` block after the anchor `Plan 015a, part C`, and its keyframe and transition
  merge. The re-homed node now animates the clamp's move through projection, with the element's own layout
  transition (`create-projection-node.ts:581-584, 626`). 015b doesn't depend on part C anywhere: its only traces
  are `presence.ts:1928-1931, 1975-2007, 2082-2107` and `presence.spec.ts:1647-1750` (6a-6c).
  - Symbols only part C uses, deleted with it: the imports `readScrollBasis`, `scrollDelta` and
    `seenScrollBasis` (`presence.ts:11-13`) and `getValueTransition` (`:21`), and the locals
    `defaultLayoutTransition` (`:449`, with its JSDoc) and `noop` (`:451`). Keep `microtask` (`:770-798`).
  - After that, `seenScrollBasis` (`scrollBasis.ts:323`) has no importer. Delete it and its
    `scrollBasis.spec.ts` cases (in scope for this one removal, see Scope). Keep every other `scrollBasis.ts`
    helper that other code still imports.
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
     - **Detection (B1).** On the clone path there is no `PresenceChild`, so `AnimatePresence.svelte:102` never
       sets `propagates`, and the container `<div class="animate-presence-container">` (:212) carries no
       marker.
       - 012 adds one attribute to that div: `data-propagate={propagate || undefined}`.
       - The walk treats `.animate-presence-container[data-propagate]` as in scope.
     - **Their own exits run too (operator ruling, upstream).** Upstream a propagating boundary's children get
       `isPresent = false`, so their `ExitAnimationFeature` runs `setActive("exit", true)`
       (`motion/features/animation/exit.ts:58`).
       - The one mechanism: for each re-homed descendant that is a direct motion child of an in-scope
         `[data-propagate]` boundary, the walk calls `visualElement.animationState.setActive('exit', true)` on
         its re-homed VisualElement. That VisualElement now renders the paired clone element, and its props
         already carry `exit` (`buildMotionNodeProps`, `exit: exitProp`).
       - The returned promise joins the hold, like any other settled flag.
       - **For every clone, not only held ones (operator ruling, upstream).** A `propagate` boundary inside a
         non-layout exiting child exits its children too, and upstream's `PresenceChild` waits for them.
         - So `unregisterChild` runs the walk's propagate-exit step on every clone.
         - For a non-held clone that means: pair the subtrees, re-point each propagating child's VisualElement
           (and its adapter, with no hold) at its clone copy, run its exit, and join on it.
         - The full relegate-and-hold walk stays held-only.
       - **The nested boundary's `onExitComplete` fires once its children have exited (upstream).**
         - The walk records each propagated child's exit promise in a module-level
           `propagatedExits: WeakMap<Element, Promise<unknown>>`, keyed by the **original** element.
         - The nested boundary's own `unregisterChild` for that child runs later in the same teardown. It finds
           no connected slot parent, so 10j's rule builds no clone.
         - 10j's immediate-removal path is extended: when `propagatedExits.get(child.element)` exists, it calls
           `startExit()` now and `finishExit()` when that promise settles, instead of removing silently. The
           nested boundary's in-flight count and `onExitComplete` (`scheduleExitComplete`) then fire once, after
           its children have exited, and nothing is double-run.
         - **The nested boundary outlives its own teardown until those exits settle (M1, round 5).**
           - Order: the nested `AnimatePresence` is disposed by `onDestroy(context.dispose)`
             (`AnimatePresence.svelte:189`), a user effect. Its children's teardowns come first (template
             before user effects), so their `startExit()` calls run before `dispose()`.
           - Today `dispose()` sets `disposed`, and `finishExit` then returns at once (`if (disposed) return`,
             `presence.ts:1468`). `onExitComplete` would never fire.
           - Upstream the boundary stays mounted until its children exit (`AnimatePresence/index.tsx:171-179`).
           - So when `propagatedExits`-driven exits are in flight, `dispose()` **defers**:
             - it stops observers, frames and non-propagated clones at once, as today;
             - it keeps the in-flight counter, `finishExit`, `scheduleExitComplete` and the `onExitComplete`
               callback alive until the last propagated exit settles;
             - then it finishes disposing.
           - Track the propagated in-flight count separately (e.g. `pendingPropagatedExits`), so the `disposed`
             checks elsewhere keep today's cancellation semantics for everything else.
       - If this needs more than that one mechanism (for example, the VisualElement has no `animationState` on
         the clone path, or nested registration must change), STOP and report the size. It is not a
         deviation.
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
   - The same strip also removes every copied `data-layout-size-animation` **attribute** (on the clone and its
     descendants; the elements stay). The size animation runs on the detached original, never on the clone,
     and a copied attribute makes 015b's D walk (`followsLayoutOf`, `motionDomProjection.ts:1853`) skip the
     whole held clone (E11; 10t).

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
  - **015a's e2e cases stay GUARDs:**
    - 008's two clone `&scroller` clamp cases in `e2e/animate-presence/pop-layout-container-move.spec.ts`,
      unchanged;
    - the clone cases of `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`, with one edit (ruling 5).
  - **The scroll-siblings clone branches follow the owned branch's paint (ruling 5, E17).** Held clones lose the
    z-index lift (M2), so a transformed green paints over the pink clone, as on the owned branch and upstream
    (`PopChild.tsx:167-168 @ v14.7.1`: no z-index; 015b A2.3).
    - The clone-path cases whose items are held: the clamp (`:376`), `?layoutScroll` (`:430`), resize (`:492`)
      and `?sticky` (`:518`). They adopt the owned branch's rules: 015b A2.3 (pink holds its position and stays
      fully visible until green first covers its centre, and green covers it no earlier than 140 ms after the
      pop), A3.2 (a reading where the point just below green's found edge hit-tests as pink is a capture gap,
      in the hit test and the screencast green band) and A4 (the same rule for `?sticky`: the step measurement
      resets at a gap).
    - Keep "no step above 35 px" in every case. Cite `PopChild.tsx:167-168` in the spec. Reuse the helpers the
      owned branch already uses (`greenBelowPink`, `gap`); don't fork them.
    - Update the spec header (`:20-23`) and the band-filter comment (`:257-262`): pink is drawn above the
      others only while it isn't held.
    - `?nolayout` (`:527`) isn't held: it keeps the lift and its assertions, unchanged.
    - Step 1 records these cases as they are today (GUARD, with the lift). In Step 5 the edit lands with the
      change that removes the lift, and the edited cases must pass. No other weakening.
    - If a clone `&scroller` case in `pop-layout-container-move.spec.ts` turns out to depend on the lift,
      apply the same rule to it and say so in the report.

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
  - **015b's own maintenance line becomes false after 012.** 012 doesn't edit 015b's plan file. The report says
    that line needs an update once 012 merges.

  015b interactions re-checked at `d9fd6ca5` (pre-flight E6-E12):
  - **`registerChild`** (E6): `layoutHandOff` is the 7th parameter, after `layoutGroup` (see Registration).
  - **Completion tail** (E7, E8): see "Removal of the clone" and the `!resolvedExit` note above.
  - **Exit-complete classification** (E9). The harness items in
    `src/lib/components/presenceSiblingSnapshots.spec.ts` (`PresenceSiblingsHarness.svelte`) are `layout` with
    an `exit`, so 012 now holds every clone case. Its clone cases 2, 3, 6, 6 (N1), 6 (M5), 7, 8, 9 and A1.1 are
    GUARDs that pass **unchanged** after Steps 3 and 5. That includes 015b A5.1's case 6: the footer may get a
    zero-move `didUpdate` at exit start, and none at completion. So the deferred unmount (including
    `scheduleCheckAfterUnmount`) must not cause one.
  - **`commitPresenceLayoutRelease`** (A2.1, E10). No conflict. It runs on the wait-mode reveal, after
    `finishExit`, which a hold only delays. The wait and sync children of `ModeButton.svelte`,
    `src/routes/tests/layout-dependency/+page.svelte` and `ModeExample.svelte` aren't `layout`, so they aren't
    held. A failure in 015b's merged wait or sync expectations (`layout-button.spec.ts` wait and `wait-group`,
    `layout-dependency.spec.ts:293`) is a STOP, not a parity change.
    - **Wait mode + `layoutId`.** svelte-motion mounts the entering child hidden (`data-presence-wait-hidden`).
      Upstream renders only the exiting children in wait mode (`AnimatePresence/index.tsx:166-179`), so the
      departing node is still the lead and is released by the microtask lead check. The held clone must never
      wait on the hidden entering node's animation (GUARD 10s).
  - **`yieldToSizeAnimation`** (A2.2, E11). A size-animating host hands off unseeded (see hand-off step 1).
    Every clone strips copied `[data-layout-size-animation]` attributes in the N3 strip: a copied attribute
    makes D's `followsLayoutOf` (`motionDomProjection.ts:1853`) skip the whole held clone.
  - **Popped self-commit skip** (A1.3, E12). The skip is on the observer path only (`layout.ts:1122-1125`).
    P1's `setPresence` / `commitPresence` must not check the pop attribute: upstream's `MeasureLayout` runs on
    every presence flip. GUARDs, unchanged: owned `pop-layout-container-move.spec.ts:307` (0 px drift) and the
    owned `&scroller` cases (015b removed their fixme), plus the owned `pop-layout-scroll-siblings.spec.ts`
    clamp (`:638`), `?layoutScroll` (`:675`), `?sticky` (`:772`) and sync (`:783`) cases.
  - **`scrollBasis` fixed root** (A1.3, A5, E13). A held `position: fixed` clone inside a transformed ancestor
    now gets the right scroll basis. The containing-block walk uses one predicate (see Placement). 3d-v gains a
    `backdrop-filter` variant.
  - **Part C** (E14). 015b doesn't depend on it (see "015a's part C is deleted").
- **016** (featureless `m`, merged `77c6e448`; its "Merge hazards" table, E15).
  - P5 keeps 016's `visualElement` guard (see Registration).
  - P1 and P2 read `visualElement` / `motionDomProjection`, which are nullable `$state.raw` since 016. Early
    return while either is null, and capture the node locally, as 016's A1 effects do.
  - P1's "ignore the first run" means the first run **with a mounted adapter**. A re-run because a late node
    arrived is not a flip.
  - P2 is gated on `visualElement` being non-null, so a featureless `m` registers nothing, as upstream. Plan 017
    (stub) relies on this gate.
  - P3's `canHandOff()` reads `motionDomProjection?.isMounted`, so a featureless `m` is never handed off.
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

### svelte-motion (anchors; line numbers at `d9fd6ca5`, re-baselined by pre-flight E3/E4)

- **`src/lib/html/_MotionContainer.svelte`**:
  - `presenceChildContext` / `inPresenceChild` (322-323). 015b's R5 owned-marker `$effect` (336-365, after
    the `layoutGroupContext` declaration at 333). `buildPresenceContext` (444-458). Its JSDoc (427-443) says
    "the clone is detached and has no VisualElement": update it in Step 5.
  - `shouldRegisterPresenceExit` (795-800). The presence `onDestroy`, which calls
    `context.unregisterChild(presenceKey)` (820-830). The `context.registerChild(` call (957-973), whose last
    argument is 015b's `layoutGroupContext?.group` (972). Its comment (962-969) says the clone-based exit
    animates "a DETACHED copy with no VisualElement": in P3, update it for held clones, which now animate
    through the re-homed VisualElement, and keep `skipAnimations` threaded (E5).
  - Since 016, `visualElement` and `motionDomProjection` are nullable `$state.raw` (1231-1232), created late
    for a featureless `m`.
  - The projection mount `$effect` (anchor `adapter.mount(mountTarget, {`, 2166; the adapter is captured
    locally since 016). Its cleanup calls `adapter.unmount()` (2181). The VisualElement `$effect`'s cleanup is
    `if (node.current === mounted) node.unmount()` (2244), followed by an unconditional
    `visualElementStore.delete(mounted)` (2245): after re-homing, `current` is the clone, so the unmount skips
    and the deferred release must unmount. The store delete only removes the original element's entry, which
    the hand-off deletes anyway.
  - `measureLayoutMounted` (2335-2337) is upstream's "MeasureLayout is rendered" condition.
  - `trackLayoutProjectionDependencies` reads `presenceChildContext?.isPresent` (2456-2462). R2, the pre-update
    effect (2464-2488, anchor `explicitLayoutSnapshot = measureLayoutRect('snapshot')`), is 015c's. Don't
    edit it.
  - 006's `layoutId` switch pair (2731-2777): `$effect.pre` (anchor `pendingLayoutIdTakeOver = adapter.switchLayoutId(next)`)
    and `$effect` (anchor `measuredBeforeLayoutIdChange = measured`). That is the pattern for the presence pair,
    which goes right after it, before `// Cancel a pending reactive commit when the component tears down.`
    (2779).
  - `buildMotionNodeProps` (626; since 016 it takes `includeStyle = true`) builds the VisualElement props.
    motion-dom reads `onLayoutAnimationStart` / `onLayoutAnimationComplete` from them.
  - 015b's observer effect: the B(c) rule (`boundariesHolding` / `isSnappedBy`, 2950-2964),
    `commitPresenceLayoutRelease` (3064, A2.1 rule at 3080-3093) and the M5 teardown D call for marked owned
    elements (3237-3245). 012 doesn't edit them.
- **`src/lib/utils/motionDomProjection.ts`**:
  - `MotionDomProjectionAdapter`, `private static adapters` (350), `private static byElement` (352),
    `foldedInFor` (515), `switchLayoutId` (622), `mount` (715), `unmount` (813-863), `willUpdate` (874-882),
    `didMount` (901-912), `seedDepartingLeadSnapshot` (private, 952; it returns early when
    `element.isConnected` or a snapshot exists), `liveResumeFrom` (1026-1033:
    `if (lead.isPresent === false) return null`), `takeOverLiveLeadOnMount` (1049), `didUpdate` (1104).
  - 015b: `static seedFollowingLayout` (1764), `followersOf` (1810), `followsLayoutOf` (1845-1858; it skips
    nodes inside `[data-layout-size-animation]`), `isSizeAnimatingHost` (2120), `yieldToSizeAnimation` (2138),
    `seedOwnOnScreenSnapshot` (2147, with A2.2's size-animating-host early return).
  - `grep -rn 'relegate\|\.promote(\|projection.isPresent' src/lib --include='*.ts' --include='*.svelte' | grep -v spec`
    prints nothing today.
- **`src/lib/utils/presence.ts`**:
  - `startExit` (1393-1401, takes a `holdLayoutIdHandoffs()` hold), `finishExit` (1423-1435).
  - `registerChild` (1489-1560; 015b's `layoutGroup` is its 6th parameter). The `PresenceChild` record type is
    at 51 (`layoutGroup` field 91-95); the `AnimatePresenceContext.registerChild` type at 914-921.
  - `unregisterChild` (1610). The no-exit early return (anchor `no exit animation, removing immediately`,
    1642-1648). `containsStatefulCloneContent` (1650). The clone (anchor `const clone = child.element.cloneNode(true)`,
    1743; the next line removes `id`). 015b's marker (`markExiting(clone, exitMarker)` and `followParent`,
    1881-1891). The insert (anchor `slotParent.insertBefore(clone,`, 1904). `startExitAnimation` (1933) and
    its `!resolvedExit` branch (1936-1946, which removes the clone at once and runs no D call). The completion
    tail in `exitAnimation.finished … .finally` (2014-2071; 015b's D call 2061-2069). `takeExitHandoff`
    (2110). `dispose` (2144).
  - `createsContainingBlockForFixed` (573-578) and its one caller `popLayoutPointFollowsScroll` (593-605).
  - **Part C** (015a, merged in `f8e6c47b`):
    - `startExitAnimation(follow?)`'s JSDoc (1928-1931) and its `followAxes` / `getValueTransition(…, 'layout')`
      merge (1975-2007);
    - the `if (clone.matches('[data-layout], [data-layout-id]'))` block after the comment
      `// Plan 015a, part C:` (2082-2107), which runs `seenScrollBasis`, `foldedInFor`, `microtask.read` and
      `scrollDelta`, then `startExitAnimation({ x: move.x, y: move.y })`.

    012 deletes it (ruling 3). 015a's unit cases for it are `presence.spec.ts` 6a–6c (1719-1750). Its e2e
    GUARDs are 008's clone `&scroller` cases and the clone cases of `pop-layout-scroll-siblings.spec.ts`
    (ruling 5 edits the latter's paint rules).
  - Part C passes the raw scroll move (`startExitAnimation({ x: move.x, y: move.y })`). It does **not** divide
    by `measureScreenScale`: a projection node never corrects for a CSS-scaled ancestor without a node, so
    neither does part C. The re-homed node's own projection gives the same units.
- **`src/lib/utils/scrollBasis.ts`** (015a, plus 015b A1.3 and A5): `holdsFixedDescendants` (99-113, private,
  read live), `getScrollAncestors` (after a fixed node it skips to the fixed node's containing block),
  `seenScrollBasis` (323; only part C imports it).
- **Registration gate (B1).** `_MotionContainer.svelte:942-975`:
  `$effect(() => { if (element && visualElement && shouldRegisterPresenceExit && exitProp !== undefined) { const resolvePresenceExit = … ; context.registerChild(…, layoutGroupContext?.group) } })`.
  So no-`exit` children are never registered, and `unregisterChild` logs "child not found" (`presence.ts:1623`).
  A registered child always carries `resolvePresenceExit`, so a no-`exit` one reaches the rAF's `!resolvedExit`
  branch (`presence.ts:1936`), which removes the clone.
- **Clone placement and paint order** (`presence.ts`):
  - the clone's rect is the element's transformed `getBoundingClientRect()` (1661-1664);
  - the frozen-style copy skips transforms and keeps everything else (1745-1760);
  - the forced `position: relative` on the positioning parent (1802-1807);
  - placement is absolute in the slot (1832-1837);
  - `pointer-events: none` (1844), `margin: 0` (1852-1854), `box-sizing: border-box` (1855);
  - the z-index lift is at 1857-1875.
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
  `ExitLayoutHold` type. The hand-off also re-keys the existing `byElement` entry to the clone (E16). Don't
  change `switchLayoutId` or 015a/015b/015c members.
  `motionDomProjection.spec.ts`: new `describe`s only.
- `src/lib/html/_MotionContainer.svelte`, these regions only:
  - P1: the new presence `$effect.pre` / `$effect` pair right after 006's switch pair;
  - P2: the participant registration (new `$effect` next to P1);
  - P3: the `registerChild(` call: append `layoutHandOff` (`canHandOff`, `ownedLayoutKeys`, `handOff`) as the
    **last** (7th) parameter, after 015b's `layoutGroup`, and update the call's comment about the detached
    clone (E5);
  - P5: that registration `$effect`'s gate (anchor `exitProp !== undefined`), widened to
    `element && visualElement && shouldRegisterPresenceExit && (exitProp !== undefined || measureLayoutMounted)`;
  - P6: the presence teardown. Replace the `onDestroy` (anchor `context.unregisterChild(presenceKey)`) with a
    script-level `$effect.pre` teardown in the same place, keeping the `propagated` check;
  - P4: destructure and forward `onLayoutAnimationStart` / `onLayoutAnimationComplete` (props destructuring and
    `buildMotionNodeProps`);
  - the `buildPresenceContext` JSDoc.
- `src/lib/utils/presence.ts`:
  - the `registerChild` hand-off parameter and record field;
  - `snapshotLayoutStyle` / `updateChildState`: record computed `width`/`height`/insets in every mode (no
    point);
  - the propagate-exit step for every clone, the `propagatedExits` map, and the 10j path's
    `startExit()`/`finishExit()` for propagated children;
  - `dispose()`: defer the counter, `finishExit` and `scheduleExitComplete` while propagated exits are in flight;
  - the completion tail order (holds and deferred unmounts before `clone.remove()`);
  - in `unregisterChild`:
    - the `canHandOff()` decision before any clone work;
    - the no-exit branch for held children, and the synchronous exit resolve;
    - the `!resolvedExit` branch settling the exit flag for held children;
    - held-clone placement by the placement rule (no extra forced layout): the recorded computed size, the placeholder rect minus
      the containing block in one read pass, `margin: 0` in flow, and the element's own resolved insets,
      `position` and margin out of flow, with
      `ownedLayoutKeys()` left to the VisualElement. The element's frozen `box-sizing` is kept. No z-index lift
      and no forced `position: relative`;
    - placeholders of every clone sized from the recorded untransformed size;
    - no clone without a connected slot parent (instead of falling back to `doc.body`);
    - the nested artifact strip, for every clone (including copied `[data-layout-size-animation]`
      attributes, E11), and the paired subtree walk with the boundary and `propagate` rules;
    - the hand-off call after the insert;
    - the hold/exit join before the completion tail;
    - `id` kept on held clones;
  - **deleting 015a's part C** (its block, `startExitAnimation`'s `follow` parameter and merge, and imports only
    it used);
  - `takeExitHandoff` (read values, then cancel) and `dispose` (cancel holds);
  - replacing `createsContainingBlockForFixed` with `scrollBasis.ts`'s exported `holdsFixedDescendants`, in
    the placement walk and in `popLayoutPointFollowsScroll` (E13).
  `presence.spec.ts`: new cases, plus replacing 015a's 6a and re-pointing 6b/6c (see "Hand-offs").
- `src/lib/utils/scrollBasis.ts`, two changes only: export `holdsFixedDescendants` (E13), and delete
  `seenScrollBasis`, which has no importer once part C is gone (E14). `scrollBasis.spec.ts`: delete the
  `seenScrollBasis` cases (around 187-199) and add none.
- `src/lib/types.ts`: `onLayoutAnimationStart?` / `onLayoutAnimationComplete?` in the layout props block, with
  JSDoc.
- Tests and harnesses (create): `src/lib/components/__tests__/PresenceSharedLayoutHarness.svelte`,
  `src/lib/components/presenceSharedLayout.spec.ts`, `e2e/_helpers/paintedFrames.ts`.
- E2E: `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (ruling 5 only: the clone branches of the
  clamp, `?layoutScroll`, resize and `?sticky` cases adopt the owned branch's paint rules, with the header and
  band-filter comments; see "Hand-offs"), `e2e/layout/layout-root.spec.ts` (un-fixme 6, owned twins),
  `e2e/layout-id/open-change.spec.ts`
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

- `src/lib/components/PresenceChild.svelte` and `presenceExitRegistry.ts`. Their existing contract already
  supports a measure participant.
- `src/lib/components/AnimatePresence.svelte`, **except** one change: `data-propagate={propagate || undefined}` on
  the `<div class="animate-presence-container">` (B1, round 3). Nothing else in that file.
- `src/lib/utils/layout.ts` (015b/015c), `src/lib/utils/scrollBasis.ts` (015a/015b) except the two changes
  above, R2 (015c), 015a's R1/R3/R4 and 015b's R4/R5/R6/R7 container regions (the observer effect, the B(c)
  rule, `commitPresenceLayoutRelease`, the R5 marker effect).
- 015b's specs and their merged expectations: `presenceSiblingSnapshots.spec.ts`, `layout-button.spec.ts`,
  `layout-dependency.spec.ts` and the owned branches of `pop-layout-scroll-siblings.spec.ts` (GUARDs, see
  "Hand-offs").
- Other plans' files, including 015b's plan (see "Hand-offs" for its stale maintenance line).
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
     uses `<AnimatePresence propagate>` (for NC3/NC4).
     - `&innerExit=true` replaces the inner child with a plain `motion.div#fade` that has an `exit` (NC5/NC6).
     - `&fast=true` sets the shared-layout transition to 0.3 s.
     - `?outer=plain` makes the outer element a non-layout `motion.div` with `exit={{ opacity: 0 }}`, 0.3 s.
     - The nested boundary's `onExitComplete` increments `#inner-done`.

   `e2e/layout-id/nested-crossfade.spec.ts` uses `recordPainted` with probes on `#item-child`'s box:
   - NC1 (close): from the overlay click until the end, on every frame:
     - the held `#child` copy (inside the clone) follows `#item-child`, whose rAF-recorded rects grow out of
       the lightbox child;
     - at least 20 frames show both mounted with the clone child's centre within 1 px of `#item-child`'s;
     - `elementFromPoint` at `#item-child`'s centre never hits the background.

     **RED**: the nested node is torn down before the direct child's `onDestroy`, so the clone's inner copy has
     no node and fades in place.
   - NC2 **RED**: the outer pair (`#parent` → `#item-parent`) follows and crossfades like case 1. Same reason as
     case 1: the clone has no node.
   - NC3 **RED** (nested boundary): the lightbox child sits inside a nested `<AnimatePresence>`. On close, the
     inner `#child` is **not** relegated: `#item-child` doesn't grow out of it. The inner copy stays in the
     clone at its own box, following the outer node's projection, until the outer hold releases. Then both are
     removed together. Today the whole clone fades in place without an outer follow.

     On the outer release, as upstream: the deferred unmount removes `#child`'s node from its stack (it was the
     lead), `NodeStack.remove` promotes `#item-child` (stack.ts 25-32), and `#item-child` animates from
     `#child`'s last box. Its first painted frame after the release is within 1 px of `#child`'s last painted
     box, and it then grows to its own box.
   - NC4 **RED** (`propagate`): the same with `<AnimatePresence propagate>`. The inner `#child` is relegated and
     crossfades into `#item-child`, like NC1.
   - NC5 **RED** (`propagate` exits): `?inner=propagate&innerExit=true&fast=true`.
     - The propagating boundary's child is a plain `motion.div#fade` with `exit={{ opacity: 0, scale: 0.5 }}`,
       `transition={{ duration: 1, ease: 'linear' }}` and **no** `layoutId`. A relegated `layoutId` follower
       would paint with the lead's `opacityExit` and transform (`create-projection-node.ts:2124-2150`), not its
       own exit.
     - `fast=true` makes the shared-layout crossfade 0.3 s.
     - Painted opacity can't judge `#fade`. It sits inside the outer clone, so its painted opacity is multiplied
       by the outer's fade and reaches 0 at about 0.3 s (upstream too). Clones are `pointer-events: none`
       (`presence.ts:1844`, anchor `clone.style.pointerEvents = 'none'`), inherited by their children, so `elementFromPoint` never hits them.
     - So the page runs a per-rAF log of what `#fade`'s VisualElement writes on its clone copy (found by its
       class inside `[data-clone]`): inline `style.opacity`, and the scale parsed from inline
       `style.transform`.
     - On close, every logged frame's opacity is `1 − t` and its scale `1 − 0.5·t` (t = elapsed / 1 s, clamped),
       each within 0.05.
     - **Outer clone timing, from painted frames:** the outer clone is still connected and painted (screencast,
       plus `isConnected` in the rAF log) at 0.3–0.9 s, after the crossfade has finished. It is removed within
       2 frames of `#fade`'s 1 s exit completing.
     - Today no inner exit runs.
   - NC6 **RED** (`propagate` inside a non-layout exit): `?outer=plain&inner=propagate&innerExit=true`.
     - The lightbox's outer element is a plain `motion.div` with `exit={{ opacity: 0 }}` (0.3 s), and no
       `layout` or `layoutId`, so it is **not** held.
     - `#fade`'s VisualElement still writes its 1 s exit on its clone copy (the same per-rAF inline-style log and
       linear check as NC5). The outer clone stays connected until the exit ends, within 2 frames of 1 s.
     - The page's nested `<AnimatePresence propagate onExitComplete>` counter (`#inner-done`) reads `1` once
       `#fade`'s exit ends, not before, and never `2`.
     - Today the outer clone is removed at 0.3 s, and `#inner-done` stays `0`.
10. Link the four new pages from `src/routes/+page.svelte`.

**Part C GUARDs (ruling 3).** These are 015a's cases; they must pass now, unchanged, and after part C is
deleted:
- 008's two clone `&scroller` clamp cases in `e2e/animate-presence/pop-layout-container-move.spec.ts`;
- the clone cases of `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`. The held ones (clamp,
  `?layoutScroll`, resize, `?sticky`) take ruling 5's paint-rule edit in Step 5, in the same commit that
  removes the lift; nothing else in them changes.

Record their measured jump values now, so Step 5 can compare.

**015b and 016 GUARDs (pre-flight E9, E10, E12).** They pass now and must pass, unchanged, after Steps 3, 4
and 5:
- `src/lib/components/presenceSiblingSnapshots.spec.ts`, every case. Its clone items are now held (see
  "Hand-offs", 015b).
- Owned `pop-layout-container-move.spec.ts:307` (0 px drift) and the owned `&scroller` cases.
- The owned `pop-layout-scroll-siblings.spec.ts` cases: clamp (`:638`), `?layoutScroll` (`:675`), `?sticky`
  (`:772`) and sync (`:783`).
- `layout-button.spec.ts` (its wait and `wait-group` cases) and `layout-dependency.spec.ts:293`.
- The `e2e/lazy-motion` featureless-`m` specs (`featureless-m*.spec.ts`) and `src/lib/components/featurelessM.spec.ts`
  (016).

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
     `A.projection.isPresent === false`, and A has a snapshot from cache. `MotionDomProjectionAdapter.byElement`
     resolves the clone to A and no longer resolves the original element (E16; check it through
     `foldedInFor(clone)` or a `seedFollowingLayout` walk, since `byElement` is private). A later `A.unmount()`
     doesn't unmount the VisualElement. Release unmounts it exactly once.
   - 9e **RED**: `cancel()` on the hold unmounts at once, and a later release is a no-op.
   - 9f **GUARD**: an adapter never given a presence keeps today's `unmount()`, unchanged.
U10. `presence.spec.ts`, `describe('exit holds (plan 012)')`:
    - 10a **RED**: a child registered with a hand-off that returns a hold, and with no `exit`, gets a clone
      (`[data-clone]` connected) that stays until the hold releases. Then the completion tail runs once:
      `onExitComplete` once, and `startExit`/`finishExit` balanced. Spy on
      `MotionDomProjectionAdapter.seedFollowingLayout`: it is called once, with `{ kind: 'exit-complete' }` and
      the clone's marker, after the placeholder is removed and before `finishExit()` (E8). The clone was
      marked (`markExiting`) before it was inserted.
    - 10b **RED**: with an `exit`, the clone is removed only after **both** the exit animation finishes and the
      hold releases, in either order.
    - 10c **RED**: `takeExitHandoff` (re-entry) and `dispose()` cancel the hold.
    - 10d **RED**: in `sync` mode, a held clone keeps its `id`, has no z-index lift, and its positioning parent
      isn't forced to `position: relative`.
      - Placement: the element is mocked with `scale: 1.5` (transformed rect 150×150) and a recorded computed
        `width`/`height` of `100px` with `box-sizing: content-box`. The placeholder rect is at (40, 60). The
        positioned containing block has rect (10, 20, 300×200), `clientLeft`/`clientTop` stubbed to `2`, and
        `offsetWidth`/`offsetHeight` stubbed to `300`/`200` (its rect size). Without these, jsdom's `0` makes
        `measurePopLayoutScale` return `Infinity`.
      - The clone gets `width: 100px`, `height: 100px`, `box-sizing: content-box`, `left: 28px`
        (`(40 − 10) / 1 − 2`), `top: 38px` and `margin: 0`.
      - With `ownedLayoutKeys()` stubbed to `{'width', 'marginLeft'}` and the VisualElement's `marginLeft` 10,
        the clone's `width` isn't written and its `left` is `18px`.
      - With an out-of-flow (`position: fixed`, `top: 12px`, `left: 30px`) child, the clone keeps
        `position: fixed`, `top: 12px` and `left: 30px`. Stubbed to `{'top'}`, its `top` isn't written.
    - 10o **RED** (placeholder size, every clone): a non-held clone of an element mid scale-up (transformed rect
      50×50, recorded computed size 100×100) gets a 100×100 placeholder. Today it is 50×50.
    - 10p **RED** (nested `propagate` completion): an outer boundary's clone walk records a propagated child's
      exit promise. The nested boundary's later `unregisterChild` for that child (no connected slot parent)
      calls `startExit()` and fires its `onExitComplete` exactly once, after the promise resolves and not before.
      `dispose()` runs **before** the promise resolves, and `onExitComplete` still fires once. After that the
      boundary is fully disposed: a later `registerChild` is ignored.
    - 10q **RED** (`propagate` on a non-held clone): a clone without a hand-off, whose subtree has a
      `[data-propagate]` boundary with a registered `motion` child, re-points that child's VisualElement to its
      clone copy and calls `animationState.setActive('exit', true)`. The clone is removed only after that
      promise resolves.
    - 10r **RED** (tail order): with a held child and a re-homed descendant, spy on `clone.remove` and both
      adapters' deferred unmounts. Both unmounts run, with `clone.isConnected === true`, before
      `clone.remove()`. The test fails if the clone is removed first.
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
    - 10s **RED** (wait mode + `layoutId`, E10): in `mode="wait"`, a held `layoutId` clone whose entering
      sibling is mounted hidden (`data-presence-wait-hidden`) is released by the microtask lead check, as
      upstream, where the entering child isn't rendered yet (`AnimatePresence/index.tsx:166-179`). It never
      waits on the hidden node's animation, and the entering child is revealed once, after the release.
    - 10t **GUARD after Step 3** (size-animating host, E11): a `layout`-only child whose element carries
      `data-layout-size-animation` when it is removed hands off with no seed, starts no layout animation, and
      is released in the microtask after the update. The clone has no `[data-layout-size-animation]` attribute
      on itself or any descendant. RED at `RED_SHA` (no hold exists).
    - 10u **RED** (grouped completion, E7): a held clone in a `LayoutGroup` with a grouped `layout` sibling.
      The deferred unmount runs while the placeholder still holds the slot. The sibling animates into the
      freed slot exactly once, from the exit-complete observer commit, never from the unmount's group seed.
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
- Confirmed when 10d-iii, 10l, 10m, 10n and 11b pass, NC1's nested child follows `#item-child` on every painted
  frame, and NC3 to NC6 hold, with 10p, 10q and 10r passing.
- Refuted when either of these holds:
  - P6's `$effect.pre` teardown doesn't run before the descendants' teardowns in a real flush;
  - the paired walk can't find the descendant's VisualElement (for example, its store entry is gone by then).

  STOP, and report with the **fallback**: re-home only the direct child, and record that nested crossfades on
  the direct-child path need the owned syntax.

**3d: placement (M1).** Add five probe cases to `e2e/layout-id/presence-crossfade.spec.ts`, kept as
permanent GUARDs after Step 5:
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
- 3d-iii: an **in-flow**, sync-mode `layout` child with `margin: 12px`, an `exit` (`opacity: 0`, 1 s) and **no**
  positioned ancestor (the containing block is the initial containing block), on a page scrolled by 200 px. On
  every painted frame until the clone is gone, its box equals the element's last painted box within 1 px.

- 3d-iv: in flow, sync mode, `style={{ marginLeft: 10, width: 120, padding: 8 }}` (motion values) and
  `box-sizing: content-box`, with an `exit` (`opacity: 0`, 1 s). On every painted frame until the clone is gone,
  its box is within 1 px of the element's last painted box.
- 3d-v: out of flow, `position: absolute; top: 30px; left: 40px` inside a containing block created by
  `transform: translateX(0)` (not positioned), whose own `offsetParent` is further up, with an `exit`
  (`opacity: 0`, 1 s). On every painted frame until the clone is gone, its box is within 1 px of the element's
  last painted box. A second variant uses `position: fixed` inside a `filter: blur(0)` ancestor, and a third
  uses `position: fixed` inside a `backdrop-filter: blur(0)` ancestor (E13: 015b A5's containing-block
  triggers).

The probe is confirmed when all five pass. Otherwise fix the placement within the rule. If it can't be exact,
STOP and report the measured offsets. There is no fallback rule.

**Outcomes.**
- On a 3a refutation, STOP and report the evidence and the first fallback. Don't implement B1 without the
  operator.
- On a 3b refutation alone, STOP and report. With approval, the plan continues with re-homing for `layoutId`
  clones only, and keeps part C gated to clones without a hold (second fallback).
- On a 3c refutation, STOP and report. With approval, continue on the nested fallback.
- On a 3d failure that the placement rule can't fix, STOP and report.
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
     `measureLayoutMounted`, a non-null `visualElement` and a mounted adapter (`motionDomProjection?.isMounted`)
     all hold, and unregisters on cleanup. Untrack the register call. The `measure-` namespace keeps it apart
     from the exit feature's numeric ids. The `visualElement` gate is 016's "Merge hazards" row: a featureless
     `m` registers nothing, as upstream, and plan 017 relies on it.
   - **P1**: a pre/post pair after the switch pair. The `$effect.pre` reads `presenceChildContext?.isPresent`.
     On a change from the last seen value, while the adapter is mounted and `measureLayoutMounted`, it captures
     the cycle's `presenceChildContext.onExitComplete` and calls `adapter.setPresence(isPresent, () => !isPresent && capturedOnExitComplete(id))`.
     The `$effect` then calls `adapter.commitPresence()` for that flip.
   - Both effects early-return while `visualElement` or `motionDomProjection` is null (nullable `$state.raw`
     since 016), and capture the adapter locally, as 016's A1 effects do.
   - Ignore the first run **with a mounted adapter**: a mount is not a flip, matching
     `getSnapshotBeforeUpdate`'s `prevProps`. A re-run because a late node arrived (016) is such a first run,
     not a flip.
   - Neither effect checks the pop attribute. 015b A1.3's popped self-commit skip (`layout.ts:1122-1125`) is
     on the observer path only; upstream's `MeasureLayout` runs on every presence flip (E12).
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

1. The `registerChild` parameter is `layoutHandOff?: { canHandOff(): boolean; ownedLayoutKeys(): ReadonlySet<string>; handOff(clone: HTMLElement, release: () => void): ExitLayoutHold | undefined }`.
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
     positioning parent for them, and keep their frozen `box-sizing`. Place them by the placement rule
     (Placement; 3d). Size every clone's
     placeholder from the recorded untransformed size.
   - With no connected slot parent, build no clone (N4).
   - Strip nested `[data-clone]` / `[data-presence-placeholder]` copies and copied `data-layout-size-animation`
     attributes from **every** clone (N3, E11). Then, for held
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
     `{ canHandOff: () => !!motionDomProjection?.isMounted && !motionDomProjection.isHandedOff && measureLayoutMounted, ownedLayoutKeys: () => <the inset, width/height, margin* and padding* keys present as motion values in styleProp>, handOff: (clone, release) => motionDomProjection?.handOffToExitClone(clone, release) }`,
     so `layout`, `layoutId` and `drag` children are all included, as upstream renders `MeasureLayout` for each;
   - `AnimatePresence.svelte`: `data-propagate={propagate || undefined}` on the container div, the only edit
     there;
   - P5's gate is in place, with 016's `visualElement` guard;
   - P6 is in place (both from Step 3);
   - the `registerChild(` call's comment no longer says the clone has no VisualElement (E5).
5. Ruling 5: edit the clone branches of `pop-layout-scroll-siblings.spec.ts` (clamp `:376`, `?layoutScroll`
   `:430`, resize `:492`, `?sticky` `:518`) to the owned branch's rules, as "Hand-offs" (015a) describes. Cite
   `PopChild.tsx:167-168`. `?nolayout` (`:527`) is unchanged.
6. Update `buildPresenceContext`'s JSDoc: direct children's projection nodes now move to their clone.

**Verify**:
- 10a–10u (including 10d-ii, 10d-iii, 10g-i and 10g-ii), 11a and 11b pass.
- The 015b and 016 GUARDs from Step 1 pass unchanged.
- 1, 2, 5a, 6a and NC1–NC6 pass, and 3d-i to 3d-v still pass.
- The clone exit-complete-once variant passes.
- The part C GUARDs pass within their Step 1 values, with ruling 5's edit on the held scroll-siblings clone
  cases.
- `PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts e2e/layout-id e2e/animate-presence`
  → all pass apart from the parity changes listed below.

For each failure outside the cases above, follow CLAUDE.md's failed-e2e review workflow:
- record what the page demonstrates, what the test asserted, and what is now painted.
- It is an **expected parity change** when it is one of:
  - a held `layoutId` exit that upstream also holds (two elements during the shared animation);
  - a `layout` sibling that now snaps on exit completion outside the boundary, per 015b's B(c), because the
    held clone's removal is now classified exit-complete.

  List it for the operator and don't edit the test.
- A failure in a 015b or 016 GUARD (Step 1) is **never** a parity change: 015b measured upstream frames for
  those cases. It is a STOP.
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
  half (8), the nested crossfades and propagate exits (NC1–NC6), and unit cases 9a–9e, 10a–10e, 10d-ii, 10d-iii, 10g-ii, 10h–10j, 10l–10r, 10s, 10u, 11b and
  Step 2.3. Each fails at `RED_SHA` for its stated reason and passes after its step. Item 3's owned twins are
  recorded, not labelled.
- **Guards**: 9f, 10f, 10g-i, 10k (if GUARD at `RED_SHA`), 10t (once Step 3 lands), 11a; the 015b and 016
  GUARDs from Step 1; 3d-i to 3d-v once added; the exit-complete-once owned variant; the lightbox
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
      both lightbox tests, the nested crossfades and propagate exits (NC1–NC6) and the placement GUARDs 3d-i to 3d-v pass.
- [ ] Unit 9a–9f, 10a–10u (with 10d-ii, 10d-iii, 10g-i, 10g-ii), 11a, 11b and Step 2.3 pass. 015a's 6a is
      deleted and 6b/6c are re-pointed. `pnpm test:only` passes, and Step 7.7's cast grep prints nothing.
- [ ] P5 and P6 are in place: `grep -n "exitProp !== undefined || measureLayoutMounted" src/lib/html/_MotionContainer.svelte`
      prints a line, and `context.unregisterChild(presenceKey)` sits inside an `$effect.pre` teardown, not an
      `onDestroy`.
- [ ] Part C is deleted: `grep -n "Plan 015a, part C\|followAxes" src/lib/utils/presence.ts` prints nothing.
      008's clone `&scroller` cases pass, unchanged, and the `pop-layout-scroll-siblings` clone cases pass with
      only ruling 5's paint-rule edit. The symbols only part C used are gone, including `seenScrollBasis`
      (`grep -rn "seenScrollBasis" src/lib` prints nothing).
- [ ] The 015b and 016 GUARDs from Step 1 pass unchanged.
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
- Step 3d's placement can't be made exact by the placement rule. Report the offsets.
- Driving a `propagate` boundary's nested exits (NC5, NC6, 10p, 10q) needs more than one mechanism, counting the
  walk's exit call plus the `propagatedExits` hand-over as that one mechanism. Report the size. It is not
  a deviation.
- A held clone paints over the entering element (6a/6b's precondition fails after the fix).
- The lightbox's radius or child-scale correction needs more than one new mechanism. Report the size; don't
  drop the case.
- A part C GUARD (008's clone `&scroller` cases, the `pop-layout-scroll-siblings` clone cases) fails or drifts
  past its Step 1 value after part C is deleted, beyond ruling 5's paint-rule edit.
- A 015b or 016 GUARD from Step 1 fails (`presenceSiblingSnapshots.spec.ts`, the owned popLayout drift and
  scroll-siblings cases, the wait-mode `layout-button` / `layout-dependency` cases, the featureless-`m` specs).
- The fix needs `node_modules` patched, or an out-of-scope file (`PresenceChild.svelte`, `layout.ts`, R2,
  `layoutId.ts`, 015b's container regions, or `scrollBasis.ts` beyond its two in-scope changes).
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
- **015b's maintenance line becomes false after 012.** 015b's "Clone exits without `exit` are removed
  immediately, so they read as plain removals" no longer holds for `layout`/`layoutId` children: they are held,
  and their release is classified exit-complete. 012 doesn't edit 015b's plan; the dispatcher updates that line
  once 012 merges.
- **Optional comment-only touch.** The header comment of
  `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte` (about 37-48) still describes part
  C's hand-written follow ("so it never followed the layout move its element would have"). Updating it to say
  the re-homed node follows through projection is optional and not required by any Done criterion.
- **No z-index lift on held clones (ruling 5).** Held clones, `popLayout` ones included, paint in their own
  stacking order, as upstream (`PopChild.tsx:167-168 @ v14.7.1`, no z-index), so a later transformed sibling
  paints over them. Non-held clones (`?nolayout`, plain exits) keep the lift.
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
  - Held clones are sized from the last recorded computed size, not a live read. Their in-flow position comes
    from the placeholder read in the same pass.
  - **ResizeObserver blind spots.** The recorded size refreshes on ResizeObserver content-box changes and on
    animating frames. It does not refresh on padding-only or border-only changes, which leave the content box
    alone. Those are covered only when an attribute or style change re-snapshots the element. Out-of-flow
    elements with `auto` insets resolve to their static position, which can also go stale without a resize.
  - **No clones on `<body>` (10j; intended change).** A child with no connected slot parent, including when the
    boundary itself is torn down, no longer gets a clone appended to `document.body`. It is removed at once.
  - **Held clones are still absolutely positioned**, so they paint above non-positioned siblings that follow
    them in the slot. Upstream's real element stays in flow. This matches today's clones and is a kept
    structural deviation: an absolutely positioned stand-in is the only way to keep the slot (placeholder)
    without the real node.
  - `canHandOff()` relies on Svelte recomputing a destroyed `$derived` during teardown from dependencies that
    return their `old_values` (N7).
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

## Amendments

### A1 (2026-10-30, operator-approved)

Answers the Step 1 label STOP. Lane merge `a22c7332`; the Step 1 work stays uncommitted in the lane and
continues from there. Upstream behaviour comes from the React 18 + `framer-motion@14.7.1` repro
(`/tmp/fm1471-repro`: `src/lightbox.tsx`, `src/sharedpresence.tsx`, `m-012probe.mjs`). Where this amendment
and the body disagree, this amendment wins. Every change below is test-only. None changes library source.

**1. Item 2 (clone `closing then shrinks the card into thumbnail two`) asserts the held card.**
- Today it passes for the wrong reason. The card is removed on the next frame, and thumbnail two still grows out
  of the card's last box because 007 A1's departing-lead snapshot promotes it. The spec checks only thumbnail
  two's width.
- Add what upstream paints: after the close click, the card (or its exit clone) stays connected and painted
  while thumbnail two grows, and the two crossfade (the card's opacity falls from 1 towards 0 over the shared
  animation, and it is gone only after that animation ends). Judge it with `recordPainted` (screencast plus
  per-rAF `elementFromPoint`), not sampled rects alone.
- **RED** today: the card disappears at once. Keep the width assertion.
- Apply the same strengthening to the `(owned)` twin (item 4), whose label stays RED.

**2. Items 5b and 6b (owned) assert the release.**
- Today they pass by accident. The owned held `#shape-0` is never released: it is still mounted at opacity 0
  16 s after the click, with a 10 s transition. Upstream removes it when the shared animation ends (gone by
  about 11 s in the repro).
- Add a release check to 5b and 6b, using a short transition so the test stays fast: a page param
  `?duration=<s>` (default 10, as upstream) that changes only the shared-layout transition length. With
  `&duration=1`, `#shape-0` exists during the animation and is removed within 1 s after it ends
  (`expect.poll`, timeout `duration + 1` s). Keep 5b's verbatim mid-animation assertions on the default 10 s
  page.
- Also add the same release check to 5a and 6a (clone). It is RED today for the existing reason.
- **RED** (5b, 6b) today: `#shape-0` is never released. "Held forever" is a real bug that Step 4 fixes.

**3. Item 8, open half: 599.9994 × 399.9999 at (200.0003, 130.00005), against upstream's exact 600 × 400 at
(200, 130).**
- Before choosing, check the lightbox's computed `transform` once the open animation has finished.
  - If it is not `none` (a leftover scale or translate that upstream would have reset), it's a real bug. Keep
    the port's exact `expectBbox` values, and re-label the open half **RED**. Steps 4–5 fix it. If the fix is
    more than one new mechanism, STOP (as for the radius correction).
  - If it is `none` and the difference is only floating-point layout rounding, compare each `expectBbox` value
    with a ±0.01 px tolerance. Write a comment at the helper that cites this amendment, and keep the open half
    a **GUARD**.
- Report which branch applied and the measured transform.

**4. Item 8, close half.**
- Run it. If it fails for the stated reason (`#item-parent` stays hidden, or the lightbox is removed before the
  shared animation), it stays **RED**.
- If it passes today, strengthen it as in 1: assert from painted frames that the lightbox stays connected and
  painted while `#item-parent` grows, then is removed after the shared animation. Re-check that it is RED.

**5. Accepted test-side changes from Step 1.**
- The lightbox fixture uses `box-sizing: content-box`, as upstream's harness does, so its sizes match.
- 6a and 6b accept a single screencast frame when the frozen animation repaints nothing. The per-rAF
  `elementFromPoint` hits still apply to every frame.
- `src/routes/tests/layout-id/lightbox-crossfade/SingleImage.svelte` is in scope. `useIsPresent()` needs a
  component, and a snippet can't host it.

### A2 (2026-10-30, operator-approved)

Answers the Step 3 STOP. Steps 1–2 are committed (`30194916` = `RED_SHA`, `deed0e49`). The Step 3 work stays
uncommitted in the lane and continues from there. Where this amendment and the body disagree, this amendment
wins.

**1. The `?fixed` height-only resize case: the resize refresh is in scope.**
- The popLayout point cache misses a viewport resize, so 008's correction places the clone 180 px off
  (`style.top` 250px instead of 70px). Before 012 the clone faded in place. Now the re-homed node animates the
  misplacement. Upstream measures fresh on every resize.
- Keep the window `resize` refresh in `createPopLayoutPointCache` (`presence.ts`). Remove the `EXPERIMENT` marker
  and write it as production code, with a short comment and a unit case that is RED without it. The resize case
  (`pop-layout-scroll-siblings.spec.ts:476`) must pass on both syntaxes.
- This is the only change to the cache. Anything more is a STOP.

**2. 3d-i: the ~2 px step at removal is not accepted.**
- Upstream never swaps the element, so the interrupted enter continues with no step. Time-box this to about two
  hours. Try these in order, and stop at the first one that works:
  a. Move the element's running WAAPI animations to the clone, including the transform ones: take them from
     `element.getAnimations()` and set `effect.target = clone`, so you don't need Motion's private map. Check that
     Motion's later `stop`/`cancel` still reaches the moved animation (no orphaned animation, and no double
     animation when the clone's node animates).
  b. Otherwise, when the transform moves to the main thread, seed the main-thread animation from the WAAPI
     animation's `currentTime` (or from the clone's computed transform on the removal frame), so the first
     main-thread frame continues from the last compositor frame.
- Pass: on every painted frame from removal to the end, the clone's box is within 0.5 px of the control's.
- If neither gets within 0.5 px, STOP and report the closest result with its frames. Don't loosen 3d-i.

**3. Reverse handoff inside a translated layoutRoot (clone path, `offset=true`): root-cause it now, in Step 3.**
- This is a GUARD that passed at `RED_SHA` and now fails: the lead starts 50 px into its slide instead of 100.
- Find the cause before Step 4. The likely place is the re-homed node's snapshot or the clone's placement under a
  transformed ancestor; 008's correction and the root offset may be applied twice or not at all.
- Fix it inside 012's design. It must pass unchanged. If the fix needs a new mechanism outside the listed
  in-scope files, or if upstream measurably does the same thing (check in the repro at 4224), STOP and report
  first.

**4. Accepted from the Step 3 report.**
- The held clone is inserted where Svelte removed the element, using the structure observer's removal records
  (needed for `{#key}` paint order).
- The release runs in its own microtask, not inside motion-dom's `microtask` batch.
- Part C, `seenScrollBasis` and 015a's 6a–6c are deleted in Step 3; 10g-i and 10g-ii replace 6b and 6c. The
  body-fallback unit test is rewritten for 10j.
- `recordPainted` samples after each frame's rAF callbacks (ResizeObserver sentinel). The 3d-i control uses
  `onUpdate` only if the approach in 2 still needs it.
- The test fixes in NC3–NC6: the `&` URLs, NC3's dot reading (the repro's `src/nested012.tsx` paints the dot fixed
  until release), the logged computed values, and timing from the removal frame.
- Exit-complete-once `(owned)` failing in Step 2 is recorded. Step 4 must make it pass.

### A3 (2026-10-31, operator-approved)

Answers the guard's PASS-with-nits on `6c6ff86d`. The operator checked `tests/layout/group` live: both strips
slide and crossfade within their own strip, and no underline crosses strips. Where this amendment and the body
disagree, this amendment wins.

**1. `e2e/layout/group.spec.ts` is in scope for one stale-test edit.**
- "sibling LayoutGroups do not bridge a shared layoutId across the page" fails with a strict-mode error, because
  during the crossfade the held old underline and the new one share `data-testid`. Upstream holds both too.
- Read the newest underline in document order (`.last()`) for both `strip-a-underline` (`:55`) and
  `strip-b-underline` (the sampling loop), as the #1935 cases do. Add a comment citing this amendment. Don't
  change the thresholds or the sampling.

**2. New case: crossfade interrupted mid transform-enter (guard nit 3). Red first.**
- Risk: upstream's `willUpdate` demotes the exiting node's compositor transforms to the main thread, looking
  them up by `node.instance` (`create-projection-node.ts:129-131, 744-750 @ v14.7.1`). After the re-home the
  instance is the clone, and `presence.ts` re-attaches the moved transform animation after the read. So a held
  `layoutId` clone interrupted mid transform-enter may keep its compositor transform over the crossfade.
- Add a fixture to an existing in-scope page (preferably `presence-crossfade` or `layout-root`, behind a page
  param): a `layoutId` underline or shape with `initial={{ scaleX: 0 }}` (or a scale enter), switched mid-enter.
  Measure the same case in the repro at 4224 frame by frame first, and assert what upstream paints, on every
  painted frame (`recordPainted`), on both syntaxes. Record whether it's RED on `6c6ff86d`.
- If it's RED, fix it within 012's design. The likely fix is to demote or stop the moved transform animation
  when the projection node takes over. More than one new mechanism is a STOP.

**3. Root-cause the load-dependent drift (guard nit 1).**
- `e2e/animate-presence/pop-layout-container-move.spec.ts:290`, the "(owned) … transform-centred container"
  case, drifted 38.86 px (limit < 1 px) in the full guard set, and passed 12/12 alone.
- Find out why. Run it under load (the full guard set, or `--workers` high with `--repeat-each`). If the drift
  comes from 012's owned flip, its queued commit or the release microtask, fix it. If it reproduces on
  `a22c7332` (before 012), report it with evidence and leave it. Don't loosen the limit or add retries.

**4. Accepted guard notes.**
- The `rememberLayoutBox` keeps-transforms flag change in 015a's `refreshLayout` and `measurePageRect`
  (`motionDomProjection.ts:792, :1585`) is accepted as A2.3's fix.
- Moved animations run to their natural end on a released clone, as upstream's detached element does.
- The removed per-frame `card painted` check in `open-change.spec.ts` is accepted: the new lead paints over the
  held card, as upstream does. Held count, the fall in opacity and the removal timing still enforce A1.1.

**5. Then re-run the plan's guard set with its exact command and report its totals.**

### A4 (2026-10-31, operator-reported at sign-off)

The operator found a bug while signing off `tests/layout-id/lightbox-crossfade` (lane `77a43596`): **open red → close
→ open red → close breaks on the second close.** The first cycle is right, and so is the second open. Measured per rAF
on the dev server (human mode, 1.5 s, owned syntax):
- At the second close the held card (`#parent`) jumps on the first frame to `160,402 2000×276` and animates from
  there to its own open box (`600×400` at `660,340`), instead of following `#item-parent` (which correctly grows back
  from `600×400` to `180×580`). The held dot (`#child`) is `167×34` instead of following `#item-child`.
- The first close of the same page load follows the item exactly on every frame.

This is a 012 defect: the owned held/relegate state from the first exit cycle leaks into the second. Red first:
1. Add to `e2e/layout-id/lightbox-crossfade.spec.ts` a painted case (`?duration=1`): open, close, open, close. On
   every frame of the **second** close, the held card's rect matches `#item-parent`'s within 1 px (as on the first
   close), and the held dot follows `#item-child`. It must be RED on `77a43596`.
2. Add the same two-cycle check on the clone syntax (`nested-crossfade`, and `presence-crossfade`'s cycle if
   relevant) and on `open-change` (owned and clone), and record whether each is RED.
3. Find the root cause (state not reset between exit cycles: the release latch, the relegate/promote record, the
   cached snapshot, the moved-animation record or the presence flip) and fix it inside 012's design. More than one
   new mechanism is a STOP.

### A5 (2026-11-01, operator-reported at sign-off; written 2026-11-03, operator-approved)

The operator found a bug while signing off `tests/layout-id/exit-complete-once` under StrictMode, frame by frame
against the framer-motion 14.7.1 repro: after "start 1", **the 2 → 3 hop jumps.** Upstream slides every hop
(4 → 2 → 3 → 4, each frame a few px from the last). Ours paints the box 3 measurer at box 3 on its first frame and
holds it there for the whole transition. Where this amendment and the body disagree, this amendment wins.

**1. Red first: lane `7164b6df`.** `e2e/layout-id/exit-complete-once.spec.ts`, "Every hop after start 1 slides from
the previous box", on both syntaxes (clone, and `(owned)` with `&owned=true`). It records the painted top of every
`[data-measurer]` per rAF and asserts that the measurer is painted between box 2 and box 3 after it reaches box 2.
The page gains a `data-measurer` attribute only. RED before the fix.

**2. Fix: lane `3d86198c`. Two causes, both on the 2 → 3 hop.**
- **Cause 1 (both syntaxes): a reflow restarted the shared animation from the cached layout.**
  - Box 4's held exit completes in the frame the box 3 measurer mounts. Its `onExitComplete` bumps `#done-count`,
    and the narrower glyph shifts the content by 1.33 px.
  - The box 3 node's ResizeObserver commit (`commitObservedLayoutChange`) seeded its snapshot from its cached layout
    rect (box 3), while the node was drawn at its projection target (box 2). The shared animation restarted with a
    zero delta.
  - Upstream's re-render snapshots live: `willUpdate` → `updateSnapshot` → `measure`
    (`create-projection-node.ts:967-979, 1080-1101 @ v14.7.1`), which is the on-screen box.
  - Fix: when `resumingFrom && currentAnimation && target`, `commitObservedLayoutChange` seeds from
    `onScreenSnapshot()` instead (`src/lib/utils/motionDomProjection.ts` ~2046-2055, with an upstream citation in
    the comment).
- **Cause 2 (owned path only): `PresenceChild` re-created a child that was already not present.**
  - The hydration-time `onMount` flip of box 1's `present` re-ran `PresenceChild`'s `{#if}` before its
    `$effect.pre` moved the phase to `holding`. The child was destroyed and re-created already not present.
  - That node never relegated or released. It stayed the measurer stack's present lead, every later hop resumed
    from its box 1 snapshot, and its element stayed in the DOM.
  - Upstream's `PresenceChild` renders its children through the flip (`PresenceChild.tsx:115-125 @ v14.7.1`).
  - Fix: `rendersChildren()` (`src/lib/components/PresenceChild.svelte` ~308-311, used at ~393). It also renders
    the children while an exit is about to start: the last seen `present` was `true` and the phase is still
    `idle`.

**3. Scope extensions (approved, for this change only).**
- `src/lib/components/PresenceChild.svelte` is lifted from **Out of scope**, and from the out-of-scope-file STOP
  condition, for the `rendersChildren()` change only. The rest of the file stays out of scope.
- `MotionDomProjectionAdapter.commitObservedLayoutChange` (`motionDomProjection.ts`) is added to the in-scope
  members, for the on-screen seed only.

**4. Known gap, recorded.**
- The cause 1 fix is narrowed to a shared animation in progress (`resumingFrom` set). Upstream's `willUpdate`
  always snapshots the on-screen box, so a node mid any layout animation measures where it is drawn. The general
  mid-animation case under `layoutScroll` is tuned by plan 015a (the `pop-layout-scroll-siblings` clamp test), and
  `3d86198c` leaves it as it was.
- **Follow-up A6 (pending):** a red test for the general mid-animation case (a reflow during a non-shared layout
  animation). If it shows a visible divergence from upstream, A6 adopts upstream (on-screen seed in every
  mid-animation commit). Otherwise the gap stays recorded here.

**5. Test-only work under A5 (done).**
- The per-box no-jump check landed in lane `02a3596f`. Each box is followed separately, so a held old box sitting
  still can't hide a jump by the new one. The "painted between box 2 and box 3" assertion is unchanged.
- Unit tests for both A5 changes landed in lane `e42d7a1b`. Both are RED on `3d86198c^`:
  - `src/lib/utils/motionDomProjection.spec.ts`: mid a shared (`resumingFrom`) animation,
    `commitObservedLayoutChange` seeds from the on-screen target box, ignoring the cached layout and the passed
    rect. Idle, it seeds from the cached layout. RED: "expected 100 to be 40".
  - `src/lib/utils/usePresence.spec.ts` with the new harness `src/lib/components/__tests__/MountFlipPresenceHarness.svelte`
    (both in scope under A5): `PresenceChild` keeps its children through a present → not-present flip made from
    an `onMount` before its phase effect runs. RED: "expected 2 to be 1" (the child mounted twice).

### A6 (2026-11-03, operator-approved under A5.4)

A5.4's follow-up probe is RED and shows a visible divergence from upstream. Under A5.4's approved clause, A6 adopts
upstream. Where this amendment and the body or A5 disagree, this amendment wins.

**1. Red first: lane `a938fd80`.**
- New page `src/routes/tests/layout/reflow-mid-animation/+page.svelte` (linked from `src/routes/+page.svelte`) and
  spec `e2e/layout/reflow-mid-animation.spec.ts`. All three files are in scope under A6.
- A plain `layout` box (no `layoutId`) slides 400 px over 1 s, linear. 400 ms in, its content grows from 50 to
  60 px, and its ResizeObserver commits the change through `commitObservedLayoutChange`.
- Ours: the container passes the cached rect (`rebasedLastRect()`, `_MotionContainer.svelte` ~2503, used ~3169),
  and the restart is seeded from it. The painted box jumps from 154 px to 399.6 px between frames 24 and 25 (a
  245.6 px step) and holds at the end slot.
- Upstream (repro mirror `/tmp/fm1471-repro-012`, `?test=reflowmid`, framer-motion 14.7.1) snapshots the painted
  box in `willUpdate` (`updateSnapshot` → `measure`, `create-projection-node.ts:967-979, 1080-1101 @ v14.7.1`). It
  slides on from 156 to 400 px with a max step of 7.2 px.

**2. Fix: widen A5's on-screen seed to any in-flight layout animation, as upstream.**
- In `commitObservedLayoutChange`, seed from `onScreenSnapshot()` whenever the node has a layout animation in flight
  (`currentAnimation` with a projection `target`), not only when `resumingFrom` is set. With no animation in flight,
  keep today's seed (the passed rect, else the cached layout).
- This closes A5.4's recorded gap. A5's comment at the seed must be updated to match, keeping its upstream citation.
- **In scope:** `src/lib/utils/motionDomProjection.ts`, `commitObservedLayoutChange` and what it calls for the seed
  (`onScreenSnapshot` and its rebase helpers). `motionDomProjection.spec.ts`: extend A5's
  `commitObservedLayoutChange` cases with a non-shared in-flight case, RED before the fix. No container change.
  Everything else stays out of scope.

**3. Done criteria.**
- `e2e/layout/reflow-mid-animation.spec.ts` passes.
- A5's specs and unit tests pass (`e2e/layout-id/exit-complete-once.spec.ts`, the `e42d7a1b` cases).
- The 015a GUARDs pass unchanged: `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` and
  `e2e/animate-presence/pop-layout-container-move.spec.ts` (baseline 69 passed, 1 skipped).
- The full 012 set passes unchanged: `e2e/layout/layout-root.spec.ts e2e/layout-id e2e/animate-presence` (baseline
  302 passed, 1 skipped).
- `e2e/layout` passes as a whole.
- `pnpm exec vitest run` passes.

**4. STOP.**
- A 015a `layoutScroll` case changes (fails, or drifts past its value from before A6). Report it with the measured
  values; don't retune it.
- The fix needs more than the widened gate in `commitObservedLayoutChange` and its seed helpers.

**5. Scope extension: the clone hand-off's scroll anchoring (2026-11-03, operator-approved under A5.4's "A6 adopts
upstream").** This answers the A6.4 STOP that the widened gate hit. The red unit case for A6.2 is lane `54e4b084`
("expected 100 to be 40"). The fix itself is uncommitted in `motionDomProjection.ts`.
- **What failed.** With the widened gate, `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts:453` (clone,
  `?layoutScroll`, "the clamp is a one-frame content jump") fails: blue never takes the 70 px clamp step. Upstream
  takes it at about 100 ms (React mirror `/tmp/fm1471-repro-012`, `?test=scrollsib&layoutScroll`).
- **Root cause: not the seed.**
  - The clone path's hand-off in `src/lib/utils/presence.ts` inserts the absolute clone and drops the original.
    The frame after the pop, that triggers a browser scroll-anchoring adjustment of +70 px (`#scroller`
    `scrollTop` 550 → 620).
  - Upstream keeps the real element, so the browser makes no adjustment.
  - A trailing observer commit then sees a phantom 70 px change on `sib-4`.
  - On the old gate, that phantom commit made orange (`sib-4`) snap instead of slide. This was an upstream
    divergence before A6, and no spec checked it: upstream's orange slides 330 → 254. The phantom commit also
    happened to produce the clamp jump that `:453` expects.
  - With `#scroller { overflow-anchor: none }` on the page, both gates match upstream frame for frame (`scrollTop`
    550; blue 120; green 260 → 183 → 191 → 190; orange 330 → 253 → 260). That confirms the cause.
- **In scope (added):**
  - The clone hand-off in `src/lib/utils/presence.ts`, only to stop the swap from producing a scroll-anchoring
    adjustment that upstream doesn't get (for example, suppress or compensate anchoring around the clone insert
    and the original's removal). It must be a library fix. A page-level CSS workaround (`overflow-anchor: none` on
    the test page) is not acceptable, because users' pages won't have it.
  - In `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`, on the **clone** `?layoutScroll` path only: a new
    or tightened assertion, judged from painted frames, that the item after green (`sib-4`, orange) slides rather
    than snaps (upstream 330 → 253 → 260, no one-frame step to its end slot), and that the scroller's `scrollTop`
    stays at upstream's 550 (no anchoring adjustment). It must be **RED on current code** before the fix.
- **Unchanged:** `:453` itself stays exactly as written. It is upstream-correct, and the fix must make it pass
  without editing it. The owned branches of the spec stay out of scope (GUARDs).
- **Done criteria (added to A6.3):** the new `sib-4` / `scrollTop` assertion passes, `:453` passes unedited, and the
  rest of A6.3 holds, including the 015a GUARD and 012 set baselines.
- **STOP (added to A6.4):** the anchoring fix changes any owned-path case or any case without a scroller (in
  `pop-layout-scroll-siblings.spec.ts`, `pop-layout-container-move.spec.ts`, the 012 set or `e2e/layout`). Report
  it with the measured values; don't retune. A6.4's `layoutScroll` STOP still applies to every other case.
