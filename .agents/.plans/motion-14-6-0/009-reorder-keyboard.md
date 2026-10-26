# Plan 009: Keyboard reordering for `Reorder` (Space grabs, arrows move, Escape restores)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4203** (`PW_PORT=4203`, the Reorder lane). Never use or kill
> port 4198. Never set `PW_REUSE_SERVER`.
>
> **Requires plan 003** (it adds the `commit(order, newOrder, moved)` helper in `Group.svelte` and the two-argument
> `onReorder`). Before starting, confirm `grep -n "commit(order, newOrder, value)" src/lib/components/Reorder/Group.svelte`
> prints a line. If not, STOP.
>
> **Revision 2026-10-26**: rewritten after the adversarial review. (1) The grab snapshot is a shallow copy
> (`[...values]`), because svelte-motion supports in-place `$state` mutation of `values` (`Group.svelte`'s
> "in-place $state mutations count too" effect) and a reference would change along with the list. (2) Refocus is
> keyed on whether the item was grabbed **when the key was pressed**, so Escape (which drops the grab) still
> restores focus. (3) Refocus is driven by a `values` change, not a single `tick()`, so deferred consumers (the
> 120 ms `tests/reorder/deferred` pattern) keep focus too; `commit` reports whether it fired `onReorder`. (4) Blurs
> caused by a move are not forwarded to the consumer's `onblur`. (5) The docs no longer call `tabindex={-1}` an
> opt-out of keyboard reordering. These replace the old `moving` + `tick()` design and its one allowed adjustment.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/components/Reorder src/routes/tests/reorder e2e/reorder docs/src/routes/docs/reorder docs/src/lib/examples/reorder docs/src/routes/examples/reorder src/routes/+page.svelte`
> Expected: only plan 003's changes (`Group.svelte`, `types.ts`, `reorder.component.spec.ts`,
> `__tests__/ReorderHarness.svelte`, the reorder docs page). Anything else: compare with "Current state"; on a
> mismatch, STOP.

## Status

- **Priority**: P1 (Motion 14.6.0's headline feature; accessibility)
- **Effort**: L
- **Risk**: MED. Items gain a default tab stop, and Svelte's keyed `{#each}` moves DOM nodes differently from React,
  which can drop focus mid-grab (see "The Svelte-specific risk").
- **Depends on**: 003
- **Wave**: 2
- **Category**: direction (upstream parity feature)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

Today a `Reorder` list can only be reordered with a pointer: items aren't focusable and ignore the keyboard.
Motion 14.6.0 (issue #2658; commits `123ec0da9`, `3d2aae3d2`, `d81711f5e`, `79ba09f81`, `54c1645cc`, `1faa63a18`,
`a11b0cd47`) makes every `Reorder.Item` keyboard-reorderable with no opt-in: Tab to an item, Space grabs it, arrows
along the group's axis move it, Space drops it, Escape restores the order from before the grab. This plan ports that
behavior, a test page, unit and e2e tests (ported from upstream's 24 unit and 12 e2e cases), docs and an example.

## The behavior to port (upstream `v14.6.0`, exact)

Sources (read with `git -C ~/Github/motion show v14.6.0:<path>`):
`packages/framer-motion/src/components/Reorder/Group.tsx` (the `onKeyDown` in the context, around lines 150-212),
`packages/framer-motion/src/components/Reorder/Item.tsx` (around lines 79-169),
`packages/framer-motion/src/components/Reorder/types.ts` (`ReorderContextProps.onKeyDown`),
`packages/framer-motion/src/components/Reorder/__tests__/keyboard.test.tsx`,
`dev/react/src/tests/issue-2658.tsx`, `tests/react/issue-2658.spec.ts`.

- **Always on.** Each item renders `tabIndex={0}` **before** the props spread, so a user's `tabindex={-1}` wins.
- The item calls the user's `onKeyDown` first, then the group's handler with `(event, value, grabbedFrom, grab)`.
- The group's handler ignores the event when `event.defaultPrevented`, when `event.target !== event.currentTarget`
  (keys from children such as an `<input>` inside the item), or when Alt, Ctrl or Meta is held.
- **Space** grabs (saving a copy of `values` as `from`; in svelte-motion this must be a real shallow copy,
  `[...values]`, see the revision note) or, if already grabbed, drops. Held-key repeats
  (`event.repeat`) are ignored. **Enter is not handled** (it keeps its tap meaning).
- When nothing is grabbed, every other key passes through untouched (arrows scroll the page).
- **Escape** while grabbed restores the `from` order: only values that existed at grab time are put back; values
  added during the grab keep their current slots. Then it drops. If nothing moved, `onReorder` is not called (the
  `commit` equality check from plan 003).
- **Arrows** while grabbed: only arrows along `axis` count: Up/Down for `'y'`, Left/Right for `'x'`, all four for
  `'xy'` (one step in the flat order). In RTL, Left and Right swap. Past either end, nothing happens. The move is
  `moveItem(order, index, target)` on the measured order, committed through `commit`.
- Every key the handler acts on gets `preventDefault()`. Ignored keys (cross-axis arrows while grabbed, other keys)
  are left alone.
- **Grabbed state** is shown only by `animationState.setActive('whileDrag', grabbed)`. No data attribute, no ARIA,
  no live region. `onDragStart` / `onDragEnd` are not called for keyboard grabs.
- **Blur** that really reaches the item (focus leaving: Tab away, click elsewhere) drops the grab and keeps the
  current order.
- Upstream code for the group handler:
  ```tsx
  onKeyDown: (event, item, from, grab) => {
      const { key, currentTarget } = event
      if (event.defaultPrevented || event.target !== currentTarget ||
          event.altKey || event.ctrlKey || event.metaKey) {
          return
      }
      const order = getOrder()
      const keyIndex = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].indexOf(key)
      const isX = keyIndex % 2
      if (key === " ") {
          event.repeat || grab(currentTarget, from ? undefined : values)
      } else if (!from) {
          return
      } else if (key === "Escape") {
          // Values added since the grab keep their slots.
          const kept = from.flatMap((value) => order.filter((data) => data.value === value))
          commit(order.map((data) => (from.includes(data.value) ? kept.shift()! : data)), item)
          grab(currentTarget)
      } else if (keyIndex < 0 || (axis !== "xy" && axis !== (isX ? "x" : "y"))) {
          return
      } else {
          const index = order.findIndex(({ value }) => value === item)
          const target = index + (keyIndex > 1 !== !!(isX && isRTL()) ? 1 : -1)
          index > -1 && order[target] && commit(moveItem(order, index, target), item)
      }
      event.preventDefault()
  },
  ```
- Upstream item:
  ```tsx
  const [grabbedFrom, setGrabbedFrom] = useState<V[]>()
  const grab = (element: Element, from?: V[]) => {
      setGrabbedFrom(from)
      visualElementStore.get(element)?.animationState?.setActive("whileDrag", !!from)
  }
  // …
  <Component drag={dragAxis} tabIndex={0} {...props} dragSnapToOrigin /* … */
      onKeyDown={(event) => { onKeyDown?.(event); handleKeyDown(event, value, grabbedFrom, grab) }}
      /**
       * A move blurs the item, but that blur is never dispatched:
       * React DOM disables its events while it commits, and restores
       * focus to the item before re-enabling them. So any blur that
       * reaches here is focus really leaving, which drops the item.
       */
      onBlur={(event) => { onBlur?.(event); grabbedFrom && grab(event.currentTarget) }}
  ```

## The Svelte-specific risk (design this carefully)

Svelte does neither of the two things React does for upstream. A keyed `{#each}` reorder moves DOM nodes with
`insertBefore`, and **which** node moves depends on the direction (see the click-guard comment in `Group.svelte`,
"whether it was clicked depended on which nodes Svelte's keyed each moved"). If the focused item's own node is
moved, the browser removes focus from it (focus goes to `<body>`), and Svelte does not restore it. Depending on the
browser, a `blur` may also be dispatched. Upstream's e2e tests check that focus and the grab survive moving both
up and down; they will catch this.

Required handling (replaces upstream's reliance on React's event suppression and focus restore):

- **Group `commit` reports whether it fired.** Change plan 003's `commit` to return `boolean` (`true` only when it
  called `onReorder`). `updateOrder` ignores the result. The context `onKeyDown` returns `true` when its `commit`
  call returned `true` (an arrow or Escape that produced a new order), else `false`.
- **Item `pendingRefocus` flag.** `let pendingRefocus = false` (plain `let`, not `$state`). In the key handler,
  record `const wasGrabbed = !!grabbedFrom` **before** calling `context.onKeyDown`, then
  `if (wasGrabbed && committed) pendingRefocus = true`. Any keydown first resets `pendingRefocus = false` (a
  consumer that rejected the previous proposal must not leave it stuck).
- **Refocus on a `values` change.** Add `trackOrder: () => void` to the context (Group implements it as
  `() => values.forEach(() => {})`, tracking identity and in-place contents like the existing guard effect). In
  `Item.svelte`:
  ```ts
  $effect(() => {
      context.trackOrder()
      untrack(() => {
          if (!pendingRefocus) return
          pendingRefocus = false
          if (ref && ref.ownerDocument.activeElement !== ref) ref.focus({ preventScroll: true })
      })
  })
  ```
  `$effect` runs after the keyed `{#each}` has moved the DOM, however late the consumer applies the new order
  (microtask, 120 ms timer, store). Refocusing does not depend on `grabbedFrom`, so Escape's restore keeps focus.
- **Blur.** A blur is a move-blur when `pendingRefocus && event.relatedTarget === null` (focus fell to `<body>`
  because the node moved). Ignore move-blurs entirely: don't drop the grab and don't call the consumer's `onblur`.
  Every other blur calls `onblur?.(event)` and, if grabbed, drops the grab (focus really left: Tab, or a click on
  another focusable element). A click on non-focusable background while a move is pending is treated as a
  move-blur until the next `values` change or keydown; record that edge in the Maintenance notes.
- The refocus fires the consumer's `onfocus` once per move. Upstream's React focus restore does too; leave it.

## Current state

- `src/lib/components/Reorder/context.ts:35-56`, `ReorderContextProps<V>` has `axis`, `registerItem`,
  `unregisterItem`, `updateOrder`, `getGroupElement`, `clearReordered`. Its JSDoc lists the Svelte adaptations.
- `src/lib/components/Reorder/Group.svelte` (after plan 003): `getMeasuredOrder()` returns `ItemData<V>[]` for
  measured values in `values` order; `commit(order, newOrder, moved)` writes the new order and fires `onReorder` only
  if it changed; `updateOrder` computes RTL as
  `ref?.ownerDocument.defaultView?.getComputedStyle(ref).direction === 'rtl'`. `checkReorder.ts:14` exports
  `moveItem([...arr], fromIndex, toIndex)` (an inline port of motion-utils' `moveItem`).
- `src/lib/components/Reorder/Item.svelte:27-37`, props:
  ```ts
      let {
          children,
          style,
          value,
          as = 'li',
          onDrag,
          onDragEnd,
          layout = true,
          ref = $bindable(),
          ...rest
      }: ReorderItemProps<V> = $props()
  ```
  and the markup (lines 116-128):
  ```svelte
  <MotionContainer
      bind:ref
      tag={as}
      drag={itemDrag}
      {...rest}
      dragSnapToOrigin
      style={itemStyle}
      {layout}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onLayoutMeasure={(box: LayoutMeasurePayload) => context.registerItem(value, box)}
      {motionValueChild}
  >
  ```
  Props before `{...rest}` are defaults the user can override; props after it are enforced.
- `visualElementStore` is exported by `motion-dom` and is keyed by the item's DOM element (svelte-motion's
  `_MotionContainer.svelte` imports it, line ~38). `visualElementStore.get(ref)?.animationState?.setActive('whileDrag', on)`
  is the same call upstream makes.
- `_MotionContainer.svelte` (around lines 1564-1574) only adds a default `tabindex` for `whileTap` when none was
  passed, so the item's explicit `tabindex={0}` doesn't conflict. motion-dom's `press` handles Enter for keyboard
  taps, not Space, so Space grabbing doesn't collide with `whileTap`.
- Tests and pages: unit `src/lib/components/Reorder/reorder.component.spec.ts` (uses `@testing-library/svelte`
  `render`, `screen.findByTestId`, fake timers), harness `__tests__/ReorderHarness.svelte`. Pages in
  `src/routes/tests/reorder/*` with specs in `e2e/reorder/*.spec.ts` (model: `axis-x`, shown in plan 003/001
  conventions: a `$state` array, a `data-testid="order"` readout).
- Docs: `docs/src/routes/docs/reorder/+page.svx` (sections `## Usage`, `## Axis`, …, `## Notes`, `## Props`).
  Examples: `docs/src/lib/examples/reorder/demos/{Default,AutoAxisRtl,Grid,Scrollable}.svelte`, listed in
  `docs/src/routes/examples/reorder/+page.svelte` as `ExampleSection` objects (`figId`, `tag`, `title`,
  `description`, `snippet`, `codeSnippet`, `notes`, `barCells`, `sourceUrl`). Copy the shape of the first section.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `pnpm check` | 0 errors |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E | `PW_PORT=4203 pnpm exec playwright test <paths>` | all pass |
| Docs check | `pnpm --dir docs check` (if the docs package has a `check` script; else skip) | 0 errors |

## Scope

**In scope**:

- `src/lib/components/Reorder/context.ts`, `Group.svelte`, `Item.svelte`, `types.ts` (JSDoc only, if needed)
- `src/lib/components/Reorder/keyboard.component.spec.ts` (create) and a harness
  `src/lib/components/Reorder/__tests__/KeyboardHarness.svelte` (create)
- `src/routes/tests/reorder/keyboard/+page.svelte` (create), `e2e/reorder/keyboard.spec.ts` (create)
- `src/routes/+page.svelte` (one link in the Reorder section)
- `docs/src/routes/docs/reorder/+page.svx` (a `## Keyboard` section)
- `docs/src/lib/examples/reorder/demos/Keyboard.svelte` (create) and its section in
  `docs/src/routes/examples/reorder/+page.svelte`
- `.changeset/reorder-keyboard.md` (create)

**Out of scope**: `autoScroll.ts` (plan 004), `checkReorder.ts` / `order.ts` (reuse, don't change),
`_MotionContainer.svelte`, ARIA / live-region announcements (upstream has none; a later a11y pass can add them).

## Git workflow

- Same lane as plan 003: `lane/1460-reorder` in `../svelte-motion-1460-reorder`, continuing after 003's commits.
- Conventional commits, e.g. `test(reorder): keyboard reordering (unit + e2e)`,
  `feat(reorder): keyboard grab-and-move reordering (Motion 14.6.0)`, `docs(reorder): keyboard section and example`.
  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

This is a net-new feature, so the first tests are written against the spec rather than to reproduce a bug. They
must still fail before Step 3 (items have no key handling yet).

### Step 1: Test page and e2e spec (port upstream)

1. Create `src/routes/tests/reorder/keyboard/+page.svelte`, a port of `dev/react/src/tests/issue-2658.tsx`:
   query params `axis=x`, `rtl`, `layout` (read in `onMount` into `$state`). `transition` in upstream wraps the
   update in `startTransition`; Svelte has none, so map `?transition` to applying the new order after
   `await Promise.resolve()` (a deferred update, the closest Svelte equivalent) and say so in a comment. Items
   `a,b,c,d`; `<button data-testid="before" id="before">`; `<div data-testid="order" id="order">`; group style as
   upstream (flex, row for x, `direction: rtl` for rtl, gap 10, no list style); each item `id={item}`,
   `whileDrag={{ opacity: 0.5, transition: { duration: 0 } }}`, `transition` linear 1 s with `?layout` else
   `{ duration: 0 }`, 80×40, `#eee`, containing the letter and `<input id="{item}-input" style="width:30px">`;
   `<button id="after">`; a 3000 px spacer.
2. Create `e2e/reorder/keyboard.spec.ts`, porting all 12 tests of `tests/react/issue-2658.spec.ts`, replacing
   `page.goto("?test=issue-2658…")` with `page.goto('/tests/reorder/keyboard?@isPlaywright=true…')`. Keep upstream's
   `order`, `focused`, `grabbed` (two-rAF wait, then items with computed opacity `0.5`) helpers and assertions
   verbatim, including "moving an item up keeps focus and the grab" and "a reorder in a transition keeps focus and
   the grab".
3. Link the page from the Reorder section of `src/routes/+page.svelte`.

**Verify**: `PW_PORT=4203 pnpm exec playwright test e2e/reorder/keyboard.spec.ts` → fails (items aren't focusable:
`focused` is not `a` after Tab). Commit (`test(reorder): keyboard reordering e2e`).

### Step 2: Unit tests

Create `__tests__/KeyboardHarness.svelte` (like `ReorderHarness.svelte`: `values`, `axis`, `onReorder`, plus an
`itemProps` record spread onto each item, `whileDrag={{ opacity: 0.5 }}`, and a nested `<input data-testid="input-{item}">`).
Create `keyboard.component.spec.ts` porting the cases from upstream `keyboard.test.tsx` that jsdom can observe:
Space grabs and drops (whileDrag active: assert via `visualElementStore.get(el)?.animationState` or the element's
inline opacity after a frame, whichever the harness exposes reliably); arrows move along `y`; cross-axis arrows are
ignored; `x` axis and RTL swap Left/Right; `xy` uses all four arrows; past the end does nothing; Escape restores and
calls `onReorder` with the restored order and the item; Escape with no move doesn't call `onReorder`; values added
during the grab keep their slots on Escape (`54c1645cc`); Enter doesn't grab; `event.repeat` Space is ignored;
modified arrows (Alt/Ctrl/Meta) are ignored; keys from the nested input are ignored; a user `onkeydown` that calls
`preventDefault()` blocks grabbing; blur drops the grab and keeps the order; `tabindex={-1}` from the user wins;
default `tabindex` is `0`; `onReorder`'s second argument is the moved item. jsdom needs measured layouts: stub
`getBoundingClientRect` like `reorder.component.spec.ts` does around line 195.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/keyboard.component.spec.ts` → fails (no key handling).
Commit (`test(reorder): keyboard reordering unit tests`).

### Step 3: Context and group handler

1. `context.ts`: add to `ReorderContextProps<V>`:
   ```ts
       /**
        * Handle a key on an item: Space grabs and drops, arrows along `axis`
        * move the grabbed item one place (Left and Right swap in RTL) and
        * Escape restores the order in `from`, the values when it was grabbed.
        * Mirrors Motion 14.6.0 `Reorder/Group.tsx` `onKeyDown`.
        */
       onKeyDown: (
           event: KeyboardEvent & { currentTarget: EventTarget & HTMLElement },
           item: V,
           from: V[] | undefined,
           grab: (element: HTMLElement, from?: V[]) => void
       ) => boolean
       /**
        * Read `values` (identity and contents) inside a reactive scope, so an
        * item can refocus itself after the list it belongs to is re-rendered.
        */
       trackOrder: () => void
   ```
   and bullets in the interface JSDoc for the Svelte differences: `onKeyDown` returns whether it committed a new
   order, and `trackOrder` exists because Svelte doesn't restore focus after a keyed-each move.
2. `Group.svelte`: implement `onKeyDown` in the context object, translating upstream's code above line for line,
   with `getMeasuredOrder()` for `getOrder()`, `moveItem` imported from `./checkReorder`, an `isRTL()` helper sharing
   the `direction === 'rtl'` expression with `updateOrder` (extract it), and `commit(order, newOrder, item)`. Note:
   plan 003's `commit` takes `(order, newOrder, moved)`; pass the measured `order` as the first argument. Changes
   from the line-for-line translation: Space grabs with `grab(currentTarget, from ? undefined : [...values])` (a
   copy, see the revision note); `commit` now returns `boolean` and the handler returns `true` only when the
   Escape or arrow `commit` returned `true` (every other path, including early returns, returns `false`).
3. Implement `trackOrder: () => values.forEach(() => {})` in the context object.

**Verify**: `pnpm check` → 0 errors (the item doesn't call it yet).

### Step 4: Item handler, focus, blur

In `Item.svelte`:

- Destructure `onkeydown` and `onblur` from props (keep them out of `rest`), and import `untrack` from `svelte` and
  `visualElementStore` from `motion-dom`.
- `let grabbedFrom = $state<V[] | undefined>(undefined)`, `let pendingRefocus = false`, and the `grab` function:
  ```ts
  const grab = (element: HTMLElement, from?: V[]) => {
      grabbedFrom = from
      visualElementStore.get(element)?.animationState?.setActive('whileDrag', !!from)
  }
  ```
- A key handler: `pendingRefocus = false`; call `onkeydown?.(event)`; `const wasGrabbed = !!grabbedFrom`;
  `const committed = context.onKeyDown(event, value, grabbedFrom, grab)`; `if (wasGrabbed && committed) pendingRefocus = true`.
- The refocus `$effect` exactly as in "Required handling".
- A blur handler: `if (pendingRefocus && event.relatedTarget === null) return`; then `onblur?.(event)`;
  `if (grabbedFrom) grab(event.currentTarget)`.
- Markup: add `tabindex={0}` **before** `{...rest}`, and `onkeydown={handleKeyDown}` `onblur={handleBlur}` **after**
  it (enforced). Add a comment explaining the Svelte deviation (no React event suppression or focus restore during
  a keyed-each move, so the item refocuses itself after `values` changes) and citing upstream `Item.tsx`.
- Update the component JSDoc with one line about keyboard reordering.

Add two cases to `e2e/reorder/keyboard.spec.ts` for the Svelte-specific paths (not in upstream; say so in a
comment): **"Escape that restores a moved item keeps focus"** (grab `b`, ArrowDown, Escape → order restored,
`focused` is `b`, not grabbed) and **"a deferred reorder keeps focus and the grab"** (add a `?deferred` mode to the
test page applying the new order after `setTimeout(…, 120)`, like `tests/reorder/deferred`; grab, ArrowDown, wait
for the order readout to change, expect `focused` and `grabbed` both still `b`). Add unit cases to
`keyboard.component.spec.ts`: **Escape restores the grab-time order when `values` is mutated in place** (the
harness's `onReorder` does `values.splice(0, values.length, ...next)` on a `$state` array) and **a move-blur
(`relatedTarget: null` while a move is pending) is not forwarded to the user's `onblur`**.

**Verify**:
- `pnpm exec vitest run src/lib/components/Reorder` → all pass, including `keyboard.component.spec.ts`.
- `PW_PORT=4203 pnpm exec playwright test e2e/reorder/keyboard.spec.ts` → all 14 pass. If a focus case fails, STOP
  and report `document.activeElement`, whether a `blur` fired and its `relatedTarget`, and when the `$effect` ran.
- `PW_PORT=4203 pnpm exec playwright test e2e/reorder` → all pass (pointer reordering unaffected).

### Step 5: Docs and example

1. `docs/src/routes/docs/reorder/+page.svx`: add `## Keyboard` before `## Notes`: the key table (Tab to focus, Space
   grab/drop, arrows along the axis (Left/Right swap in RTL), Escape restore and drop; Enter is left for taps;
   modified arrows and keys from inputs inside an item are ignored), that grabbing activates `whileDrag` (so style
   the grabbed state with `whileDrag`), that it's always on, and that `onkeydown` calling `preventDefault()` turns it off for an item.
   `tabindex={-1}` only removes the item's Tab stop: a click or `focus()` still focuses it, and Space then grabs. Note `onDragStart`/`onDragEnd` don't fire for keyboard grabs.
2. `docs/src/lib/examples/reorder/demos/Keyboard.svelte`: a small list (5 items) with a visible focus ring and
   `whileDrag={{ scale: 1.03, boxShadow: '…' }}`, plus a hint line "Tab to an item, Space to grab, arrows to move".
   Match the style of `demos/Default.svelte`.
3. Add its `ExampleSection` to `docs/src/routes/examples/reorder/+page.svelte` (copy the first section's shape; pick
   an existing `@lucide/svelte` icon already imported there, or import `Keyboard` from `@lucide/svelte` if the
   section shape needs an icon).
4. `.changeset/reorder-keyboard.md` (bump `minor`): "`Reorder.Item` is now keyboard reorderable (Motion 14.6.0):
   Space grabs and drops the focused item, arrow keys along the group's axis move it, and Escape restores the order.
   Items are focusable by default (`tabindex={0}`; `tabindex={-1}` removes the Tab stop, an `onkeydown` that calls
   `preventDefault()` turns keyboard reordering off). The grabbed item gets its `whileDrag` state."

**Verify**: `trunk check` on the changed docs and changeset → clean; the docs check (if any) → 0 errors.

### Step 6: Gate

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0),
`PW_PORT=4203 pnpm exec playwright test e2e/reorder` (all pass; re-run a failing spec alone once before reporting),
`git status` shows only in-scope files.

## Test plan

- Net-new feature, so no red-first reproduction of a bug; instead the ported upstream unit (`keyboard.component.spec.ts`)
  and e2e (`e2e/reorder/keyboard.spec.ts`) tests are written first and fail until Steps 3-4.
- The e2e suite is the only check of the Svelte focus risk (jsdom doesn't blur moved nodes).
- `e2e/reorder` as a whole guards pointer reordering.

## Done criteria

- [ ] `e2e/reorder/keyboard.spec.ts` (12 ported + 2 Svelte-specific tests) and `keyboard.component.spec.ts` pass
- [ ] `e2e/reorder` passes; `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0
- [ ] `grep -n "tabindex={0}" src/lib/components/Reorder/Item.svelte` → one match, before `{...rest}`
- [ ] Docs `## Keyboard` section, `Keyboard.svelte` demo and its example section exist; changeset exists
- [ ] Test page linked from `src/routes/+page.svelte`; no out-of-scope files modified

## STOP conditions

- Plan 003's `commit` helper is missing.
- A focus e2e case fails after Step 4 (report what Step 4's Verify asks for).
- Implementing the handler seems to need `_MotionContainer.svelte` or `checkReorder.ts` changes.
- Any existing `e2e/reorder` spec fails twice after Step 4.

## Maintenance notes

- Svelte deviation: the item refocuses itself from an `$effect` on `values` after a keyboard move, and ignores
  `relatedTarget === null` blurs while that move is pending. Known edge: a click on non-focusable background while
  a move is still pending (deferred consumer) doesn't drop the grab until the next `values` change or keydown.
- `commit` returns `boolean` and the context gained `trackOrder`; both are internal (not exported).
- Accessibility follow-ups intentionally not in upstream and not here: `aria-describedby` instructions, a live
  region announcing moves. If added later, keep them opt-in so the DOM matches upstream by default.
- Plan 004 changes auto-scroll speed; keyboard moves don't auto-scroll (upstream doesn't either).
