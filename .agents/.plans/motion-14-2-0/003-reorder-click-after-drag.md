# Plan 003: A release that ends a reordering drag never fires a click (Motion 14.1.1, #2682)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update this plan's status row in
> `.agents/.plans/motion-14-2-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Revision 2026-10-13 (guard pre-flight)**: runs after plan 001 on `feat/motion-14.2.0`, in
> `/Users/jasonkummerl/Github/svelte-motion-1420`, not in parallel (both plans need Playwright's fixed port 4198).
> Drift-check baseline moved to `origin/main` (`962a56df`); 001 does not touch `src/lib/components/Reorder`.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat origin/main..HEAD -- src/lib/components/Reorder`
> Expect no changes. On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none for the code. Ship it on the same branch as 001 (`feat/motion-14.2.0`), after 001.
- **Category**: bug (upstream parity)
- **Planned at**: commit `b9e59066`, 2026-10-13

## Why this matters

Upstream Motion 14.1.1 changelog: "`Reorder`: Fix click events on reordered items" (motion commit
`f1dddea8d`, issue #2682). After a drag that reorders, whether the item's and group's `onclick`
fired depended on drag direction: whether the browser still had one element holding both the press and
release targets after the keyed DOM move. svelte-motion's `Reorder` is a port of upstream's and
has the same bug. Svelte's keyed `{#each}` moves DOM nodes just like React does. The fix lives in
`framer-motion`'s React components, which svelte-motion re-implements, so it does **not** arrive with the
pin bump and must be hand-ported.

## Current state

Upstream fix @ `v14.2.0` (view with `git -C ~/Github/motion show f1dddea8d`):

- `Reorder/Group.tsx`: a `hasReordered` ref, set `true` next to `isReordering.current = true` in `updateOrder`.
  On the group element:
  ```tsx
  onPointerDownCapture={(event) => {
      hasReordered.current = false
      onPointerDownCapture?.(event)
  }}
  onClickCapture={(event) => {
      if (hasReordered.current && event.detail) {
          hasReordered.current = false
          event.stopPropagation()
          event.preventDefault()
      }
      onClickCapture?.(event)
  }}
  ```
  The comment explains: the flag clears when the drag ends (a frame after the release's click) or on the next
  press. Clicks with `detail === 0` (keyboard) are left alone.
- `Reorder/Item.tsx`: `onDragEnd` clears it first: `hasReordered.current = false  // Runs a frame after release, so after the release's click`.
- `Reorder/types.ts`: `ReorderContextProps` gains `hasReordered: { current: boolean }`.

svelte-motion today:

- `src/lib/components/Reorder/Group.svelte:26-35` destructures props
  (`children, as, axis: axisOverride, values, onReorder, style, ref = $bindable(), ...rest`) and
  forwards `{...rest}` to `<MotionContainer>`. `updateOrder` (lines ~87-100) sets `isReordering = true`
  then calls `onReorder(...)`.
- `src/lib/components/Reorder/Item.svelte:86-89`:
  ```ts
  const handleDragEnd = (event: PointerEvent, info: DragInfo) => {
      resetAutoScrollState()
      onDragEnd?.(event, info)
  }
  ```
- `src/lib/components/Reorder/context.ts`: `ReorderContextProps<V>` has `axis`, `registerItem`, `unregisterItem`,
  `updateOrder`, `getGroupElement`. Each member has a JSDoc line; match that style.
- Timing matches upstream. `onDragEnd` is invoked from `frame.postRender` (`src/lib/utils/drag.ts` ~1217
  `dispatchTerminal`), so it runs after the release's click event.
- Svelte 5 capture handlers are props named `onclickcapture` / `onpointerdowncapture`.
- Exemplars: page `src/routes/tests/reorder/basic/+page.svelte`, spec `e2e/reorder/basic.spec.ts` (its
  `dragVertically` helper). Unit harness: `src/lib/components/Reorder/__tests__/ReorderHarness.svelte` and
  `src/lib/components/Reorder/reorder.component.spec.ts` (jsdom; `dispatchMousePointer` helper).

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| New e2e | `pnpm playwright test e2e/reorder/click-after-drag.spec.ts` | see steps |
| Reorder e2e | `pnpm playwright test e2e/reorder` | all pass |
| Reorder unit | `pnpm vitest run src/lib/components/Reorder` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk check` | clean |

Port 4198 rule: check `lsof -ti :4198 -sTCP:LISTEN` before Playwright. If occupied, STOP and ask. Never kill it.

## Scope

**In scope**: `src/lib/components/Reorder/{Group.svelte,Item.svelte,context.ts}`,
`src/routes/tests/reorder/click-after-drag/+page.svelte` (create), `e2e/reorder/click-after-drag.spec.ts` (create),
`src/routes/+page.svelte` (one link in the "Reorder" section, ~line 407),
`src/lib/components/Reorder/reorder.component.spec.ts` (optional unit cases),
`.changeset/reorder-click-after-drag.md` (create, `patch`).

**Out of scope**: `src/lib/utils/drag.ts` (timing is already right), `Reorder/types.ts` public props
(capture handlers already flow through `HTMLElementProps`), docs pages. This is a bug fix, so no new docs page.

## Steps

### Step 1: Red e2e: the port of upstream issue-2682

Page `src/routes/tests/reorder/click-after-drag/+page.svelte`, ported from `dev/react/src/tests/issue-2682.tsx`
@ `v14.2.0`. Items `['a','b']`, `axis="y"`, the group's `onclick` appends `'group'`, each item's `onclick` appends its id,
items are 200×80 with `id`/`data-testid` `item-a`/`item-b`, red/blue, plus `data-testid="clicks"` (comma-joined) and `data-testid="order"`.
Add the guided human panel hidden under `@isPlaywright=true` (pattern: `src/routes/tests/animate-layout/toggle/+page.svelte`).

Spec `e2e/reorder/click-after-drag.spec.ts`, ported from `tests/react/issue-2682.spec.ts` @ `v14.2.0`
(same sequence: drag a +100 → order `b,a`; drag a −100 → order `a,b`; clicks still `''`; drag b −20 with no
reorder → clicks `b,group`; plain click a → `b,group,a,group`). Use 10 moves of 20 ms and wait 500 ms after `mouse.up()`, as upstream does.

**Verify**: `pnpm playwright test e2e/reorder/click-after-drag.spec.ts` → FAILS, with clicks non-empty after one of
the two reordering drags (most likely the upward drag, e.g. `expected "" received "a,group"`).
If it passes on unfixed code, STOP and report: Chromium may be dropping both clicks. Then try an
`axis="x"` variant before concluding.

### Step 2: Port the fix

1. `context.ts`: add to `ReorderContextProps<V>`:
   `/** Ends the reorder-click guard; called from Reorder.Item's onDragEnd, a frame after the release's click. */ clearReordered: () => void`.
   This is a Svelte adaptation of upstream's `hasReordered` ref. Note it in the interface's JSDoc adaptation list.
2. `Group.svelte`: destructure `onpointerdowncapture` and `onclickcapture` from props. Add
   `let hasReordered = false` next to `isReordering`, and set it `true` beside `isReordering = true` in `updateOrder`.
   Provide `clearReordered: () => { hasReordered = false }` in the context. Pass wrapped handlers to `<MotionContainer>`
   **after** `{...rest}`, mirroring upstream's semantics (clear on pointer-down capture; on click capture with
   `hasReordered && event.detail`, clear, `stopPropagation()`, `preventDefault()`; always call the consumer's handler).
   Port upstream's explanatory comment, adapted to Svelte's keyed each, and cite `Reorder/Group.tsx` @ v14.1.1.
3. `Item.svelte` `handleDragEnd`: call `context.clearReordered()` first, with upstream's comment.

**Verify**: `pnpm playwright test e2e/reorder/click-after-drag.spec.ts` → PASSES.

### Step 3: Optional unit coverage (jsdom)

Port upstream's four `"Reorder click after drag"` unit cases (`packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`
@ v14.2.0) into `reorder.component.spec.ts` if the existing `dispatchMousePointer` harness can drive a reorder in jsdom
(the "does not re-propose a swap until values change" test proves it can). Skip any case that needs real layout, and
say so in your report.

**Verify**: `pnpm vitest run src/lib/components/Reorder` → all pass.

### Step 4: Gate, link, changeset

Link "Reorder click after drag (#2682)" in the Reorder section of `src/routes/+page.svelte`. Create
`.changeset/reorder-click-after-drag.md` (`patch`): releasing a drag that reordered a `Reorder` list no longer clicks the
item or group, whichever direction it was dragged. Other clicks are unchanged.

**Verify**: `pnpm playwright test e2e/reorder` all pass; `pnpm check` 0 errors; `trunk check` clean; `git status` in scope only.

## Test plan

- Red anchor: `e2e/reorder/click-after-drag.spec.ts` fails before Step 2 and passes after it.
- Optional jsdom cases mirroring upstream's unit tests.

## Done criteria

- [ ] Red observed, now green
- [ ] `pnpm playwright test e2e/reorder` all pass
- [ ] `pnpm vitest run src/lib/components/Reorder` all pass; `pnpm check` 0 errors; `trunk check` clean
- [ ] Changeset and index link present; README row updated

## STOP conditions

- Red can't be reproduced in either axis.
- Any existing `e2e/reorder/*` spec regresses.
- The fix appears to need `drag.ts` changes (e.g. `onDragEnd` arriving before the click).

## Maintenance notes

- The guard relies on `onDragEnd` firing a frame after release. If `drag.ts` ever makes it synchronous on
  `pointerup`, the flag clears before the click and the bug returns. The e2e test will catch that.
- Keyboard-initiated clicks (`detail === 0`) are intentionally never swallowed.
