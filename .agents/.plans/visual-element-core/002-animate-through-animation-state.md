# Plan 002: Route enter/animate/variant animations through createAnimationState

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/visualElementCore.ts src/lib/utils/animationControls.svelte.ts`
> Plan 001 legitimately changed `_MotionContainer.svelte` and created
> `visualElementCore.ts` — expect that. Any OTHER drift vs the excerpts below
> is a STOP condition.
>
> Revision 2026-07-24 (guard, after plan 001 landed at `66a7af9`): three
> findings from 001 change this plan's assumptions — read
> `001-visual-element-foundation.guard.md` before starting.
>
> 1. `buildMotionNodeProps()` ALREADY carries `style` (001 had to include it:
>    the projection adapter has always bound style onto the VE). Step 2's
>    "add `style: styleProp`" is therefore already done; Step 2's real work is
>    the rest (initial-inline-style source, removing the container's direct
>    `styleEffect` subscription).
> 2. The container creates the VE with `seedLatestValues: false` because
>    `HTMLProjectionNode` holds `latestValues` BY REFERENCE and reads its
>    transform keys as already-applied transforms. **This plan MUST flip
>    `seedLatestValues` to `true` in the same step that makes the VE the
>    renderer** (Step 2), and the layout/projection e2e suites
>    (`e2e/layout e2e/projection`) must be added to that step's verify — a
>    seeded-but-unrendered target corrupts projection measurement.
> 3. Installed motion-dom 12.42.2 never calls `updateFeatures()` itself; the
>    container calls it after mount (upstream `use-visual-element.ts:147`).
>    The `animateChanges()` scheduling in Step 3 hooks in AFTER that existing
>    call, mirroring upstream's effect ordering. Also: `MotionConfigProps`
>    (our context) has no `skipAnimations` field — check how
>    `MotionConfig.skipAnimations` actually reaches the runtime
>    (`MotionGlobalConfig`?) before wiring it to the VE.
>
> Revision 2026-07-24 #2 (guard, after executor STOP at `c6b336b`): the first
> revision's "flip `seedLatestValues` in the same step that makes the VE the
> renderer" was correct as a constraint but unsatisfiable in Step 2 — Step 2
> only makes the VE the renderer of style MotionValues; animated keys are only
> VE-driven once `animateChanges()` runs AND the legacy WAAPI writer is gone.
> A seeded-but-undriven `latestValues` freezes at the `initial` target and any
> VE render writes it to the DOM (measured: exit clone at 2.36px vs 128px live
> box). Consequences, now reflected in the rewritten Steps 2–4 below:
>
> - The style-MotionValue slice of Step 2 is ALREADY LANDED (`36adbca`) and
>   verified. Do not redo it.
> - `seedLatestValues: true` + `scheduleRenderMicrotask()` (both call sites
>   carry `// plan 002 STOP` comments) move into the new ATOMIC Step 3 and
>   must land in the same commit that wires `animateChanges()` AND deletes the
>   legacy declarative writers. No intermediate commit may exist where
>   `latestValues` is seeded but not driven.
> - `skipAnimations` is answered: this library has no `MotionConfig.skipAnimations`
>   prop (`MotionConfigProps` = `transition` + `reducedMotion` only, `types.ts:783`);
>   `MotionGlobalConfig` is a user-facing re-export. The VE option stays
>   threaded-but-unset. Nothing to wire.
> - Line references in "Current state" are shifted ~+123 by plan 001. Current
>   locations: `executeAnimation` :2216, `runAnimation` :2422, re-run effects
>   :3290–3375, mount/enter effect :3376–3553, `renderedInlineStyle`
>   :1803–1855, controls helpers :1398/:1469/:1540/:1600.
>
> Revision 2026-07-24 #3 (guard, after executor STOP at `2efc9a2`): the atomic
> Step 3 attempt is PRESERVED on branch `plan002-step3-attempt` (commit
> `129a394`) and is largely CORRECT — resume by cherry-picking it, do not
> rewrite from scratch. Proven on that attempt: seed + `scheduleRenderMicrotask`
> caused zero projection/exit-clone failures; the `renderedInlineStyle`
> collapse retained all three holds with no gesture/wait regressions; the
> inherited-variant fix (pass only `declarativeAnimateProp` as `animate`, let
> `animateChanges` read inherited labels via `getVariantContext(parent)`) is
> the correct upstream model; VE creation must sit after
> `effectiveInitialProp`/`effectiveAnimate`/`effectiveCustom` are resolved;
> and the library's animate-first-keyframe first-paint seed (SSR pin) must be
> preserved explicitly. Changes to Step 3:
>
> 1. **Gate re-scoped**: drop `e2e/variants` from Step 3's verify — variant
>    tree/stagger propagation is Step 5's subject and returns to the gate
>    there. Step 3's gate is now `pnpm test:only` + SSR pin +
>    `pnpm test:e2e e2e/motion e2e/layout e2e/projection e2e/animate-presence`.
> 2. **New sub-item 3e — key-change writer**: `runKeyTransition` (the
>    same-element key-change exit→initial→enter sequence) is a 5th declarative
>    writer Step 3c must migrate, not leave: replace its snap+enter with
>    `animationState.reset()` + jump values to resolved initial +
>    `animateChanges()` (upstream re-enter semantics; plan 004 later
>    formalizes the exit half with `setActive('exit')`). The four
>    `e2e/animate-presence/key-change` specs are its verify.
> 3. **New sub-item 3f — relative keyframes**: `'+=N'` relative keyframe
>    resolution (`resolveWildcardKeyframes`) is a svelte-motion extension with
>    NO motion-dom equivalent (`fillWildcards` handles `null` only). Re-home
>    it on the VE path: resolve relatives against the live channel value into
>    the `animate` definition the animationState sees, at the point props are
>    (re)built. Verify: `e2e/motion/declarative-wildcards` spec passes.
> 4. **New sub-item 3g — white-box unit specs**: 6 tests in
>    `_MotionContainer.spec.ts` assert call counts on the mocked legacy
>    `animate()`; rewrite them to assert BEHAVIOR (DOM/latestValues outcomes
>    or animationState interactions), not the deleted mechanism.
> 5. Executor process note stands: never locate deletion boundaries in this
>    3,600-line component by unanchored string index; take a WIP commit before
>    large surgery.
>
> Revision 2026-07-24 #4 (guard, after executor STOP at `7cce600`): Step 3 is
> ACCEPTED for landing from `plan002-step3-attempt` commit `e4fe515`
> (cherry-pick it; gate result 157/159). The two failures —
> `e2e/animate-presence/layout-button.spec.ts` "runs the interactive rolling
> copy control" and "keeps rolling copy labels out of scaled ancestors during
> the swap" — share one root cause: wait-mode key-change exit coordination,
> which this plan's own Out-of-scope section and sub-item 3e defer to plan
> 004 (`setActive('exit')` + presence registration). Ruling:
>
> - These two specs are DOCUMENTED KNOWN-FAILURES until plan 004 lands. They
>   are excluded from Step 3's and Step 8's gates by name — nothing else in
>   `e2e/animate-presence` may fail. Plan 004's done criteria now own them.
> - Plan 004 is re-ordered to run IMMEDIATELY after 002, before 003, to keep
>   the known-red window minimal (README updated).
> - Executor findings recorded as constraints for later steps: the
>   `renderedInlineStyle` animated-key slot MUST NOT be memoized (a `$derived`
>   over mutable `latestValues` computes once and freezes — plain function
>   only); optimized-appear requires `animateChanges` after
>   `finishOptimizedAppearAnimation` (non-accelerated channels like `filter`
>   depend on it); the 3e rewind targets the CURRENTLY resolved `initial`
>   (never a creation-time snapshot — empty under `initial={false}`);
>   3f relative-keyframe memoization commits only when a live value was
>   available.
>
> Revision 2026-07-24 #5 (guard, after executor STOP at `bc2c5be`): the
> revision-#3/#4 Step-3 gate omitted `e2e/utilities` (present in the ORIGINAL
> Step-8 gate) and masked three real Step-3 regressions. Guard defect, found
> by the executor bisecting at `dc2d197`. Rulings:
>
> 1. **Step 5 partial (`91d31d9`) is ACCEPTED** — strictly better than
>    `dc2d197` on every suite, clearly labelled. The props-vs-context split it
>    implements is a binding constraint: an inheriting child keeps
>    `props.animate` undefined (else `isControllingVariants` breaks
>    `addVariantChild`) and seeds first paint via the `context` parameter
>    (`{ animate: effectiveAnimate }`); the Svelte variant/custom stores STAY
>    (they feed `effectiveCustom` and the context label).
> 2. **New Step 3h (completion items)**: `e2e/utilities` joins Step 3's gate
>    retroactively. Fix the three regressions it exposed:
>    (a) reduced-motion policy — re-home `filterReducedMotionKeyframes` onto
>    the VE path (filter the `animate`/`while*` definitions in
>    `buildMotionNodeProps` so the animationState never sees transform
>    channels under a reducing policy; `initialKeyframes` filtering already
>    survives). Verify: both `motion-config-reduced-motion` specs.
>    (b) transformTemplate removal — clearing the prop must drop the template
>    from the next VE render. Verify: `transform-template` "removes
>    transformTemplate if prop is removed".
> 3. **Step 5 remainder** (`variants/stagger-interrupt`): the interrupted stop
>    settles `latestValues` without a following render (cancelled ≠ completed,
>    so no `AnimationComplete`). Pursue the executor's lead: flush via the
>    `Update` event or a render on the stop/retarget path — NOT another
>    `AnimationComplete` subscription. A manual `ve.scheduleRender()` provably
>    corrects the DOM.
> 4. **`utilities/animation-controls` "re-attaching idle controls"** is
>    Step 7's subject and is a named allowed-failure until Step 7 lands —
>    within this plan, not deferred across plans.
> 5. **A first `animateChanges()` pass must NEVER be skipped** — motion-dom's
>    private `isInitialRender` swallow (`animation-state.mjs:318-325`) depends
>    on the pass running; skipping it makes the first real variant change get
>    swallowed instead. No "already at target" shortcuts, ever.
>
> Completion order: 3h → Step 5 remainder → Steps 6, 7, 8. Step 8's full gate
> = original suites, allowed failures ONLY the two 004-owned layout-button
> specs.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 001-visual-element-foundation.md (must be DONE)
- **Category**: tech-debt (architecture migration, GitHub issue #449)
- **Planned at**: commit `7eba0bd`, 2026-07-24

## Why this matters

This is the core of #449: the declarative `initial`/`animate`/`variants` writer
moves from bespoke `animate()` calls + inline-style bookkeeping onto
`visualElement.animationState.animateChanges()`. That deletes the fragile
machinery the current design forces: duration-0 "snap" animations, JSON
dedup flags (`lastAnimatePropJson`, `lastRanVariantKey`), the
`renderedInlineStyle` phase machine, and `applyAnimateRestingStyle` — because a
VisualElement holds values in `latestValues` and renders them every frame, so
nothing "surrenders" a property when WAAPI fill ends. After this plan the
`animate` semantics are upstream's exactly: dedup via `prevResolvedValues`,
`initial={false}` via `blockInitialAnimation`, removed-key restoration via
`baseTarget`, velocity continuity via retargeting the same MotionValue.

## Current state

(Plan 001 added the inert VE; these are the legacy writers this plan replaces.)

- **Mount/enter effect** `_MotionContainer.svelte:3252-3433`. Branches:
    - `initial === false` → `animate(element, snapshot, { duration: 0 })` then
      `mountedWithInitialFalse = true` (`:3271-3287`).
    - has `initialKeyframes` → optimized-appear handoff
      (`finishOptimizedAppearAnimation`, `:3288-3310`) or: SVG dash attributes
      set directly, `animate(element, initialForAnimate, { duration: 0 })`
      (`:3339`), then rAF → `runAnimation()` → flip `isLoaded='ready'`
      (`:3350-3382`).
    - no initialKeyframes → `runAnimation()` or a duration-0 variant snap when
      `parentInitialFalse` (`:3383-3405`).
    - no `animate` at all → write initial via
      `element.setAttribute('style', mergeInlineStyles(...))` (`:3406-3428`).
- **`executeAnimation`** `_MotionContainer.svelte:2129-2224` — the primary
  animate writer:

```ts
// _MotionContainer.svelte:2135-2148 (payload prep)
const rawPayload = filterReducedMotionKeyframes($state.snapshot(resolvedAnimate), reducedMotion)
const { target: rawTarget, transition: transitionAnimate } = extractTargetTransition(rawPayload)
const svgPathFinished =
    isSVGPathElement(element) && hasSVGPathProperties(rawTarget)
        ? animateSVGPathAttributes(element, rawTarget, transitionAnimate)
        : []
let payload = svgPathFinished.length > 0 ? stripSVGPathKeyframes(rawTarget) : rawTarget
payload = transformSVGPathProperties(element, payload)
```

then wildcard resolution (`resolveWildcardKeyframes`), `notifyWillChange`,
and either `animateTemplatedTransformPayload` (transformTemplate case) or
`animateWithLifecycle(element, payload, ...)`; on completion
`applyAnimateRestingStyle(payload)` promotes the target to the inline
baseline (`:2176-2188`, the #377 mechanism).

- **`runAnimation`** `:2335-2429` — gates `executeAnimation` behind the
  AnimatePresence wait-mode contract (`display:none` hold, deferred-enter
  callback; see CLAUDE.md "AnimatePresence wait mode": when enter is deferred
  in `mode="wait"`, the enter animation must be marked handled BEFORE flipping
  `isLoaded` to ready, and `objectAnimateRanOnMount`/`lastAnimatePropJson` set,
  to prevent a duplicate run / visible pop).
- **Re-run effects** `:3165-3250` — JSON-compare `animateProp` / variant keys
  and call `runAnimation()` again.
- **`renderedInlineStyle`** `:1716-1766` — a `$derived.by` that rewrites the
  whole `style` attribute per phase (`mounting`/`initial`/`ready` ×
  `enterAnimationSettled` × animation-controls state). This is the "second
  writer" that must disappear for animated keys.
- **Imperative controls** — `animate={controls}`:
  `startAnimationControlsDefinition` (`:1513-1642`),
  `applyAnimationControlsTarget` (`:1311-1367`, does `animate(..., {duration:0})`
  AND `element.setAttribute('style', ...)`), `snapshotFrozenControlsValues`
  (`:1382-1452`), registered with the controls object at `:3012-3020` via
  `src/lib/utils/animationControls.svelte.ts` (`registerElement` API around
  line 52).
- **Style motion values** — `$effect` at `:638-649` runs
  `applyMotionStyleEffect` / `styleEffect(element, styleValues)`; SVG attrs via
  `svgEffect` at `:1798-1807`.
- **Upstream semantics to replicate** (cite these in comments):
    - Commit order per React commit: `update(props, presenceContext)` →
      (mount on first) → `updateFeatures()` + microtask render →
      `animationState.animateChanges()` in an effect
      (`framer-motion/src/motion/utils/use-visual-element.ts:112-187`).
    - `animateChanges` reads `visualElement.props` — there is no `setProps` on
      AnimationState.
    - The initial inline style comes from `visualState.latestValues` via
      `buildHTMLStyles` (`framer-motion/src/render/html/use-props.ts:21-32`).
    - `MotionConfig` transition reaches the VE as `props.transition`
      (`getDefaultTransition()`); plan 001's `buildMotionNodeProps` already
      passes `mergedTransition`.
- **SSR**: `src/lib/html/_MotionContainer.ssr.spec.ts` pins the server-rendered
  style/attr output. SSR has no VE (client-only); the server-rendered inline
  style must remain byte-identical.
- Installed-API note: `AnimationState.setActive` accepts only
  `(type, isActive)` at runtime (the third options param in the .d.ts is
  ignored in 12.42.2).

## Commands you will need

| Purpose       | Command                                                                       | Expected on success |
| ------------- | ----------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                  | 0 errors            |
| Unit tests    | `pnpm test:only`                                                              | all pass            |
| SSR pin       | `pnpm test:only src/lib/html/_MotionContainer.ssr.spec.ts`                    | all pass            |
| Targeted e2e  | `pnpm test:e2e e2e/motion e2e/variants e2e/svg e2e/utilities e2e/lazy-motion` | all pass            |
| Presence e2e  | `pnpm test:e2e e2e/animate-presence`                                          | all pass            |
| Format / lint | `trunk fmt` / `trunk check`                                                   | no new issues       |

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte`
- `src/lib/utils/visualElementCore.ts` (extend: controls subscription, style
  scraping enablement)
- `src/lib/utils/animationControls.svelte.ts` (bridge `start/stop/set` to
  `animateVisualElement`)
- `src/lib/utils/visualElementCore.spec.ts`, new spec files for changed units
- Deletions of now-dead helpers in `_MotionContainer.svelte` and, if they
  become fully unused, `src/lib/utils/animation.ts` helpers (verify with grep
  before deleting)

**Out of scope** (do NOT touch):

- Gesture files (`hover.ts`, `interaction.ts`, `focus.ts`, `inView.svelte.ts`,
  `gestureCoordinator.ts`) — plan 003. The gesture systems keep animating the
  element directly in this plan; they already coordinate against the enter
  writer via `getBaseStyleValues`/`liveGestureTransform`, and those hooks must
  keep working until 003.
- `drag.ts`, `layout.ts`, `motionDomProjection.ts` behavior — plan 005.
- The presence CLONE exit path (`presence.ts`) — plan 004.
- Optimized-appear internals (`src/lib/utils/optimizedAppear.ts`) — keep the
  handoff working by calling `animateChanges` only after
  `finishOptimizedAppearAnimation` resolves, mirroring today's ordering.

## Git workflow

- Branch `issue-449-visual-element-core`; commit per step,
  e.g. `feat(core): route declarative animate through animationState (#449)`.
- Do NOT push.

## Steps

### Step 1: Characterization baseline

Run the targeted e2e suites and unit tests on the branch BEFORE changes; save
the summary (pass counts) in your report. These suites are the behavioral pin —
this plan must end with identical results.

**Verify**: `pnpm test:only` and the two e2e commands above → record results;
all expected to pass.

### Step 2: Bind style MotionValues to the VE — ALREADY LANDED (`36adbca`)

(Rewritten by guard revision #2.) The style-MotionValue slice is done and
verified: `styleEffect`/`applyMotionStyleEffect` demoted to the no-VE fallback,
`transformTemplate` carried in `buildMotionNodeProps()`. Confirm it is present
(`git log --oneline | grep 36adbca`) and do not redo it. `svgEffect` for
attr-only SVG values stays until Step 6.

**Verify**: `pnpm test:only src/lib/html/_MotionContainer.ssr.spec.ts` →
passes; `pnpm test:e2e e2e/vanilla-values e2e/utilities` → all pass.

### Step 3: The writer swap — ATOMIC (seed + animateChanges + legacy deletion)

(Rewritten by guard revision #2 after the `c6b336b` STOP.) These four changes
land in ONE commit; no intermediate state is green, by construction — a seeded
`latestValues` that nothing drives freezes at the `initial` target and any VE
render writes it to the DOM.

a. Flip `seedLatestValues: true` and enable `scheduleRenderMicrotask()` after
`updateFeatures()` — both call sites are marked `// plan 002 STOP` in
`_MotionContainer.svelte`.
b. Wire `ve.animationState?.animateChanges()` on the upstream schedule: once
after mount + `updateFeatures()`, and after each `ve.update(...)` in the
props effect. Gate the FIRST call behind the existing wait-mode deferral
(where `runAnimation()` defers via the AnimatePresence context, `:2422`),
honoring the CLAUDE.md wait-mode rule (mark enter handled before flipping
loaded state). `initial={false}` maps to `blockInitialAnimation: true` at
VE creation (set from `effectiveInitialProp === false || parentInitialFalse`).
c. Delete the legacy declarative writers: `executeAnimation` (`:2216`),
`runAnimation`'s animation body (`:2422`, keep the wait-gate now wrapping
`animateChanges`), the re-run JSON-dedup effects (`:3290-3375`), the
duration-0 snaps in the mount/enter effect (`:3376-3553`), and
`applyAnimateRestingStyle`.
d. Collapse `renderedInlineStyle` (`:1803-1855`) for ANIMATED keys only. It
must RETAIN, untouched: the `liveGestureTransform` splice (gestures stay
legacy until plan 003), the wait-mode `display:none` holds, and the
`pathLength` mounting visibility hold. What goes: the enter/animate/
controls slot logic for keys the animationState now owns.

Keep `onAnimationStart`/`onAnimationComplete` firing — subscribe via
`ve.on('AnimationStart', ...)` / `ve.on('AnimationComplete', ...)`.

`grep -n "duration: 0" src/lib/html/_MotionContainer.svelte` afterward — every
remaining hit must be justified in your report (expected: none in the
enter/animate paths).

**Verify** (full gate for this step — it is the swap):
`pnpm test:only` → all pass; SSR pin passes unchanged;
`pnpm test:e2e e2e/motion e2e/variants e2e/layout e2e/projection e2e/animate-presence`
→ all pass. If `e2e/motion/exit-animation.spec.ts` fails on clone sizing, the
seed is being rendered before animateChanges drives it — re-check ordering
before anything else.

### Step 4: (merged into Step 3 by guard revision #2 — no separate work)

### Step 5: Variant tree inheritance through the VE

Variant propagation currently flows through Svelte stores
(`localVariantStore`, `_MotionContainer.svelte:651-745` region). With VEs
parented (plan 001 context), upstream inheritance comes from
`getVariantContext(parent)` + the VE tree (`addVariantChild` happens in
`mount()`). Route `inheritedVariant`/`effectiveAnimate` resolution through the
VE: children with no own `animate` inherit via animationState (upstream
`isVariantNode`/`isControllingVariants` semantics). Keep the Svelte stores only
if `custom` propagation (`effectiveCustom`) still needs them — if so, say so in
NOTES rather than forcing it.

**Verify**: `pnpm test:e2e e2e/variants` → all pass (includes stagger/children
propagation specs).

### Step 6: SVG values through the VE

`SVGVisualElement` builds `attrs` natively (including `pathLength` handling
upstream-style). Move the SVG motion-value attrs (`svgEffect` at `:1798-1807`)
and the path-drawing special cases (`animateSVGPathAttributes`,
`transformSVGPathProperties` calls inside the deleted `executeAnimation`) onto
the VE path. If the VE's native `pathLength` semantics differ from our
`stroke-dasharray` approach in a way that breaks `e2e/svg`, STOP and report
(do not layer both).

**Verify**: `pnpm test:e2e e2e/svg` → all pass.

### Step 7: Imperative `animate={controls}` through `animateVisualElement`

In `animationControls.svelte.ts`, change the element-registration bridge so a
subscribed component hands its VE to the controls object; `controls.start(def)`
→ `animateVisualElement(ve, def, { transitionOverride })` (upstream
`animation-controls.ts`), `controls.stop()` → stop the VE's values
(`ve.values.forEach(v => v.stop())`), `controls.set(def)` → resolve + set
values. Then delete `startAnimationControlsDefinition`,
`applyAnimationControlsTarget`, `snapshotFrozenControlsValues`,
`stopAnimationControlsAnimations` from the container and the
controls-specific branches of `renderedInlineStyle` (already collapsed in
Step 4). Wire `AnimationFeature.mount`'s `isAnimationControls` subscription
(the plan-001 TODO).

**Verify**: `pnpm test:only src/lib/utils/animationControls.spec.ts` (update it)
→ all pass; `pnpm test:e2e e2e/utilities` → all pass.

### Step 8: Full gate

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/motion e2e/variants e2e/svg e2e/utilities e2e/lazy-motion e2e/animate-presence`.

**Verify**: identical-or-better results vs the Step 1 baseline. Any regression
is a STOP after two fix attempts.

## Test plan

- No red-first test: behavior-preserving migration; the Step 1 characterization
  baseline (existing suites) is the pin.
- New unit tests: extend `visualElementCore.spec.ts` — `blockInitialAnimation`
  from `initial={false}`; AnimationStart/Complete event bridging; controls
  bridge (`start` resolves through `animateVisualElement` — assert via a
  mounted VE on jsdom with a spied value).
- Updated: `animationControls.spec.ts` for the new bridge.
- Verification: full unit suite + the six e2e suites named above.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] The six targeted e2e suites exit 0, matching the Step 1 baseline
- [ ] `grep -n "executeAnimation\|applyAnimateRestingStyle\|lastAnimatePropJson\|objectAnimateRanOnMount" src/lib/html/_MotionContainer.svelte` → no matches
- [ ] `grep -n "animateChanges" src/lib/html/_MotionContainer.svelte` → present
- [ ] SSR spec passes byte-identical (no snapshot updates to
      `_MotionContainer.ssr.spec.ts` unless justified in NOTES)
- [ ] No files outside the in-scope list modified
- [ ] README status row updated

## STOP conditions

- Any drift vs the excerpts beyond plan 001's expected changes.
- The wait-mode deferral cannot be expressed as "defer first animateChanges"
  without regressing `e2e/animate-presence` — report the exact failing spec.
- Gesture e2e (hover/tap) breaks because removing `renderedInlineStyle`
  changed the baseline the gesture writers read (`getBaseStyleValues`) — do
  not patch gesture files (out of scope); report.
- SVG pathLength semantics conflict (Step 6).
- The Step 1 baseline itself has failures — report before starting.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- After this plan, `latestValues` on the VE is the single source of truth for
  animated style; anything reading computed style mid-animation (gesture
  baselines, drag) is temporarily reading VE output — plans 003/005 formalize.
- Reviewer should scrutinize: wait-mode enter deferral (CLAUDE.md pop bug),
  `initial={false}` + variant-inheritance matrix, controls stop/velocity
  continuity, and that deleted helpers are truly unreferenced (grep).
- Deferred: gesture/drag/layout writers still bypass the VE (plans 003/005);
  presence clone path untouched (004).
