# Plan 003: `Reorder` keyboard: one tab stop, arrows move focus, grid rows as drawn

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do not edit the batch `README.md`.
>
> **Drift check (run first)**: `git diff --stat fb9ed218..HEAD -- src/lib/components/Reorder src/routes/tests/reorder e2e/reorder docs/src/routes/docs/reorder`. Expect no output. Otherwise compare the excerpts below with the live code and STOP on a mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (it changes focus behaviour that users and the existing tests rely on)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity, accessibility)
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

`Reorder.Group` and `Reorder.Item` are a drag-to-reorder list that can also be reordered from the keyboard: Space grabs, arrows move, Space drops and Escape cancels. This came from Motion 14.6.0. Motion 14.9.0 changed the keyboard model in four ways (upstream commits 238ebbbf4, ef41da512, f98ee430f, 8e33ea631):
- The list has **one** tab stop (a roving tabindex) instead of every item being in the tab order.
- Arrows move **focus** between items when nothing is grabbed.
- In a grid (`axis="xy"`), Up and Down move by the **row as drawn**, not by ±1 in list order.
- Only rendered items take focus.

This is the standard listbox/grid keyboard pattern. With a tab stop on every item, a long list costs one Tab press per item, which is an accessibility problem. Our port still has the 14.6.0 model.

## Current state

- `src/lib/components/Reorder/Item.svelte:176-195`: every item is a tab stop:
  ```svelte
  <MotionContainer
      bind:ref
      tag={as}
      drag={itemDrag}
      tabindex={0}
      {...rest}
      onkeydown={handleKeyDown}
      onblur={handleBlur}
      ...
  ```
  The comment above it (`:170-175`) says prop order mirrors upstream, so a consumer's `tabindex` after the spread wins. Keep that rule: upstream renders `tabIndex={isTabStop(value) ? 0 : -1}` *before* `{...props}`.
- `Item.svelte:125-153`: `handleKeyDown` calls `context.onKeyDown(event, value, grabbedFrom, grab)`. It sets `pendingRefocus` when a grabbed move commits, and a `$effect` refocuses the moved item after the keyed-each move. This Svelte-only refocus must keep working.
- `src/lib/components/Reorder/Group.svelte:135-181`: `onKeyDown`, a line-for-line port of 14.6.0:
  ```ts
  if (key === ' ') {
      if (!event.repeat) grab(currentTarget, from ? undefined : [...values])
  } else if (!from) {
      return false                       // ← 14.9.1: arrows move focus instead
  } else if (key === 'Escape') {
      ...
  } else if (keyIndex < 0 || (axis !== 'xy' && axis !== (isX ? 'x' : 'y'))) {
      return false
  } else {
      const index = order.findIndex(({ value }) => value === item)
      const target = index + (keyIndex > 1 !== !!(isX && isRTL()) ? 1 : -1)   // ← 14.9.1: keyTarget()
      if (index > -1 && order[target]) {
          committed = commit(order, moveItem(order, index, target), item)
      }
  }
  event.preventDefault()
  return committed
  ```
- `src/lib/components/Reorder/context.ts:68-71`: the `onKeyDown` docs cite "Motion 14.6.0". Update them to 14.9.1.
- `src/lib/components/Reorder/checkReorder.ts:123`: there is a private `getLines(order)` (rows of a wrapped layout), but no keyboard target function. `moveItem` is at `:14`.
- **Upstream 14.9.1 (the spec to port).** Read these in full with `git -C ~/Github/motion show v14.9.1:<path>`:
  - `packages/framer-motion/src/components/Reorder/Group.tsx:105-260`. It has `elements` (a map of value to element ref), `active` state, `tabStop = valuesSet.has(active) ? active : values[0]`, `isRendered(v) = elements.get(v)?.current?.isConnected`, `activate(v)` (only values in `values`), `checkTabStop()` (if the tab stop isn't rendered, activate the first rendered value) run after every render, and context fields `isTabStop(v) = v === tabStop || !valuesSet.has(v)`, `setActive`, `checkTabStop` and `elements`. In `onKeyDown` the arrow branch reads:
    ```ts
    const list = from ? order : order.filter(({ value }) => isRendered(value))
    const index = list.findIndex(({ value }) => value === item)
    const target = keyTarget(list, index, keyIndex, axis, !!isX && isRTL())
    if (target > -1) {
        from ? commit(moveItem(order, index, target), item)
             : elements.current.get(list[target].value)?.current?.focus()
    }
    ```
    The `else if (!from) return` branch is gone. Escape is now `else if (key === "Escape" && from)`, and Escape without a grab falls through to the arrow check, which returns because `keyIndex < 0`.
  - `packages/framer-motion/src/components/Reorder/Item.tsx`:
    - The item stores its element in `elements` and calls `checkTabStop` on unmount.
    - It renders `tabIndex={isTabStop(value) ? 0 : -1}` before the props spread.
    - `onFocus` calls the consumer's `onFocus` first, then `setActive(value)`.
  - `packages/framer-motion/src/components/Reorder/utils/check-reorder.ts`, `export function keyTarget(order, index, key, axis, isRTL)`:
    - `step` is +1 for Down/Right and -1 for Up/Left, with RTL swapping only Left/Right.
    - On `xy` with Up/Down, it takes `getLines(order)` sorted by `min` (top to bottom as drawn) and goes to the adjacent line. There it picks the item whose x-centre is nearest.
    - It returns `-1` when there is no target.
  - Tests:
    - `packages/framer-motion/src/components/Reorder/__tests__/keyboard.test.tsx` has 30 cases, listed at `:77-652`. These are the new or changed ones: "puts one item in the tab order, the first until one is focused", "makes the first rendered item the tab stop", "moves the tab stop on when its item is unrendered below the group", "keeps the tab stop when an item outside values is focused", "moves focus past values that aren't rendered", "moves focus with arrows until an item is grabbed" and "moves up and down by row in a grid".
    - `utils/__tests__/check-reorder.test.ts:161`: "moves by the row drawn above or below, not the next in order".
    - Playwright: `tests/react/reorder-keyboard-grid.spec.ts` with dev page `dev/react/src/tests/reorder-keyboard-grid.tsx`.
- Our tests:
  - `src/lib/components/Reorder/keyboard.component.spec.ts:84-215` mirrors the 14.6.0 upstream list.
  - Its case `it('leaves arrows to the browser until an item is grabbed', …)` (`:96-103`) and `it('makes items focusable', …)` (`:85-89`, which expects every item `tabIndex === 0`) encode the old model. They become upstream's "moves focus with arrows until an item is grabbed" and "puts one item in the tab order…". That is an intended behaviour change, not a regression.
- Pages: `src/routes/tests/reorder/keyboard/+page.svelte` (single list) and `src/routes/tests/reorder/grid/+page.svelte` (pointer grid). e2e: `e2e/reorder/keyboard.spec.ts`.
- Docs: `docs/src/routes/docs/reorder/+page.svx:189-210`, the keyboard section, which says "(Motion 14.6.0)". Docs imports use `#lib/....js`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Keyboard unit | `pnpm test:only src/lib/components/Reorder/keyboard.component.spec.ts` | as per step |
| checkReorder unit | `pnpm test:only src/lib/components/Reorder/checkReorder.spec.ts` | as per step |
| All Reorder units | `pnpm test:only src/lib/components/Reorder` | all pass |
| Types | `pnpm check` | `0 ERRORS` |
| Reorder e2e | `PW_PORT=4233 pnpm exec playwright test --project=chromium e2e/reorder` | all pass |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check` | exit 0, 0 errors |
| Format / lint | `trunk fmt <files>`; `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, never `git stash`. Revert any `docs/static/r/animated-tabs.json` change from the docs build.

## Scope

**In scope:**
- `src/lib/components/Reorder/Group.svelte`
- `src/lib/components/Reorder/Item.svelte`
- `src/lib/components/Reorder/context.ts`
- `src/lib/components/Reorder/checkReorder.ts` (export `keyTarget`)
- `src/lib/components/Reorder/keyboard.component.spec.ts`
- `src/lib/components/Reorder/checkReorder.spec.ts`
- `src/routes/tests/reorder/keyboard/+page.svelte` (update the steps)
- `src/routes/tests/reorder/keyboard-grid/+page.svelte` (create)
- `e2e/reorder/keyboard.spec.ts`
- `e2e/reorder/keyboard-grid.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `docs/src/routes/docs/reorder/+page.svx` (keyboard section)
- `.changeset/reorder-keyboard-roving-focus.md` (create)

**Out of scope:**
- Pointer drag reordering (`checkReorder`'s drag path, `autoScroll.ts`).
- `lazyMotion`/`m` Reorder wiring.
- The `Reorder` public prop types. Upstream added no public props.
- The Svelte refocus `$effect` in `Item.svelte`. Keep it; it may now also be reached by a focus move, which is fine.

## Git workflow

- Lane branch `lane/1491-reorder`. Use conventional commits, e.g. `test(reorder): port the 14.9.1 keyboard cases (red)` and `fix(reorder): roving tab stop and arrow focus (Motion 14.9)`.
- End each commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Red tests

1. In `keyboard.component.spec.ts`, port each new or changed upstream case listed under Current state. Use the file's existing `mount`/`item`/`press` helpers.
   - Replace `'makes items focusable'` with upstream's "puts one item in the tab order, the first until one is focused": the first item has `tabIndex` 0 and the others have -1. After focusing `c`, only `c` has 0.
   - Replace `'leaves arrows to the browser until an item is grabbed'` with "moves focus with arrows until an item is grabbed": ArrowDown on `a` focuses `b`, `onReorder` is not called, and the event is `defaultPrevented`.
   - jsdom has no layout. For the grid row case, follow how the existing spec fakes item layouts, or write that case only in e2e (step 1.3) and say so in a comment.
2. In `checkReorder.spec.ts`, port `check-reorder.test.ts`'s `keyTarget` cases at v14.9.1, including "moves by the row drawn above or below, not the next in order". Import `keyTarget` from `./checkReorder`. The import will fail to resolve, which is the expected red.
3. Create `src/routes/tests/reorder/keyboard-grid/+page.svelte`, a port of upstream `dev/react/src/tests/reorder-keyboard-grid.tsx` with the same items, the same CSS grid and the same ids. Create `e2e/reorder/keyboard-grid.spec.ts`, a port of `tests/react/reorder-keyboard-grid.spec.ts`, citing it in a header comment.
   - Add a `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`) with steps for: Tab once (one item focused), arrows moving focus, Space then ArrowDown moving a row, and Escape. Each step needs an `expected` and an action button where possible.
   - Make sure no list content sits under the panel at 1920 px wide. The panel is a fixed 360 px column on the right.
   - Link the page from `src/routes/+page.svelte` next to the other reorder entries.

**Verify**:
- `pnpm test:only src/lib/components/Reorder/keyboard.component.spec.ts` → the new cases FAIL. For example, the second item has `tabIndex` 0 instead of -1, and ArrowDown doesn't move focus.
- `pnpm test:only src/lib/components/Reorder/checkReorder.spec.ts` → FAILS (`keyTarget` is not exported).
- `PW_PORT=4233 pnpm exec playwright test --project=chromium e2e/reorder/keyboard-grid.spec.ts` → FAILS on the row move or the focus move.

Commit: `test(reorder): port the 14.9.1 keyboard cases (red on 14.6.0 model)`.

### Step 2: `keyTarget`

Port upstream `keyTarget` into `checkReorder.ts` as an export, line for line, using the existing `getLines` and a centre helper matching upstream's `center`. Add Google-style JSDoc that cites `check-reorder.ts` at v14.9.1.

**Verify**: `pnpm test:only src/lib/components/Reorder/checkReorder.spec.ts` → all pass.

### Step 3: Roving tab stop and arrow focus

1. **`Group.svelte`:**
   - Add an `elements` map (value → element getter) and an `active` `$state`.
   - Derive `tabStop`, and add `isRendered`, `activate` and `checkTabStop` exactly as upstream.
   - Run `checkTabStop` in an `$effect` that tracks `values` (the equivalent of upstream's `useEffect` with no deps).
   - Prune `elements` with the existing pruning effect.
   - In `onKeyDown`, apply the upstream branch structure quoted above: drop `else if (!from) return false`, make Escape `key === 'Escape' && from`, use `keyTarget`, and focus `list[target]` when not grabbed.
   - Keep the Svelte return value (`committed`).
2. **`context.ts`:** add `isTabStop`, `setActive`, `checkTabStop` and `elements` to the context type, with JSDoc as upstream's `types.ts`. Update the `onKeyDown` doc to 14.9.1.
3. **`Item.svelte`:**
   - Register `ref` in `context.elements` for `value`, and call `context.checkTabStop` in the teardown.
   - Render `tabindex={context.isTabStop(value) ? 0 : -1}` in place of `tabindex={0}`, still before `{...rest}`.
   - Add `onfocus` that calls the consumer's `onfocus` first, then `context.setActive(value)`. Take `onfocus` out of `rest` the same way `onkeydown`/`onblur` are handled.

**Verify**: all three red checks from Step 1 now PASS, and `pnpm test:only src/lib/components/Reorder` passes.

### Step 4: Update the existing keyboard page, docs and changeset

1. **`tests/reorder/keyboard/+page.svelte`:** update the TesterPanel steps so they state that Tab reaches one item, arrows move focus, and Space grabs.
2. **`e2e/reorder/keyboard.spec.ts`:** update any assertion that relied on every item being tabbable, citing upstream's new behaviour in a comment.
3. **Docs (`reorder/+page.svx` keyboard section):** say "(Motion 14.9)" and describe one tab stop, arrows moving focus, Space grab/drop, arrows moving the grabbed item, grid Up/Down by row and Escape. Keep the existing `preventDefault()` opt-out note.
4. **Changeset:** create `.changeset/reorder-keyboard-roving-focus.md` with frontmatter `'@humanspeak/svelte-motion': minor`. Body: "**Behaviour change (Motion 14.9 parity):** a `Reorder.Group` is now one tab stop: Tab reaches the first item, or the one focused last, and arrow keys move focus between items. Space still grabs and drops, and arrows move a grabbed item. In a grid (`axis=\"xy\"`), Up and Down move by the row as drawn. A `tabindex` on an item still overrides this."

**Verify**: `PW_PORT=4233 pnpm exec playwright test --project=chromium e2e/reorder` → all pass. Then the docs build and check → exit 0, 0 errors.

### Step 5: Gate

Run `pnpm check`, `pnpm test:only` and `pnpm build`. Then run e2e for `e2e/reorder` and `e2e/lazy-motion` (the `m` Reorder shares these components). Then run trunk on the changed files. All must be green.

## Test plan

- Red-first:
  - The new keyboard unit cases fail on the current model (every item has `tabIndex` 0, and arrows do nothing when nothing is grabbed).
  - `keyTarget` cases fail because the function is missing.
  - The grid e2e fails because Up/Down move ±1 in order.
  - All of them pass after Steps 2 and 3.
- Changed tests: the two old-model cases are replaced, not deleted. Their upstream replacements cover the same ground with the new contract.
- Regression: the existing grab, move, Escape and RTL cases stay green unchanged.

## Maintenance note

Svelte's keyed `{#each}` moves DOM nodes with `insertBefore`, and that blurs the moved item. React doesn't have that problem. `Item.svelte`'s `pendingRefocus` effect covers it. Any future change to focus handling must keep both the focus move and the grabbed-move refocus working. `e2e/reorder/keyboard.spec.ts` pins them.

## STOP conditions

- A Step 1 red case passes on current code. The port of that case is wrong.
- Upstream's grid test needs real layout and the jsdom fake can't express it. Keep that case e2e-only and note it. If e2e can't express it either, STOP.
- A non-keyboard Reorder test (drag, autoscroll, lazy) fails after Step 3.
