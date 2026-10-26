# Plan 004: Make Reorder auto-scroll speed independent of the display's refresh rate

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4204** (`PW_PORT=4204`). Never use or kill port 4198.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/components/Reorder/autoScroll.ts src/lib/components/Reorder/autoScroll.spec.ts`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

Reorder's edge auto-scroll moves a fixed 25 px every time `onDrag` runs. `onDrag` runs once per frame, so a
120 Hz display scrolls twice as fast as a 60 Hz one (2.4× at 144 Hz, half speed at 30 Hz). An extra mid-frame
`onDrag` call (from a synchronous projection flush after a reorder) also scrolls a full step again. Motion 14.6.0
(commit `2984e9d60`, issue #3955) treats the max speed as pixels per millisecond and scales it by
`frameData.delta`, the elapsed time of the current frame, so the list scrolls about 960 px/s at any refresh rate.

## Current state

- `src/lib/components/Reorder/autoScroll.ts:15-20`:
  ```ts
  import type { DragPoint } from '$lib/types'
  import type { ReorderAxis } from './types'

  const threshold = 50
  const maxSpeed = 25
  ```
- `autoScroll.ts:91-104`:
  ```ts
  /**
   * Speed ramps up towards the edge and is capped at maxSpeed once the
   * pointer reaches or passes it.
   *
   * Port of framer-motion `Reorder/utils/auto-scroll.ts` @ v14.5.0.
   *
   * @param distanceFromEdge - Pointer distance inside the edge, in px; negative once past it.
   * @returns Scroll speed in px per frame, from 0 up to `maxSpeed`.
   */
  const scrollSpeed = (distanceFromEdge: number): number => {
      const intensity = Math.min(1, 1 - distanceFromEdge / threshold)
      return maxSpeed * intensity * intensity
  }
  ```
- `src/lib/components/Reorder/autoScroll.spec.ts`: `describe('autoScrollIfNeeded', …)` (from line 34) and
  `describe('scroll speed', …)` (lines ~90-139). The speed tests assert per-call distances computed from
  `maxSpeed = 25`: `6.25` (25 px from the edge), `23.04` (2 px), and `25` (past either edge). They use a
  `makeTallScrollableList()` helper with `scrollTop = 1000` and read `scroller.scrollTop - 1000`.
- Timing context: `onDrag` is called by motion-dom's `VisualElementDragControls` inside a frame, so
  `frameData.delta` is the current frame's elapsed time. svelte-motion's mid-frame `flushFrameSteps` in
  `src/lib/html/_MotionContainer.svelte` (around lines 2227-2240) sets `frameData.delta` to the elapsed time so far,
  which is what upstream's "extra mid-frame update" test models.

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts`:

```ts
import { frameData } from "motion-dom"

const threshold = 50
// Pixels per millisecond (25px per frame at 60fps)
const maxSpeed = 1.5

/**
 * Speed ramps up towards the edge and is capped at maxSpeed once the
 * pointer reaches or passes it. This runs from onDrag, within a frame, so
 * scale by the frame's elapsed time to scroll at the same speed whatever
 * the display's refresh rate.
 */
function scrollSpeed(distanceFromEdge: number): number {
    const intensity = Math.min(1, 1 - distanceFromEdge / threshold)
    return maxSpeed * intensity * intensity * frameData.delta
}
```

Upstream's new tests (`git -C ~/Github/motion show 2984e9d60 -- '*auto-scroll.test*'`) set
`frameData.delta = 1000 / 60` in `beforeEach`, then:

- "scroll speed is independent of the display's refresh rate": hold the pointer 10 px inside the bottom edge for
  `fps` calls with `frameData.delta = 1000 / fps`; the total is ≈ 960 at 60 fps, and ≈ the same at 30, 120 and
  240 fps.
- "an extra mid-frame update doesn't scroll the frame's distance twice": `frameData.delta = 4`, one call past the
  edge; `frameData.delta = 1000 / 60 - 4`, another call; total ≈ 25.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| Reorder e2e | `PW_PORT=4204 pnpm exec playwright test e2e/reorder/scrollable.spec.ts` | all pass |

## Scope

**In scope**: `src/lib/components/Reorder/autoScroll.ts`, `src/lib/components/Reorder/autoScroll.spec.ts`,
`.changeset/reorder-auto-scroll-frame-delta.md` (create).

**Out of scope**: `Item.svelte` (it keeps passing client coordinates; see the module header), `Group.svelte`
(plans 003 and 009), the `threshold` value, the scroll-limit and active-edge logic.

## Git workflow

- Lane branch `lane/1460-autoscroll` in `../svelte-motion-1460-autoscroll`, created by the dispatcher from the
  wave-0 commit.
- Conventional commits, e.g. `test(reorder): auto-scroll speed per millisecond`,
  `fix(reorder): scale auto-scroll by frame delta (Motion 14.6.0)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

In `autoScroll.spec.ts`:

1. `import { frameData } from 'motion-dom'`. In the `beforeEach` of both `describe('autoScrollIfNeeded')` and
   `describe('scroll speed')`, add `frameData.delta = 1000 / 60` with upstream's comment ("autoScrollIfNeeded runs
   from onDrag, inside a frame. Default to 60fps."). Restore it in `afterEach` (save the original value in a
   `const` at the top of the file).
2. Inside `describe('scroll speed')`, add a `scrollForOneSecond(fps)` helper that builds a fresh
   `makeTallScrollableList()`, calls `resetAutoScrollState()`, sets `frameData.delta = 1000 / fps`, calls
   `autoScrollIfNeeded(group, 190, 'y', 1)` `fps` times (190 = 10 px inside the 200 px viewport's bottom edge),
   and returns `scroller.scrollTop - 1000`.
3. Add `it("scroll speed is independent of the display's refresh rate", …)`: `at60 = scrollForOneSecond(60)`,
   `expect(at60).toBeCloseTo(960)`, then `toBeCloseTo(at60)` for 120, 30 and 240.
4. Add `it("an extra mid-frame update doesn't scroll the frame's distance twice", …)`: on a tall list, delta 4 →
   `autoScrollIfNeeded(group, 400, 'y', 5)`; delta `1000 / 60 - 4` → same call; expect
   `scroller.scrollTop - 1000` `toBeCloseTo(25)`.
5. Update the `describe('scroll speed')` JSDoc to cite `@ v14.6.0` and say speeds are per millisecond × delta. The
   existing 6.25 / 23.04 / 25 expectations stay unchanged (1.5 px/ms × 1000/60 ms = 25 px).

If the jsdom scroll element clamps `scrollTop` at `scrollHeight - clientHeight` (4800 in the tall list), check the
totals stay under it (960 + 1000 < 4800); they do, so no change needed.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` → the refresh-rate test **FAILS**
(120 fps scrolls ≈ 1920, not ≈ 960) and the mid-frame test **FAILS** (≈ 50, not ≈ 25); the existing speed
tests still pass. If the new tests pass, STOP.

Commit (`test(reorder): auto-scroll speed per millisecond`).

### Step 2: Scale by `frameData.delta`

In `autoScroll.ts`:

- `import { frameData } from 'motion-dom'` (motion-dom is already a dependency; `checkReorder.ts` imports from it).
- `const maxSpeed = 1.5` with the comment `// Pixels per millisecond (25px per frame at 60fps)`.
- `scrollSpeed` returns `maxSpeed * intensity * intensity * frameData.delta`. Update its JSDoc: cite
  `framer-motion Reorder/utils/auto-scroll.ts @ v14.6.0` (commit `2984e9d60`, #3955), explain the per-frame
  scaling in one sentence, and change `@returns` to "Scroll distance for this frame, in px, from 0 up to
  `maxSpeed × frameData.delta`."
- Update the `getScrollAmount` JSDoc's "capped at `maxSpeed`" wording to match.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` → all pass.

### Step 3: Changeset and gate

Create `.changeset/reorder-auto-scroll-frame-delta.md` (bump `patch`): "Reorder's edge auto-scroll now scrolls at
the same speed on every display refresh rate, instead of running twice as fast at 120 Hz (Motion 14.6.0)."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=4204 pnpm exec playwright test e2e/reorder/scrollable.spec.ts` (pass; re-run once alone before reporting a
failure), `trunk check` on the changed files (clean), `git status` shows only in-scope files.

## Test plan

- Red-first: the refresh-rate and mid-frame tests fail on the current per-call speed and pass after Step 2.
- The existing per-distance speed tests keep passing at the 60 fps delta, proving the 60 Hz feel is unchanged.
- `e2e/reorder/scrollable.spec.ts` guards real-browser auto-scroll.

## Done criteria

- [ ] `grep -n "frameData.delta" src/lib/components/Reorder/autoScroll.ts` → one match in `scrollSpeed`
- [ ] `grep -n "const maxSpeed = 1.5" src/lib/components/Reorder/autoScroll.ts` → one match
- [ ] Unit suite, `pnpm check`, `e2e/reorder/scrollable.spec.ts` pass; `trunk check` clean
- [ ] Changeset exists; no out-of-scope files modified

## STOP conditions

- The new tests pass before Step 2.
- `e2e/reorder/scrollable.spec.ts` fails twice after the change (it may assert a per-frame scroll distance; report
  it rather than editing it).
- The fix seems to need `Item.svelte` or `Group.svelte`.

## Maintenance notes

- `frameData.delta` is only meaningful inside a frame. If `autoScrollIfNeeded` is ever called from outside
  `onDrag` (for example a keyboard-driven scroll), pass an explicit delta instead of reading `frameData`.
