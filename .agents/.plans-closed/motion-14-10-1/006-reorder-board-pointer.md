# Plan 006: Add `Reorder.Board`: drag items between `Reorder.Group`s (pointer path)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. Step 1 is a **feasibility gate**: if it fails, STOP and report. Don't push on to later steps. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- src/lib/components/Reorder src/lib/reorder.ts src/lib/m.ts src/lib/index.ts src/routes/tests/reorder e2e/reorder src/routes/+page.svelte`
> Expected changes come from plans 003 (`checkReorder.ts`, `Group.svelte` `onKeyDown`, keyboard specs, `e2e/reorder/keyboard.spec.ts`), 004 (`autoScroll.ts` and its spec) and 001 (`src/lib/index.ts` press types, one `+page.svelte` link). Check that those changes are present (this plan builds on them), and that nothing *else* in these paths changed. On a surprise, STOP.

## Status

- **Priority**: P2
- **Effort**: L (multi-day; about 450 lines of logic plus about 25 ported tests)
- **Risk**: HIGH. It touches the drag path of every `Reorder.Item`, and the item handoff between Svelte `{#each}` blocks is new territory for this codebase.
- **Depends on**:
  - 001: motion-dom 14.10.1 provides `dragControls.start(e, { immediate: true })`, which this plan calls.
  - 003: it rewrote `Group.svelte` `onKeyDown`, and this plan edits `Group.svelte` next to it.
  - 004: per-axis auto-scroll state, which Board items need when they scroll on both axes each frame.
- **Wave**: 2
- **Category**: direction (upstream parity feature)
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

Motion 14.10 ships `Reorder.Board`: a wrapper that lets a `Reorder.Item` be dragged out of one `Reorder.Group` and into another, kanban-style. The source group calls `onReorder` without the item, the target group calls `onReorder` with it, and the drag continues seamlessly in the new group. It's exported from upstream's `Reorder` namespace (`Reorder/namespace.ts`, `m-namespace.ts`). It isn't in the changelog, but it is public, JSDoc'd API.

Our `Reorder` is a hand port, so we don't have it. This plan ports the **pointer** path, plus the scaffolding the keyboard path (plan 007) and docs (plan 008) build on.

## Current state

### Upstream (local clone `~/Github/motion`, tag `v14.10.1`)

Read these files in full before starting:
- `packages/framer-motion/src/components/Reorder/Board.tsx` (495 lines): `createBoard()` and the `ReorderBoard` component.
- `packages/framer-motion/src/components/Reorder/types.ts:30-131`: `ReorderContextProps` gains `values`, `onReorder` and `getOrder`; `ItemData.ref`; and the `ReorderBoardContextProps` contract (`add`, `drag`, `key`, `restore`, `end`, `isMoving`, `receive`, `column`).
- `packages/framer-motion/src/context/ReorderBoardContext.ts`.
- `packages/framer-motion/src/components/Reorder/Group.tsx` at v14.10.1. Board-related: `board?.add(context)` in a layout effect, context fields `values`/`onReorder`/`getOrder`, and `registerItem(value, layout, ref)`.
- `packages/framer-motion/src/components/Reorder/Item.tsx:95-260` at v14.10.1. Board-related:
  - `dragAxis = axis === "xy" || board ? true : axis`
  - `grab` calls `from || board?.end(value)`
  - `isContinued` with `board?.receive(...)` in a mount layout effect, which suppresses the second `onDragStart`
  - `onDrag`: `board?.drag(context, value, ref.current, event) || updateOrder(...)`, then auto-scroll on `["x","y"]` when in a board, scrolling `board.column(context)` across the groups' axis
  - `onDragEnd`: `board?.end(value)`
- Tests:
  - `packages/framer-motion/src/components/Reorder/__tests__/board.test.tsx`. Its jsdom layout fixture (`rect`, `elementsFromPoint`, `pointer`) is at `:1-110`. The blocks to port are "Reorder.Board" (`:244`), "Reorder without a Board" (`:778`) and "unmounted (virtualized) items" (`:828`).
  - `packages/framer-motion/cypress/integration/reorder-board.ts`.
  - Dev pages `dev/react/src/tests/reorder-board.tsx` and `reorder-board-scroll.tsx`.

How a pointer move works upstream (`Board.tsx` `drag` → `move` → `receive`):
1. On every `onDrag`, the item calls `board.drag(group, value, element, event)`.
   - It returns `false` if `!element.isConnected`.
   - If a handoff is in flight (`handoff?.controls?.isDragging`), it only refreshes `handoff.centre`/`handoff.event` and returns `true`.
   - Otherwise it hit-tests `elementsFromPoint(centre)`, skipping the item's own subtree, to find a registered group's element. It checks `canMove`, which excludes nested groups and the app's `canMove(value, from.values, to.values)`.
   - It then calls `move()` with `{ controls: elementDragControls.get(visualElementStore.get(element)), event }`.
2. `move()` does the following:
   - picks the slot: the first *connected* item in `to.getOrder()` whose centre is after the point (`isBefore`, which handles RTL and `xy`), otherwise after the last item;
   - records `handoff = { value, to, element, centre: pageCentre(element), controls, event }`;
   - sets `to.hasReordered = true`;
   - calls `from.onReorder(without)`, then `to.onReorder(with)`.
3. The new `Item` mounts and calls `board.receive(group, value, element, grab)` in a layout effect. If the handoff matches, it runs, in `microtask.read`:
   - copy every motion value from the **old** visual element to the new one;
   - set the new `x`/`y` to old page centre − new page centre (through `getTransformPagePoint()`), then `render()`;
   - `isMoved ? controls.cancel() : controls.stop()` on the old drag;
   - `nextControls.start(latest.event, { immediate: true })`.

   `receive` returns `isMoved`, so the new item skips `onDragStart`.

### Ours

- `src/lib/components/Reorder/Group.svelte` (302 lines). It publishes its context **once** via `setReorderContext({...})` (`:131-214`), with getters (`get axis()`, `get kind()`). It has:
  - private `hasReordered` (`:129`);
  - `getMeasuredOrder()` (`:83-87`), which returns `{ value, layout }[]` for measured values in `values` order;
  - `elements: Map<V, () => HTMLElement | null | undefined>` (`:65`), holding each item's element getter;
  - `isRendered(value)` (`:71`);
  - `commit()` (`:96-101`).

  `values` and `onReorder` are props. **Plan 003** has already rewritten `onKeyDown` in this file. Leave it.
- `src/lib/components/Reorder/Item.svelte` (233 lines; read it in full).
  - `itemDrag` is at `:57`.
  - `handleDrag` (`:76-92`) calls `context.updateOrder(...)`, then `autoScrollIfNeeded(context.getGroupElement(), pointerPosition /* CLIENT coords */, scrollAxis, …)`.
  - `handleDragEnd` (`:94-99`).
  - `element` is `$state` (`:110-115`).
  - `grab` (`:152-156`) does `grabbedFrom = from` and `visualElementStore.get(element)?.animationState?.setActive('whileDrag', !!from)`.
  - `onDragStart` is **not** destructured. It reaches `MotionContainer` through `...rest`.
- `src/lib/components/Reorder/context.ts`: `ReorderContextProps<V>` (`:41-115`), `ItemData<V> = { value, layout }`, and `setReorderContext`/`getReorderContext` with `REORDER_CONTEXT_KEY = Symbol(...)` (`:117-132`). Copy this pattern for the board context.
- `src/lib/components/Reorder/types.ts`: `ReorderGroupProps<V>`, `ReorderItemProps<V>`, `ReorderAxis`.
- `src/lib/components/Reorder/autoScroll.ts` (after plan 004): `autoScrollIfNeeded(groupElement, pointerPosition, axis, velocity)` with per-axis state.
- Namespaces:
  - `src/lib/reorder.ts` exports `Reorder = { Group, Item }`.
  - `src/lib/m.ts:59-65` exports `Reorder = { Group: withMotionKind(Group, …), Item }`.
  - `src/lib/index.ts:7-12` exports the Reorder types.
- **Drag internals we rely on**:
  - `src/lib/html/_MotionContainer.svelte:34` imports `elementDragControls` from motion-dom.
  - `:1483-1487` reads `elementDragControls.get(visualElement)?.isDragging`.
  - `src/lib/utils/visualElementCore.ts:323` constructs motion-dom's `VisualElementDragControls`.
  - `visualElementCore.ts:415-420` (`DragGestureFeature.unmount`) **keeps a live pan session running** when the element unmounts mid-drag (`if (!this.controls.isDragging) this.controls.endPanSession()`).
- **Svelte-specific hazard 1, the store entry.** `_MotionContainer.svelte:2331-2337` teardown runs `if (node.current === mounted) node.unmount(); visualElementStore.delete(mounted)`. Svelte destroys the old `{#each}` row in the same flush that mounts the new one, so by the time `receive`'s microtask runs, `visualElementStore.get(oldElement)` is **undefined**. Upstream's value copy (`Board.tsx` `visualElementStore.get(latest.element)?.values.forEach(...)`) would silently do nothing. **Fix (deliberate deviation):** capture the old `VisualElement` itself in the handoff at `move` time (`handoff.visualElement`) and copy from it.
- **Svelte-specific hazard 2, timing.** `receive` needs the new item's VisualElement mounted, its features updated (`_MotionContainer.svelte:2287-2291`, `node.updateFeatures()`), and its drag listeners attached, so that `elementDragControls.get(ve)` exists. Svelte runs a child component's effects before its parent's `$effect`s in the same flush, but this must be **verified** (Step 1).
- **Svelte-specific hazard 3, the stale closure.** After the old row is destroyed, its pan session keeps calling the destroyed `Item`'s `handleDrag` until `controls.cancel()`. That closure must not throw:
  - `board.drag` returns `false` for a detached element.
  - `context.updateOrder` on the old group then sees a value no longer in `values`. `checkReorder` returns the same order for an unknown value; see `checkReorder.spec.ts` "returns the same array for an unknown value".
- Test patterns:
  - `src/lib/components/Reorder/reorder.component.spec.ts` with `__tests__/ReorderHarness.svelte`.
  - `src/lib/components/Reorder/lazyMotion.component.spec.ts` (`m` entry).
  - Pages and e2e: `src/routes/tests/reorder/scrollable/+page.svelte` with `e2e/reorder/scrollable.spec.ts`. Index links: `src/routes/+page.svelte:661-780` (`/tests/reorder/*`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated |
| Reorder units | `pnpm exec vitest run src/lib/components/Reorder` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| e2e | `PW_PORT=4246 pnpm exec playwright test --project=chromium e2e/reorder e2e/lazy-motion` | all pass |
| Consumer | `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | exit 0 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/components/Reorder/board.ts` (create: `createBoard`, `setReorderBoardContext`, `getReorderBoardContext`, and the pure helpers `centre`, `pageCentre`, `isBefore`, `isNested`)
- `src/lib/components/Reorder/board.spec.ts` (create: unit tests for the pure helpers)
- `src/lib/components/Reorder/Board.svelte` (create)
- `src/lib/components/Reorder/context.ts` (new context members; board contract types)
- `src/lib/components/Reorder/types.ts` (`ReorderBoardProps<V>`)
- `src/lib/components/Reorder/Group.svelte` (board registration and the new context members only; **not** `onKeyDown`)
- `src/lib/components/Reorder/Item.svelte`
- `src/lib/components/Reorder/__tests__/BoardHarness.svelte` and `src/lib/components/Reorder/board.component.spec.ts` (create)
- `src/lib/reorder.ts`, `src/lib/m.ts` (add `Board`)
- `src/lib/index.ts` (export `ReorderBoardProps` with the other Reorder types at `:7-12`)
- `src/routes/tests/reorder/board/+page.svelte` (create; supports `?overflow`) and `e2e/reorder/board.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `tests/consumer-vite6/src/ReorderSsr.svelte` (optional: add a Board, if that fixture SSR-renders Reorder)
- `.changeset/reorder-board.md` (create)

**Out of scope:**
- Keyboard moves between groups: `board.key`, `board.restore`, `board.isMoving`, the keys branch of `receive`, and any `onKeyDown` change. That is plan 007. Leave `key`/`restore` **unimplemented in the type** too; plan 007 adds them.
- Docs and examples (plan 008).
- `autoScroll.ts` (plan 004 owns it; call it, don't edit it).
- `_MotionContainer.svelte` and `visualElementCore.ts`. If the handoff can't work without changing them, that's a STOP.
- The React-only `merge-refs.ts`.

## Git workflow

- Lane branch `lane/14101-board`, cut from `feat/motion-14.10.1` after 001, 003 and 004 are merged.
- Use conventional commits, for example `test(reorder): board pointer handoff (red)` and `feat(reorder): Reorder.Board moves dragged items between groups (Motion 14.10)`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commit the spike result (Step 1) on its own.
- Do not push.

## Steps

### Step 1: Feasibility spike: hand a live drag from one `{#each}` row to another (gate)

Before building the board, prove the one mechanism Svelte might not support. In `src/lib/components/Reorder/__tests__/BoardHarness.svelte`, build **only** this:
- Two lists (`ul`s), each a plain `{#each}` of `Reorder.Item`-free `motion.li` elements with `drag`.
- A button-free script hook (exported function) that, on the first `onDrag` of item `a` in list 1, does the following:
  1. Captures `const ve = visualElementStore.get(el)` and `const controls = elementDragControls.get(ve)`, plus the event.
  2. Moves `a` from list 1's state to list 2's state.
  3. In the new `a`'s mount (`$effect` in a wrapper component around its `motion.li`), schedules `microtask.read(...)` (from motion-dom). It copies `ve.values` into the new VE, calls `controls.cancel()`, then calls `elementDragControls.get(newVe).start(lastEvent, { immediate: true })`.

Create `src/lib/components/Reorder/board.component.spec.ts`:
- Port upstream's jsdom layout fixture verbatim: `box`, `translate`, `rect`, `elementsFromPoint`, `pointer`, and the `beforeEach`/`afterEach` at `board.test.tsx:14-110`.
- One test, "spike: a drag continues on the element that replaces it": pointerdown on `a`, move it twice, then flush (`await vi.advanceTimersByTimeAsync(50)` or real waits, following `reorder.component.spec.ts`'s timer style). Assert:
  - (a) `a` is now in list 2's DOM;
  - (b) a further `pointermove` moves the **new** element (its `style.transform` translate changes);
  - (c) `pointerup` fires `onDragEnd` on the new element once, with no exception.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/board.component.spec.ts` → PASS.

- **If it can't pass without editing `_MotionContainer.svelte` or `visualElementCore.ts`, STOP.** Report what failed and which hazard it was (store entry, effect timing, or stale closure). The maintainer decides on core changes.
- Record in the commit message which effect order you observed: whether the child VE's features were ready inside the wrapper's `$effect`.

Commit: `test(reorder): spike a drag handoff between keyed-each rows`.

Then **rewrite the harness** into the real `BoardHarness.svelte` used below: `Reorder.Board` around 2–3 `Reorder.Group`s, with props for `canMove`, `axis`, `stacked`, per-group values, `onDragStart`/`onDragEnd` spies and `lazy` (an `m` entry inside `LazyMotion`). Keep the spike test, rewritten against the real components, as "a drag continues on the element that replaces it".

### Step 2: Port the upstream pointer tests (red)

In `board.component.spec.ts`, port these upstream tests (`board.test.tsx` at v14.10.1). Use our harness, and Vitest instead of Jest (`vi.fn`, fake or real timers as our other Reorder component specs do).
- "Reorder.Board" block (`:244` onward):
  - moves into the group under its centre
  - keeps going from where it was in the new group
  - drops past the last item, and into an empty group
  - moves back to a group it came from
  - snaps into its new slot on release and ends the drag once
  - keeps `whileDrag`
  - drag ends if released before the drag carries on
  - continues from where the pointer is when the commit lands late
  - carries the motion values into the new group
  - items in a board move on both axes
  - item stays put if the groups don't take it
  - works with the `m` entry inside `LazyMotion`
  - scrolls the container around the groups, not the item's column
  - drops into a virtualized group according to the items it shows
  - item moves again in a later gesture after a refusal
  - `canMove` refusal leaves the item in its group
  - no moves between a group and a group nested inside its items
  - drag continues after the dragged item unmounts mid-drag
- "Reorder without a Board" (`:778`).
- "unmounted (virtualized) items" (`:828`). Our group already prunes unmounted items. Port the tests anyway.
- **Skip** any test that depends on React StrictMode or React commit timing that has no Svelte equivalent. List each skipped test by name with a one-line reason in the spec file's header comment.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/board.component.spec.ts` → the ported tests FAIL (for example, `Reorder.Board` is undefined). The spike test passes.

### Step 3: Board contract and context plumbing

1. In `context.ts`:
   - Add `ReorderBoardContextProps`, with **only** `add`, `drag`, `end`, `receive` and `column`, typed for our `ReorderContextProps` as the group identity.
   - Add to `ReorderContextProps<V>`, with JSDoc:
     - `readonly values: V[]` (getter)
     - `onReorder(newOrder, moved)`
     - `getOrder(): ItemData<V>[]` (the measured order)
     - `markReordered(): void`, which replaces upstream's `to.hasReordered.current = true`. Keep `clearReordered`.
   - Group identity is the context object itself. Board code uses `group.getGroupElement()` where upstream uses `groupRef.current`, and `group.elements.get(value)?.()` where upstream uses `item.ref.current`.
2. In `Group.svelte`, add those members to the `setReorderContext({...})` object (`get values()`, `onReorder: (o, m) => onReorder(o, m)`, `getOrder: getMeasuredOrder`, `markReordered: () => { hasReordered = true }`). Also add:
   ```ts
   const board = getReorderBoardContext()
   $effect(() => board?.add(context))   // context = the object passed to setReorderContext
   ```
   To do this, assign the context object to a `const context = {...}` first, then call `setReorderContext(context)`.

**Verify**: `pnpm check` → 0 errors, and `pnpm exec vitest run src/lib/components/Reorder` → all **old** tests pass. This step must not change plain-group behaviour.

### Step 4: `board.ts` and `Board.svelte`

1. Create `board.ts`, porting `Board.tsx` `createBoard` and its helpers (`centre`, `pageCentre`, `isBefore`, `isNested`) line for line. Port only `add`, `drag`, `move`, `end`, `receive` (without the `keys` branch) and `column`. Deviations, each marked with a `// Svelte:` comment:
   - Group identity is the context object. `group.getGroupElement()` replaces `groupRef.current`.
   - `move()` picks the slot from `to.getOrder()` filtered to items whose `to.elements.get(value)?.()` is connected.
   - The handoff stores `visualElement` (the old VE, captured in `drag` via `visualElementStore.get(element)`). `receive` copies values from `latest.visualElement`, not from `visualElementStore.get(latest.element)` (hazard 1).
   - `to.markReordered()` replaces `to.hasReordered.current = true`.
   - `props` is a getter: `createBoard(getProps: () => { canMove? })`.
   - Add Google-style JSDoc on every export and cite `Board.tsx` line ranges at v14.10.1.

   Plus `setReorderBoardContext`/`getReorderBoardContext`, following `context.ts:117-132`.
2. Create `board.spec.ts` with unit tests for `centre`, `pageCentre`, `isBefore` (x, y, xy and RTL cases, ported from the semantics in `Board.tsx:85-104`) and `isNested`. Export these helpers for testing.
3. Create `Board.svelte` (`<script lang="ts" generics="V">`):
   - Props `{ canMove?: (value: V, from: V[], to: V[]) => boolean; children?: Snippet }`.
   - `setReorderBoardContext(createBoard(() => ({ canMove })))`.
   - Render `{@render children?.()}` with **no wrapper element**, like upstream's Provider-only component.
   - Header JSDoc ported from upstream's `ReorderBoard` JSDoc (`Board.tsx:442-473`), with a Svelte example. Keep the line "Values must be unique across the groups".
4. In `types.ts`, add `ReorderBoardProps<V>`. Add `Board` to `src/lib/reorder.ts` and `src/lib/m.ts` (a plain `Board`, no `withMotionKind`; it renders no element). Update both namespace types and JSDoc examples. Export `ReorderBoardProps` from `src/lib/index.ts`.

**Verify**: `pnpm check` → 0 errors, and `pnpm exec vitest run src/lib/components/Reorder/board.spec.ts` → PASS.

### Step 5: `Item.svelte` board hooks

Port the Board parts of upstream `Item.tsx` into `Item.svelte`:
- `const board = getReorderBoardContext()`.
- `itemDrag`: `reorderAxis === 'xy' || board ? true : reorderAxis`.
- Destructure `onDragStart` from props. Pass a wrapper to `MotionContainer` that skips the user callback once when `isContinued` is set, then clears the flag (upstream `Item.tsx` `isContinued`).
- In `handleDrag`:
  - `board?.drag(context, value, element!, event) || context.updateOrder(value, offset, info.velocity)`.
  - Scroll axes: `board ? ['x','y'] : [selectAutoScrollAxis(reorderAxis, info.velocity)]`. For each axis, the target is `board && !reorderAxis.includes(scrollAxis) ? board.column(context) : context.getGroupElement()`.
  - Keep **client** coordinates (`event.clientX/Y`), per `autoScroll.ts`'s header comment.
  - Guard: if `element` is not connected, still call `onDrag?.(…)`. Never throw (hazard 3).
- In `handleDragEnd`: add `board?.end(value)`.
- In `grab`: add `if (!from) board?.end(value)`.
- On mount: run `board?.receive(context, value, element, grab)` once the element and its VE exist, using the timing proven in Step 1. If it returns true, set `isContinued = true`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → the Step 2 tests now PASS (except documented skips), and every pre-existing Reorder test still passes.

### Step 6: Test page and e2e

1. Create `src/routes/tests/reorder/board/+page.svelte`, a Svelte port of upstream `dev/react/src/tests/reorder-board.tsx`:
   - three columns (`todo`, `doing`, `done`), with `data-testid`s matching the Cypress spec;
   - a `drags` counter (`onDragStart` count per item);
   - `?overflow` mode, ported from `reorder-board-scroll.tsx`: a page that scrolls horizontally and columns that scroll vertically;
   - a `TesterPanel` with steps "Drag a card into the next column", "Drag a card into the empty column" and "(overflow) Drag to the right edge: the board scrolls, not the column".
2. Create `e2e/reorder/board.spec.ts`, porting `packages/framer-motion/cypress/integration/reorder-board.ts`. Skip its keyboard test (plan 007 adds it). Header comment cites the upstream spec.
3. Link the page from `src/routes/+page.svelte` after `/tests/reorder/ref-constraints-scroll`.

**Verify**: `PW_PORT=4246 pnpm exec playwright test --project=chromium e2e/reorder/board.spec.ts` → all PASS, and also with `--project=firefox` if it's installed.

### Step 7: Changeset and full gate

1. Create `.changeset/reorder-board.md` with frontmatter `'@humanspeak/svelte-motion': minor`. Body: "Add `Reorder.Board`: drag `Reorder.Item`s between the `Reorder.Group`s inside it, with `canMove` to refuse a move (Motion 14.10). Items in a board drag on both axes and auto-scroll the containers around the groups."
2. Run `pnpm check`, `pnpm test:only`, `PW_PORT=4246 pnpm exec playwright test --project=chromium e2e/reorder e2e/lazy-motion`, and `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass; the consumer passes. This checks that tree-shaking a `Reorder` import without `Board` still works.

## Test plan

- **Gate**: the Step 1 spike test, kept as a permanent test.
- **Red first**: the upstream "Reorder.Board", "without a Board" and "virtualized" blocks ported to `board.component.spec.ts`, each failing before Steps 3–5. Skips are listed with reasons in the spec header.
- **Unit**: `board.spec.ts` covers the pure geometry helpers.
- **e2e**: the Cypress `reorder-board.ts` port, minus keyboard.
- **Regression**: every existing `src/lib/components/Reorder/*.spec.ts`, plus `e2e/reorder/*` and `e2e/lazy-motion/reorder-*`.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass; `board.component.spec.ts` has at least 18 passing tests
- [ ] `PW_PORT=4246 pnpm exec playwright test --project=chromium e2e/reorder e2e/lazy-motion` → all pass
- [ ] `grep -n "Board" src/lib/reorder.ts src/lib/m.ts` → matches in both
- [ ] `git diff --name-only` shows no change to `src/lib/html/_MotionContainer.svelte` or `src/lib/utils/visualElementCore.ts`
- [ ] Consumer fixture passes

## STOP conditions

- Step 1's spike can't pass without core changes, or passes only with arbitrary `setTimeout` delays.
- An existing Reorder unit or e2e test fails after Step 3 or Step 5 and the cause isn't obvious within two attempts.
- More than 4 upstream pointer tests have to be skipped as "React-only". That would mean the port diverges too far; report the list.
- `elementDragControls.get(newVisualElement)` is undefined when `receive` runs, because drag listeners attach later than expected and the Step 1 timing doesn't carry over to `Reorder.Item`.

## Maintenance notes

- `board.ts` is a near-verbatim port. Keep the `// Svelte:` deviation comments, so the next upstream diff (`git -C ~/Github/motion diff <old> <new> -- packages/framer-motion/src/components/Reorder/Board.tsx`) maps onto it line by line.
- Plan 007 adds `key`/`restore`/`isMoving` and the keys branch of `receive`, and restructures `Group.svelte` `onKeyDown`. Leave clean seams: a `receive` with an early `if (keys) …` placeholder is **not** wanted. Simply omit it.
- Reviewer focus:
  - the stale-closure guard in `handleDrag`;
  - that a `Reorder.Group` *outside* a Board behaves exactly as before (the "without a Board" tests);
  - that `onDragStart` still fires for normal drags.
