# Plan 002: Add the `tap` prop (count, hold, repeat), `globalTapTarget` and `propagate.tap` to motion components

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- src/lib/types.ts src/lib/utils/gestures.ts src/lib/utils/gestures.spec.ts src/lib/html/_MotionContainer.svelte docs/src/routes/docs/gestures docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts src/routes/+page.svelte`
> The only expected changes are plan 001's (pins, `src/lib/index.ts` press types, `src/routes/+page.svelte` one link). If anything else in these paths changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (it touches the gesture wiring in the 3,800-line `_MotionContainer.svelte`)
- **Depends on**: 001 (needs motion-dom 14.10.1's `press()` options and the `PressOptions`/`PointerEventOptions` type re-exports)
- **Wave**: 2
- **Category**: direction (upstream parity feature)
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

Motion 14.10.0 lets one prop turn the existing tap gesture into a double tap, a long press or an auto-repeating stepper. For example, `<motion.div tap={{ count: 2 }} onTap={…}>`. It was the headline feature of the release. Today our components:
- ignore `tap`;
- would also print it as a bogus `tap="[object Object]"` DOM attribute, because unknown props fall through to `...rest`.

Upstream merges `globalTapTarget` and `propagate.tap` into the same press options. We have never supported those two either (`grep -rn globalTapTarget src/lib` finds nothing), so this plan adds all three through one options object.

## Current state

- **Upstream reference** (local clone at `~/Github/motion`, tag `v14.10.1`). Read it with `git -C ~/Github/motion show v14.10.1:<path>`.
  - `packages/framer-motion/src/gestures/press.ts`, the whole `PressGesture` feature:
    ```ts
    private options: PointerEventOptions = {}   // kept, updated in place
    mount() {
        this.update()
        this.unmount = press(current, (_element, startEvent) => {
            handlePressEvent(this.node, startEvent, "Start")
            return {
                onComplete: (endEvent, { success }) =>
                    handlePressEvent(this.node, endEvent, success ? "" : "Cancel"),
                onRepeat: () => handlePressEvent(this.node, startEvent, "", true),
            }
        }, this.options)
    }
    update() {
        const { globalTapTarget, propagate, tap } = node.props
        for (const key in options) delete options[key]
        Object.assign(options, tap, {
            useGlobalTarget: globalTapTarget,
            stopPropagation: propagate?.tap === false,
        })
    }
    ```
  - `packages/framer-motion/src/gestures/hover.ts`, `handleGestureEvent(node, event, gesture, lifecycle, isRepeat)`. It runs `if (!isRepeat && node.animationState && props[whileKey]) setActive(whileKey, lifecycle === "Start")` and then fires the `on{gesture}{lifecycle}` callback. **A repeat fires `onTap` but leaves `whileTap` active.**
  - `packages/motion-dom/src/node/types.ts:546-569` documents the prop and its options:
    - `count`: quick consecutive presses needed for `onTap`. Default `1`.
    - `countTimeout`: max seconds between presses. Default `0.3`.
    - `hold`: seconds the press must be held for `onTap`. Default `0`.
    - `repeat`: while held, `onTap` fires every `repeat` seconds and `whileTap` stays active.
    - `onTapStart` and `whileTap` start on the first press. `onTap` fires only when the gesture completes; otherwise `onTapCancel` fires.
  - `packages/motion-dom/src/gestures/press/index.ts`. Options are read **on each press** (`:113-121`). The in-progress `count` sequence lives in a per-`press()`-call `WeakMap` (`:101`). **Detaching and re-attaching `press()` loses a half-finished double tap**, which is why upstream keeps one options object and mutates it.
  - Upstream tests to port: `packages/framer-motion/src/gestures/__tests__/press-options.test.tsx`.
  - Feature gate (unchanged): `framer-motion/src/motion/features/definitions.ts:15`, `tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"]`. `tap` alone does **not** enable the gesture.
- **Our press attacher**, `src/lib/utils/gestures.ts:126-147`:
  ```ts
  export const attachPressGesture = (element, visualElement, callbacks?: PressGestureCallbacks) => {
      const isDisabledButton = () => element instanceof HTMLButtonElement && element.disabled
      return press(element, () => {
          if (isDisabledButton()) return
          setGestureActive(visualElement, 'whileTap', true)
          postRender(callbacks?.onTapStart)
          return (_endEvent, { success }) => {
              if (isDisabledButton()) return
              setGestureActive(visualElement, 'whileTap', false)
              postRender(success ? callbacks?.onTap : callbacks?.onTapCancel)
          }
      })
  }
  ```
  `PressGestureCallbacks` (`:107-111`) is `{ onTapStart?, onTap?, onTapCancel? }`, all `() => void`.
- **Our gesture effect**, `src/lib/html/_MotionContainer.svelte:3538-3586`. One `$effect` attaches hover, press, focus and inView. It reads every gesture prop, so a change to *any* of them tears down and re-attaches *all* the listeners:
  ```ts
  $effect(() => {
      if (!(element && visualElement && isLoaded === 'ready' && hasGestureFeatures)) return
      ...
      if (whileTapProp || onTapStartProp || onTapProp || onTapCancelProp) {
          cleanups.push(attachPressGesture(target, node, {
              onTapStart: onTapStartProp, onTap: onTapProp, onTapCancel: onTapCancelProp
          }))
      }
      ...
  })
  ```
- **Prop destructuring**, `_MotionContainer.svelte:182-249`. `onTapStart: onTapStartProp, onTap: onTapProp, onTapCancel: onTapCancelProp` sit at `:220-222`. Anything not destructured lands in `...rest` and is spread onto the DOM element.
- **Prop types**, `src/lib/types.ts:621` `export type MotionProps = {`. The tap callbacks are at `:708-713`:
  ```ts
  /** Called when a tap gesture starts (pointerdown recognized) */
  onTapStart?: MotionOnTapStart
  /** Called when a tap gesture ends successfully (pointerup) */
  onTap?: MotionOnTap
  /** Called when a tap gesture is cancelled (pointercancel) */
  onTapCancel?: MotionOnTapCancel
  ```
  `types.ts:4-9` imports types from `'motion-dom'`. Plan 001 re-exports `PressOptions` etc. from `src/lib/index.ts`.
- **Tests to copy**:
  - Unit: `src/lib/utils/gestures.spec.ts`, the `describe('attachPressGesture')` block around `:123-208`. It uses the helpers `makeNode`, `pointer()` and `flushPostRender`.
  - Markup check: `src/lib/components/tapTabindex.spec.ts` with `src/lib/components/__tests__/TapTabindexProbe.svelte`.
  - e2e: `e2e/motion/rapid-tap.test.ts` (the `readScale` helper) and `e2e/motion/hover-and-tap.test.ts`.
  - Tester page: `src/routes/tests/motion/rapid-tap/+page.svelte`.
- **Docs**:
  - `docs/src/routes/docs/gestures/+page.svx` has `## whileTap` at `:59` and `### Tuning the tap transition` at `:80`.
  - The example and docs-registration pattern to copy is `transition-mixer`. Run `grep -rn "transition-mixer" docs/src --include=*.ts --include=*.svelte --include=*.svx` to find every registration point: `docs/src/lib/docsNav.ts:92`, `docs/src/lib/examplesIndex.ts:256`, and the example route `docs/src/routes/examples/transition-mixer/+page.svelte` with its demo `docs/src/lib/examples/transition-mixer/demos/Default.svelte`.
  - Docs import with `#lib/....js` specifiers, never `$lib`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| One e2e file | `PW_PORT=4242 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check` | exit 0, 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `src/lib/utils/gestures.ts` (`attachPressGesture` and `PressGestureCallbacks` only)
- `src/lib/utils/gestures.spec.ts`
- `src/lib/types.ts` (three new props in `MotionProps`, next to `onTapCancel`)
- `src/lib/html/_MotionContainer.svelte` (destructuring, plus the press part of the gesture effect)
- `src/lib/components/__tests__/TapOptionsProbe.svelte` (create) and `src/lib/components/tapOptions.spec.ts` (create)
- `src/routes/tests/motion/tap-options/+page.svelte` (create) and `e2e/motion/tap-options.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `docs/src/routes/docs/gestures/+page.svx` (one new subsection under `## whileTap`)
- `docs/src/routes/examples/tap-options/+page.svelte`, `docs/src/lib/examples/tap-options/demos/Default.svelte` (create)
- `docs/src/lib/docsNav.ts`, `docs/src/lib/examplesIndex.ts` (one entry each, only if `transition-mixer` registers in them)
- `.changeset/tap-options.md` (create)

**Out of scope:**
- Hover, focus and inView attach logic. Leave their code in the shared effect untouched, except for removing the press block.
- `src/lib/index.ts` (plan 001 already exports the press types).
- `DragControls` JSDoc in `src/lib/types.ts` (plan 005 edits `:585-602`). Edit only next to `onTapCancel`.
- Drag cancelling a press `count` sequence. motion-dom does this internally through the global drag lock, which our drag already uses. Test it (Step 5); do not port it.

## Git workflow

- Lane branch `lane/14101-tap`, cut from `feat/motion-14.10.1` after plan 001 is merged.
- Use conventional commits, for example `test(gestures): tap count/hold/repeat options (red)` and `feat(gestures): tap prop with count, hold and repeat`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Write failing tests

1. **In `src/lib/utils/gestures.spec.ts`**, inside `describe('attachPressGesture')`, add the cases below. They call `attachPressGesture(element, node, callbacks, options)` with a 4th `options` argument, which doesn't exist yet. Keep `vi.useRealTimers()` and use real waits (`await new Promise((r) => setTimeout(r, ms))`).
   - "count: 2 fires onTap only on the second press". Use `onTapStart` (expect 1 call), `onTap` (0 after the first press, 1 after the second) and `setActive('whileTap', true)` on the first pointerdown.
   - "count: 2 cancels when the second press is too late". Set `countTimeout: 0.05` and wait 120 ms. Expect `onTapCancel` once and `onTap` never.
   - "hold: 0.05 cancels on early release, succeeds when held".
   - "repeat: 0.03 fires onTap while held without deactivating whileTap". Hold for about 120 ms. Expect `onTap` at least twice before release, and no `setActive('whileTap', false)` until pointerup.
   - "options are read per press". Mutate `options.count = 2` after attaching. The next tap needs two presses.
2. **Create `src/lib/components/__tests__/TapOptionsProbe.svelte`**: a `motion.button` with `data-testid="btn"`, `tap={{ count: 2 }}`, `globalTapTarget={false}` and `propagate={{ tap: true }}`.
3. **Create `src/lib/components/tapOptions.spec.ts`**: render the probe and assert that `btn` has no `tap`, `globaltaptarget` or `propagate` attribute (`getAttribute(...)` is `null`). Copy `tapTabindex.spec.ts`.

**Verify**:
- `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → the new cases FAIL (options are ignored, so `onTap` fires on the first press).
- `pnpm exec vitest run src/lib/components/tapOptions.spec.ts` → FAILS with an attribute present, or with a type error on unknown props.

### Step 2: Support options and repeats in `attachPressGesture`

In `src/lib/utils/gestures.ts`:
- Add an optional 4th parameter `options?: PointerEventOptions` (type import from `motion-dom`) and pass it as `press()`'s third argument.
- Make the start callback return a handlers object instead of a function:
  ```ts
  return {
      onComplete: (_endEvent, { success }) => {
          if (isDisabledButton()) return
          setGestureActive(visualElement, 'whileTap', false)
          postRender(success ? callbacks?.onTap : callbacks?.onTapCancel)
      },
      // Upstream hover.ts `isRepeat`: fire onTap, keep whileTap active.
      onRepeat: () => {
          if (isDisabledButton()) return
          postRender(callbacks?.onTap)
      }
  }
  ```
- Read callbacks at event time (`callbacks?.onTap`) and never capture them earlier. Step 3 passes a getter-backed object.
- Update the JSDoc: cite `framer-motion/src/gestures/press.ts` and `hover.ts` at v14.10.1, and document `@param options`.

**Verify**: `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → all PASS, old and new.

### Step 3: Wire the props in `_MotionContainer.svelte`

1. In `src/lib/types.ts`, directly after `onTapCancel?: MotionOnTapCancel`, add three props with JSDoc adapted from upstream `node/types.ts:521-569` and examples in Svelte syntax:
   ```ts
   tap?: PressOptions
   globalTapTarget?: boolean
   propagate?: { tap?: boolean }
   ```
   Import `PressOptions` as a type from `'motion-dom'` in the existing import block (`:4-9`).
2. In the destructuring (`:182-249`), add `tap: tapProp`, `globalTapTarget: globalTapTargetProp` and `propagate: propagateProp` next to `onTapCancel: onTapCancelProp`, so they never reach `rest`.
3. Next to the gesture effect, create **one** options object for the component's lifetime and keep it in sync in its own effect, mirroring upstream `update()`:
   ```ts
   const pressOptions: PointerEventOptions = {}
   $effect.pre(() => {
       for (const key in pressOptions) delete pressOptions[key as keyof PointerEventOptions]
       Object.assign(pressOptions, tapProp, {
           useGlobalTarget: globalTapTargetProp,
           stopPropagation: propagateProp?.tap === false
       })
   })
   ```
4. Move the press block **out of** the shared gesture effect into its own `$effect`:
   - Gate it on a `$derived` boolean: `const hasTapGesture = $derived(!!(whileTapProp || onTapStartProp || onTapProp || onTapCancelProp))`.
   - Keep the same readiness guard as the shared effect: `element && visualElement && isLoaded === 'ready' && hasGestureFeatures`.
   - Pass callbacks as getters, so a new callback identity doesn't re-attach `press()` and lose a half-finished `count` sequence:
     ```ts
     attachPressGesture(target, node, {
         get onTapStart() { return onTapStartProp },
         get onTap() { return onTapProp },
         get onTapCancel() { return onTapCancelProp }
     }, pressOptions)
     ```
   - Add a comment citing upstream `press.ts:23-27` ("press() reads its options on each press, so this object is kept and updated in place").
5. Leave hover, focus and inView in the shared effect, unchanged.

**Verify**:
- `pnpm check` → 0 errors
- `pnpm exec vitest run src/lib/components/tapOptions.spec.ts src/lib/components/tapTabindex.spec.ts src/lib/utils/gestures.spec.ts` → all PASS

### Step 4: Tester page and e2e

1. **Create `src/routes/tests/motion/tap-options/+page.svelte`** with three `motion.button`s, each with `whileTap={{ scale: 0.9 }}`, a counter, and a `TesterPanel` step:
   - `data-testid="double"` with `tap={{ count: 2 }}`. Counters `double-tap` and `double-cancel`. Expected: "one click does nothing; a quick double click counts 1".
   - `data-testid="long"` with `tap={{ hold: 0.5 }}`. Counters `long-tap` and `long-cancel`. Expected: "a short click counts a cancel; holding half a second counts 1".
   - `data-testid="stepper"` with `tap={{ repeat: 0.1 }}`. Counter `stepper-value`. Expected: "holding increases the value about 10 per second and the button stays pressed (scaled)".
   Copy the layout from `src/routes/tests/motion/rapid-tap/+page.svelte`.
2. **Create `e2e/motion/tap-options.spec.ts`**. The header comment cites upstream `press-options.test.tsx` at v14.10.1. Use `page.mouse.move/down/up` on element centres and `page.waitForTimeout` for holds. Tests:
   - double: one click gives `double-tap` 0; two clicks 100 ms apart give 1.
   - long: down, 100 ms, up gives `long-cancel` 1 and `long-tap` 0; down, 700 ms, up gives `long-tap` 1.
   - stepper: down, 550 ms, then read `stepper-value` (≥ 3) and the computed scale while held (< 1, using the `readScale` helper from `e2e/motion/rapid-tap.test.ts`); then up.
   - keyboard: focus `double`, press Enter twice quickly, expect `double-tap` 1. (motion-dom's `press()` handles keyboard, as `gestures.ts:115-120` notes.)
3. Link the page from `src/routes/+page.svelte` next to `/tests/motion/rapid-tap`.

**Verify**: `PW_PORT=4242 pnpm exec playwright test --project=chromium e2e/motion/tap-options.spec.ts` → all PASS.

### Step 5: Drag cancels a count sequence (test only)

In `src/lib/utils/gestures.spec.ts`, add "a drag starting during a count sequence cancels it":
- Attach with `{ count: 2 }`. Run pointerdown, pointerup, pointerdown.
- Call `setDragLock(true)` (already imported in that file), then dispatch a `pointermove` on `window`.
- Expect `onTapCancel` called once. Release the lock in `finally`.

This mirrors upstream `motion-dom/src/gestures/drag/__tests__/press-interop.test.ts` and `press/index.ts:301-325`.

**Verify**: `pnpm exec vitest run src/lib/utils/gestures.spec.ts` → PASS. If it fails, STOP and report. Don't add Svelte-side drag hooks.

### Step 6: Docs and example

1. In `docs/src/routes/docs/gestures/+page.svx`, add `### Double tap, long press and repeat` after `### Tuning the tap transition`. It needs:
   - A table of the four `tap` options with defaults.
   - Three short Svelte snippets, ported from the upstream JSDoc examples.
   - Notes that `onTapStart`/`whileTap` start on the first press, `onTap` fires on completion and each repeat, and `onTapCancel` fires otherwise.
   - A paragraph on `globalTapTarget` and `propagate={{ tap: false }}`.
   - A link to `/examples/tap-options`.
2. Create the example route and demo by copying the `transition-mixer` pair. The demo has the three buttons (double-tap heart, long-press delete, ± stepper), styled like the existing `docs/src/lib/examples/hover-and-tap` demos.
3. Register the example wherever `transition-mixer` is registered (see the grep in "Current state").

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check` → exit 0, 0 errors. Revert any change to `docs/static/r/animated-tabs.json`.

### Step 7: Changeset and full gate

1. Create `.changeset/tap-options.md` with frontmatter `'@humanspeak/svelte-motion': minor`. The body: "Add the `tap` prop (`count`, `countTimeout`, `hold`, `repeat`) for double tap, long press and auto-repeat, plus `globalTapTarget` and `propagate={{ tap: false }}`, matching Motion 14.10."
2. Run `pnpm check`, `pnpm test:only` and the full chromium e2e. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; e2e has no new failures. In particular `e2e/armed-buttons/*`, `e2e/motion/rapid-tap.test.ts` and `e2e/motion/hover-and-tap.test.ts` must pass.

## Test plan

- **Red first**: the `attachPressGesture` option cases and the attribute-leak probe fail before Steps 2–3.
- **New**: 6 unit cases in `gestures.spec.ts`, 1 component spec, and 4 e2e tests.
- **Regression net**: the existing `gestures.spec.ts`, `tapTabindex.spec.ts`, `e2e/armed-buttons/*` (keyboard taps, #414) and the rapid-tap/hover-and-tap specs.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including the new cases
- [ ] `PW_PORT=4242 pnpm exec playwright test --project=chromium e2e/motion/tap-options.spec.ts e2e/armed-buttons e2e/motion/rapid-tap.test.ts` → all pass
- [ ] `grep -n "tap: tapProp" src/lib/html/_MotionContainer.svelte` → 1 match
- [ ] `grep -n "attachPressGesture" src/lib/html/_MotionContainer.svelte` → exactly 1 call, in its own `$effect`
- [ ] `pnpm --dir docs build && pnpm --dir docs check` → exit 0
- [ ] Only in-scope files changed

## STOP conditions

- `press()` from the installed motion-dom does not accept `count`/`hold`/`repeat`. Plan 001 is not merged.
- Moving the press block out of the shared effect breaks an existing e2e test (rapid-tap, armed-buttons, hover-and-tap, transition-out gestures).
- `propagate` turns out to be destructured or used elsewhere in `_MotionContainer.svelte` for another meaning. `grep -n "propagate" src/lib/html/_MotionContainer.svelte` should show only a comment near `:810`.
- `$effect.pre` ordering means the first press sees empty options. Report it; don't switch to reading `tapProp` inside the attach effect.

## Maintenance notes

- Keep the press attach effect independent of callback identity and of the `tap` object. Re-attaching `press()` silently resets a half-finished double tap or hold.
- If upstream adds more `PressOptions`, they flow through automatically via `Object.assign(pressOptions, tapProp, …)`.
- Reviewer: check that a `tap` change between presses takes effect on the next press with no listener churn.
