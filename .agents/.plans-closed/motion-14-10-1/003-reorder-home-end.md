# Plan 003: Home and End move focus, or the grabbed item, to either end of a `Reorder.Group`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- src/lib/components/Reorder/checkReorder.ts src/lib/components/Reorder/checkReorder.spec.ts src/lib/components/Reorder/Group.svelte src/lib/components/Reorder/context.ts src/lib/components/Reorder/keyboard.component.spec.ts e2e/reorder/keyboard.spec.ts docs/src/routes/docs/reorder/+page.svx`
> The only expected change is this batch folder. If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.
>
> Revision 2026-11-06: The "behaviour change hidden in that logic" premise was wrong. Our 14.9.1 port already called `preventDefault` for along-axis keys with nowhere to go; it only returned early for keys across the axis. The executor showed this, and the guard verified it at `2b1ef67e` (`Group.svelte:196-206`). So 4 tests go red first, not 5, and the changeset drops its second sentence. Operator agreed.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. This is a pure port: no motion-dom API involved, so it runs on 14.9.1 or 14.10.1.
- **Wave**: 1
- **Category**: bug (upstream parity, keyboard accessibility)
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

`Reorder` is our own Svelte port of framer-motion's `Reorder`, so upstream fixes don't arrive with the dependency bump. In Motion 14.10.0, Home and End work in a keyboard-reorderable group:
- With nothing grabbed, they move focus to the first or last rendered item.
- With an item grabbed, they move it to either end and call `onReorder`.

They work on every axis, like a listbox. In our port these keys fall through to the browser and scroll the page, so a keyboard user has to press an arrow N times to move an item to the top.

## Current state

- **Upstream** (local clone `~/Github/motion`, tag `v14.10.1`, commits `9253d541e` and `aa2fcad3f`):
  - `packages/framer-motion/src/components/Reorder/utils/check-reorder.ts`, `keyTarget`. The diff from v14.9.1 is exactly three lines:
    ```diff
    -    let target = index + step
    +    let target = key > 3 ? (key - 4) * (order.length - 1) : index + step
    -    if (axis === "xy" && !(key % 2) && index > -1) {
    +    if (axis === "xy" && key < 4 && !(key % 2) && index > -1) {
    -    return index > -1 && order[target] ? target : -1
    +    return index > -1 && target !== index && order[target] ? target : -1
    ```
    The doc comment now reads: "`key` being its index in Up, Left, Down, Right, Home, End … Home and End go to either end."
  - `packages/framer-motion/src/components/Reorder/Group.tsx` `onKeyDown` at v14.10.1, lines 198-280. Its non-Board logic is:
    ```ts
    const keyIndex = ["ArrowUp","ArrowLeft","ArrowDown","ArrowRight","Home","End"].indexOf(key)
    const isX = keyIndex % 2
    if (key === " ") { ... }
    else if (keyIndex < 0 && !(key === "Escape" && from)) { return }
    else if (key === "Escape" && from) { ...restore... }
    else {
        const isAlongAxis = keyIndex > 3 || axis === "xy" || axis === (isX ? "x" : "y")
        const list = from ? order : order.filter(({ value }) => isRendered(value))
        const index = list.findIndex(({ value }) => value === item)
        const target = isAlongAxis ? keyTarget(list, index, keyIndex, axis, !!isX && isRTL()) : -1
        if (target > -1) { from ? commit(...) : focus(list[target]) }
        else if (!(/* board.key — ignore, not ported here */) && !isAlongAxis) { return }
    }
    event.preventDefault()
    ```
    **Behaviour change hidden in that logic:** a key *along* the axis with nowhere to go (for example, ArrowDown on the last item) is now **prevented**. Only keys *across* the axis are left to the browser. Our port currently returns `false` without `preventDefault` for "nowhere to go".

    The Board-only parts (`board?.isMoving`, `board?.restore`, `board?.key`) are **out of scope** here (plan 007).
  - Upstream tests at `packages/framer-motion/src/components/Reorder/__tests__/keyboard.test.tsx` (v14.10.1): `:534` "moves focus, or the grabbed item, to either end with Home and End" and `:560` "uses Home and End on every axis". Read them with `git -C ~/Github/motion show v14.10.1:packages/framer-motion/src/components/Reorder/__tests__/keyboard.test.tsx | sed -n 520,590p`.
- **Ours**:
  - `src/lib/components/Reorder/checkReorder.ts:117-162`, `keyTarget`. It is the 14.9.1 version, labelled "Port of Motion 14.9.1":
    ```ts
    const step = key > 1 !== !!(key % 2 && isRTL) ? 1 : -1
    let target = index + step
    if (axis === 'xy' && !(key % 2) && index > -1) {
    ...
    return index > -1 && order[target] ? target : -1
    ```
  - `src/lib/components/Reorder/Group.svelte:171-211`, `onKeyDown` in the context object. The relevant part:
    ```ts
    const keyIndex = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].indexOf(key)
    const isX = keyIndex % 2
    let committed = false
    if (key === ' ') {
        if (!event.repeat) grab(currentTarget, from ? undefined : [...values])
    } else if (key === 'Escape' && from) {
        ...
    } else if (keyIndex < 0 || (axis !== 'xy' && axis !== (isX ? 'x' : 'y'))) {
        return false
    } else {
        const list = from ? order : order.filter(({ value }) => isRendered(value))
        const index = list.findIndex(({ value }) => value === item)
        const target = keyTarget(list, index, keyIndex, axis, !!isX && isRTL())
        if (target > -1) {
            if (from) committed = commit(order, moveItem(order, index, target), item)
            else elements.get(list[target].value)?.()?.focus()
        }
    }
    event.preventDefault()
    return committed
    ```
    Note: our `onKeyDown` **returns `committed`**, a Svelte-specific addition that `Item.svelte` uses for refocus after keyed-each moves. Keep it.
  - `src/lib/components/Reorder/context.ts:89-110` is the JSDoc of `onKeyDown`. It says "Mirrors Motion 14.9.1".
  - Tests:
    - `src/lib/components/Reorder/checkReorder.spec.ts:129-179` (`describe('keyTarget')`, for example `:156` "steps one place along the order, or -1 past either end").
    - `src/lib/components/Reorder/keyboard.component.spec.ts`. Its helpers are `mount(props)`, `item(id)`, `focused()`, `order()`, and `press(element, key)`, which returns `true` when the key was **not** prevented (`:73-80`). It uses fake timers and `KeyboardHarness.svelte`.
    - `e2e/reorder/keyboard.spec.ts` (`/tests/reorder/keyboard`), for example "moving an item up keeps focus and the grab" at `:133`.
  - Docs: `docs/src/routes/docs/reorder/+page.svx:189-205`, the key table and notes. One note says "Arrows across the axis, and arrows with nowhere to go, are left to the page." That becomes wrong.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| e2e | `PW_PORT=4243 pnpm exec playwright test --project=chromium e2e/reorder` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/components/Reorder/checkReorder.ts` (`keyTarget` and its JSDoc only)
- `src/lib/components/Reorder/checkReorder.spec.ts`
- `src/lib/components/Reorder/Group.svelte` (`onKeyDown` only)
- `src/lib/components/Reorder/context.ts` (the `onKeyDown` JSDoc only)
- `src/lib/components/Reorder/keyboard.component.spec.ts`
- `e2e/reorder/keyboard.spec.ts`
- `docs/src/routes/docs/reorder/+page.svx` (the Keyboard section only)
- `.changeset/reorder-home-end.md` (create)

**Out of scope:**
- `autoScroll.ts` (plan 004) and `Item.svelte`.
- Any Reorder.Board hook (`board?.…`). Plans 006/007 add those later. Don't leave placeholders.
- The upstream "keyboard grab in a ref" change (`fe72ef29e`). It fixes a React-only race. Our `grabbedFrom` is Svelte `$state`, which updates synchronously. Step 4 only adds a guard test.

## Git workflow

- Lane branch `lane/14101-home-end`, cut from the wave-0 SHA.
- Use conventional commits, for example `test(reorder): Home and End (red)` and `feat(reorder): Home and End go to either end (Motion 14.10)`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Failing tests

1. In `checkReorder.spec.ts` `describe('keyTarget')`, add:
   - "Home and End go to either end": with 4 items and index 1, key 4 → 0 and key 5 → 3. Also check on `axis: 'xy'`, using the grid fixture already in the file.
   - "Home on the first item and End on the last are -1": key 4 at index 0 → -1, and key 5 at index 3 → -1.
2. In `keyboard.component.spec.ts`, port upstream's two tests (`keyboard.test.tsx:534-575` at v14.10.1), using our `mount`/`press`/`focused`/`order` helpers:
   - "moves focus, or the grabbed item, to either end with Home and End": `mount({ values: ['a','b','c','d'] })`.
   - "uses Home and End on every axis": `mount({ axis: 'x' })`, with Home and End still prevented and working.
   - Where upstream asserts `press(…) === false` (prevented), our helper uses the same convention.
3. Add a third test, "an arrow along the axis with nowhere to go is prevented; one across the axis is not": ArrowDown on the last item of a `y` group returns `false`; ArrowRight returns `true`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/checkReorder.spec.ts src/lib/components/Reorder/keyboard.component.spec.ts` → the new tests FAIL and all old tests pass. If an **old** test asserts that an along-axis key with nowhere to go is *not* prevented, list it in your report. Step 3 updates it, citing the upstream change.

### Step 2: Port `keyTarget`

Apply the three-line upstream diff to `src/lib/components/Reorder/checkReorder.ts`. Update the JSDoc to match upstream's new wording, change "Port of Motion 14.9.1" to "Port of Motion 14.10.1", and document `key` as the index in Up, Left, Down, Right, Home, End.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/checkReorder.spec.ts` → all PASS.

### Step 3: Port the `onKeyDown` key handling

In `Group.svelte`:
- Add `'Home', 'End'` to the key list.
- Replace the `else if (keyIndex < 0 || (axis !== 'xy' && …)) return false` branch with upstream's structure:
  ```ts
  } else if (keyIndex < 0) {
      return false
  } else {
      const isAlongAxis = keyIndex > 3 || axis === 'xy' || axis === (isX ? 'x' : 'y')
      const list = from ? order : order.filter(({ value }) => isRendered(value))
      const index = list.findIndex(({ value }) => value === item)
      const target = isAlongAxis ? keyTarget(list, index, keyIndex, axis, !!isX && isRTL()) : -1
      if (target > -1) {
          if (from) committed = commit(order, moveItem(order, index, target), item)
          else elements.get(list[target].value)?.()?.focus()
      } else if (!isAlongAxis) {
          return false
      }
  }
  ```
- Keep the Escape branch before this one, as it is now. Update the comment above `onKeyDown` from "Motion 14.9.1" to "Motion 14.10.1". In `context.ts`, update the `onKeyDown` JSDoc the same way and mention Home and End.
- If Step 1 found an old test asserting that an along-axis key with nowhere to go is not prevented, update it to expect prevented. Add a comment citing upstream `Group.tsx` v14.10.1 `isAlongAxis`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all PASS.

### Step 4: Synchronous-grab guard tests

Upstream fixed a React race in which a key sent before React re-rendered missed the grab (`fe72ef29e`, tests "moves on an arrow sent before React renders the grab" and "drops when focus leaves before React renders the grab" in `keyboard.test.tsx`). We don't have that race, but no test would catch a regression, because every helper call flushes. Add both tests to `keyboard.component.spec.ts`. Dispatch `' '` and then `ArrowDown` (or then `focus()` another item) **without** a `flushSync()` in between, using raw `dispatchEvent` instead of the `press` helper for the first key.

**Verify**: these tests PASS immediately. They are guards, so say so in the commit message.

### Step 5: e2e

In `e2e/reorder/keyboard.spec.ts`, add "End and Home move the grabbed item to either end and keep focus":
- Focus the first item, press Space, then End.
- Expect the order shown on the page to have that item last, `document.activeElement` to be that item, and the item to still be grabbed (use the existing `whileDrag` assertion pattern in the file at `:191`).
- Then press Home and expect it first again.

This exercises the Svelte-only refocus path after a large keyed-each move.

**Verify**: `PW_PORT=4243 pnpm exec playwright test --project=chromium e2e/reorder/keyboard.spec.ts e2e/reorder/keyboard-grid.spec.ts` → all PASS.

### Step 6: Docs and changeset

1. In the Keyboard section of `docs/src/routes/docs/reorder/+page.svx`:
   - Add a table row: "`Home` / `End` | Move focus to the first or last item, or move the grabbed item there. Works on every axis".
   - Change the note to "Arrows across the axis are left to the page." Arrows along it with nowhere to go are now consumed.
   - Change "(Motion 14.9)" to "(Motion 14.9; Home/End in 14.10)".
2. Create `.changeset/reorder-home-end.md` with frontmatter `'@humanspeak/svelte-motion': minor`. The body: "`Reorder`: Home and End move focus, or the grabbed item, to either end of the group (Motion 14.10)."

**Verify**: `pnpm --dir docs build` → exit 0. Revert any change to `docs/static/r/animated-tabs.json`.

### Step 7: Full gate

Run `pnpm check`, `pnpm test:only`, and `PW_PORT=4243 pnpm exec playwright test --project=chromium e2e/reorder e2e/lazy-motion`. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass.

## Test plan

- **Red first**: the 2 `keyTarget` cases and the 3 component cases fail before Steps 2–3.
- **Guards**: the 2 synchronous-grab tests pass from the start (documented).
- **e2e**: 1 new test in `keyboard.spec.ts`.
- **Regression net**: the whole `src/lib/components/Reorder` unit suite and `e2e/reorder/*`.

## Done criteria

- [ ] `grep -n "'Home', 'End'" src/lib/components/Reorder/Group.svelte` → 1 match
- [ ] `grep -n "key > 3" src/lib/components/Reorder/checkReorder.ts` → 1 match
- [ ] `pnpm test:only` → all pass
- [ ] `PW_PORT=4243 pnpm exec playwright test --project=chromium e2e/reorder` → all pass
- [ ] `pnpm check` → 0 errors
- [ ] Only in-scope files changed

## STOP conditions

- Upstream's tests can't be expressed with our helpers without changing `KeyboardHarness.svelte`. Report what's missing.
- An existing e2e test in `e2e/reorder/*` relies on a nowhere-to-go arrow scrolling the page.
- You find yourself editing `Item.svelte`.

## Maintenance notes

- Plan 007 (Reorder.Board keyboard) restructures this same `onKeyDown` again: it adds `board.isMoving`, `board.restore` and `board.key`. Keep the branch shape close to upstream's so that diff stays small.
- `onKeyDown` returning `committed` is a Svelte-only contract with `Item.svelte`'s refocus effect. Don't drop it.
