# Plan 001: Add MotionConfig coordinate correction for drag and pan

> Follow the steps in order, including the failing regression and coordinate-characterization gate. Do not implement a pointer-only shortcut. Stop on the conditions below instead of expanding scope. Update this batch's README status when finished.
>
> Revision 2026-09-08: Execute in the isolated `feat/motion-config-transform-page-point` worktree at main `14046a5` (v1.2.0, includes merged PR #480). Compared the complete scoped source diff against `fcf6452`: no runtime/docs anchor drift. Operator prepares dependencies and runs browser verification because the Codex companion sandbox cannot install, launch browsers, write `.agents/**`, or commit. Executor returns coordinate-contract evidence in its report for guard to record; it never edits this plan. All red-first and characterization gates remain mandatory.
>
> **Drift check:** `git diff --stat 14046a5..HEAD -- src/lib/types.ts src/lib/index.ts src/lib/components/MotionConfig.svelte src/lib/components/motionConfig.context.ts src/lib/html/_MotionContainer.svelte src/lib/utils/drag.ts src/lib/utils/pan.ts src/lib/utils/motionDomProjection.ts docs/src/routes/docs/motion-config docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts`
> Also compare existing test/docs exemplars below before editing them. New paths in Scope must not already contain an independent implementation. A changed file is a prompt to compare, not permission to overwrite it.

## Governing revision — 2026-09-08, paused for review

User direction: “I dont want to reuse if its not marked for reuse, we need to match react exactly”.

This revision supersedes conflicting behavior requirements below and the unapproved [proposed amendment](proposed-amendment.md). **Implementation remains paused for review.** Recording this direction does not authorize restarting dispatch.

- Match observable behavior through the public React Motion 13.2.0 components for the scoped pan/drag cases. Do not substitute mathematically preferred scroll, snap, history, velocity, or callback-capture behavior, even when upstream behavior appears surprising.
- Reuse only APIs intended for public reuse. `PanSession` is marked `@internal` and is not a public package export. Do not deep-import it, patch package exports, extract private classes from feature bundles, or treat this direction as permission to vendor its implementation. Internal source is a behavioral reference; Svelte adapters must use supported public primitives and reproduce React behavior.
- Correct the reference evidence: React `PanGesture` constructs its session with `transformPagePoint` and `contextWindow`, without `element`. Our `attachPan` passes `element`, which enables optional scroll tracking. The guard's direct class probe also passed `element`; it does not establish ordinary React `onPan` behavior. Characterize React drag separately through its actual adapter.
- Before implementation resumes, prepare and review a pinned React reference fixture using public components, with matching Svelte inputs, DOM geometry, scroll positions, event timing, and config. Keep any reference environment isolated from shipped Svelte dependencies. Record callback sequences, point/delta/offset/velocity, rendered positions, snap, cancellation, config replacement and stable-closure changes. Assert actual scroll and layout preconditions. Private-class probes may supplement this evidence, never replace it.
- Earlier instructions to preserve every existing no-config convention or impose a particular raw-history/scroll policy are not authority to diverge from React. Identify existing mismatches and their compatibility impact explicitly before changing them. The earlier element-wide callback snapshot policy also requires comparison with React's actual adapter lifetimes.
- Keep the current file scope and every verification gate. Do not weaken assertions to accommodate the draft. Revise behavior expectations only from matched React evidence, retaining the previous expectations and rationale in the guard record. Any required scope expansion needs review.

Source snapshot `13ec152` already implements the draft. The excerpts and numbered steps below describe the original `14046a5` baseline and are retained for review; they are **not a ready-to-dispatch revised execution sequence**. Preserve completed red-first evidence instead of requiring the fixed regression to fail again. Resume preparation must reconcile those steps and done criteria with the reference results before execution. Five targeted browser failures and remaining verification gates are unresolved.

## Status

- **Priority:** P1 within the remaining parity roadmap; not a release blocker
- **Effort:** L (multi-day, including tests and documentation)
- **Risk:** MED; coordinate mistakes can affect all drag consumers
- **Depends on:** none; PR #480 merged; baseline includes its boundary-release tests
- **Category:** direction / enhancement
- **Confidence:** HIGH that the feature is missing; ranking is product judgment
- **Planned at:** `af75ef6`, 2026-09-08 (policy revision; original source baseline `14046a5`)
- **Status:** PAUSED FOR REVIEW — React parity selected; reference contract and revised execution steps pending; snapshot `13ec152` has unresolved browser failures

## Why this matters

The library's stated goal is translating Framer Motion examples to Svelte with minimal changes. A draggable child inside CSS `scale(0.5)` currently applies a 100-screen-pixel pointer movement as 100 local pixels, which the parent renders as only 50 screen pixels. Consumers have no inherited coordinate-correction hook to fix drag, pan, measured constraints, and release velocity together.

Expose `MotionConfig.transformPagePoint` and route it through the existing input and measurement machinery. The visible target is a draggable tile that remains under the pointer on a zoomed board, respects its visual bounds, and releases naturally. This is the top selected item, not a request to implement all remaining MotionConfig options.

Online reference: https://examples.motion.dev/react/drag demonstrates the baseline draggable interaction. The scaled variation is documented at https://motion.dev/docs/react-motion-config#transformpagepoint and exists in upstream `dev/react/src/tests/drag-scaled-parent.tsx`. The exact local upstream ref-constraints example, when that repository's documented server is running, is `http://localhost:9990/?example=_dragConstraintsRefScale`. No live visual session was available during this audit; the browser runtime returned no connected browsers.

## Current state and constraints

Repository: `@humanspeak/svelte-motion`, Svelte 5, TypeScript, SvelteKit test application, motion/motion-dom 13.2.0, pnpm 11.24.0. Docs are a separate SvelteKit workspace deployed to Cloudflare; this plan does not deploy.

### Public config and reactive context

`src/lib/types.ts:803` currently exposes only:

```ts
export type MotionConfigProps = {
    transition?: MotionTransition
    reducedMotion?: ReducedMotionConfig
    skipAnimations?: boolean
}
```

`src/lib/components/MotionConfig.svelte:21` destructures those three fields. It reads the ancestor before replacing context and uses getters; preserve that pattern:

```ts
get skipAnimations() {
    return skipAnimations ?? parentConfig?.skipAnimations
}
```

`src/lib/components/motionConfig.context.ts:12` returns the same config object from Svelte context. Do not replace getters with a snapshot or make nested configs reset inherited options. `src/lib/components/__tests__/NestedMotionConfigProbe.svelte` is the inheritance-test exemplar. `src/lib/components/MotionConfig.skipAnimations.spec.ts` demonstrates rendering a Svelte harness, accessing `visualElementStore`, and configuring real frame timers.

`src/lib/index.ts:106` explicitly lists exported types. `MotionConfigProps` is not in that list today; expose it and the new callback type as part of this API addition.

### Input paths

`src/lib/utils/drag.ts:1079` seeds drag from client coordinates:

```ts
startPoint = { x: e.clientX, y: e.clientY }
lastPoint = { ...startPoint }
history = [{ x: e.clientX, y: e.clientY, t: now() }]
```

`onPointerMove` at line 1133 also reads `clientX/clientY`. `computeInfo` uses this history, and release inertia uses its velocity. Transforming only the DOM output or callbacks would leave release physics wrong. Preserve the current no-config behavior, including callback semantics; do not fix the separate cumulative-delta convention in this feature.

`resolveConstraints` at line 267 accepts an element or numeric limits. Element constraints use raw DOMRect differences:

```ts
return {
    top: c.top - e.top,
    left: c.left - e.left,
    right: c.right - e.right,
    bottom: c.bottom - e.bottom
}
```

Its call sites are initial attachment (463), options update (519), resize handling (615), and drag start (1054). All must agree. Numeric constraints are already local translation limits. `snapToCursor` at 1091 compares a DOMRect center with the pointer; correcting only one side breaks it. `adjustOrigin` at 946 receives layout deltas, not raw pointer points.

`src/lib/utils/pan.ts:181` reads page coordinates:

```ts
const extractEventPoint = (event: PointerEvent): Point => ({
    x: event.pageX,
    y: event.pageY
})
```

Start, move, and terminal reads occur at 402, 469, and 489. `handleScroll` at 559 currently adjusts retained points/history using raw scroll deltas. Pan has no focused unit-test file today; add one. `e2e/motion/pan-authored-transforms.spec.ts` is its browser-test exemplar.

### Container, rendering and measurement

`src/lib/html/_MotionContainer.svelte:559` builds VisualElement props; it forwards `transition` and `transformTemplate`, but no coordinate transform. `resolveDragOptions` at 1535 and `attachPan` at 1754 also omit it. The effects at 1599 and 1785 update existing drag options/pan handlers without detaching a live session. Preserve this lifetime split.

The VisualElement update effect at 2156 already updates full props and features. Forward the new config through that existing path. Do not create a second transform writer or rewrite `visualElementCore.ts`.

Installed motion-dom contains the important measurement primitives:

- `dist/es/render/VisualElement.mjs:413`: `getTransformPagePoint()` returns `this.props.transformPagePoint`.
- `dist/es/render/html/HTMLVisualElement.mjs:43`: measurement consumes that prop.
- `dist/es/projection/geometry/conversion.mjs`: `transformBoxPoints` transforms top-left and bottom-right corners.
- `dist/es/projection/utils/measure.mjs`: `measureViewportBox` transforms DOMRect corners; `measurePageBox` then adds projection-root scroll.

`src/lib/utils/motionDomProjection.ts:444` uses `projection.measure(false).layoutBox`. Its dragged-layout commit at 584 passes upstream `delta.x.translate/delta.y.translate` into `adjustOrigin`. It already owns transform stripping, phase scroll caches, and single-commit arbitration. Do not add another scale correction to an already corrected delta.

### Upstream references and compatibility boundary

Read the installed 13.2.0 dependency sources first. A local upstream checkout exists at `/Users/jasonkummerl/Github/motion` (observed SHA `1b037b003`), but it may be newer or modified: verify its version/diff before treating it as the release contract. Portable source paths in https://github.com/motiondivision/motion:

- `packages/framer-motion/src/context/MotionConfigContext.tsx`
- `packages/framer-motion/src/gestures/pan/PanSession.ts`
- `packages/framer-motion/src/gestures/pan/index.ts`
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
- `dev/react/src/tests/drag-scaled-parent.tsx`

Current public docs describe the hook, although the source context still labels it an internal Framer integration. Do not copy that annotation into a claim that it is unsupported upstream.

**Do not assume one universal page-space input contract.** Upstream pointer inputs are page coordinates, while measured rectangle corners are viewport coordinates; projection scroll is added after mapping the box. Blindly adding scroll to DOMRect corners before mapping diverges from the same callback used by the VisualElement. Step 2 must settle this compatibility boundary with evidence before changing production input paths.

## Target API and supported behavior

```svelte
<script lang="ts">
    import { MotionConfig, motion } from '@humanspeak/svelte-motion'
    const correctPoint = ({ x, y }: { x: number; y: number }) => ({
        x: x / 0.5,
        y: y / 0.5
    })
</script>

<div style="transform: scale(0.5); transform-origin: top left">
    <MotionConfig transformPagePoint={correctPoint}>
        <motion.div drag dragMomentum={false} />
    </MotionConfig>
</div>
```

- Add Google-style documented `MotionTransformPoint = (point: { x: number; y: number }) => { x: number; y: number }` and optional `MotionConfigProps.transformPagePoint`.
- Missing prop inherits; an explicit identity function overrides an ancestor. An undefined child override resumes inheritance. No new implicit global default or changed no-config coordinate behavior.
- Uniform and nonuniform positive CSS parent scales are required. Plain affine translation in the mapping must cancel correctly when calculating deltas. Corrected callbacks and release velocity use corrected units.
- Snapshot the selected callback at pointerdown, matching upstream PanSession; replacing the config function must not tear down the gesture and affects the next gesture. Geometry used by that live gesture must remain in its captured domain. A callback reading mutable state is a distinct case from replacing its reference; document the outcome of Step 2 before promising live zoom support.
- Element-ref constraints, numeric constraints, controlled start/snap-to-cursor, cancel, axis lock, re-grab, ref resize, and layout compensation must continue working in the supported domain.
- No automatic detection of ancestor CSS transforms, `correctParentTransform`, `transformViewBoxPoint`, perspective/rotation box recovery, or new SVG drag API in this plan. A two-corner AABB mapping is not an arbitrary polygon transform.
- Do not advertise complete scroll/live-zoom parity if Step 2 reveals unresolved upstream behavior. Stop with evidence rather than quietly narrowing these cases after implementation.

## Scope

Only the following runtime files may change:

- `src/lib/types.ts`, `src/lib/index.ts`
- `src/lib/components/MotionConfig.svelte`
- `src/lib/html/_MotionContainer.svelte`
- `src/lib/utils/drag.ts`, `src/lib/utils/pan.ts`

Only the following test/demo paths may change or be added:

- `src/lib/utils/drag.spec.ts`, new `src/lib/utils/pan.spec.ts`
- new `src/lib/components/MotionConfig.transformPagePoint.spec.ts`
- new `src/lib/components/__tests__/TransformPagePointHarness.svelte`
- `src/lib/utils/motionDomProjection.spec.ts` (characterization assertions only)
- `src/lib/index.spec.ts` (public type assertions)
- new `src/routes/tests/transform-page-point/drag/+page.svelte`
- new `src/routes/tests/transform-page-point/pan/+page.svelte`
- new `e2e/drag/transform-page-point.spec.ts`
- new `e2e/motion/pan-transform-page-point.spec.ts`
- `src/routes/+page.svelte`

Documentation/discovery/release-note scope:

- new `docs/src/routes/docs/transform-page-point/+page.svx` and `+page.ts`
- `docs/src/routes/docs/motion-config/+page.svx` and `+page.ts`
- new `docs/src/routes/examples/transform-page-point/+page.svelte` and `+page.ts`
- new `docs/src/lib/examples/transform-page-point/demos/Default.svelte`
- `docs/src/lib/docsNav.ts`, `docs/src/lib/examplesIndex.ts`, `docs/src/routes/examples/+page.ts`
- `docs/src/lib/seo-title-policy.spec.ts` (update actual example count only)
- corresponding generated doc/example mirrors under `docs/static/`, restricted to this feature and affected indexes
- `README.md` (MotionConfig parity/docs claims only)
- new `.changeset/motion-config-transform-page-point.md` (minor)
- this plan, batch README, and `coordinate-contract.md` under this batch

**Out of scope:** package versions/lockfiles, dependencies, workflow changes, projection implementation, animation engines, generated HTML components, Reorder algorithms, AnimatePresence, other MotionConfig options, helper exports mentioned above, `.competitive-intel/state.json`, archived plans. There is a pre-existing uncommitted intel-state change; preserve it. Do not ship edits in PR #480. If production projection changes are necessary, stop and revise the plan rather than expanding the whitelist yourself.

## Commands you will need

Use the repository-pinned pnpm 11.24.0. In this environment global 11.25.0 fails native-binary identity verification. `npm exec --yes --package=pnpm@11.24.0 -- pnpm --version` successfully prints 11.24.0; prefix pnpm commands with that wrapper if needed. Do not disable integrity checks or edit package-manager pins to work around this local issue.

| Purpose | Command | Expected |
| --- | --- | --- |
| Install if needed, operator/guard only | `pnpm install --frozen-lockfile --config.engine-strict=false` | exit 0; no dependency changes |
| Typecheck library/test app | `pnpm check` | 0 errors; record existing warnings |
| Focused unit tests | `pnpm exec vitest run src/lib/utils/drag.spec.ts src/lib/utils/pan.spec.ts src/lib/components/MotionConfig.transformPagePoint.spec.ts src/lib/utils/motionDomProjection.spec.ts src/lib/index.spec.ts` | all pass after implementation |
| Full unit suite | `pnpm test:only` | all pass |
| Build/package validation | `pnpm build` | Vite, svelte-package, publint exit 0 |
| Targeted browser tests | `pnpm exec playwright test e2e/drag/transform-page-point.spec.ts e2e/motion/pan-transform-page-point.spec.ts --reporter=line` | all pass |
| Regression/full browser gate | `pnpm exec playwright test --reporter=line` | all pass except established skips |
| Docs typecheck | `pnpm --filter docs check` | exit 0, or report demonstrated baseline blocker separately |
| Docs build | `pnpm --filter docs build` | exit 0; mirrors generated |
| Docs metadata coverage | `pnpm --filter docs exec vitest run --project=server src/lib/seo-title-policy.spec.ts` | passes actual route count; report pre-existing config failure if encountered |
| Authoritative formatting | `trunk fmt` | no remaining formatting changes |
| Authoritative lint | `trunk check` | no new findings |
| Diff hygiene | `git diff --check` | exit 0 |

Trunk is the authority (`.trunk/trunk.yaml`), including ESLint 10.8.1, Prettier 3.9.6, TypeScript-aware rules and security/config linters. Do not replace its final gates with only package.json lint scripts. Test app Playwright port is 4198. Let its configured build/server run, or set `PW_REUSE_SERVER=1` only for a preview you built from the current source. Never reuse an unidentified preview or kill another project's server.

Recent baseline evidence from this session: 7 brutalist-stage e2e tests and 6 inertia unit tests passed, root check had 0 errors/39 warnings, package validation and commit hooks passed. That is not a full-suite baseline. Do not label unrelated failures as introduced without comparing with the starting revision. Docs gates were not executed by this audit.

## Git workflow

Create an isolated feature branch/worktree from the current base when execution starts, such as `feat/motion-config-transform-page-point`. Leave the PR #480 branch and unrelated local intel edit intact. Use conventional commits, e.g. `feat(gestures): support MotionConfig coordinate transforms`. Commit coherent units after verification. Do not push or open a PR unless separately instructed.

## Steps

### Step 1: Write a failing coordinate regression before API work

In `src/lib/utils/drag.spec.ts`, follow its existing bound MotionValue test: create a DOM element, bind x to a MotionValue, attach an x drag, dispatch pointerdown at x=10 and move to x=30, then clean up. Use options in a separately inferred variable with `axis: 'x' as const`, the ordinary required fields, and a `transformPagePoint` callback multiplying x/y by 2. This structural variable is assignable before the optional field exists; do not use an unknown-property compile failure as the reproduction. Set momentum false. Correct bound x is 40, current bound x is 20.

Add a second case in the same describe with no callback that still expects 20. Use real primary pointer fields and the cleanup pattern already in the file; do not mock the coordinate transformation itself.

**Verify:** `pnpm exec vitest run src/lib/utils/drag.spec.ts -t 'transformPagePoint'` must fail specifically on expected 40/received 20, while the identity characterization passes. If it passes already or fails on setup/types, repair the reproduction or stop. Record exact failure in `coordinate-contract.md`. Do not commit a knowingly red intermediate state for release.

### Step 2: Characterize upstream measurement primitives; defer integration cases

Create `coordinate-contract.md` in this batch. Pin upstream evidence to the installed version or a verified matching upstream revision. Record raw input domains, corrected result domains, when the callback is captured, and every conversion point. **This step does not run a corrected Svelte drag before that implementation exists.** It probes the installed measurement primitives and reads the upstream input contract; the browser integration matrix runs in Step 6.

Add a describe named `transformPagePoint coordinate characterization` in `src/lib/utils/motionDomProjection.spec.ts`. Use the installed `motion-dom` exports `measureViewportBox` and `measurePageBox`, a real DOM element with a stubbed `getBoundingClientRect`, and a minimal root scroll object matching the measurement function's argument. No React reference app, dependency install, external worktree write, or modification of the upstream checkout is required. If these exports are not callable in the installed version, stop rather than inventing a browser adapter.

Use a DOMRect `(left=100, top=200, width=80, height=40)` and callback `({x,y}) => ({x:x/0.5,y:y/2})`. Verify viewport box x=[200,360], y=[100,120]. With root scroll offset x=10/y=30, verify page box x=[210,370], y=[130,150], proving scroll is added after mapping. A spy callback must receive the original viewport corners (100,200) and (180,240), not page-adjusted corners. Also check identity and affine-translation mappings. Exercise the adapter's existing no-transform scroll-invariance tests unchanged.

Read the verified upstream PanSession and drag-controls sources to record pointer extraction, snap-to-cursor and session callback capture, with the exact version/SHA and excerpts. The contract must distinguish callback replacement from a stable callback reading mutable state. Clearly label source-derived expectations separately from executed primitive-test observations.

The following integration cases are **pending**, not claimed green in this step: scaled drag, scrolled-start drag/ref constraints/snap-to-cursor, layout compensation, ref resize, active page/ancestor scroll, live scale through a captured closure, and callback replacement between sessions. Define their inputs and expectations here; Steps 4–6 implement and execute them. Do not create an untyped proxy implementation of the future feature merely to make these tests pass early.

**Verify:** `pnpm exec vitest run src/lib/utils/motionDomProjection.spec.ts -t 'transformPagePoint coordinate characterization'` passes the numerical assertions above. `pnpm exec vitest run src/lib/utils/drag.spec.ts -t 'transformPagePoint'` still fails only on the Step 1 expected 40/received 20 assertion. The report exists and identifies all pending integration checks. If the measured contract disagrees with the installed implementation, STOP and correct this plan before production changes.

### Step 3: Add the inherited API and container wiring

Add documented types/prop; mirror MotionConfig's existing getter pattern and add explicit type exports in `index.ts`. New component tests cover parent inheritance, child override, identity override, clearing override, and config updates without remount. Check the callback in the mounted VisualElement via `visualElementStore`, following the skipAnimations harness.

Add the optional transform fields to `AttachDragOptions`, `AttachPanOptions` and `PanSessionInternalOptions` in this step, before passing them from typed container calls. Runtime consumption is Steps 4–5. Add a getter/options update channel for pan so the latest config is read when a new session starts, without recreating the attachment.

Use an **element-scoped effective callback** in `_MotionContainer.svelte`: an active-session boolean plus the captured callback (the boolean distinguishes a captured undefined/identity behavior from no active session). At session start, capture the current inherited config before constraints or pointer history are measured. For the duration of the pointer session, `buildMotionNodeProps`, drag/pan inputs and any refreshed constraints use this effective callback. A config reference replacement is queued by keeping the raw inherited getter live; it becomes effective after the session ends and is selected by the next pointerdown. Do not overwrite the active snapshot through `updateOptions`.

Provide internal start/end notifications on the attach options to maintain that coordinator, and invoke them on natural terminal events, cancellation, forced teardown, and interrupted/restarted sessions. They are internal plumbing, not new public Motion component callbacks. Start must run before first geometry reads; end must run after terminal payload computation and release physics capture. Handler hot-swapping must not change these lifecycle semantics. Existing drag-versus-pan exclusivity means one pointer session owns the element. Test that changing the config function mid-drag preserves the old effective function in the VisualElement and existing session, then updates both for the next gesture. This explicit Svelte policy prevents the input/measurement mismatch that forwarding the newest config directly would create. Document it as a session-consistency policy, not a claim of identical React rerender timing.

Forward the effective callback into `buildMotionNodeProps`, `resolveDragOptions`, and pan attachment through the existing attach-versus-update split. No detach/re-attach on callback identity changes, and no callback values in DOM spread attributes. A captured function reading changing data remains callable per event/frame; do not confuse that with changing the captured function reference.

**Verify:** `pnpm exec vitest run src/lib/components/MotionConfig.transformPagePoint.spec.ts -t "config API"` and `pnpm check` pass. Group inheritance/export/idle-VisualElement tests under `config API`; active-session integration cases are added and made green in Steps 4–6 when the lifecycle notifications actually run. The Step 1 movement assertion still fails until Step 4. Public TypeScript consumers can import the new types without an internal path.

### Step 4: Correct drag inputs, measurements, and release units together

Consume the optional `AttachDragOptions` field added in Step 3 and implement the agreed callback input path. Seed and update pointer/history positions in corrected units once, then let existing offset, direction-lock, constraints, callbacks, bound values, and inertia consume them. Capture the transform for the active session; `updateOptions` must not silently replace that domain mid-drag. Preserve current behavior when the optional callback is absent.

Extend `resolveConstraints` with an optional transform argument and transform both measured rectangles consistently before their differences are taken. Update all four call sites, including resize and re-grab paths. Keep numeric constraints unchanged. Correct pointer and measured center in `snapToCursor` consistently with Step 2. Forward the callback through the VisualElement so its own measurements are corrected; do not correct projection deltas again in `adjustOrigin`.

Tests must check bound x/y values, transformed callback point/offset/velocity, nonuniform scaling, translated mapping, numeric limits, ref limits, ref resize, controlled start and snap-to-cursor. Reuse real MotionValues and clock control from the existing tests; exact release velocity belongs in deterministic unit tests, not elapsed-time browser assertions. Retain the existing drag callback delta convention.

**Verify:** `pnpm exec vitest run src/lib/utils/drag.spec.ts src/lib/utils/motionDomProjection.spec.ts` passes, including Step 1 and the projection characterization. A changed inertia trajectory from unit correction is expected; no changes to the generator or boundary-release tests are allowed.

### Step 5: Correct pan lifecycle and scroll bookkeeping

Add `src/lib/utils/pan.spec.ts`. Follow real-frame setup and cleanup from `gestures.spec.ts` / `MotionConfig.skipAnimations.spec.ts`; flush Motion frame callbacks before asserting.

Apply the session transform to start/move/up inputs once; cancel and teardown reuse the last valid corrected point. Compute distance threshold, delta, offset and velocity in the corrected domain. Preserve raw pointer positions separately where per-frame re-transformation or scroll bookkeeping needs them. Never mutate a corrected point by adding an uncorrected scroll delta. Implement and verify the scroll behavior derived from the upstream source in Step 2; preserve terminal-event idempotence and handler hot swapping. An unresolved source/observed mismatch is a STOP condition, not permission to omit a case.

Test all callback payload fields, positive/nonuniform/translated mappings, start threshold, ordinary end, pointercancel, teardown once, ignored secondary pointers, handler replacement, callback-reference replacement between gestures, and scroll cases from the contract. Include no-config baseline cases.

**Verify:** `pnpm exec vitest run src/lib/utils/pan.spec.ts src/lib/components/MotionConfig.transformPagePoint.spec.ts` and `pnpm exec playwright test e2e/motion/pan-authored-transforms.spec.ts --reporter=line` pass; no listener leaks or duplicate terminal callbacks.

### Step 6: Build two demo pages and observable browser tests

Create `/tests/transform-page-point/drag` and `/tests/transform-page-point/pan`, link both from the test index, and add an e2e file for each. Both pages expose ready state, local x/y, callback payloads, and stable test IDs. Use object-style APIs, Svelte 5 runes, and `touch-action: none`; no production-only instrumentation.

Drag page: scaled board with presets 50%, 100%, 200%, and nonuniform scale; selectable numeric/ref bounds, momentum, and a controls-start handle. Keep changes to zoom outside a gesture unless Step 2 proved the live case. Have a layout-slot control reachable while the test holds a pointer, and a ref-resize control. Test physical card-center displacement against pointer displacement while unconstrained (within 2 px after frame/poll readiness), authored local movement, visual containment at both edges, second drag, snap-to-cursor, and scrolled-start cases. With `dragElastic=0`, box edges may differ by at most 2 screen px. Release tests poll eventual settling rather than demanding monotonic return.

Pan page: a pan-only surface renders corrected offset into a follower and shows point/delta/velocity. Include nested config override/reset and a separate identity case. Tests verify local movement, inherited versus overridden mappings, reactivity between gestures, cancel/end cleanup, and the contract's scroll cases. Execute every integration case marked pending in Step 2, recording numerical outcomes; specifically test nonzero page scroll before snap-to-cursor, page and ancestor scrolling during a held pan, and a stable callback reading changing scale. If those cases require a projection implementation change or upstream semantic divergence, STOP with evidence and request a separate bounded decision rather than declaring parity. Do not coattach pan and drag; the container intentionally gives drag precedence.

**Verify:** the targeted browser command in the command table passes, followed by `pnpm exec playwright test --reporter=line` for the existing drag/reorder/layout/pan regressions and full suite. Use the in-app Browser skill for visual review when available and leave the chosen page open if the operator requests it. If a full e2e run fails, follow repository policy: inspect one page, explain expected/asserted/visible behavior, and obtain the operator's behavior-versus-test decision before modifying it or advancing to the next failure.

### Step 7: Publish docs and the reusable demo locally

Add the public feature doc route, extend the MotionConfig reference, and add the example route and reusable `Default.svelte`. The demo is a compact zoomed-board interaction with a draggable tile, visible zoom presets, and measured bounds; user-facing copy describes dragging/zoom, not internal coordinate pipelines. Use `docs/src/lib/examples/drag-constraints/demos/Default.svelte` as the style exemplar (existing `--brut-*` tokens), and its example route's `ExampleV2`, `CodeReferenceV2`, `demoCodeSample`, and SEO/breadcrumb pattern. Keep the code sample self-contained.

Document the callback's actual domains and function-capture semantics from `coordinate-contract.md`, identity reset, corrected velocity units, numeric versus ref bounds, and tested limitations. Link to the upstream config reference without claiming automatic transform helpers are exported here.

Add docs navigation and example metadata. Run the existing catalog sync (`pnpm --filter docs examples-catalog:sync`), inspect generated changes, and retain only feature-related metadata. The SEO policy currently asserts 66 detail pages; derive the actual new total (normally 67), do not blindly increment a stale constant. Docs Vite plugins generate Markdown mirrors from source; do not hand-edit generated mirrors instead of the source pages. In README, update only directly related parity/config claims, including acknowledging the already-shipped reducedMotion/skipAnimations support. Leave unrelated stale counts/gaps to another task.

Add a minor changeset describing the optional API; no version bump. The nightly intel process owns its state file, so do not edit it.

**Verify:** root package build, docs check/build and metadata tests pass or demonstrate a pre-existing blocker with unchanged baseline evidence. Confirm the new doc and example routes and generated mirrors exist, and all displayed imports resolve from the public package.

### Step 8: Run final gates and review scope

Run root check, full unit suite, full Playwright suite, package build/validation, docs gates, then Trunk formatting/lint and diff hygiene. Formatting that changes relevant source requires rerunning affected gates. Preserve pre-existing unrelated working changes. Record exact commands/results and any blocked checks in `coordinate-contract.md` and the batch index; do not mark DONE with unresolved required behavior.

**Verify:** every Done criterion below holds and the final diff contains only Scope paths.

## Test plan / done criteria

The feature extends existing drag/pan behavior, so red-first is required. No failing reproduction was executed during this planning audit; Step 1 specifies the expected failure and must prove it before implementation.

- [ ] Step 1 demonstrated expected 40/received 20 before implementation, then passed.
- [ ] `coordinate-contract.md` contains pinned upstream references and numerical outcomes for the measurement probes and all initially pending integration cases; no unresolved supported-case mismatch.
- [ ] Public callback and MotionConfig types compile, context inheritance/identity reset work, and the VisualElement receives the callback.
- [ ] Drag history, callbacks, ref measurements, snap-to-cursor and inertia share corrected units; numeric bounds remain unchanged.
- [ ] Pan start/move/end/cancel, threshold, velocity and agreed scroll cases pass; callback updates never detach an active session.
- [ ] Both new demo routes have passing e2e files and links from the test index.
- [ ] Root check, full unit tests, full e2e, package validation, docs gates, `trunk fmt`, `trunk check`, and `git diff --check` meet the command-table expectations. Baseline blockers are reported, not relabeled as success.
- [ ] New public docs, example page, reusable demo, metadata, mirrors and minor changeset exist.
- [ ] Existing no-config drag/pan/reorder/layout tests remain green without loosened assertions.
- [ ] Review `git diff --name-only` and `git diff --cached --name-only` against Scope; preserve the unrelated intel edit and exclude it from any commit.
- [ ] Batch README status updated accurately; no push/PR without separate authorization.

## STOP conditions

- The missing API has already landed, or current source disagrees materially with these excerpts.
- The red test cannot reproduce the coordinate mismatch as a runtime assertion.
- The coordinate characterization requires a projection rewrite, undocumented scroll normalization, or a silent change to no-config semantics.
- A callback-reference update changes geometry under an existing session in a different coordinate domain; do not ship mixed units.
- Ref resize, controlled snapping, or slot compensation needs an out-of-scope runtime change.
- SVG/rotated/perspective support or automatic helpers become necessary to satisfy the agreed scale-only examples; report the dependency rather than adding them.
- A required verification fails twice after a reasonable targeted fix, or the full-e2e review workflow needs the operator's decision.
- Baseline docs/build failures prevent verifying changed docs; report exact unchanged-file evidence and request a separate repair plan.

## Maintenance notes

Review future Motion upgrades against both pointer extraction and viewport/page measurement: their names conceal different domains. Preserve the single VisualElement writer and upstream projection ownership. Do not turn a future boundary-velocity change into an arbitrary browser tolerance increase; deterministic release tests and eventual settling serve different purposes. Future automatic CSS/SVG helpers can build on this hook, but need their own matrix/viewBox/scroll contracts and tests. Owned keyed-list exits and the stale clone-exit migration index remain separate work.
