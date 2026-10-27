# Plan 005: Guard the Motion 14.7 engine fixes with painted-frame regression pages

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Two phases.** Phase A (Steps 1-7) runs on the lane worktree as created, which is still on Motion 14.6.0: write
> the pages and specs, prove they fail where expected, commit, then **STOP and report "phase A red"** with the
> result table from Step 7. Do Phase B (Steps 8-10) only when the dispatcher tells you to.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4215** (`PW_PORT=4215`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/routes/tests/independent-transforms src/routes/tests/layout src/routes/tests/motion e2e/independent-transforms e2e/layout e2e/motion src/routes/+page.svelte`
> Expected: no output. On a mismatch, compare the "Current state" excerpts with the live code; on a mismatch there,
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test pages and specs only; nothing in `src/lib` changes)
- **Depends on**: 001 (Phase B merges `feat/motion-14.7.1`, which carries 001's bump to motion-dom 14.7.1; the
  fixes under test only exist there)
- **Wave**: 1 for Phase A (no dependency); Phase B runs after 001 is committed on `feat/motion-14.7.1`
- **Category**: tests
- **Planned at**: commit `f8ac71aa` (`main` after the 14.6.0 release, v2.5.0, Motion 14.6.0), 2026-10-27

## Why this matters

Motion 14.7.0/14.7.1 fixed four visual glitches inside motion-dom, which svelte-motion runs directly, so the fixes
arrive with plan 001's pin bump and need no port. Nothing in this repo would notice if a later svelte-motion
change (for example in our speculative layout measuring, which detaches WAAPI effects) brought one back. Each is a
one-frame or late-animation glitch that a sampled rect would miss, so every new spec records **every frame
in-page** and judges the recording:

1. #4022 (14.7.1): a sibling's or child's layout update distorted an element looping a rotation on the compositor.
2. An interrupted `backgroundColor` animation jumped to a colour that wasn't on screen.
3. Changing the speed of an accelerated transform animation flashed for a frame.
4. #1207: a slow overdamped spring layout animation snapped to its target part-way through.

## Current state

### Upstream fixes and the tests to port (read with `git -C ~/Github/motion show v14.7.1:<path>`)

1. **#4022, "Demote transforms to CPU when interrupted by layout animations"** (CHANGELOG 14.7.1). Commits
   `6c6edff28` (fix), `11f01c5f6` and `075a6a71f` (tests), `4e72d8df5` (comment). The fix,
   `packages/motion-dom/src/projection/node/create-projection-node.ts` @v14.7.1:
   ```ts
   const demoteTransforms = (node: IProjectionNode) =>
       node.instance &&
       transformGroups.get(node.instance)?.demote() &&
       node.resetSkewAndRotation()
   ```
   (`startUpdate()` reset rotations before measuring, but a rotation on the compositor kept showing; demoting then
   committed the rotated transform, so the node was measured rotated and got a layout animation that inherited the
   infinite transition.) Spec `tests/react/layout-sibling-rotating-3d.spec.ts` (98 lines; fixtures
   `dev/react/src/tests/layout-sibling-rotating-3d.tsx` and `dev/react/src/tests/layout-ancestor-rotating-3d.tsx`).
   Key parts of the spec:
   ```ts
   async function expectUndistorted(page: Page) {
       const transforms = await recordTransforms(page, "pack")   // inline style.transform every frame for 1 s
       expect(transforms.length).toBeGreaterThan(10)
       for (const transform of transforms) {
           expect(transform).toContain("rotateY(")
           expect(transform).not.toContain("scale")
           expect(transform).not.toMatch(/translate3d\((?!0px, 0px)/)
       }
       expect(transforms[transforms.length - 1]).not.toBe(transforms[0])
   }
   async function spin(page: Page, test: string) {
       await page.goto(`?test=${test}&later`)
       await page.waitForSelector("#pack")
       await page.waitForTimeout(100)
       await page.evaluate(() => (window as any).spin())
       await page.waitForTimeout(1300)
       // exactly one animation on #pack has `transform` keyframes (on the compositor)
       expect(accelerated).toBe(1)
   }
   test.describe("layout measurements of a looping 3D rotation", () => {
       test.use({ viewport: { width: 1000, height: 700 } })
       test("a sibling's layout update doesn't distort it", …)   // spin, page.hover("#button"), expectUndistorted
       test("unmounting doesn't distort it", …)                 // relies on React Strict Mode's remount
       test("a child's layout update doesn't distort the child", …) // spin ancestor, rerender(); every #child
                                                                    // transform is "" or "none"; then expectUndistorted
   })
   ```
   Sibling fixture: `LayoutGroup` > `motion.div layoutId="hero"` (`position: relative; 900×650`) containing
   `motion.div id="pack" layoutId="pack"` (absolute, left 300, top 100, 200×300, violet, `rotate: -12`,
   `rotateX: -12`, `transformPerspective: 962`, `z: -80`, `transformStyle: "preserve-3d"`,
   `initial={{ rotateY: 0 }}`, `animate={{ rotateY: isSpinning ? 360 : 0 }}`,
   `transition={{ duration: 4, repeat: Infinity, ease: "linear" }}`) and a `motion.button id="button"
   layoutId="button" layoutDependency={hover}` (absolute, left 600, top 500, 140×40, text "Hover me") whose
   `onMouseEnter` / `onMouseLeave` set `hover`. `?later` defers the spin until `window.spin()`.
   Ancestor fixture: `motion.div id="pack" layout` (same box, `rotate: -12`, `transformPerspective: 962`, same
   rotateY loop, starts on `window.spin()`) containing `motion.div id="child" layout layoutDependency={count}`
   (absolute, left 20, top 20, 100×100, red); `window.rerender()` increments `count`.
2. **WAAPI colour interrupt.** Commits `71465b139` (first fix), `f9e080f21` (final fix: `backgroundColor` removed
   from `acceleratedValues`, so colours run in JS), `05302644b` (wording). Spec
   `tests/react/waapi-color-interrupt.spec.ts` (95 lines), fixture `dev/react/src/tests/waapi-color-interrupt.tsx`:
   a 100×100 `motion.div id="box"`, `initial={{ backgroundColor: from }}`, `animate={{ backgroundColor: target }}`,
   `transition={{ duration: 1, ease: "linear" }}`; `target` starts as `to` and is set back to `from` after 550 ms
   (recording `window.interruptedAt = performance.now()`); every rAF pushes
   `[timestamp, getComputedStyle(box).backgroundColor]` to `window.colorFrames` until 1900 ms. Cases:
   `rgb(255, 0, 0) → rgb(0, 0, 255)` and `rgba(255, 0, 0, 0.2) → rgb(0, 0, 255)`. Assertions: >20 frames; the
   premultiplied blue channel peaks between 60 and 220 and ends at 0; in the window
   `-50 ms … +150 ms` around `interruptedAt`, no frame-to-frame rate exceeds `3 × max(neighbours) + 0.3`, and at
   least 4 steps were checked. Copy its `premultiplied()` and rate loop verbatim.
3. **Transform speed changes stay on the compositor without a jump.** Commits `ccdd9da35` (use
   `updatePlaybackRate()`: setting `playbackRate` + `startTime` restarted a compositor animation and could render
   the underlying value for one frame; this is the Chromium-visible fix), `b58283208` and `dc23e95f8` (WebKit
   ready-time fixes). Spec `tests/animate/independent-transforms-handoff.spec.ts` @v14.7.1, the three tests at
   lines 201-316: "speed changes stay on the compositor without a jump" (201-232), "speed changes after pause()
   and play() don't jump" (234-268, added by `27cadbba9`), "pause() and play() stay on the compositor without a
   jump" (270-316), plus helpers `tolerance = 2.5`, `timeOf`, `expectSteady` (lines 34-59). Fixture
   `dev/html/public/playwright/animate/animate-independent-transforms.html` exposes `window.Motion`, `wait(ms)`,
   `readTransform(el)` (`DOMMatrixReadOnly(getComputedStyle(el).transform)` → `{ x: m41, y: m42, scale:
   hypot(a, b), rotate }`), `transformAnimations(el)` and:
   ```js
   window.recordFrames = (element, ms) =>
       new Promise((resolve) => {
           const frames = []
           const start = performance.now()
           const record = ({ timestamp }) => {
               frames.push({
                   t: document.timeline.currentTime,
                   ts: timestamp,
                   ...window.readTransform(element),
                   count: window.transformAnimations(element).length,
               })
               if (performance.now() - start >= ms) {
                   window.Motion.cancelFrame(record)
                   resolve(frames)
               }
           }
           window.Motion.frame.postRender(record, true)
       })
   ```
   Viewport `1000×500`; boxes `#a`, `#b` are 100×100 `#0077ff` divs on a `margin: 0` body.
4. **#1207, overdamped spring snapping.** Commits `0325999d2` (failing test), `154d73c5b` (fix in
   `motion-dom/src/animation/generators/spring.ts` and `JSAnimation.ts`), `251cf56b0` (reversed long springs). Spec
   `tests/react/issue-1207.spec.ts` (61 lines), fixture `dev/react/src/tests/issue-1207.tsx`: a `1200×300`
   relative container, `button id="toggle"`, and a `motion.div id="box" layout` with
   `transition={{ type: "spring", stiffness: 4, damping: 35, mass: 0.5 }}`, absolute at top 100,
   `left: moved ? 1000 : 0`, 100×100 blue. The spec clicks the toggle, records `[ms since click,
   getBoundingClientRect().left]` every rAF, waits 10.5 s, then: progress at 5 s in `(0.3, 0.6)`, progress at 10 s
   `< 0.8`, largest frame-to-frame step `< 10` px.

### svelte-motion paths these fixes run through

- **#4022**: svelte-motion measures layout two ways (`src/lib/utils/motionDomProjection.ts`):
  - a real update, `MotionDomProjectionAdapter.willUpdate()` → upstream `projection.willUpdate()` (`:535-542`),
    which runs upstream `startUpdate()` and the fixed `demoteTransforms`;
  - speculative reads from layout observers (`measurePageRect`, `refreshLayout`), which never demote. They call
    `stripToBaseTransforms()` (`:1399-1440`), which detaches (`effect.target = null`) the WAAPI transform effects
    of any element whose own Motion transforms are on the compositor:
    ```ts
            for (const adapter of adapters) {
                if (hasAcceleratedMotionTransform(adapter.visualElement)) {
                    collectTransformEffects(adapter.element!, detached)
                }
            }
    ```
    `hasAcceleratedMotionTransform` (`:208-214`) is true when any `transformPropOrder` value's
    `animation.liveValue()` is defined.
  The ported tests must show which path ran. Two in-page probes are available without touching `src/lib`:
  `countTransformAnimations(id)` from `src/routes/tests/independent-transforms/_countTransformAnimations.ts` (1 = the
  transform group is on the compositor, 0 = demoted to the main thread) and `layoutMeasureStats` (`{ reads,
  silentReads }`, exported from `$lib/utils/motionDomProjection`; see its use in
  `src/routes/tests/layout-dependency/+page.svelte:3,61-66,120-121`).
- **Colour interrupt**: on 14.6.0 a declarative `backgroundColor` animation runs on WAAPI (it is in
  `acceleratedValues`; plan 001's red will-change test shows that). On 14.7.1 it runs in JS.
- **Speed changes**: `animate` from `$lib` (`src/lib/index.ts:51`, `src/lib/utils/animateValue.ts`) wraps Motion's
  `animate`; `animate(element, { x })` on a motion component's element animates that component's VisualElement.
- **#1207**: a `layout` element's projection animation uses motion-dom's spring generator directly.

### Repo conventions and helpers

- `src/routes/tests/independent-transforms/_paintedFrames.ts` exports `onPaintedFrame(read)`: `read` runs once per
  rendered frame from a ResizeObserver on a per-frame ticker, after every rAF callback (Motion's frameloop
  included) and after layout, so it sees exactly the layout about to be painted. Use it for every
  `getBoundingClientRect()` / inline-style recording below. Import it; do not modify it.
- `src/routes/tests/independent-transforms/_countTransformAnimations.ts` exports `countTransformAnimations(id)` and
  `exposeCountTransformAnimations()`. Import; do not modify.
- Tester panel: `TesterPanel` and `TesterStep` from `src/routes/tests/layout/_parity/TesterPanel.svelte` (props
  `eyebrow`, `title`, `status`, `steps`, snippets `summary`, `checks`, `children`; renders nothing under
  `?@isPlaywright=true` or SSR). Exemplar with a live verdict computed only when not under Playwright and
  `.verdict.ok/.bad/.na` chip styles: `src/routes/tests/drag/disable-from-ondrag/+page.svelte:40-90,146-217`. Every
  page in this plan gets one; the verdict logic must only run when
  `!window.location.search.includes('@isPlaywright=true')` and must not change the fixture's layout.
- Page header comment: say which upstream fixture it ports, at which tag, the issue/commit hashes, and any Svelte
  deviation. Model: `src/routes/tests/independent-transforms/basic/+page.svelte:11-28`.
- Specs load `/tests/<area>/<page>?@isPlaywright=true` (extra params appended with `&`). Spec header comment names
  the upstream spec and the page. Model: `e2e/independent-transforms/layout-user-transform.spec.ts:1-13`.
- Index links: `src/routes/+page.svelte`, sections `Independent transforms (Motion 14.2)` (`:444-515`), `Layout`
  (`:962-1094`) and `Motion` (`:22-…`). Copy an existing `<li><a class="text-blue-300 hover:underline"
  href={resolve('/tests/…') + searchParams}>…</a></li>`.
- Playwright runs Chromium only (`playwright.config.ts` `projects`), one worker, 60 s default timeout.
- Svelte has no Strict Mode remount. Where upstream relies on it, use an explicit `{#key}` remount (see Step 2).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (Phase B) | `pnpm install --frozen-lockfile` (if global pnpm refuses: `npx -y pnpm@12.6.0 install --frozen-lockfile`) | exit 0 |
| Typecheck | `pnpm check` | 0 errors |
| One e2e spec | `PW_PORT=4215 pnpm exec playwright test <path>` | see each step |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| Version check | `grep -n '"motion-dom"' package.json` | `14.6.0` in Phase A, `14.7.1` in Phase B |

## Scope

**In scope** (create unless noted):

- `src/routes/tests/independent-transforms/layout-sibling-rotating-3d/+page.svelte`
- `src/routes/tests/independent-transforms/layout-ancestor-rotating-3d/+page.svelte`
- `e2e/independent-transforms/layout-rotating-3d.spec.ts`
- `src/routes/tests/motion/waapi-color-interrupt/+page.svelte`
- `e2e/motion/waapi-color-interrupt.spec.ts`
- `src/routes/tests/independent-transforms/speed-change/+page.svelte`
- `e2e/independent-transforms/speed-change.spec.ts`
- `src/routes/tests/layout/overdamped-spring/+page.svelte`
- `e2e/layout/overdamped-spring.spec.ts`
- `src/routes/+page.svelte` (modify: five links)

**Out of scope**:

- Everything under `src/lib/` (including `motionDomProjection.ts`); `_paintedFrames.ts`,
  `_countTransformAnimations.ts`, `TesterPanel.svelte` (import only).
- `package.json`, `pnpm-lock.yaml` (Phase B gets them from the merge).
- Existing specs, including `e2e/independent-transforms/layout-user-transform.spec.ts` (run it, don't edit it).
- Unit tests for the spring generator: upstream covers it in motion-dom (`generators/__tests__/spring.test.ts`
  "Slow overdamped spring isn't cut off"); svelte-motion has no spring code of its own.
- A changeset (test-only; plan 001's changeset lists these fixes).

## Git workflow

- Lane branch `lane/1471-engine` in `/Users/jasonkummerl/Github/svelte-motion-1471-engine`, created by the
  dispatcher from the wave-0 commit (`f8ac71aa` plus this batch's plan folder), so it is on Motion 14.6.0.
- Conventional commits, e.g. `test(independent-transforms): a looping rotation survives sibling layout updates (#4022)`,
  `test(motion): an interrupted backgroundColor animation doesn't jump`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Phase A — on Motion 14.6.0

**Precondition**: `grep -n '"motion-dom"' package.json` prints `"motion-dom": "14.6.0"`. If not, STOP.

### Step 1: Shared recording shape

Every page below exposes its recorder on `window` from `onMount`, so the spec only triggers and reads. Recorders
record **every frame** (via `onPaintedFrame`, or Motion's `frame.postRender` with keep-alive where upstream does,
both of which run once per rendered frame) and never sample on a timer. Specs never poll the DOM from Playwright to
judge motion. Declare the `window` additions in each page with a local type
(`type FrameWindow = Window & { … }`) rather than a global `declare`.

### Step 2: #4022 rotating-3d pages and spec

1. `src/routes/tests/independent-transforms/layout-sibling-rotating-3d/+page.svelte`, a port of
   `dev/react/src/tests/layout-sibling-rotating-3d.tsx` @v14.7.1 with the structure, ids, sizes and props listed in
   "Current state" (use px strings for lengths; `LayoutGroup` from `$lib`; the button is a `motion.button` with
   `onmouseenter` / `onmouseleave` setting a `$state` `hover`). `isSpinning` starts `true` unless the query has
   `later`; read it in `onMount` from `location.search` (store in `$state`). Svelte deviation, documented in the
   header: wrap the pack in `{#key packKey}` and expose `window.remount = () => packKey++`, which unmounts the
   `layoutId="pack"` element and mounts a new one (the Svelte stand-in for React Strict Mode's remount). Also expose
   `window.spin`, and `window.recordTransforms(id, ms)` which resolves with
   `{ transform: string; count: number }[]`, one entry per painted frame for `ms` milliseconds
   (`el.style.transform` and `countTransformAnimations(id)`, re-querying `document.getElementById(id)` each frame),
   and `window.measureStats = () => ({ ...layoutMeasureStats })`. Call `exposeCountTransformAnimations()` (from
   `../_countTransformAnimations`) in `onMount`, so the spec can call `window.countTransformAnimations('pack')`.
2. `src/routes/tests/independent-transforms/layout-ancestor-rotating-3d/+page.svelte`, a port of
   `dev/react/src/tests/layout-ancestor-rotating-3d.tsx` @v14.7.1 (spin starts on `window.spin()`;
   `window.rerender()` increments the child's `layoutDependency`), with the same `recordTransforms` and
   `measureStats`, and the same `exposeCountTransformAnimations()` call in `onMount`.
3. `e2e/independent-transforms/layout-rotating-3d.spec.ts`, a port of `tests/react/layout-sibling-rotating-3d.spec.ts`
   @v14.7.1. `test.use({ viewport: { width: 1000, height: 700 } })`. Keep `expectUndistorted` (reading
   `recordTransforms('pack', 1000)`) and `spin` (goto `…?@isPlaywright=true&later`, wait for `#pack`, 100 ms,
   `spin()`, 1300 ms, `countTransformAnimations('pack')` is `1`) as upstream. Tests:
   - "a sibling's layout update doesn't distort it": `spin`, `page.hover('#button')`, `expectUndistorted`.
   - "remounting doesn't distort it" (Svelte port of "unmounting doesn't distort it"): goto without `later`, wait for
     `#pack`, 1300 ms, assert `countTransformAnimations('pack')` is `1`, call `remount()`, wait until a new `#pack`
     element exists (`page.waitForFunction` comparing against a handle taken before), then re-trigger the spin on
     the new element, 1300 ms, assert `countTransformAnimations('pack')` is `1`, `expectUndistorted`.
     Amendment (operator-approved 2026-10-27): Motion 14.7.1 mounts a `layoutId` takeover as if `initial={false}`
     (`packages/framer-motion/src/motion/index.tsx:114-122` @v14.7.1; ours `layoutIdTakeover`), so the new element
     starts at its target and does not loop until the spin is re-triggered. `window.spin()` must restart the loop
     on the remounted element: if `isSpinning` is already `true`, set it to `false`, wait a frame, then `true`.
     The tester panel's step 3 becomes "Click **Remount**, then **Spin**" → "The card restarts its loop in place,
     undistorted."
   - "a child's layout update doesn't distort the child": `spin` on the ancestor page, `rerender()`, record
     `child` for 1000 ms and expect every `transform` in `['', 'none']`, then `expectUndistorted`.
   In each test also attach the path probes to the test output (`test.info().annotations.push(...)`): the number of
   recorded frames with `count === 0` on `#pack`, and the `measureStats()` delta across the trigger. These are
   evidence only; do not assert on them.
4. Tester panels. Sibling page: eyebrow `Motion 14.7.1 · #4022`, title `A sibling's layout update doesn't distort a
   compositor rotation`; steps: (1) "Click **Spin** (or reload without `?later`)" → "The violet card loops a 3D
   rotation." (2) "Move the pointer on and off **Hover me** a few times" → "The card keeps the same shape and size
   every loop; it never stretches, shrinks or slides." (3) "Click **Remount**" → "The card restarts its loop in
   place, undistorted." Give steps 1 and 3 `action`s that call `window.spin()` / `window.remount()`. Live verdict:
   for 1 s after each hover change or remount, record the pack's inline transform per painted frame and show
   `UNDISTORTED ✓` if no frame contains `scale` or a non-zero `translate3d`, else `DISTORTED ✗` with the first bad
   transform; `WAITING` before the first trigger. Ancestor page: same pattern, title `A child's layout update
   inside a rotating ancestor isn't distorted`, steps Spin → Re-render child (action calls `window.rerender()`),
   verdict also requires every child frame to be `''` / `'none'`.

**Verify**: `PW_PORT=4215 pnpm exec playwright test e2e/independent-transforms/layout-rotating-3d.spec.ts` and record
each test's result and annotations. Expected on 14.6.0: the sibling and child tests **FAIL** with a recorded
transform containing `scale` or a non-zero `translate3d`. The remount test may pass (its adaptation goes through
svelte-motion's own `layoutId` takeover, not upstream's resume path). If the sibling or child test passes on 14.6.0,
re-run it alone once; if it still passes, record it as a guard in the Step 7 table together with its probe
annotations (`count === 0` frames, measure-stat delta), so the maintainer can see which measuring path ran. That is
not a STOP. If a test fails on the `count` precondition
(`countTransformAnimations('pack')` is not `1` after 1300 ms), the rotation never reached the compositor and the
test exercises nothing: STOP.

### Step 3: WAAPI colour interrupt page and spec

1. `src/routes/tests/motion/waapi-color-interrupt/+page.svelte`, a port of
   `dev/react/src/tests/waapi-color-interrupt.tsx` @v14.7.1 (`from` / `to` from `location.search`, read in
   `onMount`; defaults `rgb(255, 0, 0)` / `rgb(0, 0, 255)`). Record
   `[document.timeline.currentTime, getComputedStyle(box).backgroundColor]` once per painted frame with
   `onPaintedFrame` into `window.colorFrames`. Use `document.timeline.currentTime` (the frame time, which is what
   upstream's rAF `timestamp` is), never `performance.now()` inside the ResizeObserver callback, which drifts with
   when the callback runs and would distort the per-ms rates. Look up `#box` in each callback and skip the frame while
   it is `null` (it only exists once `{#if ready}` renders). Set `window.interruptedAt = document.timeline.currentTime`
   and the target back to `from` at 550 ms after the box mounts, and stop recording at 1900 ms. Also expose `window.colorAnimations = () =>` the number of
   `#box` animations whose keyframes include `backgroundColor` or `background-color` (WAAPI evidence).
   Because `initial`/`animate` must not start before the recorder, render the `motion.div` only after `onMount` has
   read the query (an `{#if ready}`).
2. `e2e/motion/waapi-color-interrupt.spec.ts`, a port of `tests/react/waapi-color-interrupt.spec.ts` @v14.7.1: both
   cases, `premultiplied()`, the blue-peak checks and the jump detector copied verbatim, against
   `/tests/motion/waapi-color-interrupt?@isPlaywright=true&from=…&to=…`. Before the 2100 ms wait, read
   `colorAnimations()` at ~200 ms and add it as an annotation.
3. Tester panel: eyebrow `Motion 14.7 · f9e080f21`, title `An interrupted colour animation continues from the
   colour on screen`; steps: (1) "Reload and watch the box" (action: reload) → "It fades from red towards blue, then
   about halfway turns back to red smoothly, with no flash or sudden step in colour." (2) "Open
   `?from=rgba(255,0,0,0.2)&to=rgb(0,0,255)`" (action: navigate) → "Same, starting from a faint red." Live verdict:
   run the spec's jump detector on `window.colorFrames` once recording stops; `SMOOTH ✓` or `JUMP ✗` with the first
   jump `a -> b`.

**Verify**: `PW_PORT=4215 pnpm exec playwright test e2e/motion/waapi-color-interrupt.spec.ts`. Expected on 14.6.0:
at least the opaque case **FAILS** on `expect(jumps).toEqual([])`. If both pass, check the `colorAnimations`
annotation: if it is `0` (no WAAPI colour animation on 14.6.0 in svelte-motion), record "svelte-motion never ran
this on WAAPI; kept as a guard" and continue. If it is `≥ 1` and both pass, record it and continue (guard).

### Step 4: Speed-change page and spec

1. `src/routes/tests/independent-transforms/speed-change/+page.svelte`, a port of the fixture
   `dev/html/public/playwright/animate/animate-independent-transforms.html` @v14.7.1: a `margin: 0` page (wrap in a
   fixture div with no padding; the TesterPanel is fixed-positioned and absent under Playwright) with a plain
   `<div id="a" class="box">` and a svelte-motion `<motion.div id="m" class="box" />`, both 100×100 `#0077ff`. In
   `onMount` expose `window.Motion = { animate, frame, cancelFrame }` (all from `$lib`), `window.wait`,
   `window.readTransform`, `window.transformAnimations` and `window.recordFrames` exactly as upstream (Motion's
   `frame.postRender(record, true)`, which runs once per frame after Motion renders; `t` is
   `document.timeline.currentTime`), then set `window.ready = true`.
2. `e2e/independent-transforms/speed-change.spec.ts`, a port of the three tests at
   `tests/animate/independent-transforms-handoff.spec.ts:201-316` @v14.7.1 with `tolerance`, `timeOf` and
   `expectSteady` copied verbatim, `test.use({ viewport: { width: 1000, height: 500 } })`, and a `beforeEach` that
   loads `/tests/independent-transforms/speed-change?@isPlaywright=true` and waits for `window.ready`. Run each of
   the three tests for both elements (`for (const id of ['a', 'm'])`, test titles suffixed `(plain element)` /
   `(motion component)`), so the svelte-motion component path is covered too. **All six are guards**, and the spec
   header says so: two of the three upstream tests already existed at v14.6.0; the second test's fixes
   (`b58283208`, `dc23e95f8`) are WebKit-only and this repo runs Chromium only; and `getComputedStyle` read in
   `postRender` reports the main-thread sampled value, so it cannot see `ccdd9da35`'s compositor flash.
2b. Painted-frame flash check for `ccdd9da35`, in the same spec: `test('a speed change paints no flash (screencast) (plain element|motion component)', …)`
   for both ids. Open `const cdp = await page.context().newCDPSession(page)` (pattern:
   `e2e/motion/hover-tap-disjoint-keys-throttled.spec.ts:18`), subscribe to `Page.screencastFrame` (ack each frame
   with `Page.screencastFrameAck { sessionId }` and keep `{ data, metadata }`), then
   `Page.startScreencast { format: 'png', everyNthFrame: 1, maxWidth: 1000, maxHeight: 500 }`. In the page run the
   upstream scenario (`animate(el, { x: 600 }, { duration: 3, ease: 'linear' })`, wait 700 ms, `animation.speed = 2`,
   wait 500 ms), then `Page.stopScreencast`. Decode the frames in the browser (pass the base64 PNGs to
   `page.evaluate`, draw each onto a canvas via `createImageBitmap(await (await fetch('data:image/png;base64,' + d)).blob())`,
   `getImageData`) and, on the pixel row through the element's vertical centre (scaled by image width /
   `metadata.deviceWidth`), find the leftmost pixel within 30 of `#0077ff` per channel: that is the painted left
   edge. Assert: at least 20 frames; the painted left edge never decreases between consecutive frames by more than
   2 px (a flash renders the underlying value, i.e. the element back at or near `x = 0`); and no frame after the
   first 3 has its left edge below 5 px. Attach the per-frame edges as an annotation. The two boxes sit in
   different rows, so measure only the row of the element under test.
   Note: a screencast does not guarantee every compositor frame is delivered. If this check cannot be made red on
   14.6.0 in Chromium (it passes twice), keep it as a guard and report that, with the edge trace.
3. Tester panel: eyebrow `Motion 14.7 · ccdd9da35`, title `Changing an accelerated animation's speed doesn't
   flash`; steps with actions: (1) "Run **Speed ×2**" → "Both boxes slide right; 0.7 s in they speed up, with no
   flicker back to the left edge." (2) "Run **Pause / play**" → "They stop for 0.3 s and carry on from the same
   place." (3) "Run **Pause, play, then ×2**" → "No flicker at the speed change." Each action runs that scenario on
   both boxes with `recordFrames`; live verdict per box: `STEADY ✓` if `expectSteady`'s checks hold (reimplemented
   as a boolean) and every frame had `count === 1`, else `JUMP ✗` with the worst frame.

**Verify**: `PW_PORT=4215 pnpm exec playwright test e2e/independent-transforms/speed-change.spec.ts`, then the same
spec alone once more. Record each result on 14.6.0. Expected: the six ported `recordFrames` tests pass (guards); the
two screencast tests are the only ones that may **FAIL** (a painted frame with the box back near the left edge). If
they pass twice, record them as guards with their edge traces (not a STOP). If any test fails on `frames.every((f) => f.count === 1)` for `#m` only, the
component path never reaches the compositor: record it and continue (a finding for the maintainer, not a STOP).

### Step 5: #1207 overdamped spring page and spec

1. `src/routes/tests/layout/overdamped-spring/+page.svelte`, a port of `dev/react/src/tests/issue-1207.tsx`
   @v14.7.1 (container, `button id="toggle"`, `motion.div id="box" layout` with the spring transition and
   `left: moved ? '1000px' : '0px'`). Expose `window.startSampling()`, which clicks the toggle and records
   `[performance.now() - start, box.getBoundingClientRect().left]` once per painted frame (`onPaintedFrame`) into
   `window.samples` until `window.stopSampling()` is called.
2. `e2e/layout/overdamped-spring.spec.ts`, a port of `tests/react/issue-1207.spec.ts` @v14.7.1: title
   `'slow overdamped spring layout animation is not cut off (#1207) @slow'`, `test.slow()` at the top of the test,
   `startSampling()`, `waitForTimeout(10500)`, `stopSampling()`, then upstream's three assertions verbatim.
   Viewport at least 1280 wide (Playwright's default is 1280×720; the container is 1200 wide).
3. Tester panel: eyebrow `Motion 14.7 · #1207`, title `A slow overdamped spring eases all the way`; steps: (1)
   "Click **Toggle** and watch the box for 10 seconds" (action clicks it) → "It glides right, slower and slower,
   and is still short of the right edge after 10 s. It never jumps to the end." Live verdict from per-frame
   samples: after 10 s show `progress at 10 s: NN%` and `SMOOTH ✓` if progress < 80% and the largest step < 10 px,
   else `SNAPPED ✗`.

**Verify**: `PW_PORT=4215 pnpm exec playwright test e2e/layout/overdamped-spring.spec.ts` → **FAILS** on 14.6.0
(progress at 10 s ≥ 0.8 and/or a step ≥ 10 px). If it passes, re-run once; if it still passes, STOP (the page does
not reproduce upstream's fixture, whose bug is in the shared spring generator).

### Step 6: Index links, types, lint

Add links in `src/routes/+page.svelte`: in `Independent transforms (Motion 14.2)` after `layout-hydration`:
`Looping rotation vs a sibling's layout update (#4022)`, `Rotating ancestor vs a child's layout update (#4022)`,
`Changing an accelerated animation's speed`; in `Layout`: `Slow overdamped spring layout animation (#1207)`; in
`Motion`, next to the other `/tests/motion/…` links: `Interrupted backgroundColor animation`.

**Verify**: `pnpm check` → 0 errors; `trunk fmt` then `trunk check` on the ten in-scope files → no new issues.

### Step 7: Commit and STOP ("phase A red")

Commit the pages and specs (one commit per fix is fine). Then STOP and report a table: spec, test, result on
14.6.0 (FAIL with the assertion and the first bad recorded value, or PASS → "guard"), and the probe annotations
(`count === 0` frames, measure-stat deltas, `colorAnimations`).

### Phase B — after the dispatcher says "run Phase B"

### Step 8: Merge the bump

`git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`.

**Verify**: `grep -n '"motion-dom"' package.json` → `"motion-dom": "14.7.1"`; `pnpm check` → 0 errors. A merge
conflict in `src/routes/+page.svelte` is expected if other lanes added links: keep both sides' links.

### Step 9: Green

**Verify**:
- `PW_PORT=4215 pnpm exec playwright test e2e/independent-transforms/layout-rotating-3d.spec.ts e2e/motion/waapi-color-interrupt.spec.ts e2e/independent-transforms/speed-change.spec.ts e2e/layout/overdamped-spring.spec.ts`
  → all pass. Re-run any failure alone once before treating it as a failure.
- Record the probe annotations again. For the sibling test, say which path ran: frames with `count === 0` mean
  upstream's demote path (`willUpdate`); none with a non-zero `reads` delta means svelte-motion's speculative
  `stripToBaseTransforms` path.
- `PW_PORT=4215 pnpm exec playwright test e2e/independent-transforms` → all pass (includes
  `layout-user-transform.spec.ts`, which must stay green).

If a new test still fails on 14.7.1, do not loosen it: svelte-motion's own code diverges from upstream there (a
port is needed, out of scope here). STOP and report the spec, the assertion, and the recorded frames.

### Step 10: Gate

**Verify**: `pnpm check` (0 errors), `PW_PORT=4215 pnpm exec playwright test e2e/independent-transforms e2e/layout e2e/motion`
(all pass; re-run a failing spec alone once and say so), `trunk check` on the in-scope files (clean), and
`git diff --name-only feat/motion-14.7.1...HEAD` lists only in-scope files.

## Test plan

- Red-first (Phase A, Motion 14.6.0): expected FAIL for the #4022 sibling and child tests, the opaque colour
  interrupt case, and #1207; possible FAIL for the screencast speed-change flash check. Phase B: all green.
- Guards that may legitimately pass on 14.6.0, and why: the remount test (Svelte's remount goes through
  svelte-motion's own `layoutId` takeover, not upstream's Strict Mode resume path); all six ported `recordFrames` speed tests
  (two existed at v14.6.0, one covers WebKit-only fixes, and a main-thread `getComputedStyle` can't see a compositor
  flash), plus the screencast check if Chromium never delivers a flash frame to the screencast; the #4022 sibling or
  child test if it passes twice on 14.6.0 (recorded with its probe annotations); the rgba colour case and possibly the opaque one if svelte-motion never
  ran the colour on WAAPI (shown by the `colorAnimations` annotation).
- Every recording is per painted frame in-page (`onPaintedFrame`, or Motion's `frame.postRender` keep-alive for the
  speed tests as upstream), never timer-sampled from Playwright. The speed-change flash is also checked against the
  compositor's actual output via a CDP screencast.
- Existing guard: `e2e/independent-transforms/layout-user-transform.spec.ts` (user transform animations survive
  layout measurement) stays green.

## Done criteria

- [ ] The nine new files exist; `src/routes/+page.svelte` links all five pages
- [ ] Phase A report lists each test's 14.6.0 result; Step 5's test failed there; Step 2's sibling/child tests and
      the screencast checks failed there or are recorded as guards with their annotations
- [ ] Phase B: all new specs and `e2e/independent-transforms`, `e2e/layout`, `e2e/motion` pass on 14.7.1
- [ ] `git diff --name-only feat/motion-14.7.1...HEAD -- src/lib` → no output
- [ ] `pnpm check` 0 errors; `trunk check` clean on the in-scope files

## STOP conditions

- `package.json` is not on motion-dom 14.6.0 at the start of Phase A, or not on 14.7.1 after Step 8.
- The rotation precondition fails (`countTransformAnimations('pack')` is not 1 after spinning): the test would
  exercise nothing.
- The #1207 test passes twice on 14.6.0.
- Any new test fails on 14.7.1 after one alone re-run (a real divergence; needs a port, not a looser test).
- Any existing spec under `e2e/independent-transforms`, `e2e/layout` or `e2e/motion` fails twice after Step 8.
- A test seems to need a change in `src/lib` or in a shared helper.

## Maintenance notes

- If svelte-motion ever demotes during speculative measuring, or stops detaching WAAPI effects in
  `stripToBaseTransforms`, the #4022 pages are the first to re-run; their annotations show which path is live.
- The speed-change spec runs on Chromium only. If a WebKit project is added to `playwright.config.ts`, its
  pause/play cases become the real regression tests for `b58283208` / `dc23e95f8`.
- `@slow` marks the 11 s #1207 spec; `pnpm exec playwright test --grep-invert @slow` skips it locally.
- A reviewer should check that tolerances match upstream exactly (`tolerance = 2.5`, `3 × neighbours + 0.3`,
  `< 0.8`, `< 10` px) and that no recorder samples on a timer.

## Amendments (operator-approved 2026-10-27)

### A2: the remount restarts its loop from 0 (replaces the re-trigger in Step 2.3)

The false→frame→true restart only animated from about 359.7° to 360° on the main thread, and
`countTransformAnimations('pack')` was 0. Instead:

1. The remounted `layoutId="pack"` element restarts its loop from 0 with explicit keyframes
   (`animate={{ rotateY: [0, 360] }}` with the same infinite transition, or the equivalent per remount key). This
   way the loop restarts even though a takeover mounts as if `initial={false}` (`motion/index.tsx:114-122`
   @v14.7.1).
2. Keep the precondition: after the remount, wait 1300 ms, then `countTransformAnimations('pack') === 1`, then
   `expectUndistorted`.
3. If the count is still 0 with a clean `[0, 360]` restart, STOP. Report whether upstream puts the same remounted
   loop on the compositor (cite the code path), and why ours doesn't. That would be a real divergence for a
   separate fix. Don't drop the precondition.

### A3: restart the remounted loop after mount (refines A2)

A remounted `[0, 360]` loop cannot satisfy the precondition, on our side or upstream's. A takeover mounts with
`initial: false` (`motion/index.tsx:114-122` @v14.7.1). The start state comes from the last keyframe
(`use-visual-state.ts:87-92,112`). The first-render animation is blocked (`animation-state.ts:370-376`).
Restart the loop after mount instead: the remounted element starts with a static `animate` (`rotateY: 0`). One frame
after it mounts, `animate` switches to the `[0, 360]` infinite loop. That is an ordinary `animate` change, which the
mount block doesn't affect. The precondition (count is 1 after 1300 ms) and `expectUndistorted` stay. If the count is
still 0 after this change, STOP and report it as a divergence.
