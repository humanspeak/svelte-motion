# Plan 001: Establish one motion-dom VisualElement per motion component (inert foundation)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte src/lib/utils/visualElementCore.ts src/lib/components/visualElementTree.context.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (architecture migration, GitHub issue #449)
- **Planned at**: commit `7eba0bd`, 2026-07-24

## Why this matters

svelte-motion currently animates through ~6 independent "writer" systems (enter
animations, `animate`-prop re-runs, gesture animations, layout FLIP, drag, exit
clones) that each start their own animations and write styles directly. Upstream
Framer Motion routes ALL of this through one `VisualElement` per component with
`createAnimationState` — giving priority-ordered variant types, protected keys,
and velocity-continuous single-writer rendering for free. This plan lays the
foundation: exactly one `HTMLVisualElement`/`SVGVisualElement` per motion
component, created/mounted/updated/unmounted on the Svelte lifecycle, with the
animation feature registered — but **completely inert** (no rendering, no
animation started through it). Behavior must not change. Plans 002–005 then move
each writer onto it.

## Current state

- `src/lib/html/_MotionContainer.svelte` (3471 lines) — the single component
  behind every `motion.*` element. It does NOT create a VisualElement itself.
- `src/lib/utils/motionDomProjection.ts` — **already creates an
  `HTMLVisualElement`**, but only for layout projection, and only when layout
  features are used. Lines 150–168:

```ts
// src/lib/utils/motionDomProjection.ts:150-168
constructor(options: MotionDomProjectionOptions = {}) {
    const parent = options.parent ?? null
    this.getBaseTransform = options.getBaseTransform
    this.visualElement = new HTMLVisualElement(
        {
            parent: parent?.visualElement,
            props: {},
            presenceContext: null,
            visualState: createVisualState()
        },
        { allowProjection: true }
    )
    this.projection = new HTMLProjectionNode(
        this.visualElement.latestValues,
        parent?.projection as unknown as IProjectionNode | undefined
    )
    this.visualElement.projection = this.projection
    MotionDomProjectionAdapter.adapters.set(this.projection, this)
}
```

Its `mount(element)` calls `this.visualElement.mount(element)`
(`motionDomProjection.ts:214-222`) and `unmount()` calls
`visualElementStore.delete(element)` (`:234-247`). `updateOptions` calls
`this.visualElement.update({ transition, style } as never, null)` (`:186-192`).

- **Critical constraint**: `visualElementStore` (motion-dom) is a
  `WeakMap<instance, VisualElement>` populated inside `VisualElement.mount()`.
  Two VisualElements mounted on the same DOM element would overwrite each other
  in the store and double-render. There must be exactly ONE VisualElement per
  element — this plan makes the container own it and injects it into the
  projection adapter.
- The container constructs the adapter at `_MotionContainer.svelte:388-434`
  (search for `motionDomProjection =`), gated on layout features; adapter
  mount/unmount effects are at `:2457-2482`.
- Installed `motion-dom` is **12.42.2** (`package.json` dependencies; also
  `motion` 12.42.2 which does NOT re-export any VisualElement API — import from
  `motion-dom` directly). Everything needed is exported from `motion-dom`:
  `HTMLVisualElement`, `SVGVisualElement`, `VisualElement` (type/abstract),
  `createAnimationState`, `animateVisualElement`, `visualElementStore`,
  `variantPriorityOrder`, `variantProps`, `resolveMotionValue`,
  `isControllingVariants`, `isVariantNode`, `isAnimationControls`,
  `resolveVariantFromProps`, `scrapeHTMLMotionValuesFromProps`,
  `scrapeSVGMotionValuesFromProps`, `Feature`, `setFeatureDefinitions`,
  `getFeatureDefinitions`, `isSVGElement`.
- Key installed API shapes (from `node_modules/motion-dom/dist/index.d.ts`):

```ts
// index.d.ts:1115-1137
interface VisualState<_Instance, RenderState> {
    latestValues: ResolvedValues
    renderState: RenderState
}
interface VisualElementOptions<Instance, RenderState = any> {
    visualState: VisualState<Instance, RenderState>
    parent?: any
    variantParent?: any // declared but NOT consumed by the constructor
    presenceContext: PresenceContextProps | null // required; pass null for now
    props: MotionNodeOptions // required
    blockInitialAnimation?: boolean
    reducedMotionConfig?: ReducedMotionConfig // 'always' | 'never' | 'user'
    skipAnimations?: boolean
    isSVG?: boolean // declared but NOT consumed — pick the class yourself
}
// index.d.ts:1470-1480
interface AnimationState {
    animateChanges: (type?: AnimationType) => Promise<any>
    setActive: (type: AnimationType, isActive: boolean, options?) => Promise<any>
    setAnimateFunction: (fn: any) => void
    getState: () => { [key: string]: AnimationTypeState }
    reset: () => void
}
declare function createAnimationState(visualElement: any): AnimationState
```

- `HTMLRenderState` shape: `{ transform: {}, transformOrigin: {}, style: {}, vars: {} }`;
  `SVGRenderState` adds `attrs: {}` (index.d.ts:1188-1217). There is **no
  exported visualState builder** in motion-dom (`makeUseVisualState` /
  `createHtmlRenderState` live only in framer-motion) — you must build it.
  Reference implementation to port:
  `~/Github/motion/packages/framer-motion/src/motion/utils/use-visual-state.ts`
  (`makeLatestValues`, lines 60–132) — resolve motion values scraped from
  `style`, apply variant inheritance from parent context when the node is a
  variant node that isn't controlling variants, pick `initial` unless
  `initial === false` (then `animate`), resolve via `resolveVariantFromProps`,
  copy target keys (keyframe arrays → index 0, or LAST keyframe when initial
  animation is blocked), then apply `transitionEnd`.
- Lifecycle semantics (from motion-dom `dist/es/render/VisualElement.mjs`):
  `mount(instance)` sets `current`, registers in `visualElementStore`, mounts
  projection, binds values, resolves reduced motion, adds to parent, **and then
  calls `this.update(this.props, this.presenceContext)` itself** — which runs
  `updateFeatures()`, instantiating registered features whose
  `isEnabled(props)` returns true. `unmount()` cancels frames, removes
  subscriptions, unmounts features, sets `current = null` (it does NOT delete
  the store entry — the adapter does that explicitly today; keep doing it).
- motion-dom ships **zero Feature implementations** (`grep -rl "extends Feature"
node_modules/motion-dom/dist/es` → no matches). The consumer registers them.
  Reference (~20 lines): `~/Github/motion/packages/framer-motion/src/motion/features/animation/index.ts`
  — constructor: `node.animationState ||= createAnimationState(node)`;
  `mount()`: subscribe `props.animate` when `isAnimationControls(animate)`;
  `unmount()`: `animationState.reset()`. Feature-enable prop list:
  `~/Github/motion/packages/framer-motion/src/motion/features/definitions.ts:5-24`
  (animation is enabled by any of `animate, variants, whileHover, whileTap,
exit, whileInView, whileFocus, whileDrag`).
- Upstream merges MotionConfig under props before handing them to the
  VisualElement: `configAndProps = { ...useContext(MotionConfigContext), ...props, layoutId }`
  (`~/Github/motion/packages/framer-motion/src/motion/index.tsx:100-104`) —
  so `transition` from MotionConfig becomes `visualElement.props.transition`
  unless the component overrides it.
- Repo conventions: Svelte 5 runes; context modules named
  `src/lib/components/<name>.context.ts` (see `layoutGroup.context.ts`,
  `motionDomProjection.context.ts` as exemplars); Google-style JSDoc on all
  exported functions/types; unit tests colocated as `*.spec.ts`.

## Commands you will need

| Purpose      | Command                                                           | Expected on success |
| ------------ | ----------------------------------------------------------------- | ------------------- |
| Install      | `pnpm install`                                                    | exit 0              |
| Typecheck    | `pnpm check`                                                      | 0 errors            |
| Unit tests   | `pnpm test:only`                                                  | all pass            |
| Targeted e2e | `pnpm test:e2e e2e/motion e2e/layout e2e/projection e2e/variants` | all pass            |
| Format       | `trunk fmt`                                                       | exit 0              |
| Lint         | `trunk check`                                                     | no new issues       |

(Trunk is the lint authority — `.trunk/trunk.yaml` exists; do not use
`pnpm lint`/prettier directly.)

## Suggested executor toolkit

- Upstream reference source: `~/Github/motion/packages/framer-motion/src` and
  `~/Github/motion/packages/motion-dom/src` — cite file:line in code comments
  when porting semantics (repo convention, see the header of
  `src/lib/utils/gestureCoordinator.ts`).
- Installed API truth: `node_modules/motion-dom/dist/index.d.ts`.

## Scope

**In scope** (the only files you should modify/create):

- `src/lib/utils/visualElementCore.ts` (create)
- `src/lib/utils/visualElementCore.spec.ts` (create)
- `src/lib/components/visualElementTree.context.ts` (create)
- `src/lib/utils/motionDomProjection.ts` (accept an injected VisualElement)
- `src/lib/utils/motionDomProjection.spec.ts` (update for injection)
- `src/lib/html/_MotionContainer.svelte` (create/mount/update/unmount the VE;
  provide/consume the parent-VE context; inject into the adapter)

**Out of scope** (do NOT touch, even though they look related):

- Any animation behavior: no `animateChanges`, no `setActive`, no motion-value
  binding to the VE, no style rendering through the VE. That is plans 002–005.
- `src/lib/utils/gestureCoordinator.ts`, `hover.ts`, `interaction.ts`,
  `drag.ts`, `layout.ts`, `presence.ts` — untouched in this plan.
- `src/lib/index.ts` public exports — nothing new is public yet.

## Git workflow

- Work on the current branch `issue-449-visual-element-core`.
- Commit per step; conventional-commit style, e.g.
  `feat(core): create per-component VisualElement lifecycle (#449)`.
- Do NOT push or open a PR.

## Steps

### Step 1: Create `src/lib/utils/visualElementCore.ts`

Export, with Google-style JSDoc and upstream citations:

1. `registerMotionFeatures(): void` — idempotent (module-level flag). Calls
   `setFeatureDefinitions({ animation: { isEnabled, Feature: AnimationFeature } })`.
   `AnimationFeature extends Feature<unknown>` ported from
   `framer-motion/src/motion/features/animation/index.ts` (constructor sets
   `node.animationState ||= createAnimationState(node)`; `mount()` subscribes
   `props.animate` when `isAnimationControls(...)` — for now the subscribe call
   is a no-op guard because our `animationControls` object shape differs; leave
   a `// plan 002` comment; `unmount()` calls `animationState.reset()`).
   `isEnabled(props)` returns true when any of `animate, variants, whileHover,
whileTap, exit, whileInView, whileFocus, whileDrag` is present (port of
   `definitions.ts:5-24`).
2. `makeLatestValues(props, context, presenceContext, scrapeMotionValues)` —
   port of `use-visual-state.ts:60-132` as described in Current state. `context`
   is `{ initial?, animate? }` (variant labels inherited from the parent).
3. `createRenderState(isSVG: boolean)` — returns
   `{ style: {}, transform: {}, transformOrigin: {}, vars: {} }` plus
   `attrs: {}` when SVG (port of framer-motion's `create-render-state.mjs`).
4. `createMotionVisualElement(opts)` where `opts = { props, parent, presenceContext,
reducedMotionConfig, skipAnimations, isSVG, blockInitialAnimation }` —
   calls `registerMotionFeatures()`, builds
   `visualState = { latestValues: makeLatestValues(...), renderState: createRenderState(isSVG) }`,
   returns `new (isSVG ? SVGVisualElement : HTMLVisualElement)({ ... }, { allowProjection: true })`.
   Use `scrapeSVGMotionValuesFromProps` vs `scrapeHTMLMotionValuesFromProps`
   accordingly.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Create the VE parent context

`src/lib/components/visualElementTree.context.ts` following the pattern of
`src/lib/components/motionDomProjection.context.ts`: `setVisualElementParent(ve)`,
`getVisualElementParent(): VisualElement | undefined`, key via a module-level
`Symbol`. JSDoc per repo convention.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Unit-test the core module

`src/lib/utils/visualElementCore.spec.ts` (model structure on
`src/lib/utils/motionDomProjection.spec.ts`). Cover at minimum:

- `makeLatestValues` with object `initial` → those values.
- keyframe array in `initial` → index 0; with `initial === false` → last
  keyframe of `animate`.
- variant-label `initial` + `variants` map → resolved values.
- `initial === false` → resolves from `animate`.
- inherited variant: `props` without own `initial`, `context.initial` set,
  node is a variant node not controlling variants → parent's label resolves.
- `createMotionVisualElement` returns `SVGVisualElement` when `isSVG`, else
  `HTMLVisualElement`; `registerMotionFeatures` twice → single registration
  (use `getFeatureDefinitions()`).
- mounting the created VE on a detached `document.createElement('div')` sets
  `visualElementStore.get(el)` to that VE, and `animationState` exists after
  mount when `props.animate` present (feature constructed), and does NOT exist
  when no animation props are present.

**Verify**: `pnpm test:only src/lib/utils/visualElementCore.spec.ts` → all pass.

### Step 4: Inject the VisualElement into `MotionDomProjectionAdapter`

In `motionDomProjection.ts`, add `visualElement?: ProjectionVisualElement` to
`MotionDomProjectionOptions`. In the constructor, use the injected instance when
provided and only construct the internal `HTMLVisualElement` as a fallback
(keeps existing unit tests working). Do not change `mount`/`unmount`/`updateOptions`
behavior. Update `motionDomProjection.spec.ts` with one new test: an injected
VE is used as `adapter.visualElement` and ends up in `visualElementStore` after
`mount`.

**Verify**: `pnpm test:only src/lib/utils/motionDomProjection.spec.ts` → all pass.

### Step 5: Wire the container

In `_MotionContainer.svelte`:

1. Near the projection setup (`:388-434`), create the VE once per component
   (client only — guard `typeof window !== 'undefined'`), when animation or
   layout features could apply:
   `parent = getVisualElementParent()`, `isSVG = isSVGTag(String(tag))`,
   `reducedMotionConfig` from the existing `motionConfig` context value,
   `skipAnimations` likewise, `props` = an adapter object built by a new local
   `buildMotionNodeProps()` that maps ONLY these Svelte props for now:
   `{ initial, animate: declarative animate only (exclude animation-controls objects),
variants, custom, transition: mergedTransition, whileHover, whileTap,
whileFocus, whileInView, whileDrag, exit, layoutId: scopedLayoutId }`.
   **Deliberately omit `style`** — scraping style MotionValues would bind them
   to the VE and make it render on their changes, fighting the current writers.
   Leave a `// plan 002: add style` comment.
2. Call `setVisualElementParent(ve)` so children see it.
3. Pass it into the adapter: `new MotionDomProjectionAdapter({ ..., visualElement: ve })`
   at the existing construction site. Note the adapter is only constructed when
   layout features are on; the VE exists regardless.
4. `$effect`: when `element` binds and VE not mounted → `ve.mount(element)`;
   cleanup on element change. `onDestroy` → `ve.unmount()` and
   `visualElementStore.delete(element)` (matching the adapter's current
   explicit delete). When the adapter exists, its `mount()` must NOT
   double-mount: change the container's adapter-mount effect to skip
   `visualElement.mount` when the injected VE is already mounted — simplest is
   to make `MotionDomProjectionAdapter.mount()` tolerate an already-mounted VE
   (`if (this.visualElement.current === element) skip the ve.mount call`, still
   seed layout).
5. `$effect`: on any tracked prop change, `ve.update(buildMotionNodeProps(), null)`.
   Use `untrack` where needed so this effect only tracks the props themselves.

**Verify**: `pnpm check` → 0 errors; `pnpm test:only` → all pass.

### Step 6: Full gate — prove zero behavior change

Run `trunk fmt`, then `trunk check`, then `pnpm test:only`, then
`pnpm test:e2e e2e/motion e2e/layout e2e/projection e2e/variants`.

**Verify**: all pass with no new failures (compare against a baseline run on the
unmodified branch if any of these suites fail before your change — record the
baseline in your report).

## Test plan

- No red-first test: this is a net-new inert code path with zero runtime
  behavior change; the regression gate is the existing unit + e2e suites.
- New unit tests: `visualElementCore.spec.ts` (Step 3 list),
  `motionDomProjection.spec.ts` injection test (Step 4).
- Verification: `pnpm test:only` all pass; targeted e2e suites all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `trunk check` reports no new issues
- [ ] `pnpm test:only` exits 0; `visualElementCore.spec.ts` exists with the
      Step 3 cases passing
- [ ] `pnpm test:e2e e2e/motion e2e/layout e2e/projection e2e/variants` exits 0
- [ ] `grep -n "new HTMLVisualElement" src/lib/utils/motionDomProjection.ts`
      shows the constructor call only in the no-injection fallback branch
- [ ] Exactly one VisualElement per element: `visualElementCore.spec.ts` has a
      test mounting container-style VE + adapter with injection and asserting
      `visualElementStore.get(el)` identity
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `.agents/.plans/visual-element-core/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts above don't match the live code (drift).
- Creating + mounting the inert VE changes ANY e2e result in the four targeted
  suites — that means the VE is not actually inert (most likely style motion
  values got scraped, or a feature is animating). Report which suite/spec.
- `MotionDomProjectionAdapter` turns out to depend on constructing its own VE
  in a way injection can't satisfy (e.g. `createVisualState()` does something
  `createMotionVisualElement` can't replicate — read it first).
- You need to touch `src/lib/index.ts` or any gesture/drag/layout/presence file.

## Maintenance notes

- Plans 002–005 build directly on `createMotionVisualElement` and the context;
  keep their signatures stable.
- Reviewer should scrutinize: single-VE invariant (store identity test), the
  omission of `style` from `buildMotionNodeProps()` (load-bearing for inertness),
  and that `registerMotionFeatures()` is idempotent (LazyMotion loads features
  dynamically — global registry must not be clobbered per component).
- Deferred deliberately: `presenceContext` stays `null` (plan 004),
  `manuallyAnimateOnMount`, optimized-appear interplay (plan 002).
