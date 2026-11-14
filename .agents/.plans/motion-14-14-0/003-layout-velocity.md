# Plan 003: A spring layout animation starts with the element's current velocity (Motion 14.13 layout velocity)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4273**. Prefix every Playwright command with `PW_PORT=4273`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/motionDomProjection.spec.ts src/routes/tests/layout src/routes/tests/layout-id src/routes/+page.svelte e2e/layout e2e/layout-id`
> Plan 001 touches none of these paths; plan 002 adds one link in `src/routes/+page.svelte`'s "Motion" section. If anything else changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P1 (the headline feature of Motion 14.13)
- **Effort**: M–L
- **Risk**: MED. The runtime change is small and was proven in a scratch build at planning time, but it sits in the projection adapter, which every layout animation goes through.
- **Depends on**: 001-bump-motion-14-14-0.md (the velocity code only exists in motion-dom 14.13+)
- **Wave**: 2
- **Category**: migration (port)
- **Planned at**: commit `4665b907`, 2026-11-14

## Why this matters

Motion 14.13 made layout animations carry velocity: when a `layout` or `layoutId` element whose transition is a spring is interrupted mid-flight, the next animation starts at the speed the element was already moving, so a reversal swings round where it used to stop dead. The work is in motion-dom's projection node, which we use unchanged, so most of it arrives with the pin. One half does not: motion-dom records the velocity when the node takes its own snapshot (`updateSnapshot()`), and svelte-motion's adapter replaces that snapshot with ones it builds by hand from cached boxes. Those hand-built snapshots carry no velocity, so on 14.14.0 an interrupted layout spring in svelte-motion still starts from rest. This plan ports the missing half, and ports upstream's browser tests so the whole feature is pinned.

## Current state

### Upstream (read with `git -C ~/Github/motion show v14.14.0:<path>`)

All in `packages/motion-dom/src/projection/node/create-projection-node.ts` unless noted. Commits: `f87266545` … `a10bad79f` (PR #4047, 30 commits).

- **Recording**, in `updateSnapshot()` (`:1046`), lines `:1059-1091`:
  ```ts
  if (this.snapshot) {
      const { visualElement } = this.options
      /** A paused or stopped animation hands on no velocity. */
      const isRunning = this.currentAnimation?.state === "running"
      const edges = isRunning && this.animationEdges
      /** A child moving inside its parent hands on only its velocity relative to the parent. */
      if (isRunning && this.relativeTarget) {
          this.snapshot.relativeVelocity = this.relativeVelocity?.slice() || []
      }
      const progress = (edges && this.motionValue?.getVelocity()) || 0
      const velocity = [0, 1, 2, 3, 4, 5].map(
          (i) =>
              (i < 4
                  ? edges &&
                    (this.edgeValues
                        ? this.edgeVelocity!(i)
                        : (-edges[i] * progress) / 1000)
                  : visualElement?.getValue(i < 5 ? "x" : "y")?.getVelocity()) || 0
      )
      if (velocity.some(Boolean)) this.snapshot.velocity = velocity
  }
  ```
  `Measurements.velocity` is `[x min, x max, y min, y max, x value, y value]` in px/s; `relativeVelocity` is `[x min, x max, y min, y max]` inside the parent (`packages/motion-dom/src/projection/node/types.ts:19-27`).
- **Using it**: `setAnimationOrigin` reads `snapshot.velocity` / `snapshot.relativeVelocity` and sets `startVelocity` and `relativeStart` (`:1860-1915`). `startAnimation` (`:2042-2202`) gives each edge its own spring with its own start velocity, **only when `options.type === "spring"`** and there is no `repeat` (`:2045`, `:2094`). A tween takes no velocity, and a spring set with `duration` ignores it inside the spring generator. `mass: "auto"` is resolved at `:2081-2088` by `resolveAutoMass` (`projection/animation/layout-velocity.ts:24-34`). The default layout transition is still a tween (`defaultLayoutTransition`, `:2926`).
- **Tests**: `packages/framer-motion/cypress/integration/layout-velocity.ts` (15 tests) against seven fixtures, `dev/react/src/tests/layout-velocity-{interrupt,fixed-edge,nested,zero-size,auto-mass,drag-layout-id,throw-resize}.tsx`. Read all eight files before starting.

### svelte-motion

- `src/lib/utils/motionDomProjection.ts` is the adapter between our components and motion-dom's `HTMLProjectionNode` (created at `:512`). It imports the `Measurements` type from motion-dom.
- The adapter builds snapshots by hand in these places. None sets `velocity` or `relativeVelocity`:
  - `:204-210`, the builder most of them use:
    ```ts
    const measurementsFromRect = (rect: RectLike, base: Measurements | undefined): Measurements => ({
        animationId: base?.animationId ?? 0,
        measuredBox: boxFromRect(rect),
        layoutBox: boxFromRect(rect),
        latestValues: { ...(base?.latestValues ?? {}) },
        source: base?.source ?? 0
    })
    ```
  - `:2568-2579` `seedOwnOnScreenSnapshot()`: `projection.snapshot = snapshot` (`:2576`)
  - `:2655-2670` in `seedCachedSnapshotsForSubtree()`: `projection.snapshot = snapshot` (`:2669`)
  - `:2163-2167` (presence followers) and `:2467-2470` (the node's `LayoutGroup` members): `projection.snapshot = snapshot`
  - `:725` (a relegated lead keeping its snapshot)
  - `:1318-1324` `seedDepartingLeadSnapshot()` and `:1405-1418` `takeOverLiveLeadOnMount()` (shared `layoutId` handoffs). **These two belong to plan 004; do not edit them here.**
- **Why upstream's own recording is lost.** For a reactive style change, `_MotionContainer.svelte:2666` calls `motionDomProjection?.willUpdate()` before the DOM patch, which runs motion-dom's `willUpdate()` → `updateSnapshot()` and so records velocity. Then the commit (`_MotionContainer.svelte:2771`, `commitObservedLayoutChange(prev, { ownSubtreeChanged: true })`) calls `seedCachedSnapshotsForSubtree`, which overwrites the committer's snapshot with a hand-built one (`motionDomProjection.ts:2655-2670`; `keepsOwn` at `:2664-2666` never applies to the committer).
- **Measured at planning time** (scratch page ported from upstream's fixtures, vite dev server, Chromium, motion-dom 14.14.0, right edge of the box in px per frame, an 0.8 s `visualDuration` spring moving right at about 13 px per frame, clicked again mid-flight):
  - unmodified adapter: `427, CLICK@439.3, 439.3, 438.9, 435.4, 430.4, 424.0` (turns back at once)
  - with the helper from Step 3 applied: `430, CLICK@442.1, 442.1, 448.9, 452.0, 451.7, 448.8, 444.0` (keeps going, then turns)
  - the nested child's own velocity (`?test=nested&move`): unmodified, the child's offset in its parent peaks 0.2 px *below* the offset at the interrupt; with the helper, 6.7 px above (upstream's threshold is 3).
  - Already working on 14.14.0 without any port: the fixed edge stays within 0.001 px, a nested child stays within 0.001 px of its place, the zero-size animation completes at width 200, `mass: "auto"` settles a 500 px box about 650 ms after a 50 px one, the default transition and a duration spring finish on time.
- **Two older divergences surfaced by the same fixtures. They are not this plan's to fix**; they have their own plans, and this plan only marks their tests:
  - *Plan 005*: after an interrupt, our new animation starts up to one frame of travel past the painted position (measured 8 to 12 px on a tween where upstream's test allows 1). So upstream's "tween starts from rest", "duration spring starts from rest", "holds still during the delay" and "mirror spring goes back" tests fail today for a reason unrelated to velocity.
  - *Plan 004*: a dragged card that hands off to a `layoutId` twin starts 90 px back, at its undragged position, and carries no throw velocity.
- **Conventions**:
  - Test pages: `src/routes/tests/<area>/<page>/+page.svelte`, importing from `$lib`, linked from `src/routes/+page.svelte`. The "Layout" section starts at `:1221`; the last layout link is `overdamped-spring` at `:1457-1464`. Copy that list item's markup.
  - Pages a human reviews use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), hidden under `?@isPlaywright=true`. Step type: `{ text: string; expected: string; action?: { label?: string; run: () => void } }`. `src/routes/tests/layout/overdamped-spring/+page.svelte` is the model (fixture markup, `isTester` flag set in `onMount`, a live verdict in the `summary` snippet, a `checks` snippet).
  - Object styles take CSS strings with units: `style={{ position: 'absolute', left: moved ? '1000px' : '0px' }}`.
  - Specs: `e2e/<area>/<name>.spec.ts`, loading `/tests/<area>/<page>?@isPlaywright=true`. `e2e/layout/overdamped-spring.spec.ts` is the model (header comment naming the upstream file and tag, `test.use({ viewport: … })`).
  - Library source has no `as any`. Reach motion-dom's untyped node fields through a narrow local type, as `seedDepartingLeadSnapshot` does (`:1310-1313`).
  - Every exported function has a Google-style JSDoc with `@param`, `@returns` and an `@example`.
  - Changesets: one file per plan in `.changeset/`, frontmatter `'@humanspeak/svelte-motion': minor`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0; `motion-dom` is 14.14.0 |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| One e2e file | `PW_PORT=4273 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Layout e2e | `PW_PORT=4273 pnpm exec playwright test --project=chromium e2e/layout e2e/layout-id e2e/animate-presence e2e/reorder e2e/projection e2e/animate-layout` | all pass (known skips only) |
| Full e2e | `PW_PORT=4273 pnpm exec playwright test --project=chromium` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Playwright builds and previews the package itself (`playwright.config.ts`), so the spec always runs against current code. Trunk is the lint and format authority.

## Scope

**In scope:**
- `src/lib/utils/motionDomProjection.ts`: one new exported helper, and one call after each of the four assignments listed in Step 3
- `src/lib/utils/motionDomProjection.spec.ts`: new tests for the helper
- `src/routes/tests/layout/velocity/+page.svelte` (create)
- `src/routes/tests/layout-id/throw/+page.svelte` (create)
- `e2e/layout/velocity.spec.ts` (create)
- `e2e/layout-id/throw.spec.ts` (create)
- `src/routes/+page.svelte`: two links at the end of the "Layout" section
- `.changeset/layout-velocity.md` (create)

**Out of scope:**
- `seedDepartingLeadSnapshot()` and `takeOverLiveLeadOnMount()` in `motionDomProjection.ts` (plan 004).
- When or from what box a snapshot is taken (`onScreenSnapshot()`, `commitObservedLayoutChange()`, `flushFrameSteps` in `_MotionContainer.svelte`): plan 005.
- `_MotionContainer.svelte`, `src/lib/utils/layout.ts`, `src/lib/utils/animateLayout.ts`.
- Docs and the docs example (plan 006).
- Loosening a threshold copied from upstream. A threshold that fails is a finding to report, not a number to change.

## Git workflow

- Lane branch `lane/14140-layout-velocity`, cut from `feat/motion-14.14.0` after plan 001 is merged.
- Conventional commits, for example `test(layout): port upstream's layout velocity fixtures and tests (red)` and `feat(layout): spring layout animations keep their velocity`.
- Do not push.

## Steps

### Step 1: Port the fixtures

**`src/routes/tests/layout/velocity/+page.svelte`** holds five fixtures, chosen by `?test=`: `interrupt` (default), `fixed-edge`, `nested`, `zero-size`, `auto-mass`. Read the query with `page.url.searchParams` from `$app/state`. Port each upstream fixture exactly: same ids, sizes, positions, colours, transitions and query flags.

- `interrupt`: `motion.div#box`, `layout`, toggles `left` `100px` ↔ `500px` on click; `top: 100px`, 100×100, red, `position: absolute`. Transition: `?tween` → `{ duration: 0.8 }`; `?duration` → `{ type: 'spring', duration: 0.8, bounce: 0 }`; else `{ type: 'spring', visualDuration: 0.8, bounce: 0 }`, or with `?mirror` `{ type: 'spring', visualDuration: 0.3, bounce: 0, repeat: 1, repeatType: 'mirror' }`.
- `fixed-edge`: `#box` toggles `width` `100px` ↔ `500px` at `left: 100px`. `?tween` → `{ duration: 0.8 }`; else `{ type: 'spring', visualDuration: 0.8, bounce: 0, delay: ?delay ? 0.3 : 0 }`.
- `nested`: `#parent` (`layout`, click toggles) at `top: 0`, `left` `0px` ↔ `200px`, size `300px` ↔ `600px`, red; inside it `#child` (`layout`) at `top: 20px`, `left: 20px` (or `220px` when toggled and `?move`), 40×40, blue. With `?still` the parent does not move. Both use `{ type: 'spring', visualDuration: 0.45, bounce: 0 }` plus `mass: 'auto'` unless `?move`.
- `zero-size`: `#box`, `layout`, `data-completed={completed}`, `transition={{ type: 'spring', visualDuration: 0.4, bounce: 0 }}`, `onLayoutAnimationComplete={() => completed++}`; each click advances through `{ left: '100px', width: '0px' }`, `{ left: '400px', width: '0px' }`, `{ left: '400px', width: '200px' }`.
- `auto-mass`: a `div#toggle` (`display: flex; gap: 40px; align-items: flex-start`, click toggles) holding `#small` (50×50) and `#big` (500×500), each `layout`, `flex: none`, `marginTop` `0px` ↔ `200px`, writing `data-duration` from `onLayoutAnimationStart` / `onLayoutAnimationComplete` (`performance.now()` difference). `?default` → no `transition` prop; `?duration` → `{ type: 'spring', duration: 0.3, bounce: 0 }`; else `{ type: 'spring', visualDuration: 0.45, bounce: 0, mass: 'auto' }`.

**`src/routes/tests/layout-id/throw/+page.svelte`**: upstream's `drag-layout-id` and, with `?resize`, `throw-resize`. `{#if open}` a blue `motion.div#box` with `layoutId="card"` at `top: 400px; left: 50px`, 100×100 (or `400px` wide with `?resize`); `{:else}` a red `motion.div#box` with `layoutId="card"`, `drag`, `onDragEnd={() => (open = true)}` at `top: 100px; left: 300px`, 100×100. Transition: `?tween` → `{ duration: 0.8 }`; `?resize` → `{ type: 'spring', visualDuration: 0.45, bounce: 0, mass: 'auto' }`; else `{ type: 'spring', visualDuration: 0.8, bounce: 0 }`.

Both pages get a `TesterPanel` (hidden under `@isPlaywright`), following `overdamped-spring`:
- The panel's `checks` snippet lists the fixtures as links (`?test=interrupt`, `?test=interrupt&tween`, `?test=interrupt&duration`, `?test=fixed-edge`, `?test=nested`, `?test=nested&move`, `?test=zero-size`, `?test=auto-mass`, `?test=auto-mass&default`; on the throw page `?`, `?tween`, `?resize`) and says which one is showing.
- Steps for the current fixture, each with an action button and a stated expected result. For `interrupt`: "Click **Go** (the box starts right)" then "Click **Reverse** while it moves" with expected "it keeps moving right for a moment, then swings back; with `?tween` or `?duration` it turns at once". For `fixed-edge`: "the left edge never moves". For `nested`: "the blue child keeps its place in the red parent". For `auto-mass`: "the big box settles later than the small one". For the throw page: "Drag the red card to the right and release while moving" / "the blue card keeps moving right for a moment before it travels down and left" and a **Reset** button that sets `open = false`.
- A live verdict in the `summary` snippet. For `interrupt` and `fixed-edge`: after **Reverse**, sample the box's left (or right) edge once per painted frame for 10 frames with `onPaintedFrame` (`src/routes/tests/independent-transforms/_paintedFrames.ts`) and show `CARRIED +N px ✓` when it travels more than 5 px past the position at the click, `FROM REST` otherwise (which is the correct verdict on `?tween` and `?duration`; say so in the text). For `auto-mass`: show both durations. For the throw page: show the blue card's first-frame left edge next to the red card's last one.
- At 1920 px wide nothing may sit under the panel, and each fixture must fit a 1280×720 viewport with the panel hidden.

Add two links at the end of the "Layout" section of `src/routes/+page.svelte`, after the `overdamped-spring` item (`:1457-1464`): `/tests/layout/velocity` ("Layout velocity: an interrupted spring keeps its speed (Motion 14.13)") and `/tests/layout-id/throw` ("layoutId: a thrown card hands its velocity on (Motion 14.13)").

**Verify**: `pnpm check` → 0 errors.

### Step 2: Port upstream's 15 tests (red)

Create `e2e/layout/velocity.spec.ts` (12 tests) and `e2e/layout-id/throw.spec.ts` (3 tests): a port of `packages/framer-motion/cypress/integration/layout-velocity.ts` @ v14.14.0, keeping each test's name, waits and thresholds. Use `test.use({ viewport: { width: 1280, height: 720 } })`. Port the helpers as in-page `requestAnimationFrame` loops inside `page.evaluate`, as upstream does. The interrupt helper reads the position and clicks **in the same `evaluate`**, so no frame passes between them:

```ts
const interrupt = async (page: Page, query: string, wait = 250, count = 6) => {
    await page.goto(`/tests/layout/velocity?test=interrupt${query}&@isPlaywright=true`)
    await page.waitForTimeout(200)
    await page.click('#box')
    await page.waitForTimeout(wait)
    return page.evaluate(
        (count) =>
            new Promise<{ atInterrupt: number; samples: number[] }>((resolve) => {
                const box = document.getElementById('box')!
                const left = () => box.getBoundingClientRect().left
                const atInterrupt = left()
                box.click()
                const samples: number[] = []
                const tick = () => {
                    samples.push(left())
                    samples.length < count ? requestAnimationFrame(tick) : resolve({ atInterrupt, samples })
                }
                requestAnimationFrame(tick)
            }),
        count
    )
}
```

The drag tests dispatch upstream's synthetic pointer events (`pointerdown` on `#box`, `pointermove`/`pointerup` on `window`, `pointerId: 1`, `pointerType: 'mouse'`, `isPrimary: true`, `buttons: 1`, `bubbles: true`) from inside the page, one move per animation frame, exactly as upstream's `throwCard` does.

Tests and who owns them:

| # | Test (upstream name) | Fixture | Expected after Step 2 | Owner |
| --- | --- | --- | --- | --- |
| 1 | An interrupted layout animation keeps its velocity | `interrupt` | **FAILS** (red anchor) | this plan |
| 2 | An interrupted layout tween starts from rest | `interrupt&tween` | fails | plan 005 |
| 3 | An interrupted layout spring with a duration starts from rest | `interrupt&duration` | fails | plan 005 |
| 4 | An interrupted spring keeps an edge that doesn't move still | `fixed-edge` | passes | guard |
| 5 | A nested child keeps its place while its parent is interrupted | `nested` | passes | guard |
| 6 | A child moving inside its parent keeps only its own velocity | `nested&move` | **FAILS** (red anchor) | this plan |
| 7 | A layout animation that starts with no width completes | `zero-size` | passes | guard |
| 8 | An interrupted spring with a delay holds still during the delay | `fixed-edge&delay` | fails or borderline | plan 005 |
| 9 | With mass auto, a bigger element settles later | `auto-mass` | passes | guard |
| 10 | The default layout transition stays a tween | `auto-mass&default` | passes | guard |
| 11 | A layout spring with a duration ends on time | `auto-mass&duration` | passes | guard |
| 12 | An interrupted mirror spring goes back to where it was interrupted | `interrupt&mirror` | fails | plan 005 |
| 13 | A thrown card hands its velocity to a layoutId element | throw | fails | plan 004 |
| 14 | A layoutId tween starts from rest | throw `?tween` | passes | guard |
| 15 | A thrown card keeps its size between the card and the detail view | throw `?resize` | passes | guard |

(Upstream has 15 tests. Rows 13 to 15 are its three drag tests and go in `throw.spec.ts`; rows 1 to 12 go in `velocity.spec.ts`. The numbering here is ours, not upstream's order.)

Run the two specs once with every test plain, and record the result of each in your report. Then mark the tests owned by plans 004 and 005 that failed with `test.fail()` as the first line of the test body, with a comment naming the plan, for example `// Plan 005 (motion-14-14-0): the interrupt starts one frame late.` A test from that list that already passes stays plain; say so in your report.

**Verify**: `PW_PORT=4273 pnpm exec playwright test --project=chromium e2e/layout/velocity.spec.ts e2e/layout-id/throw.spec.ts`:
- test 1 FAILS: `Math.max(...samples.slice(0, 4))` is not greater than `atInterrupt + 5` (measured at planning time: about +2);
- test 6 FAILS: the maximum offset is not greater than `atInterrupt + 3` (measured: about −0.2);
- every guard test PASSES; every `test.fail()` test is reported as an expected failure.

If test 1 or test 6 passes before Step 3, the reproduction is wrong: STOP. If a guard test fails, STOP and report it (it worked on a 14.14.0 scratch build at planning time).

Commit: `test(layout): port upstream's layout velocity fixtures and tests (red)`.

### Step 3: Record velocity on the snapshots the adapter builds

In `src/lib/utils/motionDomProjection.ts`, next to `measurementsFromRect` (`:204`), add an exported pure function and a small applier. Target shape:

```ts
/** The fields of a motion-dom projection node that layout velocity reads. */
export type SnapshotVelocitySource = {
    currentAnimation?: { state?: string }
    animationEdges?: number[]
    edgeValues?: number[]
    edgeVelocity?: (index: number) => number
    relativeTarget?: unknown
    relativeVelocity?: number[]
    motionValue?: { getVelocity(): number }
    options: { visualElement?: { getValue(key: string): { getVelocity(): number } | undefined } }
}

/**
 * How fast a projection node is moving, in the shape motion-dom stores on a
 * snapshot. A port of `updateSnapshot()`'s velocity block
 * (create-projection-node.ts 1059-1091 @ v14.14.0) for the snapshots this
 * adapter builds itself, which motion-dom's `updateSnapshot()` never sees.
 *
 * @param node The projection node the snapshot describes.
 * @returns `velocity` as `[x min, x max, y min, y max, x value, y value]` in
 * px/s when anything moves, and `relativeVelocity` when the node animates
 * inside an animating parent.
 *
 * @example
 * ```ts
 * Object.assign(projection.snapshot, readSnapshotVelocity(projection))
 * ```
 */
export const readSnapshotVelocity = (
    node: SnapshotVelocitySource
): Pick<Measurements, 'velocity' | 'relativeVelocity'> => { … }
```

The body is upstream's block, line for line, returning an object instead of writing to `this.snapshot`. Then a private helper `recordSnapshotVelocity(projection)` that does nothing when `projection.snapshot` is unset and otherwise assigns the two fields onto it (read the node's fields through one cast to `SnapshotVelocitySource`; no `any`).

Call `recordSnapshotVelocity(projection)` on the line after each of these four assignments, and nowhere else:
- `:2576` in `seedOwnOnScreenSnapshot()`
- `:2669` in `seedCachedSnapshotsForSubtree()`
- `:2167` (presence followers)
- `:2470` (`LayoutGroup` members)

Each call's node is the one whose snapshot was just set (`projection` in all four). Add one comment at the first site explaining why (the excerpt under "Why upstream's own recording is lost").

**Verify**:
- `PW_PORT=4273 pnpm exec playwright test --project=chromium e2e/layout/velocity.spec.ts e2e/layout-id/throw.spec.ts` → tests 1 and 6 PASS; guards PASS; `test.fail()` tests still fail as expected. If a `test.fail()` test now passes, Playwright reports it as an error: remove its annotation and note it in your report.
- `pnpm check` → 0 errors.

### Step 4: Unit tests for the helper

In `src/lib/utils/motionDomProjection.spec.ts`, add `describe('readSnapshotVelocity', …)` with plain fake nodes:

1. An idle node (no `currentAnimation`) with still x/y values → `{}`.
2. A running node with `animationEdges: [10, 20, 30, 40]` and `motionValue.getVelocity() → 500`, no `edgeValues` → `velocity` is `[-5, -10, -15, -20, 0, 0]`.
3. The same node with `edgeValues` set and `edgeVelocity: (i) => i + 1` → `velocity` starts `[1, 2, 3, 4]`.
4. A paused node (`state: 'paused'`) with edges → no edge velocity; with an `x` value moving at 300 → `velocity` is `[0, 0, 0, 0, 300, 0]`.
5. A running node with `relativeTarget` and `relativeVelocity: [1, 2, 3, 4]` → `relativeVelocity` is an equal array that is not the same object; with `relativeTarget` and no `relativeVelocity` → `[]`.
6. A running node without `relativeTarget` → `relativeVelocity` is absent.

**Verify**: `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts` → all PASS.

### Step 5: Changeset

Create `.changeset/layout-velocity.md` (`minor`): "Layout animations with a spring transition (`type: 'spring'`) now start with the element's current velocity when they interrupt a running layout animation, as in Motion 14.13. Tweens and springs set with `duration` still start from rest."

### Step 6: Gate

Run `pnpm check`, `pnpm test:only`, `pnpm build`, the layout e2e group from the commands table, then the full chromium e2e while no other lane is running Playwright, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; e2e passes except known skips and the expected `test.fail()` cases. Re-run a failing spec alone once before reporting it, and say that it was re-run. `e2e/animate-presence/pop-layout-container-move.spec.ts:282` is a known intermittent failure on `main`; a failure there alone is not a STOP. Any other existing spec that fails after Step 3 and passed before it is a STOP: report the spec, the assertion and what the page shows.

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchors**: e2e tests 1 and 6 fail on the unmodified adapter with motion-dom 14.14.0 and pass after Step 3.
- **Guards**: e2e tests 4, 5, 7, 9, 10, 11, 14, 15 (free with the pin; they keep it that way).
- **Handed to other plans**: tests 2, 3, 8, 12 (plan 005) and 13 (plan 004), marked `test.fail()` so they turn into errors the moment they start passing.
- **Unit**: six cases for `readSnapshotVelocity`.
- Not ported: `packages/motion-dom/src/projection/animation/__tests__/layout-velocity.test.ts` tests `resolveAutoMass` and `pointToProgressVelocity`, which motion-dom does not export. E2e tests 9 to 11 cover `resolveAutoMass`'s effect. `pointToProgressVelocity` (velocity along a curved `arc()` layout path) has no upstream browser test and none here.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including the `readSnapshotVelocity` tests
- [ ] `e2e/layout/velocity.spec.ts` tests 1 and 6 pass and were recorded failing before Step 3
- [ ] `grep -n "recordSnapshotVelocity(projection)" src/lib/utils/motionDomProjection.ts` → exactly four lines (the four call sites)
- [ ] `grep -n "as any" src/lib/utils/motionDomProjection.ts` → no output
- [ ] `grep -c "tests/layout/velocity\|tests/layout-id/throw" src/routes/+page.svelte` → `2`
- [ ] Full chromium e2e → no new failures (or a STOP report)
- [ ] `git status` shows only in-scope files; `.changeset/layout-velocity.md` exists

## STOP conditions

- `node_modules/motion-dom` is not 14.14.0 (plan 001 is not merged into your base).
- The code at the locations in "Current state" does not match the excerpts.
- Test 1 or test 6 passes before Step 3, or still fails after it.
- A guard test fails at any point.
- After Step 3, an existing layout, `layoutId`, presence or Reorder spec fails that passed before it.
- Making test 1 pass seems to need a change outside the four call sites, or to `seedDepartingLeadSnapshot()` / `takeOverLiveLeadOnMount()`.

## Maintenance notes

- Any new place in the adapter that assigns `projection.snapshot` by hand must also call `recordSnapshotVelocity`, or layout velocity is silently lost on that path. On a future bump, diff upstream's `updateSnapshot()` against `readSnapshotVelocity`.
- `motionDomProjection.ts` is also edited by plans 004 and 005 (different functions; merge 003 first).
- Velocity applies only to `type: 'spring'` layout transitions without `repeat`. The default layout transition is a tween, so apps that never set a layout spring see no change.
- Sign-off: the maintainer drives both pages against an upstream twin (see the batch README). The dispatcher builds the twin from upstream's seven `dev/react/src/tests/layout-velocity-*.tsx` fixtures with the same buttons in the same order.
- Reviewer: check that no upstream threshold was changed, and that the `test.fail()` annotations each name plan 004 or 005.
