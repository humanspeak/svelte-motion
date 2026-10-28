# Plan 015a: Cached layouts survive scrolls, fixed and sticky ancestors, and resizes; layout exit clones follow the layout move

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, report to the dispatcher; lanes never edit the batch README.
>
> **Never use `git stash`.** **Port 4223** (`PW_PORT=4223` on every Playwright command). Never use or kill port
> 4198. Never set `PW_REUSE_SERVER`.
>
> **First of three plans split from the old 015.** 015b and 015c build on this one.
>
> **Requires 006 (A1, merged at `3365c175`), 007 and 008 (with A1–A3 and the A2 fix `c817fe6e`) all merged
> into `feat/motion-14.7.1`.** Don't start this plan before 007 and 008 are both merged into the feat branch.
> Confirm each command prints at least one line, otherwise STOP:
> - `grep -n "takeOverLiveLeadOnMount" src/lib/utils/motionDomProjection.ts`
> - `grep -n "layoutRoot?: boolean" src/lib/types.ts`
> - `grep -n "schedulePopLayoutCorrection" src/lib/utils/presence.ts`
> - `grep -n "Plan 015" e2e/animate-presence/pop-layout-container-move.spec.ts`
>
> **Re-pin the presence line numbers first.** Every `presence.ts`, `PresenceChild.svelte`, `AnimatePresence.svelte`
> and 008-spec line number below is cited at presence lane `6972dac3`, as "008's merge SHA (to be pinned)". Once
> 008 merges into feat, run `git log -1 --format=%h -- src/lib/utils/presence.ts` and re-locate each excerpt by its
> anchor at that SHA before you start. If an anchor is gone, STOP.
>
> **Drift check**:
> `git diff --stat 3365c175..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/presence.ts src/lib/html/_MotionContainer.svelte e2e/animate-presence/pop-layout-container-move.spec.ts src/routes/+page.svelte`
> 007 and 008 (and 013, if it merged first) are expected. Feat-branch line numbers are at `3365c175`;
> presence line numbers (marked "presence lane") are at `6972dac3`. Locate every excerpt by its anchor. If the
> content differs, STOP.

## Status

- **Priority**: P1 · **Effort**: M-L · **Risk**: MED. Every observed commit is rebased, so a sign or scale
  mistake makes elements inside scroll containers jump.
- **Depends on**: 006 + A1 (its `takeOverLiveLeadOnMount` reads `onScreenSnapshot()`, which this plan rebases),
  007, 008 (helpers, fixmes).
- **Wave**: 4, lane `siblings`, in parallel with 013.
- **Category**: bug (upstream parity)
- **Planned at**: `3365c175`, 2026-10-28. Split from the old 015 after round 3 of the cold review.

## Why this matters

svelte-motion diffs observed layout changes against **cached** page-space rects. Upstream reads live in
`willUpdate()`. Our caches go stale in three ways, and upstream's live reads never do:

- **A non-`layoutScroll` container scrolls.** The cache includes the old scroll, so on the clone path, items that
  never moved get 1392.4 px layout transforms (348.1 px at `scale(0.5)`). This is 008's clone `&scroller` case.
- **A fixed element's page box moves with window scroll** (upstream `measurePageBox`). Our cached fixed box goes
  stale, which gives a ~300 px phantom slide after a window scroll.
- **A viewport resize moves an element without resizing it.** Our cache goes stale, which gives a phantom x slide.

An exit clone also has no projection node, so it never animates the layout move its element would have animated
upstream. When a clamp moves the content, siblings slide but the clone jumps.

## Current state

### Upstream (`~/Github/motion`, `git show v14.7.1:<path>`)

All paths below are under `packages/motion-dom/src/projection/node/` unless shown in full.

- `create-projection-node.ts`:
  - `willUpdate()` (708-791) → `updateSnapshot()` (787 → 967-978) does a live `measure()`.
  - `measure()` (1080-1101) = `measurePageBox()` (1105-1124: viewport box + root scroll, unless a path node
    `wasRoot`), then `removeElementScroll()` (1126-1156: subtracts only `layoutScroll` path nodes).
  - `updateScroll()` (1022-1043) records offsets only for `layoutScroll` nodes.
  - Resize: the root's resize listener (511-532) compares `innerWidth` (523-528). Only a width change blocks
    updates, for 250 ms (`delay(resizeUnblockUpdate, 250)`; `isUpdateBlocked` 690). A blocked `update()`
    force-measures without animating (797-820).
  - Layout transition: `options.transition || visualElement.getDefaultTransition() || defaultLayoutTransition`
    (581-584), with `defaultLayoutTransition = { duration: 0.45, ease: [0.4, 0, 0.1, 1] }` (2546-2549), then
    `getValueTransition(…, "layout")` (626).
- `HTMLProjectionNode.ts:23-24`: a fixed element is a scroll root.
- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx`: `measureScale` (39-46), and
  `measurePoint` (63-80), which walks `parentElement || parentNode.host` and stops after a fixed ancestor.
- Consequences:
  - (i) A clamp in a non-`layoutScroll` scroller animates every node in it (`tests/react/issue-2348.spec.ts`).
  - (ii) With `layoutScroll`, the clamp is a one-frame content jump.
  - (iii) A fixed element's page box moves with window scroll.

### svelte-motion

- `src/lib/utils/motionDomProjection.ts` (`3365c175`):
  - `updatePathScroll` (1673-1685) re-reads the root and `layoutScroll` scroll on every read. So window scroll is
    already invariant for in-flow nodes, while fixed nodes and non-`layoutScroll` scrollers are unhandled.
  - Cache writes:
    - the `'measure'` listener (573) → `rememberLayoutBox` (1135);
    - `lastLayout` in `seedLayout` (823), `refreshLayout` (856), the grouped `'didUpdate'` listener (about
      586-609) and `refreshCachedLayout` (1687).
  - Cache reads:
    - `onScreenSnapshot()` (1462), which feeds `seedCachedSnapshotsForGroup()` (1423), `seedOwnOnScreenSnapshot()`
      (1444) and `commitGroup` (1254);
    - `seedCachedSnapshotsForSubtree()` (1504);
    - `commitObservedLayoutChange()` (1202, via `measurementsFromRect` at 154);
    - `currentVisualPageRect()` (1048). Its base is `visualTargetBox()` (1122), `latestLayoutBox` or `lastLayout`;
    - 006's `takeOverLiveLeadOnMount`;
    - 007's new unmount seed (layoutid lane, not yet merged). It reads `visualTargetBox`, `latestLayoutBox` and
      `lastLayout`; locate it by content once 007 merges.

    None of them rebases.
  - The adapter registry is `private static adapters = new WeakMap<object, MotionDomProjectionAdapter>()` (306),
    keyed by **projection node**. Nothing can look up an adapter from an element.
  - `refreshCachedLayout`'s deferred rAF write (1695-1705) copies `projection.layout` into `lastLayout` again, a
    frame later.
  - **Measurement keeps user-authored transforms; upstream doesn't** (found by 007's executor).
    - `stripToBaseTransforms` resets each element to its *user-authored* base transform for the read.
    - Upstream's `resetTransform` (`create-projection-node.ts:1046-1076`, via `HTMLProjectionNode.ts:20-22`) writes
      `none` (or the `transformTemplate` value). Upstream `measure()` (1080-1101) and `removeTransform()` (1200)
      then remove `latestValues` transforms by calculation.
    - `currentVisualPageRect()` adds the node's and its ancestors' `latestValues` transforms back on top through
      `applyTransform(box, true)`. So an ancestor's translate, or the element's own `x`, ends up applied twice.
    - 007's executor saw the `layoutRoot=false&offset=true` handoff start at 500 instead of 400.
- `src/lib/html/_MotionContainer.svelte` (`3365c175`):
  - `lastRect` is declared at 2192 (anchor `let lastRect: RectLike | null = null`). `observerRestartRect` follows
    it.
  - `runReactiveCommit` 2327-2403 writes `lastRect = next` at 2363.
  - The observer region is 2596-2925:
    - `suppressObservedLayoutCommit` (2596-2624) writes at 2601 and 2617.
    - Other `lastRect`/`observerRestartRect` writes are at 2632-2633, 2647, 2654 (`refreshLayout()`), 2692,
      2730, 2805, 2856, 2860, 2904 and 2917-2919.
    - The restart commit is 2663-2674.
    - `commitObservedLayout` is 2720-2780 (`const previous = lastRect` at 2729).
    - 013's `setCompositorHints` lines are 2675 and 2920-2922. They are not this plan's.
  - `data-layout` / `data-layout-id` are spread at 1659-1662. `cloneNode` copies them onto exit clones.
- `src/lib/utils/presence.ts` (presence lane):
  - `canElementScroll`, `captureScrollSnapshot`, `measureScrollDelta` and `translateRectByScrollDelta` are at
    799-858 (008's merge SHA, to be pinned; `6972dac3`). `canElementScroll` matches `/(auto|scroll|overlay)/` against `overflow + overflowX + overflowY`,
    because jsdom computes `overflowX`/`overflowY` as `visible` for `overflow: auto`.
  - `unregisterChild` inserts the clone (`slotParent.insertBefore(clone, …)`), calls
    `schedulePopLayoutCorrection`, and starts the exit on the next rAF: `animate(clone, exitKeyframes,
    finalTransition)`.
  - `measurePopLayoutScale` is upstream's `measureScale` (read at 486-487).
  - The 008 correction scheduler `schedulePopLayoutCorrection` is at about 716-736.
  - 008's A2 resting-point cache (`createPopLayoutPointCache`, about 579) has a `ResizeObserver` on
    `documentElement` (649-668). It is tracked for every popLayout child (1540-1543), and it reads item rects
    through `measurePopLayoutPoint`.

### 008's fixmes and baselines

`e2e/animate-presence/pop-layout-container-move.spec.ts`, presence lane:
- about line 126: `test.fixme(path === 'owned', …)` (same-render);
- about line 166: `test.fixme(query.includes('&scroller'), …)`. It sits inside the loop over the `&scroll`,
  `&scroller` and positioned-scale queries.

| Case | clone | owned |
| --- | --- | --- |
| scrollable element clamp | 1392.4 px (this plan) | 50.9 px (015b; **to re-baseline** after 008's A2 fix) |
| positioned scrollable element in `scale(0.5)` | 348.1 px (this plan) | 12.7 px (015b; **to re-baseline**) |

±10% counts as the same failure.

### Conventions

- Pages:
  - `src/routes/tests/<area>/<name>/+page.svelte`; specs in `e2e/<area>/<name>.spec.ts`.
  - Signal readiness with `window.MotionIsMounted`.
  - `TesterPanel` from `src/routes/tests/layout/_parity/TesterPanel.svelte`, hidden under `?@isPlaywright=true`
    (exemplar `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`).
- Exemplars: painted frames `e2e/independent-transforms/speed-change.spec.ts:226-280`; read counts
  `e2e/layout-id/read-budget.spec.ts:17-38`.
- Unit tests:
  - Run in jsdom. `scrollTop` is writable. Window scroll is `document.documentElement.scrollTop = n` plus a
    `scroll` event on `document`, since jsdom doesn't implement `scrollTo`.
  - Define `offsetWidth`/`offsetHeight` with `Object.defineProperty`.
  - Exemplar: the plan-007 Step 4b `mount` helper in `src/lib/utils/motionDomProjection.spec.ts`.
- Cite upstream as `file:line @ v14.7.1`. Every new export gets Google-style JSDoc.

## Design

**Bounds.**
- No layout read per frame, per scroll event, or across the whole tree.
- Mount: one forced style recalc per layout element (the ancestor walk is memoized per element).
- Tracker resample: reads `scrollLeft`/`scrollTop` only. On a `scroll` event it reads the target; on
  `pointerdown`, `keydown` or `click` it reads every connected known container. "Known" means every scroller on
  the path of any measured node, `overflow: hidden` ones included, so it can be more than a few on pages with
  clipping wrappers. That's O(known containers) scroll-offset reads per input event, with no rect reads.
- Resize: exactly one refresh read per mounted layout node, after the last viewport size change (the refresh hands
  its rect to the container, so no second read). This is the **one deliberate whole-tree read**: once per resize
  gesture, never per frame. It is exempt from the full-tree STOP, as upstream re-measures after its resize block
  too (`create-projection-node.ts:797-820`).

### A. Scroll basis

New module `src/lib/utils/scrollBasis.ts`. It also absorbs `presence.ts` 799-858, and `presence.ts` imports those
helpers from it unchanged. `captureScrollSnapshot`'s `canScroll` size test (`scrollHeight > clientHeight + 1`,
`presence.ts:799-807`) and its reads stay as they are. Only `getScrollAncestors` uses the size-free rule.

Exports, all with Google-style JSDoc: `ScrollBasis`, `getScrollAncestors`, `readScrollBasis`, `seenScrollBasis`,
`scrollDelta`, `scrollShift`, `scheduleResample`, `measureScreenScale` and `isResizeBlocked`, plus the four moved
helpers.

- **`getScrollAncestors(element)`** returns `{ scrollers, fixed, sticky }`.
  - Walk `parentElement || (parentNode as ShadowRoot).host` (`PopChild.tsx:63-80`).
  - A scroller is any element whose `overflow + overflowX + overflowY` matches `/(auto|scroll|hidden|overlay)/`.
  - Exclude the root scroller, `const root = document.scrollingElement ?? document.documentElement`. Exclude
    `html` and `body` only when they are `root` or have `overflow: visible`, so a body scroller under
    `html { overflow: hidden }` counts.
  - `fixed`: the element or an ancestor is `position: fixed`. The walk stops after it.
  - `sticky`: a `position: sticky` node exists between the element and the outermost scroller. **This includes
    the element itself**: a sticky element's box doesn't move with its scroller's offset, so the basis can't
    model it.
  - Computed style is memoized per element.
- **Folded-in containers are decided at read time.** Reads take a predicate `isFoldedIn(container)`.
  - The adapter passes `c => this.projection.path.some(n => n.options.layoutScroll && n.instance === c)`.
  - **Element registry (B2).** Add a second `private static byElement = new WeakMap<Element, MotionDomProjectionAdapter>()`.
    Set it in `mount()`, clear it in `unmount()`.
  - Add a public `static foldedInFor(el: Element)`. It walks `el` and its ancestors (crossing shadow hosts) to the
    nearest registered adapter, and returns that adapter's predicate over its path **plus its own node**. It also
    returns `{ wasRoot }`, true when any of those `layoutScroll` nodes `scroll.wasRoot`. With no adapter it returns
    `() => false` and `wasRoot: false`.
  - The clone path uses `foldedInFor(slotParent)`. This is **load-bearing** for 008's "fixed container stays put
    when the page's scroll position is clamped" case (`&fixed&anchor=bottom&scroll&mirror&layoutScroll`) and for
    the `?layoutScroll` GUARD. Without it, the clone would treat a `layoutScroll` list as an ordinary scroller and
    animate the clamp.
- **Root term.** When `fixed` is set and the predicate's `wasRoot` is false, add `root` with sign +1
  (`measurePageBox`). Scrollers have sign −1.
- **Tracker.**
  - `seen: WeakMap<Element, [x, y]>` holds the pre-change scroll. `known: Set<Element>` is its iterable companion,
    pruned when a container disconnects.
  - `epoch` increments on every resample.
  - Resample sources:
    - a passive capture `scroll` listener on `document` (resamples the target);
    - passive capture `pointerdown`, `keydown` and `click` on `window` (resample every known container). Browsers
      fire `scroll` at the next rendering opportunity, so these catch a programmatic scroll followed by an
      input-driven change in the same frame.
    - `scheduleResample()`: one `microtask.postRender` after a pass that rebased something.
- **Resize** (M7).
  - On any `resize` where `innerWidth` or `innerHeight` changed, increment `resizeEpoch` and re-arm a 250 ms
    timer. When it fires, every registered adapter refreshes silently: `refreshLayout({ silent: true })`, then
    `onCacheRefresh(rect)` hands the rect to its container.
  - Only an `innerWidth` change sets `isResizeBlocked()` until the timer fires (`create-projection-node.ts:523-528`).
    While blocked, a container commit refreshes silently instead of animating, which is upstream's blocked update.
- **`ScrollBasis`** = `{ scrollers, values, epoch, resizeEpoch, fixedRoot, unreliable }`. It is read live right
  after each layout read. `unreliable` is the `sticky` flag.
- **`scrollDelta(from, to, isFoldedIn)`** is pure: `Σ sign · (to − from) · scale`. Scale is
  `measureScreenScale(container)` (upstream `measureScale`), read only for terms that changed.
- **`scrollShift(basis, isFoldedIn)`**:
  - `null` if the basis is `unreliable`, or `basis.resizeEpoch !== resizeEpoch`;
  - `{0, 0}` if `basis.epoch === epoch`. The read came after the last resample and is post-change. This is the
    phantom-shift fix.
  - otherwise `−scrollDelta(basis, seen, isFoldedIn)`.
  - It makes zero reads when the basis has no terms.

### C. Clone layout-follow (layout clones only)

- Applies only to clones matching `[data-layout], [data-layout-id]`. A non-layout exit moves with the content,
  as it does upstream.
- At the start of `unregisterChild`, take `preBasis = seenScrollBasis(slotParent)`. No reads.
- After `schedulePopLayoutCorrection` (or right after the insert), queue one `microtask.read`. In it:
  - `move = scrollDelta(preBasis, readScrollBasis(slotParent), isFoldedIn)`;
  - `from = move` (A2: raw screen move, no scale division; A1: sign corrected; the clone must start where it was
    before the content moved). The 008 clamp gives `y: [-70, 0]`.
- `layoutTransition = getValueTransition(t, 'layout')`. `t` is `child.mergedTransition` when it is defined and has
  keys, otherwise a local `defaultLayoutTransition` (cite 581-584, 626, 2546-2549).
- **One animation.** When `move` is non-zero, start the exit in this microtask, not on the rAF, as a single
  `animate(clone, { ...exitKeyframes, x: [fromX, 0], y: [fromY, 0] }, { ...finalTransition, x: layoutTransition, y: layoutTransition })`.
  - Cancel the rAF. Keep `resolveExit(getCustom())`, `startExit()`, `activeExit.base` (now including `x`/`y`) and
    the completion wiring.
  - If the exit animates `x` or `y` itself, that track becomes `[from + current, target]`.
  - When `move` is zero, nothing changes.
  - One call keeps Motion's single grouped `transform` animation, so the follow can't fight the exit's `scale`.
  - Starting in the microtask aligns it with the siblings' projection animations.

### Where the rebase happens (M5)

Rebase in **exactly one place** per rect:
- **The adapter rebases its own caches**: `lastLayout`, `latestLayoutBox`, the target box, and 007's unmount seed.
  - `lastLayoutBasis` is copied from the `'measure'` stamp of the box that produced `projection.layout`, and
    nothing else ever re-reads it. `refreshCachedLayout`'s deferred write (1695-1705) copies that same stamp
    alongside the box.
- **The container rebases `lastRect`** with `rebaseRect(lastRect, lastRectBasis)`, then passes the already-rebased
  rect to `commitObservedLayoutChange` **without** `previousBasis`.
- `previousBasis` exists only for callers that hold a **raw** rect (none in this plan, apart from unit 3c).

### Measurement transforms (from 007)

`currentVisualPageRect()`, and every cached box that `applyTransform` is later applied to, must measure the
element the way upstream does: with transforms reset to `none` (or the `transformTemplate` value) during the read,
as `resetTransform` (1046-1076) does.
- Change `stripToBaseTransforms`'s base for these reads to upstream's `'none'`/template value. The user-authored
  transform is restored afterwards, as today.
- The `latestValues` transforms are then removed by calculation (`removeTransform`, 1200) and added back once by
  `applyTransform`.
- If `layoutMeasureStats`, a Reorder spec or the drag specs depend on the old base, STOP and report. Don't widen the
  change.
- This change is pending operator approval of 007's A1. If the dispatcher says 007 A1 was rejected, skip this
  subsection and its two RED cases, and report that you did.

### How this interacts with 006 A1

A1's `takeOverLiveLeadOnMount` calls `onScreenSnapshot()`, which becomes rebased. Nothing else in A1 changes. No
node animates twice: `create-projection-node.ts` has the `updateScheduled` guard at 881-886 and the repeat guard
at 825-828.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Lane | `git -C /Users/jasonkummerl/Github/svelte-motion-1471 worktree add /Users/jasonkummerl/Github/svelte-motion-1471-siblings -b lane/1471-siblings feat/motion-14.7.1`, then `pnpm install --frozen-lockfile` in `/Users/jasonkummerl/Github/svelte-motion-1471-siblings` | exit 0 |
| Unit | `pnpm exec vitest run <path>` / `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4223 pnpm exec playwright test <paths>` | as each step states |
| Build | `pnpm build` | exit 0 |
| Lint | `trunk fmt <files>`, then `trunk check <files>` | no new issues |

## Scope

**In scope** (these only):

- `src/lib/utils/scrollBasis.ts`, `src/lib/utils/scrollBasis.spec.ts` (create)
- `src/lib/utils/motionDomProjection.ts`:
  - basis stamps and rebases;
  - `lastReadScrollBasis`;
  - `rebaseRect` (a `null` rect gives `null`);
  - `commitObservedLayoutChange`'s `previousBasis` option;
  - `onCacheRefresh`;
  - resize registration;
  - the element registry (`byElement`, set and cleared in `mount`/`unmount`) and `static foldedInFor`;
  - the measurement-transform base in `stripToBaseTransforms` (see "Measurement transforms");
  - the rebase in 007's unmount seed.

  Plus `motionDomProjection.spec.ts`, new `describe`s only.
- `src/lib/html/_MotionContainer.svelte`, these regions only (lines at `3365c175`):
  - R1: 2192-2194: `lastRectBasis`, `observerRestartBasis`, `setLastRect`.
  - R3: 2363.
  - R4: in 2596-2925, every `lastRect`/`observerRestartRect` write listed above, the rebase of `previous` in the
    restart commit and in `commitObservedLayout`, an `onCacheRefresh` subscription, and the
    `isResizeBlocked()` silent-refresh branch.

  **Not** 2675 or 2920-2922 (013's).
- `src/lib/utils/presence.ts`:
  - delete 799-858 and import those helpers from `scrollBasis.ts`;
  - `unregisterChild` (part C);
  - the `ActiveExit` type;
  - cancel and cleanup sites;
  - `measurePopLayoutScale` delegates to `measureScreenScale`.

  Plus `presence.spec.ts`, new cases only.
- `e2e/animate-presence/pop-layout-container-move.spec.ts`: change only the `&scroller` fixme condition, as in
  Step 1.1.
- `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte` (create),
  `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `.changeset/scroll-rebased-layouts.md` (create)

**Out of scope**: `layout.ts` (015b's), `PresenceChild.svelte`, `AnimatePresence.svelte`, `LayoutGroup.svelte`,
other plans' container regions, `commitPresenceLayoutRelease`, `measureRect` in `layout.ts` (dead outside specs),
docs, `package.json`.

## Considered and rejected

- **A live tree-wide `willUpdate` on every change.** On the clone path the DOM has already changed by then.
- **Treating every scroller as `layoutScroll`.** That would make siblings jump instead of animating, which
  contradicts consequence (i).
- **Refreshing caches on every scroll frame.** That costs N reads per frame.
- **Two `animate()` calls on the clone.** They would fight over the grouped `transform` animation.

## Git workflow

- Lane `lane/1471-siblings` at `/Users/jasonkummerl/Github/svelte-motion-1471-siblings`. Do not use
  `isolation: 'worktree'`.
- One conventional commit per step, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Record the Step 1 commit SHA.** The done criteria use it.
- Do NOT push.

## Steps

### Step 1: Red tests and guards

Label every case **RED** (fails today) or **GUARD** (passes today and must keep passing). Record each outcome. If a
label doesn't hold, STOP.

1. **008's spec.** Change only the about-line-166 call, inside the `&scroll` / `&scroller` / positioned-scale loop,
   to `test.fixme(path === 'owned' && query.includes('&scroller'), 'Plan 015b: owned siblings take no snapshot')`.
   Keep its comment, updated to point at 015b.
2. **`scrollBasis.spec.ts`.** All of these are **RED** because the module is missing:
   - 2a: `overflow:auto` is detected through the shorthand (jsdom reports `overflowX`/`overflowY` as `visible`).
   - 2b: `hidden` is included; `visible` is excluded.
   - 2c: the root scroller (`document.scrollingElement ?? document.documentElement`) is excluded. Stub
     `scrollingElement` both as `documentElement` and as `null`.
   - 2d: a body scroller under `html { overflow:hidden }` is included. Stub `scrollingElement` as
     `documentElement`.
   - 2e: a fixed element or fixed ancestor sets `fixed` and stops the walk.
   - 2f: a sticky node below the scroller sets `sticky`, and so does a sticky element itself.
   - 2g: the walk crosses a shadow `host`.
   - 2h: `isFoldedIn` is read at read time (flipping it between two reads changes the result).
   - 2i: `seen` updates on a `scroll` event.
   - 2j: `seen` updates on a `document` `click` with no scroll event.
   - 2k: `scrollDelta` from 0 → 500 is 500.
   - 2l: it is 250 when `getBoundingClientRect().height` is half of a defined `offsetHeight`.
   - 2m: the fixed root term has sign +1, via `documentElement.scrollTop`, with `scrollingElement` stubbed.
   - 2n: a same-epoch basis gives a `{0, 0}` shift.
   - 2o: an unreliable basis gives `null`, and so does a stale-`resizeEpoch` basis.
   - 2p: a basis with no terms makes no `getBoundingClientRect` calls.
   - 2q: with fake timers:
     - a width change makes `isResizeBlocked()` true for 250 ms and fires the refresh callbacks once;
     - a height-only change fires them but doesn't block.
3. **`motionDomProjection.spec.ts`**, `describe('… scroll-rebased snapshots (plan 015a)')`:
   - 3a **RED**: after a scroller scrolls 0 → 500, `commitGroup` seeds the rebased (−500) snapshot.
   - 3b **RED**: the same for `currentVisualPageRect()`.
   - 3c **RED**: the same for `commitObservedLayoutChange(prev, { previousBasis })`.
   - 3d **RED**: a fixed element after a window scroll of 300 is rebased by +300.
   - 3e **GUARD** (phantom tripwire): after a clamp (500 → 430, no scroll event), a pre-change commit A and then a
     post-clamp commit B in the same task. B's snapshot equals its rect, and each node's `animationStart` fires at
     most once. This passes trivially today; it is the check that a rebase without epochs would fail.
   - 3f **GUARD**: a node on a sticky path keeps its unrebased cache.
   - 3g **GUARD**: with no scrollers, `expect(adapter.lastReadScrollBasis).toBeFalsy()`.
   - 3n **RED** (`foldedInFor` missing): for an element inside a mounted `layoutScroll` adapter's element,
     `MotionDomProjectionAdapter.foldedInFor(el)` folds in that container. After unmount it no longer does.
   - 3o **RED** (from 007): the registry-fallback handoff rect (`currentVisualPageRect()`) of an element inside an
     ancestor with `style="transform: translateX(100px)"` equals the element's on-screen box. Today the translate
     is counted twice, 100 px too far.
   - 3p **RED** (from 007): the same check for an element with its own `x: 100`.
4. **`presence.spec.ts`**:
   - 6a **RED**: a `data-layout` clone in a scroller tracked at 500, `scrollTop = 430` before draining, the clone
     mocked 70 px lower. `animate` is called once, before any rAF, with `expect.objectContaining({ y: [-70, 0] })`.
   - 6b **GUARD**: a non-layout clone gets no follow; its exit still starts on the rAF.
   - 6c **GUARD**: with no scroll change there is no follow.
5. **Page and spec** (see Test plan). Run them.

**Verify**:
- Every label above holds.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts`: exactly the
  **two clone `&scroller` cases** fail, within ±10% of 1392.4 and 348.1 px. Everything else passes or is `fixme`.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`: exactly the
  cases marked RED in the Test plan fail.

Commit, and record the SHA.

### Step 2: `scrollBasis.ts`

Implement Design A with JSDoc. The header cites `PopChild.tsx:39-46, 63-80` and
`create-projection-node.ts:511-532, 523-528, 690, 797-820, 1022-1043, 1105-1156`. Move the four helpers out of
`presence.ts`. Make `measurePopLayoutScale` delegate to `measureScreenScale`. Do not import from `presence.ts`
(that would be a cycle).

**Verify**: 2a–2q pass. In `presence.spec.ts`, only 6a fails.

### Step 3: Rebase the adapter's caches

1. Stamp the basis in the `'measure'` listener and in `rememberLayoutBox`, and set `lastLayoutBasis` at every
   `lastLayout` write.
2. Add a private `rebaseMeasurements` (`translateAxis`, following the pattern of `shiftFollowingDescendants` at
   1481). Apply it in `onScreenSnapshot`, `seedCachedSnapshotsForSubtree` and `currentVisualPageRect`. A `null`
   shift keeps today's cache.
3. Add the public members, resize registration, and `scheduleResample()`.

**Verify**:
- 3a–3g and 3n–3p pass. Every existing `motionDomProjection.spec.ts` block passes.
- **M6**: re-run the new spec's owned `?layoutGroup` sync-completion case. Step 3's `onScreenSnapshot` rebase is
  what should fix it (`commitGroup` reads `onScreenSnapshot`). If it still fails, record the timing: did the
  postRender `commitGroup` land after the clamp's `scroll` event? Then move the case to 015b's list in your report.
  This is not a STOP.

### Step 4: The container uses rebased rects

1. Add `setLastRect`. Route every `lastRect`/`observerRestartRect` write through it, carrying the basis.
2. Rebase `previous` before `hasRectChanged`, `isFollowingAncestorUpdate`, `emitProjectionUpdate` and
   `computeFlipTransforms`.
3. Subscribe to `onCacheRefresh` (`setLastRect(rect)`), and refresh silently while `isResizeBlocked()`.

**Verify**:
- `grep -nE "\blastRect = " src/lib/html/_MotionContainer.svelte` matches only inside `setLastRect`. The
  declaration `let lastRect: RectLike | null = null` doesn't match this pattern.
- `pnpm check` → 0 errors.
- `PW_PORT=4223 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`:
  - **expected failures**: exactly the two clone `&scroller` cases and the new spec's clone clamp case. They need
    Step 5's clone follow (the clone still jumps while siblings animate, `presence.ts:716-736`).
  - the owned `&scroller` and same-render cases are still `fixme`;
  - everything else passes.

### Step 5: Clone follow (part C)

Implement it in `presence.ts`.

**Verify**: 6a–6c pass. The two 008 clone clamp cases pass, and the new spec's clone cases pass.

### Step 6: Guards, changeset, gate

1. Run:

   `PW_PORT=4223 pnpm exec playwright test e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/drag e2e/animate-layout e2e/projection/scroll-during-layout.spec.ts e2e/projection/sibling-swap.spec.ts e2e/projection/nested-ancestor.spec.ts e2e/independent-transforms/layout-rotating-3d.spec.ts`

   Expected: all pass, except 008's three remaining owned `fixme`s, which are reported as skipped. No read budget
   may be raised. Re-run a failing spec alone once.
2. `.changeset/scroll-rebased-layouts.md` (patch):

   > Layout animations stay correct after scrolling or resizing: cached layouts now account for scroll containers
   > that aren't `layoutScroll`, fixed elements on a scrolled page, and window resizes, so changing a list after
   > scrolling no longer makes its items jump by the scroll distance. A `layout` element's exit clone now moves
   > with the content when a `popLayout` exit clamps the scroll position, as in Motion.

3. Gate:
   - `trunk fmt` then `trunk check` on the changed files;
   - `pnpm check`;
   - `pnpm test:only`;
   - `pnpm build`;
   - the Step 6.1 set;
   - `git status` shows only in-scope files.

## Test plan

- **Page** `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`. 015b extends it later.
  - Header comment cites #2348, `create-projection-node.ts:1105-1156, 511-532` and plan 015a.
  - Params: `path=owned|clone`, `mode=popLayout|sync`, `layoutScroll`, `layoutGroup` (wraps the whole list in a
    `LayoutGroup`), `fixed`, `sticky`, `nolayout`.
  - Default `mode` is `popLayout`. `?fixed` and `?sticky` use the default `popLayout` unless the case says `sync`.
  - **x metric**: a colour band's left edge, the first column with ≥ 20 matching pixels in the band's rows.
  - Default layout: a 320 px `#scroller` (`overflow:auto`; a `motion.div layoutScroll` when `layoutScroll` is set),
    centred with `margin-inline:auto`. Inside it, a 600 px spacer, then a `motion.ul` with five
    `motion.li layout` items `sib-0`…`sib-4`, 150×60, 10 px gap, `transition={{ type: 'spring' }}`,
    `exit={{ opacity: 0 }}`.
  - Colours: `sib-1` `#0077ff` (blue), `sib-2` `#ff0088` (pink, the one that exits), `sib-3` `#00aa44` (green),
    the rest `#888`.
  - Owned path: each item is its own `<AnimatePresence present child>`.
  - `?fixed`: no scroller. A 1500 px page spacer, then the list as `position: fixed; bottom: 20px`.
  - `?sticky`: a `position: sticky` `motion.div layout` header as the first child of `#scroller`.
  - `?nolayout`: the items drop `layout`.
  - Buttons: `scroll-bottom`, `remove` (`sib-2`).
  - `TesterPanel` with steps, Expected lines, chips `GAP HOLDS/DRIFTS` and `NO JUMP/JUMPED`, and a status line.
  - Link it from `src/routes/+page.svelte`: "Layout siblings around exits in scroll containers (plan 015a/b)".
- **Spec** `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts`. Real clock, 1920×1080.
  - Frames: capture a CDP screencast of every frame. A colour band's top is the first row with ≥ 20 pixels
    within ±24 per channel of the target colour. Require ≥ 10 frames in which every asserted colour is found.
  - Cases, **clone path**:
    - **Clamp, popLayout.** Every frame:
      - the pink−blue gap stays within ±2 px of its start;
      - green stays within 2 px of its start;
      - no colour steps more than 35 px between frames;
      - mid-frame, `elementFromPoint` at blue's centre hits `#sib-1`.

      **RED** (stale-cache jump).
    - **`?layoutScroll`, popLayout.** Blue and pink each step by 70 ± 2 px in the same frame, the gap holds, and
      blue has no layout transform. Green isn't asserted. **GUARD.**
    - **Sync completion in the scrolled container.** No step above 35 px. **GUARD** (A1: passes on unfixed code;
      the placeholder re-seed leaves nothing stale).
    - **`?fixed`, window scrolled by 300, remove.** No step above 35 px and no 300 px phantom. **RED.**
    - **`?fixed`, height-only resize** (1080 → 900, wait 400 ms, remove). No phantom move, no step above 35 px.
      **RED** (the cached fixed box is stale).
    - **Resize** (1920 → 1600, wait 400 ms, which is longer than upstream's 250 ms block, then remove with
      popLayout). The list is centred, so it moves on x. No colour moves on x by more than 2 px. **RED**
      (stale-x slide).
    - **`?sticky`, scroll, remove.** No step above 35 px. **RED** (stale cache).
    - **`?nolayout`, clamp.** Pink steps with the content by the clamp in one frame. **GUARD.**
  - Cases, **owned path**:
    - **Sync completion in the scrolled container, `?layoutGroup`.** No step above 35 px. **GUARD** (A1: passes
      on unfixed code once measured soundly). Planned rationale, kept for reference: today the
      owned completion goes `finishExit` (`presence.ts:1108-1114`, reached via 1748) → `forceRender` →
      `commitGroup` at postRender (`LayoutGroup.svelte:79-81`) → seeds every member
      (`motionDomProjection.ts:1253-1262`) from a cache that ignores the scroll. Step 3's `onScreenSnapshot` rebase makes it pass (see Step 3's M6 note).
    - **`?fixed`, remove.** No 300 px phantom. **GUARD**: owned siblings don't commit today, so there's no
      phantom. Their snap belongs to 015b.
  - Read budgets (wrapped `getBoundingClientRect` counted per `id`):
    - **GUARD**: 30 rAF-spaced steps scrolling `#scroller` → **0** reads on every `sib-*`.
    - **RED**: on the clone path with `mode=sync` (which tracks no 008 A2 point cache, so its `documentElement`
      `ResizeObserver` makes no reads), a resize → exactly **1** read per item, 250 ms after the last resize
      event, and **0** during the resize. Today: no refresh happens (0), and later commits use the stale cache.

## Done criteria

- [ ] `grep -cE "export const (scrollShift|scrollDelta|getScrollAncestors|captureScrollSnapshot|scheduleResample|seenScrollBasis|readScrollBasis|measureScreenScale|isResizeBlocked)\b" src/lib/utils/scrollBasis.ts`
      prints `9`, and `grep -n "const captureScrollSnapshot" src/lib/utils/presence.ts` prints nothing.
- [ ] `grep -n "static foldedInFor" src/lib/utils/motionDomProjection.ts` prints one line.
- [ ] 2a–2q, 3a–3g, 3n–3p and 6a–6c pass (3o/3p only if 007 A1 was approved).
- [ ] 008's two clone `&scroller` cases pass.
- [ ] In the new spec, these pass: the owned `?layoutGroup` sync-completion case (or it was moved to 015b per M6),
      the clone "sync completion in the scrolled container" case, the clone clamp, `?fixed` (scroll and height-only), resize, `?sticky` and
      `?nolayout` cases; the scroll and clone resize budgets; and every GUARD.
- [ ] `git diff <step-1 SHA>..HEAD -- src/lib/utils/scrollBasis.spec.ts src/lib/utils/motionDomProjection.spec.ts src/lib/utils/presence.spec.ts e2e/animate-presence/pop-layout-scroll-siblings.spec.ts e2e/animate-presence/pop-layout-container-move.spec.ts`
      removes or weakens no assertion: no deleted `expect`, no loosened tolerance, no new `fixme`/`skip`.
- [ ] Step 6's gate passes. `git diff --name-only feat/motion-14.7.1...HEAD` lists only in-scope files.

## STOP conditions

- A precondition or excerpt doesn't match.
- A Step 1 label doesn't hold.
- The fix needs a layout read per frame or per scroll event, or a full-tree measure. The one exception is the
  resize refresh: one read per node, once per resize gesture.
- A read budget needs raising.
- A node animates twice for one change, `onProjectionUpdate` fires twice for one change, or an animation restarts
  from its origin.
- 008's owned layout cases drift by the container move (the projection measured before 008's correction).
- Part C loses or snaps the exit, or breaks a `custom` or exit-timing spec.
- The fix needs an out-of-scope file, especially `layout.ts` (015b's).
- A demo's visible behaviour changes. This plan should change none, apart from removing the stale-cache jumps.
  Report any change for sign-off.
- A guard suite fails twice after a reasonable fix.

## Maintenance notes

- The computed-style memo isn't invalidated. If an `overflow` or `position` change needs to be seen, invalidate
  the memo from the `scroll` capture listener when an unknown element scrolls.
- `seen` is the scroll as of the last resample. A programmatic scroll and a DOM change in one task, with no input
  event between them, still use the older value. Upstream reads live in that case.
- If 012's build gives clones a projection node, delete part C.
- Reviewers should check:
  - signs, including the fixed root term;
  - that every `lastLayout` write updates its basis;
  - that `previous` is rebased before every comparison;
  - that part C is queued after 008's correction and gated on `data-layout`.

## Amendments

### A1 (2026-10-28, operator-approved)

- Step 1's two sync-completion cases (clone `?mode=sync`, and owned `?layoutGroup`) are relabelled **GUARD**. On
  the unfixed code they pass once the measurement is sound; their Step 1 "failure" was the screencast dropping
  ~190–290 ms of frames when an exit completes, which read as a ~55 px step. They must stay green.
- The spec's measurement change (`70236473`) is accepted: a frame step across a capture gap longer than 50 ms is
  not judged from the screencast; instead blue and green are hit-tested with `elementFromPoint` every rAF. This is
  not a weakened assertion for the Done criteria diff check.
- Part C's sign: `from = move / scale`, not `−move / scale` (plan slip; the clamp still gives `y: [-70, 0]`).
- M6 is moot: the owned `?layoutGroup` case already passes.

### A2 (2026-10-28, operator-approved)

- Part C uses `from = move`, not `move / measureScreenScale(offsetParent)`. Upstream only accumulates scale from
  projection nodes (`getClosestProjectingParent`, `create-projection-node.ts:1435-1442`; `treeScale`, 413,
  1546-1560), so under a CSS-scaled ancestor with no projection node the siblings write the screen-space delta as a
  local translate. The clone must move by the same raw amount or the gap opens by `move/2` (008's positioned+scale
  case failed by 12.8 px with the division). Guard-confirmed.
- Maintenance: the follow axes run on the main thread through a no-op `onUpdate`, which relies on motion-dom's
  `canAccelerateTransform` checking `!options.hasOnUpdate` (`motion-value.ts:62`). Re-check this on every Motion bump.

