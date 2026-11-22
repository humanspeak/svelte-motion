# Plan 006: Changing a gesture prop mid-gesture no longer re-attaches hover, focus and in-view

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.spec.ts src/lib/utils/gestures.ts src/lib/utils/gestures.spec.ts src/routes/+page.svelte src/routes/tests/motion e2e/motion`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 003 of this batch edits a
> different effect in `_MotionContainer.svelte`, about lines 3078–3096. A
> diff there alone is not drift for this plan.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (every `motion.*` element with a hover, focus or in-view prop goes through this code)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

Every `motion.*` element attaches its hover, focus and in-view gestures from
one `$effect`. That effect reads every gesture prop, so any change to any of
them tears all three gestures down and attaches them again. Three
user-visible bugs follow:

1. A reactive `whileHover` (for example `whileHover={{ scale: big ? 1.4 : 1.2 }}`)
   changed while the pointer is over the element cancels motion-dom's
   `hover()`. The cancel removes the `pointerleave` listener without running
   the hover-end half, and the new `hover()` only listens for `pointerenter`.
   The hover sticks after the pointer leaves, and `onHoverEnd` never fires.
2. A `whileFocus` changed while the element is focused does the same to
   focus. The new attacher starts with `isActive = false`, so the next blur
   is ignored and `whileFocus` sticks.
3. Any gesture prop change creates a fresh `IntersectionObserver` with fresh
   `hasEnteredView`/`isInView` state. The browser reports the element as
   intersecting again, `onInViewStart` fires a second time, and
   `viewport={{ once: true }}` fires twice.

Upstream Motion keeps one Feature per gesture. A Feature is mounted once, its
handlers read the latest props at event time, and only the in-view Feature
ever restarts, and then only when `viewport.amount`, `margin` or `root`
changes. After this plan, svelte-motion has the same shape.

## Current state

- `src/lib/html/_MotionContainer.svelte` (4155 lines): the component behind
  every `motion.*` element. `untrack` is imported at line 56
  (`import { untrack, type Snippet } from 'svelte'`). The gesture attachers
  are imported at lines 62–67:

  ```ts
  import {
      attachFocusGesture,
      attachHoverGesture,
      attachInViewGesture,
      attachPressGesture
  } from '$lib/utils/gestures'
  ```

  The props are destructured at lines 205–221 (`whileHover: whileHoverProp`,
  `whileFocus: whileFocusProp`, `whileInView: whileInViewProp`,
  `viewport: viewportProp`, `onHoverStart: onHoverStartProp`,
  `onHoverEnd: onHoverEndProp`, `onFocusStart: onFocusStartProp`,
  `onFocusEnd: onFocusEndProp`, `onInViewStart: onInViewStartProp`,
  `onInViewEnd: onInViewEndProp`). `hasGestureFeatures` is
  `$derived(!!activeFeatures?.gestures)` at line 300.

  The shared gesture effect, lines 3611–3663:

  ```svelte
  // ── Gestures (#449 plan 003) ─────────────────────────────────────────────
  // ... (comment, lines 3612–3626) ...
  $effect(() => {
      if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
      const node = visualElement
      const target = element
      // Gate each attacher on its own props, exactly as upstream's
      // feature-enable lists do (`motion/features/definitions.ts`). Attaching
      // unconditionally would, among other things, create an
      // IntersectionObserver for every motion element on the page.
      const cleanups: (() => void)[] = []
      if (whileHoverProp || onHoverStartProp || onHoverEndProp) {
          cleanups.push(
              attachHoverGesture(target, node, {
                  onHoverStart: onHoverStartProp,
                  onHoverEnd: onHoverEndProp
              })
          )
      }
      if (whileFocusProp || onFocusStartProp || onFocusEndProp) {
          cleanups.push(
              attachFocusGesture(target, node, {
                  onFocusStart: onFocusStartProp,
                  onFocusEnd: onFocusEndProp
              })
          )
      }
      if (whileInViewProp || onInViewStartProp || onInViewEndProp) {
          cleanups.push(
              attachInViewGesture(target, node, viewportProp, {
                  onInViewStart: onInViewStartProp,
                  onInViewEnd: onInViewEndProp
              })
          )
      }
      return () => {
          for (const cleanup of cleanups) cleanup()
      }
  })
  ```

  Reading `whileHoverProp` and the other props in the effect body makes each
  one a dependency. A new object or function identity re-runs the effect, and
  its cleanup tears down all three gestures. `attachInViewGesture` also
  destructures `viewportProp` synchronously, so each `viewport` field it
  reads is tracked as well.

- **The in-repo pattern to copy** is the press effect directly below,
  lines 3665–3711. It depends on neither the `tap` object nor callback
  identity, and supplies callbacks through getters that are read at event
  time:

  ```svelte
  $effect(() => {
      if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
      if (!hasTapGesture) return
      // Callbacks are getters, read at event time, so a new callback
      // identity does not re-attach `press()`.
      return attachPressGesture(
          element,
          visualElement,
          {
              get onTapStart() {
                  return onTapStartProp
              },
              get onTap() {
                  return onTapProp
              },
              get onTapCancel() {
                  return onTapCancelProp
              }
          },
          pressOptions
      )
  })
  ```

  `hasTapGesture` is a `$derived` boolean (lines 3687–3689), so a new
  `whileTap` object does not re-run the effect. Do not change the press
  effect.

- `src/lib/utils/gestures.ts` (310 lines): the attachers. The `while*`
  definitions are already read at event time from `visualElement.getProps()`
  by `setGestureActive` (lines 58–66). The callback objects are read at event
  time too:
  - `attachHoverGesture`, lines 97–111. Its callbacks are read inside the
    `hover()` handlers (`postRender(callbacks?.onHoverStart)`), so a
    getter-backed object works unchanged.
  - `attachFocusGesture`, lines 203–239. `let isActive = false` at line 208
    is per-attach state, which is why a re-attach loses the blur. Getters work
    unchanged.
  - `attachInViewGesture`, lines 268–310. It owns `hasEnteredView` and
    `isInView` (lines 277–278) and creates one `IntersectionObserver`. It must
    become restartable without losing that state (Step 4).

- motion-dom's `hover()` cancel does not run the end callback
  (`~/Github/motion`, `v14.14.0`, `packages/motion-dom/src/gestures/hover.ts`):
  the `pointerleave` listener is only added inside `onPointerEnter`
  (lines 112–131), and the function returns `cancel` from `setupGesture`
  (line 145), which aborts the listeners. That is the mechanism of bug 1.

- Upstream shape (`~/Github/motion`, tag `v14.14.0`):
  - `packages/motion-dom/src/render/VisualElement.ts:657-688`
    (`updateFeatures`): a Feature is created the first time `isEnabled(props)`
    is true, then only `update()`d. It is never unmounted while the component
    lives, even if its props become falsy.
  - `packages/framer-motion/src/gestures/hover.ts:36-50`: `HoverGesture.mount()`
    calls `hover()` once. The handlers call `handleGestureEvent`
    (lines 14–34), which reads `node.props` at event time.
  - `packages/framer-motion/src/gestures/focus.ts:4-42`: one `isActive` field
    for the Feature's lifetime.
  - `packages/framer-motion/src/motion/features/viewport/index.ts`:
    `hasEnteredView` and `isInView` are class fields (lines 11–13).
    `startObserver()` (lines 17–71) stops the previous observer and starts a
    new one, keeping those fields. It reads the callbacks with
    `this.node.getProps()` at event time (lines 57–63). `update()`
    (lines 77–88) restarts only when `amount`, `margin` or `root` changed:

    ```ts
    update() {
        if (typeof IntersectionObserver === "undefined") return
        const { props, prevProps } = this.node
        const hasOptionsChanged = ["amount", "margin", "root"].some(
            hasViewportOptionChanged(props, prevProps)
        )
        if (hasOptionsChanged) {
            this.startObserver()
        }
    }
    ```

    `unmount()` (lines 90–94) stops the observer and resets both fields.
  - `packages/framer-motion/src/motion/features/definitions.ts`: hover is
    enabled by `whileHover`, `onHoverStart` or `onHoverEnd`. Focus is enabled by
    `whileFocus` only, and in-view by `whileInView`, `onViewportEnter` or
    `onViewportLeave`. svelte-motion also enables focus with
    `onFocusStart`/`onFocusEnd` and in-view with `onInViewStart`/`onInViewEnd`.
    Keep those enable lists as they are. Plan 014 adds `onViewportEnter` and
    `onViewportLeave`.

- One deliberate divergence stays. Upstream does not disconnect on `once`;
  ours does (`gestures.ts:297`, `if (once && isIntersecting) observer.disconnect()`),
  which is what makes "never fires again" true. Keep the disconnect. Step 4
  also makes a restart a no-op once a `once` gesture has latched, so a restart
  cannot reopen the latch.

- Tests and conventions:
  - Component unit tests: `src/lib/html/_MotionContainer.spec.ts` (jsdom,
    `@testing-library/svelte`). Its existing hover test (lines 664–717) stubs
    `matchMedia`, renders `MotionContainer` with props, uses
    `fireEvent.pointerEnter`/`pointerLeave`, and asserts with
    `await flushTimers()` and the file's `latestValuesOf(el)` helper.
    `animateMotionValue` is mocked to jump each value straight to its target.
    Props are changed with `await result.rerender({ ...allProps })`
    (for example line 1218). Always pass the full prop set to `rerender`.
  - Attacher unit tests: `src/lib/utils/gestures.spec.ts`. Its
    `describe('attachInViewGesture')` (lines 425–528) stubs
    `IntersectionObserver` with `vi.stubGlobal`, records each instance in
    `observers`, and drives the newest one with `intersect(bool)`. Copy that
    stub.
  - Test pages: `src/routes/tests/motion/<name>/+page.svelte`, using the
    guided `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`,
    hidden by itself under `?@isPlaywright=true`). Exemplar:
    `src/routes/tests/motion/tap-options/+page.svelte`, which imports it as
    `import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'`.
  - e2e: `e2e/motion/<name>.spec.ts`. Exemplar: `e2e/motion/tap-options.spec.ts`,
    with `readScale(locator)` (reads the scale from the computed transform)
    and `moveToCentre(page, locator)`. Copy both helpers.
  - Home-page links: `src/routes/+page.svelte` lines 326–333 hold the
    `tap-options` link. The shape is:

    ```svelte
    <li>
        <a
            class="text-blue-300 hover:underline"
            href={resolve('/tests/motion/tap-options') + searchParams}
        >
            Tap options: double tap, long press, repeat
        </a>
    </li>
    ```

## Commands you will need

| Purpose             | Command                                                                | Expected on success |
| ------------------- | ---------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`          | exit 0              |
| Browsers            | `pnpm exec playwright install chromium`                                | exit 0              |
| Build               | `pnpm build`                                                           | exit 0              |
| Typecheck           | `pnpm check`                                                           | 0 errors            |
| One unit file       | `pnpm exec vitest run <path>`                                          | see steps           |
| All unit tests      | `pnpm test:only`                                                       | all pass            |
| e2e (own port)      | `PW_PORT=4216 pnpm exec playwright test <paths> --project=chromium`    | see steps           |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                         | no issues           |

Notes:

- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4216`. Never set `PW_REUSE_SERVER`.
- Playwright builds and previews the app itself; you do not start a server.
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Never use `git stash` (the stash is shared across worktrees).

## Scope

**In scope** (the only files you should modify):

- `src/lib/html/_MotionContainer.svelte`: only the import block at
  lines 62–67, the gesture section at lines 3611–3663, and new `$derived`
  declarations placed directly above that section
- `src/lib/utils/gestures.ts`: the hover, focus and in-view parts and the file
  header. Do not change `attachPressGesture`.
- `src/lib/utils/gestures.spec.ts` (add tests)
- `src/lib/html/_MotionContainer.spec.ts` (add one `describe` block at the end)
- `src/routes/tests/motion/gesture-prop-change/+page.svelte` (create)
- `e2e/motion/gesture-prop-change.spec.ts` (create)
- `src/routes/+page.svelte` (one new link)
- `.changeset/gesture-effects-split.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- The press effect and `pressOptions` (lines 3665–3711) and
  `attachPressGesture`. They already have the target shape.
- Callback arguments (`(event, info)`, `IntersectionObserverEntry`) and the
  `onViewportEnter`/`onViewportLeave` props. Plan 014 adds them on top of this
  plan; keep every callback zero-argument here.
- `src/lib/types.ts` and the docs. Nothing public changes in this plan.
- `src/lib/utils/inView.svelte.ts` (`useInView`). It is a separate hook, not
  used by the component.
- The `onLayoutMeasure` effect (lines 3078–3096). Plan 003 owns it.
- Upstream's non-disconnecting `once` (see "Current state"). Keep ours.

## Git workflow

- Branch: `advisor/006-gesture-effects-split`, created by hand from the commit
  that adds this plan folder (not from `origin/main`, which lacks it).
- Conventional commits, for example
  `test(gestures): reproduce gesture re-attachment on prop change` and
  `fix(gestures): attach hover, focus and in-view once and read props at event time`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing component tests

Append one block to `src/lib/html/_MotionContainer.spec.ts`:
`describe('gesture props changing during the gesture (plan 006)', ...)`.
Reuse the file's imports, mocks, `flushTimers` and `latestValuesOf`. Write
these six tests:

1. **hover: a new `whileHover` mid-hover still ends the hover on leave.**
   Stub `matchMedia` exactly as the existing hover test does. Render with
   `props = { tag: 'div', initial: { scale: 1 }, animate: { scale: 1.1 }, whileHover: { scale: 1.2 }, onHoverStart, onHoverEnd }`
   (two `vi.fn()`s). Run `flushTimers()`, then `fireEvent.pointerEnter(el)` and
   `flushTimers()`. Then
   `rerender({ ...props, whileHover: { scale: 1.3 } })` and `flushTimers()`,
   and assert `latestValuesOf(el)` matches `{ scale: 1.3 }` (the new
   definition applies while hovering). Then `fireEvent.pointerLeave(el)` and
   `flushTimers()`. Assert `onHoverStart` was called once, `onHoverEnd` once,
   and `latestValuesOf(el)` matches `{ scale: 1.1 }`.
2. **focus: a new `whileFocus` mid-focus still ends on blur.** Render a
   `tag: 'button'` with
   `initial: { scale: 1 }, animate: { scale: 1 }, whileFocus: { scale: 1.2 }, onFocusStart, onFocusEnd`.
   After `flushTimers()`, make `:focus-visible` match on this element only:

   ```ts
   const realMatches = el.matches.bind(el)
   vi.spyOn(el, 'matches').mockImplementation(
       (selector: string) => selector === ':focus-visible' || realMatches(selector)
   )
   ```

   Then `fireEvent.focus(el)`, `flushTimers()`,
   `rerender({ ...props, whileFocus: { scale: 1.4 } })`, `flushTimers()`,
   `fireEvent.blur(el)` and `flushTimers()`. Assert `onFocusEnd` was called once
   and `latestValuesOf(el)` matches `{ scale: 1 }`.
3. **in-view: a new `whileInView` neither restarts the observer nor re-fires.**
   Before rendering, stub `IntersectionObserver` with the class from
   `gestures.spec.ts` lines 437–456, recording instances in a local
   `observers` array, and copy its `intersect(isIntersecting)` helper. Render
   `{ tag: 'div', initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, onInViewStart }`,
   then `flushTimers()`, `intersect(true)` and `flushTimers()`. Assert
   `onInViewStart` was called once. Then
   `rerender({ ...props, whileInView: { opacity: 0.9 } })` and `flushTimers()`.
   Then call `intersect(true)` again, which simulates the initial report a real
   browser sends any newly created observer, and `flushTimers()`. Assert
   `observers.length === 1` and `onInViewStart` was still called once.
4. **in-view: an `amount` change restarts the observer without re-firing.**
   Same setup without `once` (`viewport: { amount: 'some' }`). After the first
   `intersect(true)`, rerender with `viewport: { amount: 0.5 }`, then
   `flushTimers()`, `intersect(true)` and `flushTimers()`. Assert
   `observers.length === 2` (upstream restarts on `amount`), the first
   observer's `disconnect` was called, and `onInViewStart` was called once.
5. **in-view: a new callback identity is used without a new observer.**
   Render with `onInViewStart: first`, rerender with `onInViewStart: second`
   (same `whileInView` object reference, same `viewport` object reference),
   then `flushTimers()`, `intersect(true)` and `flushTimers()`. Assert
   `observers.length === 1`, `first` was not called and `second` was called
   once.
6. **hover: removing every hover prop mid-hover and adding them back keeps the
   listeners (the upstream enable latch).** Render as in test 1 and enter.
   Rerender with `whileHover`, `onHoverStart` and `onHoverEnd` all set to
   `undefined` explicitly (`rerender` may merge props, so leaving them out
   might not remove them), then `flushTimers()`. Rerender with `whileHover: { scale: 1.2 }` and a new
   `onHoverEnd2 = vi.fn()` as `onHoverEnd`, then `flushTimers()`,
   `fireEvent.pointerLeave(el)` and `flushTimers()`. Assert `onHoverEnd2` was
   called once.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 006"`
→ tests 1, 2, 3, 5 and 6 FAIL. Expected failures:

- 1: `onHoverEnd` called 0 times, and the scale reads 1.3 instead of 1.1.
- 2: `onFocusEnd` called 0 times.
- 3: `observers.length` is 2, or `onInViewStart` was called 2 times.
- 5: `observers.length` is 2.
- 6: `onHoverEnd2` called 0 times.

Test 4 may fail on the call count (2 instead of 1); either result is fine for
test 4 at this step. If tests 1, 2 and 3 all pass on the unmodified library,
the reproduction is wrong: STOP and report what each assertion read.

Commit: `test(gestures): reproduce gesture re-attachment on prop change`.

### Step 2: Add a test page and a failing e2e spec

Create `src/routes/tests/motion/gesture-prop-change/+page.svelte`, modelled on
`src/routes/tests/motion/tap-options/+page.svelte`:

- State: `hoverScale = $state(1.2)`, `hoverStarts`, `hoverEnds`,
  `focusScale = $state(1.2)`, `focusStarts`, `focusEnds`,
  `inViewOpacity = $state(1)`, `inViewAmount = $state<'some' | number>('some')`,
  `inViewStarts` (counters start at 0).
- `<svelte:window onkeydown={...} />`: `h` toggles `hoverScale` between 1.2 and
  1.4; `f` toggles `focusScale` between 1.2 and 1.4; `v` toggles
  `inViewOpacity` between 1 and 0.9. Keys are used because moving the pointer
  to a button would end the hover.
- Three 120×120 fixtures in one row near the top, all in the viewport at
  1280×720, styled like the `.target` class in the tap-options page (hover box
  pink `#e11d48`, focus button purple `#7c3aed`, in-view box green `#22aa66`):
  - `<motion.div data-testid="hover-box" animate={{ scale: 1 }} whileHover={{ scale: hoverScale }} onHoverStart={() => hoverStarts++} onHoverEnd={() => hoverEnds++}>`
  - `<motion.button data-testid="focus-box" animate={{ scale: 1 }} whileFocus={{ scale: focusScale }} onFocusStart={() => focusStarts++} onFocusEnd={() => focusEnds++}>`
  - `<motion.div data-testid="in-view-box" data-amount={String(inViewAmount)} initial={{ opacity: 0.2 }} whileInView={{ opacity: inViewOpacity }} viewport={{ once: true, amount: inViewAmount }} onInViewStart={() => inViewStarts++}>`
  - A plain `<button data-testid="toggle-amount">` that flips `inViewAmount`
    between `'some'` and `0.5`.
- Counters rendered as `<strong data-testid="hover-starts">`, `hover-ends`,
  `focus-starts`, `focus-ends`, `in-view-starts`.
- `TesterPanel` with eyebrow `gestures/hover.ts, viewport/index.ts`, a title,
  and steps:
  1. "Hover the pink box, press H while still over it, then move away."
     Expected: "It grows to 1.4× on H and returns to 1× when you leave. Hover
     end reads 1."
  2. "Press Tab until the Focus button is focused, press F, then press Tab
     again." Expected: "It grows to 1.4× on F and returns to 1× when focus
     moves on. Focus end reads 1."
  3. "Press V, then click Change amount." Expected: "In-view starts stays at 1."

Link it from `src/routes/+page.svelte` directly after the `tap-options` item
(lines 326–333), text `Gesture props changed mid-gesture`,
`href={resolve('/tests/motion/gesture-prop-change') + searchParams}`.

Create `e2e/motion/gesture-prop-change.spec.ts`. Copy `readScale` and
`moveToCentre` from `e2e/motion/tap-options.spec.ts`. In `beforeEach`, go to
`/tests/motion/gesture-prop-change?@isPlaywright=true` and wait for
`data-is-loaded="ready"` on all three fixtures. No `waitForTimeout`; use
`expect.poll` and locator assertions. Tests:

1. **hover ends after `whileHover` changes mid-hover**: `moveToCentre` on
   `hover-box`; `hover-starts` has text `1`; poll `readScale` > 1.15; press
   `h`; poll `readScale` > 1.35; `page.mouse.move(5, 5)`; `hover-ends` has
   text `1`; poll `readScale` < 1.02; `hover-starts` still `1`.
2. **focus ends after `whileFocus` changes mid-focus**: `focus-box.focus()`;
   `focus-starts` has text `1`; poll scale > 1.15; `page.keyboard.press('f')`;
   poll scale > 1.35; `focus-box.evaluate((el) => (el as HTMLElement).blur())`;
   `focus-ends` has text `1`; poll scale < 1.02.
3. **`once` in-view fires once across a `whileInView` change**:
   `in-view-starts` has text `1`; press `v`; poll the box's computed opacity
   until it is within 0.02 of 0.9 (proves the new definition applied and gives
   a fresh observer time to report); `in-view-starts` has text `1`.
4. **an `amount` change does not re-fire**: `in-view-starts` has text `1`;
   click `toggle-amount`; `in-view-box` has attribute `data-amount` `0.5`;
   wait two frames
   (`page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
   `in-view-starts` has text `1`.

**Verify** (the library is still unmodified):
`PW_PORT=4216 pnpm exec playwright test e2e/motion/gesture-prop-change.spec.ts --project=chromium`
→ tests 1, 2 and 3 FAIL: `hover-ends` stays `0` (and the scale stays near
1.4), `focus-ends` stays `0`, and `in-view-starts` reads `2`. Test 4 may pass
or fail at this step.

If test 1 passes on the unmodified library, STOP and report: the e2e
reproduction is wrong even though the unit test failed.

Commit: `test(gestures): add the gesture-prop-change page and e2e spec`.

### Step 3: Split the effect into one effect per gesture

In `src/lib/html/_MotionContainer.svelte`, replace the effect at
lines 3627–3663 (keep and update the section comment above it) with three
effects. Add the latches directly above the section.

Target shape:

```svelte
/**
 * Upstream creates a gesture Feature the first time one of its props is
 * truthy and never unmounts it while the component lives
 * (`VisualElement.updateFeatures`, motion-dom/src/render/VisualElement.ts:657-688
 * @ v14.14.0). The latch keeps the same rule: once enabled, the gesture's
 * effect never re-runs for prop changes, so removing every hover prop
 * mid-hover can't drop the pointerleave listener.
 */
const createFeatureLatch = () => {
    let enabled = false
    return (wanted: boolean) => (enabled ||= wanted)
}
const latchHover = createFeatureLatch()
const latchFocus = createFeatureLatch()
const latchInView = createFeatureLatch()
const hoverEnabled = $derived(latchHover(!!(whileHoverProp || onHoverStartProp || onHoverEndProp)))
const focusEnabled = $derived(latchFocus(!!(whileFocusProp || onFocusStartProp || onFocusEndProp)))
const inViewEnabled = $derived(
    latchInView(!!(whileInViewProp || onInViewStartProp || onInViewEndProp))
)
// Upstream restarts the in-view observer only when one of these changes
// (viewport/index.ts:77-88 @ v14.14.0). Deriveds compare by value, so a
// parent that re-creates an equal `viewport` object doesn't restart it.
const viewportAmount = $derived(viewportProp?.amount)
const viewportMargin = $derived(viewportProp?.margin)
const viewportRoot = $derived(viewportProp?.root)
```

```svelte
$effect(() => {
    if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
    if (!hoverEnabled) return
    // Callbacks are getters read at event time (as in the press effect), so a
    // new callback identity doesn't cancel an in-progress hover.
    return attachHoverGesture(element, visualElement, {
        get onHoverStart() {
            return onHoverStartProp
        },
        get onHoverEnd() {
            return onHoverEndProp
        }
    })
})

$effect(() => {
    if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
    if (!focusEnabled) return
    return attachFocusGesture(element, visualElement, {
        get onFocusStart() {
            return onFocusStartProp
        },
        get onFocusEnd() {
            return onFocusEndProp
        }
    })
})

$effect(() => {
    if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
    if (!inViewEnabled) return
    const gesture = createInViewGesture(element, visualElement, () => viewportProp, {
        get onInViewStart() {
            return onInViewStartProp
        },
        get onInViewEnd() {
            return onInViewEndProp
        }
    })
    // Nested: re-runs only on an amount/margin/root change and restarts the
    // observer while keeping hasEnteredView/isInView, like upstream's
    // `startObserver()` from `update()`. It is torn down with the parent.
    $effect(() => {
        void viewportAmount
        void viewportMargin
        void viewportRoot
        untrack(() => gesture.startObserver())
    })
    return () => gesture.unmount()
})
```

Notes:

- Mutating the latch's closure variable inside `$derived` is safe because it
  is a plain variable, not `$state`. The derived returns a boolean, so a new
  `whileHover` object does not propagate to the effect.
- Each effect must read only `element`, `visualElement`, `isLoaded`,
  `hasGestureFeatures` and its own latch (plus, for the nested in-view
  effect, the three viewport deriveds). Never read a `while*` prop, a
  callback prop or `viewportProp` itself in an effect body.
- Update the import (lines 62–67) to import `createInViewGesture` instead of
  `attachInViewGesture` (the latter stays exported from `gestures.ts` for its
  unit tests).
- Rewrite the section comment (lines 3611–3626) so it says: one effect per
  gesture, as upstream keeps one Feature per gesture; definitions are read
  from `ve.getProps()` and callbacks through getters at event time; and why
  (a re-attach cancels `hover()` without its end half). Cite the upstream
  files listed in "Current state".

This step will not compile until Step 4 adds `createInViewGesture`. Do Step 4
next, then verify both together.

### Step 4: Make the in-view gesture restartable without losing its state

In `src/lib/utils/gestures.ts`, replace the body of `attachInViewGesture`
(lines 268–310) with a controller plus a thin wrapper.

```ts
/**
 * A restartable in-view gesture, the shape of upstream's `InViewFeature`.
 *
 * @property startObserver Stops any current observer and starts a new one with
 *   the latest viewport options, keeping `hasEnteredView`/`isInView`. A no-op
 *   once a `once` gesture has latched.
 * @property unmount Stops the observer and resets the entry state.
 */
export interface InViewGesture {
    startObserver: () => void
    unmount: () => void
}

/**
 * Create the in-view gesture for an element without starting it.
 *
 * Port of `framer-motion/src/motion/features/viewport/index.ts:10-95` (v14.14.0).
 * ... (Google-style JSDoc: @param element, @param visualElement,
 * @param getViewport "Returns the current viewport options; read on each
 * start", @param callbacks "Read at event time", @returns, @example) ...
 */
export const createInViewGesture = (
    element: Element,
    visualElement: VisualElement,
    getViewport: () => MotionViewport | undefined,
    callbacks?: InViewGestureCallbacks
): InViewGesture => {
    let hasEnteredView = false
    let isInView = false
    let stopObserver: (() => void) | undefined

    const startObserver = () => {
        stopObserver?.()
        stopObserver = undefined
        if (typeof IntersectionObserver === 'undefined') return
        const { root, margin: rootMargin, amount = 0, once } = getViewport() ?? {}
        // Our `once` disconnects on first entry; a restart must not reopen it.
        if (once && hasEnteredView) return
        const observer = new IntersectionObserver(
            (entries) => {
                // ... the existing callback body (lines 281–297), unchanged,
                // now using the closure's hasEnteredView/isInView ...
            },
            {
                root: (typeof root === 'function' ? (root as () => Element)() : root) as
                    Element | undefined,
                rootMargin,
                threshold: typeof amount === 'number' ? amount : thresholdNames[amount]
            }
        )
        observer.observe(element)
        stopObserver = () => observer.disconnect()
    }

    return {
        startObserver,
        unmount: () => {
            stopObserver?.()
            stopObserver = undefined
            hasEnteredView = false
            isInView = false
        }
    }
}

export const attachInViewGesture = (
    element: Element,
    visualElement: VisualElement,
    viewport?: MotionViewport,
    callbacks?: InViewGestureCallbacks
): (() => void) => {
    const gesture = createInViewGesture(element, visualElement, () => viewport, callbacks)
    gesture.startObserver()
    return gesture.unmount
}
```

Keep `attachInViewGesture`'s existing JSDoc, and add a line saying it is
`createInViewGesture` + `startObserver()`. Keep the callbacks zero-argument
and keep `postRender` as it is (plan 014 changes both).

In `attachHoverGesture` and `attachFocusGesture`, change no logic. Add one
sentence to each JSDoc `@param callbacks`: "Read at event time, so a
getter-backed object supplies the latest callbacks without re-attaching."
Update the file header comment (lines 1–19) to say the component keeps one
attachment per gesture and reads props at event time.

**Verify**:

- `pnpm check` → 0 errors.
- `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 006"`
  → all six tests PASS.
- `pnpm exec vitest run src/lib/utils/gestures.spec.ts src/lib/html/_MotionContainer.spec.ts`
  → all pass (the existing `attachInViewGesture` tests still pass through the
  wrapper).
- `PW_PORT=4216 pnpm exec playwright test e2e/motion/gesture-prop-change.spec.ts --project=chromium`
  → all 4 PASS.

If `$effect` nested inside `$effect` fails to compile or test 4 cannot pass
with it, STOP and report. Do not fall back to a single effect.

Commit: `fix(gestures): attach hover, focus and in-view once and read props at event time`.

### Step 5: Unit tests for `createInViewGesture`

In `src/lib/utils/gestures.spec.ts`, add `describe('createInViewGesture')`,
reusing the `IntersectionObserver` stub, `makeNode` and `intersect` from the
`attachInViewGesture` block (move the stub into a shared `beforeEach` only if
that is a mechanical move; otherwise copy it). Cases:

1. `startObserver()` twice keeps state: start, `intersect(true)`, start again
   (a second observer exists and the first was disconnected), `intersect(true)`
   on the new one → `setActive('whileInView', true)` was called once and
   `onInViewStart` fired once.
2. `getViewport` is read on each start: a `let viewport = { amount: 'some' }`
   read through `() => viewport`; change it to `{ amount: 'all' }` and start
   again. The second observer was constructed with `threshold: 1`. Extend the
   stub to record the constructor's `options` argument.
3. `once` latch survives a restart: viewport `{ once: true }`, start,
   `intersect(true)`, start again → no new observer was created.
4. `unmount()` resets: start, `intersect(true)`, `unmount()`, start,
   `intersect(true)` → `onInViewStart` fired twice (a remount is a new
   gesture, as upstream's `unmount()` resets both fields).
5. No `IntersectionObserver` (`vi.stubGlobal('IntersectionObserver', undefined)`)
   → `startObserver()` and `unmount()` do not throw.

**Verify**: `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → all pass,
including 5 new tests.

### Step 6: Regression suites for gestures

```bash
pnpm exec vitest run src/lib/utils/gestures.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/components
PW_PORT=4216 pnpm exec playwright test e2e/motion e2e/armed-buttons e2e/lazy-motion e2e/variants --project=chromium
```

**Verify**: all pass. For an e2e failure, re-run that spec alone once. If it
fails again and passes with the Step 3–4 change reverted, STOP and report the
spec and assertion. Do not loosen an existing spec.

### Step 7: Changeset

Create `.changeset/gesture-effects-split.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Hover, focus and in-view gestures are now attached once per element, as in Motion. Changing `whileHover`, `whileFocus`, `whileInView` or a gesture callback during the gesture no longer leaves the hover or focus state stuck or loses `onHoverEnd`/`onFocusEnd`, and no longer fires `onInViewStart` again (`viewport.once` fires once). Changing `viewport.amount`, `margin` or `root` restarts the observer without re-firing.
```

### Step 8: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, the e2e commands from Steps 2
and 6 once more, `trunk fmt` and `trunk check` on every in-scope file, then
`git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: the six component tests in `_MotionContainer.spec.ts`
  (`-t "plan 006"`). Tests 1, 2, 3, 5 and 6 fail on current code for the
  reasons listed in Step 1. All six pass after Steps 3–4. jsdom is enough
  here because `hover()`, `addDomEvent` and the observer stub run the same code
  paths. The e2e spec proves the same three bugs in a real browser and is also
  shown red in Step 2.
- New unit tests: 5 cases for `createInViewGesture` in `gestures.spec.ts`.
- New e2e: 4 cases in `e2e/motion/gesture-prop-change.spec.ts`, on the new test
  page, which carries a guided tester panel.
- Regression: the existing gesture unit tests and the `e2e/motion`,
  `e2e/armed-buttons`, `e2e/lazy-motion` and `e2e/variants` suites.
- Patterns: the existing hover test in `_MotionContainer.spec.ts` (lines
  664–717); the observer stub in `gestures.spec.ts` (lines 425–471);
  `e2e/motion/tap-options.spec.ts` for helpers.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 006"` → 6 passed
- [ ] `pnpm exec vitest run src/lib/utils/gestures.spec.ts` exits 0 and includes `describe('createInViewGesture'`
- [ ] `PW_PORT=4216 pnpm exec playwright test e2e/motion/gesture-prop-change.spec.ts --project=chromium` exits 0
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `grep -n "attachInViewGesture" src/lib/html/_MotionContainer.svelte` prints nothing
- [ ] `grep -c "gesture-prop-change" src/routes/+page.svelte` prints `1`
- [ ] `grep -c "waitForTimeout" e2e/motion/gesture-prop-change.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- The gesture effect at lines 3627–3663 or `attachInViewGesture` at
  `gestures.ts:268-310` doesn't match the excerpts.
- Tests 1, 2 and 3 of Step 1 all pass on the unmodified library, or the e2e
  test 1 passes on the unmodified library in Step 2.
- Nested `$effect` does not compile, or Svelte warns about it at runtime.
- An existing gesture, variant, lazy-motion or armed-buttons spec fails after
  the fix and passes without it.
- The fix seems to need a change to the press effect, `types.ts`, or a
  public callback signature.

## Maintenance notes

- **Plan 014 depends on this plan.** It edits the same three effects (adds
  `onViewportEnter`/`onViewportLeave` to the in-view latch and getters) and the
  same attachers (callback arguments). Land 006 first.
- Plan 003 edits a different effect in `_MotionContainer.svelte` (about
  lines 3078–3096) in the same wave, and several wave-1 plans each add one
  link to `src/routes/+page.svelte`. Expect a rebase, not a conflict.
- Reviewer: check that no effect body reads a `while*` prop, a callback prop
  or `viewportProp` directly, only the latches and the three viewport
  deriveds. A stray read brings the bug back silently. The six Step 1 tests
  are the guard.
- The latch does not reset when `element` changes. The effects still
  re-attach on a new element because `element` is a dependency. This matches
  upstream, where a Feature lives as long as its VisualElement.
- Known divergence, left as it is: upstream doesn't disconnect on `once`, and
  by reading (`viewport/index.ts:36-63`) it re-runs `onViewportEnter` when a
  `once` element leaves and re-enters. Ours disconnects, so `once` fires
  exactly once, which is what both projects document. Worth raising upstream
  rather than copying.
