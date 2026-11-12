# Plan 004: `pinch` prop, `whilePinch` and the `pinchFeatures` bundle on motion components

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4264**. Prefix every Playwright command with `PW_PORT=4264`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat ec3565ab..HEAD -- src/lib/features src/lib/components/LazyMotion.svelte src/lib/utils/visualElementCore.ts src/lib/html/_MotionContainer.svelte src/lib/types.ts src/lib/index.ts src/routes/tests/pinch e2e/pinch tests/consumer-vite6/verify-tree-shaking.mjs`
> The only expected change is plan 001's edit to `src/lib/index.ts` (a `pinch` export and a pinch types block). If anything else changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.
>
> **Revision 2026-11-12, second (guard)**: steps 1-5 are done and merged on `feat/motion-14.12.0` (`e4449617`). The three ported tests that were red at step 5 are green since plan 006 (`ff15b87c`): `pnpm exec vitest run src/lib/components/pinch.spec.ts` → 23 passed. **Resume at step 6** and finish steps 6-8. Do not redo steps 1-5. Plan 003 is merged too: `src/routes/+page.svelte` already has the "Pinch (Motion 14.11)" section, so add your link to that section instead of creating it, and `e2e/pinch/_helpers.ts` exists (exports `frames`, `rect`, `touch`, `twoFinger`; `touch` takes an optional `id` per point), so import from it in `e2e/pinch/prop.spec.ts` instead of defining local helpers. The drift check no longer applies; skip it.
>
> **Revision 2026-11-12 (guard)**: drift baseline moved from `82bf6e74` to `ec3565ab`, the branch tip after plan 001 merged. Plan 001 edited `src/lib/index.ts` as this plan expects: `pinch` is in the `from 'motion'` block and a pinch types block follows the press types block, so every `src/lib/index.ts` line number quoted below is about 16 lines lower than the live file. Find the anchors by their text, not by line number. With the new baseline the drift check should print nothing. Work on the branch your worktree is already on; ignore the `lane/14120-pinch-prop` branch name.

## Status

- **Priority**: P1 (the headline feature of the release)
- **Effort**: L
- **Risk**: MED. It touches `_MotionContainer.svelte` (the component every motion element renders through) and the public `FeatureBundle` type.
- **Depends on**: 001-bump-motion-14-12-0.md (`addPinchListeners`, `PinchProps` and the `whilePinch` animation type only exist in motion-dom 14.12.0)
- **Wave**: 2
- **Category**: direction (net-new upstream feature)
- **Planned at**: commit `82bf6e74`, 2026-11-12; re-stamped at `ec3565ab` after plan 001

## Why this matters

Motion 14.11 added a `pinch` prop to motion components: two touches (or a trackpad pinch, or Safari's gesture events) scale, rotate and move the element, with limits that resist and spring back, rotation that snaps, and a `whilePinch` state like `whileDrag`. Upstream ships it as an opt-in feature bundle, `pinchFeatures`, loaded through `LazyMotion`, so apps that never pinch do not pay its ~8.5 kB. This plan ports the prop, the `whilePinch` state and the bundle to svelte-motion with the same API:

```svelte
<LazyMotion features={{ ...domMax, ...pinchFeatures }}>
    <motion.div drag pinch={{ scale: { min: 1, max: 4 }, rotate: { snap: 90 } }} />
</LazyMotion>
```

## Current state

### Upstream (read with `git -C ~/Github/motion show v14.12.0:<path>`)

- `packages/framer-motion/src/gestures/pinch.ts` (84 lines): `PinchGesture extends Feature<Element>`. In `mount()` it calls motion-dom's `addPinchListeners(element, getValues, getEnabledOptions, onPinchStart)`:
  - `getValues` returns the node's `scale`, `rotate`, `x`, `y` motion values: `['scale','rotate','x','y'].map((key) => this.node.getValue(key, key === 'scale' ? 1 : 0))`.
  - `getEnabledOptions` reads `this.node.getProps().pinch` each time: `pinch && (options = pinch === true ? {} : pinch)`. Returning a falsy value disables the gesture and ends one in progress.
  - `onPinchStart` calls `this.node.animationState?.setActive('whilePinch', true)`, then the prop's `onStart`, and returns `{ onPinch: <prop onMove>, onComplete: <setActive false, then prop onEnd> }`. The callbacks are looked up on the latest options at call time, so they can change mid-gesture.
  - `mount()` and `update()` also write `element.style.touchAction`: the `style` prop's `touchAction` if set, otherwise `"none"`, while `pinch` is truthy; the value captured at mount otherwise.
  - `this.unmount` is replaced by the function `addPinchListeners` returns.
- `packages/framer-motion/src/render/dom/features-pinch.ts`: `pinchFeatures = { renderer, pinch: { Feature: PinchGesture, isEnabled: (props) => !!props.pinch } }`. Its JSDoc: "Not part of `motion` components or the `domMax` bundle, so load it on its own or alongside them".
- `packages/motion-dom/src/node/types.ts`: `pinch?: boolean | PinchProps` and `whilePinch?: VariantLabels | TargetAndTransition` on `MotionNodeOptions`. `PinchProps` is `PinchOptions` plus `onStart`, `onMove`, `onEnd` (each `(event: Event, info: PinchInfo) => void`).
- `packages/motion-dom/src/render/utils/variant-props.ts`: `variantPriorityOrder` gains `"whilePinch"` after `"whileDrag"`. motion-dom's `createAnimationState` (which we use unchanged) reads that list, so priority arrives with the pin.
- `packages/framer-motion/src/motion/features/definitions.ts:9`: the animation feature is enabled by `["variants", ...variantPriorityOrder]`, so `whilePinch` alone enables it.
- Upstream tests: unit `packages/framer-motion/src/gestures/__tests__/pinch.test.tsx` (20 tests), fixture `dev/react/src/tests/pinch-while.tsx`, browser spec `tests/react/pinch.spec.ts` (7 tests).

### svelte-motion

- `src/lib/features/index.ts:5-14`, the bundle type (flags, not feature classes):
  ```ts
  export type FeatureBundle = {
      /** Enables initial/animate/exit animation behavior. */
      animations: true
      /** Enables hover, tap, focus, pan, and in-view gesture behavior. */
      gestures?: true
      /** Enables drag gesture behavior. */
      drag?: true
      /** Enables layout and shared-layout animation behavior. */
      layout?: true
  }
  ```
  `src/lib/features/domMax.ts` is `{ ...domAnimation, drag: true, layout: true }`. The `animations` flag is never read anywhere: any loaded bundle enables animations.
- `src/lib/components/LazyMotion.svelte:32-35` holds the loaded bundle in `$state`; `:47-76` is the effect that sets it (synchronously for an eager bundle, in `.then` for an async loader).
- `src/lib/html/_MotionContainer.svelte`:
  - `:182-250` destructures every motion prop out of `$props()`. Anything not destructured lands in `...rest` and is spread onto the DOM element. `whileDrag: whileDragProp` is at `:208`, `drag: dragProp` at `:228`.
  - `:279-299`, feature gating:
    ```ts
    const lazyMotion = getLazyMotionContext()
    …
    const activeFeatures = $derived(motionKindProp === 'm' ? lazyMotion?.getFeatures() : domMax)
    …
    const hasGestureFeatures = $derived(!!activeFeatures?.gestures)
    const hasDragFeatures = $derived(!!activeFeatures?.drag)
    const hasLayoutFeatures = $derived(!!activeFeatures?.layout)
    ```
    A `motion.*` component ignores `LazyMotion` and always gets `domMax`; an `m.*` component gets the nearest `LazyMotion`'s bundle.
  - `:636-744`, `buildMotionNodeProps`: the props handed to the motion-dom VisualElement. `whileDrag: filterReducedMotionDefinition(whileDragProp)` is at `:680`. The drag props are added only under `...(hasDragFeatures ? { drag: dragProp, … } : {})` at `:703-722`.
  - `:1249-1258`, the `isControllingVariants({ animate, initial, whileHover, whileTap, whileFocus, whileInView, whileDrag })` call.
  - `:1741-1751`, the declarative drag styles and the inline style string:
    ```ts
    const upstreamDragDefaultStyle = $derived(
        dragProp && dragListenerProp !== false
            ? `user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:${dragProp === true ? 'none' : `pan-${dragProp === 'x' ? 'y' : 'x'}`}`
            : ''
    )
    const inlineStyleBaseWithHolds = $derived(
        `${… serializedStyleProp …}${upstreamDragDefaultStyle ? `;${upstreamDragDefaultStyle}` : ''}${waitEnterBlockedBeforeMount || waitHiddenDisplay !== null ? ';display:none' : ''}`
    )
    ```
    Svelte rewrites the whole `style` attribute from this string whenever it changes.
  - `:2297` and `:2388` call `node.updateFeatures()` after the VisualElement's props are updated.
- `src/lib/utils/visualElementCore.ts`:
  - `:75-84`, `ANIMATION_FEATURE_PROPS` (a hand-kept list): `'animate','variants','whileHover','whileTap','exit','whileInView','whileFocus','whileDrag'`.
  - `:313-416`, `DragGestureFeature`, the model for a ported feature. Note its "Svelte deviation 1": a feature can be instantiated before `this.node.current` exists, so listener attachment is retried in `update()`.
  - `:611-632`, `registerMotionFeatures()`: merges our feature definitions into motion-dom's global registry with `setFeatureDefinitions({ ...getFeatureDefinitions(), animation: …, exit: …, drag: …, pan: … })`, once.
- `src/lib/types.ts`: `MotionWhileDrag` at `:369-381`; `whileDrag?: MotionWhileDrag` at `:671`; `style?: string | MotionStyle` at `:791`; `:4-10` imports types from `'motion-dom'`.
- `src/lib/index.ts:14-17` exports the bundles (`domAnimation`, `domMax`, `domMin`); `:191` exports `MotionWhileDrag` in a types block.
- `tests/consumer-vite6/verify-tree-shaking.mjs` bundles entry snippets through the package `exports` map and asserts marker strings are present or absent.

### Design decisions already made (do not revisit)

1. **`FeatureBundle` gains `pinch?: <feature definition>`, and `animations` becomes optional.** `pinchFeatures` is `{ pinch: { Feature: PinchGestureFeature, isEnabled } }`. Carrying the class in the bundle (instead of a `true` flag) is what keeps `addPinchListeners` out of bundles that never import `pinchFeatures`.
2. **`LazyMotion` registers the pinch feature** in motion-dom's global registry when it publishes a bundle that has `pinch` (upstream's `loadFeatures`).
3. **Per-node gating uses the nearest `LazyMotion`**, for both kinds: an `m.*` component uses its bundle as today; a `motion.*` component gets `domMax` as today **plus** `pinch` when the nearest `LazyMotion`'s loaded bundle has it. A `motion.div pinch` outside any `LazyMotion` does not pinch, as upstream documents.
4. **`touch-action` is declarative.** The container appends `touch-action:<value>` to the inline style string. The ported feature does **not** write `element.style.touchAction`, because Svelte's next rewrite of the `style` attribute would erase it, and a write captured at mount would restore a stale value. (Svelte deviation; document it in the feature's JSDoc.)

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| Build + package | `pnpm build && pnpm package` | exit 0 |
| Consumer checks | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | exit 0 |
| One e2e file | `PW_PORT=4264 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Trunk is the lint and format authority; do not run `prettier` or `eslint` directly.

## Scope

**In scope:**
- `src/lib/utils/pinchFeature.ts` (create) and `src/lib/utils/pinchFeature.spec.ts` (create)
- `src/lib/features/pinchFeatures.ts` (create), `src/lib/features/index.ts`, `src/lib/features/index.spec.ts`
- `src/lib/components/LazyMotion.svelte`
- `src/lib/utils/visualElementCore.ts`: `ANIMATION_FEATURE_PROPS` only
- `src/lib/types.ts`: a `MotionWhilePinch` type and two props on `MotionProps`
- `src/lib/index.ts`: export `pinchFeatures` and `MotionWhilePinch`
- `src/lib/html/_MotionContainer.svelte`: destructuring, gating, node props, the `isControllingVariants` call, the inline style string
- `src/lib/components/__tests__/PinchProbe.svelte` (create) and `src/lib/components/pinch.spec.ts` (create)
- `src/routes/tests/pinch/prop/+page.svelte` (create) and `e2e/pinch/prop.spec.ts` (create)
- `src/routes/+page.svelte` (one link, in a "Pinch (Motion 14.11)" section)
- `tests/consumer-vite6/verify-tree-shaking.mjs` (two assertions)
- `.changeset/pinch-prop.md` (create)

**Out of scope:**
- `src/lib/features/domMax.ts`, `domAnimation.ts`, `domMin.ts`. Pinch is not part of any of them.
- `DragGestureFeature`, `PanGestureFeature` and `registerMotionFeatures` in `visualElementCore.ts`.
- Gating the animation feature on the bundle's `animations` flag (see Maintenance notes).
- `src/routes/tests/pinch/vanilla/` and `e2e/pinch/vanilla.spec.ts` (plan 003), docs (plan 005).
- `Reorder/**`.

## Git workflow

- Lane branch `lane/14120-pinch-prop`, cut from `feat/motion-14.12.0` after plan 001 is merged.
- Conventional commits, for example `test(pinch): pinch prop and whilePinch (red)` and `feat(pinch): pinch prop, whilePinch and pinchFeatures (Motion 14.11)`.
- Do not push.

## Steps

### Step 1: Write the unit tests first

They fail now because the props, the bundle and the feature do not exist.

1. `src/lib/utils/pinchFeature.spec.ts`:
   - `resolvePinchTouchAction(style)`: `undefined` → `'none'`; `'color: red'` → `'none'`; `'touch-action: pan-y; color: red'` → `'pan-y'`; `{ touchAction: 'pan-y' }` → `'pan-y'`; `{ 'touch-action': 'pan-x' }` → `'pan-x'`; `{ scale: <a motion value> }` → `'none'`.
   - `isPinchFeatureEnabled`: `{ pinch: true }` and `{ pinch: {} }` → true; `{}` and `{ pinch: false }` → false.
   - `loadPinchFeature(definition)`: after the call, `getFeatureDefinitions().pinch` (from `'motion-dom'`) is the definition and the other keys already registered are unchanged; calling it twice is harmless.
2. `src/lib/features/index.spec.ts`: `pinchFeatures.pinch.Feature` is `PinchGestureFeature`; `{ ...domMax, ...pinchFeatures }` has `drag`, `layout`, `gestures`, `animations` and `pinch`; `domMax` has no `pinch` key.
3. `src/lib/components/__tests__/PinchProbe.svelte` and `src/lib/components/pinch.spec.ts`: a port of upstream's `pinch.test.tsx`. The probe takes props for the kind (`motion` or `m`), the `features` bundle (or none: render without `LazyMotion`), `strict`, `pinch`, `whilePinch`, `variants`, `drag`, `style`, and renders one element with `data-testid="box"` and an optional `m.div` child with `data-testid="child"`. Copy upstream's `pointer()` and `spread()` helpers verbatim (jsdom puts every element's centre at the origin, which they rely on). Use real timers and the 16 ms `requestAnimationFrame` replacement from `src/lib/utils/animate.spec.ts:12-20`; define `nextFrame` on `frame.postRender` from `'motion-dom'`. Model the render/cleanup boilerplate on `src/lib/components/tapOptions.spec.ts`, but do **not** copy its `vi.mock('motion', …)` or fake timers. Port these upstream tests by name:
   - "m component scales with pinchFeatures loaded" (also `style.touchAction === 'none'`)
   - "motion component scales with pinchFeatures loaded"
   - "motion component scales with only pinchFeatures loaded"
   - "m component scales with only pinchFeatures loaded" (`strict`)
   - "passes options and callbacks"
   - "calls onStart, onMove and onEnd once per gesture, with info"
   - "uses the latest callbacks mid-gesture"
   - "uses the latest options"
   - "pinch={false} doesn't pinch"
   - "pinch={false} gives the page its touch gestures back"
   - "keeps touch gestures off when drag's axis changes"
   - "keeps a touch-action set in style, so a pinchable list can scroll"
   - "pinch={false} mid-gesture ends it"
   - "removes listeners on unmount"
   - "isn't forwarded to the DOM" (both: no `pinch` and no `whilepinch`/`whilePinch` attribute)
   - "animates while pinching and back on release"
   - "variant labels propagate to children"
   - "pinch={false} mid-gesture ends whilePinch"
   - "scale resists past max and springs back on release"
   
   Add three of ours:
   - "a motion component outside LazyMotion doesn't pinch" (scale stays 1, `style.touchAction` is not `none`)
   - "an m component under domMax without pinchFeatures doesn't pinch"
   - "pinch turned on after mount attaches" (render with `pinch={false}`, rerender with `pinch`, spread, scale ≈ 2)

**Verify**: `pnpm exec vitest run src/lib/utils/pinchFeature.spec.ts src/lib/features/index.spec.ts src/lib/components/pinch.spec.ts` → the new tests FAIL (missing modules or props). Commit: `test(pinch): pinch prop and whilePinch (red)`.

### Step 2: The feature module

Create `src/lib/utils/pinchFeature.ts`. Imports come from `'motion-dom'`: `Feature`, `addPinchListeners`, `getFeatureDefinitions`, `setFeatureDefinitions`, and the types `FeatureDefinitions`, `MotionNodeOptions`, `OnPinchEvent`, `PinchProps`, `PinchValues`, `VisualElement`. Export, each with Google-style JSDoc (`@param`, `@returns`, `@example`), matching the JSDoc style of `DragGestureFeature`:

- `class PinchGestureFeature extends Feature<Element>`: a port of upstream `gestures/pinch.ts` at v14.12.0 (cite it), with two documented Svelte deviations:
  1. Attachment is idempotent and retried: a private `attach()` returns early when listeners are already attached or `this.node.current` is missing; `mount()` and `update()` both call it. `unmount()` calls the stored remove function and clears it.
  2. No `touchAction` writes (design decision 4).
  
  Keep upstream's behaviour otherwise: the `call(key)` indirection so `onStart`/`onMove`/`onEnd` are read from the latest options, `setActive('whilePinch', true)` before `onStart`, and `setActive('whilePinch', false)` before `onEnd`.
- `isPinchFeatureEnabled = (props: MotionNodeOptions): boolean => !!props.pinch`
- `type PinchFeatureDefinition = NonNullable<FeatureDefinitions['pinch']>`
- `loadPinchFeature(definition: PinchFeatureDefinition): void`: `setFeatureDefinitions({ ...getFeatureDefinitions(), pinch: definition })`, skipped when `getFeatureDefinitions().pinch === definition`.
- `resolvePinchTouchAction(style: string | Record<string, unknown> | undefined): string`: the `touch-action` the user's `style` prop sets (a string style: match `/(?:^|;)\s*touch-action\s*:\s*([^;]+)/i` and trim; an object style: a string `touchAction` or `'touch-action'` entry), otherwise `'none'`.

**Verify**: `pnpm exec vitest run src/lib/utils/pinchFeature.spec.ts` → PASS.

### Step 3: The bundle and `LazyMotion`

1. `src/lib/features/index.ts`: make `animations` optional (`animations?: true`) and add
   ```ts
   /** Enables the `pinch` prop. Only `pinchFeatures` provides it. */
   pinch?: PinchFeatureDefinition
   ```
   importing the type from `$lib/utils/pinchFeature` with `import type`.
2. Create `src/lib/features/pinchFeatures.ts`, modelled on `domMax.ts`, with JSDoc ported from upstream's `features-pinch.ts` (Svelte snippets):
   ```ts
   export const pinchFeatures: FeatureBundle = {
       pinch: { Feature: PinchGestureFeature as never, isEnabled: isPinchFeatureEnabled }
   }
   ```
   (`as never` matches how `registerMotionFeatures` casts feature classes.)
3. `src/lib/components/LazyMotion.svelte`: call `loadPinchFeature(bundle.pinch)` whenever a bundle with `pinch` is published. Three places: during init for an eager bundle (next to the `untrack` at `:32-35`, so it runs before any child component is created), in the effect's eager branch (`:50-54`), and in the `.then` (`:59-63`) **before** `loadedFeatures` is assigned.
4. `src/lib/index.ts`: add `export { pinchFeatures } from '$lib/features/pinchFeatures'` after the `domMin` export.

**Verify**: `pnpm exec vitest run src/lib/features/index.spec.ts` → PASS. `pnpm check` → 0 errors (if making `animations` optional breaks a type elsewhere, fix the use site only if it is a type annotation; a runtime read of `.animations` is a STOP).

### Step 4: Types

In `src/lib/types.ts`:
1. Add `PinchProps` to the `import type { … } from 'motion-dom'` list.
2. After `MotionWhileDrag`, add `MotionWhilePinch` with the same shape and JSDoc worded for pinch.
3. In `MotionProps`, after `whileDrag?: MotionWhileDrag`, add:
   ```ts
   /**
    * Scale, rotate and move the element with a pinch: two touches, a trackpad
    * pinch or Safari's gesture events. Pass options to set limits, snapping
    * and callbacks. Requires `pinchFeatures` loaded through `<LazyMotion>`.
    */
   pinch?: boolean | PinchProps
   /** Pinch interaction animation, applied while a pinch is recognised. Requires `pinchFeatures`. */
   whilePinch?: MotionWhilePinch
   ```
4. Export `MotionWhilePinch` from `src/lib/index.ts`, next to `MotionWhileDrag` (`:191`).

**Verify**: `pnpm check` → 0 errors.

### Step 5: Wire the container

In `src/lib/html/_MotionContainer.svelte`:

1. Destructure `pinch: pinchProp` and `whilePinch: whilePinchProp` (next to `whileDrag: whileDragProp`, `:208`).
2. After `hasLayoutFeatures` (`:299`), add:
   ```ts
   // Pinch is opt-in for both kinds (Motion 14.12 `render/dom/features-pinch.ts`:
   // "Not part of `motion` components or the `domMax` bundle"): it is on when
   // the nearest LazyMotion's loaded bundle carries `pinchFeatures`.
   const hasPinchFeatures = $derived(
       !!(motionKindProp === 'm' ? activeFeatures : lazyMotion?.getFeatures())?.pinch
   )
   ```
3. In `buildMotionNodeProps`: add `whilePinch: filterReducedMotionDefinition(whilePinchProp)` after the `whileDrag` line (`:680`), and add `...(hasPinchFeatures ? { pinch: pinchProp } : {})` after the drag block (`:703-722`), with a comment citing upstream `gestures/pinch.ts`.
4. Add `whilePinch: whilePinchProp` to the `isControllingVariants({ … })` call (`:1249-1258`).
5. Run `grep -n "whileDragProp" src/lib/html/_MotionContainer.svelte`. For every other hit, decide whether `whilePinchProp` belongs beside it (lists of gesture states: yes; drag-only logic: no) and say which in the commit message.
6. Styles: after `upstreamDragDefaultStyle`, add
   ```ts
   // Upstream's PinchGesture sets `touch-action` imperatively on mount/update
   // (`gestures/pinch.ts` @ v14.12.0). Svelte owns the style attribute, so it
   // is declarative here, appended after drag's default so it wins, as
   // upstream's update() does.
   const pinchTouchActionStyle = $derived(
       hasPinchFeatures && pinchProp ? `touch-action:${resolvePinchTouchAction(styleProp)}` : ''
   )
   ```
   and append `${pinchTouchActionStyle ? `;${pinchTouchActionStyle}` : ''}` to `inlineStyleBaseWithHolds` directly after the drag-style segment.
7. In `src/lib/utils/visualElementCore.ts`, add `'whilePinch'` to `ANIMATION_FEATURE_PROPS` after `'whileDrag'`.

**Verify**:
- `pnpm exec vitest run src/lib/components/pinch.spec.ts` → all PASS.
- `pnpm check` → 0 errors.
- `pnpm test:only` → all pass (in particular the existing LazyMotion, drag and tap specs).

If "pinch turned on after mount attaches" fails, confirm `node.updateFeatures()` (`:2297`, `:2388`) runs after the props update that adds `pinch`; if it does not, STOP and report.

### Step 6: Tester page and e2e

1. Create `src/routes/tests/pinch/prop/+page.svelte`, a port of upstream's `dev/react/src/tests/pinch-while.tsx`:
   - `<LazyMotion features={{ ...domMax, ...pinchFeatures }}>` wrapping an `m.div id="box"` at `position: fixed; left: 100px; top: 100px; width: 100px; height: 100px; background-color: rgb(255, 0, 0)`, with `drag` when the URL has `drag`, `dragMomentum={false}`, `pinch` (`{ scale: { max: 1.5 } }` when the URL has `limits`, otherwise `true`), `whilePinch="pinching"`, `whileTap={{ backgroundColor: 'rgb(0, 0, 255)' }}`, `onTap` incrementing a counter, `onDragEnd` recording `info.velocity.x`, `transition={{ duration: 0 }}`, `variants={{ pinching: { opacity: 0.5 } }}`.
   - A child `m.div id="child"` (20×20, white) with `transition={{ duration: 0 }}` and `variants={{ pinching: { opacity: 0.25 } }}`.
   - `<output id="taps">` and `<output id="velocity">`.
   - Nothing else inside (0,0)-(450,450) under `?@isPlaywright=true`.
   - A second, human-only block below (hidden under `@isPlaywright`): a 300×200 gradient card as a `motion.div` with `drag`, `dragMomentum={false}` and `pinch={{ scale: { min: 1, max: 4 }, rotate: { snap: 90 } }}` (upstream's `Pinch-photo.tsx`), plus a third card that is a `motion.div pinch` **outside** `LazyMotion`.
   - `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`; copy the usage in `src/routes/tests/motion/tap-options/+page.svelte`) with steps and `expected` text for: trackpad-pinch the red box (it grows, fades to 50%, child to 25%, both restore about 150 ms after you stop); click the box (taps +1); pinch the photo card past 4× and release (resists, springs back to 4×); twist it on a touch screen and release (snaps to the nearest 90°); drag it with one finger, then pinch with two (no jump); pinch the card outside `LazyMotion` (nothing happens, and the page zooms instead). State that a Mac trackpad in Chrome reports no rotation.
2. Create `e2e/pinch/prop.spec.ts`, a port of upstream `tests/react/pinch.spec.ts` at v14.12.0 (cite it): all 7 tests with upstream's names, coordinates and assertions. `open(page, query)` goes to `/tests/pinch/prop?@isPlaywright=true` plus the query (upstream's queries already start with `&`). Define the `frames`, `touch`, `style`, `width` and `spread` helpers at the top of the file as upstream does. Skip the touch tests outside Chromium.
3. In `src/routes/+page.svelte`, add a link `href={resolve('/tests/pinch/prop') + searchParams}`, text "pinch prop, whilePinch and pinchFeatures". If your lane has no "Pinch (Motion 14.11)" section, create it directly before the "Drag" section (`<h2 class="mb-3 text-xl font-medium">Drag</h2>`), copying that section's wrapper markup. Plan 003 creates the same section in another lane; the merge keeps one heading and both links.

**Verify**: `PW_PORT=4264 pnpm exec playwright test --project=chromium e2e/pinch/prop.spec.ts` → 7 passed, three runs in a row.

### Step 7: Tree-shaking guard

In `tests/consumer-vite6/verify-tree-shaking.mjs`, following the file's existing `bundle(…)` + `assert` pattern, add:
- a bundle that imports only `motion` from the package does **not** contain the string `gesturestart` (a marker that only motion-dom's pinch module has);
- a bundle that imports `pinchFeatures` and `LazyMotion` **does** contain it.

**Verify**: `pnpm build && pnpm package && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0. If the first assertion fails (the marker is in the `motion`-only bundle), STOP and report which import chain pulls it in; do not delete the assertion.

### Step 8: Changeset and full gate

1. Create `.changeset/pinch-prop.md` with frontmatter `'@humanspeak/svelte-motion': minor`. Body: "Add the `pinch` prop, `whilePinch` and the opt-in `pinchFeatures` bundle (`<LazyMotion features={{ ...domMax, ...pinchFeatures }}>`), matching Motion 14.11: pinch to scale, rotate and move an element, with elastic limits, rotation snapping and `onStart`/`onMove`/`onEnd` callbacks."
2. Run `pnpm check`, `pnpm test:only`, `pnpm build`, the full chromium e2e on port 4264, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; e2e has no new failures (re-run a failing spec alone once before reporting it). In particular `e2e/lazy-motion/*`, `e2e/drag/*` and `e2e/motion/tap-options.spec.ts` must pass. Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- Net-new feature, so there is no "bug reproduction" red test; Step 1 still writes every test before the code and confirms they fail for the right reason (missing feature).
- Unit: `pinchFeature.spec.ts` (helpers), `features/index.spec.ts` (bundle shape), `components/pinch.spec.ts` (19 ported upstream tests + 3 of ours).
- e2e: `e2e/pinch/prop.spec.ts`, 7 ported tests, real touches through CDP as in `e2e/drag/flick-from-standstill.spec.ts`.
- Package-level: two tree-shaking assertions.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including the three new spec files
- [ ] `PW_PORT=4264 pnpm exec playwright test --project=chromium e2e/pinch/prop.spec.ts` → 7 passed
- [ ] `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0 with the two new assertions
- [ ] `grep -n "pinchFeatures\|MotionWhilePinch" src/lib/index.ts` → both exported
- [ ] `grep -n "touchAction" src/lib/utils/pinchFeature.ts` shows no assignment to `element.style.touchAction`
- [ ] Full chromium e2e → no new failures
- [ ] `git diff --name-only <lane base>..HEAD` lists only in-scope files
- [ ] `.changeset/pinch-prop.md` exists

## STOP conditions

- `addPinchListeners` or `PinchProps` is not exported by the installed `motion-dom` (plan 001 has not landed in your base).
- Something reads `FeatureBundle.animations` at runtime, so making it optional changes behaviour.
- A ported upstream test cannot pass without the feature writing `element.style.touchAction` itself.
- Either drag + pinch test fails ("drag's release velocity doesn't include the pinch" in e2e, or a jump when the pinch starts): report it. Do not edit `DragGestureFeature`.
- The tree-shaking marker appears in a bundle that does not import `pinchFeatures`.
- An existing spec fails after Step 5 and the cause is not an obvious omission in this plan's own edits.

## Maintenance notes

- **Known divergence, left as is:** upstream's `<LazyMotion features={pinchFeatures}>` alone gives an `m` component pinch and nothing else (no animation feature). Here any loaded bundle enables animations, because `FeatureBundle.animations` has never been read. Gating animations on the flag is a separate change with its own risk; the batch README lists it for the maintainer.
- **Not mirrored on purpose:** upstream's feature registry is global, so one `LazyMotion` with `pinchFeatures` anywhere turns pinch on for every motion component in the app. Here the registry entry is global too, but each node only receives its `pinch` prop when its nearest `LazyMotion` has the bundle.
- On every Motion bump, diff `packages/framer-motion/src/gestures/pinch.ts` against `src/lib/utils/pinchFeature.ts`.
- If `drag`'s declarative styles in `_MotionContainer.svelte` change, re-check that `pinchTouchActionStyle` still comes after them.
- Reviewer: check the two Svelte deviations are documented in `PinchGestureFeature`'s JSDoc, and that `pinch`/`whilePinch` never reach the DOM.
