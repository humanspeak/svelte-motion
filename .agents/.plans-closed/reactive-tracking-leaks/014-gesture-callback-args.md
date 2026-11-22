# Plan 014: Hover, tap and viewport callbacks receive Motion's arguments, and `onViewportEnter` / `onViewportLeave` exist

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Prerequisite**: plan 006 (`006-gesture-effects-split.md`) must be DONE and
> merged into your base. Confirm both:
> `grep -n "export const createInViewGesture" src/lib/utils/gestures.ts` prints
> one line, and `grep -n "attachInViewGesture" src/lib/html/_MotionContainer.svelte`
> prints nothing. If either check fails, STOP.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/utils/gestures.ts src/lib/utils/gestures.spec.ts src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.spec.ts src/lib/types.ts src/lib/index.ts src/routes/+page.svelte src/routes/tests/motion e2e/motion docs/src/routes/docs/gestures docs/src/routes/docs/+page.svx docs/src/routes/docs/api-reference`
> Plan 006's changes to `gestures.ts`, `_MotionContainer.svelte`, both specs,
> `src/routes/+page.svelte`, `src/routes/tests/motion/gesture-prop-change` and
> `e2e/motion/gesture-prop-change.spec.ts` are expected. Any other change to an
> in-scope file means you compare the "Current state" excerpts against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (type changes stay assignable for existing zero-argument callbacks; one timing change, described below)
- **Depends on**: 006-gesture-effects-split.md (it rewrites the same gesture effects in `_MotionContainer.svelte` and the same attachers in `gestures.ts`; this plan edits the code 006 produces)
- **Wave**: 2
- **Category**: bug (upstream divergence)
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

svelte-motion's gesture callbacks are called with no arguments. In Motion,
`onHoverStart`, `onHoverEnd`, `onTapStart`, `onTap` and `onTapCancel` receive
`(event, info)`, where `info.point` is the pointer's page position. The
viewport callbacks receive the `IntersectionObserverEntry`. Motion's viewport
callbacks are also named `onViewportEnter` and `onViewportLeave`, which
svelte-motion doesn't accept. Code ported from Motion that reads `info.point`,
`event.target` or `entry.intersectionRatio` throws a `TypeError`, and
`onViewportEnter` is silently ignored. The package's stated goal is that Motion
examples translate with minimal changes. After this plan, the upstream
signatures and names work, and the existing `onInViewStart` / `onInViewEnd`
keep working as aliases.

## Current state

This plan edits code that plan 006 rewrote. Line numbers below are from
`a33531a2` (before 006) and will have moved. Locate code by symbol name.

- `src/lib/utils/gestures.ts`: the gesture attachers.
  - `postRender` (lines 68–72 at `a33531a2`) passes no arguments:

    ```ts
    /** Fire a user callback after the current render, as upstream does. */
    const postRender = (callback: (() => void) | undefined): void => {
        if (!callback) return
        frame.postRender(() => callback())
    }
    ```

  - `HoverGestureCallbacks` (lines 74–78) and `attachHoverGesture`
    (lines 97–111) ignore the events `hover()` passes:

    ```ts
    return hover(element, () => {
        setGestureActive(visualElement, 'whileHover', true)
        postRender(callbacks?.onHoverStart)

        return () => {
            setGestureActive(visualElement, 'whileHover', false)
            postRender(callbacks?.onHoverEnd)
        }
    })
    ```

  - `PressGestureCallbacks` (lines 119–123) and `attachPressGesture`
    (lines 148–182) ignore the press events:

    ```ts
    return press(
        element,
        () => {
            if (isDisabledButton()) return
            setGestureActive(visualElement, 'whileTap', true)
            postRender(callbacks?.onTapStart)

            return {
                onComplete: (_endEvent, { success }) => {
                    if (isDisabledButton()) return
                    setGestureActive(visualElement, 'whileTap', false)
                    postRender(success ? callbacks?.onTap : callbacks?.onTapCancel)
                },
                onRepeat: () => {
                    if (isDisabledButton()) return
                    postRender(callbacks?.onTap)
                }
            }
        },
        options
    )
    ```

  - `InViewGestureCallbacks` (lines 241–245) has only `onInViewStart` and
    `onInViewEnd`, both `() => void`. After plan 006, the observer callback
    lives inside `createInViewGesture` and ends with these lines (from the
    original lines 294–297):

    ```ts
    setGestureActive(visualElement, 'whileInView', isIntersecting)
    postRender(isIntersecting ? callbacks?.onInViewStart : callbacks?.onInViewEnd)

    if (once && isIntersecting) observer.disconnect()
    ```

  - `FocusGestureCallbacks` and `attachFocusGesture`: no change in this plan
    (see "Out of scope").

- `src/lib/html/_MotionContainer.svelte`:
  - Props destructured at lines 216–224 (`onHoverStart: onHoverStartProp`, …,
    `onInViewStart: onInViewStartProp`, `onInViewEnd: onInViewEndProp`,
    `onTapStart: onTapStartProp`, `onTap: onTapProp`,
    `onTapCancel: onTapCancelProp`). There is no `onViewportEnter` or
    `onViewportLeave`.
  - After plan 006: an `inViewEnabled` latch
    (`latchInView(!!(whileInViewProp || onInViewStartProp || onInViewEndProp))`)
    and an in-view `$effect` that calls `createInViewGesture(element, visualElement, () => viewportProp, { get onInViewStart() {…}, get onInViewEnd() {…} })`.
    The hover and press effects pass getter-backed callback objects. Their
    callbacks flow through unchanged once the attachers pass arguments.

- `src/lib/types.ts`:
  - Lines 465–480:

    ```ts
    /** Hover lifecycle callbacks */
    export type MotionOnHoverStart = (() => void) | undefined
    export type MotionOnHoverEnd = (() => void) | undefined

    /** Focus lifecycle callbacks */
    export type MotionOnFocusStart = (() => void) | undefined
    export type MotionOnFocusEnd = (() => void) | undefined

    /** InView lifecycle callbacks */
    export type MotionOnInViewStart = (() => void) | undefined
    export type MotionOnInViewEnd = (() => void) | undefined

    /** Tap lifecycle callbacks */
    export type MotionOnTapStart = (() => void) | undefined
    export type MotionOnTap = (() => void) | undefined
    export type MotionOnTapCancel = (() => void) | undefined
    ```

  - Props at lines 734–751 (`onHoverStart?: MotionOnHoverStart`, …,
    `onInViewStart?: MotionOnInViewStart` documented as "Called when element
    enters viewport", …).
  - `import type { … } from 'motion-dom'` at lines 4–11 (currently
    `DragConstraintsFunction, DragControlOptions, PinchProps, PressOptions, ResolvedValues, VisualElementDragControls`).
  - `MotionViewport` at lines 432–441. Unchanged here.

- `src/lib/index.ts` lines 186–215: `export type { … } from '$lib/types'`,
  which already includes `MotionOnInViewEnd` and `MotionOnInViewStart`.
  motion-dom type re-exports follow the pattern at line 172
  (`export type { MediaConditions, … } from 'motion-dom'`).

- Docs that document these props:
  - `docs/src/routes/docs/gestures/+page.svx`: line 41 lists the callbacks;
    examples at lines 46–54 (hover), 62–71 (tap), 160–174 (in-view).
  - `docs/src/routes/docs/+page.svx` lines 194–202: the in-view callback
    example uses `onInViewStart` / `onInViewEnd`.
  - `docs/src/routes/docs/api-reference/+page.svx` lines 51–55: the
    "Drag/in-view event handlers" group in the exported-types code block.

- Upstream (`~/Github/motion`, tag `v14.14.0`):
  - `packages/framer-motion/src/gestures/hover.ts:14-34`
    (`handleGestureEvent`). It reads the callback from props at event time and
    calls it after render with the event and its info:

    ```ts
    const callback = props[("on" + gesture + lifecycle) as "onHoverStart"] as
        | ((event: PointerEvent, info: any) => void)
        | undefined
    if (callback) {
        frame.postRender(() => callback(event, extractEventInfo(event)))
    }
    ```

    `HoverGesture.mount()` (lines 36–47) passes `startEvent` to the start and
    `endEvent` to the end.
  - `packages/framer-motion/src/gestures/press.ts:35-52`: `onTapStart` gets
    `startEvent`, `onTap`/`onTapCancel` get `endEvent` (by `success`), and a
    repeat fires `onTap` with the **start** event:
    `onRepeat: () => handlePressEvent(this.node, startEvent, "", true)`.
  - `packages/motion-dom/src/events/event-info.ts:9-16`:

    ```ts
    export function extractEventInfo(event: PointerEvent): EventInfo {
        return { point: { x: event.pageX, y: event.pageY } }
    }
    ```

    It is exported from `motion-dom` (as `extractEventInfo`).
  - `packages/framer-motion/src/motion/features/viewport/index.ts:57-63`.
    Viewport callbacks are called **synchronously** inside the observer
    callback, not after render, with the entry:

    ```ts
    const { onViewportEnter, onViewportLeave } = this.node.getProps()
    const callback = isIntersecting ? onViewportEnter : onViewportLeave
    callback && callback(entry)
    ```

  - Types, `packages/motion-dom/src/node/types.ts`:
    `EventInfo { point: Point }` (lines 18–20);
    `onHoverStart?(event: PointerEvent, info: EventInfo): void` (432) and
    `onHoverEnd` (441); `TapInfo { point: Point }` (458–475);
    `onTap?(event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo): void`
    (491), with `onTapStart` (507–510) and `onTapCancel` (526–529) the same;
    `ViewportEventHandler = (entry: IntersectionObserverEntry | null) => void`
    (592–594); `onViewportEnter?` / `onViewportLeave?: ViewportEventHandler`
    (605–606). `EventInfo`, `TapInfo` and `ViewportEventHandler` are exported
    from `motion-dom`, and upstream's `framer-motion` and `motion` packages make
    them importable through `export * from "motion-dom"`
    (`packages/framer-motion/src/dom.ts:1`).
  - `packages/framer-motion/src/motion/features/definitions.ts`: in-view is
    enabled by `whileInView`, `onViewportEnter` or `onViewportLeave`.
  - Upstream has no focus callbacks (`gestures/focus.ts` only toggles
    `whileFocus`). `onFocusStart`/`onFocusEnd` are a svelte-motion addition.

- **Decision on `onInViewStart` / `onInViewEnd`**: they are not upstream
  names, but existing users rely on them. Keep them as aliases. They get the
  same `ViewportEventHandler` signature and fire at the same moment, right
  after `onViewportEnter` / `onViewportLeave` when both are set. They also keep
  enabling the gesture. Document `onViewportEnter` / `onViewportLeave` as the
  names to use. Don't mark the aliases `@deprecated` in this patch release.
  That's for the maintainer to decide (see Maintenance notes).

- **Timing change**: all four viewport callbacks move from `frame.postRender`
  to synchronous, as upstream. A callback still runs once per transition.
  Only the frame it runs in changes.

- Conventions: attacher unit tests in `src/lib/utils/gestures.spec.ts`
  (`makeNode`, the `pointer(type)` helper, the `IntersectionObserver` stub and
  `intersect()`), component tests in `src/lib/html/_MotionContainer.spec.ts`
  (see its hover test and plan 006's `describe('… (plan 006)')` block). Test
  pages use `TesterPanel`, as in `src/routes/tests/motion/tap-options/+page.svelte`.
  e2e helpers `readScale`/`moveToCentre` are in `e2e/motion/tap-options.spec.ts`.
  Public types need Google-style JSDoc.

## Commands you will need

| Purpose             | Command                                                                | Expected on success |
| ------------------- | ---------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`          | exit 0              |
| Browsers            | `pnpm exec playwright install chromium`                                | exit 0              |
| Build               | `pnpm build`                                                           | exit 0              |
| Typecheck           | `pnpm check`                                                           | 0 errors            |
| One unit file       | `pnpm exec vitest run <path>`                                          | see steps           |
| All unit tests      | `pnpm test:only`                                                       | all pass            |
| e2e (own port)      | `PW_PORT=4224 pnpm exec playwright test <paths> --project=chromium`    | see steps           |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                         | no issues           |

Notes:

- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4224`. Never set `PW_REUSE_SERVER`.
- Playwright builds and previews the app itself; you do not start a server.
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/gestures.ts` (callback types, `postRender`, hover, press and
  in-view callback calls)
- `src/lib/utils/gestures.spec.ts` (add tests)
- `src/lib/html/_MotionContainer.svelte` (the prop destructure, the in-view
  latch and the in-view effect's getters only)
- `src/lib/html/_MotionContainer.spec.ts` (add one `describe` block)
- `src/lib/types.ts` (the callback types at lines 465–480 and the props at
  lines 734–751, plus the `motion-dom` type import)
- `src/lib/index.ts` (type exports only)
- `src/routes/tests/motion/gesture-callback-args/+page.svelte` (create)
- `e2e/motion/gesture-callback-args.spec.ts` (create)
- `src/routes/+page.svelte` (one new link)
- `docs/src/routes/docs/gestures/+page.svx`
- `docs/src/routes/docs/+page.svx` (the in-view callback example only)
- `docs/src/routes/docs/api-reference/+page.svx` (the types code block only)
- `.changeset/gesture-callback-args.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `onFocusStart` / `onFocusEnd` signatures. Upstream has no focus callbacks to
  match, so they stay zero-argument.
- Pan and drag callbacks. They already receive `(event, info)`.
- The effect structure from plan 006 (latches, nested in-view effect, getters
  for hover and press). Only add the two new props to the in-view latch and
  getters.
- `src/lib/html/index.ts` and `scripts/generate-html.ts` (the generated
  per-tag "supported features" JSDoc lists). They are already incomplete and
  regenerating them is a separate change.
- `src/lib/utils/inView.svelte.ts` (`useInView`).
- Marking `onInViewStart` / `onInViewEnd` `@deprecated`.

## Git workflow

- Branch: `advisor/014-gesture-callback-args`, created from the tip of plan
  006's merged work (not from `origin/main` if 006 is not there yet).
- Conventional commits, for example
  `test(gestures): expect Motion's callback arguments` and
  `fix(gestures): pass (event, info) to hover and tap callbacks and add onViewportEnter/onViewportLeave`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing attacher tests

In `src/lib/utils/gestures.spec.ts`, add:

1. In `describe('attachHoverGesture')`: **passes `(event, { point })` to both
   callbacks.** Create `const enter = pointer('pointerenter')` and
   `const leave = pointer('pointerleave')`, dispatch them in turn with
   `flushPostRender()` after each, and assert
   `expect(onHoverStart).toHaveBeenCalledWith(enter, { point: { x: enter.pageX, y: enter.pageY } })`
   and the same for `onHoverEnd` with `leave`.
2. In `describe('attachPressGesture')`:
   - **`onTapStart` and `onTap` get their events and points**: dispatch
     `const down = pointer('pointerdown')` on the element, flush, and assert
     `onTapStart` was called with `(down, { point: { x: down.pageX, y: down.pageY } })`.
     Dispatch `pointerup` on the element, flush, and read
     `const [event, info] = onTap.mock.calls[0]`. Assert
     `event.type === 'pointerup'` and
     `info` equals `{ point: { x: event.pageX, y: event.pageY } }`.
   - **`onTapCancel` gets the release event**: release on `window` as the
     existing cancel test does. Assert the first argument's `type` is
     `'pointerup'` and the second has a `point`.
   - **a repeat passes the START event to `onTap`**: copy the existing
     `repeat: 0.03` test, keep the `pointerdown` event in `down`, and after
     the wait assert every `onTap` call's first argument is `down`
     (`onTap.mock.calls.every(([event]) => event === down)`).
3. In `describe('attachInViewGesture')` (the plan 006 wrapper):
   - **`onViewportEnter` / `onViewportLeave` get the entry, synchronously**:
     change the `intersect` helper so it builds the entry once and returns it
     (`const entry = { target: element, isIntersecting } as unknown as IntersectionObserverEntry`).
     Pass `{ onViewportEnter, onViewportLeave }` and call `intersect(true)`.
     Without flushing, assert `onViewportEnter` was called with that entry.
     Do the same for leave.
   - **the aliases fire with the entry too, right after the upstream name**:
     pass `onViewportEnter` and `onInViewStart`, intersect, and without
     flushing assert both were called once with the entry. Assert the call
     order with `onViewportEnter.mock.invocationCallOrder[0] < onInViewStart.mock.invocationCallOrder[0]`.

**Verify**: `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → the new
tests FAIL. Hover and press fail with "expected … to be called with
arguments … Received: (no arguments)" or `mock.calls[0]` being `[]`. The
viewport tests fail because `onViewportEnter` is never called, and the alias
test because `onInViewStart` has not run synchronously (it is still
post-render) or got no arguments. All pre-existing tests in the file still
pass.

If any new hover or press test passes on the unmodified code, STOP and report.

### Step 2: Write failing component tests

Append `describe('gesture callback arguments (plan 014)', …)` to
`src/lib/html/_MotionContainer.spec.ts`, reusing the file's helpers and the
`matchMedia` / `IntersectionObserver` stubs used by plan 006's block:

1. **`onViewportEnter` and `onViewportLeave` are accepted and get the entry**:
   render `{ tag: 'div', whileInView: { opacity: 1 }, onViewportEnter, onViewportLeave }`,
   `flushTimers()`, `intersect(true)`. Assert `onViewportEnter` was called
   once with the entry. `intersect(false)`; assert `onViewportLeave` was called
   once with that entry.
2. **`onViewportEnter` alone enables the gesture**: render
   `{ tag: 'div', onViewportEnter }` (no `whileInView`). Assert one
   `IntersectionObserver` was created and that `intersect(true)` calls
   `onViewportEnter`.
3. **the new props are not forwarded to the DOM**: in test 1, assert
   `el.hasAttribute('onviewportenter')` and `el.hasAttribute('onViewportEnter')`
   are both `false`.
4. **hover callbacks get `(event, info)` through the component**: as the
   existing hover test, with `onHoverStart`. After `fireEvent.pointerEnter(el)`
   and `flushTimers()`, read `const [event, info] = onHoverStart.mock.calls[0]`
   and assert `event.type === 'pointerenter'` and `info.point` has numeric
   `x` and `y`.

**Verify**:
`pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 014"` →
tests 1, 2 and 4 FAIL (no observer or no call for `onViewportEnter`;
`mock.calls[0]` is `[]` for hover). Test 3 may pass already. If tests 1, 2 and
4 all pass on the unmodified code, STOP and report.

Commit both test steps: `test(gestures): expect Motion's callback arguments`.

### Step 3: Add a test page and a failing e2e spec

Create `src/routes/tests/motion/gesture-callback-args/+page.svelte`, modelled
on `src/routes/tests/motion/tap-options/+page.svelte`:

- A `motion.div` `data-testid="hover-box"` with `whileHover={{ scale: 1.1 }}`,
  `onHoverStart={(event, info) => { hoverStart = `${event.type} ${Math.round(info.point.x)},${Math.round(info.point.y)}` }}`
  and the same for `onHoverEnd` into `hoverEnd`.
- A `motion.button` `data-testid="tap-box"` with `whileTap={{ scale: 0.9 }}`,
  `onTapStart` writing `tapStart` and `onTap` writing `tap` in the same
  `"<type> x,y"` format.
- A `motion.div` `data-testid="in-view-box"` with `initial={{ opacity: 0.2 }}`,
  `whileInView={{ opacity: 1 }}`,
  `onViewportEnter={(entry) => { viewportEnter = `${entry?.isIntersecting} ${(entry?.target as HTMLElement | undefined)?.dataset.testid}` }}`
  and `onInViewStart={() => aliasStarts++}`.
- Readouts: `<strong data-testid="hover-start">`, `hover-end`, `tap-start`,
  `tap`, `viewport-enter`, `alias-starts`. Initial text is `none` (`0` for the
  count).
- `TesterPanel` (eyebrow `gestures/hover.ts, press.ts, viewport/index.ts`)
  with steps: "Hover the box and move away" → "Hover start and end show the
  event type and your pointer's page position"; "Click the button" → "Tap
  start shows pointerdown, tap shows pointerup, both with the click position";
  "Load the page" → "Viewport enter reads `true in-view-box`, alias starts
  reads 1".

Link it from `src/routes/+page.svelte` directly after the
`gesture-prop-change` item that plan 006 added, with text
`Gesture callback arguments (event, info, entry)` and
`href={resolve('/tests/motion/gesture-callback-args') + searchParams}`.

Create `e2e/motion/gesture-callback-args.spec.ts`. Go to
`/tests/motion/gesture-callback-args?@isPlaywright=true` and wait for
`data-is-loaded="ready"` on the three fixtures. Collect page errors from before `page.goto`:
`const errors: string[] = []` and
`page.on('pageerror', (error) => errors.push(error.message))`.
No `waitForTimeout`. Each test ends by asserting that `errors` holds no
message containing `Cannot read properties`. Tests:

1. **hover callbacks get the event and its page point**: get the box's
   bounding box, `page.mouse.move(cx, cy)` with integer `cx`, `cy` at its
   centre. Expect `hover-start` to have text `pointerenter ${cx},${cy}`
   (`window.scrollY` is 0). Then `page.mouse.move(5, 5)` and expect
   `hover-end` to start with `pointerleave `.
2. **tap callbacks get the press and release events**: click the button
   centre with `page.mouse.move`, `down` and `up`. Expect `tap-start` to have
   text `pointerdown ${cx},${cy}` and `tap` to have text `pointerup ${cx},${cy}`.
3. **`onViewportEnter` gets the entry and the alias still fires**: expect
   `viewport-enter` to have text `true in-view-box` and `alias-starts` to have
   text `1`.

**Verify** (the library is still unmodified):
`PW_PORT=4224 pnpm exec playwright test e2e/motion/gesture-callback-args.spec.ts --project=chromium`
→ tests 1, 2 and 3 FAIL: the hover, tap and viewport-enter readouts stay
`none`, and a `Cannot read properties of undefined` page error is collected. The Playwright
build does not type-check, so the page runs. `pnpm check` reports errors on
this page until Step 5 changes the prop types. That's expected; don't run it
in between.

If test 1 or test 3 passes on the unmodified library, STOP and report.

Commit: `test(gestures): add the gesture-callback-args page and e2e spec`.

### Step 4: Pass the arguments in `gestures.ts`

In `src/lib/utils/gestures.ts`:

1. Import `extractEventInfo` and the types
   `EventInfo, TapInfo, ViewportEventHandler` from `motion-dom` (add them to
   the existing import at lines 22–29).
2. Make `postRender` forward arguments:

   ```ts
   /**
    * Fire a user callback after the current render with its arguments, as
    * upstream's `handleGestureEvent` does (gestures/hover.ts:28-33 @ v14.14.0).
    * The callback is read by the caller at event time, so the latest prop wins.
    */
   const postRender = <Args extends unknown[]>(
       callback: ((...args: Args) => void) | undefined,
       ...args: Args
   ): void => {
       if (!callback) return
       frame.postRender(() => callback(...args))
   }
   ```

3. Types (update each JSDoc: drop "Zero-argument"; say the arguments match
   Motion's):

   ```ts
   export interface HoverGestureCallbacks {
       onHoverStart?: (event: PointerEvent, info: EventInfo) => void
       onHoverEnd?: (event: PointerEvent, info: EventInfo) => void
   }
   export interface PressGestureCallbacks {
       onTapStart?: (event: PointerEvent, info: TapInfo) => void
       onTap?: (event: PointerEvent, info: TapInfo) => void
       onTapCancel?: (event: PointerEvent, info: TapInfo) => void
   }
   export interface InViewGestureCallbacks {
       onViewportEnter?: ViewportEventHandler
       onViewportLeave?: ViewportEventHandler
       /** Alias of `onViewportEnter`, called right after it. */
       onInViewStart?: ViewportEventHandler
       /** Alias of `onViewportLeave`, called right after it. */
       onInViewEnd?: ViewportEventHandler
   }
   ```

4. Hover: `hover(element, (_element, startEvent) => { …; postRender(callbacks?.onHoverStart, startEvent, extractEventInfo(startEvent)); return (endEvent) => { …; postRender(callbacks?.onHoverEnd, endEvent, extractEventInfo(endEvent)) } })`.
5. Press: the start handler takes `(_element, startEvent)`.
   `onTapStart` gets `(startEvent, extractEventInfo(startEvent))`.
   `onComplete: (endEvent, { success })` passes
   `(endEvent, extractEventInfo(endEvent))` to `onTap` or `onTapCancel`.
   `onRepeat` passes `(startEvent, extractEventInfo(startEvent))` to `onTap`
   (upstream press.ts:47-48). Keep the `isDisabledButton()` guards exactly
   where they are.
6. In-view, inside `createInViewGesture`'s observer callback, replace the
   `postRender(...)` line with a synchronous call:

   ```ts
   // Upstream calls these synchronously with the entry
   // (viewport/index.ts:57-63 @ v14.14.0). `onInViewStart`/`onInViewEnd`
   // are this library's older names, kept as aliases.
   if (isIntersecting) {
       callbacks?.onViewportEnter?.(entry)
       callbacks?.onInViewStart?.(entry)
   } else {
       callbacks?.onViewportLeave?.(entry)
       callbacks?.onInViewEnd?.(entry)
   }
   ```

   Keep it after `setGestureActive(...)` and before the `once` disconnect.
7. Update the JSDoc of `attachHoverGesture`, `attachPressGesture`,
   `createInViewGesture` and `attachInViewGesture` to describe the arguments.
   Leave `attachFocusGesture`'s callbacks zero-argument; `postRender(cb)` with
   no extra arguments still type-checks.

**Verify**: `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → all pass,
including the Step 1 tests.

### Step 5: Public types and the component props

In `src/lib/types.ts`:

1. Add `EventInfo, TapInfo, ViewportEventHandler` to the `motion-dom` type
   import.
2. Replace the hover, in-view and tap types (keep the focus types as they
   are). Give each a Google-style JSDoc block naming the arguments:

   ```ts
   /**
    * Hover lifecycle callback. Mirrors Motion's `onHoverStart`/`onHoverEnd`.
    *
    * @param event - The pointer event that started or ended the hover.
    * @param info - `info.point` is the pointer position relative to the page.
    */
   export type MotionOnHoverStart = ((event: PointerEvent, info: EventInfo) => void) | undefined
   export type MotionOnHoverEnd = ((event: PointerEvent, info: EventInfo) => void) | undefined

   /**
    * Viewport callback. Mirrors Motion's `onViewportEnter`/`onViewportLeave`.
    *
    * @param entry - The IntersectionObserver entry that reported the change.
    */
   export type MotionOnViewportEnter = ViewportEventHandler | undefined
   export type MotionOnViewportLeave = ViewportEventHandler | undefined
   /** Alias of {@link MotionOnViewportEnter}, for the `onInViewStart` prop. */
   export type MotionOnInViewStart = ViewportEventHandler | undefined
   /** Alias of {@link MotionOnViewportLeave}, for the `onInViewEnd` prop. */
   export type MotionOnInViewEnd = ViewportEventHandler | undefined

   /**
    * Tap lifecycle callback. Mirrors Motion's `onTapStart`/`onTap`/`onTapCancel`.
    *
    * @param event - The originating pointer event (the press for `onTapStart`
    *   and for each `repeat`, the release otherwise).
    * @param info - `info.point` is the pointer position relative to the page.
    */
   export type MotionOnTapStart =
       ((event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void) | undefined
   export type MotionOnTap =
       ((event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void) | undefined
   export type MotionOnTapCancel =
       ((event: MouseEvent | TouchEvent | PointerEvent, info: TapInfo) => void) | undefined
   ```

3. In the props (lines 734–751), add after `onFocusEnd`:

   ```ts
   /** Called when the element enters the viewport, with the IntersectionObserver entry. Mirrors Motion. */
   onViewportEnter?: MotionOnViewportEnter
   /** Called when the element leaves the viewport, with the IntersectionObserver entry. Mirrors Motion. */
   onViewportLeave?: MotionOnViewportLeave
   ```

   Change the `onInViewStart` / `onInViewEnd` comments to
   "Alias of `onViewportEnter` (`onViewportLeave`), kept for existing code.
   Called right after it, with the same entry." Update the hover and tap
   comments to mention `(event, info)`.

In `src/lib/index.ts`:

- Add `MotionOnViewportEnter` and `MotionOnViewportLeave` to the
  `export type { … } from '$lib/types'` block (lines 186–215), in
  alphabetical position next to `MotionOnInViewStart`.
- Add one line next to line 172:
  `export type { EventInfo, TapInfo, ViewportEventHandler } from 'motion-dom'`,
  with a one-line comment: "Gesture callback argument types, as Motion exports
  them."

In `src/lib/html/_MotionContainer.svelte`:

- Destructure `onViewportEnter: onViewportEnterProp` and
  `onViewportLeave: onViewportLeaveProp` next to `onInViewStart`/`onInViewEnd`.
- Add both to the `inViewEnabled` latch:
  `latchInView(!!(whileInViewProp || onViewportEnterProp || onViewportLeaveProp || onInViewStartProp || onInViewEndProp))`.
- Add getters `get onViewportEnter() { return onViewportEnterProp }` and
  `get onViewportLeave() { return onViewportLeaveProp }` to the object passed
  to `createInViewGesture`.
- Change nothing else.

**Verify**:

- `pnpm check` → 0 errors. Existing zero-argument callbacks such as
  `onTap={() => count++}` in `src/routes/**` must still type-check. They do,
  because a function with fewer parameters is assignable.
- `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts src/lib/utils/gestures.spec.ts src/lib/index.spec.ts`
  → all pass, including the Step 2 tests.
- `PW_PORT=4224 pnpm exec playwright test e2e/motion/gesture-callback-args.spec.ts --project=chromium`
  → all 3 PASS.

### Step 6: Docs

`docs/src/routes/docs/gestures/+page.svx`:

- Line 41: list `onViewportEnter` / `onViewportLeave` instead of
  `onInViewStart` / `onInViewEnd`, then add a short subsection
  `### Callback arguments` right after that paragraph:
  - `onHoverStart`, `onHoverEnd`, `onTapStart`, `onTap` and `onTapCancel`
    receive `(event, info)`. `info.point` is the pointer's `{ x, y }` relative
    to the page. `onTapStart` gets the press event, `onTap` and `onTapCancel`
    the release (a `repeat` passes the press), as in Motion.
  - `onViewportEnter` / `onViewportLeave` receive the `IntersectionObserverEntry`.
  - `onInViewStart` / `onInViewEnd` still work as aliases, called right after
    the Motion names with the same entry.
  - `onFocusStart` / `onFocusEnd` take no arguments. They are a svelte-motion
    addition; Motion has no focus callbacks.
  - One example:

    ```svelte
    <motion.button
        whileTap={{ scale: 0.95 }}
        onTap={(event, info) => console.log(event.type, info.point.x, info.point.y)}
    >
        Tap me
    </motion.button>
    ```

- The hover example (lines 46–54): `onHoverStart={(event, info) => console.log('hover start at', info.point)}`.
- The in-view example (lines 160–174): use
  `onViewportEnter={(entry) => console.log('entered', entry?.intersectionRatio)}`
  and `onViewportLeave={() => console.log('left viewport')}`.

`docs/src/routes/docs/+page.svx` lines 194–202: switch the example to
`onViewportEnter` / `onViewportLeave`, and add one sentence after it:
"`onInViewStart` and `onInViewEnd` still work as aliases."

`docs/src/routes/docs/api-reference/+page.svx` lines 51–55: rename the group
comment to `// Gesture event handlers` and add `MotionOnViewportEnter`,
`MotionOnViewportLeave`, `EventInfo`, `TapInfo` and `ViewportEventHandler`.

**Verify**: `grep -n "onViewportEnter" docs/src/routes/docs/gestures/+page.svx docs/src/routes/docs/+page.svx docs/src/routes/docs/api-reference/+page.svx`
→ at least one match in each file. `trunk fmt` and `trunk check` on the three
files report no issues.

### Step 7: Regression suites

```bash
pnpm exec vitest run src/lib
PW_PORT=4224 pnpm exec playwright test e2e/motion e2e/armed-buttons e2e/lazy-motion e2e/variants --project=chromium
```

**Verify**: all pass. `e2e/motion/while-in-view.test.ts` and
`e2e/motion/transition-out-gestures.spec.ts` matter most, because the alias
timing moved from post-render to synchronous. For an e2e failure, re-run that
spec alone once. If it still fails and passes on plan 006's tip, STOP and
report.

### Step 8: Changeset

Create `.changeset/gesture-callback-args.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Gesture callbacks now receive Motion's arguments. `onHoverStart`, `onHoverEnd`, `onTapStart`, `onTap` and `onTapCancel` get `(event, info)`, with `info.point` the pointer's page position. The new `onViewportEnter` and `onViewportLeave` props get the `IntersectionObserverEntry`. `onInViewStart` and `onInViewEnd` keep working as aliases with the same entry. Viewport callbacks now run as soon as the observer reports, as in Motion, instead of after the next render. `EventInfo`, `TapInfo` and `ViewportEventHandler` are exported as types.
```

### Step 9: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, the e2e commands from Steps 3
and 7 once more, `trunk fmt` and `trunk check` on every in-scope file, then
`git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: the Step 1 attacher tests (hover, press, viewport) and the Step 2
  component tests 1, 2 and 4 fail on the code plan 006 leaves. Each callback
  is called with no arguments, and `onViewportEnter` is not a prop. They pass
  after Steps 4–5. The Step 3 e2e spec also fails first and passes after
  Step 5.
- New tests: 6 in `gestures.spec.ts`, 4 in `_MotionContainer.spec.ts`, 3 in
  `e2e/motion/gesture-callback-args.spec.ts`.
- Regression: all unit tests, plus the gesture, armed-buttons, lazy-motion and
  variants e2e suites. These guard the alias timing change and the
  `isDisabledButton` paths.
- Patterns: `gestures.spec.ts` existing hover, press and in-view blocks; plan
  006's component block; `e2e/motion/tap-options.spec.ts`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/gestures.spec.ts` exits 0
- [ ] `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 014"` → 4 passed
- [ ] `PW_PORT=4224 pnpm exec playwright test e2e/motion/gesture-callback-args.spec.ts --project=chromium` exits 0
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `grep -n "onViewportEnter" src/lib/types.ts src/lib/html/_MotionContainer.svelte src/lib/utils/gestures.ts` matches in all three files
- [ ] `grep -n "MotionOnViewportEnter\|ViewportEventHandler" src/lib/index.ts` matches
- [ ] `grep -nE "MotionOn(HoverStart|HoverEnd|InViewStart|InViewEnd|TapStart|Tap|TapCancel) = \(\(\) => void\)" src/lib/types.ts` prints nothing
- [ ] `grep -c "gesture-callback-args" src/routes/+page.svelte` prints `1`
- [ ] `grep -c "waitForTimeout" e2e/motion/gesture-callback-args.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 006 is not merged into your base (the prerequisite checks fail), or its
  in-view effect doesn't pass a getter-backed callbacks object to
  `createInViewGesture`.
- A new hover or press test in Step 1, or component tests 1, 2 and 4 in
  Step 2, pass before Step 4.
- `extractEventInfo` is not exported by the installed `motion-dom`
  (`grep -c "extractEventInfo" node_modules/motion-dom/dist/index.d.ts` prints `0`).
- `pnpm check` reports that an existing route or docs page passes a callback
  the new types reject (for example one that declares a required parameter
  of another type). Report the file. Don't widen the types to `any`.
- Any existing gesture spec fails after Step 4 and passes on plan 006's tip.
- `src/lib/index.spec.ts` fails because of the new type export.

## Maintenance notes

- Depends on 006 for the effect shape. This plan only adds two props to the
  in-view latch and getters. A reviewer should confirm that it didn't
  re-introduce a direct read of a callback prop in any effect body.
- `src/lib/index.ts` and `src/lib/types.ts` are shared, high-traffic files.
  Plan 013 (wave 1) edits JSDoc in `types.ts` around lines 1055–1066, far from
  the lines this plan changes. Expect a small rebase, not a conflict.
  `src/routes/+page.svelte` also gets one link from several plans in this
  batch.
- The aliases are deliberately not `@deprecated`. If the maintainer wants to
  steer users to the upstream names, a later minor release can add
  `@deprecated` to `onInViewStart` / `onInViewEnd` and their types. Removal
  would be a major release.
- The timing change (viewport callbacks now synchronous) is upstream
  behaviour. It is called out in the changeset in case a user wrote code that
  relied on the post-render delay.
- The generated per-tag feature lists in `src/lib/html/index.ts`
  (`scripts/generate-html.ts:63`) still omit most callbacks. That was left out
  here; regenerate them in a separate change.
- CLAUDE.md's feature checklist asks for a docs example under
  `docs/src/routes/examples/`. This plan aligns signatures and adds an
  upstream alias rather than a new behaviour, so it updates the existing docs
  pages and adds no new example.
