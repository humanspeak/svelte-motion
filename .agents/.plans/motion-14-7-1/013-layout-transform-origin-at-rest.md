# Plan 013: A `layout` element at rest keeps the browser's default `transform-origin`, so a later `scale` shrinks towards its centre

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4221**. Prefix every Playwright command with `PW_PORT=4221`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Requires plan 001 (Motion 14.7.1 pins) and plan 008 merged into `feat/motion-14.7.1`.** Before starting,
> confirm all three print a line, otherwise STOP:
> `grep -n '"motion-dom": "14.7.1"' package.json`,
> `test -f src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte && echo 008-page`,
> `grep -n '50% 50% !important' src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte`.
>
> **Drift check (run first)**:
> `git diff --stat ba910033..HEAD -- src/lib/utils/layout.ts src/lib/utils/layout.spec.ts src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.spec.ts src/routes/tests/layout`
> Expected: plans 004, 006, 007, 008 and 010 of this batch will have changed `_MotionContainer.svelte` in their own
> regions (see the batch README "Shared hotspots"); that is fine. For `layout.ts`, `layout.spec.ts`, and the
> `_MotionContainer.svelte` lines quoted below (the `setCompositorHints` import, its two call sites, and the
> `_MotionContainer.spec.ts` assertions), compare the "Current state" excerpts with the live code. Line numbers
> may have shifted; the code must match. On a content mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S (a three-line library change; the e2e page is most of the work)
- **Risk**: LOW-MED. The library change only removes two inline writes. The risk is that a painted-frame e2e
  spec was quietly relying on `will-change: transform` layer promotion (sub-pixel snapping) or on the `0 0`
  origin. The gate runs every layout-related e2e directory to catch that.
- **Depends on**: 001 (the e2e baseline is the 14.7.1 suite), 008 (Step 5 removes a pin from 008's page).
- **Wave**: 4 (after Phase B of the batch, on top of `feat/motion-14.7.1` with 001 and 008 merged)
- **Category**: bug (upstream parity)
- **Planned at**: commit `ba910033` (`feat/motion-14.7.1`, Motion 14.7.1 pins, plan 001 merged), 2026-10-27
- **Found by**: plan 008's executor, who pinned `transform-origin: 50% 50% !important` on its test page to work
  around it.

## Why this matters

Every element with `layout` gets inline `will-change: transform; transform-origin: 0px 0px` as soon as its
layout observers are wired. Nothing removes them until the element unmounts or the projection paints its first
layout-animation frame. So any non-layout transform on that element (an `animate` / `exit` / `whileHover`
`scale` or `rotate`) pivots on the top-left corner instead of the centre. Typical visible cases: an
`AnimatePresence mode="popLayout"` exit with `scale` shrinks into the top-left corner; the docs `grid-exit`
demo's cards (`layout` plus `initial`/`exit` `scale: 0.96`) grow and shrink from the corner; a `layout` card with
`whileHover={{ scale: 1.04 }}` grows down and to the right. Also, `will-change: transform` makes the element the
containing block for `position: fixed` descendants and creates a stacking context, so a fixed-position child
(a tooltip, a modal) of a `layout` element is positioned against the element instead of the viewport. Motion
v14.7.1 writes no `will-change` and no `transform-origin` for layout at rest. Its only layout writer of
`transform-origin` is the projection, and only while it projects a delta, with the centre (`50% 50% 0`) as the
default. This plan removes both writes, matching upstream.

## Current state

### svelte-motion

- `src/lib/utils/layout.ts` — helpers beside motion-dom's projection. The writer:
  ```ts
  // layout.ts:477-487
  /**
   * Toggle compositor hints for smoother transform animations.
   *
   * @param el Target element.
   * @param enabled Whether to enable compositor hints.
   */
  export const setCompositorHints = (el: HTMLElement, enabled: boolean): void => {
      el.style.willChange = enabled ? 'transform' : ''
      el.style.transformOrigin = enabled ? '0 0' : ''
      if (!enabled) el.style.transform = ''
  }
  ```
  The file header (layout.ts:27-30) lists it as a live helper:
  `` `finishFlipAnimations`, `setCompositorHints`, `observeLayoutChanges`, ``. The `0 0` origin dates from the
  legacy hand-written FLIP writer (`translate + scale` written with a top-left origin). That writer was deleted
  in #459 (`843dc26a`, "route drag, momentum, whileDrag/whilePan and layoutId FLIP through the VisualElement");
  the header's "The plain-FLIP branch … is deleted" paragraph (layout.ts:12-14) records it. The hint outlived it.
  It is not exported from `src/lib/index.ts` (`grep -rn setCompositorHints src` lists only `layout.ts`,
  `layout.spec.ts` and `_MotionContainer.svelte`).
- `src/lib/html/_MotionContainer.svelte` — the only caller, inside the layout-observer `$effect`:
  ```ts
  // _MotionContainer.svelte:61-66 (import)
      import {
          computeFlipTransforms,
          runLayoutSizeAnimation,
          finishFlipAnimations,
          setCompositorHints,
  // _MotionContainer.svelte:2503 then 2524 (effect setup: seed the projection, then hint)
          lastRect = motionDomProjection?.refreshLayout() ?? measureLayoutRect()
          ...
          setCompositorHints(observedElement, true)
  // _MotionContainer.svelte:2767-2771 (effect cleanup)
              observerRestartRect = lastRect
              observerRestartElement = observedElement
              lastRect = null
              if (element) {
                  setCompositorHints(element, false)
              }
  ```
  The cleanup runs on unmount, when `layout` is turned off, and on every observer restart (a keyed move restarts
  this effect, per the comment at 2487-2493). The `transform = ''` part of the cleanup is still wanted: it clears
  a projected transform when layout is turned off mid-animation. Keep that part.
- The projection adapter (`src/lib/utils/motionDomProjection.ts:1-17`) drives motion-dom's own
  `HTMLProjectionNode` and `HTMLVisualElement`, so motion-dom's `renderHTML` → `applyProjectionStyles` (cited
  below) already writes `transform-origin: 50% 50% 0` on every projected frame. Nothing in svelte-motion needs
  the `0 0` hint.
- **Measured behaviour** (probe against `vite dev` at `ba910033`, Chromium, 1920×1080; inline `style.*`):

  | Page / moment | `transformOrigin` | `willChange` | `transform` |
  | --- | --- | --- | --- |
  | `/tests/motion/layout-align-toggle`, mounted, no layout animation yet | `0px 0px` | `transform` | `` |
  | same, first rAF frames after the toggle click (before the projection paints) | `0px 0px` | `transform` | `` |
  | same, at rest after the layout animation | `50% 50% 0px` | `transform` | `none` |
  | `/tests/projection/sibling-swap`, both boxes mounted | `0px 0px` | — | `` |
  | same, mid-swap and at rest after it | `50% 50% 0px` | — | `translate3d(…)` → `none` |

  So the `0 0` origin lingers on every `layout` element **that has not yet painted a layout-animation frame**:
  freshly mounted elements, list items that never moved, popLayout exits of items that never moved (008's
  case), and any element after an observer restart re-runs the setup (`setCompositorHints(…, true)` writes `0 0`
  again). Once the projection has painted a frame, upstream's `50% 50% 0` is in place and stays. `will-change:
  transform` lingers in every state. The task brief says "after a layout animation completes"; the probe shows
  the projection already overwrites the origin there. The red tests below therefore target the at-rest states
  that really fail, and keep "after a layout animation" as a guard.
- Both popLayout paths inherit the inline origin: the owned path pops the real node; the clone path copies it with
  `child.element.cloneNode(true)` (`src/lib/utils/presence.ts:1416`), and `resetTransforms` (presence.ts:504-516)
  resets only `transform`, not `transform-origin`.
- Existing tests that assert the current hint (they change in this plan):
  ```ts
  // _MotionContainer.spec.ts:526-529 ('applies FLIP (translate + scale) when layout=true and size changes')
          // Compositor hints applied on ready
          expect(el.style.willChange).toBe('transform')
          expect(el.style.transformOrigin).toBe('0 0')
  // _MotionContainer.spec.ts:545-548
          // Teardown cleans compositor hints
          unmount()
          expect(el.style.willChange).toBe('')
          expect(el.style.transformOrigin).toBe('')
  // layout.spec.ts:300-306
      it('setCompositorHints: toggles styles', () => {
          const el = document.createElement('div')
          setCompositorHints(el, true)
          expect(el.style.willChange).toBe('transform')
          setCompositorHints(el, false)
          expect(el.style.willChange).toBe('')
      })
  ```
- Plan 008's workaround, in `src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte` (008 lane
  `314cf58b`, lines 314-330, inside `.example :global(li) { … }`):
  ```css
          cursor: pointer;
          /*
           * Known divergence, not #2348: `setCompositorHints`
           * (src/lib/utils/layout.ts) pins `transform-origin: 0 0` inline on
           * every `layout` element at rest, so a scale exit would shrink towards
           * the top-left corner. Upstream keeps the default centre origin (the
           * projection writes `50% 50% 0`), which the centre-drift assertions in
           * the e2e rely on. Drop this once that origin matches upstream.
           */
          transform-origin: 50% 50% !important;
      }
  ```
  Leave the unrelated `transform-origin: 0 0` on line ~191 of that page alone (it is the scaled-ancestor
  fixture's own authored style, `transform: scale(0.5); transform-origin: 0 0`).
- Conventions: unit tests run under jsdom (`vitest.config.ts`, `src/**/*.{test,spec}.{js,ts}`);
  `_MotionContainer.spec.ts` renders `MotionContainer` with a stubbed `ResizeObserver` and a mocked
  `getBoundingClientRect`, then `await flushTimers()` (from `$lib/__tests__/flushTimers`). Test pages are
  `src/routes/tests/<area>/<name>/+page.svelte`, specs `e2e/<area>/<name>.spec.ts`, linked from
  `src/routes/+page.svelte` (the layout list, links at about lines 1020-1095, e.g.
  `href={resolve('/tests/layout/scroll') + searchParams}`). Guided tester pages use `TesterPanel` from
  `src/routes/tests/layout/_parity/TesterPanel.svelte` (props `eyebrow`, `title`, `status`, `steps:
  TesterStep[]`, optional `checks` snippet) and compute live verdicts only when
  `!window.location.search.includes('@isPlaywright=true')` (set in `onMount`); the exemplar is
  `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte` (`isTester`, `watch()` rAF sampler, verdict
  chips). The e2e server is a production build (`playwright.config.ts`, `npm run build && npm run preview`), and
  pages signal readiness with `window.MotionIsMounted === true`.

### Upstream (verified at `~/Github/motion`, read with `git show v14.7.1:<path>`)

- **One writer.** `git grep -n "willChange\|will-change\|transformOrigin" v14.7.1 -- packages/motion-dom/src/projection packages/framer-motion/src/motion/features/layout packages/framer-motion/src/components/AnimatePresence`
  (excluding tests) prints exactly one line:
  `packages/motion-dom/src/projection/node/create-projection-node.ts:2119`. The layout feature
  (`MeasureLayout.tsx`) and `PopChild.tsx` never write `will-change` or `transform-origin`; nothing in the
  projection writes `will-change`.
- **When it applies `transform-origin`** — `applyProjectionStyles`
  (`create-projection-node.ts:2047-2200`), called from `renderHTML` after the VisualElement's own styles
  (`packages/motion-dom/src/render/html/utils/render.ts:4-22`, `projection?.applyProjectionStyles(elementStyle, styleProp)`):
  ```ts
  // create-projection-node.ts:2080-2098 — not projecting: no origin write
              if (!this.projectionDelta || !this.layout || !lead.target) {
                  ... // visibility / opacity for layoutId / needsShow
                  if (this.hasProjected && !hasTransform(this.latestValues)) {
                      targetStyle.transform = transformTemplate ? transformTemplate({}, "") : "none"
                      this.hasProjected = false
                  }
                  return
              }
  // create-projection-node.ts:2104-2121 — projecting: transform and origin together
              let transform = buildProjectionTransform(this.projectionDeltaWithTransform!, this.treeScale, valuesToRender)
              ...
              targetStyle.transform = transform
              const { x, y } = this.projectionDelta
              targetStyle.transformOrigin = `${x.origin * 100}% ${y.origin * 100}% 0`
  ```
  `delta.origin` is the element's `originX` / `originY`, defaulting to `0.5`:
  `calcBoxDelta(this.projectionDelta!, this.layoutCorrected, target, this.latestValues)`
  (`create-projection-node.ts:1620-1625`) → `calcAxisDelta(delta.x, source.x, target.x, origin?.originX)`
  (`packages/motion-dom/src/projection/geometry/delta-calc.ts:52-59`), whose `origin: number = 0.5` default is
  stored as `delta.origin` (`delta-calc.ts:24-31`). So upstream writes `50% 50% 0` unless the user set
  `originX`/`originY`.
- **When `projectionDelta` exists**: created by `createProjectionDeltas()` (`create-projection-node.ts:1671-1675`)
  from `calcProjection` once there is a target (`:1597-1599`); cleared to `undefined` by `updateLayout` on every
  layout measurement (`:1011`) and by `promote({ needsReset })` (`:1986-1988`). A node that is mounted but has
  never animated has no target (`:1589-1595` returns early) and no delta, so it takes the "not projecting" branch
  and gets no origin write.
- **When it clears it**: never. No upstream path resets `transformOrigin`. `resetTransform`
  (`create-projection-node.ts:1046-1076`, via `resetTransformStyle` `:2498-2505`) calls the HTML node's
  `resetTransform: (instance, value) => { instance.style.transform = value !== undefined ? value : "none" }`
  (`packages/motion-dom/src/projection/node/HTMLProjectionNode.ts:20-22`), which touches `transform` only; the
  `needsReset` branch (`:2066-2077`) writes `transform` / `visibility` / `opacity` / `pointerEvents` only. After
  a layout animation the last written `50% 50% 0` stays, which is identical in effect to the browser default
  `50% 50%`. At rest before any layout animation, the inline origin is whatever the VisualElement wrote:
  `buildHTMLStyles` sets `style.transformOrigin` only when an `originX`/`originY`/`originZ` value exists, with
  browser defaults `50%` / `50%` / `0` (`packages/motion-dom/src/render/html/utils/build-styles.ts:41-45, 69-79`).
- `will-change` upstream comes only from the VisualElement's will-change motion value when a transform value
  animates (svelte-motion mirrors that; see `e2e/utilities/will-change.spec.ts`), never from `layout`.

### Comparison

| Moment | Upstream v14.7.1 | svelte-motion today |
| --- | --- | --- |
| `layout` element mounted, never layout-animated | no inline `transform-origin` (browser default centre), no `will-change` | `transform-origin: 0px 0px`, `will-change: transform` (`layout.ts:484-485` via `_MotionContainer.svelte:2524`) |
| Layout animation in flight | `transform` + `transform-origin: 50% 50% 0` every frame (`create-projection-node.ts:2118-2121`) | same (same motion-dom code) |
| At rest after a layout animation | last `50% 50% 0` stays; nothing clears it | same, plus `will-change: transform` |
| Observer restart (keyed move, dependency change) | no write | cleanup clears origin/will-change/transform, setup writes `0 0` + `will-change` again |
| Unmount / `layout` turned off | no origin write | cleanup clears origin, will-change and transform (`layout.ts:484-486`) |
| popLayout exit of an element that never moved | pivots on the centre | pivots on the top-left corner (owned node keeps the inline style; clone copies it) |

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E (one spec) | `PW_PORT=4221 pnpm exec playwright test <spec>` | all pass |
| Build | `pnpm build` | exit 0 |

(`.trunk/trunk.yaml` is the lint/format authority; do not use `pnpm lint` or `prettier` directly.)

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/layout.ts` — delete `setCompositorHints` (lines 477-487) and its name in the header list
  (line 28).
- `src/lib/utils/layout.spec.ts` — the `setCompositorHints: toggles styles` case (lines 300-306) and its import
  (line 9).
- `src/lib/html/_MotionContainer.svelte` — **only** the `setCompositorHints` import (line 65), the setup call
  (line 2524), and the cleanup call (lines 2769-2771).
- `src/lib/html/_MotionContainer.spec.ts` — the assertions at lines 526-529 and 545-548, plus one new `it` in
  the same `describe`.
- `src/routes/tests/layout/transform-origin-at-rest/+page.svelte` (create)
- `e2e/layout/transform-origin-at-rest.spec.ts` (create)
- `src/routes/+page.svelte` — one link in the layout list.
- `src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte` — **only** delete the comment and
  the `transform-origin: 50% 50% !important;` declaration inside `.example :global(li)` (Step 5).
- `.changeset/layout-transform-origin-at-rest.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `runBoxSizeAnimation`'s own `el.style.transformOrigin = '0 0'` with its saved/restored original
  (`layout.ts:214, 241, 273`). It only writes a `translate(…)`, which an origin does not affect, and it restores
  the authored value when it finishes.
- The child clears in `runBoxSizeAnimation` (`layout.ts:222-224`) and `observeLayoutChanges`
  (`layout.ts:708-711`): `child.style.transformOrigin = ''` and `if (willChange === 'transform') willChange = ''`.
  After this plan they no longer undo a hint of ours. Leave them: `layout.spec.ts:520-570` asserts them, and
  changing size-correction behaviour belongs to a separate plan (see Maintenance notes).
- `src/lib/utils/presence.ts` (`resetTransforms`, the clone path) — once the inline `0 0` is gone there is
  nothing to reset; plan 008 owns this file.
- `src/lib/utils/motionDomProjection.ts`, `node_modules/motion-dom` — the projection already matches upstream.
- Any other region of `_MotionContainer.svelte` (other plans in this batch edit it).
- `package.json` `"version"`, PR labels.

## Git workflow

- Lane branch `lane/1471-origin` in `../svelte-motion-1471-origin`, created by the dispatcher by hand from
  `feat/motion-14.7.1` after Phase B (001 and 008 merged). `isolation: 'worktree'` forks `origin/main`, which does
  not have this batch; do not use it.
- Conventional commits, one per step, for example
  `test(layout): layout elements at rest keep the default transform-origin`,
  `fix(layout): stop pinning transform-origin and will-change on layout elements (upstream parity)`,
  `test(presence): drop the popLayout transform-origin pin now that layout matches upstream`. End each message
  with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR. Never change `"version"` in `package.json`; never add PR labels.

## Steps

### Step 1: Red unit tests

1. In `src/lib/html/_MotionContainer.spec.ts`, in the case `'applies FLIP (translate + scale) when layout=true and
   size changes'`, replace the four hint assertions with the upstream expectations:
   ```ts
           // Upstream writes no layout hints at rest (create-projection-node.ts:2119 is the only
           // transform-origin writer, and only while projecting).
           expect(el.style.willChange).toBe('')
           expect(el.style.transformOrigin).toBe('')
   ...
           unmount()
           expect(el.style.transform).toBe('')
   ```
   (Drop the comment "Compositor hints applied on ready" and "Teardown cleans compositor hints".)
2. Add a new `it('leaves no top-left transform-origin on a layout element at rest, before or after a layout
   change')` next to it, built the same way (stubbed `ResizeObserver`, mocked `getBoundingClientRect`,
   `render(MotionContainer, { props: { tag: 'div', layout: true } })`, `await flushTimers()`). Assert:
   - after mount: `el.style.transformOrigin` does not match `/^0(px)? 0(px)?/` and `el.style.willChange` is not
     `'transform'`;
   - change the mocked rect, fire the last `ResizeObserver` callback, `await flushTimers()` a few times (enough
     for the layout change to settle in jsdom; copy how neighbouring cases wait), then assert the origin again
     does not match `/^0(px)? 0(px)?/`;
   - `unmount()`; assert `el.style.transform` is `''`.
3. In `src/lib/utils/layout.spec.ts` leave the `setCompositorHints` case for now (it is deleted with the helper
   in Step 2).

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts` → the edited case and the new case FAIL,
each on the mount assertion: `expected 'transform' to be ''` (or the origin regex failing on `'0 0'`). Every other
case passes. If the new case's after-change origin assertion is the only failure, or nothing fails, STOP and
report (the reproduction is wrong). Whether the after-change assertion is red in jsdom does not matter (in a real
browser the projection already writes `50% 50% 0` there); record what you saw.

### Step 2: Red e2e page and spec

1. Create `src/routes/tests/layout/transform-origin-at-rest/+page.svelte`. Four fixtures, each a 200×120 box in
   its own `<section>`, with stable `data-testid`s, `transition={{ duration: 0.8, ease: 'linear' }}`:
   - **fresh**: `<motion.div layout data-testid="fresh-box" animate={{ scale: freshScaled ? 0.5 : 1 }}>`.
     Button `data-testid="scale-fresh"` toggles `freshScaled`. The box never has a layout change.
   - **settled**: a flex track (`display: flex; justify-content: {settledEnd ? 'flex-end' : 'flex-start'}`, 600px
     wide) holding `<motion.div layout data-testid="settled-box" animate={{ scale: settledScaled ? 0.5 : 1 }}>`.
     Button `move-settled` toggles `settledEnd` (a layout animation); button `scale-settled` toggles
     `settledScaled`. This is the brief's "has done a layout animation, then animates `scale`" case.
   - **pop**: `<AnimatePresence mode="popLayout">` with one `layout` item that exits with
     `exit={{ scale: 0.4 }}` (keep opacity 1 so the rect stays measurable), followed by a static sibling. Two
     forms selected by `?path=owned|clone` (default `owned`): owned = `<AnimatePresence mode="popLayout"
     present={showPop}>{#snippet child()}<motion.div layout data-testid="pop-box" …/>{/snippet}</AnimatePresence>`;
     clone = `<AnimatePresence mode="popLayout">{#if showPop}<motion.div layout data-testid="pop-box" …/>{/if}</AnimatePresence>`.
     Button `exit-pop` sets `showPop = false`; button `reset-pop` sets it back. (The clone keeps `data-testid`;
     it gets `data-clone="true"`.)
   - **fixed-child**: `<motion.div layout data-testid="fixed-host" style="margin: 40px; height: 80px">` containing
     `<div data-testid="fixed-child" style="position: fixed; top: 0; left: 0; width: 10px; height: 10px">`.
     With `will-change: transform` on the host, the child is positioned against the host instead of the
     viewport.
   - Top of the page: a short lede for each fixture. Set `window.MotionIsMounted`-based readiness as the other
     pages do (it is set by the library; do nothing extra). `TesterPanel` (eyebrow
     `"projection/node/create-projection-node.ts:2119 (Motion 14.7.1)"`, title `"layout leaves transform-origin
     alone at rest"`, `status` saying the expected verdicts on this build) with steps that each have an `action`:
     "Scale the fresh box" (expected: it shrinks towards its centre; chip CENTRED, drift ≤ 1px), "Move the settled
     box, wait, then scale it" (same), "Exit the pop box" (it shrinks in place towards its centre), "Look at the
     red square" (it sits in the top-left corner of the window, not of the grey box; chip VIEWPORT). Live verdicts
     use a rAF sampler like `owned-pop-layout`'s `watch()`: record the box's rest centre before the action, then
     the largest centre drift over 900 ms; chip `CENTRED · drift Npx` when `N ≤ 1`, otherwise
     `CORNER · drift Npx`. The fixed-child chip compares `getBoundingClientRect()` of the child with `(0, 0)`.
     Compute verdicts only when `isTester` (`!window.location.search.includes('@isPlaywright=true')`, set in
     `onMount`); TesterPanel already renders nothing under Playwright.
   - Component JSDoc at the top of the `<script>` explaining what the page shows, with the upstream citation.
2. Add a link to it in `src/routes/+page.svelte`'s layout list, after the `/tests/layout/relative-children`
   entry, same markup: `layout — transform-origin stays at the centre at rest`.
3. Create `e2e/layout/transform-origin-at-rest.spec.ts`. Use a helper that measures painted frames from inside
   the page, so the click and the first sample happen in the same task:
   ```ts
   /** Per-frame centre drift of `testId` for `ms` after `trigger` is clicked, measured in rAF. */
   const sampleCentreDrift = (page: Page, testId: string, trigger: string, ms = 900) =>
       page.evaluate(
           ([testId, trigger, ms]) =>
               new Promise<{ maxDrift: number; minWidthRatio: number; frames: number }>((resolve) => {
                   const query = () => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
                   const rest = query()!.getBoundingClientRect()
                   const cx = rest.left + rest.width / 2
                   const cy = rest.top + rest.height / 2
                   let maxDrift = 0, minWidthRatio = 1, frames = 0
                   const start = performance.now()
                   const tick = () => {
                       const el = query()
                       if (el) {
                           const r = el.getBoundingClientRect()
                           maxDrift = Math.max(maxDrift, Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy))
                           minWidthRatio = Math.min(minWidthRatio, r.width / rest.width)
                           frames++
                       }
                       if (performance.now() - start < ms) requestAnimationFrame(tick)
                       else resolve({ maxDrift, minWidthRatio, frames })
                   }
                   document.querySelector<HTMLElement>(`[data-testid="${trigger}"]`)!.click()
                   requestAnimationFrame(tick)
               }),
           [testId, trigger, ms] as const
       )
   ```
   For the pop fixture on the clone path, the queried element must be the exiting clone: query
   `[data-testid="pop-box"][data-clone="true"]` once it exists, falling back to `[data-testid="pop-box"]` (pass
   the selector, not just the test id, if that is simpler). Cases (each `goto(…?@isPlaywright=true…)`, wait for
   `window.MotionIsMounted === true`, then 300 ms for observers to settle):
   - `fresh layout box scales about its centre` — `maxDrift ≤ 1`, `minWidthRatio < 0.7` (proves the scale ran),
     `frames > 10`.
   - `settled layout box scales about its centre after a layout animation` — click `move-settled`, wait 1200 ms,
     then sample `scale-settled`. Same thresholds. **Guard** (expected to pass on the current code; see Current
     state).
   - `popLayout exit with scale shrinks about its centre (owned)` and `(clone)` — `?path=owned` / `?path=clone`,
     sample `pop-box` after `exit-pop`. `maxDrift ≤ 1`, `minWidthRatio < 0.7`. The pop does not move the box
     (it is first in its container, nothing above it changes), so any drift is the origin.
   - `fixed child of a layout element is positioned against the viewport` — the child's rect is
     `{ left: 0, top: 0 }` within 0.5px.
   - `layout element at rest has no inline top-left origin or will-change` — for `fresh-box`:
     `el.style.transformOrigin` does not match `/^0(px)? 0(px)?/` and `el.style.willChange !== 'transform'`.
   Comment each threshold. Under the current code the scale cases drift by about a quarter of the box
   (`(1 − 0.5) × hypot(200, 120) / 2 ≈ 58px` at full scale-down).

**Verify**: `PW_PORT=4221 pnpm exec playwright test e2e/layout/transform-origin-at-rest.spec.ts` → the fresh,
both pop, fixed-child and inline-style cases FAIL (drift tens of px; fixed child at the host's corner, about
`(40, ~y)`; `'0px 0px'` / `'transform'`); the settled case passes. If the fresh case or either pop case passes,
STOP and report. If the settled case fails, record the drift and continue (it means an observer restart wrote
`0 0` back after the layout animation; Step 3 fixes that too).

### Step 3: The fix — stop writing the hints

1. `src/lib/html/_MotionContainer.svelte`:
   - delete `setCompositorHints,` from the `$lib/utils/layout` import (line 65);
   - delete the setup call `setCompositorHints(observedElement, true)` (line 2524);
   - replace the cleanup call with a plain transform clear, keeping the guard:
     ```ts
                 // Clear a projected transform when layout stops (unmount, layout turned off,
                 // observer restart). Upstream never writes or clears transform-origin /
                 // will-change for layout, so neither do we.
                 if (element) element.style.transform = ''
     ```
2. `src/lib/utils/layout.ts`: delete `setCompositorHints` and its JSDoc (lines 477-487) and remove
   `` `setCompositorHints`, `` from the header list (line 28). Re-flow the header line so it still reads cleanly.
3. `src/lib/utils/layout.spec.ts`: delete the `setCompositorHints: toggles styles` case and the import.

**Verify**:
- `grep -rn "setCompositorHints" src` → no output.
- `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts src/lib/utils/layout.spec.ts` → all pass,
  including both Step 1 cases.
- `pnpm build` → exit 0, then `PW_PORT=4221 pnpm exec playwright test e2e/layout/transform-origin-at-rest.spec.ts`
  → all pass.

### Step 4: Regression sweep of layout-adjacent e2e

Run, in one command, every directory that exercises `layout`:
`PW_PORT=4221 pnpm exec playwright test e2e/layout e2e/layout-id e2e/projection e2e/animate-presence e2e/animate-layout e2e/reorder e2e/independent-transforms e2e/motion/layout-align-toggle.spec.ts e2e/motion/layout-class-toggle.spec.ts e2e/motion/layout-enabled-after-mount.spec.ts e2e/motion/layout-grandparent-toggle.spec.ts e2e/utilities/will-change.spec.ts`
→ all pass. Re-run a failing spec alone once before treating it as a failure, and say that you re-ran it. For a
real failure, compare against the same spec on `feat/motion-14.7.1` (build there in a separate worktree or with
`git worktree add` at that SHA, never `git stash`) to decide whether this plan caused it.

**Verify**: the command above → all pass (or only failures that also fail on `feat/motion-14.7.1`, listed in the
report).

### Step 5: Remove plan 008's pin

In `src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte`, inside `.example :global(li)`,
delete the comment block starting `Known divergence, not #2348: \`setCompositorHints\`` and the
`transform-origin: 50% 50% !important;` line. Touch nothing else in that file (in particular the scaled-ancestor
fixture's own `transform-origin: 0 0`).

**Verify**:
- `grep -n "50% 50% !important\|setCompositorHints" src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte`
  → no output.
- `pnpm build` → exit 0, then `PW_PORT=4221 pnpm exec playwright test e2e/animate-presence/pop-layout-container-move.spec.ts`
  → all pass (same count as before the edit; record the count from Step 4).

### Step 6: Changeset

Create `.changeset/layout-transform-origin-at-rest.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Elements with `layout` no longer get an inline `transform-origin: 0 0` and `will-change: transform` while they are at rest, matching Motion. A `scale` or `rotate` on a `layout` element, such as an `AnimatePresence` `popLayout` exit or a `whileHover` scale, now pivots on the element's centre instead of its top-left corner, and `position: fixed` children of a `layout` element are positioned against the viewport again.
```

**Verify**: `ls .changeset/layout-transform-origin-at-rest.md` → the file exists.

### Step 7: Gate

**Verify**, in order: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0), the Step 4
e2e command (all pass), `trunk fmt` then `trunk check` on every changed file (no new issues), `git status` shows
only in-scope files.

## Test plan

- Red-first anchors: the two `_MotionContainer.spec.ts` cases from Step 1 (fail on the mount assertion), and the
  fresh, owned pop, clone pop, fixed-child and inline-style e2e cases from Step 2. All pass after Step 3.
- Guards: the settled e2e case (projection already writes `50% 50% 0` after a layout animation), the Step 1
  after-change origin assertion, the existing `layout.spec.ts` size-correction cases (520-570), and every spec in
  the Step 4 sweep, in particular `e2e/animate-presence/layout-button.spec.ts`, `grid-exit.spec.ts`,
  `owned-pop-layout.spec.ts`, `pop-layout-container-move.spec.ts`, `e2e/layout-id/scale-handoff.spec.ts`, and
  `e2e/utilities/will-change.spec.ts` (the VisualElement's own will-change latch must be untouched).
- Structural models: `_MotionContainer.spec.ts` "applies FLIP (translate + scale) …" for the unit case;
  `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte` and its spec for the tester page and rAF
  sampling.

## Done criteria

- [ ] `grep -rn "setCompositorHints" src` → no output
- [ ] `grep -n "50% 50% !important" src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte` → no output
- [ ] Step 1 unit cases pass; `e2e/layout/transform-origin-at-rest.spec.ts` (7 cases) passes; the Step 4 sweep passes
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` clean on changed files
- [ ] The page is linked from `src/routes/+page.svelte`; `.changeset/layout-transform-origin-at-rest.md` exists
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- Any of the three pre-start checks prints nothing (001 or 008 not merged into `feat/motion-14.7.1`).
- The drift check shows `layout.ts`, `layout.spec.ts`, or the quoted `_MotionContainer.svelte` /
  `_MotionContainer.spec.ts` lines no longer match.
- Step 1 or Step 2 red cases pass before Step 3.
- After Step 3 the fresh or pop e2e case still drifts (> 1px): something else writes the origin. Find the writer
  with `grep -rn "transformOrigin" src/lib` and report it; do not add a new reset.
- A Step 4 spec fails on this lane, passes on `feat/motion-14.7.1`, and the failure is about painted pixels or
  sub-pixel positions (e.g. a layout animation that now jitters by < 1px without `will-change`). Report the spec
  and the measured numbers instead of putting `will-change` back or loosening thresholds; the maintainer decides.
- The fix appears to need a change in `presence.ts`, `motionDomProjection.ts`, or any other region of
  `_MotionContainer.svelte`.
- Removing 008's pin makes `pop-layout-container-move.spec.ts` fail.

## Maintenance notes

- After this plan, the only layout-related `transform-origin` writer is motion-dom's projection
  (`create-projection-node.ts:2119`), as upstream. If someone re-introduces compositor hints for performance,
  they must not write `transform-origin`, and `will-change: transform` must not be left on at rest (it changes
  the containing block of fixed descendants and creates a stacking context). The fixed-child e2e case guards
  that.
- `runBoxSizeAnimation` (`layout.ts:214-273`) still writes `transform-origin: 0 0` on the size-animating host for
  the duration of the size animation and restores the authored value afterwards. That is harmless (it writes only
  `translate`), but a `scale` on the host during a size animation would pivot on the corner. Revisit if someone
  reports it, together with porting width-based size correction into the projection adapter (the header's
  existing follow-up).
- The child clears at `layout.ts:222-224` and `708-711` now only undo the projection's or VisualElement's own
  values on size-corrected children (`transform-origin` and a `will-change: transform` latch). They are kept
  because `layout.spec.ts:520-570` pins them and the size-correction path is its own follow-up; drop the
  `transformOrigin` / `willChange` lines when that path is reworked.
- Reviewers: check that the cleanup still clears `transform` on observer restart (keyed moves restart the
  effect), and that `e2e/utilities/will-change.spec.ts` still passes unchanged.
