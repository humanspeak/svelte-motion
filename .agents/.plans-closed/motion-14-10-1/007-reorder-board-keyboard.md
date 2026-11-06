# Plan 007: `Reorder.Board` keyboard moves: arrows move a grabbed item to the next group, and Escape returns it

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git log --oneline -5 -- src/lib/components/Reorder/board.ts` must show plan 006's commits. Then run `git diff --stat 5011a60a..HEAD -- src/lib/components/Reorder src/routes/tests/reorder/board e2e/reorder/board.spec.ts`. If anything changed after 006, compare it against the excerpts below. On a mismatch, STOP.
>
> Revision 2026-11-06 (guard pre-flight): Plan 006 merged as `5011a60a`, which is the drift baseline. Plan 006 as built matches the shapes below: the context object is the group identity, the handoff stores `visualElement`, `Item.svelte` has a one-shot receive `$effect` and an `isContinued` flag, and `Group.svelte` publishes `const context` and runs `$effect(() => board?.add(context))`. This repo has no Firefox Playwright project (`--project=firefox --list` errors), so the Firefox runs in Step 5 are skipped; say so in the report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. It restructures `Group.svelte` `onKeyDown`, which every keyboard-reorderable group uses, and it has to reconcile Svelte-only refocus logic.
- **Depends on**: 006 (creates `board.ts`, `Board.svelte`, the board context, and the `receive` hook in `Item.svelte`). It also builds on 003's `onKeyDown` (Home/End, `isAlongAxis`).
- **Wave**: 3
- **Category**: direction (upstream parity: keyboard accessibility)
- **Planned at**: commit `f93a1d92`, 2026-11-06 (excerpts of our board code describe plan 006's intended result; verify them)

## Why this matters

Upstream's `Reorder.Board` is keyboard-accessible:
- With an item grabbed (Space), an arrow key *across* the group's axis, or *along* it past either end, moves the item to the nearest visible group in that direction.
- Escape returns the item to the group and slot it was grabbed from.

Without this port, our Board is pointer-only. That is an accessibility regression compared with plain groups, which are keyboard-reorderable.

## Current state

### Upstream (local clone `~/Github/motion`, tag `v14.10.1`)

- `packages/framer-motion/src/components/Reorder/Board.tsx`, the parts plan 006 left out:
  - `origin` (`:118-121`);
  - `key` (`:249-289`): the nearest group whose near edge lies past the item in the key's direction; skips hidden groups (`!width && !height`); respects `canMove`;
  - `restore` (`:291-316`): back to `origin.group`, before the first value that followed it when grabbed; ignores `canMove`;
  - `isMoving` (`:322`);
  - the `keys` branch of `receive` (`:345-358`), shown below.
  ```ts
  if (keys) {
      handoff = undefined
      const { activeElement, body } = element.ownerDocument
      if (isMoved && (!activeElement || activeElement === body)) {
          ;(element as HTMLElement).focus()
          grab(element, from)
      }
      return false
  }
  ```
- `packages/framer-motion/src/components/Reorder/Group.tsx:198-280`, the full `onKeyDown` at v14.10.1:
  ```ts
  if (key === " ") {
      event.repeat || grab(currentTarget, from ? undefined : values)
  } else if (keyIndex < 0 && !(key === "Escape" && from)) {
      return
  } else if (board?.isMoving(currentTarget)) {
      // Until the move renders, this item and its group's values are out of date.
  } else if (key === "Escape" && from) {
      grab(currentTarget)   // drop first: a move back hands it on to the item that mounts there
      if (!board?.restore(context, item, currentTarget, from)) {
          const kept = from.flatMap((value) => order.filter((data) => data.value === value))
          commit(order.map((data) => (from.includes(data.value) ? kept.shift()! : data)), item)
      }
  } else {
      const isAlongAxis = keyIndex > 3 || axis === "xy" || axis === (isX ? "x" : "y")
      ... target = isAlongAxis ? keyTarget(...) : -1
      if (target > -1) { from ? commit(...) : focus(...) }
      else if (!(from && keyIndex < 4 && board?.key(context, item, keyIndex, currentTarget, from)) && !isAlongAxis) {
          return
      }
  }
  event.preventDefault()
  ```
  Note that the `isMoving` branch still reaches `event.preventDefault()`, and so does a successful `board.key`.
- Tests: `packages/framer-motion/src/components/Reorder/__tests__/board.test.tsx`, `describe("Reorder.Board keyboard")` from `:868`:
  - moves to the next group across the axis
  - arrow sent before the grab renders
  - arrows go to the browser where there's no group
  - Escape restores the original group and slot
  - skips hidden groups
  - forgets a refused move after a drop
  - `canMove` skips to the next group that way
  - Escape works regardless of `canMove`
  - past either end moves only to a group in that direction, not beside it
  - past either end moves into the group that way
  - Home and End stay within the group
  - waits for a render before moving again
  - waits for a render before Escape
  - leaves focus alone when a move lands late
  - moves again after a keyboard move that never landed

  Cypress `packages/framer-motion/cypress/integration/reorder-board.ts` has a keyboard case: a move between columns with the `drags` counter reading `0,0`.

### Ours (after plans 003 and 006; confirm by reading the files)

- `src/lib/components/Reorder/Group.svelte` `onKeyDown`, after plan 003:
  - keys `['ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Home','End']`;
  - the Escape branch commits the restore and **then** calls `grab(currentTarget)`;
  - `isAlongAxis`, and `else if (!isAlongAxis) return false`;
  - it returns `committed` (a Svelte-only contract with `Item.svelte`).
- `src/lib/components/Reorder/board.ts` (from plan 006): `createBoard` with `add`, `drag`, `move`, `end`, `receive` (no keys branch) and `column`. The handoff type stores `visualElement`. Deviations are marked `// Svelte:`.
- `src/lib/components/Reorder/Item.svelte`:
  - `grab(element, from)` sets `grabbedFrom` and toggles `whileDrag`; after plan 006 it also calls `board?.end(value)` when `!from`.
  - `pendingRefocus` and the `$effect` that refocuses after a keyed-each move (`:146-180` before 006).
  - `handleBlur` ignores a "move-blur" (`relatedTarget === null` while `pendingRefocus`) and otherwise drops the grab.
  - The mount `receive` call is from plan 006.
- **Svelte-specific hazard.** Across groups, the item that receives focus is a **new** component, and the old one is destroyed. The old item's `handleBlur` may fire as its node is removed, and browsers differ on this. It must not call `board.end(value)` (through `grab`) for a move in flight, or the new item never gets the handoff. Upstream relies on React suppressing that blur. Guard it with `board?.isMoving(element)`: if the item is moving, the blur is a move-blur, so ignore it.
- Test helpers: `src/lib/components/Reorder/board.component.spec.ts` (plan 006; jsdom layout fixture, `BoardHarness.svelte`) and the `press(element, key)` helper pattern in `keyboard.component.spec.ts:73-80`. The helper returns `true` when the key was *not* prevented.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| Reorder units | `pnpm exec vitest run src/lib/components/Reorder` | all pass |
| All unit tests | `pnpm test:only` | all pass |
| e2e | `PW_PORT=4247 pnpm exec playwright test --project=chromium e2e/reorder` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/components/Reorder/board.ts` (`origin`, `key`, `restore`, `isMoving`, the keys branch of `receive`)
- `src/lib/components/Reorder/board.spec.ts`
- `src/lib/components/Reorder/context.ts` (add `key`, `restore` and `isMoving` to `ReorderBoardContextProps`)
- `src/lib/components/Reorder/Group.svelte` (`onKeyDown` only)
- `src/lib/components/Reorder/Item.svelte` (blur guard; focus/grab from `receive`)
- `src/lib/components/Reorder/board.component.spec.ts`, `__tests__/BoardHarness.svelte`
- `src/routes/tests/reorder/board/+page.svelte` (tester step for keyboard) and `e2e/reorder/board.spec.ts`
- `.changeset/reorder-board-keyboard.md` (create)

**Out of scope:**
- Docs (plan 008).
- `autoScroll.ts`, `checkReorder.ts`, `_MotionContainer.svelte`.

## Git workflow

- Lane branch `lane/14101-board-keys`, cut from `feat/motion-14.10.1` after 006 is merged.
- Use conventional commits, for example `test(reorder): board keyboard (red)` and `feat(reorder): keyboard moves between Reorder.Board groups`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Port the keyboard tests (red)

Add `describe('Reorder.Board keyboard')` to `board.component.spec.ts` and port the 15 upstream tests listed above.
- Port "arrow sent before the grab renders" as Svelte's equivalent: no `flushSync` between Space and the arrow.
- Port the "waits for a render" tests by dispatching the second key before flushing Svelte's update.
- If a test depends on React-only commit semantics with no Svelte analogue, skip it with a one-line reason in the file header.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/board.component.spec.ts` → the new keyboard tests FAIL. All plan-006 tests still pass.

### Step 2: Board `key`, `restore`, `isMoving`, and `receive` keys

Port these from `Board.tsx` into `board.ts`, line for line, using the identity and element conventions plan 006 established (the context object as the group, `getGroupElement()`):
- `origin`
- `key`
- `restore`
- `isMoving`
- the `keys` branch at the top of `receive`, together with the `keys`/`from` fields on the handoff

Add them to `ReorderBoardContextProps` in `context.ts`, with JSDoc ported from upstream `types.ts`. In `board.spec.ts`, add unit cases for `key`'s direction filter (`[bottom, right, top, left][keyIndex]`, edge check) by building fake groups with stubbed `getGroupElement().getBoundingClientRect()`.

**Verify**: `pnpm check` → 0 errors, and `pnpm exec vitest run src/lib/components/Reorder/board.spec.ts` → PASS.

### Step 3: `Group.svelte` `onKeyDown`

Restructure to upstream's branch order (excerpt above), keeping our `committed` return value:
- Add `else if (board?.isMoving(currentTarget)) { /* wait for the move to render */ }` before Escape.
- Escape: call `grab(currentTarget)` **first**, then `if (!board?.restore(context, item, currentTarget, from)) { committed = commit(...) }`.
- In the arrow branch: `else if (!(from && keyIndex < 4 && board?.key(context, item, keyIndex, currentTarget, from)) && !isAlongAxis) return false`.
- A board move doesn't commit through this group's `commit`, so `committed` stays `false` for it. The new item takes focus in `receive`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → `keyboard.component.spec.ts` (plain groups, including plan 003's Home/End) still passes in full, and the board keyboard tests progress.

### Step 4: `Item.svelte` focus handoff

1. In `handleBlur`, return early (ignore the blur) when `board?.isMoving(event.currentTarget)` is true, before the existing move-blur check. Add a comment explaining that this is the cross-group equivalent of the keyed-each move-blur (React suppresses it; Svelte doesn't).
2. Make sure the mount `receive` call (from plan 006) passes this item's `grab`, so the keys branch can `focus()` the new element and `grab(element, from)` it. If the new element isn't focusable yet at that point (for example, `tabindex` hasn't rendered), call `focus` after the next tick and **record which you used** in the commit message.
3. Ensure `pendingRefocus` is never set by a cross-group move: `onKeyDown` returned `committed === false`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all PASS, apart from documented skips.

### Step 5: e2e and tester page

1. On `src/routes/tests/reorder/board/+page.svelte`, add a TesterPanel step: "Tab to a card, Space, ArrowRight: it moves to the next column and stays grabbed; Escape returns it".
2. In `e2e/reorder/board.spec.ts`, port the Cypress keyboard case (focus a card, then Space, ArrowRight, Space, and expect it in the next column with `drags` reading `0,0`). Add an Escape case: grab, ArrowRight, Escape, and expect the card back in its original column and slot with focus on it.
3. Run both specs in Chromium **and Firefox**. Browsers differ on blur when a focused node is removed.

**Verify**: `PW_PORT=4247 pnpm exec playwright test --project=chromium e2e/reorder/board.spec.ts e2e/reorder/keyboard.spec.ts` → all PASS. Also run with `--project=firefox` if it's installed, and record the result.

### Step 6: Changeset and gate

1. Create `.changeset/reorder-board-keyboard.md` with frontmatter `'@humanspeak/svelte-motion': minor`. Body: "`Reorder.Board` keyboard support: with an item grabbed, arrows across the group's axis (or past either end) move it to the nearest group that way, and Escape returns it to where it was grabbed (Motion 14.10)."
2. Run `pnpm check`, `pnpm test:only` and `PW_PORT=4247 pnpm exec playwright test --project=chromium e2e/reorder e2e/lazy-motion`. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass.

## Test plan

- **Red first**: the 15 upstream keyboard tests (minus documented skips).
- **Unit**: the direction filter of `board.key`.
- **e2e**: the keyboard move and Escape, in Chromium and Firefox.
- **Regression**: `keyboard.component.spec.ts`, `keyboard-grid` e2e, and every other Reorder suite.

## Done criteria

- [ ] `grep -n "isMoving\|restore\|key:" src/lib/components/Reorder/board.ts` → all present
- [ ] `pnpm test:only` → all pass, with at least 12 board keyboard tests passing
- [ ] `PW_PORT=4247 pnpm exec playwright test --project=chromium e2e/reorder` → all pass
- [ ] `pnpm check` → 0 errors
- [ ] Only in-scope files changed

## STOP conditions

- Plan 006 isn't merged, or its `board.ts` doesn't match the shape described here (context object as group identity, `visualElement` in the handoff).
- The old item's blur on removal still ends the handoff in a real browser after the Step 4 guard.
- Restructuring `onKeyDown` breaks any plain-group keyboard test from plan 003 or earlier.
- More than 3 upstream keyboard tests need skipping.

## Maintenance notes

- `onKeyDown` now mirrors upstream's branch order exactly. Future upstream Reorder keyboard diffs should apply almost mechanically.
- The blur guard in `Item.svelte` is a Svelte-only deviation. If Svelte ever restores focus after keyed moves the way React does, revisit both it and `pendingRefocus`.
