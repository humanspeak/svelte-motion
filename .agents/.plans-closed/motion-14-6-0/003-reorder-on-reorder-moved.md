# Plan 003: Pass the moved item to `onReorder`, and only call it when the order changed

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4203** (`PW_PORT=4203`). Never use or kill port 4198.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/components/Reorder/Group.svelte src/lib/components/Reorder/types.ts src/lib/components/Reorder/reorder.component.spec.ts src/lib/components/Reorder/__tests__/ReorderHarness.svelte docs/src/routes/docs/reorder/+page.svx`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive argument; TypeScript callers with one parameter keep compiling)
- **Depends on**: none
- **Wave**: 1
- **Category**: migration (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

Motion 14.6.0 calls `onReorder(newOrder, moved)`: the second argument is the value of the item that moved, so
apps can tell which item moved without diffing arrays (upstream issue #2603). Upstream also only calls
`onReorder` when the new order actually differs from `values`. svelte-motion still calls `onReorder(newOrder)`
with one argument. (Upstream's CHANGELOG lists this under 14.5.0, but the `v14.5.0` tag's `Group.tsx` doesn't have
it; it shipped in 14.6.0, so the 14.5 batch missed it.) This plan also adds the shared `commit` helper that plan
009 (keyboard reordering) reuses.

## Current state

- `src/lib/components/Reorder/types.ts:28-32`:
  ```ts
      /**
       * Fires with the new value order when a drag carries an item past
       * a sibling. Assign the result back to the state driving `values`.
       */
      onReorder: (newOrder: V[]) => void
  ```
- `src/lib/components/Reorder/Group.svelte:96-111` (inside `setReorderContext<V>({ … })`):
  ```ts
          updateOrder: (value, offset, velocity) => {
              if (isReordering) return

              const order = getMeasuredOrder()
              const direction =
                  ref?.ownerDocument.defaultView?.getComputedStyle(ref).direction === 'rtl'
                      ? 'rtl'
                      : 'ltr'
              const newOrder = checkReorder(order, value, offset, velocity, axis, direction)

              if (order !== newOrder) {
                  isReordering = true
                  hasReordered = true
                  onReorder(applyOrderSwap(values, order, newOrder))
              }
          },
  ```
  `applyOrderSwap(values, order, newOrder)` (`order.ts`) writes the measured items' new order back into their
  slots in `values`, leaving unmeasured values in place. Keep using it.
- `Group.svelte:13-16` component JSDoc has `@prop onReorder - Receives the new order after a swap.`
- `src/lib/components/Reorder/__tests__/ReorderHarness.svelte:15,24` types `onReorder?: (next: number[]) => void`
  and passes it straight to `Reorder.Group`.
- `src/lib/components/Reorder/reorder.component.spec.ts:219-220`:
  ```ts
          expect(onReorder).toHaveBeenCalledOnce()
          expect(onReorder).toHaveBeenLastCalledWith([1, 0, 2])
  ```
  (a drag of item `0` right past item `1` on `axis: 'x'`, values `[0, 1, 2]`). Line 434 asserts
  `toHaveBeenCalledWith([1, 2, 0])` and line 640 `toHaveBeenCalledWith(['b', 'a'])`. `toHaveBeenCalledWith`
  checks the full argument list, so those assertions fail once a second argument is passed: update them as part
  of this plan.
- `docs/src/routes/docs/reorder/+page.svx`, `### Reorder.Group` props table (around line 200):
  ```md
  | `onReorder` | `(newOrder: V[]) => void` | — | Fires with the new order after a swap (required) |
  ```

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/components/Reorder/Group.tsx` (read with
`git -C ~/Github/motion show v14.6.0:packages/framer-motion/src/components/Reorder/Group.tsx`):

```tsx
    /**
     * A callback to fire with the new value order. For instance, if the values
     * are provided as a state from `useState`, this could be the set state function.
     *
     * The second argument is the value of the item that moved. Its old and
     * new positions are `values.indexOf(moved)` and `newOrder.indexOf(moved)`.
     * This fires for each step of a drag, not once when it ends, so these
     * describe that step's move.
     *
     * @public
     */
    onReorder: (newOrder: V[], moved: V) => void
```

```tsx
    const commit = (newOrder: ItemData<V>[], moved: V) => {
        let i = 0
        const newValues = values.map((value) =>
            itemLayouts.current.has(value) ? newOrder[i++].value : value
        )
        newValues.some((value, j) => value !== values[j]) &&
            onReorder(newValues, moved)
    }
```

and in `updateOrder`, when the order changed: `isReordering.current = true; hasReordered.current = true; commit(newOrder, item)`.
Upstream tests: `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`, the cases mentioning
"moved" (`git -C ~/Github/motion show v14.6.0:packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx | grep -n moved`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm check` | 0 errors |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e dir | `PW_PORT=4203 pnpm exec playwright test e2e/reorder` | all pass |

## Scope

**In scope**:

- `src/lib/components/Reorder/Group.svelte`, `src/lib/components/Reorder/types.ts`
- `src/lib/components/Reorder/reorder.component.spec.ts`, `src/lib/components/Reorder/__tests__/ReorderHarness.svelte`
- `docs/src/routes/docs/reorder/+page.svx` (the props table row plus one short paragraph)
- `.changeset/reorder-on-reorder-moved.md` (create)

**Out of scope**:

- `Item.svelte`, `context.ts` (plan 009 adds keyboard handling there), `autoScroll.ts` (plan 004),
  `order.ts` / `checkReorder.ts` (no change needed).
- Demo pages: the existing ones pass `onReorder={(next) => (items = next)}`, which keeps working.

## Git workflow

- Lane branch `lane/1460-reorder` in `../svelte-motion-1460-reorder`, created by the dispatcher from the wave-0
  commit. Plan 009 later continues on this same lane.
- Conventional commits, e.g. `test(reorder): expect the moved item in onReorder`,
  `feat(reorder): pass the moved item to onReorder (Motion 14.6.0)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

In `src/lib/components/Reorder/reorder.component.spec.ts`:

1. Change line 220 to `expect(onReorder).toHaveBeenLastCalledWith([1, 0, 2], 0)` (item `0` is the dragged one).
2. Change line 434 and line 640 the same way, passing the dragged item's value as the second argument. Read each
   test to find which item it drags; if a test's dragged item is ambiguous, STOP and report.
3. Add `it('passes the moved item as the second argument to onReorder', …)`, modeled on the test containing line
   219, dragging item `2` left past item `1` on values `[0, 1, 2]`, expecting
   `onReorder.mock.lastCall` to equal `[[0, 2, 1], 2]`.

In `__tests__/ReorderHarness.svelte` change the prop type to `onReorder?: (next: number[], moved: number) => void`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/reorder.component.spec.ts` → the edited and new cases
**FAIL** (received one argument). If they pass, STOP.

Commit (`test(reorder): expect the moved item in onReorder`).

### Step 2: Implement `commit` and pass `moved`

1. `types.ts`: change the type to `onReorder: (newOrder: V[], moved: V) => void` and replace its JSDoc with
   upstream's wording (above), adapted: "Assign the result back to the state driving `values`" stays.
2. `Group.svelte`: add a `commit` helper next to `getMeasuredOrder`, with a short JSDoc:
   ```ts
   /**
    * Write the measured items' new order back into their slots in `values`,
    * leaving unmeasured values in place, and fire `onReorder` only if
    * something moved (Motion 14.6.0 `Reorder/Group.tsx` `commit`).
    */
   const commit = (order: ItemData<V>[], newOrder: ItemData<V>[], moved: V): void => {
       const newValues = applyOrderSwap(values, order, newOrder)
       if (newValues.some((value, index) => value !== values[index])) onReorder(newValues, moved)
   }
   ```
   and in `updateOrder` replace `onReorder(applyOrderSwap(values, order, newOrder))` with
   `commit(order, newOrder, value)`. Keep `isReordering = true` and `hasReordered = true` before it, as now.
3. Update the component JSDoc line to `@prop onReorder - Receives the new order and the moved item's value after a swap.`

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all pass.

### Step 3: Docs and changeset

1. `docs/src/routes/docs/reorder/+page.svx`: change the table row to
   `` | `onReorder` | `(newOrder: V[], moved: V) => void` | — | Fires with the new order and the moved item's value after each swap (required) | ``.
   Under the table add one paragraph: the moved item's old and new positions are `values.indexOf(moved)` and
   `newOrder.indexOf(moved)`; `onReorder` fires for each step of a drag, so they describe that step.
2. Create `.changeset/reorder-on-reorder-moved.md` (bump `minor`): "`Reorder.Group`'s `onReorder` now receives the
   moved item's value as a second argument, and is only called when the order actually changed (Motion 14.6.0)."

**Verify**: `trunk check docs/src/routes/docs/reorder/+page.svx .changeset/reorder-on-reorder-moved.md` → clean.

### Step 4: Full gate

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `PW_PORT=4203 pnpm exec playwright test e2e/reorder`
(all pass; if one fails, re-run it alone once before reporting), `git status` shows only in-scope files.

## Test plan

- Red-first: the three updated assertions and the new "moved item" test fail before Step 2 (one argument) and pass
  after.
- The existing Reorder unit and e2e suites guard the unchanged swap behavior.

## Done criteria

- [ ] `grep -n "moved: V" src/lib/components/Reorder/types.ts` → one match
- [ ] `grep -n "commit(order, newOrder, value)" src/lib/components/Reorder/Group.svelte` → one match
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `e2e/reorder` passes
- [ ] Docs row and changeset updated
- [ ] No files outside the in-scope list modified

## STOP conditions

- Step 1's edited assertions pass before the fix.
- A test's dragged item is ambiguous (Step 1.2).
- An `e2e/reorder` spec fails twice and the failure is not obviously caused by this change.
- The fix seems to need `Item.svelte` or `context.ts`.

## Maintenance notes

- Plan 009 (keyboard reordering) calls `commit(order, newOrder, item)` for arrow moves and Escape. Keep the helper's
  signature stable.
- The equality check matters for Escape-without-moving (plan 009): it must not fire `onReorder`.
