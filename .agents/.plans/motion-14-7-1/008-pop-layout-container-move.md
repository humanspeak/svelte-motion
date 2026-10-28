# Plan 008: A popLayout exit stays where it was when popping it moves its container (#2348), plus `anchorX` / `anchorY` / `root` / `propagate`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4218**. Prefix every Playwright command with `PW_PORT=4218`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/presence.ts src/lib/utils/presence.spec.ts src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte src/lib/utils/presenceExitRegistry.ts src/lib/html/_MotionContainer.svelte src/routes/tests/animate-presence e2e/animate-presence src/routes/+page.svelte docs/src/routes/docs/animate-presence`
> Expected: no output (the batch's own `.agents/.plans/motion-14-7-1/` commit is not in that list). If any listed
> file changed, compare the "Current state" excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L (the #2348 port is M; the four missing props, `propagate` in particular, push it to L)
- **Risk**: MED. The correction runs on motion-dom's `microtask` batcher in the same step the projection uses, so
  ordering mistakes show up as layout animations sliding the popped element. The `propagate` work changes which
  presence context a nested legacy `AnimatePresence`'s children see.
- **Depends on**: none. `microtask` (with `setup` and `read` steps) is already exported by the pinned motion-dom
  14.6.0: `node_modules/motion-dom/dist/index.d.ts:3537` `declare const microtask: Batcher;`, step order
  `"setup", "read", …` in `node_modules/motion-dom/dist/es/frameloop/order.mjs:1-3`.
- **Wave**: 1
- **Category**: bug (upstream parity) + direction (missing public props)
- **Planned at**: commit `f8ac71aa` (`main` after the 14.6.0 release, v2.5.0, Motion 14.6.0), 2026-10-27

## Why this matters

With `<AnimatePresence mode="popLayout">`, an exiting element is pinned with `position: absolute` at its
`offsetTop` / `offsetLeft` inside its `offsetParent`. Popping it out of the flow shrinks that container. When the
container is bottom-anchored (a toast list `position: fixed; bottom: 20px`), centred with
`translate(-50%, -50%)`, or sits in a scroll container whose scroll position is clamped by the shrink, the
container (or the content) moves, and the pinned element moves with it: a toast that should shrink in place drops
a full row (70 px). Motion 14.7.0 fixed this (#2348): it records the element's position in scroll space before the
pop, measures again after the whole update is in the DOM, and shifts the pop offsets back by the difference,
before the projection system measures. svelte-motion's popLayout is its own port of upstream `PopChild` pinned at
v14.5.0, in two places (the owned `PresenceChild` path and the clone path), and has the bug in both.

`AnimatePresence` upstream also takes `anchorX`, `anchorY`, `root` and `propagate`, which svelte-motion's
`AnimatePresence` does not expose. `anchorY="bottom"` is the documented workaround for #2348 and one of upstream's
test cases, so it has to land with this fix. All four have existed upstream since before v14.5.0
(`git show v14.5.0:packages/framer-motion/src/components/AnimatePresence/index.tsx` lines 46-57), so this is an
existing gap, not a 14.7 change.

## Current state

### svelte-motion

- `src/lib/components/AnimatePresence.svelte` — the boundary. Props (lines 33-64): only `custom`, `initial`,
  `mode`, `onExitComplete`, plus the `children` (legacy, clone exits) / `child` + `present` (owned, real-node
  exits) union:
  ```svelte
  // AnimatePresence.svelte:33-38
      type SharedProps = {
          custom?: unknown
          initial?: boolean
          mode?: AnimatePresenceMode
          onExitComplete?: () => void
      }
  ```
  It creates the context (lines 71-79: `createAnimatePresenceContext({ initial, mode, onExitComplete,
  forceRender: getLayoutGroupContext()?.forceRender, custom })`), sets it, sets presence depth 0, and renders
  (lines 92-100) `<PresenceChild present={present ?? true}>{@render child()}</PresenceChild>` for the owned form or
  `{@render children?.()}` for the legacy form, inside `<div class="animate-presence-container">`
  (`display: contents`). It never calls `setPresenceChildContext`, so the children of a legacy `AnimatePresence`
  nested inside an owned child inherit the OUTER `PresenceChild` context.
- `src/lib/components/PresenceChild.svelte` — holds the owned content while it exits.
  - `applyPop()` (lines 84-127), the owned popLayout path. Its JSDoc says "Port of framer-motion
    `components/AnimatePresence/PopChild.tsx` @ v14.5.0 (#2503)". It measures with
    `measurePopLayoutSnapshot(element, getComputedStyle(element))` (line 102), builds the rule from
    `resolvePopLayoutStyles(snapshot)` with default anchors (lines 106-112), appends a `<style>` to
    `element.ownerDocument.head` (lines 116-120) and stores `removePop` (lines 122-126).
  - It is called from the `$effect.pre` (line 229) on the `present` true→false transition while `phase === 'idle'`,
    before `phase = 'holding'`, i.e. before the DOM update, while the element is still in flow:
    ```ts
    // PresenceChild.svelte:226-233
            } else if (prevPresent && !current && currentPhase === 'idle') {
                cancelWaitEnterBlock()
                // Before the DOM update, so the element is measured in flow.
                if (animatePresence?.mode === 'popLayout') applyPop()
                phase = 'holding'
                currentSafeToRemove = mintSafeToRemove()
                completeDescendant = exitRegistry.begin(currentSafeToRemove)
                animatePresence?.notifyExitStart()
    ```
  - It installs the presence child context at lines 188-199 (`isPresent`, `safeToRemove`, `register`,
    `onExitComplete`).
- `src/lib/utils/presence.ts`
  - `PopLayoutSnapshot` (lines 361-381): `width, height, top, left, right, bottom, direction`. No `point`.
  - `PopLayoutAnchorX` / `PopLayoutAnchorY` (lines 388-396).
  - `measurePopLayoutSnapshot` (lines 422-457): `offsetTop` / `offsetLeft` against `offsetParent`, and its JSDoc
    says ancestor scroll "is intentionally not subtracted here".
  - `resolvePopLayoutStyles(snapshot, anchorX = 'left', anchorY = 'top')` (lines 458-489) already handles both
    anchors and RTL exactly like upstream's `insertPopRule`.
  - `AnimatePresenceContext` type (from line 583) has `mode` but no anchors/root. `createAnimatePresenceContext`
    options (lines 703-716): `initial, mode, onExitComplete, forceRender, custom, getCustom`.
  - Clone path, inside `unregisterChild` (starts line 1288). The popLayout part:
    ```ts
    // presence.ts:1463-1494
            const popLayoutSnapshot =
                mode === 'popLayout'
                    ? liveStyle
                        ? measurePopLayoutSnapshot(child.element, liveStyle)
                        : child.lastPopLayoutSnapshot
                    : undefined
            ...
            if (popLayoutSnapshot) {
                const popStyles = resolvePopLayoutStyles(popLayoutSnapshot)
                if (popStyles.position) clone.style.position = popStyles.position
                ...
                if (popStyles.bottom) clone.style.bottom = popStyles.bottom
            } else {
    ```
    The clone is then inserted into the element's slot (`slotParent.insertBefore(clone, …)`, line 1554) and
    its exit animation starts on the next `requestAnimationFrame` (about line 1566). The clone keeps
    `data-testid` and other attributes but has its `id` removed (`if (clone.id) clone.removeAttribute('id')`,
    line 1417) and gets `data-clone="true"`, `data-exiting="true"`, `data-mode`.
  - The stored snapshot used when the element is already detached is refreshed at registration
    (lines 1225-1226) and in `updateChildState` (lines 1266-1268), both through `measurePopLayoutSnapshot`.
- `src/lib/utils/presenceExitRegistry.ts` — `register(id, node?)` returns an unregister function; `begin(onComplete)`
  returns `(id) => void` that marks a participant complete; `getPopElement()` returns the outermost registered
  motion element (the element `applyPop` pops).
- `src/lib/html/_MotionContainer.svelte`:
  ```ts
  // _MotionContainer.svelte:270-271
      const presenceChildContext = getPresenceChildContext()
      const inPresenceChild = !!presenceChildContext
  // _MotionContainer.svelte:696
      const shouldRegisterPresenceExit = !!context && presenceDepth === 0 && !inPresenceChild
  // _MotionContainer.svelte:718-723
      if (shouldRegisterPresenceExit) {
          onDestroy(() => {
              pwLog('[presence] onDestroy triggered', { key: presenceKey })
              context.unregisterChild(presenceKey)
          })
      }
  ```
  Inside a `PresenceChild` the element exits as a real node through motion-dom's exit feature
  (`buildPresenceContext`, lines 345-359) and skips clone registration.
- Existing coverage you must keep green: `src/lib/utils/presence.spec.ts` `describe('popLayout layout behavior')`
  (lines 542-…; the first case asserts `measurePopLayoutSnapshot(...)` `toEqual({...})` with exactly the seven
  current fields, so it will need `point` added), `e2e/animate-presence/*.spec.ts` (17 specs, including
  `owned-pop-layout.spec.ts` and `modes.spec.ts`), `src/lib/html/_MotionContainer.spec.ts` owned-group cases
  (lines 727-800), `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`.
- Conventions: unit tests run under jsdom with `vitest.config.ts` (`include: ['src/**/*.{test,spec}.{js,ts}']`);
  component specs render harnesses from `src/lib/components/__tests__/` (pattern:
  `onExitCompleteTiming.svelte.spec.ts`, which mocks `motion`'s `animate` and stubs `ResizeObserver`). Test pages
  are `src/routes/tests/<area>/<name>/+page.svelte`, specs `e2e/<area>/<name>.spec.ts`, linked from
  `src/routes/+page.svelte` (the AnimatePresence `<ul>` around lines 800-925; the `owned-pop-layout` link at
  lines 873-880 is the model). Guided tester pages use `TesterPanel` from
  `src/routes/tests/layout/_parity/TesterPanel.svelte` and are hidden under `?@isPlaywright=true`; the closest
  exemplar is `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte` (`isTester` flag set in
  `onMount`, steps with `action`, verdict chips). The e2e server is a production build
  (`playwright.config.ts:25`, `npm run build && npm run preview`), and pages signal readiness with
  `window.MotionIsMounted === true`.

### Upstream (verified at `~/Github/motion`, read with `git show v14.7.1:<path>`)

The #2348 commits: `c3ff0cd87` (failing repro + spec), `a23416c64` (fix, first version + unit test),
`6a74c8e29` (batching via `AnimatePresence` + scroll-space measuring), `a85c162b5` (moves the batching onto the
`microtask` frameloop and removes `6a74c8e29`'s `AnimatePresence/index.tsx` change again — net zero for that
file), `7e831103e` (scale scroll offsets onto the screen), `967b05df7` (fixed-container and scaled-ancestor
tests), `154234270` (playground page). The final code is `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx`:

```tsx
// PopChild.tsx:10-19 @v14.7.1
interface Size { width; height; top; left; right; bottom; direction: string; point?: number[] }

// PopChild.tsx:39-46 — how much an element's transforms, and its ancestors', scale it on screen
const measureScale = (element?: HTMLElement | null) => {
    const { width, height } = element?.getBoundingClientRect() || ({} as DOMRect)
    return [width / element?.offsetWidth! || 1, height / element?.offsetHeight! || 1]
}

// PopChild.tsx:63-80 — position in the space it scrolls in, returned in the offsetParent's space
const measurePoint = (element: HTMLElement) => {
    let { left, top } = element.getBoundingClientRect()
    let node: HTMLElement | null | undefined = element
    while ((node = (node.parentElement || (node.parentNode as ShadowRoot)?.host) as HTMLElement | null)) {
        const { scrollLeft, scrollTop } = node
        if (scrollLeft || scrollTop) {
            const [x, y] = measureScale(node)
            left += scrollLeft * x
            top += scrollTop * y
        }
        if (getComputedStyle(node).position === "fixed") break
    }
    const [x, y] = measureScale(element.offsetParent as HTMLElement | null)
    return [left / x, top / y]
}
```

`getSnapshotBeforeUpdate` (lines 87-111) records the seven fields as before plus `size.point = measurePoint(element)`.
`useInsertionEffect` (lines 181-244) appends the style to `root ?? doc.head`, inserts the rule, then:

```tsx
// PopChild.tsx:215-236 @v14.7.1
        let dx = 0
        let dy = 0
        microtask.setup(() => {
            const [x, y] = measurePoint(element)
            dx = size.current.point![0] - x
            dy = size.current.point![1] - y
        })
        microtask.read(() => {
            /** The style has no sheet if it's been removed since, because the element is present again. */
            const { sheet } = style
            if (!sheet || (!dx && !dy)) return
            const s = size.current
            s.left += dx
            s.right -= dx
            s.top += dy
            s.bottom -= dy
            sheet.deleteRule(0)
            insertPopRule(sheet)
        })
```

Its comment (lines 201-214): the correction runs "once the whole commit is in the DOM", "on the microtask
frameloop, so before paint", "Every popped element is measured in its first step, then corrected at the start of
the read step: before the projection system, which schedules its layout measurement there from layout effects, so
layout animations see the corrected position." The projection schedules there too:
`packages/motion-dom/src/projection/node/create-projection-node.ts:881-886 @v14.7.1`
(`didUpdate() { … microtask.read(this.scheduleUpdate) }`); svelte-motion's adapter calls the same `didUpdate`
(`src/lib/utils/motionDomProjection.ts:571-592`).

`insertPopRule` (lines 159-170): `anchorX === "left" ? (isRTL ? right : left) : (isRTL ? left : right)`,
`anchorY === "bottom" ? bottom : top`, all `!important` — identical to our `resolvePopLayoutStyles`.

`AnimatePresence/index.tsx @v14.7.1`:

```tsx
// index.tsx:46-58
export const AnimatePresence = ({ children, custom, initial = true, onExitComplete,
    presenceAffectsLayout = true, mode = "sync", propagate = false,
    anchorX = "left", anchorY = "top", root }) => {
    const [isParentPresent, safeToRemove] = usePresence(propagate)
// index.tsx:70-71
    const presentKeys = propagate && !isParentPresent ? [] : presentChildren.map(getChildKey)
// index.tsx:95-99
    useIsomorphicLayoutEffect(() => {
        if (propagate && !isParentPresent && !renderedChildren.length) safeToRemove?.()
    }, [isParentPresent, propagate, renderedChildren.length, safeToRemove])
// index.tsx:213-217  isPresent = propagate && !isParentPresent ? false : …
// index.tsx:236-249  once every exit completes: forceRender?.(); setDiffedChildren([]);
//                    propagate && safeToRemove?.(); pendingExitComplete.current = onExitComplete
// index.tsx:264-267  root, anchorX, anchorY passed to every PresenceChild → PopChild
```

`usePresence(subscribe)` (`use-presence.ts:40-65`) only registers with the parent presence when `subscribe` is
true, so a non-propagating nested `AnimatePresence` does not hold its parent's exit. Prop docs
(`AnimatePresence/types.ts:55-85 @v14.7.1`): `root` "Root element to use when injecting styles, used when
mode === "popLayout". This defaults to the head of the document the element is rendered in, but can be overridden
e.g. for use in shadow DOM."; `propagate` "If true, the AnimatePresence component will propagate parent exit
animations to its children."; `anchorX` / `anchorY` "Set whether to anchor the x/y position of the exiting element
… when using mode="popLayout". Use "bottom" for elements originally positioned with bottom: 0 …".
`presenceAffectsLayout` is documented "Internal. Used in Framer" — out of scope.

Upstream tests to port: `tests/react/issue-2348.spec.ts @v14.7.1` with fixture `dev/react/src/tests/issue-2348.tsx`
(read both in full: the 7-case "shrinks towards its centre" loop, "stays put when an item is added in the same
render", the 3-case "moves with the content when the … scroll position is clamped" loop, and "in a fixed container
stays put when the page's scroll position is clamped"); unit test
`packages/framer-motion/src/components/AnimatePresence/__tests__/pop-child-container-move.test.tsx @v14.7.1`
(4 cases); the propagate test `AnimatePresence.test.tsx:1191-1235 @v14.7.1` ("nested AnimatePresence should
animate exit when propagate is true") and fixture `dev/react/src/tests/animate-presence-propagate-empty.tsx`; and
the playground `dev/react/src/tests/pop-layout-playground.tsx` (presets at lines 66-232, including the three it
labels "Still wrong with the fix": rotated ancestor, rapid removals, nested propagate).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E (one spec) | `PW_PORT=4218 pnpm exec playwright test <spec>` | all pass |
| Build | `pnpm build` | exit 0 |
| Docs build | `pnpm --dir docs build` | exit 0 (restore `docs/static/r/animated-tabs.json` if the build rewrites it; never commit it) |

## Scope

**In scope**:

- `src/lib/utils/presence.ts` — the popLayout helpers block (lines 361-489), the `AnimatePresenceContext` type and
  `createAnimatePresenceContext` options (lines 583-716 plus the returned object), and the clone popLayout region
  (lines 1463-1494 plus scheduling the correction after the clone insert, line 1554), and
  `refreshConnectedSnapshots` (lines 1012-1023)
- `src/lib/utils/presence.spec.ts` (the `popLayout layout behavior` describe, plus new cases)
- `src/lib/components/PresenceChild.svelte` (`applyPop` and its JSDoc)
- `src/lib/components/AnimatePresence.svelte`
- `src/lib/html/_MotionContainer.svelte` — **only** line 696 (`shouldRegisterPresenceExit`) and lines 718-723 (the
  `onDestroy` → `unregisterChild`), for `propagate` on the legacy form
- `src/lib/utils/presence.ts` `PresenceChildContext` type (lines 1826-1840) — one optional `propagated` field
- `src/lib/components/__tests__/PopLayoutMoveHarness.svelte` (create), `src/lib/components/__tests__/PropagateHarness.svelte` (create)
- `src/lib/components/popLayoutContainerMove.spec.ts` (create), `src/lib/components/animatePresencePropagate.spec.ts` (create)
- `src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte` (create)
- `src/routes/tests/animate-presence/pop-layout-playground/+page.svelte` (create)
- `e2e/animate-presence/pop-layout-container-move.spec.ts` (create)
- `src/routes/+page.svelte` (two links in the AnimatePresence list)
- `docs/src/routes/docs/animate-presence/+page.svx` (Props table and a popLayout anchoring section)
- `.changeset/pop-layout-container-move.md` (create), `.changeset/animate-presence-props.md` (create)

**Out of scope**:

- `presenceAffectsLayout` (upstream marks it internal to Framer).
- Making `propagate` work through the clone path. When the OUTER exit is a clone (legacy `{#if}` / `{#each}`
  child of `AnimatePresence`), the subtree is torn down and a static `cloneNode` copy animates out; nested motion
  elements no longer exist, so nothing can propagate. That is the clone path's existing architectural limit; the
  docs must say `propagate` needs an owned outer exit (`present` + `child`, or a `PresenceChild`).
- The three playground presets upstream itself lists as "Still wrong with the fix" (rotated ancestor, rapid
  removals, nested propagate) — show them in the playground as known limitations, don't try to fix them.
- `package.json`, `pnpm-lock.yaml` (plan 001 owns the pins), `src/lib/utils/presenceExitRegistry.ts`.
- Any other region of `_MotionContainer.svelte` (plans in this batch edit its features and init regions).

## Git workflow

- Lane branch `lane/1471-presence` in `../svelte-motion-1471-presence`, created by the dispatcher from the
  wave-0 SHA of `feat/motion-14.7.1`.
- Conventional commits, one per step, e.g. `test(presence): popLayout exits stay put when the container moves (#2348)`,
  `fix(presence): correct popLayout offsets after the container moves (Motion 14.7.0, #2348)`,
  `feat(presence): add anchorX, anchorY, root and propagate to AnimatePresence`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR. Never change `"version"` in `package.json`; never add PR labels.

## Steps

### Step 1: Red unit tests (both paths)

1. **Owned path.** Create `src/lib/components/__tests__/PopLayoutMoveHarness.svelte`: props
   `present: boolean`, `count = 1`, `anchorY?: 'top' | 'bottom'`, `root?: HTMLElement | ShadowRoot`. Render
   `count` sibling `<AnimatePresence mode="popLayout" present={present} {anchorY} {root}>` instances, each with a
   `child` snippet holding `<motion.div data-testid="item" style="width:50px;height:50px" exit={{ opacity: 0 }}
   transition={{ duration: 0.5 }} />`. (`anchorY` / `root` don't exist yet; `pnpm check` will flag them until
   Step 3 — that is expected and part of the red.)
2. Create `src/lib/components/popLayoutContainerMove.spec.ts`, a port of upstream
   `pop-child-container-move.test.tsx`. Same set-up as `onExitCompleteTiming.svelte.spec.ts` (mock `motion`'s
   `animate`, stub `ResizeObserver`). Helper `getPopRule()` exactly as upstream (scan
   `document.head` styles' `sheet.cssRules` for `data-motion-pop-id`). Override
   `HTMLElement.prototype.getBoundingClientRect` like upstream (`top = 100 + (dataset.motionPopId ? drop : 0)` for
   `data-testid="item"`, else `0`; `left: 20`) and restore it in `afterEach`. Flip `present` to `false` with
   `rerender`, then let microtasks drain (`await Promise.resolve()` twice, then `await tick()`). Cases:
   - `offsets the popped element back to where it was` — drop 70 → rule `top` is `-70px`, priority `important`.
   - `offsets a bottom-anchored popped element back to where it was` — drop 70, `anchorY: 'bottom'` → rule
     `bottom` is `20px` (offsetParent height 0 − height 50 − offsetTop 0 + 70).
   - `leaves the popped element in place if the container didn't move` — drop 0 → `top` is `0px`.
   - `measures every popped element before correcting any` — `count: 3`; log `'read'` from the
     `getBoundingClientRect` override for items and `'write'` from a wrapped `CSSStyleSheet.prototype.deleteRule`
     (restore both); clear the log after mount; expect exactly 6 reads then 3 writes. **If** our snapshot makes a
     different number of `getBoundingClientRect` calls per element than upstream (ours also reads a rect as a
     width/height fallback), assert the shape instead: every `'read'` precedes every `'write'`, and there are 3
     writes. Note which assertion you used in the commit message.
   - `appends the pop style to root when given` — `root` = a `<div>` appended to `document.body`; after the pop,
     `root.querySelector('style')` exists and `document.head` has no pop rule.
3. **Clone path.** In `src/lib/utils/presence.spec.ts`, inside `describe('popLayout layout behavior')`, add
   `it('offsets a popLayout clone back when popping moves the container', …)`: model on the existing
   `'uses the stored offset snapshot for popLayout clones after scroll'` case (lines 620-670). Override
   `getBoundingClientRect` so the element reads `top: 100` and any `[data-clone="true"]` element reads
   `top: 170`; `createAnimatePresenceContext({ mode: 'popLayout' })`, `registerChild`, `unregisterChild`, drain
   two microtasks, expect `clone.style.top` to be `${64 - 70}px` (`-6px`, with the existing test's
   `offsetTop: 64`). Add a second case with `createAnimatePresenceContext({ mode: 'popLayout', anchorY: 'bottom' })`
   expecting `clone.style.bottom` = `${36 + 70}px` and `clone.style.top` empty.
4. Update the first case of that describe (`measures popLayout snapshots using offset parent coordinates`) only
   where Step 2 changes the snapshot shape: it will need `point` in the `toEqual`. Do that in Step 2, not now.

**Verify**:
- `pnpm exec vitest run src/lib/components/popLayoutContainerMove.spec.ts` → "offsets … back", "bottom-anchored",
  "measures every popped element" and "root" **FAIL** (top reads `0px`; no `bottom`; no writes; style in head);
  "leaves … in place" passes.
- `pnpm exec vitest run src/lib/utils/presence.spec.ts` → the two new clone cases **FAIL** (`clone.style.top` is
  `64px`); every other case passes.
- If "offsets the popped element back" passes before Step 2, STOP.

Commit (`test(presence): popLayout exits stay put when the container moves (#2348)`).

### Step 2: Red e2e page and spec

1. Create `src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte`, a port of upstream
   `dev/react/src/tests/issue-2348.tsx` with the same query parameters (`popLayout`, `fixed`, `anchor=top|bottom|center`,
   `anchorY`, `scroll`, `scroller`, `positioned`, `mirror`, `scale`, `layoutScroll`) and the same CSS (ul flex
   column, gap 10 px, 150 px wide; li 150×60, radius 10, `#ff0088`; the three fixed styles), plus
   `path=owned|clone` (default `clone`):
   - `clone`: `<AnimatePresence mode={popLayout ? 'popLayout' : 'sync'} {anchorY}>` with
     `{#each items as id (id)}<motion.li key={String(id)} data-testid="item-{id}" layout animate={{ scale: 1, opacity: 1 }}
     exit={{ scale: 0.8, opacity: 0 }} transition={{ type: 'spring' }} onclick={…remove id…} />{/each}` inside a
     `motion.ul` (`layoutScroll` from the param).
   - `owned`: `items` is `{ id, present }[]`; each item is its own `<AnimatePresence present={item.present} mode=… {anchorY}
     onExitComplete={() => drop item}>` with a `child` snippet holding the same `motion.li`. Removing sets
     `present = false`.
   - Buttons `data-testid="add"` (append `++count`) and `data-testid="cycle"` (remove the first, append a new one,
     in ONE state update), checkboxes `pop-layout` / `fixed`, the `#scroller` div and spacers exactly as upstream.
     Use `data-testid` everywhere (the clone path strips `id`).
   - Header comment citing #2348 and the seven commit hashes above.
   - A `TesterPanel` (hidden under `?@isPlaywright=true`, pattern from `owned-pop-layout/+page.svelte`) with steps
     for the bottom-anchored and centred cases and a live verdict: on removal, record the exiting item's centre and
     sample it each frame for 300 ms; chip `HOLDS · max drift Npx` when ≤ 1 px, `DRIFTS · Npx` otherwise.
2. Create `e2e/animate-presence/pop-layout-container-move.spec.ts`, a port of `tests/react/issue-2348.spec.ts`.
   Run every case for both paths (`for (const path of ['clone', 'owned'])`), URL
   `/tests/animate-presence/pop-layout-container-move?@isPlaywright=true&popLayout&path=${path}${query}`, wait for
   `window.MotionIsMounted === true`. Keep upstream's `readCentre`, `setup` (add 3 items, settle) and `exitItem`,
   with these adaptations:
   - Locate by `[data-testid="item-N"]`. "Is popped" = `[data-testid="item-N"][data-motion-pop-id]` (owned) or
     `[data-testid="item-N"][data-clone="true"]` (clone).
   - Timing: first try upstream's mocked clock (`page.clock.install({ time: 0 })`, `pauseAt(1000)`,
     `runFor(3000)` to settle, `runFor(100)` before reading). If mounting or the add animations stall under the
     mocked clock (items never visible, `MotionIsMounted` never true), switch the whole spec to real time: settle
     with `expect.poll` on the item rects being stable, and replace the single mid-exit read with an in-page rAF
     sampler armed before the click (pattern: `toggleAndSample` in `e2e/animate-presence/owned-pop-layout.spec.ts`)
     that records the max centre drift over 300 ms while the item is still popped; assert max drift < 1. Say which
     timing you used in the commit message.
   - Keep the upstream tolerances (`< 1` px; scroll clamped `< scrollBefore - 50`).
   Cases (×2 paths): the 7 "shrinks towards its centre" queries, "stays put when an item is added in the same
   render" (`&fixed&anchor=bottom`, `cycle`, item 0), the 3 "moves with the content when the … scroll position is
   clamped" queries, and "in a fixed container stays put when the page's scroll position is clamped"
   (`&fixed&anchor=bottom&scroll&mirror&layoutScroll`). The `anchorY` cases need Step 3's prop; until then the page
   ignores `anchorY`.
3. Link the page from `src/routes/+page.svelte` next to the `owned-pop-layout` link: "popLayout when popping moves
   the container (#2348)".

**Verify**: `PW_PORT=4218 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` →
for both paths, **at least** "fixed, bottom-anchored container" and "fixed, transform-centred container" FAIL
with a drift of about 70 px and 35 px; "static container" and "fixed, top-anchored container" pass. Record in your
report exactly which of the 24 cases fail now (they are the red set) and which pass (guards). If the bottom-anchored
case passes on either path, STOP.

Commit (`test(presence): port the #2348 popLayout e2e for owned and clone exits`).

### Step 3: `anchorX`, `anchorY`, `root` on AnimatePresence

1. `src/lib/components/AnimatePresence.svelte`: add to `SharedProps`, with JSDoc `@prop` lines adapted from
   upstream `types.ts:55-85`: `anchorX?: PopLayoutAnchorX` (default `'left'`), `anchorY?: PopLayoutAnchorY`
   (default `'top'`), `root?: HTMLElement | ShadowRoot`. Destructure them with those defaults. Pass
   `getPopLayoutOptions: () => ({ anchorX, anchorY, root })` to `createAnimatePresenceContext` (a getter, so the
   latest props are read at pop time, as upstream passes them every render).
2. `src/lib/utils/presence.ts`: add `getPopLayoutOptions?: () => PopLayoutOptions` to the options, where
   `export type PopLayoutOptions = { anchorX: PopLayoutAnchorX; anchorY: PopLayoutAnchorY; root?: HTMLElement | ShadowRoot }`
   (Google-style JSDoc). Expose `getPopLayoutOptions(): PopLayoutOptions` on `AnimatePresenceContext` (default
   `{ anchorX: 'left', anchorY: 'top' }`). Also accept plain `anchorX` / `anchorY` options on
   `createAnimatePresenceContext` (used by Step 1's clone unit case) — the getter wins when both are given.
3. Clone path: `resolvePopLayoutStyles(popLayoutSnapshot, anchorX, anchorY)` with the context's options.
4. Owned path: `applyPop()` passes `anchorX` / `anchorY` from `animatePresence?.getPopLayoutOptions()` to
   `resolvePopLayoutStyles`, and appends the `<style>` to `root ?? doc.head`; `removePop` removes it from there
   (`style.remove()` already works for both).

**Verify**: `pnpm check` → 0 errors. `pnpm exec vitest run src/lib/components/popLayoutContainerMove.spec.ts` →
"root" now passes; the move cases still fail. `pnpm exec vitest run src/lib/utils/presence.spec.ts` → the
bottom-anchored clone case still fails only on the value (no correction yet), all old cases pass.

Commit (`feat(presence): add anchorX, anchorY and root to AnimatePresence`).

### Step 4: Port the #2348 correction

1. In `src/lib/utils/presence.ts`, next to `measurePopLayoutSnapshot`:
   - `measurePopLayoutScale(element?: HTMLElement | null): [number, number]` — upstream `measureScale` verbatim.
   - `measurePopLayoutPoint(element: HTMLElement): [number, number]` — upstream `measurePoint` verbatim (parent
     walk through `parentElement || (parentNode as ShadowRoot)?.host`, scroll scaled onto the screen, stop after a
     `position: fixed` ancestor, divide by the `offsetParent`'s scale). Use the element's own window
     (`element.ownerDocument.defaultView ?? window`) for `getComputedStyle`.
   - Add `point: [number, number]` to `PopLayoutSnapshot` (JSDoc: "Position in the space the element scrolls in,
     in its offsetParent's coordinate space (upstream `measurePoint`)") and set it in `measurePopLayoutSnapshot`.
     Rewrite that function's JSDoc: offsets stay `offsetTop` / `offsetLeft` like upstream; `point` is what detects
     the container moving after the pop.
   - `schedulePopLayoutCorrection(element, snapshot, isActive, reapply)`: upstream lines 215-236. On
     `microtask.setup` (import `microtask` from `motion-dom`), measure `measurePopLayoutPoint(element)` and store
     `dx = snapshot.point[0] - x`, `dy = snapshot.point[1] - y`. On `microtask.read`, return when `!isActive()` or
     `!dx && !dy`; otherwise `snapshot.left += dx; snapshot.right -= dx; snapshot.top += dy; snapshot.bottom -= dy`
     and call `reapply(snapshot)`. Google-style JSDoc that quotes upstream's ordering reason (before the
     projection's `microtask.read` layout update).
   - Update the existing `toEqual` in `measures popLayout snapshots using offset parent coordinates` to include
     `point: [0, 0]` (jsdom rects are zero; that is the only allowed edit to an existing assertion).
2. Owned path, `PresenceChild.svelte` `applyPop()`: build the rule text from a local `insertRule(sheet)` that reads
   the (mutable) snapshot; after inserting it, call
   `schedulePopLayoutCorrection(element, snapshot, () => !!style.sheet && style.isConnected, () => { sheet.deleteRule(0); insertRule(sheet) })`
   (fall back to rewriting `style.textContent` when `style.sheet` was null). Update the JSDoc provenance to
   "Port of framer-motion `components/AnimatePresence/PopChild.tsx` @ v14.7.1 (#2503, #2348)" and add one sentence
   on the correction. `applyPop` must keep running from the `$effect.pre` before `phase = 'holding'` — the
   microtask steps run after Svelte's synchronous flush, i.e. once the whole update is in the DOM.
3. Clone path, `unregisterChild`: after the clone is inserted into its slot (`slotParent.insertBefore(clone, …)`)
   and only when `popLayoutSnapshot` is set, call `schedulePopLayoutCorrection(clone, popLayoutSnapshot,
   () => clone.isConnected && !activeExit.cancelled && !disposed, (s) => { clear clone.style left/right/top/bottom;
   apply resolvePopLayoutStyles(s, anchorX, anchorY) edges })`. The "before" point is the element's (measured live
   when connected, else the stored snapshot's); the "after" point is the clone's, which sits in the same slot and
   `offsetParent`. Copy the snapshot (`{ ...snapshot, point: [...snapshot.point] }`) before mutating, so
   `child.lastPopLayoutSnapshot` isn't corrupted.
4. Stale "before" point on the clone path. Svelte detaches keyed nodes before `unregisterChild` runs from the
   motion element's `onDestroy` (`_MotionContainer.svelte:718-723`), so for a `{#each}` removal the element is
   usually already detached and the "before" point is `child.lastPopLayoutSnapshot.point`. That snapshot is only
   refreshed at registration (`presence.ts:1225-1226`) and in `updateChildState` (`presence.ts:1266-1268`, which
   runs while the child animates). If the container moved while the child was at rest (a toast list growing as
   items are added), the stored point is stale and `dx`/`dy` would include that earlier move. Fix: in
   `refreshConnectedSnapshots` (`presence.ts:1012-1023`, scheduled once per frame on every structural change,
   including each `registerChild`), when `mode === 'popLayout'`, also refresh
   `child.lastPopLayoutSnapshot = measurePopLayoutSnapshot(child.element, …)` for every connected child, reusing
   the computed style it already reads. Add a unit case in `presence.spec.ts`:
   `refreshes a resting child's popLayout point when siblings are added` — register `k1` (rect top 100), change the
   mocked rect to top 170 (as if the list grew), register `k2`, run the scheduled frame, detach `k1`'s element,
   `unregisterChild('k1')`, mock the clone at top 170, drain microtasks: the clone's `top` is uncorrected (no
   `-70px`).

**Check against the e2e setup**: the e2e `setup` adds three items, then removes one. After this step, the
"fixed, bottom-anchored container" clone case must pass, and you must log (temporary `console.log`, removed before
committing) `dx`/`dy` for that case: they must equal the container move caused by the removal (one row, about
70 px), not that plus the moves from the three additions. If they include the earlier moves, or the clone-path
bottom-anchored case drifts by more than 1 px, STOP and report the logged values.

**Verify**:
- `pnpm exec vitest run src/lib/components/popLayoutContainerMove.spec.ts src/lib/utils/presence.spec.ts` → all pass.
- `PW_PORT=4218 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → all pass.
- `PW_PORT=4218 pnpm exec playwright test e2e/animate-presence` → all pass (re-run a failing spec alone once
  before reporting, and say so).

Commit (`fix(presence): correct popLayout offsets after the container moves (Motion 14.7.0, #2348)`).

### Step 5: `propagate`

Semantics to reproduce (upstream `index.tsx:58, 70-71, 95-99, 213-217, 246`, `use-presence.ts:40-65`): a nested
`AnimatePresence propagate` treats all its children as not present while its parent presence is exiting, holds
the parent's exit until its own exits complete (or immediately releases it when it renders nothing), and without
`propagate` the nested boundary is independent of the parent's exit.

1. Red first. Create `src/lib/components/__tests__/PropagateHarness.svelte`: an outer owned
   `<AnimatePresence present={outer} {onExitComplete}>` whose `child` is a
   `motion.div data-testid="outer" exit={{ opacity: 0 }} transition={{ duration: 0.1 }}` containing, by a `form`
   prop: (`'owned'`) `<AnimatePresence {propagate} present={true}>` with a `child` `motion.div data-testid="inner"
   exit={{ opacity: 0 }}`; (`'legacy'`) `<AnimatePresence {propagate}>{#if innerShown}<motion.div key="inner"
   data-testid="inner" exit={{ opacity: 0 }} />{/if}</AnimatePresence>`; (`'empty'`) `<AnimatePresence {propagate} />`
   with nothing inside. Create `src/lib/components/animatePresencePropagate.spec.ts` (pattern: the
   `controlledOwnedGroup` helper in `_MotionContainer.spec.ts:747-783`, which spies on
   `visualElementStore.get(el).animationState.setActive` to see `'exit'` activations). Cases:
   - owned + legacy forms, `propagate: true`: after `outer = false`, the inner element's `setActive('exit', true)`
     is called, and `onExitComplete` fires once, only after both exits complete (port of upstream
     `AnimatePresence.test.tsx:1191-1235`). This is also the deadlock guard: the outer exit must complete, so add
     `expect(group.result.queryByTestId('outer')).toBeNull()` after both exits resolve.
   - owned + legacy forms, `propagate: false`: after `outer = false`, the inner element never gets
     `setActive('exit', true)`; the outer exit completing alone fires `onExitComplete` once.
   - legacy form, `propagate: false`, outer present: `innerShown = false` creates a `[data-clone="true"]` for the
     inner element (its own clone exit works — today it does not, because it inherits the outer context).
   - legacy form, `propagate: true`: after the whole outer exit completes and unmounts, no `[data-clone="true"]`
     remains or appears (the inner element already exited as a real node).
   - `'empty'`, `propagate: true`: `onExitComplete` fires exactly once and the outer element unmounts (port of
     `animate-presence-propagate-empty.tsx`; deadlock guard for a nested boundary with nothing to exit).
   - legacy form, `propagate: true`, `innerShown = false` before the outer exit (the inner boundary is empty when
     the parent leaves): the outer exit completes and `onExitComplete` fires once (deadlock guard).
   **Verify** red: `pnpm exec vitest run src/lib/components/animatePresencePropagate.spec.ts`. Expected today:
   - FAIL: owned + `propagate: true` (the inner owned boundary has its own `PresenceChild` with `present={true}`,
     so the outer exit never reaches the inner element); legacy + `propagate: false` (the inner element inherits the
     outer `PresenceChild` context and exits with the parent); legacy "own clone exit" (that inherited context also
     skips clone registration, so removing it from the inner list doesn't animate).
   - PASS (guards, must stay green): owned + `propagate: false`; legacy + `propagate: true` (it already exits as a
     real node through the inherited context); the no-leftover-clone case; the `'empty'` and empty-legacy deadlock
     guards.
   Record the actual table. If an expected FAIL passes, or an expected PASS fails, STOP. `pnpm check` also flags the
   unknown `propagate` prop. Commit (`test(presence): AnimatePresence propagate`).
2. `AnimatePresence.svelte`: add `propagate?: boolean` (default `false`, JSDoc from upstream). At the top of the
   script read `const parentPresence = getPresenceChildContext()` and `const presenceId = $props.id()`.
   - If `propagate && parentPresence`: register with the parent once (`const unregister = parentPresence.register(presenceId)`,
     released in `onDestroy`). Define `releaseParent()` that calls `parentPresence.onExitComplete(presenceId)` (read
     the getter at call time — it is versioned per exit cycle).
   - Owned form (unchanged design; children stay on the inner `PresenceChild`, only `presenceId` is a parent
     participant): render `<PresenceChild present={(present ?? true) && (!propagate || (parentPresence?.isPresent ?? true))}>`.
     Wrap the context's `onExitComplete` so that when every exit completes and the parent is exiting
     (`propagate && parentPresence && !parentPresence.isPresent`) it also calls `releaseParent()`. Add an
     `$effect` that calls `releaseParent()` when `propagate && parentPresence && !parentPresence.isPresent` and the
     owned child was already absent (`present === false` before the parent exit) — upstream's
     "`!renderedChildren.length`" release.
   - Legacy form: shadow the presence child context for its children. With `propagate: false`, call
     `setPresenceChildContext(undefined as never)` (cast if the setter's type requires) so its children are
     independent of the parent and get their own clone exits. With `propagate: true`, match upstream: only the
     nested boundary is a participant of the parent (the `presenceId` registration above); its children stay on the
     nested boundary and never register with the parent directly. Do NOT forward the parent's `register` /
     `onExitComplete` (that design deadlocks: `presenceExitRegistry.begin()` resets every participant and
     `checkComplete` waits for all of them, `presenceExitRegistry.ts:79-91`, so the boundary's own `presenceId`
     would never be completed). Instead the boundary owns a registry:
     `const innerRegistry = createPresenceExitRegistry()` and installs its own context —
     `isPresent` → `parentPresence.isPresent`, `register` → a wrapper around `innerRegistry.register` that also
     counts live participants, `onExitComplete` → the current inner cycle's completion callback,
     `safeToRemove` → `releaseParent`, `propagated: true`. An `$effect.pre` watching `parentPresence.isPresent`:
     on true→false, if the live-participant count is 0 call `releaseParent()` at once (empty boundary; the registry
     keeps empty holds open by design, so it can't be relied on here), otherwise `innerCycle = innerRegistry.begin(releaseParent)`;
     on false→true (parent re-entered), `innerRegistry.cancel()`. `releaseParent` is idempotent per parent cycle.
   - Without a parent presence, `propagate` is a no-op.
3. `presence.ts` `PresenceChildContext`: add `readonly propagated?: boolean` with JSDoc ("installed by a legacy
   `<AnimatePresence propagate>`; its `isPresent` follows the parent presence, while descendants still register
   clone exits with the nested boundary"). `AnimatePresence.svelte` imports `createPresenceExitRegistry` from
   `$lib/utils/presenceExitRegistry` (read-only use; that file stays out of scope).
4. `_MotionContainer.svelte`, the two allowed regions only:
   - line 696: `const shouldRegisterPresenceExit = !!context && presenceDepth === 0 && (!inPresenceChild || presenceChildContext?.propagated === true)`.
   - lines 718-723: inside the `onDestroy`, skip `context.unregisterChild(presenceKey)` when
     `presenceChildContext?.propagated === true && presenceChildContext.isPresent === false` (the element already
     exited with its parent).
   If either change makes any `src/lib/html/_MotionContainer.spec.ts` case or `e2e/animate-presence` spec fail and
   a reasonable fix stays inside these two regions, apply it; otherwise STOP.

**Verify**: `pnpm exec vitest run src/lib/components/animatePresencePropagate.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`
→ all pass. `pnpm check` → 0 errors.

Commit (`feat(presence): add propagate to AnimatePresence`).

### Step 6: Playground, docs, changesets

1. Create `src/routes/tests/animate-presence/pop-layout-playground/+page.svelte`, modelled loosely on upstream
   `dev/react/src/tests/pop-layout-playground.tsx`: a preset `<select>` grouped like upstream ("Reporter's
   scenarios", "Harder scenarios", "Still wrong with the fix") with at least these presets: static, fixed-top,
   fixed-bottom, fixed-bottom + `anchorY=bottom`, fixed-center, scroll-mirror, scroller, scroller-positioned,
   scaled fixed-bottom, fixed-bottom + layoutScroll on a scrolled page, toast queue (add + remove in one update),
   rapid removals (known limitation), rotated ancestor (known limitation), nested `propagate` (known limitation);
   an `owned` / `clone` path toggle; on removal a dashed ghost at the item's rect (same scroll context) and a
   per-item "max centre drift" readout. Wrap it in a `TesterPanel` with steps ("pick Fixed list, bottom-anchored;
   click the second toast" → "it shrinks inside its ghost; the chip reads HOLDS") and live verdicts; hide the panel
   under `?@isPlaywright=true`. Link it from `src/routes/+page.svelte` under the Step 2 link
   ("popLayout playground (#2348)"). Add one smoke e2e case to `pop-layout-container-move.spec.ts`: the playground
   loads with `?@isPlaywright=true`, the default preset renders its items, and removing one shows a drift readout
   ≤ 1 px.
2. `docs/src/routes/docs/animate-presence/+page.svx`: extend the `### AnimatePresence` props table (line 311) with
   rows for `mode`, `custom`, `anchorX` (`'left' | 'right'`, `'left'`), `anchorY` (`'top' | 'bottom'`, `'top'`),
   `root` (`HTMLElement | ShadowRoot`, document head), `propagate` (`boolean`, `false`). Add a short
   `## popLayout positioning` section: the exiting element is pinned where it was, and stays there even when
   popping it moves a bottom-anchored, centred or scrolled container; `anchorX` / `anchorY` choose which edges it
   is pinned by; `root` for shadow DOM. Add a `### Nested exits with propagate` example (outer owned
   `present` + `child`, inner `<AnimatePresence propagate>`), stating it needs an owned outer exit.
3. Changesets. Repo convention: a fix is `patch`, new public API is `minor` (e.g. `.changeset/reorder-keyboard.md`
   at `f8ac71aa` is `'@humanspeak/svelte-motion': minor`). Never touch `"version"`:
   - `.changeset/pop-layout-container-move.md` (`patch`): "`mode="popLayout"` exits now stay where they were when popping
     them moves their container (a bottom-anchored or centred list, a clamped scroll position, a scaled ancestor),
     for both owned and clone exits (Motion 14.7.0, #2348)."
   - `.changeset/animate-presence-props.md` (`minor`): "`AnimatePresence` accepts `anchorX`, `anchorY`, `root` and
     `propagate`, matching Motion. Behaviour change: a nested `AnimatePresence` inside an owned exiting child no
     longer exits its children with the parent unless it has `propagate` (Motion's default), and its own children's
     exits now animate."

**Verify**: `PW_PORT=4218 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts` → all
pass; `pnpm --dir docs build` → exit 0.

Commit (`docs(presence): popLayout positioning, anchors, root and propagate`).

### Step 7: Gate

**Verify**, in order: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0),
`PW_PORT=4218 pnpm exec playwright test e2e/animate-presence e2e/layout` (all pass; re-run a failing spec alone
once and say so), `trunk fmt` then `trunk check` on every changed file (no new issues), `git status` shows only
in-scope files.

## Test plan

- Red-first anchors: the four owned unit cases and two clone unit cases from Step 1, the stale-point clone case
  from Step 4.4, the owned + `propagate: true`, legacy + `propagate: false` and legacy "own clone exit" unit cases
  from Step 5 (owned + `propagate: false`, legacy + `propagate: true` and the deadlock cases are guards), and the bottom-anchored / centred e2e cases on both paths from
  Step 2 (plus whatever else Step 2 records as red). All must pass after Steps 4-5.
- Guards: "leaves the popped element in place", the static / top-anchored e2e cases, the existing
  `popLayout layout behavior` unit cases, `owned-pop-layout.spec.ts`, `modes.spec.ts` and the rest of
  `e2e/animate-presence`, the `_MotionContainer.spec.ts` owned-group cases, `onExitCompleteTiming.svelte.spec.ts`.
- Structural models: `pop-child-container-move.test.tsx` and `issue-2348.spec.ts` upstream;
  `onExitCompleteTiming.svelte.spec.ts` and `owned-pop-layout.spec.ts` here.

## Done criteria

- [ ] `grep -n "microtask.setup" src/lib/utils/presence.ts` → one match; `grep -n "v14.7.1" src/lib/components/PresenceChild.svelte` → the updated provenance
- [ ] `grep -n "anchorX\|anchorY\|propagate\|root" src/lib/components/AnimatePresence.svelte` shows all four props with JSDoc
- [ ] Step 1 and Step 5 unit cases pass; Step 2 e2e (24 cases + playground smoke) passes; `e2e/animate-presence` and `e2e/layout` pass
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` and `pnpm --dir docs build` exit 0; `trunk check` clean
- [ ] Two pages linked from `src/routes/+page.svelte`; both changesets exist; no out-of-scope files modified

## STOP conditions

- The drift check shows changes and the excerpts above no longer match.
- Step 1's "offsets the popped element back" or Step 2's bottom-anchored e2e case passes before Step 4.
- After Step 4 the owned-path `layout` e2e cases still drift by about the container move (the correction ran
  after the projection's `microtask.read` update). Report the ordering you observed instead of moving the
  correction to another step.
- `microtask` is not exported by the installed motion-dom, or has no `setup` step.
- Step 5 needs `_MotionContainer.svelte` changes outside line 696 and lines 718-723, or the legacy `propagate`
  case leaves a `[data-clone="true"]` after the outer exit and the fix isn't in those regions.
- Any existing `e2e/animate-presence` spec fails twice after a change in this plan.

## Maintenance notes

- `measurePopLayoutPoint` uses the element's transformed rect, as upstream does, so an element that pops while
  mid-transform carries that transform into the "before" point. On the clone path the clone has its transforms
  reset (`resetTransforms`), so a popped element with a non-identity transform at unregister can be corrected by
  that transform's offset. Upstream's playground "wobble" preset shows the same class of error; revisit only with
  upstream.
- Rapid removals: each exiting element is corrected once, when it pops; later removals move the container again
  and carry earlier exits with it (upstream lists this as "Still wrong with the fix").
- `propagate` only reaches nested boundaries when the outer exit is owned (`present` + `child` or a
  `PresenceChild`). If the clone path is ever replaced by real-node exits, `propagate` should start working there
  for free; drop the docs caveat then.
- Reviewers: check the microtask ordering argument (our `applyPop` runs in `$effect.pre`, so its `read` callback
  is queued before any `didUpdate` from the same flush), and that `child.lastPopLayoutSnapshot` is never mutated
  by the correction.

## Amendments (operator-approved 2026-10-27)

### A1: Step 4 snapshot ordering (match upstream)

Step 4's verify failed: `PresenceChild`'s `$effect.pre` calls `applyPop()`, which inserts the pop rule *before* the
descendant motion element's own `$effect.pre` (`_MotionContainer.svelte:2187-2209`) takes its projection snapshot
(`measureLayoutRect('snapshot')` + `projection.willUpdate()`). The snapshot therefore records the already-popped,
displaced box and the layout animation runs from +70px back to 0.

Upstream measures first and pops second: `getSnapshotBeforeUpdate` (`PresenceChild/PopChild.tsx` @v14.7.1) measures,
then the pop rule goes in during `useInsertionEffect`. Match that order:

1. Defer the pop-rule insertion in `applyPop` until after every descendant's pre-effect snapshot for the same flush
   has run (e.g. queue it to run after the descendants' `$effect.pre`, using the existing microtask/frame
   scheduling in `presence.ts`), so the snapshot sees the in-flow rect. Cite the upstream lines you mirror.
2. Keep the change inside 008's files (`presence.ts`, `PresenceChild.svelte`, their specs). If the only working
   fix needs `_MotionContainer.svelte`, STOP and report what and why.
3. Add a unit test: the descendant snapshot is taken before the pop rule is inserted (fails with the old order).
4. Re-run the Step 4 verify. Also explain the scrollable-element clamp failure (about 1402px off on both paths).
   Fix it if the cause is in scope; otherwise report it with evidence before you continue.
5. The two previously passing owned cases ("static, anchorY: bottom" and "item added in the same render") must
   pass again.

Keep the `transform-origin: 50% 50% !important` pin on the test page for now, with a comment pointing to plan 013,
which owns the `setCompositorHints` resting `transform-origin: 0 0` divergence.

## Amendments (operator-approved 2026-10-28)

### A2: a cached resting point for the owned path ("item added in the same render")

Svelte has no hook before the DOM commit. By `PresenceChild`'s `$effect.pre`, the page's `{#each}` has already
inserted the new item, so the owned path measures the "before" point 70px off. Upstream reads it in
`getSnapshotBeforeUpdate` (`PresenceChild/PopChild.tsx` @v14.7.1), before React commits anything.

1. Give `PresenceChild` a cached resting point for its pop element, as the clone path already has. Record it at
   the end of each settled flush (post-update `$effect`), and refresh it from an observer when the element or its
   siblings change size or position (for example a `ResizeObserver` on the element and its parent, plus the scroll
   containers you already track). The cache must hold the value from before the current render's DOM changes.
2. `applyPop` reads the cached point when one exists, and falls back to measuring live when it doesn't (first
   render, or the cache was invalidated). Tear the observers down when the child unmounts or its exit completes.
3. Stay inside 008's files (`presence.ts`, `PresenceChild.svelte`, their specs and harnesses). If the cache needs
   `_MotionContainer.svelte` or `layout.ts`, STOP and report.
4. Red first: a unit test that adds an item in the same render as the exit and fails on the live-measure order,
   then passes with the cache. The owned "item added in the same render" e2e case must pass. Re-run the whole spec
   on both paths, and the existing `e2e/animate-presence` suite, so the cache causes no regression.

### A3: the four scrollable-element clamp cases move to plan 015

The four "scrollable element" and "positioned scrollable element in a scale(0.5) ancestor" clamp cases (owned and
clone paths) fail outside 008's code. The owned path fails because siblings take no layout snapshot, and the
clone path because the cached layout rects are stale after `#scroller` scrolls. Plan 015 owns both, and ships in
this release.

1. Mark exactly those four cases `test.fixme`, each with a comment: `// Plan 015: <owned: siblings take no
   snapshot | clone: stale cached rects after the container scrolls>`. Use a condition inside the existing loop;
   don't restructure the spec.
2. Record their current failure numbers in your report (owned 52px / 12px, clone 1392px / 313px, or whatever they
   are now), so 015 has a baseline.
3. Then continue with Steps 5–7. The done criteria count the four as expected `fixme`s, not failures.
