# Plan 004: Reorder auto-scroll only picks containers that can scroll on the axis, and keeps its state per axis

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- src/lib/components/Reorder/autoScroll.ts src/lib/components/Reorder/autoScroll.spec.ts`
> If either file changed, compare it with the "Current state" excerpts. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. This is a pure port with no motion-dom API involved.
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

`Reorder.Item` scrolls the nearest scrollable ancestor when a drag nears its edge. Our port is the 14.9.1 version, and Motion 14.10.0 fixed two bugs in it. Both also hit plain groups, not just the new `Reorder.Board`.

1. **Wrong container.** An ancestor with `overflow-x: auto` computes `overflow-y: auto` too (CSS rule). For example, a `.table-wrap { overflow-x: auto }` around a vertical list. We treat that wrapper as the vertical scroller even though it has nothing to scroll vertically, so dragging to the bottom of the viewport never scrolls the page.
2. **Shared state across axes.** We keep one "active edge" and "initial limit" per element, shared by x and y. In an `axis="xy"` group inside a container that scrolls both ways, an x frame deletes y's active edge, and an x activation caps x scrolling against y's limit. `resetAutoScrollState` also re-finds ancestors instead of clearing what it recorded.

`Reorder.Board` (plan 006) depends on this: it scrolls on both axes every frame.

## Current state

- **Upstream** (local clone `~/Github/motion`, tag `v14.10.1`): `packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts`. See the full diff with `git -C ~/Github/motion diff v14.9.1 v14.10.1 -- packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts`. It does three things:
  - It replaces the two `WeakMap`s and `currentGroupElement` with:
    ```ts
    interface ScrollState { edge: ActiveEdge; limit: number }
    const scrollStates = { x: new Map<HTMLElement, ScrollState>(), y: new Map<HTMLElement, ScrollState>() }
    export function resetAutoScrollState(): void { scrollStates.x.clear(); scrollStates.y.clear() }
    ```
  - In `isScrollableElement` it adds a real-overflow check:
    ```ts
    return (
        isDocumentScroll ||
        (overflowStyles.has(overflow) &&
            (axis === "x"
                ? element.scrollWidth > element.clientWidth
                : element.scrollHeight > element.clientHeight))
    )
    ```
  - In `autoScrollIfNeeded`, `const states = scrollStates[axis]` and `let state = states.get(ancestor)`. On `edge === null` it calls `states.delete(ancestor)`. On activation it creates `state = { edge, limit }` and calls `states.set`. The cap reads `state.limit`.
  - Upstream tests (v14.10.1, `packages/framer-motion/src/components/Reorder/utils/__tests__/auto-scroll.test.ts:102-252`):
    - `describe("autoScrollIfNeeded in nested scroll containers")`, with "scrolls the nearest ancestor that can scroll on the axis" and "forgets every container it scrolled once the drag ends".
    - `describe("autoScrollIfNeeded on both axes of one container")`, with "keeps scrolling while the pointer is held at an edge" and "stops at the scroll limit from when it started scrolling".
    - They use `container(scrolls)`, `board()` and `setup()` fixtures that stub `clientWidth/Height`, `scrollWidth/Height` and `scrollLeft/Top`. Read them with `git -C ~/Github/motion show v14.10.1:packages/framer-motion/src/components/Reorder/utils/__tests__/auto-scroll.test.ts | sed -n 100,255p`.
- **Ours**: `src/lib/components/Reorder/autoScroll.ts` (229 lines).
  - `:40-52`: `initialScrollLimits` and `activeScrollEdge` `WeakMap`s, and `let currentGroupElement`.
  - `:58-72`: `resetAutoScrollState` re-finds ancestors from `currentGroupElement`.
  - `:74-81`: `isScrollableElement` returns `overflowStyles.has(overflow) || isDocumentScroll`.
  - `:152-229`: `autoScrollIfNeeded`. It sets `currentGroupElement = groupElement` at `:160`, deletes both maps at `:173-176`, activates at `:184-200`, and caps at `:203-214`.
  - **Keep our deliberate differences**:
    - The header comment (`:8-13`): we pass *client* coordinates, upstream passes page coordinates.
    - `selectAutoScrollAxis` (`:26-38`).
    - `scrollSpeed`/`getScrollAmount` with `frameData.delta` (`:94-140`).
  - The only callers are `src/lib/components/Reorder/Item.svelte:85` (`autoScrollIfNeeded(context.getGroupElement(), pointerPosition, scrollAxis, info.velocity[scrollAxis])`) and `:97` (`resetAutoScrollState()`). Their signatures don't change.
- **Our tests**: `src/lib/components/Reorder/autoScroll.spec.ts` (186 lines). Its fixture `makeScrollableList()` (`:22-36`) already stubs `scrollHeight 600 > clientHeight 200`, so existing tests should still pass. `beforeEach` sets `frameData.delta = 1000 / 60`, and `afterEach` calls `resetAutoScrollState()`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Unit file | `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| Reorder e2e | `PW_PORT=4244 pnpm exec playwright test --project=chromium e2e/reorder` | all pass |
| Types | `pnpm check` | `0 ERRORS` |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/components/Reorder/autoScroll.ts`
- `src/lib/components/Reorder/autoScroll.spec.ts`
- `.changeset/reorder-auto-scroll-per-axis.md` (create)

**Out of scope:**
- `Item.svelte`. Plan 006 changes how Board items call auto-scroll. Here the call sites stay as they are.
- `selectAutoScrollAxis`, `scrollSpeed`, `getScrollAmount` and the coordinate convention.

## Git workflow

- Lane branch `lane/14101-autoscroll`, cut from the wave-0 SHA.
- Use conventional commits, for example `test(reorder): auto-scroll per axis (red)` and `fix(reorder): auto-scroll only real overflow, per-axis state (Motion 14.10)`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Port the four upstream tests (red)

Append the two upstream `describe` blocks to `autoScroll.spec.ts`, with their fixtures, translated to Vitest (`test` becomes `it`, and imports come from `vitest`). Our `autoScrollIfNeeded` takes client coordinates. jsdom never scrolls the window, so upstream's numbers work unchanged.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` gives these results:
- "scrolls the nearest ancestor that can scroll on the axis" FAILS: `column.scrollLeft` > 0, or `outer.scrollLeft` is 0.
- "keeps scrolling while the pointer is held at an edge" FAILS.
- The other two may pass or fail; record which.
- All pre-existing tests PASS.

If neither of the two named tests fails, STOP: the reproduction is wrong.

### Step 2: Port the implementation

In `autoScroll.ts`:
- Replace `initialScrollLimits`, `activeScrollEdge` and `currentGroupElement` with upstream's `ScrollState` interface and `scrollStates` object, including its doc comment.
- Make `resetAutoScrollState` clear both maps. Update its JSDoc: "Forget every container scrolled during the drag that just ended."
- Port the `isScrollableElement` overflow check and its comment.
- In `autoScrollIfNeeded`, remove the `currentGroupElement` assignment and use `states = scrollStates[axis]` exactly as upstream does.
- Add "Port of framer-motion `Reorder/utils/auto-scroll.ts` @ v14.10.1" to the `autoScrollIfNeeded` JSDoc.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` → all PASS.

### Step 3: Gate

1. Create `.changeset/reorder-auto-scroll-per-axis.md` with frontmatter `'@humanspeak/svelte-motion': patch`. The body: "`Reorder`: edge auto-scroll skips ancestors that have `overflow: auto` but nothing to scroll on that axis, and keeps its scroll state per axis (Motion 14.10)."
2. Run `pnpm check`, `pnpm test:only` and the Reorder e2e. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass, including `e2e/reorder/scrollable.spec.ts` and `e2e/reorder/ref-constraints-scroll.spec.ts`. The page-scroll page is covered by `e2e/reorder/*` if a spec exists for it.

## Test plan

- **Red first**: the nested-containers and both-axes tests ported from upstream.
- **Regression**: the existing `autoScroll.spec.ts` cases, plus `e2e/reorder/scrollable.spec.ts` and `ref-constraints-scroll.spec.ts`.

## Done criteria

- [ ] `grep -n "currentGroupElement\|initialScrollLimits\|activeScrollEdge" src/lib/components/Reorder/autoScroll.ts` → no matches
- [ ] `grep -n "scrollWidth > element.clientWidth" src/lib/components/Reorder/autoScroll.ts` → 1 match
- [ ] `pnpm test:only` → all pass, with 4 new tests in `autoScroll.spec.ts`
- [ ] `PW_PORT=4244 pnpm exec playwright test --project=chromium e2e/reorder` → all pass
- [ ] Only in-scope files changed

## STOP conditions

- An existing `e2e/reorder/*` test fails after Step 2. A real page may rely on the old "overflow alone" rule; report which one.
- The upstream tests need changes to `Item.svelte` to pass.

## Maintenance notes

- Plan 006 (Board) calls `autoScrollIfNeeded` for both axes every frame and, across the groups' axis, passes the column container instead of the group. That relies on the per-axis state from this plan.
- `selectAutoScrollAxis` stays for plain `xy` groups. Upstream still picks one axis per frame outside a Board.
