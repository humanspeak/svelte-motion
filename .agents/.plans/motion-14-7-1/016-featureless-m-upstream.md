# Plan 016: An `m` with no loaded LazyMotion features has no VisualElement, renders `style` / `initial` / prop-derived attributes only, and animates in from `initial` when its bundle arrives (upstream parity)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4220**. Prefix every Playwright command with `PW_PORT=4220`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Where**: worktree `/Users/jasonkummerl/Github/svelte-motion-1471-lazy`, branch `lane/1471-lazy`. It already
> has plan 010, the spike's red tests (`44939354`), the spike report (`ea4bf8fd`) and `feat/motion-14.7.1` merged
> in (`84fe1006`). Confirm before starting, otherwise STOP:
> `git merge-base --is-ancestor ea4bf8fd HEAD && echo lane-ok`,
> `git cat-file -t de5bed92` (prints `commit`; the spike branch `spike/1471-featureless-m` lives in this repo),
> `grep -n "motionKindProp === 'm'" src/lib/html/_MotionContainer.svelte` (prints one line).
>
> **Drift check (run first)**:
> `git diff --stat ea4bf8fd..HEAD -- src/lib src/routes tests/consumer-vite6 e2e/lazy-motion docs/src/routes/docs/lazy-motion docs/src/routes/docs/gestures docs/src/routes/docs/optimized-appear docs/src/routes/examples/lazy-motion docs/src/lib/examples/lazy-motion`
> Expected: empty. If anything is listed, compare the "Current state" excerpts with the live code; line numbers
> may move, the code must match. On a content mismatch, STOP.

## Status

- **Priority**: P1 (operator-approved to ship in 2.7.0)
- **Effort**: L (about 150 lines of container change lifted from the spike, plus four follow-ups the spike left
  open, about 25 rewritten or new tests, two new demo pages, docs)
- **Risk**: MED. User-visible for anyone who renders `m.*` without a `LazyMotion`: today it has every feature,
  afterwards it does nothing. For `motion.*` and for `m` inside a sync `LazyMotion` the risk is low: their nodes
  are still created at init, and the spike's guard suites did not move (report §1.2).
- **Depends on**: 010 and 011 (same lane, both in). No other plan edits these regions on this lane. **Step 9 only**
  (owned-snippet presence) also depends on 015b and 012 having merged into `feat/motion-14.7.1`, because it edits
  `PresenceChild.svelte`, which they edit. Steps 1-8 do not wait for them; if the Step 9 precondition is not met,
  Step 9 is a STOP and the rest of the plan still finishes.
- **Wave**: 3 (lane `lazy`, replaces 011's build-plan role)
- **Category**: direction (upstream parity, behaviour change)
- **Planned at**: commit `ea4bf8fd` on `lane/1471-lazy`, 2026-10-28. `git log --oneline -3` at plan time:
  `ea4bf8fd docs(plans): spike 011 report`, `44939354 test(lazy-motion): featureless m without LazyMotion features
  (spike 011)`, `84fe1006 Merge branch 'feat/motion-14.7.1' into lane/1471-lazy (for plan 011)`. `src/` at
  `ea4bf8fd` is identical to `44939354` (`git diff --stat 44939354 ea4bf8fd` lists only the report), so every
  line number in the spike report is valid here.

## Why this matters

Upstream, `m` gets its renderer only from `<LazyMotion>`. With none above it, or while an async bundle loads, it
has no VisualElement. It renders `style`, `initial` and a few prop-derived attributes and does nothing else; when
the bundle arrives the node is created and it animates in from `initial`. svelte-motion instead gives a bare `m`
every feature (`?? domMax`) and a pending async `m` `domMin`. Spike 011 built this the upstream way (prototype A1)
and found four more gaps that this plan also closes:

- `tabindex` must come from props, including `onTap` / `onTapStart`.
- A style MotionValue still reaches the DOM of a node-less `m`.
- AnimatePresence and the SVG `pathLength` hold assume every element gets a node.
- The SSR equality guard has to ignore the optimized-appear attribute and script, which a featureless `m` must not
  emit.

The maintainer's rule is to adopt upstream wherever we diverge.

## Current state

### Upstream (verified at `~/Github/motion`, read with `git show v14.7.1:<path>`)

- **`m` has no features of its own.** `packages/framer-motion/src/render/components/m/create.ts:4-12`:
  `createMinimalMotionComponent` returns `createMotionComponent(Component, options)`, with no preloaded features
  and no `createVisualElement`. `packages/framer-motion/src/context/LazyContext.ts:6-13`: the default context is
  `{ strict: false }`, with no `renderer`.
- **LazyMotion publishes a renderer only once it has one.** `components/LazyMotion/index.tsx:45-75`. A sync bundle
  sets `loadedRenderer.current = renderer` during render (`:52-56`). An async bundle calls `features().then(...)`
  inside `useEffect(..., [])` and sets the renderer only in the `.then` (`:58-66`). There is no `.catch`, so a
  rejected loader never publishes a renderer.
- **No renderer means no VisualElement.** `motion/utils/use-visual-element.ts`:
  - `:60-62`: `createVisualElement = createVisualElement || lazyContext.renderer`.
  - `:64-87`: the node is created only `if (!visualElementRef.current && createVisualElement)`. A node created
    after the first commit gets `manuallyAnimateOnMount = true` (`:84-86`).
  - `:149-161`: `window.MotionIsMounted = true`, `updateFeatures()` and `scheduleRenderMicrotask()` run only when a
    node exists.
- **Rendering doesn't need a node.** `motion/index.tsx:136-165` creates the node only on the client
  (`typeof window !== "undefined"`). `:171-191` always calls `useRender(...)` with `visualState`.
  `motion/utils/use-visual-state.ts:134-142` makes that state once (`useConstant(make)`), and
  `makeLatestValues` (`:60-71`) seeds it with each style MotionValue's value *at that first render*
  (`values[key] = resolveMotionValue(motionValues[key])`).
- **Prop-derived DOM props.** `render/html/use-props.ts`:
  - `:9-19` `copyRawValuesOnly` skips MotionValues; `:34-49` `useStyle` copies the raw style values on every
    render and adds the memoised `visualState` values on top. So a MotionValue's value is rendered once, from the
    first render, and never re-read without a node.
  - `:59-74`: when `props.drag && props.dragListener !== false`, it sets `draggable = false`, `userSelect`,
    `WebkitUserSelect` and `WebkitTouchCallout` to `"none"`, and sets `touchAction`.
  - `:76-81`: `if (props.tabIndex === undefined && (props.onTap || props.onTapStart || props.whileTap))
    htmlProps.tabIndex = 0`. Raw prop truthiness, no feature check, no tag check (a `<button>` or `<a href>` gets
    `tabIndex=0` too), and `onTapCancel` is not in the list.
  - SVG: `render/svg/use-props.ts:10-40` builds attributes (including `pathLength`, via motion-dom
    `render/svg/utils/build-attrs.ts:86-89`) from `visualState`. There is no `visibility` hold anywhere upstream
    (`git grep -n visibility v14.7.1 -- packages/framer-motion/src/render packages/motion-dom/src/render` finds
    only a type).
- **The tap feature's own `tabIndex`.** `packages/motion-dom/src/gestures/press/index.ts:144-149`, run when the
  press gesture mounts (client, with gestures loaded): if the element is not keyboard-accessible
  (`press/utils/is-keyboard-accessible.ts:1-18`: BUTTON, INPUT, SELECT, TEXTAREA, A, or contentEditable) and has
  no `tabindex` attribute, it sets `target.tabIndex = 0`. The feature is enabled by `whileTap`, `onTap`,
  `onTapStart` and `onTapCancel` (`motion/features/definitions.ts:15`).
- **A late node resets style MotionValues to the first-render value.**
  `packages/motion-dom/src/render/VisualElement.ts:437-446`: the constructor scrapes the props' MotionValues and,
  `if (latestValues[key] !== undefined && isMotionValue(value)) value.set(latestValues[key])`. `latestValues` is
  the constant `visualState` from the first render. So if `x.set(50)` ran while the `m` was featureless, `x` goes
  back to its first-render value when the bundle arrives.
- **AnimatePresence with a node-less child.** `ExitAnimationFeature.mount()` registers the child with its
  `PresenceChild` (`motion/features/animation/exit.ts:73-83`, `register(this.id, this.node)`). A featureless
  `m` has no features, so it never registers. When the child is removed with nothing registered, `PresenceChild`
  completes at once (`components/AnimatePresence/PresenceChild.tsx:104-113`: `!isPresent &&
  !presenceChildren.size && onExitComplete()`). So the element leaves immediately: no exit animation, nothing
  that blocks `mode="wait"`. An entering featureless child renders `initial` and stays there.
- **SSR**: no component has a node on the server, so the server markup of a bare `m`, an `m` in a sync
  `LazyMotion` and a `motion` with the same props is identical. svelte-motion's auto optimized-appear script is a
  svelte-motion extension (upstream needs an explicit `startOptimizedAppearAnimation`), so it is not part of that
  comparison.

### svelte-motion at `ea4bf8fd` (`src/lib/html/_MotionContainer.svelte` unless another file is named)

- Features block, `:265-273`:
  ```ts
      const activeFeatures = $derived(
          motionKindProp === 'm' ? (lazyMotion?.getFeatures() ?? domMax) : domMax
      )
      const hasGestureFeatures = $derived(!!activeFeatures.gestures)
      const hasDragFeatures = $derived(!!activeFeatures.drag)
      const hasLayoutFeatures = $derived(!!activeFeatures.layout)
  ```
- `src/lib/components/LazyMotion.svelte:30-32, 52-53, 62-64` serve `domMin` while an async loader is pending and
  after it rejects. `src/lib/components/lazyMotion.context.ts:9` types `getFeatures: () => FeatureBundle`.
- The node and adapter are init-time `const`s: `const visualElementParent = …getVisualElementParent()` (`:1165`),
  `const visualElement = typeof window !== 'undefined' ? untrack(() => createMotionVisualElement({…})) : null`
  (`:1170`), `setVisualElementParent(visualElement)` (`:1231`), `const motionDomProjectionParent` (`:1242`),
  `const motionDomProjection = … new MotionDomProjectionAdapter({…})` (`:1244`), and
  `setMotionDomProjectionParent(motionDomProjection)` (`:1254`). The context helpers store values, not getters
  (`src/lib/components/visualElementTree.context.ts:22-37`, `motionDomProjection.context.ts:11-20`).
- **Prototype A1 is the fix for all of the above.** It is on the throwaway branch:
  `git diff 44939354 de5bed92 -- src/lib/components/LazyMotion.svelte src/lib/components/lazyMotion.context.ts
  src/lib/components/motionDomProjection.context.ts src/lib/components/visualElementTree.context.ts
  src/lib/components/__tests__/LazyMotionContextProbe.svelte src/lib/html/_MotionContainer.svelte`.
  `git apply --check` of that diff on `ea4bf8fd` succeeds (checked at plan time). It:
  - makes `activeFeatures` optional and adds `const featureless = $derived(!activeFeatures)`;
  - turns the node and adapter into `$state.raw` bindings filled by `createNodes(late)`: at init when the
    component has features, otherwise from an `$effect.pre` the first time `featureless` is false, with
    `manuallyAnimateOnMount = true` when late;
  - makes both parent contexts getters;
  - captures the node locally in four effects and the re-entry block (TypeScript narrowing);
  - gates the mount/enter lifecycle effect on the node;
  - drops the feature gates on the drag default style and `tabindex`;
  - gates the optimized-appear script on `!featureless`.
  Do **not** port the two spike-only probe files (`featurelessM.divergence.spec.ts`,
  `__tests__/FeaturelessDivergenceProbe.svelte`); their cases are re-created below. Every `// Spike 011 A:` comment
  in the diff must be rewritten into a normal comment (Step 2).
- **Optimized appear** (`:1398-1421`). `optimizedAppearId` is not feature-gated, so a featureless `m` gets a
  `data-framer-appear-id` and an SSR `<script>` that animates it to `animate` on its own:
  ```ts
      const renderedOptimizedAppearScript = $derived(
          optimizedAppearScript && (typeof window === 'undefined' || !window.MotionIsMounted)
              ? optimizedAppearScript
              : ''
      )
  ```
  The prototype gates it on the live `featureless`. That is not enough: when an async bundle arrives on a page
  where `MotionIsMounted` is still false, the derived flips and Svelte inserts the attribute and the
  (non-executing) script after load. Gate it on a constant decided at init instead (Design, item 3).
- **The `pathLength` hold** (`:1508-1510`):
  ```ts
      const inlineStyleBaseWithHolds = $derived(
          `${initialKeyframes && 'pathLength' in initialKeyframes && isLoaded === 'mounting' ? `${serializedStyleProp};visibility:hidden` : serializedStyleProp}…`
  ```
  `isLoaded` leaves `'mounting'` only in the lifecycle effect (`:3325-3388`), which A1 gates on the node. So a
  featureless `m.path` with `initial={{ pathLength }}` would stay `visibility:hidden` forever (report §5, STOP
  risk 4). Upstream has no hold.
- **`tabindex`** (`:1300` and `:1641-1654`):
  ```ts
      const resolvedWhileTap = $derived(resolveWhile(whileTapProp, variantsProp, effectiveCustom))
  …
          ...(hasGestureFeatures &&
          isNotEmpty(resolvedWhileTap) &&
          !isNativelyFocusable(tag, rest) &&
          ((rest as Record<string, unknown>)?.tabindex ??
              (rest as Record<string, unknown>)?.tabIndex ??
              undefined) === undefined
              ? { tabindex: 0 }
              : {}),
  ```
  This differs from upstream `use-props.ts:76-81` in four ways: the feature gate, the *resolved* `whileTap` (from
  #349 review), the `isNativelyFocusable` exemption (`src/lib/utils/a11y.ts`), and the missing
  `onTap`/`onTapStart`. On the client with gestures, motion-dom's `press()` (attached at `:3037-3044`) still adds
  `tabIndex = 0` at mount to non-keyboard-accessible elements, which is why today's client tests mostly see
  `tabindex="0"`. Markup on the server or under `domMin` does not.
- **Style MotionValues on a node-less element.** Three readers:
  - `serializedStyleProp` (`:341`, `serializeMotionStyle(styleProp, transformTemplateProp)`, `src/lib/utils/style.ts:153-162`)
    calls `resolveMotionStyle`, which reads each Svelte-augmented MotionValue reactively, so `x.set(50)` re-renders
    `translateX(50px)`.
  - The no-node branch of `renderedInlineStyle` (`:1589-1612`) calls `makeLatestValues(…)` on every derivation,
    which reads the scraped MotionValues again.
  - The fallback `$effect` (`:983-994`, `if (!element || visualElement) return` … `styleEffect(element, styleValues)`)
    subscribes to them. Its comment says "a client render always has one", which is false after A1.

  The spike tried gating only the effect, and it was not enough (report §3.4 item 6).
  `createMotionVisualElement` (`src/lib/utils/visualElementCore.ts:803-858`) seeds `latestValues` from the current
  props (`seedLatestValues`). It has no way to take upstream's first-render `visualState`.
- **AnimatePresence registration ignores features.**
  - `onDestroy` → `context.unregisterChild(presenceKey)` (`:758-765`).
  - The rAF style capture (`:771-796`).
  - `context.registerChild(…)` when `exit` is set (`:868-897`).
  - The rect measure effect (`:903-950`, gated on `isLoaded === 'ready'`).

  A featureless `m` with `exit` therefore still gets a clone exit and still raises `inFlightExits`, which blocks
  `mode="wait"` siblings (`src/lib/utils/presence.ts:1179-1196`, `isEnterBlocked`). `unregisterChild` on a key that
  was never registered is a no-op (`presence.ts:1663-1667`).
- **Wait mode for an entering node-less `m`.** `waitEnterBlockedBeforeMount` (`:1481-1483`) is computed at render
  from `context.isEnterBlocked(presenceKey)`, a plain function that Svelte doesn't track. The element renders
  `display:none` (`:1509`, `:1672`). The only reveal is `revealWaitHiddenElement()` (`:1801-1812`), called from
  `runAnimation()`'s wait branch (`:1856-1921`). `runAnimation` bails without `visualElement?.animationState`
  (`:1845-1848`), and A1 gates the lifecycle that calls it. So an entering featureless `m` behind an exiting sibling
  would stay hidden (report §5, STOP risk 3).
- **Re-entry handoff** (`:1336-1368`) is init-only and already requires `visualElement`, so a featureless `m` never
  takes an exit handoff. That is correct, because it never registered an exit.
- `src/lib/m.ts:8-15` JSDoc says "Outside any `<LazyMotion>` an `m` component currently keeps every feature."
- **SSR guard** (`tests/consumer-vite6/verify.mjs:90-104`, added by the spike) normalises `svelte-motion-s\d+` and
  asserts bare `m` = sync-LazyMotion `m` = `motion`. Under A1 a featureless `m` drops the appear attribute and
  script, so this exact-equality guard fails by design (report §1.2, §3.5).
- **Tests that use `tabindex` as a stand-in for "gesture features loaded"** (they must assert behaviour instead):
  - `src/lib/components/LazyMotion.spec.ts`:
    - `:47` `does not attach gesture affordances with domMin`;
    - `:54` `enables gesture affordances with domAnimation`;
    - `:61` `upgrades async lazy features from domMin when the loader resolves`;
    - `:77` `stays on domMin when an async lazy feature loader rejects`;
    - `:87` `ignores stale async feature loaders after features change`;
    - `:106` `motion components keep every feature inside LazyMotion`.
  - `e2e/lazy-motion/basic.spec.ts:12` and `:27`.
  - `src/lib/html/_MotionContainer.spec.ts:112-123`: `does not add tabindex when element is natively focusable`
    (`<a href whileTap>`). Upstream adds `tabIndex=0` there, so this one flips.
- Spike anchors already on the lane:
  - `src/lib/components/featurelessM.spec.ts`: three `it.fails` cases at `:45`, `:73` and `:107`; guards at `:62`
    and `:133`.
  - `e2e/lazy-motion/featureless-m.spec.ts`: two `test.fail` cards plus a control. It samples every 100 ms, which
    is not a painted-frame proof; Step 1 upgrades it.
  - Its page is `src/routes/tests/lazy-motion/featureless-m/+page.svelte`, linked from `src/routes/+page.svelte:85-92`
    with the label "(spike 011)".

### Conventions

- Unit tests run in jsdom (`vitest.config.ts`, `resolve.conditions: ['browser']`). Svelte probes live in
  `src/lib/components/__tests__/`. The fake-timer setup and `createDeferred` helper are at the top of
  `featurelessM.spec.ts:17-42`. Use `await flushTimers()` from `$lib/__tests__/flushTimers`, and read nodes with
  `visualElementStore` from `motion-dom`.
- To drive a press in jsdom, copy the `pointer()` helper from `src/lib/utils/gestures.spec.ts:36-43`. Read
  activation with `visualElementStore.get(el)?.animationState?.getState().whileTap.isActive`, as
  `Reorder/keyboard.component.spec.ts:82` does for `whileDrag`.
- SSR checks live in `tests/consumer-vite6` (`renderPlain`, `stripComments` in `verify.mjs`). `svelte/server` cannot
  run in vitest here.
- Test pages are `src/routes/tests/<area>/<name>/+page.svelte`, and e2e specs are `e2e/<area>/<name>.spec.ts`.
  - Guided pages use `TesterPanel` from `src/routes/tests/layout/_parity/TesterPanel.svelte` (props `eyebrow`,
    `title`, `status`, `steps: TesterStep[]`, optional `checks` snippet). It renders nothing under
    `?@isPlaywright=true`.
  - Compute live verdicts only when `isTester` (`!window.location.search.includes('@isPlaywright=true')`, set in
    `onMount`).
  - Exemplars: `src/routes/tests/lazy-motion/featureless-m/+page.svelte` (this feature) and
    `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte` (rAF sampler).
- The e2e server is a production build (`playwright.config.ts`, `PW_PORT`). Pages signal readiness with
  `window.MotionIsMounted === true`. **A featureless `m` never sets it** (upstream `use-visual-element.ts:158`), so
  every new page needs at least one featured control element. Don't wait on a featureless element's
  `data-is-loaded`: it stays `mounting`.
- **Painted-frame rule (project rule)**: visual claims are checked on every painted frame, never on sampled rects.
  Run the probe in the page with `page.evaluate`: do the action, then read the state in a `requestAnimationFrame`
  callback on every frame for the window under test (computed style, `document.elementFromPoint`, clone count).
  motion-dom's frameloop has already written that frame by then, and `elementFromPoint` forces style and layout
  for the frame about to paint. Return the per-frame array and assert on every entry. The pattern is plan 013's
  `FrameProbe` (`git show lane/1471-origin:.agents/.plans/motion-14-7-1/013-layout-transform-origin-at-rest.md`,
  Step 2.3).
- Public functions, types and components need Google-style JSDoc (see `src/lib/utils/style.ts:139-152`).

## Design

Decided by the spike. Option A1 is built as prototyped (report §4), with these additions:

1. **Two notions of "featureless".** `featureless` (live, from the prototype) says whether the `m` currently has a
   bundle. It drives the late `createNodes(true)` only. Add `const startedFeatureless = untrack(() => featureless)`
   next to it, a constant that the server and the client compute the same way: an `m` outside LazyMotion or inside
   an async one is featureless at init on both. Everything that changes **markup** keys off `startedFeatureless`;
   everything that is **node behaviour** keys off whether `visualElement` exists (client). Table:

   | Site | Gate | Why |
   | --- | --- | --- |
   | late node creation (`$effect.pre`) | `featureless` / `visualElement` (prototype) | upstream creates the node the first render a renderer exists |
   | optimized-appear id, attribute and script | `!startedFeatureless` | no script for an element that has no node to hand off to; constant, so nothing is injected after load |
   | `pathLength` `visibility:hidden` hold | `!startedFeatureless` | a late node has nothing to flash: the element already shows `initial` |
   | style MotionValues and `makeLatestValues` (client, no node) | snapshot taken at init | upstream `useConstant(visualState)` + `copyRawValuesOnly` |
   | presence capture / `registerChild` / measure effects | `visualElement` non-null | upstream registers from the exit feature, which needs a node |
   | wait-mode reveal (client, no node) | new effect, see 5 | the reveal otherwise lives in `runAnimation`, which needs a node |

2. **`tabindex` from props, exactly as upstream** (`use-props.ts:76-81`): add `tabindex: 0` when neither
   `tabindex` nor `tabIndex` is in `rest`, and `onTapProp || onTapStartProp || whileTapProp` is truthy. Drop
   `hasGestureFeatures`, `resolvedWhileTap` and `isNativelyFocusable` from this condition. This adopts upstream
   on the two points where #349 chose differently: an unresolved `whileTap` label and natively focusable tags.
   Delete `resolvedWhileTap` and the `isNativelyFocusable` import if nothing else uses them (`grep -n`). The drag
   default style and `draggable` lose their feature gate (prototype).
3. **Optimized appear**: fold `!startedFeatureless` into the `optimizedAppearId` condition (`:1398-1410`), not
   into the script derived. The id then disappears with the script, `hasOptimizedAppearAnimation` sees
   `undefined`, and `optimizedAppearIdForNode` stays unset. This replaces the prototype's
   `renderedOptimizedAppearScript` edit.
4. **Style MotionValues** (upstream `use-props.ts:9-49`, `use-visual-state.ts:134-142`, `VisualElement.ts:437-446`):
   - In `src/lib/utils/style.ts` add two pure helpers with JSDoc and unit tests:
     - `captureMotionStyleValues(style)` returns `Record<string, string | number>`, each MotionValue entry's
       `.get()` read under `untrack`, or `undefined` when there are none.
     - `freezeMotionStyle(style, captured)` returns a copy of an object-form style in which each MotionValue entry
       is replaced by `captured[key]`, dropped when `captured` has no value for that key. String and non-object
       styles are returned unchanged.
   - In the container, on the client when `startedFeatureless`, take two snapshots once at init under `untrack`:
     `featurelessStyleValues = captureMotionStyleValues(styleProp)`, and `featurelessLatestValues =
     makeLatestValues(…)` with the arguments the no-node branch of `renderedInlineStyle` uses today.
   - While there is no node on the client:
     - `serializedStyleProp` serializes `freezeMotionStyle(styleProp, featurelessStyleValues)`. Raw values stay
       reactive, as upstream `copyRawValuesOnly` re-runs every render.
     - The no-node branch of `renderedInlineStyle` uses `featurelessLatestValues` instead of calling
       `makeLatestValues` again.
     - The server path is unchanged. It has no node either, so test `typeof window !== 'undefined'` together with
       `!visualElement`.
   - Add an optional `latestValues?: ResolvedValues` to `CreateMotionVisualElementOptions`
     (`visualElementCore.ts:740-783`). When it is given, it is the seed: it is used instead of `makeLatestValues`,
     and `seedLatestValues` is ignored. `createNodes(true)` passes `featurelessLatestValues`. motion-dom's
     constructor then sets each style MotionValue back to its first-render value, as upstream does.
   - Delete the fallback style `$effect` (`:974-994`, comment included). After A1 the only node-less client render
     is a featureless `m`, and upstream never subscribes there. Leave `applyMotionStyleEffect` and
     `collectMotionStyleValues` in `style.ts` (they have specs), but remove their container imports if they are now
     unused. Keep `styleEffect`: it is public (`src/lib/index.ts:52`).
5. **AnimatePresence** (upstream `exit.ts:73-83`, `PresenceChild.tsx:104-113`):
   - Add `visualElement` to the guards of the rAF capture effect (`:771`), the `registerChild` effect (`:868`) and
     the measure effect (`:903`). They read the `$state.raw` binding, so a late node registers as soon as it
     exists.
   - Leave the `onDestroy` unregister as is (a no-op for an unregistered key).
   - Add one effect for the node-less entering case:
     ```ts
         $effect(() => {
             if (visualElement || !element || !context || !waitEnterBlockedBeforeMount) return
             return context.onEnterUnblocked(() => revealWaitHiddenElement())
         })
     ```
     It re-runs when a late node appears and unsubscribes; `runAnimation()` then owns the reveal. It doesn't run the
     enter: there is nothing to animate without a node, so the element shows `initial`.
6. **SSR guard**: compare markup with the appear attribute and the appear `<script>` removed, assert where they must
   and must not appear, and prove the normaliser keeps real differences (Step 1.4).

7. **Owned-snippet presence** (`<AnimatePresence present>` / `PresenceChild`; Step 9). Upstream: a featureless
   `m` registers nothing, and a `PresenceChild` whose registry is empty completes right after the commit that
   starts the exit (`PresenceChild.tsx:104-113`). `usePresence` is what keeps a manual wrapper alive, because it
   registers (`use-presence.ts:52-57`), and its `safeToRemove` completes only that participant
   (`use-presence.ts:59-62`, `onExitComplete(id)`). svelte-motion differs in both places:
   - `presenceExitRegistry.ts:8-9`: "Empty manual wrappers intentionally keep their hold until explicitly
     released." `checkComplete` returns early when `!participated` (`:27-28`).
   - `usePresence.ts:83-87` doesn't register, and its `safeToRemove` releases the whole wrapper.

   So the featureless `m` already does the upstream thing (no node, no exit feature, no registration). The gap is in
   the presence layer. Size check, done at plan time:
   - There is no gate on our side of the registration. The node-less `m` makes no presence call to gate, and
     `PresenceChild`'s hold is what keeps it.
   - The fix needs `presenceExitRegistry.ts` (complete when empty), `PresenceChild.svelte` and `usePresence.ts`.
     `PresenceChild.svelte` needs it because, today, completing synchronously inside `begin()` would run
     `notifyExitComplete` before `notifyExitStart` (`PresenceChild.svelte:322-325`). `usePresence.ts` needs it
     because it must register, or every manual `usePresence` wrapper would vanish at once.
   - That puts it in 015b's and 012's territory, so it is the final, gated Step 9.

   Considered and rejected for 7: making a node-less `m` inside a `PresenceChild` register a participant that
   completes as soon as the exit starts. It is a container-only change, but it is not upstream's mechanism, and it
   is wrong in the mixed case: a wrapper holding a featureless `m` plus a `usePresence` consumer would be removed
   at once, where upstream waits for the consumer's `safeToRemove`.

Considered and rejected: prototype B (keeps an unmounted node; it diverges observably, report §3.4). A2 (adapter
without a node; it needs `motionDomProjection.ts` changes, report §3.1). Gating presence on `featureless` instead
of on the node: a node that exists keeps its exit even if our `LazyMotion` later re-publishes `undefined` for a new
async loader.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| All unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Library build + package validation | `pnpm build` (`vite build` + `svelte-package` + `publint`) | exit 0, publint clean |
| Consumer SSR | `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | prints `Vite 6 consumer SSR regression checks passed.` |
| E2E | `PW_PORT=4220 pnpm exec playwright test <paths>` | as stated per step |
| Docs typecheck | `pnpm --filter docs check` | 0 errors |
| Docs build (regenerates `docs/src/lib/demo-loaders.ts` / `demo-manifest.json`) | `pnpm build && rm -rf docs/node_modules/.vite && pnpm --filter docs exec vite build` | exit 0 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

(`.trunk/trunk.yaml` is the lint/format authority; do not use `pnpm lint` or `prettier` directly. pnpm does not
forward `-- --flags` to vite. The docs consume the built `dist`, so rebuild the library before any docs step.)

## Scope

**In scope** (the only files you should modify or create):

- Library:
  - `src/lib/components/LazyMotion.svelte`;
  - `src/lib/components/lazyMotion.context.ts`;
  - `src/lib/components/visualElementTree.context.ts`;
  - `src/lib/components/motionDomProjection.context.ts`;
  - `src/lib/html/_MotionContainer.svelte` (the regions in "Current state" and the Design table only);
  - `src/lib/utils/style.ts` (two new helpers);
  - `src/lib/utils/visualElementCore.ts` (the `latestValues` option);
  - `src/lib/m.ts` (JSDoc).
- Unit tests and probes:
  - `src/lib/components/featurelessM.spec.ts`;
  - `src/lib/components/tapTabindex.spec.ts` (create);
  - `src/lib/components/LazyMotion.spec.ts`;
  - `src/lib/html/_MotionContainer.spec.ts` (only the case at `:112-123`);
  - `src/lib/utils/style.spec.ts` (new describes);
  - `src/lib/utils/visualElementCore.spec.ts` (one new case);
  - `src/lib/components/__tests__/`: `FeaturelessMProbe.svelte` (unchanged unless needed) and
    `LazyMotionContextProbe.svelte` (`:20`), plus new probes `FeaturelessStyleProbe.svelte`,
    `FeaturelessSvgProbe.svelte`, `FeaturelessPresenceProbe.svelte` and `TapTabindexProbe.svelte`.
- If `grep -rn isNativelyFocusable src` shows only `a11y.ts` and `a11y.spec.ts` after Step 4: delete
  `src/lib/utils/a11y.ts` and `src/lib/utils/a11y.spec.ts`. It is not exported from `src/lib/index.ts`.
- SSR:
  - `tests/consumer-vite6/verify.mjs`;
  - `tests/consumer-vite6/src/FeaturelessSsr.svelte`;
  - `tests/consumer-vite6/src/TapSsr.svelte` and `src/render-tap-ssr.js` (create).
- Pages and e2e:
  - `src/routes/tests/lazy-motion/featureless-m/+page.svelte` (status line only);
  - `src/routes/tests/lazy-motion/featureless-m-presence/+page.svelte` (create);
  - `src/routes/tests/lazy-motion/featureless-m-props/+page.svelte` (create);
  - `src/routes/+page.svelte` (lazy-motion list: rename one label, add two links);
  - `e2e/lazy-motion/featureless-m.spec.ts`;
  - `e2e/lazy-motion/featureless-m-presence.spec.ts` (create);
  - `e2e/lazy-motion/featureless-m-props.spec.ts` (create);
  - `e2e/lazy-motion/basic.spec.ts`.
- Docs:
  - `docs/src/routes/docs/lazy-motion/+page.svx`;
  - `docs/src/routes/docs/gestures/+page.svx` (one paragraph);
  - `docs/src/routes/docs/optimized-appear/+page.svx` (one bullet);
  - `docs/src/routes/examples/lazy-motion/+page.svelte` (one section);
  - `docs/src/lib/examples/lazy-motion/demos/AsyncFeatures.svelte` (create);
  - the generated `docs/src/lib/demo-loaders.ts` and `docs/src/lib/demo-manifest.json` (regenerated, never
    hand-edited).
- `.changeset/featureless-m.md` (create).
- **Step 9 only, and only once its precondition holds**:
  - `src/lib/utils/presenceExitRegistry.ts` + `presenceExitRegistry.spec.ts`;
  - `src/lib/components/PresenceChild.svelte` (the exit-start branch at `:318-326` and one new helper);
  - `src/lib/utils/usePresence.ts` + its spec (`grep -rln "usePresence" src/lib --include=*.spec.ts`);
  - `src/lib/components/__tests__/FeaturelessOwnedProbe.svelte` (create), plus one owned card on
    `featureless-m-presence/+page.svelte` and its e2e case;
  - `docs/src/routes/docs/use-presence/+page.svx` (the `safeToRemove` paragraph);
  - one more sentence in `.changeset/featureless-m.md`.

  Before Step 9, none of these files may be touched.

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/motionDomProjection.ts`: A1 needs no adapter change (report §3.1). If you think it does, STOP.
- `src/lib/utils/presence.ts` (the clone path; 015b/012 own it). Step 9 does not need it; if it seems to, STOP.
- `LazyMotion.svelte`'s re-load when `features` changes after mount (upstream loads once, `useEffect(..., [])`).
  Existing behaviour with its own test (`ignores stale async feature loaders`); keep it.
- `motion.*` behaviour of any kind, including its `pathLength` hold and optimized appear.
- motion-dom itself, `package.json` `"version"`, PR labels, `.agents/.plans/motion-14-7-1/README.md`.

## Git workflow

- Work on `lane/1471-lazy` in `/Users/jasonkummerl/Github/svelte-motion-1471-lazy`. Never merge
  `spike/1471-featureless-m`; only read from it with `git diff` / `git show`.
- Conventional commits, one per step, for example:
  - `test(lazy-motion): red anchors for featureless m props, presence and SSR (plan 016)`;
  - `feat(lazy-motion): featureless m has no VisualElement until LazyMotion features load`;
  - `fix(lazy-motion): tabindex from onTap/onTapStart/whileTap props, as upstream`;
  - `docs(lazy-motion): featureless m and async loading`.

  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR (the maintainer signs off on the live demo first). Never change `"version"`; never add
  labels.

## Steps

### Step 1: Red tests, guards and pages

Write everything below before touching `src/lib` (except new `__tests__` probes). Each case is labelled **RED**
(fails on the code at `ea4bf8fd`) or **GUARD** (passes there and must stay green). The reason is the code path that
decides it.

**1.1 `src/lib/components/featurelessM.spec.ts`**: remove the three `it.fails` markers (turn them into `it`), then
add the cases below.

| # | Case | Label | Why, at `ea4bf8fd` |
| --- | --- | --- | --- |
| U1 | `an m outside LazyMotion has no VisualElement` (existing) | RED | bare `m` gets `domMax` (`:268-270`) → node at init (`:1170`); measured in report §1.1 |
| U2 | `… async bundle has no VisualElement, then animates from initial` (existing) | RED | pending async `m` gets `domMin` and a node; report §1.1 |
| U3 | `a late parent reaches its children` (existing) | RED | precondition fails: both nodes exist while pending; report §1.1 |
| U4 | `keeps the prop-derived attributes` (existing) | GUARD | bare `m` has `domMax`, so the gated attrs render; must survive the gate removal |
| U5 | `sync LazyMotion has a VisualElement immediately` (existing) | GUARD | sync bundle → node at init |
| U6 | `a style MotionValue on a featureless m does not reach the DOM`: probe `FeaturelessStyleProbe.svelte` (`<m.div data-testid="box" style={{ x }}>` with `const x = useMotionValue(0)` and an exported `setX`; the same `wrap` prop as `FeaturelessMProbe`), `wrap: 'none'`; `setX(50)`, flush ×2; `box.style.transform` does not contain `50px` | RED | the bare `m`'s node binds `x` and renders it; the reactive `serializedStyleProp` (`:341`) does too |
| U7 | `a raw style change still reaches a featureless m`: same probe with a `width` prop rendered into `style={{ x, width }}`; rerender `width: '20px'` → `box.style.width === '20px'` | GUARD | Svelte re-renders `style` today; must survive the MotionValue freeze (upstream re-copies raw values each render) |
| U8 | `a late node starts style MotionValues from the first render, then follows them`: `wrap: 'async'`; `setX(50)` while pending; resolve `domMax`, flush ×3; expect `x.get() === 0` and the transform not to contain `50px`; then `setX(80)`, flush → transform contains `80px` | RED | the pending `m` already has a `domMin` node bound to `x`, so `x.get()` stays `50` (upstream `VisualElement.ts:437-446` resets it) |
| U9 | `a motion child of a featureless m has no parent node`: port spike probe `FeaturelessDivergenceProbe.svelte` (rename `FeaturelessParentProbe.svelte`), `child.parent` is `undefined` | RED | the bare parent `m` has a node at init, so the child's `parent` is that node; upstream `useVisualElement` reads a parent that has no node |
| U10 | `a featureless m.path with initial pathLength is visible`: probe `FeaturelessSvgProbe.svelte` (`<svg><m.path data-testid="path" d="M0 0 L100 0" initial={{ pathLength: 0.2 }} animate={{ pathLength: 1 }} /></svg>`, `wrap` prop); `wrap: 'none'`, flush ×2; `path.style.visibility !== 'hidden'` | GUARD | today the lifecycle sets `isLoaded = 'initial'` (`:3388`) and drops the hold; A1 alone would keep it |
| U11 | `a featureless m.path keeps its initial pathLength`: same probe; read `stroke-dasharray` right after `render`, flush ×5, read again: equal | RED | today the bare `m.path` has a node and animates `pathLength` to 1 |
| U12 | `a featureless m with exit leaves AnimatePresence at once, without a clone`: probe `FeaturelessPresenceProbe.svelte` (`<AnimatePresence>{#if show}<m.div key="a" data-testid="leaver" exit={{ opacity: 0 }} transition={{ duration: 1 }} />{/if}</AnimatePresence>`, `show` prop); rerender `show: false`, `await tick()`, then `document.querySelectorAll('[data-clone="true"]').length === 0` and no `leaver` in the DOM | RED (see note) | `registerChild` (`:868-897`) runs without a node, so `unregisterChild` makes a clone |

Note on U12: clone creation in jsdom depends on the stored rect. `_MotionContainer.spec.ts` does assert clones in
jsdom, so it should be RED, but this was not confirmed by running. If U12 passes at `ea4bf8fd`, keep it, relabel
it **GUARD** (change its label comment in the spec to say why it passes), and report it with the observed DOM
state. E5 stays the RED anchor for this behaviour. This is not a STOP.

**1.2 `src/lib/components/tapTabindex.spec.ts`** (create): probe `TapTabindexProbe.svelte` renders, inside
`<LazyMotion features={domMin}>`:

- `m.div data-testid="on-tap" onTap={() => {}}`;
- `m.div data-testid="on-tap-start" onTapStart={() => {}}`;
- `m.div data-testid="on-tap-cancel" onTapCancel={() => {}}`;
- `m.div data-testid="tap-label" whileTap="missing"`;
- `m.button data-testid="tap-button" whileTap={{ scale: 0.9 }}`;
- `m.div data-testid="tap-explicit" whileTap={{ scale: 0.9 }} tabindex={-1}`.

Flush once.

| # | Case | Label | Why |
| --- | --- | --- | --- |
| T1 | `on-tap` has `tabindex="0"` | RED | `domMin`: the render gate needs `hasGestureFeatures` and `whileTap` (`:1647-1648`); `press()` isn't attached (`:3021`) |
| T2 | `on-tap-start` has `tabindex="0"` | RED | same |
| T3 | `on-tap-cancel` has no `tabindex` | GUARD | not in upstream's `use-props` list; no press under `domMin` |
| T4 | `tap-label` has `tabindex="0"` | RED | resolved-label gate + feature gate (upstream uses the raw prop) |
| T5 | `tap-button` has `tabindex="0"` | RED | feature gate + `isNativelyFocusable` (upstream has neither) |
| T6 | `tap-explicit` keeps `tabindex="-1"` | GUARD | explicit `tabindex` wins in both |

Also rewrite `_MotionContainer.spec.ts:112-123` into
`adds tabindex=0 to a natively focusable element with whileTap (upstream use-props)`: the same `<a href whileTap>`
should now have `tabindex="0"`. This is **RED**: `isNativelyFocusable` excludes it, and `press()` skips `A`
(`is-keyboard-accessible.ts:1-7`).

**1.3 `src/lib/components/LazyMotion.spec.ts`**: rewrite the `tabindex` proxies to assert behaviour. For "has tap",
dispatch `pointer('pointerdown')` on `tap` and read `visualElementStore.get(tap)?.animationState?.getState().whileTap.isActive`.
For "has no node", use `visualElementStore.get(el) === undefined`.

| Line | New assertion | Label | Why |
| --- | --- | --- | --- |
| `:47` | `domMin`: a node exists, `whileTap` never becomes active, and `tap` has `tabindex="0"` (prop-derived) | RED | today `tabindex` is absent under `domMin` |
| `:54` | `domAnimation`: `whileTap` becomes active on `pointerdown` | GUARD | gestures attached today |
| `:61` | async: no node for `box` / `tap` while pending; after resolve, `whileTap` becomes active | RED | pending → `domMin` node today |
| `:77` | rejected loader: still no node for `box` after flush ×3 | RED | `domMin` node today |
| `:87` | after rerender to `domAnimation`, `whileTap` becomes active; after the stale `domMin` resolves, still active | GUARD | stale loads ignored today (`loadId`) |
| `:106` | `domMin`: `motion-tap` becomes active, `m-tap` does not | GUARD | `motion` ignores LazyMotion today |

**1.4 Consumer SSR** (`tests/consumer-vite6`):

- In `FeaturelessSsr.svelte`, add a fourth wrapper `<div data-kind="m-async">` with the same `m.div` inside
  `<LazyMotion features={() => Promise.resolve(domMax)}>`. Add a fifth pair after it:
  `<div data-kind="m-path">` (a bare `<svg><m.path … initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}/></svg>`)
  and `<div data-kind="motion-path">` (the same with `motion.path`).
- Create `TapSsr.svelte` and `render-tap-ssr.js` (copy `render-featureless-ssr.js`). It renders `motion.div`s with
  `data-testid`s `on-tap` (`onTap`), `on-tap-start` (`onTapStart`), `on-tap-cancel` (`onTapCancel`), `tap-label`
  (`whileTap="missing"`), and a `motion.button` `tap-button` (`whileTap`).
- In `verify.mjs`, replace the spike block (`:86-104`) with:
  - `const stripAppear = (html) => html.replace(/\sdata-framer-appear-id="[^"]*"/g, '').replace(/<script>\(\(\)=>\{const p=[\s\S]*?<\/script>/g, '')`.
    The appear script always starts `<script>(()=>{const p=` (`src/lib/utils/optimizedAppear.ts:357`). Any other
    `<script>` is left alone on purpose.
  - Parse the four box wrappers, and assert:

    | # | Assertion | Label | Why |
    | --- | --- | --- | --- |
    | S1 | `m-bare` and `m-async` contain neither `data-framer-appear-id` nor `<script>` | RED | `optimizedAppearId` is not feature-gated (`:1398-1410`) |
    | S2 | `motion` and `m-lazy` contain both | GUARD | featured elements keep auto-appear |
    | S3 | `stripAppear` of `m-bare`, `m-async` and `m-lazy` each equal `stripAppear(motion)` | RED (`m-async`) / GUARD (others) | today `m-async` renders with `domMin` on the server: no `tabindex`, `draggable` or drag styles |
    | S4 | Self-test: `assert.notEqual(stripAppear(motionInner), stripAppear(motionInner.replace('width: 10px', 'width: 11px')))` and `assert.notEqual(stripAppear('<div a="1"></div>'), stripAppear('<div a="2"></div>'))` | GUARD | proves the normaliser keeps real markup differences |
    | S5 | `m-path` has no `visibility:hidden`; `motion-path` has it | RED (`m-path`) / GUARD (`motion-path`) | the hold applies to every `pathLength` `initial` while `isLoaded === 'mounting'` (`:1509`) |
    | S6 | `TapSsr`: `on-tap`, `on-tap-start`, `tap-label`, `tap-button` have `tabindex="0"`; `on-tap-cancel` has no `tabindex` | RED (first four) / GUARD (`on-tap-cancel`) | server markup has no `press()`; the render gate needs a resolved `whileTap` and a non-native tag |

    Keep the svelte-motion-s id normalisation only if S3 still needs it once the attribute is stripped (it
    shouldn't; remove it if unused).

**1.5 Pages** (each with a component JSDoc citing upstream, a guided `TesterPanel` whose steps each have an
`action`, live verdict chips computed only when `isTester`, and stable `data-testid`s; model on
`featureless-m/+page.svelte`):

- `src/routes/tests/lazy-motion/featureless-m-presence/+page.svelte`. Every card has a featured control so that
  `MotionIsMounted` is set. `transition={{ duration: 0.6, ease: 'linear' }}` throughout.
  - **exit**: a bare `<AnimatePresence>{#if showExit}<m.div key="leaver" data-testid="exit-bare"
    initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.5 }} />{/if}</AnimatePresence>`
    and, beside it, the same inside `<LazyMotion features={domAnimation}>` (`data-testid="exit-control"`). One
    button, `toggle-exit`, toggles both. Expected: the bare box is gone on the next frame, with no clone; the
    control fades and shrinks for about 0.6 s.
  - **wait-enter**: `<AnimatePresence mode="wait">`, where `motion.div key="a" data-testid="wait-old"
    exit={{ opacity: 0 }}` swaps to a bare `m.div key="b" data-testid="wait-new" initial={{ opacity: 0.4 }}
    animate={{ opacity: 1 }}`. Button `swap-enter`. Copy the key-swap markup from
    `src/routes/tests/animate-presence/wait-exit-key-change/+page.svelte`. Expected: `wait-new` appears once
    `wait-old` has faded out, at opacity 0.4, and stays there.
  - **wait-leave**: `<AnimatePresence mode="wait">`, where a bare `m.div key="c" data-testid="leave-old"
    exit={{ opacity: 0 }}` swaps to `motion.div key="d" data-testid="leave-new" initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}`. Button `swap-leave`. Expected: `leave-old` is gone at once and `leave-new` starts
    fading in on the next frame.
- `src/routes/tests/lazy-motion/featureless-m-props/+page.svelte`:
  - **tap**: bare `m.div data-testid="tap-bare" onTap={() => bareTaps++}` and control `motion.div
    data-testid="tap-control" onTap={() => controlTaps++}`, each showing its counter (`data-testid="tap-bare-count"`
    / `tap-control-count`). Plus an `m.div data-testid="tap-dommin" onTapStart={…}` inside
    `<LazyMotion features={domMin}>`. Expected: all three can be reached with Tab; clicking the bare box doesn't
    count; clicking the control does.
  - **style**: `const x = useMotionValue(0)`; a bare `m.div data-testid="style-bare" style={{ x }}` and a control
    `motion.div data-testid="style-control" style={{ x }}`. Button `nudge` runs `x.set(x.get() === 0 ? 120 : 0)`.
    Expected: only the control moves.
  - **path**: a bare `m.path data-testid="path-bare"` and a control `motion.path data-testid="path-control"`, each in
    its own 200×40 `svg` with `stroke-width: 8`, `initial={{ pathLength: 0.2 }}` and `animate={{ pathLength: 1 }}`.
    Expected: the bare line is visible and stays short; the control draws to full length.
- `featureless-m/+page.svelte`: change only the `TesterPanel` `status` to say all three cards read OK on this build.
- `src/routes/+page.svelte` (`:85-92`): rename the label to `LazyMotion — m without features`. Add two `<li>` with
  the same markup after it: `LazyMotion — featureless m in AnimatePresence` → `/tests/lazy-motion/featureless-m-presence`,
  and `LazyMotion — featureless m tabindex, style and pathLength` → `/tests/lazy-motion/featureless-m-props`.

**1.6 E2E** (painted-frame probes as in Conventions; every probe returns per-frame records and the spec asserts
on all of them):

| # | Spec / case | Label | Why |
| --- | --- | --- | --- |
| E1 | `featureless-m.spec.ts` `a bare m keeps initial and ignores hover`: remove `test.fail`; replace `sampleOpacity` with a 60-frame in-page rAF probe of computed opacity (every frame `0.4 ± 0.01`); keep the hover check | RED | measured `0.71, 0.92, 1` (report §1.1) |
| E2 | `… async LazyMotion waits for its bundle, then animates in`: remove `test.fail`; per-frame probe before `load`; after `load`, a probe that sees opacity rise monotonically from about 0.4 to 1 | RED | report §1.1 |
| E3 | control card (existing) | GUARD | report §1.1 |
| E4 | `basic.spec.ts:12` rewritten: hover each bundle card and probe the scale per frame. `domMin` stays at 1 on every frame; `domAnimation`, `domMax` and `motion-in-domMin` reach about 1.15. Also assert `tabindex="0"` on all four | RED (the `domMin` `tabindex`) / GUARD (hover) | `domMin` has no `tabindex` today |
| E5 | `featureless-m-presence.spec.ts` `a featureless m with exit leaves at once`: click `toggle-exit` in the probe; on every frame from the first: `exit-bare` not in the DOM and `[data-clone="true"]` count for it 0 (the control's clone is identified by its own `data-testid`) | RED | clone path runs without a node (`:868-897`) |
| E6 | `… control m exits with a clone`: the control's clone is painted on ≥ 3 frames | GUARD | |
| E7 | `… wait mode reveals a featureless entrant`: click `swap-enter`; within 2 s a frame exists where `wait-old` is gone, and on every frame after it `wait-new` has `display !== 'none'` | GUARD | today `runAnimation` reveals it; A1 without Design 5 would not |
| E8 | `… a featureless entrant stays at initial`: on every frame after `wait-new` is revealed (for 60 frames), opacity is `0.4 ± 0.01` | RED | today the bare `m` animates to 1 |
| E9 | `… a featureless leaver doesn't hold the next child`: click `swap-leave`; on the first frame after the click `leave-old` is gone and `leave-new` is in the DOM and not `display:none` | RED | today the bare `m`'s exit raises `inFlightExits` and blocks the entrant for the 0.6 s exit |
| E10 | `featureless-m-props.spec.ts` `tap`: `tap-bare`, `tap-control` and `tap-dommin` have `tabindex="0"`; three `Tab` presses focus them in order (`document.activeElement`) | GUARD (`tap-bare`, `tap-control`) / RED (`tap-dommin`) | bare and control get `tabIndex` from `press()` today; `domMin` gets none |
| E11 | `… a tap on a featureless m does nothing`: click `tap-bare` and `tap-control`; `tap-bare-count` stays `0`, `tap-control-count` becomes `1` | RED | today the bare `m` has gestures |
| E12 | `… a style MotionValue doesn't move a featureless m`: click `nudge`; for 60 frames `elementFromPoint` at `style-bare`'s resting centre always hits `style-bare`, and the control's computed transform reaches `translateX(120px)` | RED (bare) / GUARD (control) | the reactive style path moves the bare box today |
| E13 | `… a featureless m.path is painted and stays short`: on 60 consecutive frames `path-bare` has `visibility !== 'hidden'` and the same `stroke-dasharray` as the first frame; `path-control`'s `stroke-dasharray` changes | GUARD (visible) / RED (stays short) | today the hold drops in the lifecycle, and the bare path animates |

**Verify**: run each new or changed unit file with `pnpm exec vitest run <file>`, then the consumer SSR command,
then `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion`. Record a table: case, expected label, observed.
Every RED fails for the stated reason and every GUARD passes.

- If a GUARD fails, STOP.
- If a RED passes, STOP, except U12: relabel it GUARD and report it (see its note).
- `consumer-vite6 test` stops at the first failing `assert`. Comment out the RED asserts one at a time to confirm
  the GUARDs pass, then restore them.

Commit all of Step 1 (red included).

### Step 2: Port prototype A1

1. `git diff 44939354 de5bed92 -- src/lib/components/LazyMotion.svelte src/lib/components/lazyMotion.context.ts
   src/lib/components/motionDomProjection.context.ts src/lib/components/visualElementTree.context.ts
   src/lib/components/__tests__/LazyMotionContextProbe.svelte src/lib/html/_MotionContainer.svelte | git apply`
   (if it does not apply cleanly, STOP).
2. Rewrite every `Spike 011 A` comment as a normal comment that cites upstream
   (`use-visual-element.ts:60-87`, `LazyMotion/index.tsx:52-66`). Give `createNodes` a full JSDoc (what it creates,
   `@param late`, when it runs). Update the JSDoc of `setVisualElementParent` / `getVisualElementParent` /
   `setMotionDomProjectionParent` / `getMotionDomProjectionParent`, including their `@example` blocks, to the getter
   signatures. In `LazyMotion.svelte` add a comment that a rejected loader publishes nothing, as upstream (no
   `.catch` at `LazyMotion/index.tsx:60`).
3. Add `const startedFeatureless = untrack(() => featureless)` (with a `// svelte-ignore state_referenced_locally`
   if needed, as the prototype does for `createNodes(false)`) and a comment saying why it is constant (Design 1).

**Verify**: `pnpm exec vitest run src/lib/components/featurelessM.spec.ts` → U1-U5 pass, U9 passes (report §1.2
measured it green under A), and U6, U7, U8, U10, U11, U12 have the results Step 1 recorded or better. `pnpm check`
→ 0 errors. `grep -rn "Spike 011" src/lib` → no output.

### Step 3: Optimized appear and the `pathLength` hold

1. Add `!startedFeatureless &&` to the `optimizedAppearId` condition (`:1398-1410`, with a comment citing Design 3).
   Revert the prototype's `!featureless &&` in `renderedOptimizedAppearScript` to the original expression.
2. In `inlineStyleBaseWithHolds`, the hold condition becomes
   `initialKeyframes && 'pathLength' in initialKeyframes && isLoaded === 'mounting' && !startedFeatureless`.
   Update the hold comment at `:1484-1490`.

**Verify**: U10 and U11 pass; the consumer SSR command passes S1, S2 and S5. E1 and E2 pass
(`PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion/featureless-m.spec.ts`).

### Step 4: `tabindex` from props

Replace the `tabindex` entry in `derivedAttrs` with the upstream condition (Design 2), and update its comment:
cite `use-props.ts:76-81` and say that motion-dom's `press()` adds `tabIndex` on mount for the `onTapCancel`-only
case on the client. Remove `resolvedWhileTap`, `resolveWhile` and `isNativelyFocusable` if `grep -n` shows no
other use in the file. Delete `a11y.ts` and its spec if nothing else imports it (Scope).

**Verify**: `pnpm exec vitest run src/lib/components/tapTabindex.spec.ts src/lib/html/_MotionContainer.spec.ts
src/lib/components/LazyMotion.spec.ts` → all pass. The consumer SSR command passes S3 and S6. `grep -n
"hasGestureFeatures &&" src/lib/html/_MotionContainer.svelte` shows no line in `derivedAttrs`.

### Step 5: Style MotionValues

1. Add `captureMotionStyleValues` and `freezeMotionStyle` to `src/lib/utils/style.ts` (Design 4), each with JSDoc
   and an `@example`. In `style.spec.ts` add one `describe` per helper. Cases:
   - `captureMotionStyleValues`: no MotionValues → `undefined`; MotionValues → their values; reading does not
     subscribe (call inside `$effect.root` with a counter, or assert `.get()` is wrapped by `untrack`).
   - `freezeMotionStyle`: replaces MotionValues; drops uncaptured ones; leaves raw values; returns strings unchanged.
2. Add `latestValues?: ResolvedValues` to `CreateMotionVisualElementOptions` (JSDoc citing upstream
   `use-visual-state.ts:134-142` and `VisualElement.ts:437-446`). In `visualElementCore.spec.ts` add a case
   showing that a node created with `latestValues: { x: 0 }` and `props: { style: { x } }`, where `x` is at 50,
   sets `x` back to 0.
3. In the container: take the two snapshots at init (client, `startedFeatureless`). Use them in
   `serializedStyleProp` and in the no-node branch of `renderedInlineStyle` while
   `typeof window !== 'undefined' && !visualElement`. Pass `latestValues: featurelessLatestValues` from
   `createNodes(true)`. Delete the fallback style `$effect` and its comment block (`:974-994`), plus imports that are
   now unused.

**Verify**: `pnpm exec vitest run src/lib/utils/style.spec.ts src/lib/utils/visualElementCore.spec.ts
src/lib/components/featurelessM.spec.ts` → all pass, including U6, U7 and U8. `PW_PORT=4220 pnpm exec playwright
test e2e/lazy-motion/featureless-m-props.spec.ts e2e/motion e2e/utilities` → all pass. E12 is green, and
`e2e/motion` and `e2e/utilities` cover object-style MotionValues on `motion.*`.

### Step 6: AnimatePresence

Apply Design 5: add the node guard to the three effects, and add the wait-reveal effect after
`revealWaitHiddenElement`, with a comment citing `exit.ts:73-83` and `PresenceChild.tsx:104-113`.

**Verify**: U12 passes (RED or relabelled GUARD). `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion/featureless-m-presence.spec.ts
e2e/animate-presence` → all pass.

### Step 7: Docs, example, JSDoc, changeset

1. `src/lib/m.ts:8-15`: an `m` outside any `<LazyMotion>`, or while an async bundle loads, has no features. It
   renders `style`, `initial`, `tabindex` and the drag styles, and animates in from `initial` once a bundle loads.
2. `docs/src/routes/docs/lazy-motion/+page.svx`:
   - Intro (`:22-24`): add that an `m` outside `LazyMotion` renders its `style` and `initial` and does nothing
     else.
   - `## Async loading` (`:52`): replace "renders with `domMin` first" with: the subtree renders `initial` until the
     bundle resolves, then animates in. If the loader rejects, `m` stays as rendered.
   - `## Reorder with LazyMotion` (`:80`): `Reorder` from the `m` entry does nothing without a `LazyMotion` that
     provides `domMax`.
   - Add a short `## Without LazyMotion` section with a two-line example.
3. `docs/src/routes/docs/gestures/+page.svx`, after the "Keyboard accessible" paragraph (`:74`): `whileTap`,
   `onTap` and `onTapStart` add `tabindex="0"` unless you set `tabindex`, matching Motion.
4. `docs/src/routes/docs/optimized-appear/+page.svx`, in the list at `:37-42`: "The element is a `motion` component,
   or an `m` component whose `LazyMotion` bundle is loaded synchronously."
5. Example: create `docs/src/lib/examples/lazy-motion/demos/AsyncFeatures.svelte`, modelled on `FeatureBundles.svelte`
   (same `dk-strip` shell comment, same `styleString` look). It has a bare `m.div` card that stays at `initial`, and
   an async card with a "Load features" button whose loader resolves `domAnimation` when pressed, then animates in.
   Add a `FIG-004` section (`tag: 'ASYNC'`) to `docs/src/routes/examples/lazy-motion/+page.svelte`, the same shape
   as FIG-002, with notes on both behaviours. Regenerate the demo registry with the docs build command.
6. `.changeset/featureless-m.md`, `patch`:
   > **Behaviour change (Motion parity):** `m` components now match Motion's `LazyMotion`. Without a `LazyMotion`
   > above them, or while an async `features` bundle is loading, they have no animation runtime: they render
   > `style`, `initial`, `tabindex` and the drag styles, and run no animation, gesture, drag, layout or exit (an
   > `AnimatePresence` removes them at once). When the bundle loads they animate in from `initial`. Previously an
   > `m` outside `LazyMotion` had every feature and a pending bundle gave it `domMin`. 
   >
   > **Visible change:** as in Motion, `onTap`, `onTapStart` and `whileTap` now add `tabindex="0"` from props
   > whenever `tabindex` is not set. This includes server-rendered markup, buttons and links, and `whileTap`
   > variant labels that don't resolve. Previously only a resolved `whileTap` on a non-focusable element added it.
   > Set `tabindex` yourself to opt out.

   Step 9 appends one more paragraph to this changeset.

**Verify**: `pnpm --filter docs check` → 0 errors. The docs build command exits 0, and `git diff --stat
docs/src/lib/demo-loaders.ts docs/src/lib/demo-manifest.json` shows the new `AsyncFeatures.svelte` entry.

### Step 8: Full gate

Run in order, all must pass:

1. `pnpm check` → 0 errors.
2. `pnpm test:only` → all pass.
3. `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → passes.
4. `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion e2e/layout e2e/layout-id e2e/animate-presence e2e/variants e2e/motion e2e/utilities`
   → all pass (the spike's guard suites plus `motion` / `utilities` for Step 5).
5. `PW_PORT=4220 pnpm exec playwright test` (full suite) → all pass. If a spec outside those directories fails,
   follow the CLAUDE.md "Failed e2e review workflow". Re-run that one spec on its own; if it passes alone, record it
   as flaky. If not, STOP and report it.
6. `trunk fmt` then `trunk check` on every file you changed → no new issues.

### Step 9: Owned-snippet presence (final; gated on 012 and 015b)

**9.0 Precondition.** 015b and 012 both edit `PresenceChild.svelte`, so this step runs only after both have merged
into `feat/motion-14.7.1`. Check:
`git show feat/motion-14.7.1:.agents/.plans/motion-14-7-1/README.md | grep -E '^\| \[(012|015b)\]' | grep -c DONE`
→ must print `2`. Also check `git log --oneline feat/motion-14.7.1 -- src/lib/components/PresenceChild.svelte | head -5`
and record the newest commit in your report.

- If the count is not `2`, STOP (see STOP conditions). Steps 1-8 stand on their own, so commit them and report.
- If it is `2`: `git merge --no-ff feat/motion-14.7.1`, `pnpm install --frozen-lockfile`, re-run Step 8's gate items
  1-4 (all pass). Then re-read `PresenceChild.svelte`'s exit-start branch and `presenceExitRegistry.ts`. If the
  `phase = 'holding'` → `mintSafeToRemove()` → `exitRegistry.begin(…)` → `notifyExitStart()` sequence quoted in
  Design 7 is gone, or the registry no longer has the `!participated` early return, STOP and report the new shape.

**9.1 Red tests.** Probe `FeaturelessOwnedProbe.svelte`:
`<AnimatePresence present={present} onExitComplete={onExitComplete}>{#snippet child()}<m.div data-testid="owned" exit={{ opacity: 0 }} transition={{ duration: 1 }} />{/snippet}</AnimatePresence>`,
with no `LazyMotion`. Copy the snippet form from `__tests__/AnimatePresenceOwnedChildHarness.svelte`. Add a
`withConsumer` prop that also renders a small child calling `usePresence()` and exposing its `safeToRemove` on a
`data-` hook or an exported function.

| # | Case | Label | Why, at the post-merge lane tip (Steps 1-8 done) |
| --- | --- | --- | --- |
| O1 | rerender `present: false`; `await tick()`, then one microtask: `owned` is gone and `onExitComplete` was called once | RED | the featureless `m` registers nothing and the empty registry holds (`presenceExitRegistry.ts:27-28`) |
| O2 | `withConsumer: true`: after `present: false`, `owned` is still rendered after flushing timers ×3; calling the consumer's `safeToRemove` removes it and calls `onExitComplete` once | GUARD | today the wrapper holds until `safeToRemove`; it must stay held once `usePresence` registers |
| O3 | a featured `motion.div` with `exit` in the same owned snippet still waits for its exit (existing owned-child cases in `_MotionContainer.spec.ts:714-760`) | GUARD | registered participant |
| O4 | e2e: an owned card on `featureless-m-presence` (bare `m.div` in `<AnimatePresence present={…}>`, button `toggle-owned`). Per-frame probe: from the first frame after the click the element is gone | RED | it holds today |

Rewrite `presenceExitRegistry.spec.ts:20` (`holds an empty manual wrapper …`) into
`completes an empty wrapper (upstream PresenceChild.tsx:104-113)`. It is **RED**: today `done` is not called.

**Verify**: O1, O4 and the rewritten registry case FAIL for the stated reasons; O2 and O3 pass. Commit.

**9.2 Fix (upstream `PresenceChild.tsx:76-113`, `use-presence.ts:52-62`).**

1. `presenceExitRegistry.ts`: an exit cycle with no participants completes. Expose this as a method, for example
   `completeIfEmpty()`, that calls `finish` when `active && participants.size === 0`. Remove the `!participated`
   rule and the "Empty manual wrappers intentionally keep their hold" sentence from the JSDoc. Update the
   registry spec.
2. `PresenceChild.svelte`: after `animatePresence?.notifyExitStart()` in the exit-start branch (`:322-325`), call
   `exitRegistry.completeIfEmpty()` from a `queueMicrotask`. That runs after Svelte's synchronous flush, like
   upstream's post-commit `useEffect`. The existing `currentSafeToRemove !== self` / `phase !== 'holding'` checks
   in `mintSafeToRemove` make it a no-op after a re-entry. Add a comment citing `PresenceChild.tsx:104-113`.
3. `usePresence.ts`: when called during component init inside a `PresenceChild`, register once
   (`context.register(id)` with a per-call id, unregistered `onDestroy`), as upstream `use-presence.ts:52-57` does.
   While not present, `safeToRemove` completes only that participant (`context.onExitComplete(id)`), as upstream
   does at `:59-62`. `useIsPresent` must not register (upstream `useIsPresent` reads the context only). Keep the
   existing stale-cycle protection. Update the JSDoc: it no longer releases the whole wrapper, it releases itself,
   and the wrapper is removed once every participant is done. If `usePresence` can be called outside init in the
   existing call sites (`grep -rn "usePresence()" src docs/src`), STOP.
4. Docs `docs/src/routes/docs/use-presence/+page.svx`: rewrite the `safeToRemove` paragraph to match. Append to the
   changeset:
   > Inside `<AnimatePresence present>` / `PresenceChild`, a wrapper with nothing holding it now leaves at once,
   > as in Motion: a plain element, or an `m` with no LazyMotion features. `usePresence()` registers its component
   > and its `safeToRemove` releases only that component; the wrapper leaves once every registered component is done.

**Verify**: O1-O4 and the registry spec pass. `pnpm exec vitest run src/lib/utils/presenceExitRegistry.spec.ts
src/lib/components src/lib/html/_MotionContainer.spec.ts` → all pass.
`PW_PORT=4220 pnpm exec playwright test e2e/animate-presence e2e/lazy-motion` plus every spec under `e2e/` that
mentions `use-presence` (`grep -rl "use-presence" e2e`) → all pass. Then re-run the whole Step 8 gate.

## Test plan

- Anchors: U1-U3, U6, U8, U9, U11, U12 (unless relabelled GUARD in Step 1), T1, T2, T4, T5, the rewritten `_MotionContainer.spec.ts` case,
  LazyMotion `:47`, `:61` and `:77`, S1, S3 (`m-async`), S5 (`m-path`), S6 (first four), E1, E2, E4 (`domMin`
  `tabindex`), E5, E8, E9, E10 (`tap-dommin`), E11, E12 (bare) and E13 (stays short). All are red at `ea4bf8fd`
  and green after Step 6.
- Guards that would catch a naive A1 build: U10, E7, E13 (visible) and E10 (`tap-bare`). Each passes today
  only because the bare `m` has a node, so Steps 3, 4 and 6 must keep them green.
- Guards for unchanged behaviour: U4, U5, U7, T3, T6, the LazyMotion rewrites at `:54`, `:87` and `:106`, S2, S4,
  `motion-path` in S5, `on-tap-cancel` in S6, E3, E6, E12 (control), O2 and O3 (Step 9), and every existing
  `motion.*` test. Step 9 anchors: O1, O4 and the rewritten `presenceExitRegistry.spec.ts:20` case.
- New helper tests: `captureMotionStyleValues`, `freezeMotionStyle` (`style.spec.ts`) and the `latestValues`
  option (`visualElementCore.spec.ts`).

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm test:only` exits 0
- [ ] `pnpm build` exits 0 (publint clean); consumer SSR prints its success line
- [ ] `PW_PORT=4220 pnpm exec playwright test` passes, except flakes recorded in your report, each one re-run alone
      and passing
- [ ] `grep -rn "it.fails\|test.fail" src/lib/components/featurelessM.spec.ts e2e/lazy-motion/featureless-m.spec.ts` → no output
- [ ] `grep -rn "Spike 011\|spike 011" src/lib src/routes e2e` → no output
- [ ] `grep -n "domMin" src/lib/components/LazyMotion.svelte` → no output
- [ ] `grep -n "isNativelyFocusable\|resolvedWhileTap" src/lib/html/_MotionContainer.svelte` → no output
- [ ] `grep -n "if (!element || visualElement) return" src/lib/html/_MotionContainer.svelte` → no output (fallback style effect gone)
- [ ] `git diff --stat ea4bf8fd..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/presence.ts package.json` → no `"version"` change and no change to those two source files
- [ ] Either Step 9 is done (O1-O4 green, `PresenceChild.svelte` / `presenceExitRegistry.ts` / `usePresence.ts` changed only after the Step 9.0 merge commit), or Step 9 stopped on its precondition and those three files are unchanged since `ea4bf8fd`; your report says which
- [ ] `git status` clean apart from the in-scope list; no file from `featurelessM.divergence.spec.ts` / `FeaturelessDivergenceProbe.svelte` on the lane
- [ ] `.changeset/featureless-m.md` exists; new pages linked from `src/routes/+page.svelte`; docs example FIG-004 renders in the docs build

## STOP conditions

- The spike diff does not `git apply` cleanly, or Step 2's verify shows U1-U5 or U9 red.
- Any `motion.*` unit or e2e result changes at any step. Likely causes: a `$state.raw` read in an effect that also
  writes it, or a change to the adapter-mount → VE-mount ordering (`:1968` before `:2022` at the planned-at SHA).
- A guard in Step 1 fails, or a RED other than U12 passes before the fix.
- Step 5 changes SSR markup for any `motion.*` component with object styles (the server path must not change).
- U8's reset (or E12) breaks an existing test. That would mean a MotionValue was relied on to keep a value set
  before a lazy bundle arrived. Report it rather than weakening U8.
- Any of Steps 1-8 needs `motionDomProjection.ts`, `presence.ts`, `PresenceChild.svelte`, `presenceExitRegistry.ts`,
  `usePresence.ts` or motion-dom changes. Step 9 may change only the three files its scope names, and never
  `presence.ts`.
- **Step 9 precondition not met** (see Step 9.0). Report "016 Steps 1-8 done; Step 9 waiting for 012/015b" and
  stop there. This is the expected outcome while 012 is still in flight.
- Step 9: making `usePresence` register breaks an existing `usePresence` / `useIsPresent` call pattern (for example
  `$derived(usePresence())`, `docs/src/routes/docs/use-presence`) in a way the plan doesn't describe.
- A docs build failure that is not caused by this plan (for example the github-stats fetch). Report it; do not
  work around it.

## Maintenance notes

- Gating rule for future work: markup decisions use `startedFeatureless` (it must match on the server and the
  client); node behaviour uses `visualElement` being non-null. A new feature that adds attributes must decide which
  one applies. The adapter and the node are now `$state.raw`. Effects that read them re-run once when a late node
  arrives, so never write those bindings from inside an effect that reads them.
- **Late-bundle MotionValue reset (accepted, upstream)**: when a featureless `m`'s bundle arrives, each style
  MotionValue is set back to its first-render value. A `set()` made while the `m` was featureless is lost
  (motion-dom `render/VisualElement.ts:437-446`, fed by the `latestValues` snapshot from Design 4; U8 pins it).
  Don't "fix" this without an upstream change.
- **Owned-snippet presence**: Step 9 adopts upstream (an empty `PresenceChild` completes after the exit-start
  commit; `usePresence` registers and releases only itself). If Step 9 stopped on its precondition, the
  owned-snippet featureless `m` still holds until `safeToRemove`. A follow-up dispatch of Step 9 alone closes it
  once 012 and 015b are in `feat/motion-14.7.1`. Every later change to `PresenceChild`'s exit start must keep
  `notifyExitStart` before any completion.
- `LazyMotion` still reloads when `features` changes after mount (upstream loads once). While a new async loader is
  pending it publishes `undefined`, so an existing node loses its gesture, drag and layout gates (`has*Features`)
  but keeps its node and its exit. Revisit this if that reload is ever removed.
- A featureless `m` stays `data-is-loaded="mounting"` and never sets `window.MotionIsMounted`. Test helpers must not
  wait on either for such an element.
- The `tabindex` change adopts upstream over #349's resolved-label rule and adds `tabindex="0"` to natively
  focusable tags with tap props. Reviewers should expect the rewritten `_MotionContainer.spec.ts` case and the
  changeset sentence.
- Reviewers should scrutinise the diff of `_MotionContainer.svelte` against `git diff 44939354 de5bed92`. Anything
  beyond that diff should trace to Steps 3-6.
