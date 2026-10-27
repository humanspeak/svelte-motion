# Plan 001: Run svelte-motion on Motion 14.7.1 (backgroundColor leaves the compositor)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Lane**: this plan runs on `feat/motion-14.7.1` itself, in the worktree `../svelte-motion-1471`
> (`/Users/jasonkummerl/Github/svelte-motion-1471`). There is no separate lane branch.
>
> **Port rule**: this lane's Playwright port is **4211**. Prefix every Playwright command with `PW_PORT=4211`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- package.json pnpm-lock.yaml src/lib/utils/willChange.svelte.spec.ts e2e/utilities/will-change.spec.ts e2e/utilities/use-transform-scroll-accelerate.spec.ts src/routes/tests/will-change docs/src/routes/docs/use-transform/+page.svx src/routes/tests/use-transform/scroll-accelerate src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts .changeset`
> Expected: no output (the batch's own `.agents/.plans/motion-14-7-1/` commit is not in that list). If any listed
> file changed, compare the "Current state" excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1 (005 and every other plan whose behaviour arrives with motion-dom 14.7.1 depend on it)
- **Effort**: M
- **Risk**: MED. The bump changes runtime behaviour (colour animations move to JS, transform demotion during
  layout, spring generator, WAAPI transform start/hold), so the full e2e triage in Step 8 is the real gate.
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `f8ac71aa` (`main` after the 14.6.0 release, v2.5.0, Motion 14.6.0), 2026-10-27

## Why this matters

svelte-motion mirrors upstream Motion and pins `motion` + `motion-dom` to one exact version (enforced by
`src/lib/__tests__/motionDependencies.spec.ts`). Motion 14.7.0 and 14.7.1 shipped on 2026-10-27. Most of the engine
work lives in `motion-dom` and reaches svelte-motion through the pin, because svelte-motion runs motion-dom's real
VisualElement, projection, `PanSession`, `VisualElementDragControls`, WAAPI transform groups and spring generator.

One upstream change is user-visible here and breaks two of our tests: Motion 14.7.0 took `backgroundColor` out of
`acceleratedValues` (commit `f9e080f21`, "Run backgroundColor animations in JS instead of WAAPI"). Colour
animations now run in JavaScript, so `useWillChange()` no longer flips to `transform` for a `backgroundColor`
animation, and a scroll-linked `useTransform` bound to `backgroundColor` no longer gets a native ScrollTimeline
animation. Repo policy is to always adopt upstream behaviour, so the tests and copy that encode the old behaviour
are updated to the new one, red-first.

The release will ship as **svelte-motion 2.7.0**. `package.json` is `"version": "2.5.0"`; the release workflow
sets the version. **Do not change `"version"`, and never add PR labels.**

## Current state

### Pins

- `package.json:146-150`:
  ```json
      "dependencies": {
          "acorn": "^8.18.0",
          "motion": "14.6.0",
          "motion-dom": "14.6.0"
      },
  ```
- `pnpm-workspace.yaml` has `minimumReleaseAge: 2880` but `minimumReleaseAgeExclude` lists `framer-motion`,
  `motion`, `motion-dom`, `motion-utils`, so same-day upstream versions install.
- pnpm 12 ignores `--save-exact`: edit `package.json` by hand, then `pnpm install`.
- `src/lib/__tests__/motionDependencies.spec.ts` asserts both pins are exact and equal, and that `motion` →
  `framer-motion` resolves the same `motion-dom` directory as ours.
- Upstream versions (verified with `npm view`): `motion@14.7.1` → `framer-motion@14.7.1` → `motion-dom@14.7.1` and
  `motion-utils@14.7.0`; `motion-dom@14.7.1` depends on `motion-utils@14.7.0`. So after the bump there is exactly
  one `motion-utils`, at **14.7.0** (not 14.7.1).

### The `backgroundColor` change (upstream, verified at `~/Github/motion`)

- `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts:1-13 @v14.7.1`:
  ```ts
  /**
   * A list of values that can be hardware-accelerated.
   *
   * Colors aren't included: WAAPI mixes them in sRGB, but JS animations
   * (and the sampler that estimates a WAAPI value on interrupt) mix them
   * in linear color space, so interrupting one would visibly jump.
   */
  export const acceleratedValues = new Set<string>([
      "opacity",
      "clipPath",
      "filter",
      "transform",
  ])
  ```
  At `v14.6.0` the set also held `"backgroundColor"` (line 9). Commit `f9e080f21` removed it; it also reverted
  `71465b139` (a browser-mode colour mixer tried first in 14.7.0's cycle). The only commit between the tags that
  touches this file is `f9e080f21`.
- `packages/motion-dom/src/animation/waapi/supports/waapi.ts:76-82 @v14.7.1`: colours the JS path can't parse
  (`oklch`, `lab`, …) still use WAAPI (`colorProperties.has(name) && hasBrowserOnlyColors(keyframes)`).
- `packages/motion-dom/src/render/VisualElement.ts:557-563 @v14.7.1`: a motion value carrying an `accelerate`
  config (scroll-linked `useTransform`) only gets a native animation when `acceleratedValues.has(key)`. So
  `backgroundColor` bound to a scroll `useTransform` now runs in JS; its `value.accelerate` flag is still set (the
  `bg-accelerated` readout in `e2e/utilities/use-transform-scroll-accelerate.spec.ts:18` stays correct; upstream's
  `packages/framer-motion/cypress/integration/scroll-accelerate.ts:14-26 @v14.7.1` expects the same).
- Upstream `WillChangeMotionValue.add()` (`packages/framer-motion/src/value/use-will-change/WillChangeMotionValue.ts:14-18 @v14.7.1`)
  checks `transformProps.has(name) || acceleratedValues.has(name)`. svelte-motion's port is identical.

### svelte-motion code and tests that encode the old behaviour

- `src/lib/utils/willChange.svelte.ts:1,85` imports `acceleratedValues` from `motion-dom` and checks
  `transformProps.has(name) || acceleratedValues.has(name)`. **No source change is needed**: it follows the pin.
- `src/lib/utils/willChange.svelte.spec.ts:46-56` (the survey missed this one; it fails after the bump):
  ```ts
      it('flips to "transform" for accelerated values', () => {
          inRoot(() => {
              const wc = useWillChange()
              wc.add('opacity')
              expect(wc.get()).toBe('transform')

              const backgroundColor = useWillChange()
              backgroundColor.add('backgroundColor')
              expect(backgroundColor.get()).toBe('transform')
          })
      })
  ```
  Lines 67-76 ("stays enabled once a transform animates") also call `wc.add('backgroundColor')` after `scale`; that
  test still passes on 14.7.1 and needs no change.
- `e2e/utilities/will-change.spec.ts:36-52`:
  ```ts
      test('flips will-change for an accelerated backgroundColor animation', async ({ page }) => {
          await page.goto(URL)
          await waitForMotionReady(page, 'color-box')

          await expect.poll(valueText(page, 'color-value')).toBe('value: auto')

          // Motion 12.43+ accelerates backgroundColor, so it promotes the element.
          await page.getByTestId('recolor').click()
          await expect.poll(computedWillChange(page, 'color-box')).toBe('transform')
          await expect.poll(valueText(page, 'color-value')).toBe('value: transform')

          // The upstream will-change value is a one-way latch: resetting the color
          // does not demote the element after the accelerated animation ran.
          await page.getByTestId('recolor').click()
          await expect.poll(computedWillChange(page, 'color-box')).toBe('transform')
          await expect.poll(valueText(page, 'color-value')).toBe('value: transform')
      })
  ```
  The borderRadius test right below it (`:67-84`) is the model for a "stays auto" assertion.
- `src/routes/tests/will-change/+page.svelte:82-105`, the colour card:
  ```svelte
          <article>
              <h2>Accelerated color animation</h2>
              <p class="expectation">
                  Motion 12.43+ accelerates <code>backgroundColor</code>, so animating it flips
                  will-change to <code>transform</code>. The hint stays latched after the first
                  animation, matching upstream.
              </p>
              <p class="readout" data-testid="color-value">value: {colorWillChange.current}</p>
              ...
                      animate={{ backgroundColor: recolored ? '#f0abfc' : '#67e8f9' }}
                      transition={{ duration: 0.5 }}
  ```
  The intro (`:46-51`) says will-change flips for "a transform or accelerated property"; that stays true.
- `docs/src/routes/docs/use-transform/+page.svx:175`, section `### Scroll acceleration`, last sentence: "The value
  must be bound to `opacity`, `filter`, `clipPath`, `transform`, or `backgroundColor`." Now stale (see
  `VisualElement.ts:557-563` above). The survey missed this one.
- `src/routes/tests/use-transform/scroll-accelerate/+page.svelte:14-16`:
  ```ts
      // Direct, first-hop transforms: accelerated.
      const directOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0])
      const directBackground = useTransform(scrollYProgress, [0, 1], ['#ff0000', '#0000ff'])
  ```
  The comment is now half wrong for `directBackground`. Nothing in that page's tester steps claims the colour runs on
  the compositor (the "keep fading" step is about opacity), so only the comment changes.
- Already correct, leave alone: `docs/src/routes/docs/use-will-change/+page.svx:53-55` ("Any other property (e.g.
  `backgroundColor`) leaves it at `auto`") and the `docs/src/routes/examples/use-will-change/` demo (its paint box
  is described as staying `auto`). On 14.6.0 that demo contradicted its own copy; the bump makes it true.
- **Out of bounds**: `src/lib/utils/optimizedAppear.ts:174-182` has a comment about `backgroundColor` and
  `acceleratedValues`. Plan 004 owns it. Do not touch that file or `optimizedAppear.spec.ts`.

### Leave-it-better: `getContextWindow` (optional Step 6)

- `src/lib/utils/visualElementCore.ts:462-477`:
  ```ts
  /**
   * Resolve the window a VisualElement's element lives in.
   *
   * Port of `framer-motion/src/utils/get-context-window.ts` (v14.5.0).
   * ...
   */
  export const getContextWindow = ({
      current
  }: VisualElement<Element>): (Window & typeof globalThis) | null =>
      current ? current.ownerDocument.defaultView : null
  ```
  used once, in `PanGestureFeature.onPointerDown` (`:509-516`, `contextWindow: getContextWindow(this.node)`), and
  tested in `src/lib/utils/visualElementCore.spec.ts:596-606` (`describe('getContextWindow')`). It is not exported
  from `src/lib/index.ts` (internal helper). `PanGestureFeature.update()` and `unmount()` (`:578-593`) use
  `this.session && this.session.updateHandlers(...)` / `this.session && this.session.end()`.
- Upstream `146ba7d63` ("Trim drag, pan, VisualElement and the React gesture wrappers", in 14.7.x, not 14.6.0)
  deleted `utils/get-context-window.ts` and inlined it. `packages/framer-motion/src/gestures/pan/index.ts:23-33 @v14.7.1`:
  ```ts
      onPointerDown(pointerDownEvent: PointerEvent) {
          this.session = new PanSession(
              pointerDownEvent,
              this.createPanHandlers(),
              {
                  transformPagePoint: this.node.getTransformPagePoint(),
                  // Fixes https://github.com/motiondivision/motion/issues/2270
                  contextWindow: this.node.current?.ownerDocument.defaultView,
              }
          )
      }
  ```
  and `update()` / `unmount()` became `this.session?.updateHandlers(...)` / `this.session?.end()` (lines 60-67).
  `PanSessionOptions.contextWindow` is `(Window & typeof globalThis) | null` and optional; the session does
  `contextWindow || window` (`packages/motion-dom/src/gestures/pan/PanSession.ts:31,99,112 @v14.7.1`), so
  `undefined` before mount behaves exactly like the old `null`.

### Other upstream changes checked during planning (no action)

- `packages/motion-dom/src/index.ts` is unchanged between `v14.6.0` and `v14.7.1`: no export removed or renamed.
  `framer-motion`'s index only moved some exports to `export type`; svelte-motion does not import `framer-motion`.
- `VisualElementDragControls.getProps()` (`motion-dom/src/gestures/drag/VisualElementDragControls.ts:856-860 @v14.7.1`)
  now only fills `dragElastic` / `dragMomentum` defaults. svelte-motion never calls the controls' `getProps()`
  (`grep -n "controls.getProps" src/lib` → nothing).
- Unguarded `process.env.NODE_ENV` reads: commit `cba8d970a` ("Only call invariant/warning in development
  builds") wrapped many `invariant`/`warning` calls in `process.env.NODE_ENV !== "production" &&`; `46bcded48`
  added `typeof process !== "undefined"` guards only on the `motion/mini` path. Counting non-test source files,
  `process.env.NODE_ENV` appears 5 times in `packages/motion-dom/src` at `v14.6.0` and 16 at `v14.7.1` (framer-motion
  7 → 19), e.g. `motion-dom/src/value/index.ts:239`, `render/VisualElement.ts:502`, `utils/interpolate.ts:69`.
  Bundlers replace the expression, but the docs site (SvelteKit on a Cloudflare Worker,
  `docs/wrangler.jsonc:9` `"compatibility_flags": ["nodejs_als", "nodejs_compat"]`) must be checked: Step 7.

### Conventions

- Test pages: `src/routes/tests/<area>/<page>/+page.svelte`; specs: `e2e/<area>/<name>.spec.ts`, loading
  `/tests/<area>/<page>?@isPlaywright=true`.
- Unit tests run in jsdom (`vitest.config.ts`); jsdom has no WAAPI.
- Changesets: `.changeset/<name>.md`, model `.changeset/motion-14-6-0.md` (bump `minor`, a bullet list of what users
  get).
- The docs site consumes the packaged library from `dist/` (`docs/package.json`:
  `"@humanspeak/svelte-motion": "workspace:*"`); run `pnpm build` (or `pnpm package`) before `pnpm --dir docs build`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` (if global pnpm refuses the pinned version: `npx -y pnpm@12.6.0 install`) | exit 0 |
| Typecheck | `pnpm check` | 0 errors (record the warning count before and after) |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>`; never `pnpm lint` / prettier / eslint directly | no new issues |
| Package | `pnpm build` (vite build + svelte-package + publint) | exit 0 |
| Vite 6 consumer | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | all pass |
| Docs build | `pnpm --dir docs build` (after `pnpm build`) | exit 0 |
| Docs types | `pnpm --dir docs check` (after the docs build) | 0 errors |
| One e2e spec | `PW_PORT=4211 pnpm exec playwright test <path>` | all pass |
| Full e2e | `PW_PORT=4211 pnpm test:e2e` | see Step 8 |

## Scope

**In scope**:

- `package.json` (the two pins only), `pnpm-lock.yaml` (regenerated by install)
- `src/lib/utils/willChange.svelte.spec.ts` (the `'flips to "transform" for accelerated values'` test, plus one new
  `it`)
- `e2e/utilities/will-change.spec.ts` (the backgroundColor test only)
- `e2e/utilities/use-transform-scroll-accelerate.spec.ts` (one new test, Step 2.4)
- `src/routes/tests/will-change/+page.svelte` (the colour card's `<h2>` and `.expectation` text only)
- `docs/src/routes/docs/use-transform/+page.svx` (the last sentence of `### Scroll acceleration`, line 175)
- `src/routes/tests/use-transform/scroll-accelerate/+page.svelte` (the comment at lines 14-16 only)
- `src/lib/utils/visualElementCore.ts` (`getContextWindow` removal and `PanGestureFeature` `onPointerDown` /
  `update` / `unmount` and its JSDoc version reference) and `src/lib/utils/visualElementCore.spec.ts` (the
  `describe('getContextWindow')` block and its import), **only in optional Step 6**
- `.changeset/motion-14-7-1.md` (create)
- other e2e spec files **only after the maintainer approves each change in Step 8**

**Out of scope**:

- `"version"` in `package.json`; PR labels.
- `src/lib/utils/optimizedAppear.ts`, `src/lib/utils/optimizedAppear.spec.ts` (plan 004).
- `src/lib/utils/willChange.svelte.ts` (follows the pin; no change).
- Any new test pages for engine fixes (#4022 rotations, WAAPI colour interrupt, transform speed changes, #1207
  springs): plan 005 owns them.
- `docs/src/routes/docs/use-will-change/**` and `docs/src/routes/examples/use-will-change/**` (already correct).
- Every other `src/lib` file.

## Git workflow

- Branch: `feat/motion-14.7.1` itself, in the worktree `../svelte-motion-1471`
  (`/Users/jasonkummerl/Github/svelte-motion-1471`). Commit directly there; do not create a lane branch.
- Conventional commits matching `git log`, for example
  `test(will-change): expect backgroundColor to stay on the main thread (Motion 14.7)`,
  `chore(deps): bump motion and motion-dom to 14.7.1`,
  `refactor(pan): inline the context window like upstream 146ba7d63`,
  `chore(changeset): Motion 14.7.1`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Confirm the upstream release exists

**Verify**: `npm view motion@14.7.1 version && npm view motion-dom@14.7.1 version` → prints `14.7.1` twice;
`npm view motion-dom@14.7.1 dependencies` → `{ 'motion-utils': '14.7.0' }`.

### Step 2: Red tests on the current pins (14.6.0)

1. `src/lib/utils/willChange.svelte.spec.ts`: rename the test at lines 46-56 to
   `'flips to "transform" for accelerated values (opacity)'` and delete its `backgroundColor` half (lines 52-54).
   Add a new test right after it:
   ```ts
       it('leaves backgroundColor at "auto": it runs on the main thread since Motion 14.7', () => {
           // Upstream f9e080f21 removed backgroundColor from motion-dom's
           // acceleratedValues (WAAPI mixes colours in sRGB, Motion in linear
           // space, so an interrupted WAAPI colour jumped).
           inRoot(() => {
               const wc = useWillChange()
               wc.add('backgroundColor')
               expect(wc.get()).toBe('auto')
           })
       })
   ```
   Do not touch the idempotence test at lines 67-76.
2. `e2e/utilities/will-change.spec.ts`: replace the test at lines 36-52 with
   `test('leaves will-change at "auto" for a backgroundColor animation (Motion 14.7)', …)`, modelled on the
   borderRadius test (`:67-84`): wait for `color-box` ready; `color-value` polls to `value: auto` and the computed
   will-change to `auto`; click `recolor`; poll the box's computed `background-color` to `rgb(240, 171, 252)` (the
   `#f0abfc` target, so the assertion proves an animation ran); will-change and the readout are still `auto`; click
   `recolor` again; poll the colour back to `rgb(103, 232, 249)` (`#67e8f9`); still `auto`. Comment: cite upstream
   `f9e080f21` and `motion-dom/src/animation/waapi/utils/accelerated-values.ts @v14.7.1`.
3. `src/routes/tests/will-change/+page.svelte`: change the colour card's `<h2>` to `Color animation (main thread)`
   and its `.expectation` paragraph to: "Since Motion 14.7, <code>backgroundColor</code> animates in JavaScript on
   the main thread, so it is not an accelerated value and will-change stays <code>auto</code>. (WAAPI mixes colours
   in sRGB and Motion in linear space, so interrupting a WAAPI colour animation jumped.)" Leave the markup, test ids
   and animation props unchanged.
4. `e2e/utilities/use-transform-scroll-accelerate.spec.ts`: add
   `test('a scroll-linked backgroundColor updates in JS, not as a native ScrollTimeline animation (Motion 14.7)', …)`.
   Load the page, `test.skip(!('ScrollTimeline' in window))` like the neighbouring tests, then poll (as a guard that
   acceleration is live) that `direct` has a ScrollTimeline animation whose keyframes include `opacity`, and assert
   that none of `direct`'s ScrollTimeline animations has keyframes including `backgroundColor` or
   `background-color`. Then scroll to the bottom and poll the computed `background-color` of `direct` until it is
   no longer `rgb(255, 0, 0)` (the colour still follows the scroll, in JS). Comment: upstream `f9e080f21` and
   `motion-dom/src/render/VisualElement.ts:557-563 @v14.7.1` (`value.accelerate && acceleratedValues.has(key)`).
   The `bg-accelerated` readout test stays as is (the `accelerate` config is still propagated, as upstream's
   `packages/framer-motion/cypress/integration/scroll-accelerate.ts:14-26 @v14.7.1` expects).

**Verify** (still on 14.6.0):
- `pnpm exec vitest run src/lib/utils/willChange.svelte.spec.ts` → the new "leaves backgroundColor" test **FAILS**
  (received `"transform"`); the rest pass.
- `PW_PORT=4211 pnpm exec playwright test e2e/utilities/will-change.spec.ts` → the backgroundColor test **FAILS**
  (will-change becomes `transform`); the other four pass.
- `PW_PORT=4211 pnpm exec playwright test e2e/utilities/use-transform-scroll-accelerate.spec.ts` → the new test
  **FAILS** (a native `backgroundColor` ScrollTimeline animation exists on `direct`); the others pass. If the test
  is skipped (no `ScrollTimeline` in this Chromium), STOP.
- If any new test passes on 14.6.0, STOP.

Commit (`test(will-change): expect backgroundColor to stay on the main thread (Motion 14.7)`).

### Step 3: Bump the pins

Edit `package.json`: `"motion": "14.7.1"`, `"motion-dom": "14.7.1"` (exact, no caret). Run `pnpm install`.

**Verify**:
- `pnpm why motion-dom | grep -oE "motion-dom@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-dom@14.7.1`
- `pnpm why motion-utils | grep -oE "motion-utils@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-utils@14.7.0`
- `pnpm why framer-motion | grep -oE "framer-motion@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `framer-motion@14.7.1`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → pass
- `node -e "import('motion-dom').then(m => console.log([...m.acceleratedValues].join(',')))"` →
  `opacity,clipPath,filter,transform`
- `pnpm check` → 0 errors

Commit (`chore(deps): bump motion and motion-dom to 14.7.1`).

### Step 4: Green on the new pins, and the remaining copy

1. **Verify**: `pnpm exec vitest run src/lib/utils/willChange.svelte.spec.ts` → all pass;
   `PW_PORT=4211 pnpm exec playwright test e2e/utilities/will-change.spec.ts e2e/utilities/use-transform-scroll-accelerate.spec.ts`
   → all pass.
2. `docs/src/routes/docs/use-transform/+page.svx:175`: change the last sentence to "The value must be bound to
   `opacity`, `filter`, `clipPath` or `transform`. Other values, such as `backgroundColor`, still follow the scroll
   but update in JavaScript." (Upstream `VisualElement.ts:557-563 @v14.7.1`.)
3. `src/routes/tests/use-transform/scroll-accelerate/+page.svelte:14`: replace the comment with
   `// Direct, first-hop transforms. Both carry the accelerate config; opacity runs as a native`
   `// ScrollTimeline animation, backgroundColor in JS since Motion 14.7 (not in acceleratedValues).`

**Verify**: `trunk check docs/src/routes/docs/use-transform/+page.svx src/routes/tests/use-transform/scroll-accelerate/+page.svelte src/routes/tests/will-change/+page.svelte`
→ no new issues.

Commit (`docs: backgroundColor no longer runs on the compositor (Motion 14.7)`).

### Step 5: Static and unit gates

**Verify**: `pnpm test:only` → all pass. If a unit test other than the ones above fails, STOP and report the test
name and assertion (likely sources: the spring generator change in `154d73c5b` / `251cf56b0`, or WAAPI transform
start/hold changes in `b58283208` / `dc23e95f8`, which jsdom doesn't exercise).

### Step 6 (optional leave-it-better): inline `getContextWindow` like upstream

Skip this step, and say so in your report, if the dispatcher told you another lane edits
`src/lib/utils/visualElementCore.ts`. Otherwise:

1. In `PanGestureFeature.onPointerDown`, replace `contextWindow: getContextWindow(this.node)` with
   `contextWindow: this.node.current?.ownerDocument.defaultView` and upstream's comment
   `// Fixes https://github.com/motiondivision/motion/issues/2270`. If `pnpm check` rejects the type, use
   `this.node.current?.ownerDocument.defaultView ?? null`.
2. Delete `getContextWindow` and its JSDoc (`visualElementCore.ts:462-477`).
3. In `update()`, use `this.session?.updateHandlers(this.createPanHandlers())`; in `unmount()`,
   `this.session?.end()`.
4. Change the version references in `PanGestureFeature`'s class JSDoc and `asyncPanHandler`'s JSDoc from `v14.5.0`
   to `v14.7.1`. The upstream file did change in range (`146ba7d63` removed the `getContextWindow` import, inlined
   it, and switched `update()` / `unmount()` to optional chaining), so the line numbers moved: update
   `asyncPanHandler`'s citation from `pan/index.ts:12-17` to `packages/framer-motion/src/gestures/pan/index.ts:11-16 @v14.7.1`.
5. In `src/lib/utils/visualElementCore.spec.ts`, delete `describe('getContextWindow', …)` (`:596-606`) and
   `getContextWindow` from the import list (`:21`). The pan tests in `describe('PanGestureFeature')` keep covering
   the session creation.

**Verify**: `grep -rn "getContextWindow" src` → no matches; `pnpm check` → 0 errors;
`pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` → all pass;
`PW_PORT=4211 pnpm exec playwright test e2e/motion/pan-window-scroll.spec.ts e2e/motion/pan-transform-page-point.spec.ts`
→ all pass.

Commit (`refactor(pan): inline the context window like upstream 146ba7d63`).

### Step 7: Package, consumer, and docs/SSR build check

Motion 14.7.1 reads `process.env.NODE_ENV` unguarded in more places (see "Other upstream changes"). Prove the
library and the docs site still build and serve.

1. `pnpm build` → exit 0 (publint clean).
2. `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → all pass.
3. `pnpm --dir docs build` → exit 0, and no `process is not defined` in the output.
4. `grep -rl "process.env.NODE_ENV" docs/.svelte-kit/output/client` → no matches (a client chunk that still reads
   `process` would throw `ReferenceError` in the browser). If the docs build writes its client output elsewhere,
   find the folder with `ls docs/.svelte-kit` and grep that instead; say which folder in your report.
5. Smoke test only: `vite preview` renders SSR in Node, where `process` exists, so it **cannot** catch a Worker
   `process is not defined`. Step 4's client-chunk grep is the real browser check. (The real Worker check is
   `wrangler dev`, via the docs `preview` script, `docs/package.json:21` `"preview": "pnpm run build && wrangler dev"`;
   it is optional, and if you run it, fetch the same two pages and report the result.) Serve the built docs and
   fetch two SSR pages that render motion components:
   `pnpm --dir docs exec vite preview --host 127.0.0.1 --port 5211 --strictPort` (run in the background), then
   `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5211/` and
   `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5211/docs/use-will-change` → `200` twice, and the
   preview's log shows no `process is not defined` / `ReferenceError`. Stop the preview server afterwards (only the
   one you started).
6. `pnpm --dir docs check` → 0 errors.
7. The docs build rewrites tracked `docs/static/r/animated-tabs.json` (known, pre-existing). If `git status` shows
   it modified, restore it with `git checkout -- docs/static/r/animated-tabs.json`; never commit it.

**Verify**: every sub-step's expected result above. If sub-step 3, 4 or 5 fails only after the bump (re-run on the
14.6.0 commit from Step 2 in a scratch worktree to compare, never stash), STOP and report the error and the file it
points at.

### Step 8: Full e2e triage (STOP-and-review gate)

Run `PW_PORT=4211 pnpm test:e2e` **only while no other lane is running Playwright** (ask the dispatcher if unsure),
and save the list of failing specs.

- Fully green: continue to Step 9.
- Any failure: **do not edit tests or library code.** For each failure, re-run that spec alone once (parallel lanes
  compete for CPU). If it fails again, record the spec, the test name and the assertion, and re-run it on
  `f8ac71aa` in a scratch worktree (`git worktree add ../svelte-motion-1471-baseline f8ac71aa`, `pnpm install
  --frozen-lockfile` there, `PW_PORT=4211 pnpm exec playwright test <spec>`; never stash) to separate new failures
  from pre-existing ones. Then STOP and hand the table to the maintainer, one row per failing spec with: spec path,
  test name, failing assertion, the test page URL (`/tests/...`), and "new with 14.7.1" or "pre-existing". The
  repo's CLAUDE.md requires failed e2e runs to be reviewed with the maintainer one page at a time: the maintainer
  opens each page, decides whether the behaviour or the test is wrong, and only then is a change made.
- Specs most likely to move: `e2e/independent-transforms/**` and `e2e/layout/**` (transform demotion during layout,
  `6c6edff28`), anything animating colours (now JS), anything with long or overdamped springs (`154d73c5b`,
  `251cf56b0`), `e2e/layout-id/**` (layoutRoot-relative shared animations, `012185841` and follow-ups),
  `e2e/drag/**` (ref constraints after scroll `cc260d322`, flick velocity `749cc1360`, inertia origin `ca04dba9d`),
  `e2e/animate-presence/**` (popped element positioning).

**Verify**: a written failure table (or "0 failures") in your report.

### Step 9: Changeset

Create `.changeset/motion-14-7-1.md`, bump type `minor`, in the style of `.changeset/motion-14-6-0.md`:
"Update Motion and motion-dom to 14.7.1. What arrives with the update:" followed by these bullets only:

- `backgroundColor` animations run in JavaScript instead of WAAPI, so interrupting one continues from the colour on
  screen instead of jumping. As a result `useWillChange()` no longer switches to `transform` for a
  `backgroundColor` animation, and a scroll-linked `useTransform` bound to `backgroundColor` updates in JavaScript.
  Colours only the browser can mix (like `oklch()`) still use WAAPI.
- An element whose transforms are running on the compositor is no longer distorted when a sibling's or child's
  layout animation measures it (for example, a looping 3D rotation next to a `layout` element) (Motion #4022).
- Changing the playback speed of an accelerated transform animation no longer flashes for a frame.
- Slow overdamped springs no longer snap to their target part-way through (#1207), and reversed long springs
  finish at their start.
- `drag`: a fast flick from a standstill keeps its release velocity instead of the inertia stopping dead (#1747,
  `749cc1360`).
- `drag`: ref `dragConstraints` stay correct after a `layoutScroll` ancestor scrolls, so a `Reorder.Item` no longer
  jumps after its group is scrolled (#2024, `cc260d322`, `cc84e31ad`, `8e2a53308`, `a04f5e6ee`).
- `drag`: releasing a drag fires `onAnimationComplete` once instead of once per `animate` variant (#1831,
  `a280595ea`).
- `drag`: inertia starts exactly at the release point (`ca04dba9d`).

The last eight bullets come from fixes whose regression tests live in plans 002 and 005; neither writes a
changeset, so they belong here. Do not mention features or fixes that other plans in this batch port and describe
in their own changesets (timeline sequences, `scrollXLength` / `scrollYLength`, `transition.out`, `Reorder`
LazyMotion import, `layoutRoot` for `layoutId`, changing `layoutId` after mount, `AnimatePresence` popped
positioning, `useScroll` horizontal tracking).

**Verify**: `trunk check .changeset/motion-14-7-1.md` → clean.

Commit (`chore(changeset): Motion 14.7.1`).

### Step 10: Final gate

**Verify**: `pnpm build` (exit 0), `pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=4211 pnpm exec playwright test e2e/utilities/will-change.spec.ts e2e/utilities/use-transform-scroll-accelerate.spec.ts`
(pass), `trunk check` on every file you changed (`git diff --name-only f8ac71aa..HEAD -- . ':!.agents' ':!pnpm-lock.yaml'`)
→ no new issues, `git diff --check f8ac71aa..HEAD -- . ':!.agents'` → no output, `git status` → clean, and
`git diff --name-only f8ac71aa..HEAD -- . ':!.agents'` lists only in-scope files (the excluded `.agents/` paths
are the wave-0 plan commit, not your work).

## Test plan

- Red-first anchors: the new unit test "leaves backgroundColor at auto" in `willChange.svelte.spec.ts` and the
  rewritten backgroundColor test in `e2e/utilities/will-change.spec.ts`. Both fail on 14.6.0 (will-change becomes
  `transform`) and pass on 14.7.1. Also the new scroll-accelerate test: on 14.6.0 `direct` gets a native
  `backgroundColor` ScrollTimeline animation; on 14.7.1 it doesn't.
- Guards: the rest of `will-change.spec.ts`, `use-transform-scroll-accelerate.spec.ts` (its `bg-accelerated`
  readout must still match native ScrollTimeline support), `motionDependencies.spec.ts`, the pan specs (optional
  Step 6), the docs build/serve check (Step 7), and the full e2e run (Step 8).
- The engine fixes listed in the changeset get their own regression pages in plan 005; this plan only proves they
  install.

## Done criteria

- [ ] `package.json` pins `motion` and `motion-dom` to exactly `14.7.1`; `"version"` unchanged (`2.5.0`)
- [ ] `pnpm why` shows a single `motion-dom@14.7.1`, `framer-motion@14.7.1` and `motion-utils@14.7.0`
- [ ] `grep -n "Motion 12.43" src/routes/tests/will-change/+page.svelte e2e/utilities/will-change.spec.ts` → no matches
- [ ] `grep -n "or \`backgroundColor\`" docs/src/routes/docs/use-transform/+page.svx` → no matches
- [ ] All three red-first tests (unit will-change, e2e will-change, e2e scroll-accelerate backgroundColor) failed on 14.6.0 (in the report) and pass on 14.7.1
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; consumer test passes; docs build, docs
      check and the docs preview fetches succeed; `trunk check` clean on changed files
- [ ] Full e2e result reported (green, or a failure table handed to the maintainer)
- [ ] `.changeset/motion-14-7-1.md` exists
- [ ] `src/lib/utils/optimizedAppear.ts` untouched (`git diff --stat f8ac71aa..HEAD -- src/lib/utils/optimizedAppear.ts` → no output)

## STOP conditions

- Port 4211 is occupied before a Playwright run (`lsof -ti :4211 -sTCP:LISTEN` prints a PID), or port 5211 before
  the docs preview.
- A Step 2 red test passes on 14.6.0.
- `pnpm why` shows more than one motion-dom, framer-motion or motion-utils version.
- After the bump, `pnpm check` reports any error, or a unit test outside Step 2's fails.
- The docs build, client grep, or docs preview fails after the bump but not before.
- Any full-suite e2e failure: report it, do not fix it.
- A fix seems to need any out-of-scope file (in particular `optimizedAppear.ts` or `willChange.svelte.ts`).

## Maintenance notes

- Every future Motion bump moves both pins together (spec-enforced), and `motion-utils` may lag a patch behind.
- If upstream ever puts `backgroundColor` back into `acceleratedValues`, flip the two Step 2 tests back and restore
  the copy; `willChange.svelte.ts` follows automatically.
- A reviewer should check that no test was loosened to pass: the will-change spec still asserts the colour really
  animated (computed `background-color` reaches the target).
- Optional Step 6 is behaviour-preserving. If it was skipped because of a lane conflict, it can land in any later
  plan that touches `visualElementCore.ts`.
