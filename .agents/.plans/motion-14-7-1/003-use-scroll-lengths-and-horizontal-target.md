# Plan 003: `useScroll` returns `scrollXLength`/`scrollYLength`, and horizontal targets are tested

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Two phases.** Phase A (Steps 1-7) runs on Motion **14.6.0**. It fully ports `scrollXLength`/`scrollYLength`
> (red → green) and adds the #2546 horizontal-target regression test, which must end **red**. After Step 7 you
> **STOP and report "phase A red"**. Do not start Phase B until the dispatcher tells you to.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4213** (`PW_PORT=4213`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/scroll.svelte.ts src/lib/utils/scroll.svelte.spec.ts src/routes/tests/use-scroll e2e/utilities docs/src/routes/docs/use-scroll docs/src/routes/examples/scroll-progress docs/src/lib/examples/scroll-progress src/routes/+page.svelte package.json`
> Expected: no output. On any output, compare the "Current state" excerpts with the live code; on a mismatch,
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive return values; one test-only regression)
- **Depends on**: 001, for Phase B only. The #2546 fix lives in framer-motion's `scroll()` (re-exported by `motion`)
  and arrives with the 14.7.1 pin. The `scrollXLength`/`scrollYLength` port does **not** depend on 001:
  `scroll()`'s info already carries `scrollLength` at 14.6.0 (verified, see below).
- **Wave**: 1 for Phase A; Phase B after 001 is committed on `feat/motion-14.7.1`
- **Category**: direction (upstream parity: new API) + tests
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, `motion`/`motion-dom` pinned `14.6.0`), 2026-10-27

## Why this matters

Motion 14.7.1 adds `scrollXLength` and `scrollYLength` to `useScroll`'s return (`623a0e7b6`, tests `ff112788f`,
upstream issue #2189). Each is the maximum scroll offset of its axis, so "distance from the end" is
`scrollYLength.get() - scrollY.get()`. Without them, users rebuild that from `scrollHeight - clientHeight` by hand
and miss resizes. Our `useScroll` returns only the four older values. Since we promise API parity, that is a
visible gap.

Separately, Motion 14.7.1 fixes #2546 (`8dce64350`): `useScroll({ container, target })` in a horizontal scroller
reported the container's own progress on `scrollXProgress` instead of the target's, unless `axis: 'x'` was
passed. We call the same `scroll()`, so the fix reaches us free with the bump. A regression test pins it.

## Current state

- `src/lib/utils/scroll.svelte.ts`, our `useScroll`:
  - `:14-31` local `AxisScrollInfo` (`current`, `progress`, `scrollLength`, `velocity`) and `ScrollInfo` types. The
    callback type already declares `scrollLength`.
  - `:83-93`:
    ```ts
    /**
     * Return type of {@link useScroll} — four motion-dom `MotionValue<number>`s
     * representing scroll position and normalised progress for both axes, each
     * augmented with `.current` + `.subscribe`.
     */
    export type UseScrollReturn = {
        scrollX: AugmentedMotionValue<number>
        scrollY: AugmentedMotionValue<number>
        scrollXProgress: AugmentedMotionValue<number>
        scrollYProgress: AugmentedMotionValue<number>
    }
    ```
  - `:143-194` JSDoc on `useScroll`: "Returns four `MotionValue<number>`s …" (`:147`), "The four motion values are
    torn down at the same time." (`:172-173`), "SSR-safe: returns four static `motionValue(0)`s" (`:175-176`),
    `@returns Four …` (`:179`).
  - `:196-199` creates four `motionValue<number>(0)`. `:202-209` SSR early return (four values). `:214-217`
    accelerate only the two progress values. `:227-233` the JS callback:
    ```ts
            cleanup = scroll(
                (_progress: number, info: ScrollInfo) => {
                    scrollX.set(info.x.current)
                    scrollY.set(info.y.current)
                    scrollXProgress.set(info.x.progress)
                    scrollYProgress.set(info.y.progress)
                },
    ```
    `:243-253` `$effect` teardown destroys the four. `:255-260` returns the four, each `augmentMotionValue(…)`.
- **`scrollLength` at 14.6.0 (checked)**: `node_modules/.pnpm/framer-motion@14.6.0/node_modules/framer-motion/dist/dom.d.ts:139-148`
  declares `AxisScrollInfo.scrollLength: number`, and `dist/es/render/dom/scroll/info.mjs:79` computes
  `axis.scrollLength = axis.targetLength - axis.containerLength` for every axis. So the port works on 14.6.0. The
  only thing 14.7.1 changed upstream was `use-scroll.ts` reading it.
- Upstream `packages/framer-motion/src/value/use-scroll.ts` @ v14.7.1:
  - `:25-36` `createScrollMotionValues` adds `scrollXLength: motionValue(0)` and `scrollYLength: motionValue(0)`,
    with the comment "The maximum scroll offset of each axis, so the distance from the end of the container is
    `scrollYLength.get() - scrollY.get()`."
  - `:129-136` the callback sets `scrollX`, `scrollXProgress`, `scrollXLength` (`x.scrollLength`), then the same for
    `y`. The lengths are never given an `accelerate` config.
- Upstream tests to port: `packages/framer-motion/src/value/__tests__/use-scroll.test.tsx` @ v14.7.1,
  `describe("useScroll scrollXLength/scrollYLength (#2189)")` (4 cases, read with
  `git -C ~/Github/motion show v14.7.1:packages/framer-motion/src/value/__tests__/use-scroll.test.tsx`). They use
  **real** `scroll()`, mocked DOM sizes, `frame.postRender` twice to wait, and `supportsFlags.scrollTimeline = true`
  for the accelerate case.
- `src/lib/utils/scroll.svelte.spec.ts` (327 lines) **mocks** `motion`'s `scroll` (`:35-40`) and motion-dom's
  `supportsScrollTimeline`/`supportsViewTimeline` (`:42-49`). Its local `ScrollCallback` type (`:25-31`) lacks
  `scrollLength`. Patterns: `inRoot` (`:82-89`, `$effect.root`), "writes scroll().info into the four motion values"
  (`:148-161`), "disposes the scroll() observer on unmount" (`:163-174`), accelerate cases (`:194-…`), SSR case
  (`:316-326`, `vi.stubGlobal('window', undefined)`). `src/lib/utils/scroll.svelte.microtask.spec.ts` shows that a
  second `scroll.svelte.*.spec.ts` file compiles runes and gets its own module state.
- jsdom notes for a real-`scroll()` unit file: motion-dom is deduped (`node_modules/.pnpm/motion-dom@14.6.0` only),
  so `frame` from `motion-dom` is the loop `scroll()` uses. framer-motion's `render/dom/scroll/track.mjs:50-52`
  listens to `window` `resize` and calls `resize(container)`. motion-dom's `resize/handle-element.mjs:34-37`
  tolerates a missing `ResizeObserver`.
- **#2546 upstream** (`8dce64350`): `packages/framer-motion/src/render/dom/scroll/offsets/index.ts` @ v14.7.1
  `resolveOffsets` now loops `for (const axis in axisKeys)` instead of resolving only `options.axis ?? 'y'`.
  Fixtures `dev/react/src/tests/issue-2546.tsx` and `issue-2546-reporter.tsx`, spec `tests/react/issue-2546.spec.ts`.
  `axis: 'x'` is upstream's control (it already worked before the fix).
- **Why we force the JS path for #2546**: both fixtures use offsets that map to a native ViewTimeline
  (`['start end', 'end start']`, `['end end', 'start start']`). Under Chromium our `canAccelerateScroll`
  (`scroll.svelte.ts:62-67`) would then drive the bar's `scaleX` natively, and native timelines already track
  per-axis. Equivalent offsets that `offsetToViewTimelineRange` (`src/lib/utils/viewTimelineRange.ts:177-196`)
  rejects keep everything on `scroll()`'s JS callback, which is what #2546 fixed. That module's `toIntersection`
  returns `[]` for any `v` unit and `toRange` returns `false` for a non-zero px part. So:
  - main fixture (400px container, 200px items, item 5 at 1000px): `['0px 400px', '200px 0px']` resolves to
    `[600, 1200]`, identical to `['start end', 'end start']`;
  - reporter (70vw items in a 100vw container): `['70vw 100vw', '0px 0px']` is identical to
    `['end end', 'start start']`.
- Test pages: `src/routes/tests/use-scroll/view-timeline-offsets/+page.svelte` (pattern for `TesterPanel` and
  `data-testid="…-accelerated"` readouts of `!!mv.accelerate`). Its spec is
  `e2e/utilities/use-scroll-view-timeline-offsets.spec.ts`: useScroll specs live in `e2e/utilities/` and are
  named `use-scroll-<name>.spec.ts`. The link list in `src/routes/+page.svelte:189-196` holds
  `/tests/use-scroll/view-timeline-offsets`. `motion.circle` exists (`src/lib/html/Circle.svelte`), and
  `pathLength` is used in `src/routes/tests/motion/svg-path-length/+page.svelte`. `useMotionValueEvent` is
  exported from `$lib`.
- Docs: `docs/src/routes/docs/use-scroll/+page.svx`. `:53` "returns four motion values …", `:55-60` the
  four-row value table, `:190-201` signature, `:203-205` "An object with four …". Example
  `docs/src/routes/examples/scroll-progress/+page.svelte` (a `sections: ExampleSection[]` array with one
  `FIG-001` entry plus `defaultSection`/`defaultNotes`/`defaultCode` snippets). Its demo
  `docs/src/lib/examples/scroll-progress/demos/Default.svelte` (`useScroll({ container: () => containerEl })`).
  Demo code samples are registered automatically by the docs' demo-manifest plugin from the file path. **The
  docs consume the built `dist/`**, so run `pnpm build` before `pnpm --dir docs check`.
- Changesets: `.changeset/*.md`, front matter `'@humanspeak/svelte-motion': minor` for new API (see
  `.changeset/animate-layout.md`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (Phase B) | `pnpm install --frozen-lockfile` | exit 0 |
| Scroll unit files | `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts src/lib/utils/scroll.svelte.length.spec.ts src/lib/utils/scroll.svelte.microtask.spec.ts` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Build + package | `pnpm build` | exit 0 (runs `svelte-package` + `publint`) |
| Docs types | `pnpm --dir docs check` | 0 errors (after `pnpm build`) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E | `PW_PORT=4213 pnpm exec playwright test <specs>` | see steps |

## Scope

**In scope**:

- `src/lib/utils/scroll.svelte.ts` (modify)
- `src/lib/utils/scroll.svelte.spec.ts` (modify)
- `src/lib/utils/scroll.svelte.length.spec.ts` (create)
- `src/routes/tests/use-scroll/scroll-length/+page.svelte` (create), `e2e/utilities/use-scroll-scroll-length.spec.ts` (create)
- `src/routes/tests/use-scroll/horizontal-target/+page.svelte`, `src/routes/tests/use-scroll/horizontal-target/reporter/+page.svelte`,
  `src/routes/tests/use-scroll/horizontal-target/reporter/Indicator.svelte` (create),
  `e2e/utilities/use-scroll-horizontal-target.spec.ts` (create)
- `src/routes/+page.svelte` (modify: three links next to `view-timeline-offsets`)
- `docs/src/routes/docs/use-scroll/+page.svx` (modify)
- `docs/src/routes/examples/scroll-progress/+page.svelte` (modify: add a `FIG-002` section),
  `docs/src/lib/examples/scroll-progress/demos/Remaining.svelte` (create)
- `.changeset/use-scroll-lengths.md` (create)

**Out of scope**:

- `src/lib/utils/viewTimelineRange.ts`, `canAccelerateScroll`, `makeAccelerateConfig`. The lengths are never
  accelerated, as upstream.
- Any change to how `axis` is passed. After 14.7.1, `axis` only picks which progress `scroll()`'s first callback
  argument reports, and we ignore that argument.
- `package.json`, `pnpm-lock.yaml` (plan 001's bump; you receive it by merge in Phase B).
- A new example route. The new section goes into the existing scroll-progress example, so no examples index,
  sitemap or SEO entries change.

## Git workflow

- Lane branch `lane/1471-scroll` in `../svelte-motion-1471-scroll`, created by the dispatcher from the wave-0 SHA
  (Motion 14.6.0).
- Conventional commits, e.g. `test(use-scroll): scrollXLength/scrollYLength`,
  `feat(use-scroll): return scrollXLength and scrollYLength (Motion 14.7.1)`,
  `docs(use-scroll): document scroll lengths`,
  `test(use-scroll): horizontal container + target tracks the target (#2546)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Phase A — on Motion 14.6.0

First confirm `grep -n '"motion": "14.6.0"' package.json` prints a line. If not, STOP.

### Step 1: Red unit tests for the lengths

1. In `src/lib/utils/scroll.svelte.spec.ts` (mocked `scroll()`):
   - Extend the `ScrollCallback` info type (`:25-31`) with `scrollLength: number` per axis. Add
     `scrollLength: 0` to the existing "writes scroll().info" call (`:152-155`) so it still typechecks.
   - Rename "returns four MotionValues with initial 0" to "returns six …" and also assert `scrollXLength` /
     `scrollYLength` are motion values at `0`.
   - New `it('writes x/y scrollLength into scrollXLength / scrollYLength', …)`: call the captured callback with
     `x: { current: 100, progress: 0.5, scrollLength: 600 }`, `y: { current: 250, progress: 0.25, scrollLength: 2500 }`.
     Expect `scrollXLength.current === 600`, `scrollYLength.current === 2500`, and
     `scrollYLength.get() - scrollY.get() === 2250`.
   - New `it('never accelerates the length values', …)`: `supportsScrollTimelineMock.mockReturnValue(true)`, then
     `useScroll()`. Expect `scrollYProgress.accelerate` defined and `scrollXLength.accelerate` /
     `scrollYLength.accelerate` undefined.
   - New `it('destroys the length values on unmount', …)`: inside an `$effect.root`, `vi.spyOn` the `destroy` of
     both length values. Stop the root and expect each called once.
   - Extend the SSR case (`:316-326`) to assert both lengths exist with `.current === 0`.
2. Create `src/lib/utils/scroll.svelte.length.spec.ts`. It is a port of upstream's four `(#2189)` cases using the
   **real** `scroll()`: no `vi.mock('motion')`. Header comment explains it is separate because the sibling file
   mocks `scroll()`, and cites `623a0e7b6`, `ff112788f`. Use a `mock(element, values)` helper with
   `Object.defineProperty(…, { value, configurable: true })`, and
   `nextFrames = () => new Promise<void>((r) => frame.postRender(() => frame.postRender(() => r())))` with `frame`
   from `motion-dom`. Mount via `$effect.root` + `flushSync()`, then drain microtasks (copy `drainMicrotasks` from
   the sibling file) before `await nextFrames()`. Pass elements directly (`useScroll({ container: el })`), with the
   sizes mocked and the element appended to `document.body` **before** calling `useScroll`. `afterEach`: reset
   `supportsFlags.scrollTimeline = undefined` and `supportsFlags.viewTimeline = undefined` (from `motion-dom`),
   remove the elements, stop the roots. Cases with upstream's exact numbers:
   1. "exposes each axis's maximum scroll offset": container `clientWidth 400, scrollWidth 1000, scrollLeft 100, clientHeight 500, scrollHeight 3000, scrollTop 500`
      → `scrollY 500`, `scrollYProgress 0.2`, `scrollYLength 2500`, `scrollX 100`, `scrollXLength 600`,
      `scrollYLength - scrollY === 2000`.
   2. "is the container's maximum scroll offset when tracking a target with an offset": container
      (`position: relative`) with upstream's `containerSize` and `scrollTop: 850`. A child target with
      `offsetTop 1000, offsetLeft 0, clientWidth 400, clientHeight 200` and `offsetParent` = the container.
      `offset: ['start end', 'end start']` → `scrollY 850`, `scrollYProgress 0.5`, `scrollYLength 2500`.
   3. "updates when the container resizes": `containerSize` → `scrollYLength 2500`. Then mock `clientHeight: 1000`,
      `window.dispatchEvent(new Event('resize'))`, `await nextFrames()` → `scrollYLength 2000`,
      `scrollYProgress 0.25`.
   4. "is set alongside accelerated progress values": `supportsFlags.scrollTimeline = true` before `useScroll` →
      `scrollYProgress.accelerate` defined, `scrollYLength.accelerate` undefined, `scrollYLength.get() === 2500`.

   If a case can't be driven by the real `scroll()` under jsdom (values stay 0 after `nextFrames` for a reason
   unrelated to the missing feature, e.g. `scroll()` never fires because jsdom lacks an API), move that case into
   the mocked file instead. Feed the callback the numbers upstream expects, and leave a one-line comment saying
   why. Don't delete it. Case 1 must stay on real `scroll()`. If even case 1 can't, STOP.

**Verify**: `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts src/lib/utils/scroll.svelte.length.spec.ts`
→ the new/extended length cases **FAIL** (`scrollXLength`/`scrollYLength` undefined, e.g. "Cannot read properties
of undefined"). Every pre-existing case passes. Don't commit red unit tests on their own; continue to Step 2 and
commit both together.

### Step 2: Port the lengths

In `src/lib/utils/scroll.svelte.ts`:

1. `UseScrollReturn`: add
   ```ts
       /** Maximum horizontal scroll offset in px (`scrollWidth - clientWidth` for a container). */
       scrollXLength: AugmentedMotionValue<number>
       /**
        * Maximum vertical scroll offset in px. The distance from the end is
        * `scrollYLength.get() - scrollY.get()`.
        */
       scrollYLength: AugmentedMotionValue<number>
   ```
   Update its JSDoc to "six motion-dom `MotionValue<number>`s: scroll position, normalised progress and maximum
   scroll offset for both axes …".
2. Create `scrollXLength`/`scrollYLength` with `motionValue<number>(0)` next to the others (`:196-199`). Return
   them, augmented, from the SSR branch, and destroy them in the `$effect` teardown. Return them from the final
   object. Do **not** give them `accelerate`.
3. Callback, in upstream's order (`use-scroll.ts:130-135` @ v14.7.1):
   ```ts
                   scrollX.set(info.x.current)
                   scrollXProgress.set(info.x.progress)
                   scrollXLength.set(info.x.scrollLength)
                   scrollY.set(info.y.current)
                   scrollYProgress.set(info.y.progress)
                   scrollYLength.set(info.y.scrollLength)
   ```
4. `useScroll` JSDoc: "Returns six `MotionValue<number>`s: `scrollX` / `scrollY` (current position in px),
   `scrollXProgress` / `scrollYProgress` (0–1 normalised) and `scrollXLength` / `scrollYLength` (maximum scroll
   offset in px)". Teardown sentence: "All six motion values …". SSR: "six static `motionValue(0)`s".
   `@returns`. Add a second `@example` showing `const remaining = $derived(scrollYLength.current - scrollY.current)`.
   Add a line noting the lengths follow Motion 14.7.1 (`623a0e7b6`) and are never accelerated.

**Verify**: the two unit files from Step 1 → **all pass**. Also run
`pnpm exec vitest run src/lib/utils/scroll.svelte.microtask.spec.ts` → passes. Then `pnpm check` → 0 errors.
Commit (`feat(use-scroll): return scrollXLength and scrollYLength (Motion 14.7.1)`, including the Step 1 tests).

### Step 3: Scroll-length test page and e2e

1. `src/routes/tests/use-scroll/scroll-length/+page.svelte`: a `div` `data-testid="container"` bound with
   `bind:this` to a `$state`, `width: 400px; height: {h}px; overflow: auto; position: relative; scrollbar-width: none`
   (`let h = $state(300)`), containing a `1000px × 1500px` content `div` (so lengths are 600 × 1200).
   `scrollbar-width: none` keeps `clientWidth`/`clientHeight` at exactly 400/300 (500 after growing), so the
   600/1200/700/1000 constants don't depend on whether headless Chromium runs with `--hide-scrollbars`. Comment
   why in the page.
   `const { scrollX, scrollY, scrollXLength, scrollYLength } = useScroll({ container: () => containerEl })`.
   Readouts with `data-testid`: `scroll-x`, `scroll-y`, `scroll-x-length`, `scroll-y-length`, `remaining-y`
   (`Math.round(scrollYLength.current - scrollY.current)`), all `Math.round`ed. A "Grow container" button
   (`data-testid="grow"`) sets `h = 500`. Header comment cites `623a0e7b6`, #2189. TesterPanel (hidden under
   `@isPlaywright=true`): steps "Scroll the box to the bottom", "Press Grow container". Expected: "remaining
   counts down to 0 at the bottom", "the length drops from 1200 to 1000 when the box grows". Live verdict "OK"
   when `scroll-y-length === content height − container clientHeight`.
2. `e2e/utilities/use-scroll-scroll-length.spec.ts`: load `/tests/use-scroll/scroll-length?@isPlaywright=true`.
   Expect `scroll-x-length` 600 and `scroll-y-length` 1200 (`toHaveText`, auto-retrying). Set the container's
   `scrollTop = 500` and `scrollLeft = 100` in-page → `scroll-y` 500, `remaining-y` 700, `scroll-x` 100. Click
   `grow` → `scroll-y-length` 1000.
3. Link it next to `view-timeline-offsets` in `src/routes/+page.svelte`: "useScroll scrollXLength / scrollYLength
   (distance from the end)".

**Verify**: `PW_PORT=4213 pnpm exec playwright test e2e/utilities/use-scroll-scroll-length.spec.ts e2e/utilities/use-scroll-view-timeline-offsets.spec.ts`
→ all pass. Commit.

### Step 4: Docs, example and changeset

1. `docs/src/routes/docs/use-scroll/+page.svx`: `:53` "returns six motion values". Add the table rows
   `` `scrollXLength` | Maximum horizontal scroll offset in pixels `` and
   `` `scrollYLength` | Maximum vertical scroll offset in pixels ``. Add a short `### Distance from the end`
   subsection after "Element scroll" with a snippet using `scrollYLength.current - scrollY.current`. Update the
   signature block (`:192-201`) and "Returns" (`:205`, "six").
2. Create `docs/src/lib/examples/scroll-progress/demos/Remaining.svelte`. Model it on `Default.svelte` (same
   brut styling, `dk-strip` shell comment, container getter) but show "N px left" from
   `scrollYLength.current - scrollY.current`, plus a bar whose width is the remaining fraction. In
   `docs/src/routes/examples/scroll-progress/+page.svelte`, add a `FIG-002` section (tag `SCROLL`, title e.g.
   `{ prefix: 'distance to the ', accent: 'end', end: '.' }`, description naming `scrollYLength`) with its own
   `remainingSection` / `remainingNotes` / `remainingCode` snippets. `remainingCode` uses `demoCodeSample('scroll-progress/demos/Remaining.svelte', 'scroll-progress-remaining', 'Remaining.svelte')`.
   Reuse existing `@lucide/svelte` icons.
3. `.changeset/use-scroll-lengths.md`, bump `minor`: "`useScroll` now also returns `scrollXLength` and
   `scrollYLength`, the maximum scroll offset of each axis, so the distance from the end is
   `scrollYLength.get() - scrollY.get()` (Motion 14.7.1)."

**Verify**: `pnpm build` → exit 0. Then `rm -rf docs/node_modules/.vite` and `pnpm --dir docs check` → 0 errors.
Commit.

### Step 5: #2546 horizontal-target pages (red on 14.6.0)

1. `src/routes/tests/use-scroll/horizontal-target/+page.svelte`, a port of `issue-2546.tsx`. `?axis=x` (via `page`
   from `$app/state`) adds `axis: 'x'`. `useScroll({ container: () => containerEl, target: () => targetEl, offset: ['0px 400px', '200px 0px'], ...(axis ? { axis } : {}) })`.
   Comment: "equivalent to `['start end', 'end start']` here; px keeps it off the native ViewTimeline so the JS
   `scroll()` path (#2546) is under test". `useMotionValueEvent(scrollXProgress, 'change', (v) => (window.__progress = v))`.
   Markup: `div` `id="container"` `data-testid="container"` `width: 400px; height: 200px; overflow-x: scroll; display: flex; position: relative`
   with 10 children `flex: 0 0 200px; height: 200px; box-sizing: border-box; border-right: 1px solid white`, item
   5 red (`bind:this={targetEl}`), others `#ccc`. Then `motion.div` `id="bar"` `data-testid="bar"`
   `style={{ scaleX: scrollXProgress, originX: 0, width: 400, height: 10, background: 'blue' }}`. Also render
   `data-testid="accelerated"` = `String(!!scrollXProgress.accelerate)`. TesterPanel: "Scroll the grey strip
   sideways". Expected: "the blue bar stays empty until the red item enters from the right and is full once it
   has left on the left". Verdict: at the current `scrollLeft`, the expected target progress is
   `clamp((scrollLeft - 600) / 600)`; "TRACKS TARGET ✓" within 0.02, otherwise "TRACKS CONTAINER ✗".
2. `src/routes/tests/use-scroll/horizontal-target/reporter/+page.svelte` + `Indicator.svelte`, a port of
   `issue-2546-reporter.tsx`. A `header` `height: 10vh`, then `main` `id="container"` `data-testid="container"`
   `position: fixed; height: 90vh; width: 100vw; overflow-x: auto; overflow-y: hidden`, with a flex row of 12
   `Indicator`s. Each one takes `container` (getter) and `index`, wraps a `section` `width: 70vw; flex-shrink: 0`
   around a `div` target and a 75×75 SVG with `motion.circle` `id="indicator-{index}"`
   `data-testid="indicator-{index}"` `cx=50 cy=50 r=30 pathLength="1" fill="none" stroke="red" stroke-width=10`
   `style={{ pathLength: scrollXProgress }}`. It calls `useScroll({ target: () => el, container, offset: ['70vw 100vw', '0px 0px'], ...axis })`,
   which is equivalent to `['end end', 'start start']` and kept off ViewTimeline by the `vw` unit. The page must
   not scroll vertically (so `vw` = `documentElement.clientWidth`). If the app layout adds height, set
   `overflow: hidden` on the page root and note it.
3. `e2e/utilities/use-scroll-horizontal-target.spec.ts`, a port of `tests/react/issue-2546.spec.ts` @ v14.7.1: the
   `scrollTo` helper, the `for (const axis of ['', 'x'])` describe with "scrollXProgress tracks the target, not
   the container" (`toBeCloseTo(1 / 6, 2)` on `__progress`, `toBeCloseTo(1 / 6, 1)` on the bar's
   `DOMMatrixReadOnly(transform).a`), and the reporter test (`setViewportSize(1280×720)`, scroll to 1600,
   dashes `1`, `0.5`, `0` for indicators 1-3 via `stroke-dasharray`). URLs:
   `/tests/use-scroll/horizontal-target?@isPlaywright=true[&axis=x]` and
   `/tests/use-scroll/horizontal-target/reporter?@isPlaywright=true`. Add a first test, **"stays on the JS
   scroll() path"**: `getByTestId('accelerated')` has text `false`. Without it, the rest silently tests the
   native path.
4. Link both pages next to the others: "useScroll horizontal container + target (#2546)" and "… reporter page".

**Verify**: `PW_PORT=4213 pnpm exec playwright test e2e/utilities/use-scroll-horizontal-target.spec.ts` →
- **PASS**: "stays on the JS scroll() path"; the `axis: x` case (upstream's control: with `axis: 'x'` the x
  offsets were already resolved).
- **FAIL**: the `axis: default` case, with `__progress` ≈ `0.4375` (700/1600, the container's progress) instead of
  `0.1667`. The reporter test, with indicator dashes near `0.17` instead of `1` / `0.5` / `0`.

If the default-axis case passes, re-run alone once. If it still passes, check `accelerated` is `false`. If it does
and the case still passes, keep it as a guard and record "not red on 14.6.0". If the `axis: x` control fails or
`accelerated` is `true`, STOP. Commit (`test(use-scroll): horizontal container + target tracks the target (#2546)`).

### Step 6: Phase A gate

`trunk fmt` and `trunk check` on every changed file, `pnpm check` (0 errors), `pnpm test:only` (all pass: the
length tests are green now), and `pnpm build`. Then
`PW_PORT=4213 pnpm exec playwright test e2e/utilities` → only the #2546 red cases from Step 5 fail. Re-run any
other failure alone once. If it persists, STOP.

### Step 7: STOP — report "phase A red"

Report the per-test table for `use-scroll-horizontal-target.spec.ts`, the unit and e2e results for the lengths,
the commit SHAs, and whether any length case had to move to the mocked file (and why).

### Phase B — after the dispatcher says 001 is merged

### Step 8: Merge the bump and go green

1. `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`. Confirm `package.json` pins
   `"motion": "14.7.1"` and `"motion-dom": "14.7.1"`. Confirm
   `grep -rn "axisKeys" node_modules/.pnpm/framer-motion@14.7.1/node_modules/framer-motion/dist/es/render/dom/scroll/offsets/index.mjs`
   has a match (the both-axes loop). If not, STOP.
2. `PW_PORT=4213 pnpm exec playwright test e2e/utilities/use-scroll-horizontal-target.spec.ts e2e/utilities/use-scroll-scroll-length.spec.ts`
   → **all pass**.
3. Scroll unit files → all pass. If a length case now fails, the 14.7.1 `scroll()` changed its info shape: STOP.

### Step 9: Phase B gate

`pnpm build`, `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm --dir docs check` (0 errors, after
`rm -rf docs/node_modules/.vite`), `PW_PORT=4213 pnpm exec playwright test e2e/utilities` (all pass; re-run a
failing spec alone once and say so), `trunk check` on changed files, and `git status` shows only in-scope files.

## Test plan

- Port (red → green inside Phase A): mocked-`scroll()` cases (six values, callback writes lengths, never
  accelerated, destroyed on unmount, SSR) and the four real-`scroll()` upstream cases in
  `scroll.svelte.length.spec.ts`; e2e `use-scroll-scroll-length.spec.ts`.
- Free-with-bump (red in Phase A, green in Phase B): #2546 default-axis and reporter cases.
- Guards: #2546 `axis: x` control, "stays on the JS scroll() path", the existing
  `use-scroll-view-timeline-offsets.spec.ts` and `scroll.svelte.microtask.spec.ts`.
- Patterns: `src/lib/utils/scroll.svelte.spec.ts`, `e2e/utilities/use-scroll-view-timeline-offsets.spec.ts`,
  `src/routes/tests/use-scroll/view-timeline-offsets/+page.svelte`.

## Done criteria

- [ ] `grep -n "scrollXLength\|scrollYLength" src/lib/utils/scroll.svelte.ts` → type, creation, SSR return, callback, teardown and return all present
- [ ] `grep -n "Length.accelerate" src/lib/utils/scroll.svelte.ts` → no matches (lengths never accelerated)
- [ ] Scroll unit files pass; `pnpm test:only` passes; `pnpm check` 0 errors; `pnpm build` exit 0; `pnpm --dir docs check` 0 errors
- [ ] Phase A report shows the #2546 default-axis and reporter cases red on 14.6.0; Phase B shows all of `e2e/utilities` green
- [ ] Three new test pages with TesterPanels, linked from `src/routes/+page.svelte`; docs page, FIG-002 example and changeset present
- [ ] `trunk check` clean on changed files; no out-of-scope files modified

## STOP conditions

- `package.json` isn't on 14.6.0 at the start, or isn't on 14.7.1 after the Phase B merge.
- Even real-`scroll()` case 1 can't produce non-zero values in jsdom.
- The #2546 `axis: x` control fails, or `accelerated` reads `true` (the JS path isn't under test).
- Any pre-existing scroll unit test or `use-scroll-view-timeline-offsets` spec fails after Step 2.
- The #2546 cases are still red in Phase B after one solo re-run.

## Maintenance notes

- `scroll.svelte.ts`'s callback now mirrors upstream's order exactly. Diff it against `use-scroll.ts` on every
  Motion bump.
- The #2546 pages deliberately use px/vw offsets to stay on `scroll()`. If `offsetToViewTimelineRange` ever learns
  to map px or vw, the "stays on the JS path" test fails first. Pick another non-mappable equivalent then; don't
  delete the test.
- Upstream's fixture uses named offsets. A follow-up could add a native-path variant to prove ViewTimeline tracks
  horizontally too. It was left out because native timelines were already per-axis before #2546.
