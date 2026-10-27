# Plan 014: Re-export the public, framework-agnostic Motion API we still hide (`createScopedAnimate`, `animateMini`, `inertia`, `keyframes`, `resolveElements`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Ordering**: this plan runs only after plan 009 (both phases) is merged into `feat/motion-14.7.1`. It needs
> 009's export tripwire (`src/lib/index.spec.ts`) and allowlist (`src/lib/__tests__/motionExportAllowlist.ts`).
>
> **Never use `git stash`** (one stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4222** (`PW_PORT=4222`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat ba910033..HEAD -- src/lib/index.ts src/lib/index.spec.ts src/lib/__tests__/motionExportAllowlist.ts src/lib/utils/animateValue.ts src/lib/utils/animate.svelte.ts src/routes/+page.svelte tests/consumer-vite6/verify-tree-shaking.mjs docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/routes/docs/api-reference/+page.svx`
> Expected: only changes from plans merged after `ba910033` (009 for sure; possibly 004, 006, 007, 008, 010).
> Re-check every "Current state" excerpt below against the live file before editing it; on a mismatch that this
> plan doesn't already anticipate, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive re-exports; one type-only re-cast; allowlist edits)
- **Depends on**: 009 (the tripwire and allowlist; and its Phase B `Timeline` return types in `animateValue.ts`)
- **Wave**: 4 (after 009 is merged into `feat/motion-14.7.1`; README merge order puts 014 last, after 013)
- **Category**: migration (upstream parity) + docs
- **Planned at**: `feat/motion-14.7.1` @ `ba910033` (Motion 14.7.1 pinned by 001), with 009's lane
  `lane/1471-animate` @ `2342935c` (Phase A, tripwire written), 2026-10-27

## Why this matters

`@humanspeak/svelte-motion` re-exports `motion`'s vanilla layer so users never need a second runtime dependency
(docs `api-reference/+page.svx`, "Re-exports from `motion`"). Plan 009 added a tripwire that makes every runtime
export of `motion` either re-exported or allowlisted. Its first allowlist parked 290 of `motion`'s 347 runtime
names (14.6.0) as "reviewed, not re-exported" without deciding which are public API. Some of them are. Upstream
hand-picks `createScopedAnimate` and `animateMini` next to `animate` in its framework-agnostic entry. motion.dev
documents `resolveElements`. `inertia` and `keyframes` are the siblings of `spring`, which we already
re-export. A React or vanilla user can import all five from `motion`/`framer-motion`; a Svelte user can't import
them from us. The maintainer's rule is to follow upstream: whatever upstream documents or hand-curates as public
and framework-agnostic gets re-exported. This plan audits all 291 names (290 plus `buildTransformer`, new in
14.7.1), re-exports the five that qualify with their types, docs and tests, and records why every other name stays
out. Names that need a Svelte design go on the follow-up list.

## Current state

### Ours

- `src/lib/__tests__/motionExportAllowlist.ts` (created by 009 Step 3). It exports
  `MOTION_EXPORTS_NOT_REEXPORTED: ReadonlySet<string>`, 290 names in 16 commented groups (verified at
  `2342935c`). The top comment ends: "The tripwire also fails on stale entries, so a name we start re-exporting
  must be removed from this list in the same change." 009 Phase B Step 6.4 adds every name that is new in 14.7.1
  under a `// new in Motion 14.7.1 — not yet reviewed for re-export` group. Only `buildTransformer` is new: the
  live runtime diff of `motion` 14.6.0 → 14.7.1 is `+buildTransformer`, nothing removed. So expect 291 names
  after 009 merges. (009's plan text says the export list "did not change"; that is off by this one name.) The
  five names this plan re-exports sit in these groups:
  - `// Animation engine classes and helpers …`: `animateMini`, `createScopedAnimate`, `inertia`, `keyframes`
  - `// Scope and element resolution internals`: `resolveElements`
- `src/lib/index.spec.ts`. Line 3 imports `MOTION_EXPORTS_NOT_REEXPORTED` from `./__tests__/motionExportAllowlist.js`.
  `describe('public API: index.ts')` opens with the tripwire (`:65-81` at `2342935c`):
  ```ts
  it('re-exports or deliberately skips every runtime export of motion', async () => {
      const motionExports = Object.keys(await import('motion')).sort()
      const ours = (await import('./index.js')) as Record<string, unknown>
      const unaccounted = motionExports.filter(
          (name) => !(name in ours) && !MOTION_EXPORTS_NOT_REEXPORTED.has(name)
      )
      expect(unaccounted, 'motion exports that are neither re-exported nor allowlisted').toEqual([])
      const stale = [...MOTION_EXPORTS_NOT_REEXPORTED].filter(
          (name) => !motionExports.includes(name) || name in ours
      )
      expect(stale, 'allowlist entries motion no longer exports, or that we now re-export').toEqual([])
  })
  ```
  Re-export checks follow the pattern at `:116-118`: `it('re-exports Motion 14.6 processFrame', () => { expect(typeof processFrame).toBe('function') })`.
- `src/lib/index.ts`. The runtime block `export { MotionGlobalConfig, cancelFrame, delay, drag, frame, frameData, hover, inView, isMotionValue, press, processFrame, resize, scroll, scrollInfo, spring, stagger, transform } from 'motion'`
  comes first (`:21-44`, with the comment "Re-export core animation functions plus the vanilla (component-free)
  layer …"), then `export { animate } from '$lib/utils/animateValue'` (`:51`). After 009 Phase B, a
  `export type { AnimationSequence, …, TimelineOptions } from 'motion'` block follows `:51`. `index.ts` also exports
  **our own** `type AnimationScope` (useAnimate's scope, `export type { AnimationScope } from '$lib/utils/animate.svelte'`)
  and **our own** `type MotionValue` (`export type { MotionValue, RawMotionValue } from '$lib/utils/motionValue.svelte'`).
  Those names are taken. Never re-export motion-dom's `AnimationScope` type or motion's `MotionValue` class under
  them.
- `src/lib/utils/animateValue.ts`. `animate` is `animateCore as SvelteMotionAnimateWithEffects` (`:116`): a
  type-only cast, so `animate === motion's animate`. `SvelteMotionAnimate` (`:34-67`) is the call-signature
  interface. After 009 Phase B, every signature returns `Timeline` and the sequence overload takes
  `Omit<TimelineOptions, 'scope'>`. The JSDoc style here (prose, `@example` with a fenced block) is the exemplar
  for this plan's JSDoc. `src/lib/utils/arc.ts:53-80` is a second exemplar with `@param`/`@returns`/`@example`.
- `src/lib/utils/animate.svelte.ts` (useAnimate) imports `createScopedAnimate` from `'motion'` (`:3`) and casts
  the result: `cachedScoped = createScopedAnimate({ scope: scope as MotionAnimationScope<T>, … }) as SvelteMotionAnimate`
  (`:125-128` at `2342935c`; 009 Phase B adds `reduceMotion` to that object).
- `src/lib/utils/animateValue.spec.ts` is the exemplar for the new unit tests. It uses fake timers
  (`vi.advanceTimersByTimeAsync`), has a runtime-identity test (`expect(animate).toBe(animateCore)`, `:22-24`) and
  a compile-only `typeAssertions()` block with `@ts-expect-error` lines that `pnpm check` validates (`:44-…`).
  Unit tests run in jsdom (`vitest.config.ts`, `environment: 'jsdom'`). jsdom has no `Element.prototype.animate`,
  so WAAPI-only `animateMini` can only be identity- and type-tested in units. Its behaviour goes in the e2e.
- `tests/consumer-vite6/verify-tree-shaking.mjs` bundles the built package through its `exports` map with Vite 6.
  Check 5 (`// 5. The non-component surface never pulls in the component layer.`) bundles `export * from PKG`,
  derives `nonComponent` export names, asserts `animate`, `frame`, `useTransform` and `useScroll` are among them,
  then asserts that no non-component export pulls in `data-is-loaded` or a `div` wrapper. New re-exports join that
  check automatically. It runs from `tests/consumer-vite6/verify.mjs` (`import './verify-tree-shaking.mjs'`) via
  `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`, against `dist/` (so `pnpm build` first).
- Test page conventions: `src/routes/tests/<feature>/+page.svelte`, e2e in `e2e/utilities/*.spec.ts` that wait
  for `data-hydrated="true"` (see `src/routes/tests/useAnimate/+page.svelte` and
  `e2e/utilities/use-animate.spec.ts`). The guided TesterPanel exemplar is
  `src/routes/tests/drag/disable-from-ondrag/+page.svelte`, which uses
  `src/routes/tests/layout/_parity/TesterPanel.svelte`; the panel is hidden under `?@isPlaywright=true`. Links
  live in `src/routes/+page.svelte`, section `<h2 …>Utilities</h2>` (`:1125`). After 009 the list is "useAnimate",
  then "useAnimate — timelines (Motion 14.7)", then "useAnimationControls".
- Docs: pages are `docs/src/routes/docs/<slug>/+page.svx` + `+page.ts`. Exemplar: `docs/src/routes/docs/arc/`
  (front matter `title`/`description`, a `<script>` that sets `getSeoContext()` fields, then `<Example isSmall exampleUrl="/examples/arc">`).
  Example routes are `docs/src/routes/examples/<slug>/+page.svelte` + `+page.ts`, with `ExampleSection[]`
  (exemplar `docs/src/routes/examples/arc/+page.svelte`) and demos in `docs/src/lib/examples/<slug>/demos/*.svelte`.
  Each example needs an entry in `docs/src/lib/examplesIndex.ts` (e.g. `arc: { title, description }`, `:66`).
  Nav: `docs/src/lib/docsNav.ts`, group `title: 'Animation'` (`{ title: 'scopeMotion', href: '/docs/scope-motion', icon: Box }`
  is in it). `docs/src/routes/docs/api-reference/+page.svx` has "## Re-exports from `motion`", then
  "### Imperative animation", a fenced `import { animate, delay, hover, … } from '@humanspeak/svelte-motion'`
  block with trailing `// …` comments, then "### Motion paths" (`:120-148`). `docs/src/lib/seo-title-policy.spec.ts`
  (run by `pnpm --dir docs test`) checks every example route's literal `seo.title`. Copy the arc example's
  `seo.title = '<name> | Svelte Motion'` form.
- Changesets: `.changeset/<slug>.md` with front matter `'@humanspeak/svelte-motion': minor` (exemplar
  `.changeset/animate-layout.md`).

### Upstream (`git -C ~/Github/motion show v14.7.1:<path>`; never switch branches there)

- `packages/motion/src/index.ts`: `export * from "framer-motion/dom"`. Subpaths in `packages/motion/package.json`
  `exports`: `.`, `./debug`, `./mini`, `./three`, `./vgpu`, `./react*`.
- `packages/framer-motion/src/dom.ts` (the framework-agnostic entry):
  ```ts
   1 export * from "motion-dom"
   2 export * from "motion-utils"
   4 export { animate, createScopedAnimate } from "./animation/animate"
   5 export type { Timeline, TimelineCallback, TimelineItem, TimelineOptions } from "./animation/timeline"
  11 export { animateMini } from "./animation/animators/waapi/animate-style"
  12 export { scroll } from "./render/dom/scroll"
  13 export { scrollInfo } from "./render/dom/scroll/track"
  14 export { inView } from "./render/dom/viewport"
  25 export { delayInSeconds as delay, type DelayedFunction } from "motion-dom"
  ```
  Lines 1-2 make **every** motion-dom/motion-utils export importable by React and vanilla users. Importability
  therefore doesn't separate public from internal. Only documentation and hand-curation do, and the audit below
  uses those two tests.
- `packages/framer-motion/src/index.ts` (React entry): `export * from "./dom"` (`:12`), plus React hooks and
  components. Its explicit motion-dom re-exports, `calcLength, createBox` (`:23`), `resolveMotionValue` (`:57`),
  `animateVisualElement` (`:78`), `addScaleCorrector` (`:92`), `buildTransform, visualElementStore, VisualElement`
  (`:95`) and `optimizedAppearDataAttribute` (`:112`), serve React components and Framer integration. None is
  documented on motion.dev. `useAnimateMini` (`:73`) is the React hook over `animateMini`.
- `packages/framer-motion/src/animation/animate/index.ts:28-34`:
  ```ts
  interface ScopedAnimateOptions {
      scope?: AnimationScope
      reduceMotion?: boolean
      skipAnimations?: boolean
  }
  /** Creates an animation function that is optionally scoped to a specific element. */
  export function createScopedAnimate(options: ScopedAnimateOptions = {}) {
  ```
  `ScopedAnimateOptions` is **not exported** upstream. `animate` is `createScopedAnimate()` plus the effect statics
  (`:185-186`). React's `useAnimate` calls it (`packages/framer-motion/src/animation/hooks/use-animate.ts:9`).
- `packages/framer-motion/src/animation/animators/waapi/animate-style.ts:11-30`:
  `createScopedWaapiAnimate(scope?)` returns `(elementOrSelector: ElementOrSelector, keyframes: DOMKeyframesDefinition, options?: AnimationOptions) => AnimationPlaybackControlsWithThen`;
  `export const animateMini = createScopedWaapiAnimate()`. `packages/framer-motion/src/dom-mini.ts` (the `motion/mini`
  entry) is `export { animateSequence } …; export { animateMini as animate } …`.
- `packages/motion-dom/src/animation/generators/inertia.ts:8-20`:
  `export function inertia({ keyframes, velocity = 0.0, power = 0.8, timeConstant = 325, bounceDamping = 10, bounceStiffness = 500, modifyTarget, min, max, restDelta = 0.5, restSpeed }: ValueAnimationOptions<number>): KeyframeGenerator<number>`.
  `…/generators/keyframes.ts:27-32`:
  `export function keyframes<T extends AnyResolvedKeyframe>({ duration = 300, keyframes, times, ease = "easeInOut" }: ValueAnimationOptions<T>): KeyframeGenerator<T>`.
  Both come out through `export * from "./animation/generators/inertia"` / `…/keyframes` (`packages/motion-dom/src/index.ts:40-41`),
  next to `spring` (`:42`).
- `packages/motion-dom/src/utils/resolve-elements.ts:3-56`: `type ElementOrSelector`, `interface AnimationScope`,
  `interface SelectorCache`, `function resolveElements(elementOrSelector, scope?, selectorCache?): Element[]`
  (`null`/`undefined` → `[]`; selector → `scope.current.querySelectorAll` or the active `scopeMotion` root or
  `document`; lists → array without `null` entries).
- Type exports in `packages/motion-dom/src/animation/types.ts`: `ValueAnimationOptions` (`:156`),
  `KeyframeGenerator` (`:138`), `GeneratorFactory` (`:181`), `SpringOptions` (`:306`), `InertiaOptions` (`:368`),
  `KeyframeOptions` (`:459`). All are exported by `motion` (verified in `motion-dom@14.7.1/dist/index.d.ts`). None
  is exported by `src/lib/index.ts` today. Also unexported by us: `ElementOrSelector`, `SelectorCache`,
  `DOMKeyframesDefinition`, `AnimationOptions`, `AnimationPlaybackControlsWithThen`.
- motion.dev (fetched 2026-10-27): the vanilla-JS pages are animate, arc, attrEffect, clamp, delay, distance,
  drag, easing functions, frame, hover, inView, mapValue, mix, motionValue, pipe, press, progress, propEffect,
  resize, **resolveElements** (`import { resolveElements } from "motion"`), scopeMotion, scroll, spring,
  springValue, stagger, styleEffect, svgEffect, transform, transformValue, wrap, animateView, layout animations.
  `animate` and `spring` show `import { animate } from "motion/mini"` (= `animateMini`). `animate#type`
  documents `type: "inertia"` ("Inertia animations decelerate a value based on its initial velocity"). No page
  covers `createScopedAnimate`, `inertia()`, `keyframes()`, `time`, `sync`, `followValue`, `recordStats` or the
  `MotionValue` class. Every name on those pages except `resolveElements` is already re-exported. (`linear` is
  listed on the easing page but is not a runtime export of `motion` 14.7.1.)

Behaviour verified against the installed `motion` 14.7.1 (Node, `requestAnimationFrame` → `setTimeout(16)`):
`inertia({ keyframes: [0], velocity: 1000 }).next(5000)` → `{ value: 800, done: true }` (power 0.8);
with `max: 300, bounceStiffness: 500, bounceDamping: 40` the generator settles at `300`;
`keyframes({ keyframes: [0, 100], duration: 1000 }).next(500).value` → `50`, with `ease: 'linear'` `.next(250).value` → `25`;
`animate(mv, [0], { type: inertia, velocity: 1000, power: 0.5 })` and the same call with `type: 'inertia'` both end at `500`;
`createScopedAnimate({ skipAnimations: true })(mv, 100, { duration: 5 })` → `100` within 100 ms;
`createScopedAnimate({ scope })(mv, 100)` pushes its controls onto `scope.animations`.
Tree-shaking, measured with Vite on `motion` directly: `export { inertia, keyframes, resolveElements } from 'motion'` → 42 kB unminified,
no `class Timeline`; `export { animateMini }` → 25 kB, no `class Timeline`; `export { createScopedAnimate }` → 217 kB and contains
`class Timeline` (it is `animate`).

## Audit: every allowlisted name, bucketed

**Rules.** A name goes in (a) if upstream presents it as public **and** it is framework-agnostic: it has a
motion.dev page or import example, it is hand-curated in `framer-motion/src/dom.ts`, or it belongs to a generator
family whose documented member (`spring`) we already re-export. A name goes in (b) if it is machinery behind
React's components or hooks and our Svelte layer already provides the user-facing equivalent. It goes in (c) if it
is undocumented, only reachable through `export *`, deprecated, or dev-only. It goes in (d) if it is public enough
to want, but re-exporting it as-is would collide with or bypass a Svelte-specific design. Each row cites where
the name is defined upstream at v14.7.1; paths are relative to `~/Github/motion/packages/`. Where a later row
repeats the basis above it, it says "″".

**Counts: (a) 5 · (b) 127 · (c) 156 · (d) 3 = 291** (the 290 from 009's allowlist, plus `buildTransformer`, new in 14.7.1).

#### (a) re-export as-is — 5

| Name | Upstream definition @ v14.7.1 | Decision basis |
| --- | --- | --- |
| `animateMini` | `framer-motion/src/animation/animators/waapi/animate-style.ts:30 (curated: framer-motion/src/dom.ts:11)` | Hand-curated named export (framer-motion/src/dom.ts:11); documented as `import { animate } from "motion/mini"` (motion.dev/docs/animate, motion.dev/docs/spring) |
| `createScopedAnimate` | `framer-motion/src/animation/animate/index.ts:34 (curated: framer-motion/src/dom.ts:4)` | Hand-curated named export next to `animate` in framer-motion/src/dom.ts:4; backs React `useAnimate` (framer-motion/src/animation/hooks/use-animate.ts:9) |
| `inertia` | `motion-dom/src/animation/generators/inertia.ts:8` | Generator family of `spring` (documented at motion.dev/docs/spring and already re-exported); `type: "inertia"` documented at motion.dev/docs/animate#type; used by React `useFollowValue` (framer-motion/src/value/use-follow-value.ts:19) |
| `keyframes` | `motion-dom/src/animation/generators/keyframes.ts:27` | Generator family of `spring`/`inertia` (the tween generator, `type: "keyframes"`); used by React `useTransform` (framer-motion/src/value/use-transform.ts:240) |
| `resolveElements` | `motion-dom/src/utils/resolve-elements.ts:30` | Documented: motion.dev/docs/resolve-elements (`import { resolveElements } from "motion"`) |

#### (d) needs a Svelte adaptation (follow-up) — 3

| Name | Upstream definition @ v14.7.1 | Decision basis |
| --- | --- | --- |
| `followValue` | `motion-dom/src/value/follow-value.ts:55` | Vanilla factory behind React `useFollowValue` (framer-motion/src/value/use-follow-value.ts:5); our vanilla factories are Svelte-augmented wrappers (src/lib/utils/vanillaValues.svelte.ts), so it needs the same wrapper |
| `MotionValue` | `motion-dom/src/value/index.ts:85` | Runtime class; our `MotionValue` is already a Svelte-augmented *type* (src/lib/utils/motionValue.svelte.ts, exported at src/lib/index.ts); a same-name runtime export collides — needs a value+type design |
| `recordStats` | `motion-dom/src/stats/index.ts:8 (curated: framer-motion/src/debug.ts:2)` | Upstream exposes it only via the `motion/debug` subpath (packages/motion/src/debug.ts:1 → framer-motion/src/debug.ts:2); needs a `./debug` entry in our package.json `exports` |

#### (b) React-only machinery, Svelte equivalent exists — 127

| Name | Upstream definition @ v14.7.1 | Decision basis |
| --- | --- | --- |
| `buildHTMLStyles` | `motion-dom/src/render/html/utils/build-styles.ts:10` | Renderer behind React `motion.*` (framer-motion/src/render/*/use-props.ts, motion/utils/use-visual-state.ts); ours is `motion.*` / `_MotionContainer.svelte` |
| `buildSVGAttrs` | `motion-dom/src/render/svg/utils/build-attrs.ts:26` | ″ (same as above) |
| `buildSVGPath` | `motion-dom/src/render/svg/utils/path.ts:23` | ″ (same as above) |
| `buildTransform` | `motion-dom/src/render/html/utils/build-transform.ts:47` | ″ (same as above) |
| `camelCaseAttributes` | `motion-dom/src/render/svg/utils/camel-case-attrs.ts:4` | ″ (same as above) |
| `checkVariantsDidChange` | `motion-dom/src/render/utils/animation-state.ts:422` | ″ (same as above) |
| `createAnimationState` | `motion-dom/src/render/utils/animation-state.ts:66` | ″ (same as above) |
| `DOMVisualElement` | `motion-dom/src/render/dom/DOMVisualElement.ts:10` | ″ (same as above) |
| `Feature` | `motion-dom/src/render/Feature.ts:8` | ″ (same as above) |
| `getComputedStyle` | `motion-dom/src/render/html/HTMLVisualElement.ts:20` | ″ (same as above) |
| `getFeatureDefinitions` | `motion-dom/src/render/VisualElement.ts:75` | ″ (same as above) |
| `getVariantContext` | `motion-dom/src/render/utils/get-variant-context.ts:20` | ″ (same as above) |
| `HTMLVisualElement` | `motion-dom/src/render/html/HTMLVisualElement.ts:24` | ″ (same as above) |
| `isControllingVariants` | `motion-dom/src/render/utils/is-controlling-variants.ts:6` | ″ (same as above) |
| `isForcedMotionValue` | `motion-dom/src/render/utils/is-forced-motion-value.ts:10` | ″ (same as above) |
| `isSVGTag` | `motion-dom/src/render/svg/utils/is-svg-tag.ts:1` | ″ (same as above) |
| `isVariantLabel` | `motion-dom/src/render/utils/is-variant-label.ts:4` | ″ (same as above) |
| `isVariantNode` | `motion-dom/src/render/utils/is-controlling-variants.ts:18` | ″ (same as above) |
| `ObjectVisualElement` | `motion-dom/src/render/object/ObjectVisualElement.ts:13` | ″ (same as above) |
| `readTransformValue` | `motion-dom/src/render/dom/parse-transform.ts:93` | ″ (same as above) |
| `renderHTML` | `motion-dom/src/render/html/utils/render.ts:4` | ″ (same as above) |
| `renderSVG` | `motion-dom/src/render/svg/utils/render.ts:7` | ″ (same as above) |
| `resolveVariant` | `motion-dom/src/render/utils/resolve-dynamic-variants.ts:13` | ″ (same as above) |
| `resolveVariantFromProps` | `motion-dom/src/render/utils/resolve-variants.ts:20` | ″ (same as above) |
| `scrapeHTMLMotionValuesFromProps` | `motion-dom/src/index.ts:316` | ″ (same as above) |
| `scrapeSVGMotionValuesFromProps` | `motion-dom/src/index.ts:322` | ″ (same as above) |
| `setFeatureDefinitions` | `motion-dom/src/render/VisualElement.ts:66` | ″ (same as above) |
| `setStyle` | `motion-dom/src/render/dom/style-set.ts:4` | ″ (same as above) |
| `setTarget` | `motion-dom/src/render/utils/setters.ts:35` | ″ (same as above) |
| `SVGVisualElement` | `motion-dom/src/render/svg/SVGVisualElement.ts:19` | ″ (same as above) |
| `updateMotionValuesFromProps` | `motion-dom/src/render/utils/motion-values.ts:10` | ″ (same as above) |
| `variantPriorityOrder` | `motion-dom/src/render/utils/variant-props.ts:3` | ″ (same as above) |
| `variantProps` | `motion-dom/src/render/utils/variant-props.ts:13` | ″ (same as above) |
| `VisualElement` | `motion-dom/src/render/VisualElement.ts:90` | ″ (same as above) |
| `visualElementStore` | `motion-dom/src/render/store.ts:3` | ″ (same as above) |
| `addScaleCorrector` | `motion-dom/src/render/utils/is-forced-motion-value.ts:8` | Projection engine behind React `layout`/`layoutId`/`LayoutGroup` (framer-motion/src/motion/features/layout, components/LayoutGroup/index.tsx:10); ours: layout props, `LayoutGroup`, `animateLayout` |
| `applyAxisDelta` | `motion-dom/src/projection/geometry/delta-apply.ts:35` | ″ (same as above) |
| `applyBoxDelta` | `motion-dom/src/projection/geometry/delta-apply.ts:62` | ″ (same as above) |
| `applyPointDelta` | `motion-dom/src/projection/geometry/delta-apply.ts:18` | ″ (same as above) |
| `applyTreeDeltas` | `motion-dom/src/projection/geometry/delta-apply.ts:81` | ″ (same as above) |
| `aspectRatio` | `motion-dom/src/projection/geometry/utils.ts:31` | ″ (same as above) |
| `axisDeltaEquals` | `motion-dom/src/projection/geometry/utils.ts:35` | ″ (same as above) |
| `axisEquals` | `motion-dom/src/projection/geometry/utils.ts:12` | ″ (same as above) |
| `axisEqualsRounded` | `motion-dom/src/projection/geometry/utils.ts:20` | ″ (same as above) |
| `boxEquals` | `motion-dom/src/projection/geometry/utils.ts:16` | ″ (same as above) |
| `boxEqualsRounded` | `motion-dom/src/projection/geometry/utils.ts:27` | ″ (same as above) |
| `buildProjectionTransform` | `motion-dom/src/projection/styles/transform.ts:5` | ″ (same as above) |
| `calcAxisDelta` | `motion-dom/src/projection/geometry/delta-calc.ts:24` | ″ (same as above) |
| `calcBoxDelta` | `motion-dom/src/projection/geometry/delta-calc.ts:52` | ″ (same as above) |
| `calcLength` | `motion-dom/src/projection/geometry/delta-calc.ts:12` | ″ (same as above) |
| `calcRelativeAxis` | `motion-dom/src/projection/geometry/delta-calc.ts:62` | ″ (same as above) |
| `calcRelativeAxisPosition` | `motion-dom/src/projection/geometry/delta-calc.ts:85` | ″ (same as above) |
| `calcRelativeBox` | `motion-dom/src/projection/geometry/delta-calc.ts:75` | ″ (same as above) |
| `calcRelativePosition` | `motion-dom/src/projection/geometry/delta-calc.ts:98` | ″ (same as above) |
| `cleanDirtyNodes` | `motion-dom/src/projection/node/create-projection-node.ts:2419` | ″ (same as above) |
| `compareByDepth` | `motion-dom/src/projection/utils/compare-by-depth.ts:7` | ″ (same as above) |
| `convertBoundingBoxToBox` | `motion-dom/src/projection/geometry/conversion.ts:8` | ″ (same as above) |
| `convertBoxToBoundingBox` | `motion-dom/src/projection/geometry/conversion.ts:20` | ″ (same as above) |
| `copyAxisDeltaInto` | `motion-dom/src/projection/geometry/copy.ts:28` | ″ (same as above) |
| `copyAxisInto` | `motion-dom/src/projection/geometry/copy.ts:8` | ″ (same as above) |
| `copyBoxInto` | `motion-dom/src/projection/geometry/copy.ts:18` | ″ (same as above) |
| `correctBorderRadius` | `motion-dom/src/projection/styles/scale-border-radius.ts:17` | ″ (same as above) |
| `correctBoxShadow` | `motion-dom/src/projection/styles/scale-box-shadow.ts:5` | ″ (same as above) |
| `createAxis` | `motion-dom/src/projection/geometry/models.ts:15` | ″ (same as above) |
| `createAxisDelta` | `motion-dom/src/projection/geometry/models.ts:3` | ″ (same as above) |
| `createBox` | `motion-dom/src/projection/geometry/models.ts:17` | ″ (same as above) |
| `createDelta` | `motion-dom/src/projection/geometry/models.ts:10` | ″ (same as above) |
| `createProjectionNode` | `motion-dom/src/projection/node/create-projection-node.ts:162` | ″ (same as above) |
| `DocumentProjectionNode` | `motion-dom/src/projection/node/DocumentProjectionNode.ts:4` | ″ (same as above) |
| `eachAxis` | `motion-dom/src/projection/utils/each-axis.ts:1` | ″ (same as above) |
| `FlatTree` | `motion-dom/src/projection/utils/flat-tree.ts:4` | ″ (same as above) |
| `globalProjectionState` | `motion-dom/src/projection/node/state.ts:6` | ″ (same as above) |
| `has2DTranslate` | `motion-dom/src/projection/utils/has-transform.ts:48` | ″ (same as above) |
| `hasScale` | `motion-dom/src/projection/utils/has-transform.ts:8` | ″ (same as above) |
| `hasTransform` | `motion-dom/src/projection/utils/has-transform.ts:28` | ″ (same as above) |
| `HTMLProjectionNode` | `motion-dom/src/projection/node/HTMLProjectionNode.ts:5` | ″ (same as above) |
| `isDeltaZero` | `motion-dom/src/projection/geometry/utils.ts:8` | ″ (same as above) |
| `isNear` | `motion-dom/src/projection/geometry/delta-calc.ts:16` | ″ (same as above) |
| `LayoutAnimationBuilder` | `motion-dom/src/layout/LayoutAnimationBuilder.ts:303` | ″ (same as above) |
| `measurePageBox` | `motion-dom/src/projection/utils/measure.ts:17` | ″ (same as above) |
| `measureViewportBox` | `motion-dom/src/projection/utils/measure.ts:8` | ″ (same as above) |
| `mixValues` | `motion-dom/src/projection/animation/mix-values.ts:20` | ″ (same as above) |
| `nodeGroup` | `motion-dom/src/projection/node/group.ts:12` | ″ (same as above) |
| `NodeStack` | `motion-dom/src/projection/shared/stack.ts:4` | ″ (same as above) |
| `parseAnimateLayoutArgs` | `motion-dom/src/layout/LayoutAnimationBuilder.ts:460` | ″ (same as above) |
| `pixelsToPercent` | `motion-dom/src/projection/styles/scale-border-radius.ts:5` | ″ (same as above) |
| `propagateDirtyNodes` | `motion-dom/src/projection/node/create-projection-node.ts:2385` | ″ (same as above) |
| `removeAxisDelta` | `motion-dom/src/projection/geometry/delta-remove.ts:30` | ″ (same as above) |
| `removeAxisTransforms` | `motion-dom/src/projection/geometry/delta-remove.ts:75` | ″ (same as above) |
| `removeBoxTransforms` | `motion-dom/src/projection/geometry/delta-remove.ts:103` | ″ (same as above) |
| `removePointDelta` | `motion-dom/src/projection/geometry/delta-remove.ts:10` | ″ (same as above) |
| `rootProjectionNode` | `motion-dom/src/projection/node/root.ts:3` | ″ (same as above) |
| `scaleCorrectors` | `motion-dom/src/render/utils/is-forced-motion-value.ts:8` | ″ (same as above) |
| `scalePoint` | `motion-dom/src/projection/geometry/delta-apply.ts:9` | ″ (same as above) |
| `transformAxis` | `motion-dom/src/projection/geometry/delta-apply.ts:164` | ″ (same as above) |
| `transformBox` | `motion-dom/src/projection/geometry/delta-apply.ts:190` | ″ (same as above) |
| `transformBoxPoints` | `motion-dom/src/projection/geometry/conversion.ts:29` | ″ (same as above) |
| `translateAxis` | `motion-dom/src/projection/geometry/delta-apply.ts:154` | ″ (same as above) |
| `animateTarget` | `motion-dom/src/animation/interfaces/visual-element-target.ts:34` | Variant engine behind React components; ours: variants on `motion.*` |
| `animateVariant` | `motion-dom/src/animation/interfaces/visual-element-variant.ts:10` | ″ (same as above) |
| `animateVisualElement` | `motion-dom/src/animation/interfaces/visual-element.ts:8` | Variant/controls engine; React-curated (framer-motion/src/index.ts:78) for animation controls; ours: `useAnimationControls`, variants |
| `attachFollow` | `motion-dom/src/value/follow-value.ts:78` | Backs React `useFollowValue` (framer-motion/src/value/use-follow-value.ts:5); ours: `useFollowValue` |
| `attachSpring` | `motion-dom/src/value/spring-value.ts:43` | Backs React `useSpring` (framer-motion/src/value/use-spring.ts:4); ours: `useSpring`, `springValue` |
| `addValueToWillChange` | `motion-dom/src/value/will-change/add-will-change.ts:5` | Backs React `useWillChange`; ours: `useWillChange` |
| `isWillChangeMotionValue` | `motion-dom/src/value/will-change/is.ts:4` | ″ (same as above) |
| `addDomEvent` | `motion-dom/src/events/add-dom-event.ts:1` | Gesture machinery behind React gesture props (framer-motion/src/gestures/*); ours: `drag`/`pan`/`hover`/`press` props, `createDragControls`, vanilla `drag()`/`hover()`/`press()` |
| `addPointerEvent` | `motion-dom/src/events/add-pointer-event.ts:4` | ″ (same as above) |
| `addPointerInfo` | `motion-dom/src/events/event-info.ts:18` | ″ (same as above) |
| `elementDragControls` | `motion-dom/src/gestures/drag/VisualElementDragControls.ts:65` | ″ (same as above) |
| `expectsResolvedDragConstraints` | `motion-dom/src/gestures/drag/VisualElementDragControls.ts:938` | ″ (same as above) |
| `extractEventInfo` | `motion-dom/src/events/event-info.ts:9` | ″ (same as above) |
| `isDragActive` | `motion-dom/src/gestures/drag/state/is-active.ts:6` | ″ (same as above) |
| `isDragging` | `motion-dom/src/gestures/drag/state/is-active.ts:1` | ″ (same as above) |
| `isElementKeyboardAccessible` | `motion-dom/src/gestures/press/utils/is-keyboard-accessible.ts:13` | ″ (same as above) |
| `isElementTextInput` | `motion-dom/src/gestures/press/utils/is-keyboard-accessible.ts:33` | ″ (same as above) |
| `isNodeOrChild` | `motion-dom/src/gestures/utils/is-node-or-child.ts:8` | ″ (same as above) |
| `isPrimaryPointer` | `motion-dom/src/gestures/utils/is-primary-pointer.ts:1` | ″ (same as above) |
| `PanSession` | `motion-dom/src/gestures/pan/PanSession.ts:46` | ″ (same as above) |
| `setDragLock` | `motion-dom/src/gestures/drag/state/set-active.ts:3` | ″ (same as above) |
| `VisualElementDragControls` | `motion-dom/src/gestures/drag/VisualElementDragControls.ts:88` | ″ (same as above) |
| `hasReducedMotionListener` | `motion-dom/src/render/utils/reduced-motion/state.ts:8` | Backs React `useReducedMotion` / `MotionConfigContext` (framer-motion/src/utils/reduced-motion/use-reduced-motion.ts:4-5); ours: `useReducedMotion`, `MotionConfig reducedMotion` |
| `initPrefersReducedMotion` | `motion-dom/src/render/utils/reduced-motion/index.ts:5` | ″ (same as above) |
| `prefersReducedMotion` | `motion-dom/src/render/utils/reduced-motion/state.ts:6` | ″ (same as above) |
| `getOptimisedAppearId` | `motion-dom/src/animation/optimized-appear/get-appear-id.ts:4` | Hand-off internals for React `startOptimizedAppearAnimation` (framer-motion/src/index.ts:113); ours: SSR optimized appear (`src/lib/utils/optimizedAppear.ts`) |
| `handOffElementState` | `motion-dom/src/animation/animate/element.ts:113` | ″ (same as above) |
| `optimizedAppearDataId` | `motion-dom/src/animation/optimized-appear/data-id.ts:1` | ″ (same as above) |
| `releaseElement` | `motion-dom/src/animation/animate/element.ts:102` | ″ (same as above) |

#### (c) internal / deprecated, stays out — 156

| Name | Upstream definition @ v14.7.1 | Decision basis |
| --- | --- | --- |
| `addAttrValue` | `motion-dom/src/effects/attr/index.ts:25` | Internal of the re-exported `attrEffect`/`styleEffect`/`svgEffect` (motion-dom/src/effects/*/index.ts); undocumented |
| `addStyleValue` | `motion-dom/src/effects/style/index.ts:26` | ″ (same as above) |
| `addSVGValue` | `motion-dom/src/effects/svg/index.ts:47` | ″ (same as above) |
| `originProps` | `motion-dom/src/effects/style/index.ts:18` | ″ (same as above) |
| `readStyleValue` | `motion-dom/src/effects/style/index.ts:108` | ″ (same as above) |
| `readSVGValue` | `motion-dom/src/effects/svg/index.ts:82` | ″ (same as above) |
| `acceleratedValues` | `motion-dom/src/animation/waapi/utils/accelerated-values.ts:8` | Engine internal: undocumented on motion.dev, reached only through `export *` (framer-motion/src/dom.ts:1) |
| `animateElement` | `motion-dom/src/animation/animate/element.ts:70` | ″ (same as above) |
| `animateMotionValue` | `motion-dom/src/animation/interfaces/motion-value.ts:19` | ″ (same as above) |
| `animateSingleValue` | `motion-dom/src/animation/animate/single-value.ts:14` | ″ (same as above) |
| `animateValue` | `motion-dom/src/animation/JSAnimation.ts:590` | ″ (same as above) |
| `animateValues` | `motion-dom/src/animation/animate/effects.ts:65` | ″ (same as above) |
| `animationMapKey` | `motion-dom/src/animation/utils/active-animations.ts:8` | ″ (same as above) |
| `applyGeneratorOptions` | `motion-dom/src/animation/waapi/utils/apply-generator.ts:5` | ″ (same as above) |
| `AsyncMotionValueAnimation` | `motion-dom/src/animation/AsyncMotionValueAnimation.ts:33` | ″ (same as above) |
| `calcChildStagger` | `motion-dom/src/animation/utils/calc-child-stagger.ts:4` | ″ (same as above) |
| `calcGeneratorDuration` | `motion-dom/src/animation/generators/utils/calc-duration.ts:9` | ″ (same as above) |
| `createGeneratorEasing` | `motion-dom/src/animation/generators/utils/create-generator-easing.ts:8` | ″ (same as above) |
| `getAnimationMap` | `motion-dom/src/animation/utils/active-animations.ts:11` | ″ (same as above) |
| `getDefaultTransition` | `motion-dom/src/animation/utils/default-transitions.ts:35` | ″ (same as above) |
| `getFinalKeyframe` | `motion-dom/src/animation/keyframes/get-final.ts:5` | ″ (same as above) |
| `getOriginIndex` | `motion-dom/src/utils/stagger.ts:23` | ″ (same as above) |
| `getValueTransition` | `motion-dom/src/animation/utils/get-value-transition.ts:3` | ″ (same as above) |
| `GroupAnimation` | `motion-dom/src/animation/GroupAnimation.ts:15` | ″ (same as above) |
| `GroupAnimationWithThen` | `motion-dom/src/animation/GroupAnimationWithThen.ts:4` | ″ (same as above) |
| `isGenerator` | `motion-dom/src/animation/generators/utils/is-generator.ts:3` | ″ (same as above) |
| `isKeyframesTarget` | `motion-dom/src/render/utils/is-keyframes-target.ts:3` | ″ (same as above) |
| `isTransitionDefined` | `motion-dom/src/animation/utils/is-transition-defined.ts:23` | ″ (same as above) |
| `JSAnimation` | `motion-dom/src/animation/JSAnimation.ts:35` | ″ (same as above) |
| `makeAnimationInstant` | `motion-dom/src/animation/utils/make-animation-instant.ts:3` | ″ (same as above) |
| `maxGeneratorDuration` | `motion-dom/src/animation/generators/utils/calc-duration.ts:7` | ″ (same as above) |
| `NativeAnimation` | `motion-dom/src/animation/NativeAnimation.ts:30` | ″ (same as above) |
| `NativeAnimationExtended` | `motion-dom/src/animation/NativeAnimationExtended.ts:20` | ″ (same as above) |
| `NativeAnimationWrapper` | `motion-dom/src/animation/NativeAnimationWrapper.ts:5` | ″ (same as above) |
| `resolveTransition` | `motion-dom/src/animation/utils/resolve-transition.ts:6` | ″ (same as above) |
| `startWaapiAnimation` | `motion-dom/src/animation/waapi/start-waapi-animation.ts:4` | ″ (same as above) |
| `alpha` | `motion-dom/src/value/types/numbers/index.ts:9` | Value-type / keyframe-resolver internal: undocumented; `export *` only |
| `analyseComplexValue` | `motion-dom/src/value/types/complex/index.ts:62` | ″ (same as above) |
| `applyPxDefaults` | `motion-dom/src/animation/keyframes/utils/apply-px-defaults.ts:4` | ″ (same as above) |
| `camelToDash` | `motion-dom/src/render/dom/utils/camel-to-dash.ts:1` | ″ (same as above) |
| `color` | `motion-dom/src/value/types/color/index.ts:6` | ″ (same as above) |
| `complex` | `motion-dom/src/value/types/complex/index.ts:163` | ″ (same as above) |
| `containsCSSVariable` | `motion-dom/src/animation/utils/is-css-variable.ts:36` | ″ (same as above) |
| `defaultTransformValue` | `motion-dom/src/render/dom/parse-transform.ts:64` | ″ (same as above) |
| `defaultValueTypes` | `motion-dom/src/value/types/maps/defaults.ts:10` | ″ (same as above) |
| `degrees` | `motion-dom/src/value/types/numbers/units.ts:11` | ″ (same as above) |
| `dimensionValueTypes` | `motion-dom/src/value/types/dimensions.ts:9` | ″ (same as above) |
| `DOMKeyframesResolver` | `motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts:15` | ″ (same as above) |
| `fillWildcards` | `motion-dom/src/animation/keyframes/utils/fill-wildcards.ts:3` | ″ (same as above) |
| `findDimensionValueType` | `motion-dom/src/value/types/dimensions.ts:14` | ″ (same as above) |
| `findValueType` | `motion-dom/src/value/types/utils/find.ts:14` | ″ (same as above) |
| `flushKeyframeResolvers` | `motion-dom/src/animation/keyframes/KeyframesResolver.ts:105` | ″ (same as above) |
| `getAnimatableNone` | `motion-dom/src/value/types/utils/animatable-none.ts:8` | ″ (same as above) |
| `getDefaultValueType` | `motion-dom/src/value/types/maps/defaults.ts:35` | ″ (same as above) |
| `getValueAsType` | `motion-dom/src/value/types/utils/get-as-type.ts:6` | ″ (same as above) |
| `getVariableValue` | `motion-dom/src/animation/utils/css-variables-conversion.ts:27` | ″ (same as above) |
| `hasComplexValues` | `motion-dom/src/value/types/complex/index.ts:57` | ″ (same as above) |
| `hex` | `motion-dom/src/value/types/color/hex.ts:25` | ″ (same as above) |
| `hsla` | `motion-dom/src/value/types/color/hsla.ts:7` | ″ (same as above) |
| `invisibleValues` | `motion-dom/src/utils/mix/visibility.ts:1` | ″ (same as above) |
| `isCSSVariableName` | `motion-dom/src/animation/utils/is-css-variable.ts:12` | ″ (same as above) |
| `isCSSVariableToken` | `motion-dom/src/animation/utils/is-css-variable.ts:17` | ″ (same as above) |
| `isNumericalString` | `motion-utils/src/is-numerical-string.ts:4` | ″ (same as above) |
| `isZeroValueString` | `motion-utils/src/is-zero-value-string.ts:4` | ″ (same as above) |
| `KeyframeResolver` | `motion-dom/src/animation/keyframes/KeyframesResolver.ts:140` | ″ (same as above) |
| `number` | `motion-dom/src/value/types/numbers/index.ts:3` | ″ (same as above) |
| `numberValueTypes` | `motion-dom/src/value/types/maps/number.ts:7` | ″ (same as above) |
| `parseCSSVariable` | `motion-dom/src/animation/utils/css-variables-conversion.ts:18` | ″ (same as above) |
| `parseValueFromTransform` | `motion-dom/src/render/dom/parse-transform.ts:68` | ″ (same as above) |
| `percent` | `motion-dom/src/value/types/numbers/units.ts:12` | ″ (same as above) |
| `positionalKeys` | `motion-dom/src/render/utils/keys-position.ts:3` | ″ (same as above) |
| `progressPercentage` | `motion-dom/src/value/types/numbers/units.ts:17` | ″ (same as above) |
| `px` | `motion-dom/src/value/types/numbers/units.ts:13` | ″ (same as above) |
| `rgba` | `motion-dom/src/value/types/color/rgba.ts:13` | ″ (same as above) |
| `rgbUnit` | `motion-dom/src/value/types/color/rgba.ts:8` | ″ (same as above) |
| `scale` | `motion-dom/src/value/types/numbers/index.ts:14` | ″ (same as above) |
| `testValueType` | `motion-dom/src/value/types/test.ts:6` | ″ (same as above) |
| `transformPropOrder` | `motion-dom/src/render/utils/keys-transform.ts:4` | ″ (same as above) |
| `transformProps` | `motion-dom/src/render/utils/keys-transform.ts:35` | ″ (same as above) |
| `transformValueTypes` | `motion-dom/src/value/types/maps/transform.ts:5` | ″ (same as above) |
| `vh` | `motion-dom/src/value/types/numbers/units.ts:14` | ″ (same as above) |
| `vw` | `motion-dom/src/value/types/numbers/units.ts:15` | ″ (same as above) |
| `collectMotionValues` | `motion-dom/src/value/index.ts:76` | Motion-value plumbing: undocumented; `export *` only |
| `resolveMotionValue` | `motion-dom/src/value/utils/resolve-motion-value.ts:8` | ″ (same as above) |
| `SubscriptionManager` | `motion-utils/src/subscription-manager.ts:5` | ″ (same as above) |
| `convertOffsetToTimes` | `motion-dom/src/animation/keyframes/offsets/time.ts:1` | WAAPI easing conversion internal; the documented easing functions are already re-exported |
| `cubicBezierAsString` | `motion-dom/src/animation/waapi/easing/cubic-bezier.ts:3` | ″ (same as above) |
| `defaultEasing` | `motion-dom/src/animation/generators/keyframes.ts:20` | ″ (same as above) |
| `defaultOffset` | `motion-dom/src/animation/keyframes/offsets/default.ts:3` | ″ (same as above) |
| `easingDefinitionToFunction` | `motion-utils/src/easing/utils/map.ts:29` | ″ (same as above) |
| `fillOffset` | `motion-dom/src/animation/keyframes/offsets/fill.ts:4` | ″ (same as above) |
| `generateLinearEasing` | `motion-dom/src/animation/waapi/utils/linear.ts:3` | ″ (same as above) |
| `getEasingForSegment` | `motion-utils/src/easing/utils/get-easing-for-segment.ts:6` | ″ (same as above) |
| `isBezierDefinition` | `motion-utils/src/easing/utils/is-bezier-definition.ts:4` | ″ (same as above) |
| `isEasingArray` | `motion-utils/src/easing/utils/is-easing-array.ts:4` | ″ (same as above) |
| `isWaapiSupportedEasing` | `motion-dom/src/animation/waapi/easing/is-supported.ts:5` | ″ (same as above) |
| `mapEasingToNativeEasing` | `motion-dom/src/animation/waapi/easing/map-easing.ts:7` | ″ (same as above) |
| `supportedWaapiEasing` | `motion-dom/src/animation/waapi/easing/supported.ts:3` | ″ (same as above) |
| `cancelMicrotask` | `motion-dom/src/frameloop/microtask.ts:3` | Frameloop/time-unit internal; documented `frame`/`cancelFrame`/`frameData`/`processFrame` already re-exported |
| `createRenderBatcher` | `motion-dom/src/frameloop/batcher.ts:8` | ″ (same as above) |
| `frameSteps` | `motion-dom/src/frameloop/frame.ts:8` | ″ (same as above) |
| `microtask` | `motion-dom/src/frameloop/microtask.ts:3` | ″ (same as above) |
| `millisecondsToSeconds` | `motion-utils/src/time-conversion.ts:12` | ″ (same as above) |
| `secondsToMilliseconds` | `motion-utils/src/time-conversion.ts:9` | ″ (same as above) |
| `statsBuffer` | `motion-dom/src/stats/buffer.ts:13` | ″ (same as above) |
| `velocityPerSecond` | `motion-utils/src/velocity-per-second.ts:5` | ″ (same as above) |
| `cancelSync` | `motion-dom/src/frameloop/index-legacy.ts:17` | `@deprecated` — "Use cancelFrame(callback) instead" (motion-dom/src/frameloop/index-legacy.ts:12-17) |
| `delayInSeconds` | `motion-dom/src/utils/delay.ts:30` | Upstream re-exports it publicly only as `delay` (framer-motion/src/dom.ts:25), which we already re-export |
| `sync` | `motion-dom/src/frameloop/index-legacy.ts:10` | `@deprecated` — "Import as `frame` instead" (motion-dom/src/frameloop/index-legacy.ts:5-10) |
| `time` | `motion-dom/src/frameloop/sync-time.ts:18` | Undocumented frameloop clock (JSDoc: "eventloop-synchronous alternative to performance.now()", sync-time.ts:10-17); React exposes it only through `useTime`, which we ship |
| `addEffect` | `motion-dom/src/animation/animate/effects.ts:20` | Effect-registry internal; public surface is `animate.addEffect`/`removeEffect` + `createEffect` (re-exported) |
| `animateEffectSubject` | `motion-dom/src/animation/animate/effects.ts:154` | ″ (same as above) |
| `findEffect` | `motion-dom/src/animation/animate/effects.ts:37` | ″ (same as above) |
| `removeEffect` | `motion-dom/src/animation/animate/effects.ts:33` | ″ (same as above) |
| `styleSubjectEffect` | `motion-dom/src/effects/style/index.ts:126` | ″ (same as above) |
| `svgSubjectEffect` | `motion-dom/src/effects/svg/index.ts:108` | ″ (same as above) |
| `activeScope` | `motion-dom/src/scope/active.ts:16` | Scope internal behind `scopeMotion` (re-exported); undocumented |
| `addBuilderToScope` | `motion-dom/src/scope/active.ts:32` | ″ (same as above) |
| `addToScope` | `motion-dom/src/scope/active.ts:22` | ″ (same as above) |
| `bindToScope` | `motion-dom/src/scope/active.ts:56` | ″ (same as above) |
| `isHTMLElement` | `motion-dom/src/utils/is-html-element.ts:7` | ″ (same as above) |
| `isObject` | `motion-utils/src/is-object.ts:1` | ″ (same as above) |
| `isSVGElement` | `motion-dom/src/utils/is-svg-element.ts:7` | ″ (same as above) |
| `isSVGSVGElement` | `motion-dom/src/utils/is-svg-svg-element.ts:7` | ″ (same as above) |
| `getViewAnimationLayerInfo` | `motion-dom/src/view/utils/get-layer-info.ts:1` | Internal of `animateView` (re-exported) and React `AnimateView` (framer-motion/src/components/AnimateView/animate-view-layers.ts:5-6) |
| `getViewAnimations` | `motion-dom/src/view/utils/get-view-animations.ts:1` | ″ (same as above) |
| `ViewTransitionBuilder` | `motion-dom/src/view/index.ts:17` | ″ (same as above) |
| `supportsBrowserAnimation` | `motion-dom/src/animation/waapi/supports/waapi.ts:31` | Feature-detection internal; undocumented |
| `supportsFlags` | `motion-dom/src/utils/supports/flags.ts:5` | ″ (same as above) |
| `supportsLinearEasing` | `motion-dom/src/utils/supports/linear-easing.ts:3` | ″ (same as above) |
| `supportsPartialKeyframes` | `motion-dom/src/animation/waapi/supports/partial-keyframes.ts:3` | ″ (same as above) |
| `supportsScrollTimeline` | `motion-dom/src/utils/supports/scroll-timeline.ts:27` | ″ (same as above) |
| `supportsViewTimeline` | `motion-dom/src/utils/supports/scroll-timeline.ts:32` | ″ (same as above) |
| `supportsWaapi` | `motion-dom/src/animation/waapi/supports/waapi.ts:27` | ″ (same as above) |
| `addUniqueItem` | `motion-utils/src/array.ts:1` | Helper internal; undocumented (the documented `mix`, `interpolate`, `clamp`, `wrap` … are re-exported) |
| `getMixer` | `motion-dom/src/utils/mix/complex.ts:26` | ″ (same as above) |
| `hslaToRgba` | `motion-dom/src/value/types/color/hsla-to-rgba.ts:13` | ″ (same as above) |
| `memo` | `motion-utils/src/memo.ts:2` | ″ (same as above) |
| `mixArray` | `motion-dom/src/utils/mix/complex.ts:44` | ″ (same as above) |
| `mixColor` | `motion-dom/src/utils/mix/color.ts:46` | ″ (same as above) |
| `mixComplex` | `motion-dom/src/utils/mix/complex.ts:100` | ″ (same as above) |
| `mixImmediate` | `motion-dom/src/utils/mix/immediate.ts:1` | ″ (same as above) |
| `mixLinearColor` | `motion-dom/src/utils/mix/color.ts:13` | ″ (same as above) |
| `mixNumber` | `motion-dom/src/utils/mix/number.ts:22` | ″ (same as above) |
| `mixObject` | `motion-dom/src/utils/mix/complex.ts:58` | ″ (same as above) |
| `mixVisibility` | `motion-dom/src/utils/mix/visibility.ts:8` | ″ (same as above) |
| `moveItem` | `motion-utils/src/array.ts:11` | ″ (same as above) |
| `noop` | `motion-utils/src/noop.ts:2` | ″ (same as above) |
| `removeItem` | `motion-utils/src/array.ts:5` | ″ (same as above) |
| `round` | `motion-dom/src/animation/JSAnimation.ts:33` | ″ (same as above) |
| `sampleDelta` | `motion-dom/src/animation/NativeAnimationExtended.ts:18` | ″ (same as above) |
| `hasWarned` | `motion-utils/src/warn-once.ts:5` | Dev-only diagnostics; undocumented |
| `invariant` | `motion-utils/src/errors.ts:10` | ″ (same as above) |
| `warning` | `motion-utils/src/errors.ts:9` | ″ (same as above) |
| `warnOnce` | `motion-utils/src/warn-once.ts:9` | ″ (same as above) |
| `buildTransformer` | `motion-dom/src/value/types/complex/index.ts:102` | Complex-value transformer internal (used by `mixComplex`); undocumented |

### Follow-ups (bucket d and related; not this plan)

1. **`followValue`**: add an augmented `followValue` to `src/lib/utils/vanillaValues.svelte.ts` next to
   `springValue`, to pair with our existing `useFollowValue`. Remove it from the allowlist in the same change.
2. **`MotionValue` (runtime class)**: decide how a value export can live beside our `MotionValue` type, for
   example by exporting the class under its own name and checking that `instanceof` works on augmented values.
3. **`recordStats`**: add a `./debug` subpath to `package.json` `exports` that mirrors `motion/debug`. This
   touches the same `exports` map as plan 010, so it goes after 010.
4. Not in the allowlist, because they aren't in `motion`'s main entry, but related: a `./mini` subpath that
   mirrors `motion/mini` (`animate` = `animateMini`, `animateSequence`), and a Svelte counterpart of React's
   `useAnimateMini` (`framer-motion/src/index.ts:73`), i.e. a WAAPI-only `useAnimate`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | see each step |
| Unit tests | `pnpm test:only` | all pass |
| Build + package (publint) | `pnpm build` (runs `vite build && npm run package`; `package` = `svelte-kit sync && svelte-package && publint`) | exit 0, publint prints no errors or warnings |
| Typecheck | `pnpm check` (after `pnpm build`) | 0 errors |
| Consumer / tree-shaking | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` (after `pnpm build`) | prints `Tree-shaking consumer checks passed.`, exit 0 |
| Docs | `pnpm --dir docs build`, then `pnpm --dir docs check`, then `pnpm --dir docs test` | exit 0 / 0 errors / all pass |
| One e2e spec | `PW_PORT=4222 pnpm exec playwright test <spec>` | pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Order matters (CONTRIBUTING.md "Full verification"): build the package before `pnpm check`, the consumer test and
the docs build (docs import the built `dist/`); the docs build generates inputs `pnpm --dir docs check` relies on.
The docs build rewrites the tracked `docs/static/r/animated-tabs.json`; restore it with
`git checkout -- docs/static/r/animated-tabs.json`, never commit it.

## Scope

**In scope** (create unless noted):

- `src/lib/__tests__/motionExportAllowlist.ts` (modify: remove 5 names, regroup by bucket, add two exported sets)
- `src/lib/index.spec.ts` (modify: two tripwire tests, one re-export test, a compile-only type block)
- `src/lib/utils/motionReexports.ts` (new: JSDoc'd re-export bindings for `animateMini`, `inertia`, `keyframes`, `resolveElements`)
- `src/lib/utils/motionReexports.spec.ts` (new: behaviour tests)
- `src/lib/utils/animateValue.ts` (modify: add `ScopedAnimateOptions` + typed `createScopedAnimate`)
- `src/lib/utils/animateValue.spec.ts` (modify: `createScopedAnimate` tests + compile-only lines)
- `src/lib/utils/animate.svelte.ts` (modify: import our typed `createScopedAnimate`, drop the cast — Step 3.4 only)
- `src/lib/index.ts` (modify: one runtime block, one type block)
- `src/routes/tests/motion-reexports/+page.svelte`, `e2e/utilities/motion-reexports.spec.ts`
- `src/routes/+page.svelte` (modify: one link)
- `tests/consumer-vite6/verify-tree-shaking.mjs` (modify: check 5 additions)
- `docs/src/routes/docs/create-scoped-animate/+page.svx` + `+page.ts`,
  `docs/src/routes/docs/inertia/+page.svx` + `+page.ts`,
  `docs/src/routes/examples/create-scoped-animate/+page.svelte` + `+page.ts`,
  `docs/src/routes/examples/inertia/+page.svelte` + `+page.ts`,
  `docs/src/lib/examples/create-scoped-animate/demos/Default.svelte`,
  `docs/src/lib/examples/inertia/demos/Default.svelte`
- `docs/src/lib/docsNav.ts` (two entries), `docs/src/lib/examplesIndex.ts` (two entries),
  `docs/src/routes/docs/api-reference/+page.svx` (the "Re-exports from `motion`" section only)
- `.changeset/reexport-motion-public-api.md`

**Out of scope**:

- Every bucket (b), (c) and (d) name: none gets re-exported. The (d) follow-ups are separate plans.
- Wrapping or changing the behaviour of any re-exported function. Every new export must be `===` to `motion`'s
  (identity tests enforce this). `createScopedAnimate` gets a type-only cast, exactly like `animate`.
- Exporting motion-dom's `AnimationScope` type or motion's `MotionValue` (both names are ours already).
- Exporting `ScopedAnimateOptions` from `src/lib/index.ts` (upstream doesn't export it).
- New `package.json` `exports` subpaths (`./mini`, `./debug`), `pnpm-lock.yaml`, the `motion` pins.
- `useAnimate`'s behaviour. Step 3.4 changes only an import and a cast.
- Other docs pages, `docs/src/lib/compare-data.ts`, the README of this plan batch.

## Git workflow

- Lane branch `lane/1471-exports` in `../svelte-motion-1471-exports`. The dispatcher creates it by hand from
  `feat/motion-14.7.1` **after 009 is merged there** (not with `isolation: 'worktree'`, which forks `origin/main`).
  014 merges back last. Before merging back, `git merge --no-ff feat/motion-14.7.1` into the lane and re-run
  Step 9. Plans merged after the lane was cut (010's consumer checks, 004/007's `docsNav.ts` entries, any new
  re-export) can conflict with this plan's edits or trip the tripwire. Keep every side's entries.
- Conventional commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`:
  `test(exports): expect Motion's public API among our exports`,
  `feat(exports): re-export createScopedAnimate, animateMini, inertia, keyframes and resolveElements`,
  `feat(types): re-export generator, selector and WAAPI option types`,
  `test(exports): motion re-exports demo page`, `test(consumer): tree-shaking guards for the new re-exports`,
  `docs: createScopedAnimate, inertia and keyframes`, `chore(changeset): re-export Motion public API`.
- Do NOT push or open a PR.

## Steps

### Step 0: Preconditions

1. `git log --oneline -40 | grep -c "tripwire for unreviewed motion exports"` → `1` (009 is merged). If `0`, STOP.
2. `grep -n '"motion": "14.7.1"' package.json` prints a line; `pnpm install --frozen-lockfile` exits 0.
3. `pnpm exec vitest run src/lib/index.spec.ts` → all pass (the tripwire is green before you start).
4. Confirm the allowlist matches this plan's audit:
   ```bash
   node --input-type=module -e "
   import fs from 'fs'
   const s = fs.readFileSync('src/lib/__tests__/motionExportAllowlist.ts', 'utf8')
   const names = [...s.matchAll(/^    '([^']+)'/gm)].map((m) => m[1])
   console.log(names.length, names.filter((n) => !process.argv.slice(1).includes(n)).join(' ') || '(none extra)')
   " $(sed -n 's/^| `\([^`]*\)` |.*/\1/p' .agents/.plans/motion-14-7-1/014-reexport-missing-motion-api.md | sort -u)
   ```
   (If this plan file isn't committed in your lane, point the `sed` at
   `/Users/jasonkummerl/Github/svelte-motion-1471/.agents/.plans/motion-14-7-1/014-reexport-missing-motion-api.md`.)
   Expected: `291 (none extra)`. A count of `290` with `(none extra)` is also fine; it means 009 didn't add
   `buildTransformer`. Add it yourself in Step 3 (bucket c, keyframe/value-type group). Any extra name means
   the allowlist changed in a way this audit didn't cover: STOP and list the names.

### Step 1: Red tripwire tests

1. In `src/lib/__tests__/motionExportAllowlist.ts`, add two exports **below** the existing set (don't change the
   set yet):
   ```ts
   /**
    * Upstream public, framework-agnostic API that `src/lib/index.ts` must re-export as-is
    * (identical to `motion`'s binding). Bucket (a) of plan 014's audit: hand-curated in
    * `framer-motion/src/dom.ts` (`createScopedAnimate`, `animateMini`), documented on motion.dev
    * (`resolveElements`), or a generator sibling of the re-exported `spring` (`inertia`, `keyframes`).
    */
   export const MOTION_PUBLIC_REEXPORTS: readonly string[] = [
       'animateMini',
       'createScopedAnimate',
       'inertia',
       'keyframes',
       'resolveElements'
   ]

   /**
    * Allowlisted names that are public enough to want but need a Svelte adaptation before they
    * can be exported (plan 014 bucket (d)). Each stays in MOTION_EXPORTS_NOT_REEXPORTED until its
    * follow-up lands; that change removes it from both sets.
    */
   export const MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION: ReadonlySet<string> = new Set<string>([
       'followValue', // augmented vanilla factory next to springValue (vanillaValues.svelte.ts)
       'MotionValue', // runtime class vs our MotionValue type
       'recordStats' // upstream ships it only from the motion/debug subpath
   ])
   ```
2. In `src/lib/index.spec.ts`, import both, and right after the existing tripwire `it(…)` add:
   ```ts
   it('re-exports Motion public API as-is (plan 014 bucket a)', async () => {
       const motionNs = (await import('motion')) as Record<string, unknown>
       const ours = (await import('./index.js')) as Record<string, unknown>
       for (const name of MOTION_PUBLIC_REEXPORTS) {
           expect(MOTION_EXPORTS_NOT_REEXPORTED.has(name), `${name} is still allowlisted`).toBe(false)
           expect(typeof motionNs[name], `motion no longer exports ${name}`).toBe('function')
           expect(ours[name], `${name} is not re-exported as motion's binding`).toBe(motionNs[name])
       }
   })

   it('keeps names awaiting a Svelte adaptation allowlisted and unexported (plan 014 bucket d)', async () => {
       const ours = (await import('./index.js')) as Record<string, unknown>
       for (const name of MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION) {
           expect(MOTION_EXPORTS_NOT_REEXPORTED.has(name), `${name} must stay allowlisted`).toBe(true)
           expect(name in ours, `${name} is exported; drop it from the pending set`).toBe(false)
       }
   })
   ```

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → the bucket-(a) test **FAILS** with
`animateMini is still allowlisted`. The bucket-(d) test and the original tripwire pass. Commit.

### Step 2: Red behaviour tests

1. Create `src/lib/utils/motionReexports.spec.ts`. Import from `'../index.js'` (the public surface), plus
   `inertia as inertiaCore, keyframes as keyframesCore, resolveElements as resolveElementsCore, animateMini as animateMiniCore`
   from `'motion'` and `motionValue` from `'./vanillaValues.svelte.js'`. Install the real-timer
   `requestAnimationFrame` shim in `beforeEach`, copied from `src/lib/utils/animate.spec.ts:11-20`. Cases (cite
   the upstream file in a comment above each `describe`):
   - `describe('inertia (motion-dom generators/inertia.ts @ v14.7.1)')`
     1. `is motion's inertia`: `expect(inertia).toBe(inertiaCore)`.
     2. `decelerates to origin + power × velocity`:
        `const g = inertia({ keyframes: [0], velocity: 1000 })` → `g.next(0).value` is `0`,
        `g.next(100).value` is strictly between `0` and `800`, `g.next(5000)` equals `{ value: 800, done: true }`.
     3. `springs back inside max`: `inertia({ keyframes: [0], velocity: 1000, max: 300, bounceStiffness: 500, bounceDamping: 40 })`.
        Step `t` by 16 from 0 until `done` (cap at 10000) → final `value` is `300` (`toBeCloseTo(300, 1)`).
     4. `works as a transition type, same as 'inertia'`: two `motionValue(0)`s, `await animate(a, [0], { type: inertia, velocity: 1000, power: 0.5 })`
        and `await animate(b, [0], { type: 'inertia', velocity: 1000, power: 0.5 })` → `a.get()` is `500`
        (`toBeCloseTo(500, 0)`) and `a.get()` equals `b.get()`.
   - `describe('keyframes (motion-dom generators/keyframes.ts @ v14.7.1)')`
     1. identity with `keyframesCore`.
     2. `samples an eased tween`: `keyframes({ keyframes: [0, 100], duration: 1000 })` → `.next(0).value` `0`,
        `.next(500).value` `50`, `.next(1000)` `{ value: 100, done: true }`.
     3. `honours ease`: `keyframes({ keyframes: [0, 100], duration: 1000, ease: 'linear' }).next(250).value` → `25`.
     4. `works as a transition type`: `await animate(mv, 100, { type: keyframes, duration: 0.2 })` → `mv.get()` is `100`.
   - `describe('resolveElements (motion-dom utils/resolve-elements.ts @ v14.7.1)')`. Build
     `<div id="outside"><li></li></div><ul id="scope"><li></li><li></li></ul>` in `document.body`; remove it in
     `afterEach`.
     1. identity with `resolveElementsCore`.
     2. `resolves selectors against the whole document by default`: `resolveElements('li')` has length `3`.
     3. `limits selectors to a scope`: `resolveElements('li', { current: document.getElementById('scope'), animations: [] })` → length `2`.
     4. `accepts the useAnimate scope`: `const [scope] = useAnimate<HTMLUListElement>()`, run the attachment
        (`const detach = scope(document.getElementById('scope') as HTMLUListElement)`) →
        `resolveElements('li', scope)` has length `2`; call `detach()`. If this needs a cast to compile, STOP (see
        STOP conditions).
     5. `normalises empties and lists`: `resolveElements(null)` and `resolveElements(undefined)` → `[]`;
        `resolveElements([el, null as never, el2])` → `[el, el2]`; `resolveElements(el)` → `[el]`.
   - `describe('animateMini (framer-motion animators/waapi/animate-style.ts @ v14.7.1)')`
     1. identity with `animateMiniCore` and `typeof animateMini === 'function'`. Add a comment: jsdom has no WAAPI;
        `e2e/utilities/motion-reexports.spec.ts` covers the behaviour.
2. In `src/lib/utils/animateValue.spec.ts`, add `describe('utils/animateValue - createScopedAnimate')` (it
   imports `createScopedAnimate` from `./animateValue.js` and `createScopedAnimate as createScopedAnimateCore`
   from `'motion'`). Use the file's existing fake-timer style:
   1. `is motion's createScopedAnimate (pure re-type, no runtime wrapper)`: `toBe(createScopedAnimateCore)`.
   2. `registers its animations on the scope`: `const scope = { current: document.createElement('div'), animations: [] as unknown[] }`,
      `const tl = createScopedAnimate({ scope })(motionValue(0), 100, { duration: 0.5 })` →
      `scope.animations` contains `tl`.
   3. `resolves selectors only inside the scope`: append a container holding one `.box`, and one more `.box`
      outside it, to `document.body`. Run `createScopedAnimate({ scope: { current: container, animations: [] } })('.box', { opacity: 0.5 }, { duration: 0.1 })`
      and advance 300 ms → the inner box's `style.opacity` is `'0.5'` and the outer box's is `''`. Clean up the DOM.
   4. `skipAnimations jumps to the target`: `createScopedAnimate({ skipAnimations: true })(mv, 100, { duration: 5 })`,
      advance 100 ms → `mv.get()` is `100`.
   5. `returns a Motion 14.7 Timeline`: `typeof createScopedAnimate()(mv, 1).add` is `'function'`.

**Verify**: `pnpm exec vitest run src/lib/utils/motionReexports.spec.ts src/lib/utils/animateValue.spec.ts` →
every new case **FAILS** (`inertia is not a function` / `expected undefined to be [Function inertia]`, or a missing
`createScopedAnimate` export from `./animateValue.js`). Existing `animateValue.spec.ts` cases still pass. If case 3
of `createScopedAnimate` leaves the outer box's `style.opacity` non-empty, or case 4 of `inertia` doesn't reach
500 once green, STOP (behaviour differs from the measured upstream). Commit (red).

### Step 3: Re-export the five names; update the allowlist

1. `src/lib/utils/animateValue.ts`: import `createScopedAnimate as createScopedAnimateCore` (runtime) and
   `type AnimationScope as MotionAnimationScope` from `motion` / `motion-dom`. Then add:
   ```ts
   /**
    * Options for {@link createScopedAnimate}. Mirrors upstream's (unexported)
    * `ScopedAnimateOptions` in `framer-motion/src/animation/animate/index.ts`.
    */
   export interface ScopedAnimateOptions {
       /** Element scope: selectors resolve inside `scope.current`, and started animations are pushed onto `scope.animations`. Accepts the scope from `useAnimate()`. */
       scope?: MotionAnimationScope
       /** Make transform and layout values animate instantly, as `MotionConfig reducedMotion="always"` does. */
       reduceMotion?: boolean
       /** Skip every animation straight to its final value. */
       skipAnimations?: boolean
   }
   ```
   Then add `export const createScopedAnimate = createScopedAnimateCore as (options?: ScopedAnimateOptions) => SvelteMotionAnimate`,
   with Google-style JSDoc in this file's style. Cover: what it creates (an `animate` bound to an optional scope
   and settings; selector strings resolve inside `scope.current`; animations it starts are registered on
   `scope.animations` and so stop with the scope); that it is what `useAnimate()` uses internally; that it returns
   a `Timeline` for every call shape (Motion 14.7); that it has no `addEffect`/`removeEffect` statics (only the
   module-level `animate` does). Add `@param options …`, `@returns …` and an `@example` that scopes to a
   container element. Add `@see https://motion.dev/docs/animate`. Before writing the cast, check that
   `MotionAnimationScope` accepts our `AnimationScope` from `animate.svelte.ts` (Step 2 case 4 needs it). If our
   scope type doesn't fit, widen the option to `MotionAnimationScope | AnimationScope<Element>` and say so in the
   JSDoc.
2. Create `src/lib/utils/motionReexports.ts`. Give each of `animateMini`, `inertia`, `keyframes` and
   `resolveElements` a JSDoc'd binding (one block each, in the `arc.ts:53-80` style):
   ```ts
   import { animateMini as animateMiniCore, inertia as inertiaCore, keyframes as keyframesCore, resolveElements as resolveElementsCore } from 'motion'

   /**
    * Decelerating "inertia" generator — the function behind `transition.type: 'inertia'` …
    * @param options `keyframes` (`[origin]`), `velocity`, `power` (0.8), `timeConstant` (325 ms), `min`/`max`,
    *   `bounceStiffness`/`bounceDamping` for the boundary spring, `modifyTarget`, `restDelta`/`restSpeed`.
    * @returns A `KeyframeGenerator<number>`: call `next(ms)` for `{ value, done }`.
    * @example …
    * @see https://motion.dev/docs/animate#type
    */
   export const inertia: typeof inertiaCore = inertiaCore
   ```
   The JSDoc summary for each:
   - `keyframes`: the tween generator behind `type: 'keyframes'`/`'tween'`; `duration` (ms, default 300),
     `times`, `ease` (default `'easeInOut'`).
   - `resolveElements`: selector / element / NodeList / array → `Element[]`; the optional scope limits selectors
     (accepts `useAnimate()`'s scope); an active `scopeMotion` root is used when there's no scope;
     `null`/`undefined` → `[]`. `@see https://motion.dev/docs/resolve-elements`.
   - `animateMini`: the Web Animations-only `animate` (what Motion ships as `animate` from `motion/mini`): HTML/SVG
     elements and selectors only, with no motion values, objects or sequences; hardware-accelerated where the
     browser allows; returns `AnimationPlaybackControlsWithThen`. `@see https://motion.dev/docs/animate`.

   Keep each binding a plain `export const x: typeof xCore = xCore` (no wrapper), so identity and tree-shaking
   hold.
3. `src/lib/index.ts`: right after `export { animate } from '$lib/utils/animateValue'` (and 009's timeline type
   block) add
   ```ts
   // Upstream public, framework-agnostic API (plan 014): the scoped animate
   // factory useAnimate is built on, the WAAPI-only `motion/mini` animate, the
   // inertia/keyframes generators (siblings of `spring`) and resolveElements.
   // Identical bindings to motion's; JSDoc lives at the definitions.
   export { createScopedAnimate } from '$lib/utils/animateValue'
   export { animateMini, inertia, keyframes, resolveElements } from '$lib/utils/motionReexports'
   ```
4. `src/lib/utils/animate.svelte.ts`: replace `import { createScopedAnimate } from 'motion'` with
   `import { createScopedAnimate } from './animateValue.js'`. Drop the now-redundant `as SvelteMotionAnimate` on
   the `createScopedAnimate({ … })` result, and the `scope as MotionAnimationScope<T>` cast too if it is no longer
   needed. Change nothing else in the file. If removing a cast produces a type error you can't fix by
   import/annotation alone, restore the casts and say so in your report. This sub-step is optional.
5. `src/lib/__tests__/motionExportAllowlist.ts`:
   - Remove the five bucket-(a) names.
   - Prefix every group comment with its bucket from this plan's table, `[b]` or `[c]`, e.g.
     `// [b] Renderer and VisualElement internals …`. Groups that mix buckets get split so each comment carries
     one bucket.
   - Move `addAttrValue`, `addStyleValue`, `addSVGValue`, `originProps`, `readStyleValue` and `readSVGValue`
     from the renderer group into the `[c]` effect-internals group.
   - Move `followValue`, `MotionValue` and `recordStats` into a new
     `// [d] Public, but needs a Svelte adaptation first (plan 014 follow-ups)` group.
   - Move `buildTransformer` out of 009's "new in Motion 14.7.1" group (or add it, see Step 0.4) into the `[c]`
     keyframe-resolvers/value-types group, and delete the then-empty group.
   - Extend the top comment with one paragraph: buckets `[b]` (React-only machinery with a Svelte equivalent),
     `[c]` (internal / deprecated / dev-only), `[d]` (public, pending a Svelte adaptation, mirrored in
     `MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION`). The test for a new name is: documented on motion.dev,
     hand-curated in `framer-motion/src/dom.ts`, or a sibling of something we re-export → re-export it; otherwise
     allowlist it under a bucket.

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts src/lib/utils/motionReexports.spec.ts src/lib/utils/animateValue.spec.ts src/lib/utils/animate.spec.ts`
→ all pass: the original tripwire (no unaccounted, no stale), the bucket (a)/(d) tests, every Step 2 case,
and the existing `useAnimate` suite. `grep -c "^    '" src/lib/__tests__/motionExportAllowlist.ts` → `294`:
286 in `MOTION_EXPORTS_NOT_REEXPORTED` (291 − 5), plus the 5 entries of `MOTION_PUBLIC_REEXPORTS` and the 3 of
`MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION`, which use the same indentation. (From a 290-name start where you added
`buildTransformer` yourself, it's the same 294.) Commit.

### Step 4: Type re-exports and compile-only assertions

1. `src/lib/index.ts`: below the Step 3 block add
   ```ts
   export type {
       AnimationOptions,
       AnimationPlaybackControlsWithThen,
       DOMKeyframesDefinition,
       ElementOrSelector,
       GeneratorFactory,
       InertiaOptions,
       KeyframeGenerator,
       KeyframeOptions,
       SelectorCache,
       SpringOptions,
       ValueAnimationOptions
   } from 'motion'
   ```
   These are the types in the signatures of the five re-exports, plus `SpringOptions` for the `spring` we already
   ship. First `grep -nw '<Name>' src/lib/index.ts` for each name. Skip any name that is already exported
   (a merged plan may have added it). If one of these names is already exported **as a different type of ours**,
   STOP.
2. Compile-only block in `src/lib/index.spec.ts` (pattern: `animateValue.spec.ts` `typeAssertions()`; never
   invoked; `void plan014TypeAssertions`):
   ```ts
   function plan014TypeAssertions() {
       const [scope] = useAnimate<HTMLDivElement>()
       const scoped = createScopedAnimate({ scope, reduceMotion: true, skipAnimations: false })
       const tl: Timeline = scoped(motionValue(0), 100) // augmented value, no cast
       const fromSelector: Timeline = createScopedAnimate()('.box', { opacity: 1 })
       // @ts-expect-error the scoped animate has no effect-registry statics
       void scoped.addEffect
       const options: ValueAnimationOptions<number> = { keyframes: [0], velocity: 500 }
       const gen: KeyframeGenerator<number> = inertia(options)
       const tween: KeyframeGenerator<number> = keyframes({ keyframes: [0, 1], duration: 300 })
       const factory: GeneratorFactory = inertia
       const inertiaTransition: InertiaOptions = { power: 0.5, min: 0, max: 100 }
       const tweenTransition: KeyframeOptions = { ease: 'linear', times: [0, 1] }
       const springTransition: SpringOptions = { stiffness: 300, damping: 20 }
       const target: ElementOrSelector = '.box'
       const cache: SelectorCache = {}
       const els: Element[] = resolveElements(target, scope, cache)
       const kf: DOMKeyframesDefinition = { opacity: [0, 1] }
       const opts: AnimationOptions = { duration: 0.2 }
       const mini: AnimationPlaybackControlsWithThen = animateMini('.box', kf, opts)
       // @ts-expect-error animateMini animates elements only, not motion values
       animateMini(motionValue(0), { opacity: 1 })
       void [tl, fromSelector, gen, tween, factory, inertiaTransition, tweenTransition, springTransition, els, mini]
   }
   void plan014TypeAssertions
   ```
   Adjust only what the real types force (for example, if `GeneratorFactory` needs `as GeneratorFactory`
   because `inertia` lacks `applyToOptions`, write it as `const factory: GeneratorFactory = inertia as GeneratorFactory`
   and add a one-line comment). If either `@ts-expect-error` is reported unused, STOP.

**Verify**: `pnpm build` (exit 0, publint clean), then `pnpm check` → 0 errors. `pnpm exec vitest run src/lib/index.spec.ts`
→ all pass. Commit.

### Step 5: Demo page and e2e

Create `src/routes/tests/motion-reexports/+page.svelte`. Start with a header comment: "Upstream public API
re-exported by plan 014; behaviours as in Motion 14.7.1". Set `data-hydrated` on a root `data-testid="stage"`
in `onMount`, like `src/routes/tests/useAnimate/+page.svelte`. Four sections, every element with a `data-testid`:

1. **createScopedAnimate**: two cards, `card-a` and `card-b`, each with three `.dot` (40×40) elements
   (`dot-a-0…2`, `dot-b-0…2`). `const scopedA = createScopedAnimate({ scope: { current: cardA, animations: [] } })`
   (bind `cardA` with `bind:this`; build the function in `onMount`). Button `run-scoped` →
   `scopedA('.dot', { x: 100 }, { duration: 0.4 })`.
2. **inertia**: a 300px track with a 24px `ball`. `const x = motionValue(0)`, and
   `styleEffect(ballEl, { x })` in `onMount`. Button `fling` →
   `animate(x, [0], { type: inertia, velocity: 2000, max: 240, bounceStiffness: 400, bounceDamping: 30 })`
   (reset `x.jump(0)` first). Readout `ball-x` shows `Math.round(x.get())` via `x.on('change')`.
3. **animateMini**: a box `mini-box` at `opacity: 1`. Button `run-mini` →
   `animateMini(miniBox, { opacity: 0.25 }, { duration: 0.6 })`. Readout `mini-running` is set to
   `String(miniBox.getAnimations().length > 0)` right after the call.
4. **resolveElements**: a wrapper `<div data-testid="resolve-section">` holding a `ul` (`resolve-scope`) with
   2 `li` and a second `ul` with 3 `li`. On mount, readouts `resolve-doc` =
   `resolveElements('[data-testid="resolve-section"] li').length` (the TesterPanel renders its own list items, so
   never count bare `'li'` against the document) and `resolve-scoped` =
   `resolveElements('li', { current: scopeUl, animations: [] }).length`.

Add a guided TesterPanel (exemplar `src/routes/tests/drag/disable-from-ondrag/+page.svelte` +
`src/routes/tests/layout/_parity/TesterPanel.svelte`), hidden under `?@isPlaywright=true`. Steps and live
verdicts:
- "Run scoped → only card A's dots slide".
- "Fling → ball overshoots toward the wall and settles at 240".
- "Mini → box fades to 25% (Web Animations)".
- "Counts read 5 / 2".

Create `e2e/utilities/motion-reexports.spec.ts`. Load `/tests/motion-reexports?@isPlaywright=true` and wait for
`data-hydrated="true"`. Read translateX with `getComputedStyle(el).transform` through `new DOMMatrix(…).m41`,
following existing utilities specs.
1. click `run-scoped` → within 2 s every `dot-a-*` has translateX ≈ 100 (±1) and every `dot-b-*` ≈ 0.
2. click `fling` → within 4 s `ball-x` reads `240` and the ball's translateX ≈ 240 (±2).
3. click `run-mini` → `mini-running` is `true`; within 2 s the computed opacity of `mini-box` ≈ 0.25 (±0.02).
4. `resolve-doc` reads `5`, `resolve-scoped` reads `2`.

Link it from `src/routes/+page.svelte`, Utilities list, right after "useAnimate — timelines (Motion 14.7)":
"Motion re-exports — createScopedAnimate, inertia, animateMini, resolveElements".

**Verify**: `PW_PORT=4222 pnpm exec playwright test e2e/utilities/motion-reexports.spec.ts e2e/utilities/use-animate.spec.ts e2e/utilities/use-animate-timeline.spec.ts`
→ all pass. Re-run a failing spec alone once before reporting, and say that it was re-run. This page is net-new: it
can't be red first, because importing the missing exports would break the whole app build. Step 1-2's unit tests
are the red anchors. Commit.

### Step 6: Tree-shaking guards

In `tests/consumer-vite6/verify-tree-shaking.mjs`, check 5:
1. Extend the `for (const name of ['animate', 'frame', 'useTransform', 'useScroll'])` derivation guard with
   `'createScopedAnimate', 'animateMini', 'inertia', 'keyframes', 'resolveElements'`. The existing component-layer
   assertion then covers them.
2. After check 5, add check 6, `// 6. Light re-exports don't drag in the Timeline / animate() engine.`:
   ```js
   const TIMELINE_MARKER = /class Timeline\b/
   const heavy = await bundle(`export { createScopedAnimate } from '${PKG}'`)
   assert.ok(TIMELINE_MARKER.test(heavy.code), 'positive control: createScopedAnimate should bundle the Timeline class')
   for (const name of ['inertia', 'keyframes', 'resolveElements', 'animateMini']) {
       const light = await bundle(`export { ${name} } from '${PKG}'`)
       assert.ok(!TIMELINE_MARKER.test(light.code), `${name} pulls in the Timeline/animate() engine`)
   }
   ```
   Each bundle uses the file's existing `bundle()` helper.

**Verify**: `pnpm build`, then `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0 with
`Tree-shaking consumer checks passed.` If the positive control fails, the marker doesn't survive our build: find
a marker that does (a string unique to `framer-motion`'s timeline module, verified present in `heavy` and absent
from `export { spring }`), and note the swap in your report. If a light re-export trips the marker, STOP; don't
loosen the check. Commit.

### Step 7: Docs

1. `docs/src/routes/docs/create-scoped-animate/+page.svx` + `+page.ts`. Model both on `docs/src/routes/docs/arc/`.
   Title `createScopedAnimate`; SEO via `getSeoContext()` (`seo.ogSlug = 'docs-create-scoped-animate'`). Sections:
   - What it is: an `animate` bound to a scope element and settings, the factory `useAnimate()` is built on.
   - "## Usage", vanilla with a container element.
   - "## Options": `scope`, `reduceMotion`, `skipAnimations`.
   - "## When to use it instead of useAnimate": outside components, in actions/attachments or plain modules,
     or when you own the element's lifecycle. Note that animations stop with the scope only if you stop
     `scope.animations` yourself.
   - "## Returns": the same call shapes as `animate`, each returning a `Timeline`; no
     `addEffect`/`removeEffect`.
   - An `<Example isSmall exampleUrl="/examples/create-scoped-animate">` embed.
2. `docs/src/routes/docs/inertia/+page.svx` + `+page.ts`, titled `inertia & keyframes`. Sections:
   - `type: 'inertia'` vs passing the `inertia` function as `type` (same result).
   - The options table: `velocity`, `power`, `timeConstant`, `min`, `max`, `bounceStiffness`, `bounceDamping`,
     `modifyTarget` (snap-to-grid example: `modifyTarget: (t) => Math.round(t / 50) * 50`), `restDelta`,
     `restSpeed`.
   - Sampling a generator manually (`const g = inertia({ keyframes: [0], velocity: 1000 }); g.next(16)`).
   - "## keyframes": the tween generator, `duration` in ms, `ease`, `times`.
   - A note that `spring` works the same way.
   - An `<Example isSmall exampleUrl="/examples/inertia">` embed.
3. Demos:
   - `docs/src/lib/examples/create-scoped-animate/demos/Default.svelte`: two cards, one scoped animate, a button
     that shuffles one card's chips (only that card moves).
   - `docs/src/lib/examples/inertia/demos/Default.svelte`: a track with walls, three "fling" buttons (slow /
     medium / fast velocity), an optional "snap to 50px" `modifyTarget` toggle, and a live position readout.
   - Example routes `docs/src/routes/examples/create-scoped-animate/` and `docs/src/routes/examples/inertia/`
     with one `ExampleSection` each (`figId: 'FIG-001'`), modelled on `docs/src/routes/examples/arc/+page.svelte`
     (literal `seo.title = 'createScopedAnimate | Svelte Motion'` / `'inertia | Svelte Motion'`). Register both in
     `docs/src/lib/examplesIndex.ts` next to `arc`.
4. `docs/src/lib/docsNav.ts`, group `'Animation'`: add
   `{ title: 'createScopedAnimate', href: '/docs/create-scoped-animate', icon: Box }` after `scopeMotion`, and
   `{ title: 'inertia & keyframes', href: '/docs/inertia', icon: Gauge }` after `arc()`. Use icons that are already
   imported. Keep any entries other plans added.
5. `docs/src/routes/docs/api-reference/+page.svx`, "Re-exports from `motion`":
   - In the "Imperative animation" import block, add `animateMini` (`// Web Animations-only animate (motion/mini)`),
     `createScopedAnimate` (`// animate bound to a scope element (what useAnimate uses)`) and `resolveElements`
     (`// selector / element / list → Element[]`), keeping alphabetical order.
   - Add a "### Generators" subsection after "Motion paths":
     `import { inertia, keyframes, spring } from '@humanspeak/svelte-motion'`, one sentence, and a link to
     `/docs/inertia`.

**Verify**: `pnpm build`, then `pnpm --dir docs build` (exit 0; if only the GitHub-stats fetch fails because of
the network, record it and continue), `pnpm --dir docs check` (0 errors), `pnpm --dir docs test` (all pass).
Restore `docs/static/r/animated-tabs.json`. Commit.

### Step 8: Changeset

`.changeset/reexport-motion-public-api.md`, `'@humanspeak/svelte-motion': minor`:
"Re-export more of Motion's public, framework-agnostic API: `createScopedAnimate` (an `animate` bound to a scope
element, the factory behind `useAnimate`), `animateMini` (the Web Animations-only `animate` from `motion/mini`),
the `inertia` and `keyframes` generators (alongside `spring`) and `resolveElements`. Also export the
`ValueAnimationOptions`, `KeyframeGenerator`, `GeneratorFactory`, `InertiaOptions`, `KeyframeOptions`,
`SpringOptions`, `ElementOrSelector`, `SelectorCache`, `DOMKeyframesDefinition`, `AnimationOptions` and
`AnimationPlaybackControlsWithThen` types. All are Motion's own functions, unchanged." Commit.

### Step 9: Gate

In this order, all from the lane root:
1. `trunk fmt <every changed file>` then `trunk check <every changed file>` → clean (`git diff --name-only feat/motion-14.7.1...HEAD`).
2. `pnpm build` → exit 0, publint clean.
3. `pnpm check` → 0 errors.
4. `pnpm test:only` → all pass.
5. `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0.
6. `pnpm --dir docs build`, then `pnpm --dir docs check` → 0 errors (restore `animated-tabs.json` afterwards).
7. `PW_PORT=4222 pnpm exec playwright test e2e/utilities` → all pass (re-run a failing spec alone once).
8. `git diff --check` clean; `git status` shows only in-scope files.

Report each result, the final allowlist size, and the commit SHAs.

## Test plan

- **Red-first anchors** (fail on the unmodified lane, pass after Step 3): the bucket-(a) tripwire test (Step 1;
  first failure `animateMini is still allowlisted`); every new case in `motionReexports.spec.ts` and the new
  `createScopedAnimate` describe in `animateValue.spec.ts` (Step 2; the exports are `undefined`).
- **Guards**: the original tripwire (catches stale entries if a name is exported but not de-listed), the
  bucket-(d) test (keeps follow-ups honest), the identity assertions (no wrappers), the compile-only Step 4
  block (`pnpm check`; two `@ts-expect-error`s), the consumer tree-shaking checks 5-6, and the existing
  `animate.spec.ts` / `use-animate*.spec.ts` (Step 3.4 must not change `useAnimate`).
- **e2e**: `e2e/utilities/motion-reexports.spec.ts` is net-new and can't be red first (see Step 5); it is the
  only real-browser coverage for `animateMini` (WAAPI) and for `inertia`'s boundary spring as painted.
- Patterns: `src/lib/utils/animateValue.spec.ts` (identity + compile-only), `src/lib/utils/animate.spec.ts`
  (real-timer rAF shim), `e2e/utilities/use-animate.spec.ts`, the TesterPanel exemplar above.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/index.spec.ts` passes, including the tripwire and both plan-014 tests
- [ ] For each of `animateMini createScopedAnimate inertia keyframes resolveElements`:
      `grep -c "'<name>'" src/lib/__tests__/motionExportAllowlist.ts` → `1` (only in `MOTION_PUBLIC_REEXPORTS`)
- [ ] Every group comment is tagged: `grep -c "^    // " src/lib/__tests__/motionExportAllowlist.ts` equals
      `grep -c "^    // \[[bcd]\] " src/lib/__tests__/motionExportAllowlist.ts`, and the `[d]` group holds exactly
      `followValue`, `MotionValue`, `recordStats`. `grep -n "new in Motion 14.7.1" src/lib/__tests__/motionExportAllowlist.ts` → none
- [ ] `grep -n "createScopedAnimate" src/lib/index.ts` → 1 export line; `grep -c "export const .*: typeof .*Core = .*Core" src/lib/utils/motionReexports.ts` → `4`
- [ ] `pnpm build` (publint clean), `pnpm check` (0 errors), `pnpm test:only` (pass), consumer test (pass)
- [ ] `pnpm --dir docs check` 0 errors; docs pages `create-scoped-animate` and `inertia` plus both example routes
      exist and are linked from `docsNav.ts` / `examplesIndex.ts`
- [ ] `e2e/utilities/motion-reexports.spec.ts` passes on `PW_PORT=4222`; the page has a TesterPanel hidden
      under `@isPlaywright=true` and is linked from `src/routes/+page.svelte`
- [ ] `.changeset/reexport-motion-public-api.md` exists with `minor`
- [ ] `trunk check` clean on changed files; no out-of-scope file modified

## STOP conditions

- 009 isn't merged into the lane's base, `motion` isn't 14.7.1, or the tripwire is red before Step 1.
- Step 0.4 reports allowlist names that aren't in this plan's audit table.
- Any of the five names isn't a function on `motion` 14.7.1, or a Step 2 case's green value differs from the
  values measured in "Current state" (inertia 800 / 300 / 500; keyframes 50 / 25 / 100; scoped selector leaves the
  outer box untouched).
- A Step 4 type name is already exported as a different type of ours, or either `@ts-expect-error` is reported
  unused.
- `resolveElements('li', scope)` / `createScopedAnimate({ scope })` with `useAnimate()`'s scope needs a cast that
  Step 3.1's widening doesn't remove. Report the type error.
- A light re-export trips the tree-shaking Timeline marker (Step 6), or the component-layer check fails.
- Step 3.4 changes any `useAnimate` test result.

## Maintenance notes

- On the next Motion bump, triage every name the tripwire reports with this plan's rule. If motion.dev documents
  it, `framer-motion/src/dom.ts` hand-curates it, or it is a sibling of something we re-export, re-export it with
  JSDoc and docs. Otherwise allowlist it under `[b]`/`[c]`/`[d]`. A name that moves from `[d]` to exported must
  leave both `MOTION_EXPORTS_NOT_REEXPORTED` and `MOTION_EXPORTS_PENDING_SVELTE_ADAPTATION` in the same change;
  the tests enforce both.
- `createScopedAnimate` shares `SvelteMotionAnimate` with `animate` and `useAnimate`, so 009's "re-check the
  passthrough overloads against upstream's `animate`/`createScopedAnimate` signatures" note in `animateValue.ts`
  now covers a public export too.
- If upstream ever exports `ScopedAnimateOptions`, switch ours to a re-export and export it from `index.ts`.
- `animateMini` and a future `./mini` subpath would be two routes to the same function; when the subpath lands,
  keep both (upstream has both: `motion`'s `animateMini` and `motion/mini`'s `animate`).
- Plans merging after this one that re-export a `motion` runtime name (e.g. 010/011) must de-list it, as 009's
  note says.
