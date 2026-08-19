# Plan 001: Ship `arc()` curved motion paths (`transition.path`) with docs, demos, and tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/arc-motion-path/README.md`) — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 526f503..HEAD -- src/lib/index.ts src/lib/index.spec.ts src/lib/html/_MotionContainer.svelte src/lib/utils/motionDomProjection.ts package.json docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/lib/compare-data.ts docs/src/routes/docs/api-reference/+page.svx README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

> **Revision 2026-08-19 (guard, after executor round 1)**:
> 1. motion-dom's `MotionPath` **type** collides with this package's existing
>    `MotionPath` **component** export (`src/lib/index.ts` →
>    `export { default as MotionPath } from '$lib/html/Path.svelte'`). Export the
>    type under the alias **`MotionPathDefinition`** instead:
>    `export type { ArcOptions, MotionPath as MotionPathDefinition, PathInterpolator, PathState, Point2D } from 'motion-dom'`.
>    Do NOT add a separate `import type … as …` + `export type X = …` pair.
> 2. `docs/src/lib/demo-loaders.ts`, `docs/src/lib/demo-manifest.json`,
>    `docs/src/lib/sitemap-manifest.json` are **gitignored** (`docs/.gitignore:36-40`)
>    and regenerated on every docs dev/build. They will never appear in
>    `git status`; the "commit the regenerated files" instruction in Step 5 and
>    the related `git status` verify line are void. The `grep` checks on their
>    local contents still apply.
> 3. `pnpm` via corepack fails in the Codex sandbox (`@pnpm/exe` identity check);
>    `./node_modules/.bin/vitest` / `./node_modules/.bin/svelte-check` are the
>    equivalent direct invocations. The guard runs the real `pnpm` gates locally.
> Re-stamped: planned-at now `1ba2838` (plan commit); drift check unchanged.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (upstream parity feature)
- **Planned at**: commit `526f503`, 2026-08-19 (revised 2026-08-19 at `1ba2838`)

## Why this matters

Upstream Motion 13.x added `arc()` — a path factory you drop into
`transition.path` so an element travels a curved quadratic-bezier between its
old and new `x`/`y` (and, optionally, rotates to follow the tangent). It works
for keyframe animations, `layout`/`layoutId` FLIP animations, and the
imperative `animate()`. The direct Svelte rival `motion-sv` shipped it in
0.1.13; it is the one visibly demo-able capability they have and we don't
(`.competitive-intel/state.json` → `open_gaps[0]`).

The good news from recon: **the runtime already works.** Our installed
`motion-dom@13.0.0` ships `arc` and the full `transition.path` wiring
(`animateTarget` consumes `path`, `HTMLProjectionNode.setAnimationOrigin`
takes a `pathFn`, `buildTransform` composes the `pathRotation` channel onto
`rotate`). Because `_MotionContainer.svelte` routes `animate` through
motion-dom's `animationState.animateChanges()` and passes `transition` into
both the VisualElement props and the projection node options, a throwaway
probe at plan time (`render(MotionContainer, { initial:{x:0,y:0}, animate:{x:200},
transition:{ duration:1, path: arc({strength:1, rotate:true}) } })`) produced
mid-flight `latestValues` of `x≈113, y≈98, pathRotation≈-6.2` and an inline
`transform: translateX(112.8px) translateY(98.4px) rotate(-6.24deg)`, settling
exactly at `translateX(200px)`.

What's missing is everything a user can see: the `arc` export (it is NOT
exported from the `motion` package we re-export utilities from — only from
`motion-dom`), the types, a docs page, an example page, demo/test routes,
unit + e2e coverage, the compare-page rows, a changeset. This plan ships that
surface and pins the runtime behaviour with tests so a future motion-dom bump
can't silently break it.

## Current state

### Library

- `src/lib/index.ts` — public API barrel. Re-exports utilities from `motion`
  (lines 56–76) and types from `$lib/types`; it has **no** import from
  `motion-dom` today. `arc` must come from `motion-dom` (verified:
  `grep -c "\barc\b" node_modules/motion/dist/index.d.ts` → `0`;
  `node_modules/motion-dom/dist/es/index.mjs:10` →
  `export { arc } from './animation/utils/arc.mjs'`).

  ```ts
  // src/lib/index.ts:75-76
  // Re-export utility functions
  export { clamp, distance, distance2D, interpolate, mix, pipe, progress, wrap } from 'motion'
  ```

- `src/lib/index.spec.ts` — asserts the public surface (`describe('public API:
  index.ts')`, e.g. `it('re-exports utility functions', …)` at line 128).
  Add the `arc` assertion here.
- `src/lib/types.ts:246` — `export type MotionTransition = AnimationOptions | undefined`
  where `AnimationOptions` is motion's type, whose `ValueTransition` already
  declares `path?: MotionPath` (`node_modules/motion-dom/dist/index.d.ts:2240`).
  **No type change is needed** for `transition={{ path: arc() }}` to typecheck.
- `src/lib/html/_MotionContainer.svelte` — the motion element. Relevant facts
  (do not edit this file):
  - line 587 / 2016 / 2043: `transition: mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {})`
    is handed to the VisualElement props and to
    `motionDomProjection.updateOptions({ … transition … })`. `mergeTransitions`
    (`src/lib/utils/animation.ts:21`) is a plain spread, so `path` survives.
  - line 1774–1780: `runAnimateChanges` → `visualElement.animationState.animateChanges()`
    → motion-dom `animateTarget`, which reads `transition?.path`
    (`node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs:35-38`).
- `src/lib/utils/motionDomProjection.ts:221-253` — `updateOptions` calls
  `this.projection.setOptions({ …, transition: options.transition, … })`;
  upstream's layout handler reads `this.options.transition` and passes
  `getValueTransition(layoutTransition, 'layout').path` into
  `setAnimationOrigin(delta, hasOnlyRelativeTargetChanged, pathFn)`
  (`node_modules/motion-dom/dist/es/projection/node/create-projection-node.mjs:1056,1080`).
  So `transition.layout.path` AND top-level `transition.path` both apply to
  layout animations. **The arc is skipped when the layout shift is under 20px**
  (`MIN_LAYOUT_DISTANCE = 20` in upstream `arc.ts`) — tests must move ≥ 100px.
- `src/lib/utils/animate.svelte.ts` (`useAnimate`) and `src/lib/utils/animateValue.ts`
  (`animate`) wrap motion's `animate()`, whose DOM branch calls motion-dom
  `animateTarget(visualElement, { ...keyframes, transition }, {})`
  (`framer-motion/dist/es/animation/animate/subject.mjs:47`) — so
  `animate(el, { x: 200 }, { path: arc() })` is supported for free.

### Upstream reference (read-only, for fidelity)

`~/Github/motion` at tag `v13.1.0` (`adaf7a4e5`):

- `packages/motion-dom/src/animation/utils/arc.ts` — `ArcOptions`
  (`strength=0.5`, `peak=0.5`, `direction?: 'cw'|'ccw'`, `rotate?: boolean|number`),
  `createArcPath` (internal), `arc(options): MotionPath`.
- `packages/motion-dom/src/animation/utils/__tests__/arc.test.ts` — 15 pure
  geometry tests (endpoints, strength, peak, cw/ccw sign, auto-direction
  same-screen-side, rotate normalisation). These already run upstream; we do
  NOT re-port them (we consume the built package), we test OUR integration.
- Public docs: <https://motion.dev/docs/arc>. Key user-facing facts to carry into
  our docs verbatim-in-spirit:
  - `strength` — "A value of `1` peaks at a height equal to the distance between
    the two points, whereas `0` is no bend." Default `0.5`.
  - `peak` — "Where along the bend the arc reaches its maximum height. The
    default `0.5` produces a symmetric arc, whereas lower values bring the peak
    towards the start."
  - `direction` — `"cw"` / `"ccw"` locked relative to direction of travel;
    unset = automatic, keeps the bulge on a stable screen-space side.
  - `rotate` — `true` = full tangent following, `0–1` = scaled; **additive** to
    the element's own `rotate` (it rides a separate internal `pathRotation`
    channel, so a concurrent `rotate` animation is never clobbered).
  - Works with springs: `transition={{ type: 'spring', bounce: 0.5, path: arc({ strength: 1 }) }}`.
  - Layout: `<motion.div layout transition={{ layout: { duration: 0.6, path: arc({ strength: 0.6 }) } }} />`
    and `layoutId` shared transitions.
  - Caveat: "create a single `arc()` instance for all animations on the same
    component" — a fresh `arc()` has no memory for the auto-direction
    continuity flip. **In Svelte that means `const path = arc()` in `<script>`,
    not inline in the template attribute** (an inline `{{ path: arc() }}` is
    re-evaluated whenever any reactive dependency of that expression changes).

### Repo conventions the new files must follow

- **Feature checklist** (`CLAUDE.md` → "New feature checklist"): core API →
  1–3 test/demo pages under `src/routes/tests/<feature>/` → link them from
  `src/routes/+page.svelte` → docs page under `docs/src/routes/docs/<feature>/`
  → example page under `docs/src/routes/examples/<feature>/` + demo components
  under `docs/src/lib/examples/<feature>/demos/` → unit + e2e tests → Google-style
  JSDoc on exported symbols → format/check/package/tests.
- **Test routes** (exemplar `src/routes/tests/layout-dependency/+page.svelte`):
  `<script lang="ts">` importing from `'$lib'`, Svelte 5 runes (`$state`),
  controls and readouts carry `data-testid`. Playwright waits on
  `data-is-loaded="ready"` (the motion element sets it) — see
  `e2e/layout/layout-dependency.spec.ts:11-13`.
- **Homepage links** (`src/routes/+page.svelte`): `<li><a class="text-blue-300 hover:underline" href={resolve('/tests/<route>') + searchParams}>label</a></li>`
  inside an `<h2>` section ("Motion" section starts line 22, "Layout" at 641).
- **e2e** (exemplars `e2e/layout/layout-dependency.spec.ts`, helpers in
  `e2e/_helpers/transform.ts` → `readTransform(page, selector)` returns
  `{tx, ty, a, b, c, d}` from the computed `matrix(...)`). URL pattern:
  `'/tests/<route>?@isPlaywright=true'`. Poll with `expect.poll` / short
  `waitForTimeout(16)` sampling loops (see `sawFlipTransform`, lines 29-41).
- **Unit specs** live beside the file (`*.spec.ts`). Specs that need the real
  motion-dom frame loop must call `vi.useRealTimers()` in `beforeEach` and
  stub `requestAnimationFrame` onto `setTimeout(cb, 16)` — the vitest
  environment installs fake timers globally (note at the bottom of
  `vitest-setup-client.ts`). `src/lib/html/_MotionContainer.spec.ts` is the
  exemplar for rendering `MotionContainer` via `@testing-library/svelte` and
  reading `visualElementStore.get(el).latestValues`.
- **Docs page** (exemplar `docs/src/routes/docs/layout-dependency/+page.svx` +
  `+page.ts`): frontmatter `title`/`description`; `<script>` imports
  `Example` from `$lib/components/general/Example.svelte`, the demo from
  `$lib/examples/<feature>/demos/Default.svelte`, and sets SEO via
  `getSeoContext()` (`seo.title`, `description`, `ogTitle`, `ogTagline`,
  `ogFeatures`, `ogSlug = 'docs-<slug>'`). Demo embedded as
  `<Example isSmall exampleUrl="/examples/<slug>"><Demo /></Example>`.
- **Docs nav**: `docs/src/lib/docsNav.ts` — add an item `{ title, href, icon }`
  using a `@lucide/svelte` icon (line 59-64 shows the "Animation" group items;
  `Spline` is a suitable lucide icon for arc).
- **Example page** (exemplar `docs/src/routes/examples/layout-dependency/+page.svelte`
  — read it in full, ~200 lines): uses `ExampleV2`/`CodeReferenceV2`/
  `formatSheetLabel` from `@humanspeak/docs-kit`, `demoCodeSample` from
  `$lib/demo-loaders`, breadcrumbs + SEO contexts, a `sections: ExampleSection[]`
  array with `figId`, `tag`, `title {prefix, accent, end}`, `description`,
  `snippet`, `codeSnippet`, `notes`, `barCells`, `sourceUrl`. Plus a sibling
  `+page.ts` exporting `load: PageLoad = () => ({ title, description })`
  (exemplar `docs/src/routes/examples/reorder/+page.ts`) — the catalog
  (`docs/src/routes/examples/+page.ts`) is regenerated from these by
  `pnpm --filter docs examples-catalog:sync`.
- **Examples index**: `docs/src/lib/examplesIndex.ts` → `EXAMPLES` record:
  add `'arc': { title, description }`.
- **Generated docs files** — `docs/src/lib/demo-loaders.ts`,
  `docs/src/lib/demo-manifest.json`, `docs/src/lib/sitemap-manifest.json` are
  emitted by docs-kit vite plugins on dev-server boot / `vite build`. After
  adding demos, run a docs build once and COMMIT the regenerated files
  (otherwise `demoCodeSample('arc/demos/Default.svelte', …)` fails
  svelte-check with "not assignable to parameter of type …").
- **Docs consume `dist/`** (`docs/package.json:31` → `"@humanspeak/svelte-motion": "workspace:*"`,
  package `exports` point at `./dist/**`). After changing `src/lib/**`, run
  `pnpm build` at the repo root and `rm -rf docs/node_modules/.vite` before
  trusting a docs demo. The library's own `src/routes/tests/**` app imports
  `$lib` directly and needs no rebuild.
- **Compare pages**: `docs/src/lib/compare-data.ts` — `features: [{ name, us, them, note? }]`
  per competitor (`framer-motion`, `motion`, `gsap`).
- **Changesets**: `.changeset/<adjective-noun-thing>.md` with
  `'@humanspeak/svelte-motion': minor` frontmatter (exemplar
  `.changeset/tidy-bees-reorder.md`).
- **Lint/format authority is Trunk** (`.trunk/trunk.yaml`): use `trunk fmt`
  and `trunk check`, not `pnpm lint`/`prettier` directly.
- **README.md** — features list near line 60 (`motion.div`, …) and
  "Known gaps vs Framer Motion" at line 286. Add `arc()` to the feature list.

## Commands you will need

| Purpose                | Command                                                                 | Expected on success                        |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| Install                | `pnpm install`                                                          | exit 0                                     |
| Typecheck (lib)        | `pnpm check`                                                            | exit 0, `0 errors`                         |
| Unit tests (one file)  | `pnpm vitest run <path> --coverage.enabled=false`                       | all pass                                   |
| Unit tests (all)       | `pnpm test`                                                             | exit 0                                     |
| Build + package        | `pnpm build`                                                            | exit 0 (`svelte-package` + `publint` pass) |
| Format                 | `trunk fmt`                                                             | exit 0                                     |
| Lint                   | `trunk check`                                                           | exit 0, no new issues                      |
| e2e (targeted)         | `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts` | all pass                     |
| Docs typecheck         | `cd docs && pnpm check`                                                 | no NEW errors (6 pre-existing `optimized-appear` loader-type errors exist at plan time) |
| Docs build (regen)     | `cd docs && pnpm build`                                                 | exit 0; regenerates demo-loaders/manifests |
| Docs catalog sync      | `cd docs && pnpm examples-catalog:sync`                                 | `src/routes/examples/+page.ts` updated     |

**e2e port note**: Playwright's webServer builds and serves on port **4198**
(`playwright.config.ts:20-36`). If something is already listening on 4198 it
is the maintainer's live dev/sign-off server — **never kill it**. Run
`PW_REUSE_SERVER=1 pnpm playwright test …` against it instead (it serves
`src/` live, so new test routes are available without a rebuild).

## Scope

**In scope** (the only files you should create or modify):

- `src/lib/index.ts`, `src/lib/index.spec.ts`
- `src/lib/html/_MotionContainer.arc.spec.ts` (create)
- `src/routes/tests/arc/keyframes/+page.svelte` (create)
- `src/routes/tests/arc/layout/+page.svelte` (create)
- `src/routes/+page.svelte` (add two links only)
- `e2e/motion/arc-keyframes.spec.ts`, `e2e/layout/arc-layout.spec.ts` (create)
- `docs/src/routes/docs/arc/+page.svx`, `docs/src/routes/docs/arc/+page.ts` (create)
- `docs/src/routes/examples/arc/+page.svelte`, `docs/src/routes/examples/arc/+page.ts` (create)
- `docs/src/lib/examples/arc/demos/Default.svelte`, `Layout.svelte`, `Rotate.svelte` (create)
- `docs/src/lib/docsNav.ts`, `docs/src/lib/examplesIndex.ts`, `docs/src/lib/compare-data.ts`
- `docs/src/routes/docs/api-reference/+page.svx` (one bullet), `docs/src/routes/docs/layout-animations/+page.svx` (one cross-link paragraph)
- Generated docs files touched by the build/sync (gitignored, regenerate locally only): `docs/src/lib/demo-loaders.ts`, `docs/src/lib/demo-manifest.json`, `docs/src/lib/sitemap-manifest.json`; plus `docs/src/routes/examples/+page.ts` if the catalog sync rewrites it
- `README.md` (feature bullet), `.changeset/<new>.md` (create)
- `.agents/.plans/arc-motion-path/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/html/_MotionContainer.svelte`, `src/lib/utils/motionDomProjection.ts`,
  `src/lib/utils/visualElementCore.ts`, `src/lib/utils/animation.ts` — the
  runtime already routes `transition.path`; if a test shows it doesn't, that is
  a STOP condition, not a license to patch the container.
- `src/lib/types.ts` — `MotionTransition` already admits `path`; do not widen
  or duplicate motion-dom's types.
- `package.json` dependency versions — `motion-dom@^13.0.0` already ships `arc`.
  Do not bump.
- `.competitive-intel/**` — the nightly digest owns that state.
- Re-porting upstream's `arc.test.ts` geometry tests — we consume the built
  `motion-dom`; test our integration, not their math.
- Any `docs/src/lib/compare-data.ts` copy outside the three new feature rows.

## Steps

### Step 1: Export `arc` and its types from the public barrel

In `src/lib/index.ts`, directly after the "Re-export utility functions" block
(line 76), add:

```ts
// Curved motion paths for `transition.path` (upstream Motion 13 `arc()`).
// Lives in `motion-dom`, not `motion`, so it is re-exported from there.
export { arc } from 'motion-dom'
export type {
    ArcOptions,
    MotionPath as MotionPathDefinition, // `MotionPath` is already our motion.path component
    PathInterpolator,
    PathState,
    Point2D
} from 'motion-dom'
```

In `src/lib/index.spec.ts`, inside `describe('public API: index.ts')`, add
(model on the `re-exports utility functions` test at line 128):

```ts
it('re-exports arc() path factory from motion-dom', async () => {
    const mod = await import('$lib')
    expect(typeof mod.arc).toBe('function')
    const path = mod.arc({ strength: 1 })
    expect(typeof path.animateVisualElement).toBe('function')
    expect(typeof path.interpolateProjection).toBe('function')
})
```

(Check how the existing tests in that file obtain the module — if they use a
static `import * as api from '$lib'` at the top, follow that instead of the
dynamic import.)

**Verify**: `pnpm vitest run src/lib/index.spec.ts --coverage.enabled=false` → all pass, including the new test.
**Verify**: `pnpm check` → 0 errors.

### Step 2: Pin the keyframe integration with a unit spec (real frame loop)

Create `src/lib/html/_MotionContainer.arc.spec.ts`. This is a separate file
from `_MotionContainer.spec.ts` because that file mocks `animateMotionValue`
and uses fake timers; this one needs the real motion-dom loop.

```ts
import { render } from '@testing-library/svelte'
import { arc, visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MotionContainer from './_MotionContainer.svelte'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Sample a VisualElement's latestValues every `stepMs` for `count` steps.
 */
const sample = async (el: HTMLElement, count: number, stepMs: number) => {
    const ve = visualElementStore.get(el)!
    const out: Array<{ x: unknown; y: unknown; pathRotation: unknown; transform: string }> = []
    for (let i = 0; i < count; i++) {
        await sleep(stepMs)
        out.push({
            x: ve.latestValues.x,
            y: ve.latestValues.y,
            pathRotation: ve.latestValues.pathRotation,
            transform: el.style.transform
        })
    }
    return out
}

describe('_MotionContainer transition.path (arc)', () => {
    beforeEach(() => {
        // The shared vitest setup installs fake timers; motion-dom's frame
        // loop needs real ones (see vitest-setup-client.ts).
        vi.useRealTimers()
        ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
            setTimeout(() => cb(performance.now()), 16) as unknown as number
        ;(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id)
    })

    it('curves x/y along the arc and composes pathRotation onto transform', async () => {
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { x: 0, y: 0 },
                animate: { x: 200 },
                transition: { duration: 1, ease: 'linear', path: arc({ strength: 1, rotate: true }) }
            }
        })
        await sleep(100)
        const el = container.firstElementChild as HTMLElement
        const samples = await sample(el, 8, 120)

        // Mid-flight: x between the endpoints, y bulged well off the straight line.
        const mid = samples.find((s) => typeof s.x === 'number' && (s.x as number) > 60 && (s.x as number) < 140)
        expect(mid).toBeTruthy()
        expect(Math.abs(Number(mid!.y))).toBeGreaterThan(30)
        expect(mid!.transform).toMatch(/translateY\(/)
        expect(mid!.transform).toMatch(/rotate\(/)
        expect(typeof mid!.pathRotation).toBe('number')

        // Settles exactly; pathRotation is cleared.
        const last = samples.at(-1)!
        expect(last.x).toBe(200)
        expect(last.y).toBe(0)
        expect(last.transform).toBe('translateX(200px)')
    })

    it('rotate:false keeps transform free of rotate()', async () => {
        // Same setup, `arc({ strength: 1 })`; assert no sample's transform contains `rotate(`.
    })

    it('keeps a user rotate in the transform while pathRotation is additive', async () => {
        // initial { x:0, y:0, rotate: 45 }, animate { x: 200 }, arc rotate:true.
        // Mid-flight transform must contain TWO rotate() terms (user 45deg + path),
        // e.g. /rotate\(45deg\) rotate\(/ ; final transform === 'translateX(200px) rotate(45deg)'.
    })
})
```

Fill in the two sketched tests fully (they are variations of the first).
If the second rotate term appears in a different order than the regex expects,
inspect the actual string and adjust the regex — the ORDER is upstream's
(`buildTransform` appends `pathRotation` after all `transformPropOrder` keys),
the requirement is that BOTH terms are present and the final string carries
only the user's `rotate(45deg)`.

**Verify**: `pnpm vitest run src/lib/html/_MotionContainer.arc.spec.ts --coverage.enabled=false` → 3 tests pass.

### Step 3: Add the test/demo routes and homepage links

Create `src/routes/tests/arc/keyframes/+page.svelte`:

- Imports `{ arc, motion }` from `'$lib'`.
- State: `let toggled = $state(false)`, `let strength = $state(1)`,
  `let direction = $state<'cw' | 'ccw' | undefined>(undefined)`,
  `let rotate = $state(false)`.
- A `$derived` transition: `{ duration: 1, ease: 'linear', path: arc({ strength, direction, rotate }) }`
  — build the `arc()` once per option change (NOT per render) by deriving it
  from the option state; add a code comment explaining why (`arc()` keeps
  continuity state).
- A 300×300 stage (`position: relative`) with a 48×48 `motion.div`
  `data-testid="arc-box"` at top-left, `animate={{ x: toggled ? 200 : 0, y: 0 }}`,
  `transition={transition}`.
- Controls with testids: `toggle` (flips `toggled`), `strength-1`/`strength-0`
  (sets strength), `dir-auto`/`dir-cw`/`dir-ccw`, `rotate-on`/`rotate-off`.
- A readout `data-testid="readout"` showing the current option values.

Create `src/routes/tests/arc/layout/+page.svelte`:

- Imports `{ arc, motion }` from `'$lib'`.
- `let right = $state(false)`; a 400px-wide flex row that toggles
  `justify-content` between `flex-start` and `flex-end`, containing one
  `motion.div layout` 48×48 `data-testid="layout-box"` with
  `transition={{ layout: { duration: 1, ease: 'linear', path } }}` where
  `const path = arc({ strength: 1 })` is created once in `<script>`.
- A second row demonstrating **shared layout** (`layoutId`): two slots
  (`left`/`right`) and a `motion.div layoutId="shared-arc"` rendered in
  whichever slot `right` selects (`{#if right}…{:else}…{/if}`), same transition
  shape, testid `shared-box`.
- Controls: `toggle` (flips `right`).

In `src/routes/+page.svelte`, add two `<li>` links following the existing
markup: `resolve('/tests/arc/keyframes')` labelled `arc() — transition.path
keyframes` in the **Motion** section (after the `transformTemplate` links,
around line 100–120), and `resolve('/tests/arc/layout')` labelled `arc() —
layout / layoutId path` in the **Layout** section (after the
`layout-dependency` link at ~line 155).

**Verify**: `pnpm check` → 0 errors. Then start the dev server if one is not
already on 4198 (`pnpm dev --port 4198`; if 4198 is busy, use the running one)
and open `http://localhost:4198/tests/arc/keyframes` — clicking `toggle` must
visibly curve the box; `http://localhost:4198/tests/arc/layout` — toggling must
visibly curve both boxes.

### Step 4: e2e coverage for keyframes and layout

Create `e2e/motion/arc-keyframes.spec.ts` (model on
`e2e/layout/layout-dependency.spec.ts`; use `readTransform` from
`e2e/_helpers/transform.ts`):

```ts
const URL = '/tests/arc/keyframes?@isPlaywright=true'
const BOX = '[data-testid="arc-box"]'

/** Sample the computed matrix every ~16ms for `ms` and return all samples. */
const sampleTransform = async (page, ms) => { /* loop readTransform(page, BOX) */ }

test('arc bulges off the straight line and settles exactly', …)
  // goto, wait data-is-loaded=ready on arc-box, click strength-1, click toggle,
  // samples = sampleTransform(page, 1100)
  // expect(samples.some(s => s.tx > 60 && s.tx < 140 && Math.abs(s.ty) > 30)).toBe(true)
  // expect.poll(() => readTransform(page, BOX)).toMatchObject({ tx: 200, ty: 0 }) (use toBeCloseTo on tx/ty)

test('direction cw and ccw bulge to opposite sides', …)
  // run the toggle once with dir-cw, record sign of ty at mid-flight; reset (toggle back, wait settle),
  // set dir-ccw, toggle, record sign; expect signs opposite.

test('rotate:true rotates mid-flight, rotate:false does not', …)
  // matrix `b` (or `c`) component is non-zero at mid-flight when rotate-on; stays 0 with rotate-off.
  // Settled: b === 0 in both cases.
```

Create `e2e/layout/arc-layout.spec.ts`:

```ts
const URL = '/tests/arc/layout?@isPlaywright=true'

test('layout FLIP follows the arc (ty deviates on a horizontal move)', …)
  // wait ready on layout-box; click toggle; sample computed matrix for ~1100ms;
  // a straight horizontal FLIP keeps |ty| ≈ 0 the whole way; with arc expect
  // some sample with |tx| between 60 and 300 AND |ty| > 30.
  // Settled: transform is identity/none (projection removes the transform) — assert ty≈0 and tx≈0 via expect.poll.

test('layoutId shared transition follows the arc', …)
  // same assertion shape on shared-box.
```

**Verify**: `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts`
(prefix with `PW_REUSE_SERVER=1` if 4198 is already serving) → all tests pass.

### Step 5: Docs page, example page, demos, nav, index

1. `docs/src/lib/examples/arc/demos/Default.svelte` — keyframe demo: a box that
   hops between two positions on click, with three small buttons for
   `strength` 0.25 / 0.5 / 1 and a `direction` auto/cw/ccw toggle. Use the
   design tokens other demos use (e.g. `var(--brut-ink)`, `var(--brut-accent)`
   as in `docs/src/lib/examples/motion-path/demos/Default.svelte`). Import
   `{ arc, motion }` from `'@humanspeak/svelte-motion'`. Create the `arc()`
   once per option set via `$derived`, with a comment on why.
2. `docs/src/lib/examples/arc/demos/Rotate.svelte` — same hop with
   `rotate: true`; render an arrow/chevron glyph so the tangent-following is
   visible.
3. `docs/src/lib/examples/arc/demos/Layout.svelte` — a `layoutId` "bubble"
   that jumps between two slots with `transition={{ layout: { path } }}`
   (mirror the motion.dev shared-element example).
4. `docs/src/routes/docs/arc/+page.ts` — `load` returning
   `{ title: 'arc()', description: 'Curved motion paths for x/y animations — keyframes, layout, and animate().' }`.
5. `docs/src/routes/docs/arc/+page.svx` — model on
   `docs/src/routes/docs/layout-dependency/+page.svx`. Sections:
   - Intro + basic usage block (`transition={{ duration: 1, path: arc() }}`),
     then `<Example isSmall exampleUrl="/examples/arc"><Default /></Example>`.
   - **Options** table: `strength`, `peak`, `direction`, `rotate` (copy the
     semantics listed under "Upstream reference" above; defaults `0.5`, `0.5`,
     auto, `false`).
   - **Layout animations**: `transition={{ layout: { duration: 0.6, path: arc({ strength: 0.6 }) } }}`
     and `layoutId`. Note the 20px minimum layout distance.
   - **Springs**: `transition={{ type: 'spring', bounce: 0.5, path: arc({ strength: 1 }) }}`.
   - **Imperative**: `animate(el, { x: 200, y: 100 }, { duration: 1, path: arc() })` and `useAnimate`.
   - **Rotation**: `rotate: true` / number; additive to the element's own `rotate`.
   - **Reuse the instance**: create `const path = arc()` in `<script>` (not
     inline in the template) so auto-direction continuity survives re-renders.
   - SEO block: `seo.ogSlug = 'docs-arc'`, `ogFeatures = ['arc', 'Curved Paths', 'Layout Animations', 'Motion Parity']`.
6. `docs/src/routes/examples/arc/+page.ts` — `load` returning `{ title: 'arc()', description: … }`.
7. `docs/src/routes/examples/arc/+page.svelte` — model on the
   `layout-dependency` example page: three `sections` (FIG-001 keyframes,
   FIG-002 rotate, FIG-003 layoutId), each with `snippet`, `notes` (3 bullets
   with lucide icons), `codeSnippet` via
   `demoCodeSample('arc/demos/<File>.svelte', 'arc-<kebab>', '<File>.svelte')`,
   `barCells` (`api: arc()`, `input: transition.path` / `transition.layout.path`, `mode: live`),
   `sourceUrl` under `docs/src/lib/examples/arc/demos/…`. Breadcrumbs
   `Examples → arc()`. `seo.ogSlug = 'examples-arc'`.
8. `docs/src/lib/docsNav.ts` — add `{ title: 'arc()', href: '/docs/arc', icon: Spline }`
   to the group that contains `Layout Animations` (import `Spline` from
   `@lucide/svelte` alongside the existing icon imports).
9. `docs/src/lib/examplesIndex.ts` — add
   `'arc': { title: 'arc()', description: 'Curved motion paths with transition.path — keyframes, rotation, and shared layout.' }`
   (keep the record alphabetised if it is).
10. `docs/src/routes/docs/api-reference/+page.svx` — under "Re-exports from
    `motion`" add a short subsection **Motion paths** with
    `import { arc } from '@humanspeak/svelte-motion'` and one sentence linking
    to `/docs/arc`. (It is re-exported from `motion-dom`; say "from Motion".)
11. `docs/src/routes/docs/layout-animations/+page.svx` — after the paragraph
    at line ~85 ("The animation uses the element's `transition` prop…"), add
    one paragraph: layout animations can travel a curve — see [`arc()`](/docs/arc).
12. Rebuild the library so docs see the export, regenerate the (gitignored) docs
    loader/manifest files locally, and sync the catalog:
    `pnpm build && rm -rf docs/node_modules/.vite && (cd docs && pnpm examples-catalog:sync && pnpm build)`.

**Verify**: `cd docs && pnpm check` → no errors mentioning `arc` (the 6
pre-existing `optimized-appear` errors may remain — if the regenerated
`demo-loaders.ts` now also includes the `optimized-appear/demos/*` entries,
those errors disappear; either outcome is fine).
**Verify**: `grep -c "arc/demos" docs/src/lib/demo-loaders.ts` ≥ 3 and `grep -c "/docs/arc\|/examples/arc" docs/src/lib/sitemap-manifest.json` ≥ 2 (these files are gitignored and regenerated on build — they will not show in `git status`).
**Verify** (visual): `cd docs && pnpm dev` (any free port), open `/docs/arc`
and `/examples/arc` — all three demos curve; no console errors.

### Step 6: Compare-page rows, README, changeset

- `docs/src/lib/compare-data.ts` — add one feature row to each competitor's
  `features` array, placed right after the `Spring physics` row:
  - framer-motion: `{ name: 'Curved motion paths (transition.path / arc())', us: true, them: true }`
  - motion: `{ name: 'Curved motion paths (transition.path / arc())', us: true, them: true }`
  - gsap: `{ name: 'Curved motion paths', us: 'arc() on transition.path', them: 'MotionPathPlugin (any SVG path)' }`
- `README.md` — in the feature bullet list around line 60, add
  ``- `arc()` curved motion paths via `transition.path` (keyframes, layout, `animate()`)``.
- `.changeset/curved-arc-paths.md`:

  ```md
  ---
  '@humanspeak/svelte-motion': minor
  ---

  Export `arc()` (and the `ArcOptions` / `MotionPath` types) so `transition={{ path: arc() }}` curves `x`/`y` keyframe animations, `layout`/`layoutId` transitions, and `animate()` calls along a quadratic arc with optional tangent-following rotation — Motion 13 parity.
  ```

**Verify**: `trunk fmt` then `trunk check` → exit 0.

### Step 7: Full gate

Run, in order:

1. `pnpm check` → 0 errors
2. `pnpm test` → exit 0 (all unit tests pass, including the 1 + 3 new ones)
3. `pnpm build` → exit 0 (svelte-package + publint clean)
4. `trunk check` → exit 0
5. `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts` → pass
   (with `PW_REUSE_SERVER=1` if 4198 is occupied — never kill it)
6. `git status --short` → only in-scope files changed

Update the status row in `.agents/.plans/arc-motion-path/README.md`.

## Test plan

- **Red-first exemption**: this is a net-new public surface (the export,
  docs, demos). There is no existing wrong behaviour to pin first. The
  runtime integration was probed green at plan time; Step 2 / Step 4 turn that
  probe into permanent regression coverage.
- New unit tests:
  - `src/lib/index.spec.ts` — `arc` is exported and returns a `MotionPath`.
  - `src/lib/html/_MotionContainer.arc.spec.ts` — (1) x/y bulge + `pathRotation`
    composed + exact settle; (2) `rotate:false` → no `rotate(`; (3) user
    `rotate` preserved and additive.
- New e2e:
  - `e2e/motion/arc-keyframes.spec.ts` — bulge + settle; cw vs ccw opposite
    sign; rotate on/off.
  - `e2e/layout/arc-layout.spec.ts` — `layout` FLIP curves; `layoutId` shared
    transition curves.
- Pattern exemplars: `src/lib/html/_MotionContainer.spec.ts`,
  `e2e/layout/layout-dependency.spec.ts`, `e2e/_helpers/transform.ts`.
- Verification: `pnpm test` → all pass incl. 4 new; targeted playwright → 5 pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "export { arc } from 'motion-dom'" src/lib/index.ts` → 1 match
- [ ] `pnpm check` exits 0
- [ ] `pnpm test` exits 0; `src/lib/html/_MotionContainer.arc.spec.ts` exists with 3 passing tests; `src/lib/index.spec.ts` has the `arc` test
- [ ] `pnpm build` exits 0 and `grep -c "arc" dist/index.js` ≥ 1
- [ ] `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts` exits 0
- [ ] `trunk check` exits 0
- [ ] `ls docs/src/routes/docs/arc/+page.svx docs/src/routes/examples/arc/+page.svelte docs/src/lib/examples/arc/demos/Default.svelte docs/src/lib/examples/arc/demos/Rotate.svelte docs/src/lib/examples/arc/demos/Layout.svelte` → all exist
- [ ] `grep -c "/docs/arc" docs/src/lib/docsNav.ts` ≥ 1; `grep -c "'arc'" docs/src/lib/examplesIndex.ts` ≥ 1
- [ ] `grep -c "arc/demos" docs/src/lib/demo-loaders.ts` ≥ 3
- [ ] `grep -c "Curved motion paths" docs/src/lib/compare-data.ts` = 3
- [ ] `ls .changeset/*.md | grep -v config` shows the new changeset
- [ ] `src/routes/+page.svelte` links to `/tests/arc/keyframes` and `/tests/arc/layout`
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `.agents/.plans/arc-motion-path/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows changes in `src/lib/html/_MotionContainer.svelte` or
  `src/lib/utils/motionDomProjection.ts` that alter how `transition` reaches
  the VisualElement props / `projection.setOptions` (Current state lines
  587/2016/2043 and 221–253).
- Step 2's first test fails because `latestValues.y` never leaves `0` or
  `pathRotation` never appears — that means the container is NOT routing
  `transition.path` the way the plan-time probe showed. Report the sample
  output; do not patch the container.
- Step 4's layout spec shows `|ty|` never exceeding ~5px during the FLIP even
  though the box moves ≥ 200px horizontally — the projection adapter is not
  forwarding `path` to `setAnimationOrigin`. Report; do not patch
  `motionDomProjection.ts`.
- `node_modules/motion-dom/package.json` reports a version other than
  `13.0.x` or `13.1.x`, or `grep -c "export { arc }" node_modules/motion-dom/dist/es/index.mjs` → 0.
- `cd docs && pnpm build` fails for a reason unrelated to the new files
  (e.g. network fetch in `fetch-github-stats.ts`); report the error rather
  than editing build scripts.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `arc` is consumed from `motion-dom`, not `motion`. If the `motion` package
  ever starts exporting `arc` from its root, the re-export can move for
  consistency with the other utilities — but it is not required.
- A future bump of `motion-dom` that changes `MotionPath`'s shape or the
  `pathRotation` composition will surface first in
  `_MotionContainer.arc.spec.ts` (exact final `transform` string assertion) —
  that assertion is deliberately strict.
- The docs demos are built against `dist/`; reviewers checking the docs
  visually must `pnpm build` first (see "Docs consume dist").
- Deferred / not in this plan: (a) `README.md` "Known gaps vs Framer Motion"
  section is stale (viewport options and `MotionConfig reducedMotion` are now
  implemented per `.competitive-intel/state.json` → `closed_gaps`) — a separate
  one-line docs fix; (b) `MotionConfig skipAnimations` prop (open gap #2 in the
  intel state) — separate plan; (c) moving `arc()` from `open_gaps` to
  `closed_gaps` in `.competitive-intel/state.json` — the nightly digest does
  this from the code evidence.
- Reviewer focus: the e2e sampling loops are timing-based; if they flake on CI,
  widen the sampling window before loosening the geometric thresholds.
