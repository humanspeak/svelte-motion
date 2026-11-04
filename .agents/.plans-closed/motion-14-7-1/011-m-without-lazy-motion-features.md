# Plan 011 (SPIKE): Find how an `m` without loaded LazyMotion features can render like upstream (no VisualElement until features arrive): red tests, two bounded prototypes, report

> **This is a spike.** The deliverables are (1) committed red tests (`test.fail()`) on the lane and (2) a written
> report recommending one option, with the build plan's exact touch list, backed by throwaway prototypes on a spike
> branch. You do **not** ship the behaviour change. Reason: in `_MotionContainer.svelte` the VisualElement, the
> projection adapter and the parent contexts children read are all created once at component init, and the
> adapter makes its own VisualElement when none is passed. "No VisualElement until features load" touches all
> three, and only an experiment shows how wide that is.
>
> **Executor instructions**: Follow the steps in order and run every verification. If anything in "STOP
> conditions" occurs, stop and report. Report back to the dispatcher; do not edit the batch README.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4220** (same lane as 010). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Requires plan 010 (same lane).** Before starting, `git merge --no-ff feat/motion-14.7.1` into the lane and run
> `pnpm install --frozen-lockfile`. Confirm `grep -n "motionKindProp === 'm'" src/lib/html/_MotionContainer.svelte`
> and `grep -n '"./m"' package.json` each print a line; otherwise STOP.
>
> **Drift check (run first)**: line numbers below are at `f8ac71aa`; plans 004, 006, 007, 008 and 010 shift them.
> Find every excerpt by content. If one is gone, STOP.

## Status

- **Priority**: P2
- **Effort**: M (spike: red tests, two prototypes time-boxed to about one working session each, report)
- **Risk**: LOW for the lane (only tests and the report are committed). HIGH for the eventual build plan.
- **Depends on**: 010 (needs the `motion` / `m` kind, `motionKindProp`, the `./m` entry and the consumer SSR
  harness 010 adds; same lane)
- **Wave**: 3 (lane `lazy`, after 010)
- **Category**: direction (upstream parity, spike)
- **Planned at**: commit `f8ac71aa` (`main` after the 14.6.0 release, v2.5.0, Motion 14.6.0), 2026-10-27

## Why this matters

Upstream, an `m` component gets its renderer and features only from `<LazyMotion>`. With no `LazyMotion` above
it, or while an async bundle is loading, it has no VisualElement: it renders its element with `style`, `initial`
and the prop-derived attributes, and does nothing else. When the bundle loads, the VisualElement is created and
the element animates in from `initial`. After plan 010, svelte-motion gives an `m` outside LazyMotion every
feature (`lazyMotion?.getFeatures() ?? domMax`) and gives a pending async `m` `domMin`. The maintainer's rule is to
adopt upstream. A first build-plan draft was rejected on review because a featureless `m` would still get a
VisualElement from the projection adapter, and late parents would never reach children. This spike finds a
mechanism that works and sizes it.

## Current state

### Upstream (verified at `~/Github/motion`, `git show v14.7.1:<path>`)

- `packages/framer-motion/src/render/components/m/create.ts` — `createMinimalMotionComponent` calls
  `createMotionComponent(Component, options)` with no features and no `createVisualElement`.
  `context/LazyContext.ts` defaults to `{ strict: false }` (no `renderer`). `components/LazyMotion/index.tsx`
  sets the renderer during render for a sync bundle, and only after `features().then(...)` for an async one.
- `packages/framer-motion/src/motion/utils/use-visual-element.ts`: `createVisualElement = createVisualElement ||
  lazyContext.renderer`; `if (!visualElementRef.current && createVisualElement) { …create…; if
  (hasMountedOnce.current) visualElementRef.current.manuallyAnimateOnMount = true }` ("If the component has already
  mounted before features loaded (e.g. via LazyMotion with async feature loading), we need to force the initial
  animation to run."). Projection, `update`, `updateFeatures`, `animateChanges` and `window.MotionIsMounted = true`
  are all skipped while there is no VisualElement.
- What it renders: `motion/index.tsx:171-191` always calls `useRender(...)` with `visualState` from
  `use-visual-state.ts` `makeLatestValues` (seeded from `initial`, or from `animate` when the initial animation is
  blocked). `render/html/use-props.ts:30-83` builds DOM props from props alone: the user `style` plus those values;
  for `drag` (with `dragListener !== false`) `draggable={false}`, `user-select`/`-webkit-user-select`/
  `-webkit-touch-callout: none` and `touch-action`; for `onTap`/`onTapStart`/`whileTap` without `tabIndex`,
  `tabIndex={0}`. So a featureless `m` does apply `style` and `initial`, and keeps those attributes.
- SSR: no component has a VisualElement on the server (`index.tsx:136`, `typeof window !== "undefined"`), so the
  server markup of a featureless `m`, a featured `m` and a `motion` with the same props is identical.
- Parent context: `useVisualElement` reads `useContext(MotionContext).visualElement` on every render, so a child
  sees a parent's VisualElement as soon as the parent creates it.

### svelte-motion (after plan 010)

- `_MotionContainer.svelte`, features block (plan 010):
  `const activeFeatures = $derived(motionKindProp === 'm' ? (lazyMotion?.getFeatures() ?? domMax) : domMax)`.
- The VisualElement is a `const` created once at init, client-only (about lines 1108-1160:
  `const visualElement = typeof window !== 'undefined' ? untrack(() => createMotionVisualElement({ props:
  buildMotionNodeProps(false), parent: visualElementParent, seedLatestValues: true, presenceContext:
  buildPresenceContext(), … })) : null`). `visualElementParent` is read once:
  `const visualElementParent = typeof window !== 'undefined' ? getVisualElementParent() : undefined` (about 1116).
- Then, once, at init (about 1168-1183): `if (visualElement) { visualElementForRelatives = visualElement; …
  visualElement.blockInitialAnimation = …; setVisualElementParent(visualElement) }`. `visualElementForRelatives`
  is a `let` declared about line 407 and read by relative-value resolution about line 455.
- The projection adapter is a `const` built at init (about 1192-1206):
  ```ts
      const motionDomProjectionParent = typeof window !== 'undefined' ? getMotionDomProjectionParent() : null
      const motionDomProjection = typeof window !== 'undefined'
          ? new MotionDomProjectionAdapter({ parent: motionDomProjectionParent, getBaseTransform: () => userBaseTransform,
                visualElement: visualElement ?? undefined, group: layoutGroupContext?.group })
          : null
      if (motionDomProjection) { setMotionDomProjectionParent(motionDomProjection) }
  ```
  `src/lib/utils/motionDomProjection.ts`: `readonly visualElement` / `readonly projection` (lines 307-308);
  `this.ownsVisualElement = !options.visualElement` and, when none is passed, `new HTMLVisualElement(…)` (lines
  346-363); `mount()` calls `this.visualElement.mount(element)` if not already mounted (about line 436). The
  adapter's mount effect in `_MotionContainer.svelte` (about line 1903, `if (!motionDomProjection) return; if
  (!element) return; … motionDomProjection.updateOptions(…)` then mount) is not gated on features. So today, with
  `visualElement` null, a client `m` would still get an adapter-owned VisualElement registered in
  `visualElementStore`.
- `_MotionContainer.svelte` references `visualElement` 49 times and `motionDomProjection` 49 times
  (`grep -cw visualElement`, `grep -c motionDomProjection`), and `animationState` 38 times.
- The context setters/getters (`src/lib/components/visualElementTree.context.ts:22-37`,
  `src/lib/components/motionDomProjection.context.ts:11-20`) store a value, not a getter, so a parent that creates
  its node late can't reach children that already read it.
- A no-VisualElement render path already exists for SSR: `renderedInlineStyle`'s
  `visualElement ? … : mergeInlineStyles(inlineStyleBaseWithHolds, makeLatestValues(…), …)` (about line 1525) and
  the style MotionValue fallback effect (about line 932, `if (!element || visualElement) return`).
- Render-time attributes are feature-gated here but prop-derived upstream: `upstreamDragDefaultStyle` gated on
  `hasDragFeatures` (about line 1443) and the `tabindex` entry of `derivedAttrs` gated on `hasGestureFeatures`
  (about line 1588). Existing tests use `tabindex` as a proxy for "gesture features loaded"
  (`LazyMotion.spec.ts`, `e2e/lazy-motion/basic.spec.ts`, plan 010's `motion components keep every feature …`).
- `LazyMotion.svelte` serves `domMin` while an async loader is pending; `getIsLoaded()` is `false` until it
  resolves. `LazyMotionContext.getFeatures` returns `FeatureBundle` (`lazyMotion.context.ts:9`), so "no bundle"
  needs a type change there, not just JSDoc.
- Unit tests run in jsdom with `resolve.conditions: ['browser']` (`vitest.config.ts`), so `svelte/server` can't be
  used in vitest here. SSR checks go in `tests/consumer-vite6` (`verify.mjs` `renderWithVite`; plan 010 Step 5.3
  adds `KindSsr.svelte` there — extend that).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| Typecheck | `pnpm check` | 0 errors |
| E2E | `PW_PORT=4220 pnpm exec playwright test <paths>` | as stated per step |
| Consumer SSR | `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | exit 0 |
| Lint committed files | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**Committed on the lane** (`lane/1471-lazy`):

- `src/lib/components/__tests__/FeaturelessMProbe.svelte` (create)
- `src/lib/components/featurelessM.spec.ts` (create)
- `src/routes/tests/lazy-motion/featureless-m/+page.svelte` (create), linked from `src/routes/+page.svelte`
- `e2e/lazy-motion/featureless-m.spec.ts` (create)
- `tests/consumer-vite6/src/FeaturelessSsr.svelte`, `src/render-featureless-ssr.js` (create), `verify.mjs` (one assertion block)
- `.agents/.plans/motion-14-7-1/011-spike-report.md` (create)

**Prototypes only** (spike branch `spike/1471-featureless-m`, never merged): anything in `src/lib`.

## Git workflow

- On `lane/1471-lazy`: commit the red tests (`test(lazy-motion): featureless m without LazyMotion features (spike 011)`)
  and the report (`docs(plans): spike 011 report`).
- Create `spike/1471-featureless-m` from the red-tests commit for both prototypes; commit them there (one commit
  per prototype); the report links them.
- End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do NOT push or open a PR.

## Steps

### Step 1: Red tests

1. `FeaturelessMProbe.svelte`: props `wrap: 'none' | 'sync' | 'async'`, `loader?`, `withChild = false`. Renders
   (bare, in `<LazyMotion features={domMax}>`, or in `<LazyMotion features={loader}>`) `<m.div data-testid="box"
   style="width: 10px" initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.9 }} drag="x"
   variants={{ on: { opacity: 1 } }}>`, and when `withChild`, an inner `<m.div data-testid="child"
   variants={{ on: { x: 10 } }} />` (variant inheritance through a late parent).
2. `featurelessM.spec.ts` (mocks/timers as in `LazyMotion.spec.ts`; `visualElementStore` from `motion-dom`):
   - `an m outside LazyMotion has no VisualElement` — `wrap: 'none'`: `visualElementStore.get(box)` undefined; style
     has `width: 10px` and `opacity: 0`, still `0` after flushing.
   - `an m outside LazyMotion keeps the prop-derived attributes` — `tabindex="0"`, `draggable="false"`,
     `touch-action: pan-y`, `user-select: none` (guard today, because the m still has `domMax`).
   - `an m waiting on an async bundle has no VisualElement, then animates from initial` — before resolving: no
     VisualElement, opacity `0`; after resolving `domMax`: a VisualElement exists, and the `animate` call starts
     from opacity `0`.
   - `a late parent reaches its children` — `wrap: 'async'`, `withChild`: after resolving, the child's
     VisualElement's `parent` is the box's VisualElement.
   - Guard: `wrap: 'sync'` → a VisualElement exists immediately.
3. Consumer SSR: `tests/consumer-vite6/src/FeaturelessSsr.svelte` renders the Step 1.1 element three ways, each in
   a `data-kind` wrapper: bare `m.div`, `m.div` in `<LazyMotion features={domMax}>`, `motion.div`. In `verify.mjs`
   assert the three inner HTMLs are equal after stripping `<!--…-->` comments (guard — upstream's SSR property).
4. Page `src/routes/tests/lazy-motion/featureless-m/+page.svelte`: three cards (bare `m.div`; `m.div` in an async
   `LazyMotion` loaded by a `data-testid="load"` button; control `m.div` in `<LazyMotion features={domAnimation}>`),
   each `initial={{ opacity: 0.4, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.15 }}`,
   with a guided `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`; hidden under
   `?@isPlaywright=true`; pattern `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`) and live opacity
   verdicts. Link it from the LazyMotion list in `src/routes/+page.svelte`.
5. `e2e/lazy-motion/featureless-m.spec.ts`: card 1 keeps opacity `0.4` for 1 s and doesn't scale on hover; card 2
   likewise until `load`, then reaches `1` and scales; the control reaches `1` and scales.

**Verify**: `pnpm exec vitest run src/lib/components/featurelessM.spec.ts` and
`PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion/featureless-m.spec.ts`, then the consumer SSR command.
Record a table: case, result, failing assertion. Expected: the no-VisualElement, async and late-parent unit cases
and e2e cards 1-2 fail; the attributes case, sync guard, control card and SSR equality pass. If a guard fails, or
the "no VisualElement" case passes, STOP. Mark the failing cases `test.fail()` (vitest `it.fails`, Playwright
`test.fail()`), re-run (all green), commit on the lane.

### Step 2: Audit (no code)

On the lane, list every reference to `visualElement`, `motionDomProjection`, `animationState`,
`visualElementForRelatives`, `getVisualElementParent`, `setVisualElementParent`, `getMotionDomProjectionParent`
and `setMotionDomProjectionParent` in `_MotionContainer.svelte`, plus every consumer of those contexts elsewhere
in `src/lib` (`grep -rn` them). Classify each: (a) inside a `$effect` / `$derived` that would re-run when a
reactive value changes; (b) inside `untrack` or a closure created once at init; (c) an init-time statement; (d) a
TypeScript narrowing that a `let` / `$state.raw` would lose inside closures. This table goes in the report.

### Step 3: Prototype A — upstream model: no VisualElement and no adapter until features load

On the spike branch. Time box: one working session.

1. `featureless = motionKindProp === 'm' && !(lazyMotion?.getIsLoaded())`; `LazyMotion` publishes no bundle while
   pending (type change in `lazyMotion.context.ts` as needed).
2. Make the VisualElement and the projection adapter late: create both when `featureless` first turns false
   (or at init when it starts false), set `manuallyAnimateOnMount = true` when created after mount. Try, in order:
   (A1) a holder object created at init whose `current` VisualElement / adapter is filled in later, read through
   getters; (A2) create the adapter without a VisualElement but without letting it build its own
   (an option such as `deferVisualElement`), and hand it one later (`attachVisualElement(ve)`), which needs
   `visualElement` / `projection` to stop being `readonly` in `motionDomProjection.ts`.
3. Make the parent contexts getter-backed so late parents propagate: `setVisualElementParent(() => current)` /
   `setMotionDomProjectionParent(() => current)` and children resolve the getter when they create their own node.
   Same for `visualElementForRelatives`.
4. Gate the adapter mount effect and every (b)/(c)/(d) site from Step 2 on the node existing.
5. Prop-derived attributes: drop `hasDragFeatures &&` / `hasGestureFeatures &&` from the drag style and `tabindex`
   (upstream `use-props.ts`); note which existing tests then need behavioural rewrites (don't rewrite them on the
   spike beyond what's needed to read results).

Run Step 1's suites without `test.fail()` (locally on the spike branch), plus `pnpm test:only`,
`PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion e2e/layout e2e/layout-id e2e/animate-presence e2e/variants`
(and the SSR check). Record: which red cases turn green, regressions, site count actually touched, and whether A1
or A2 was used.

### Step 4: Prototype B — keep the VisualElement and adapter, suppress features

On a second commit from the red-tests commit. Time box: one working session.

Keep creating the VisualElement and adapter at init; while `featureless`: don't call `updateFeatures()`, don't run
the mount/enter animation lifecycle, don't render from `latestValues` (use the `makeLatestValues` SSR branch of
`renderedInlineStyle`), and don't let the adapter mount or write styles; when features arrive, call
`updateFeatures()` and run the first-mount lifecycle with `manuallyAnimateOnMount = true`. Measure the same suites
as Step 3, and list exactly where B diverges from upstream (at minimum: `visualElementStore.get(el)` is defined
while featureless; `MotionIsMounted`; motion values bound to a node; anything a user can observe through
`useMotionValue`, refs or `visualElementStore`). Red case "an m … has no VisualElement" stays red under B by
construction; say so.

### Step 5: Report

Write `.agents/.plans/motion-14-7-1/011-spike-report.md`:

1. The Step 1 table, then the same table after A and after B, citing spike-branch commits.
2. The Step 2 audit table and the sites each prototype actually changed.
3. Answers: (1) can the adapter be created late, or created VisualElement-less and handed one later (A1 vs A2,
   with the evidence); (2) how parent contexts became getter-backed and whether variant inheritance through a late
   parent works; (3) the exact site count and touch list; (4) how far B diverges from upstream.
4. A recommendation: (a) build A (state A1 or A2), (b) build B with its deviations documented, or (c) something
   else, argued. The maintainer's rule is to adopt upstream; if B is recommended, say with measurements why A
   can't get there.
5. For the recommended option, the build plan's inputs: exact files and regions (line ranges on the lane after
   010), the tests to rewrite from `tabindex` to behaviour, the docs (`docs/src/routes/docs/lazy-motion/+page.svx`
   `## Async loading` and the `m` section) and changeset text, effort, risk, STOP risks, and the guard suites.

**Verify**: the report exists with every section, every claim backed by a measurement or `file:line`;
`git diff --stat <010's last commit>..lane/1471-lazy -- src/lib` shows no prototype code (only
`__tests__/FeaturelessMProbe.svelte` and `featurelessM.spec.ts`); on the lane `pnpm check` gives 0 errors,
`pnpm test:only` passes, `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion` passes (red cases are
`test.fail`), the consumer SSR check passes, `trunk check` passes on committed files.

## Test plan

- Committed red tests are the build plan's anchors; they stay `test.fail()` until the build lands and removes the
  markers.
- Guards: the prop-derived attributes case, the sync-LazyMotion case, the control card, SSR equality, and every
  `motion.*` test (neither prototype may change them).

## Done criteria

- [ ] Red tests committed on the lane as `test.fail()` / `it.fails`, lane suites green
- [ ] Both prototypes committed on `spike/1471-featureless-m` (or a STOP explaining why one couldn't be built)
- [ ] `011-spike-report.md` answers questions (1)-(4), recommends one option, and lists its build touch list
- [ ] No prototype code on the lane; `pnpm check` 0 errors on the lane

## STOP conditions

- Plan 010 is not in the lane.
- A guard fails in Step 1, or the "no VisualElement" case passes before any prototype.
- A prototype changes the result of any `motion.*` test and the cause can't be found inside the time box — record
  it in the report and move on to the next step instead of extending the box.
- Either prototype needs edits to `motion-dom` itself.

## Maintenance notes

- The build plan written from this report replaces this file's role; README row 011 should then point at it.
- Whichever option is built, the `tabindex`-as-feature-proxy assertions (plan 010's and the older
  `LazyMotion.spec.ts` / `e2e/lazy-motion/basic.spec.ts` ones) must become behavioural, because upstream renders
  `tabindex` from props.
