# Plan 001: Add MotionConfig coordinate correction for drag and pan

> Follow the resumed steps in order. First prepare the public React reference fixtures for guard verification; then implement from the recorded parity evidence. Stop on the conditions below instead of expanding scope. Update this batch's README status when finished.
>
> Revision 2026-09-08: Reference gate verified at `6625550`; all 29 cases repeated with identical semantic traces. Explicit undefined clears the inherited transform in React, correcting the original assumption. Step A is complete; Steps B–D use reference-contract.md and reference-results.json.
>
> Revision 2026-09-08: The user said “Go ahead and $dispatch”, lifting the review pause. Resume from reviewed source snapshot `13ec152`, current plan tip `5248e45`; scoped drift from that tip is empty. React parity and public intended-for-reuse APIs govern. Dispatch reference preparation first, guard runs it, then dispatch implementation. The original red proof remains valid; no dependency or shipped runtime scope expansion.
>
> Revision 2026-09-08: Execute in the isolated `feat/motion-config-transform-page-point` worktree at main `14046a5` (v1.2.0, includes merged PR #480). Compared the complete scoped source diff against `fcf6452`: no runtime/docs anchor drift. Operator prepares dependencies and runs browser verification because the Codex companion sandbox cannot install, launch browsers, write `.agents/**`, or commit. Executor returns coordinate-contract evidence in its report for guard to record; it never edits this plan. All red-first and characterization gates remain mandatory.
>
> Revision 2026-09-08: User approved the controls-test amendment with “Go ahead”. Add only the two affected tests and necessary helpers in e2e/drag/controls.spec.ts; preserve the first movement test, controls demo, all runtime scope boundaries and verification gates. Reviewed baseline is ebcaccc. Guard already verified runtime0da2303 against all29 cases, supplementary controls, full906 units and15 feature e2e. After the test-only dispatch, complete browser verification and open the public scaled-board example.
>
> **Drift check:** `git diff --stat ebcaccc..HEAD -- src/lib/types.ts src/lib/index.ts src/lib/components/MotionConfig.svelte src/lib/components/motionConfig.context.ts src/lib/html/_MotionContainer.svelte src/lib/utils/drag.ts src/lib/utils/pan.ts src/lib/utils/motionDomProjection.ts docs/src/routes/docs/motion-config docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts`
> Also compare existing test/docs exemplars below before editing them. New paths in Scope must not already contain an independent implementation. A changed file is a prompt to compare, not permission to overwrite it.

> Revision 2026-09-08: User explicitly approved proposed-reorder-test-amendment.md. Add only src/lib/components/Reorder/reorder.component.spec.ts for the five gesture tests: valid primary pointer metadata, controlled Motion frame advancement and terminal cleanup, retaining all behavioral assertions and gates. No production Reorder scope expansion. Planned baseline is reviewed snapshot 06ae8a4; in-flight fix-round source changes remain executor work to be reviewed, not independent drift.

## Governing revision — 2026-09-08

User direction: “I dont want to reuse if its not marked for reuse, we need to match react exactly”.

This revision supersedes conflicting behavior requirements below and the unapproved [proposed amendment](proposed-amendment.md). The user subsequently authorized dispatch. Resume through the reference gate below; do not implement unverified semantic choices.

- Match observable behavior through the public React Motion 13.2.0 components for the scoped pan/drag cases. Do not substitute mathematically preferred scroll, snap, history, velocity, or callback-capture behavior, even when upstream behavior appears surprising.
- Reuse only APIs intended for public reuse. `PanSession` is marked `@internal` and is not a public package export. Do not deep-import it, patch package exports, extract private classes from feature bundles, or treat this direction as permission to vendor its implementation. Internal source is a behavioral reference; Svelte adapters must use supported public primitives and reproduce React behavior.
- Correct the reference evidence: React `PanGesture` constructs its session with `transformPagePoint` and `contextWindow`, without `element`. Our `attachPan` passes `element`, which enables optional scroll tracking. The guard's direct class probe also passed `element`; it does not establish ordinary React `onPan` behavior. Characterize React drag separately through its actual adapter.
- Before runtime edits, prepare a pinned React reference fixture for guard to run and review using public components, with matching Svelte inputs, DOM geometry, scroll positions, event timing, and config. Keep any reference environment isolated from shipped Svelte dependencies. Record callback sequences, point/delta/offset/velocity, rendered positions, snap, cancellation, config replacement and stable-closure changes. Assert actual scroll and layout preconditions. Private-class probes may supplement this evidence, never replace it.
- Earlier instructions to preserve every existing no-config convention or impose a particular raw-history/scroll policy are not authority to diverge from React. Identify existing mismatches and their compatibility impact explicitly before changing them. The earlier element-wide callback snapshot policy also requires comparison with React's actual adapter lifetimes.
- Keep the current file scope and every verification gate. Do not weaken assertions to accommodate the draft. Revise behavior expectations only from matched React evidence, retaining the previous expectations and rationale in the guard record. Any required scope expansion needs review.

Source snapshot `13ec152` already implements the draft. Baseline excerpts below describe `14046a5` and are historical recon, not a missing-feature STOP trigger. The resumed Steps and Done criteria are current authority. Preserve completed red-first evidence. Five targeted browser failures and remaining verification gates are unresolved.

## Status

- **Priority:** P1 within the remaining parity roadmap; not a release blocker
- **Effort:** L (multi-day, including tests and documentation)
- **Risk:** MED; coordinate mistakes can affect all drag consumers
- **Depends on:** none; PR #480 merged; baseline includes its boundary-release tests
- **Category:** direction / enhancement
- **Confidence:** HIGH that the feature is missing; ranking is product judgment
- **Planned at:** `ebcaccc`, 2026-09-08 (approved controls test-only amendment; original source baseline `14046a5`)
- **Status:** IN PROGRESS — controls test amendment approved; runtime verification complete; browser regression/full gate and requested example walkthrough remain.

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

`onPointerMove` at line 1133 also reads `clientX/clientY`. `computeInfo` uses this history, and release inertia uses its velocity. Transforming only the DOM output or callbacks would leave release physics wrong. Characterize this existing no-config behavior against React; change an in-scope mismatch only with recorded reference evidence, including the cumulative-delta convention.

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
- An omitted prop inherits; an explicit identity function overrides an ancestor. An explicitly supplied undefined child override clears inheritance, as verified through the public React fixture. No new implicit global default. No-config behavior is subject to the same React parity reference.
- Uniform and nonuniform positive CSS parent scales are required. Plain affine translation in the mapping must cancel correctly when calculating deltas. Corrected callbacks and release velocity use corrected units.
- Snapshot the selected callback at pointerdown, matching upstream PanSession; replacing the config function must not tear down the gesture and affects the next gesture. Verify geometry callback lifetime through the actual React adapter before choosing an element-wide capture policy. A callback reading mutable state is a distinct case from replacing its reference; document the outcome of Step 2 before promising live zoom support.
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
- `src/lib/components/Reorder/reorder.component.spec.ts` (user-approved amendment: five gesture tests only; valid primary pointer metadata, deterministic Motion frame advancement and terminal cleanup; preserve numerical/axis/keyed-layout/reorder assertions)
- new `src/routes/tests/transform-page-point/drag/+page.svelte`
- new `src/routes/tests/transform-page-point/pan/+page.svelte`
- `e2e/drag/controls.spec.ts` (approved amendment: two affected controls tests and necessary helpers only; preserve the first imperative-start test and demo route)
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

**Isolated reference fixture scope:** executor may create test-only fixture and runner files under `/tmp/svelte-motion-react-parity-1320/`; guard owns dependency installation there. Use public `motion/react`, React and ReactDOM APIs. No source edits to other repositories, private imports, dependency patches, or references from shipped code to this temporary environment. Return fixture source, exact commands and evidence in the report for guard to preserve in planning artifacts. This is the isolated reference environment already required by the governing revision, not an application dependency change.

**Out of scope:** package versions/lockfiles, application dependencies, workflow changes, projection implementation, animation engines, generated HTML components, Reorder algorithms, AnimatePresence, other MotionConfig options, helper exports mentioned above, `.competitive-intel/state.json`, archived plans. There is a pre-existing uncommitted intel-state change; preserve it. Do not ship edits in PR #480. If production projection changes are necessary, stop and revise the plan rather than expanding the whitelist yourself.

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

## Reference gate result

Guard verified all 29 public React fixtures twice with identical gesture traces; see [reference contract](reference-contract.md) and [numerical results](reference-results.json). Step A is complete. Dispatch Steps B–D from this evidence, then guard runs Step E. No user approval is pending.

## Steps

### Step A: Prepare matched public React fixtures, without runtime changes

Read the current snapshot, guard report and corrected coordinate evidence. Preserve the original regression proof (expected 40, received 20; no-config control passed), measurement probes and five browser failures. Do not repeat the already-fixed red proof as a gate.

Create a small isolated React 13.2.0 browser fixture and runner in the reference scope. Import public `motion/react` and React APIs only. Record exact installed versions. Exercise ordinary `motion.div` pan and drag separately, using a matched DOM structure and controlled event/frame timing. Expose raw callback records and rendered geometry for guard assertions; do not assert desired Svelte behavior as the React answer. A public Motion frame timestamp API, if intended for reuse, or browser clock control can support deterministic velocity observations. Avoid elapsed-wall-time velocity expectations.

Include no-config/identity, positive uniform and nonuniform transforms, affine translation, page scroll at start, actual page and overflow-ancestor scroll while held, callback-reference replacement, stable callback closure changes, thresholds, callback sequence/payloads, cancellation and teardown. Drag fixtures also need numeric/ref bounds, resize/re-grab, controls-start/snap with verified nonzero scroll, and real layout displacement while held. Use representative fixed geometry and event coordinates, and export them so the Svelte comparison uses identical inputs. Explicitly assert scroll, frame readiness and layout preconditions before interpreting results.

Return a reference-preparation report and stop at this checkpoint. Guard installs isolated dependencies, runs the fixture, records results and reviews the matching conditions. This handoff is automatic within dispatch, not a new user permission gate. No production changes before the reference gate passes.

### Step B: Reconcile the Svelte implementation against recorded React behavior

Guard passes the verified reference output into a fresh executor invocation. In existing whitelisted runtime and tests, correct observed mismatches. Use public supported primitives; do not import, export-patch, extract or vendor private PanSession. Reading source is permitted for understanding behavior.

Cover start/move/end/cancel, threshold, delta/offset/velocity, event timing, history retention, callback replacement and handler hot swapping. Match React's actual pan wrapper scroll configuration; do not infer drag behavior from pan. Remove custom history remapping or scroll correction where it diverges from the public reference. The element-wide captured callback policy and drag cumulative-delta convention must be evaluated against the reference, not preserved by assumption. Existing no-config mismatches within scope must be recorded and tested as compatibility changes; stop if resolving them requires out-of-scope files or algorithms.

Wire inherited MotionConfig transformPagePoint through VisualElement and the existing gesture attach/update lifecycle. Preserve the single transform writer and upstream projection ownership. Correct pointer/constraints/snap/inertia behavior only as supported by the reference. Numeric bounds remain authored local values. Never double-correct projection deltas. Do not promise pointer pinning or a mathematically cleaner snap when the corresponding public React case behaves differently; record the actual result and its limit.

Add focused numerical tests for all changed functions, including deterministic pan velocity, and preserve the original red proof. For each remaining defect, show a failing parity assertion before fixing it when supported by the executor environment; guard runs browser red cases. Do not weaken existing assertions merely to pass the draft. A behavior expectation may change only with recorded matching React evidence and an explicit account of the previous expectation.

### Step C: Finish demos and browser integration

Keep the two feature demo routes and index links. Diagnose the five reported failures using actual geometry/scroll/frame preconditions before runtime changes: nonuniform y error 164.73625946044922 px, resize boundary error 7.57611083984375 px, layout shift 30 px, pan-inherit control outside viewport, and page-scroll offset expected 80/received 60. The last expected value is provisional under the React reference. The current layout fixture uses CSS translate; test real layout displacement. The snap test must prove nonzero scroll survives any scrollIntoView call and check both axes.

Run matching React and Svelte scenarios for the Step A matrix. Compare callback sequences and numerical payloads and rendered geometry. Existing physical movement and constraint checks retain the 2-screen-pixel bound for cases in which the React fixture demonstrates it. Do not increase tolerance to conceal a mismatch. Reference-equivalent edge behavior must be documented and asserted explicitly.

Run both targeted browser files, then all regression/full browser gates. For a full e2e failure, follow repository policy: open the related page in the in-app browser, explain intended/asserted/visible behavior, and obtain the user's behavior-versus-test decision before modifying it or advancing to the next failure. Targeted feature failures can be diagnosed and routed through the executor without that full-suite decision gate.

### Step D: Finish documentation and release metadata

Review existing feature docs, MotionConfig reference, reusable example, route metadata, index links and minor changeset against observed React semantics. Document actual callback input domains, capture/lifetime behavior, velocity, identity reset, numeric versus ref bounds and tested limitations. Remove claims that we fix an upstream inconsistency or provide custom raw-scroll/history behavior. Public examples use supported public imports and existing docs component/style conventions.

Run catalog sync and generated mirrors; keep only feature-related changes. Verify actual SEO route count and the root README's scoped parity claims. No version bump or application dependency change. Preserve the known unrelated docs typecheck baseline and report it separately.

### Approved Reorder test follow-up

After the current parity fix checkpoint, dispatch the five Reorder gesture tests in the newly approved test file. Replace immediate post-pointer assertions with deterministic Motion frame sampling and valid primary pointer metadata; preserve all behavioral assertions and terminal cleanup. Reproduce all 14 component tests and the full unit suite. Stop on any required Reorder runtime or further scope change. See proposed-reorder-test-amendment.md for the approved bounds.

### Step E: Guard final verification

Guard snapshots the executor changes through the commit skill, reads the entire contribution diff and checks scope. Reproduce root check, focused/full unit tests, targeted/full browser tests, package validation, docs check/build/metadata, Trunk formatting/lint and diff hygiene using the existing command table. Record exact commands and outcomes in the coordinate contract and guard report. Do not mark DONE with missing parity evidence or unresolved required verification.

## Test plan / done criteria

- [ ] Historical red-first proof is preserved and its regression/control remain green.
- [ ] Pinned public React fixtures and matching Svelte scenarios establish numerical outcomes for the complete reference matrix; no private package reuse or unresolved in-scope behavior mismatch.
- [ ] Public callback/config types compile; inheritance, identity reset and VisualElement propagation match the reference.
- [ ] Drag point/delta/offset/velocity, measurements, numeric/ref bounds, snap, resize/re-grab and layout behavior match the reference, including no-config cases.
- [ ] Pan callback sequence, threshold, point/delta/offset/velocity, history, scroll, handler/config changes, end/cancel and teardown match the reference, including deterministic velocity evidence and no-config cases.
- [ ] Both new demo routes have passing e2e files and links from the test index; actual scroll/layout readiness is asserted.
- [ ] Root check, full units, full e2e, package validation, docs gates, Trunk formatting/lint and diff hygiene meet the command-table expectations; demonstrated baseline blockers are reported separately.
- [ ] Feature docs, reusable demo, metadata, mirrors and minor changeset accurately describe verified behavior.
- [ ] Existing regressions pass without weakened assertions; any intentional in-scope compatibility correction has matched React evidence.
- [ ] Full diff is in scope and excludes the unrelated intel edit; guard artifacts preserve evidence and reports.
- [ ] Batch README status is accurate; no push or PR without authorization.

## STOP conditions

- Independent unreviewed work conflicts with the snapshot or in-scope files materially drift after this resume revision.
- Public React reference cannot be run or its preconditions are not established; report the environment issue for guard, without inventing runtime semantics.
- Matching React requires private package reuse, production projection changes, another out-of-scope file/algorithm, or automatic SVG/rotation/perspective support.
- Required verification fails repeatedly after the bounded fix-dispatch budget, or the full-e2e review workflow needs the user's decision.
- Baseline docs/build problems prevent verifying changed docs; report exact unchanged-file evidence and the necessary separate repair.

## Maintenance notes

Review future Motion upgrades against both pointer extraction and viewport/page measurement: their names conceal different domains. Preserve the single VisualElement writer and upstream projection ownership. Do not turn a future boundary-velocity change into an arbitrary browser tolerance increase; deterministic release tests and eventual settling serve different purposes. Future automatic CSS/SVG helpers can build on this hook, but need their own matrix/viewBox/scroll contracts and tests. Owned keyed-list exits and the stale clone-exit migration index remain separate work.
