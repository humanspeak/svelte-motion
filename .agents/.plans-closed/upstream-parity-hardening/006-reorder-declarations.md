# Plan 006: Publish complete Reorder declarations and verify consumer inference

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/reorder.ts tests/consumer-vite6/verify.mjs tests/consumer-vite6/verify-types.mjs tests/consumer-vite6/src/reorder-types.ts .changeset/reorder-declaration-output.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: 001-docs-verification.md; 002-ci-triggers.md ensures changed tests trigger CI
- Category: dx / bug
- Audit finding: 03
- Planned at: commit 6f0085ef, 2026-09-24
- State: DONE — declaration repair and repeated-shuffle runtime follow-up verified; user visually approved

## Why this matters

dist/index.d.ts currently re-exports missing dist/reorder.d.ts. With skipLibCheck, TypeScript silently treats Reorder as any, removing consumer validation. Runtime demos and publint alone cannot prove published generic component types work.

## Current state and conventions

src/lib/reorder.ts:22:
~~~ts
export const Reorder = {
    Group,
    Item
} as const
~~~
This inferred object contains Svelte generic component types with a private generated $$IsomorphicComponent name. dist/index.d.ts includes:
~~~ts
export { Reorder } from './reorder';
~~~
dist/reorder.d.ts is absent. A strict consumer with skipLibCheck accepted assigning imported Reorder to a number. A prior closed plan explicitly deferred the same omission; the audit did not rebuild.

Emitted Group.svelte.d.ts has the generic call signature:
~~~ts
<V>(internal: unknown, props: ReturnType<__sveltets_Render<V>['props']> & {}): ReturnType<__sveltets_Render<V>['exports']>;
~~~
ReorderGroupProps<V> has values: V[] and onReorder: (newOrder: V[]) => void; Item accepts value: V. Preserve these relationships.

tests/consumer-vite6/verify.mjs uses node:assert/strict and Vite SSR but currently verifies rendered root/optimized imports only. Its test script is node verify.mjs; CI already invokes pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test after build. Extend that entry point rather than creating an uncalled verifier.

This is @humanspeak/svelte-motion, a Svelte 5 library using motion/motion-dom as its animation engine. Keep upstream public API reuse; do not import private React modules or introduce another animation engine. Match existing TypeScript, single quotes, four-space indentation, Svelte runes, and Google-style JSDoc for public API additions. Trunk is the formatting/lint authority.

## Commands you will need

Run from the repository root unless a command specifies another directory. Use Node 24 and pnpm 11.24.0 from package.json. Check with `node --version` and `pnpm --version`; if the installed pnpm differs, the exact fallback is `npm exec --yes --package=pnpm@11.24.0 -- pnpm <arguments>`. Do not update the lockfile to accommodate a local tool mismatch.

| Purpose | Command | Expected |
| --- | --- | --- |
| Frozen setup, if needed in an isolated checkout | pnpm install --frozen-lockfile | Exit 0, no manifest/lockfile drift |
| Root types | pnpm check | Exit 0, no errors |
| Build package/declarations | pnpm package | Exit 0; inspect declaration diagnostics too |
| Docs types after package build | pnpm --dir docs check | Exit 0 after plan 001 |
| Complete root unit suite | pnpm test:only | All pass |
| Format changed source/config files | trunk fmt <changed in-scope files> | Only intended formatting changes |
| Lint | trunk check | Exit 0 |
| Patch integrity | git diff --check | Exit 0 |
| Artifact consumer typing | node tests/consumer-vite6/verify-types.mjs | Exit 0 after fix |
| Consumer gate | pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test | Runtime/type assertions pass |
| Reorder units | pnpm test:only src/lib/components/Reorder | All pass |
| Reorder browsers | pnpm exec playwright test e2e/reorder --project=chromium | All pass |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/reorder.ts
- tests/consumer-vite6/verify.mjs
- tests/consumer-vite6/verify-types.mjs
- tests/consumer-vite6/src/reorder-types.ts
- .changeset/reorder-declaration-output.md

Out of scope: generated dist edits, component runtime, stripping generics, widening to any/unknown, new dependencies/TypeScript versions, or changing exports. The root TypeScript devDependency is available through existing monorepo module resolution.

## Git workflow

The maintainer explicitly selected the primary checkout on chore/motion-upstream-refresh for all reviewed release work. Execute and commit here; do not create a branch or worktree. Predecessors001–005 are committed and the working tree was clean at0238c52b. Preserve unrelated user edits. The reviewer owns this plan and README updates; include those records with the reviewed source commit.

Use a conventional commit such as "fix(types): emit the public Reorder namespace declaration". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Prove the emitted-artifact failure
Create verify-types.mjs using node:assert/strict and the TypeScript compiler API. Assert dist/reorder.d.ts exists. Compile src/reorder-types.ts as a strict noEmit consumer through the public @humanspeak/svelte-motion export with ESNext/Bundler resolution and skipLibCheck true. Do not alias source or import private components.
In the fixture define IsAny<T> = 0 extends (1 & T) ? true : false and Assert<T extends true>. Assert namespace and both components are not any. Use generic component call signatures with numeric and object values and assert inferred onReorder values. Add @ts-expect-error cases for invalid axis, absent required props, and incompatible callbacks; unused directives must fail the verifier. Never execute component calls at runtime.
**Verify:** node tests/consumer-vite6/verify-types.mjs fails on the missing declaration. Run pnpm package, then rerun the verifier to confirm a fresh artifact still fails for that declaration/type defect.

### Step 2: Give the namespace a nameable exported shape
Annotate Reorder explicitly with readonly Group: typeof Group and readonly Item: typeof Item, retaining imported symbols so declaration emit references exported component defaults instead of expanding private generated interfaces. Keep the runtime object unchanged; do not use a non-generic Component<Props<unknown>>.
**Verify:** pnpm package exits 0 without the Reorder $$IsomorphicComponent diagnostic; test -f dist/reorder.d.ts succeeds; node tests/consumer-vite6/verify-types.mjs passes. Inspect output to confirm component imports remain generic.

### Step 3: Enforce typing in the existing consumer gate
Invoke the verifier from verify.mjs alongside existing SSR assertions. Keep failures fatal. Test contextual inference from values as well as explicitly specialized numeric/object components without unsound casts. Negative cases must fail on invalid props, not missing modules.
**Verify:** pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test passes. In the isolated checkout temporarily remove the emitted declaration or make its namespace any; the verifier must fail. Restore with pnpm package before proceeding; do not commit generated output.

### Step 4: Complete package and regression gates
Add a patch changeset. Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, the consumer command, and the Reorder browser suite. Run trunk fmt on changed source, trunk check, and git diff --check.
**Verify:** all exit 0, fresh declarations exist, and runtime reorder behavior is unchanged.

## Test plan

Anchor at the package boundary. Verify declaration existence, namespace/Group/Item non-any, numeric/object generic inference, and negative props with active @ts-expect-error directives. Keep skipLibCheck true for the leak regression; also report diagnostics with it false when feasible without hiding unrelated baseline failures. Existing SSR and Reorder suites protect runtime stability.

## Done criteria

- [x] Fresh package output includes dist/reorder.d.ts with no private-type emit errors.
- [x] Public import tests reject invalid props and preserve generic callback values.
- [x] Existing CI's consumer invocation runs the verifier and fails on missing/any declarations.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The typeof annotation still cannot emit, generic inference is lost, or repair requires changing generated components/public Reorder props. Report compiler diagnostics before widening scope.

## Maintenance notes

Svelte upgrades can change generated declaration shapes; retain the package-boundary check. Runtime imports and publint are necessary but insufficient evidence for generic export typing.


## Execution reconciliation — 2026-09-25

Preflight at 0238c52b on chore/motion-upstream-refresh: plan dependencies001/002 are DONE, no in-scope drift from6f0085ef, runtime dist/reorder.js exists but dist/reorder.d.ts is absent after the recent normal005 package build. Group's emitted declaration still retains its generic call signature and private $$IsomorphicComponent interface, exactly as audited. This is a Svelte declaration-emit repair: reuse typeof the existing generic components, with no React/private import or runtime change.

Use pinned Node24.18.0 and pnpm11.24.0 for commands and normal hooks: npm exec --yes --package=node@24.18.0 --package=pnpm@11.24.0 -- pnpm ... . Consumer workspace packageManager metadata differs; do not change it or the lockfile to work around the local environment. Resolve any command-wrapper mismatch without bypassing verification. Existing warm docs generated inputs are available; run docs check after package and only regenerate docs if missing prerequisite evidence requires it.

Port5205 currently serves primary .svelte-kit/output (reviewer session66972). Package generation alone does not replace app assets, but a root app build does: notify reviewer before any pnpm build/vite build so the owned preview can be stopped first. Once the final app build is frozen, reviewer restarts5205 and runs targeted Reorder browser checks with an ignored config pointing at that verified output, then opens /tests/reorder/basic. Preserve unrelated servers/archival worktrees. Existing runtime demo coverage is sufficient for this type-only fix; no new demo, docs, or component behavior is in scope.

## Review outcome — APPROVE

Execution base: 0238c52b on chore/motion-upstream-refresh, primary checkout. Five approved source/test/changeset paths plus this plan and batch README. The only library change is the explicit readonly namespace annotation referencing typeof the existing generic Group and Item components. Fresh dist/reorder.d.ts imports both generated component defaults, preserving their generics. Runtime dist/reorder.js is byte-identical before and after (SHA256 d1f3b5046f0bbee98fb343637a58be51d8c14d210a27c2e203234cdbcdd1c5ac). No runtime, public prop, dependency, manifest, lockfile, generated-source, docs-page, or example changes.

Red evidence: the new verifier failed because dist/reorder.d.ts was absent, both against existing output and after a fresh normal package build. That build exited0 and publint passed despite two cannot-be-named $$IsomorphicComponent diagnostics, showing why the package-boundary test is needed. The existing CI consumer entrypoint now imports the verifier. Both deliberate artifact faults also made that same entrypoint fail: missing declaration hits the existence assertion; Reorder:any trips namespace/member checks, callback inference assertions, and unused negative directives. Only ignored output was changed for these probes and then restored through normal package generation.

Consumer tests use the public @humanspeak/svelte-motion export, resolving to dist/index.d.ts, with strict/noEmit/ESNext/Bundler and skipLibCheck:true. Numeric and object values retain exact callback types with nested-any guards, both through inference and explicit specialization. Invalid axes, required-prop omissions, mismatched item values, and incompatible callbacks are rejected. The fixture never executes its component calls. Existing Vite6 SSR checks remain enforced.

Independent reviewer gates: fresh package/publint exits0 without the Reorder emit diagnostics; public consumer typing plus Vite6 SSR passes; 935 unit tests in82files pass, including49 Reorder tests; all22 Reorder Chromium checks pass in41.3seconds; rootcheck0errors/35existingwarnings; docscheck0errors/13existingwarnings; scopedTrunk fivefiles/noissues and diff integrity pass. Executor production build and corresponding gates pass. Logs: ignored .temp/plan-006/red-{existing,fresh,package}.log, red-{any,missing}-consumer.log, reviewer-{package,consumer,units,browser,check,docs-check,trunk}.log.

Optional dependency-wide check: skipLibCheck:false reports one TS2552 for missing HTMLWebViewElement in framer-motion13.4.4/dist/dom.d.ts:310 with TypeScript6.0.3. An isolated ignored fixture importing only public motion reproduces exactly the same diagnostic, with no svelte-motion import. This is an upstream dependency limitation, not introduced by this annotation. It is recorded rather than suppressed; no global shim or dependency change is included. Evidence: skip-lib-check-false.log and upstream-skip-lib-check-false.log. The required skipLibCheck:true consumer leak regression remains fully enforced.

Visual handoff: frozen primary app output served on port5205 (reviewer session3271); /tests/reorder/basic loaded in collaborative tab_6 and inspected with the initial four-item list. Browser tests verify drag order, axis locking, grids, RTL, scrolling, sibling animations, and pointer continuity. This is a declaration fix, so existing examples provide runtime smoke coverage rather than a new visual feature. Prior preview66972 was already gone before this build; no unrelated server was stopped. Commit all seven scoped source/plan files together using normal hooks on the shared branch; no push, merge, publication, or deployment. Plan007 remains unstarted.

## Visual follow-up investigation — user report

After declaration commit29069bd3, the user reported bad Reorder behavior. Three subsequent frames clarify that it occurs while holding Cucumber and dragging upward: first it remains under the pointer with order lettuce,cucumber,tomato,cheese; at the swap to cucumber,lettuce,tomato,cheese it briefly jumps about one row above the pointer; then it returns under the pointer with the swapped order unchanged. This is a transient cursor-pinning failure at the swap, not normal overlap or a report of incorrect resting spacing. T3 page loads without console errors and settled samples currently show normal spacing; neither disproves the transient. Existing browser checks wait16ms after individual mouse moves and can miss a painted bad frame. Probe upward crossings frame by frame, including repeated/reversed gestures and re-grabbing during an existing sibling animation. Distinguish any separate drag-start offset from this specific swap-time jump.

Declaration fix and its935-unit/22-browser verification remain valid; its runtime JavaScript is unchanged. Do not attribute the runtime report to the type annotation without evidence. Current authorization is reproduction and diagnosis using ignored tests against the existing5205 build, with no runtime source changes before a concrete red case and reconciled follow-up scope. Preserve the user's live tab and server. Plan007 remains unstarted pending this visual review.

Initial isolated upward crossings stayed green across six slow runs,18 speed/cadence combinations, and six1536x960 runs with4x CPU throttling. A bounded native-mouse sequence with seed603 then exposed exact54px held-position spikes in16 of30 gestures, including upward Cucumber crossings; surrounding samples returned near zero drift. Evidence is in ignored .temp/plan-006/paint-seeded.log and paint-seeded-results/. Reduce this sequence and correlate the order change, pointer position, transform, and painted video before selecting a fix. A separately observed approximately11px offset when re-grabbing during a sibling animation is not sufficient proof of the reported one-slot jump and must not substitute for this regression.

## Reconciled runtime follow-up scope

Base29069bd3, same primary checkout and shared branch. The first red neighborhood establishes delayed slot compensation: at3404.5ms Lettuce top266.586/pointer288.586 is pinned; at3422.1ms it swaps upward in the DOM with top206.703/pointer282.703 and drift-54; at3439.2ms the same order is retained and top254.821/pointer276.821 restores pinning. Pointer motion is only5.883px per frame. The transform retained the old slot offset during the bad frame, then gained the missing54px compensation. This is sufficient to authorize a narrow runtime repair following a reduced red regression.

1. Reduce the repeated native-mouse sequence into a deterministic browser regression in e2e/reorder/basic.spec.ts or siblings-flip.spec.ts. Observe intermediate held frames across the DOM swap; final order/settled geometry alone are insufficient. Keep expected pointer drift tight enough to reject a54px slot jump while allowing the measured normal input cadence. Record the failure against unchanged source before implementing.
2. Trace why the layout delta arrives late. In-scope runtime files are src/lib/html/_MotionContainer.svelte, src/lib/utils/layout.ts, and src/lib/utils/motionDomProjection.ts, plus focused existing unit specs if a scheduler/adapter function changes. Preserve the single VisualElement writer, upstream projection didUpdate delta, and drag.adjustOrigin; reuse those mechanisms and fix notification/commit ordering rather than introducing a second animation system or manual Reorder offsets. Do not change Reorder's public API, thresholds, demo geometry, or suppress the visual symptom with CSS. Do not fix the separate re-grab offset unless the same established cause requires it; stop and report if drag.ts or broader architecture changes are needed.
3. Re-run the reduced red and the bounded sequence, then all Reorder browser coverage and directly affected layout/drag coverage. Add a patch changeset, run unit/check/docs-check/package/consumer gates and scoped Trunk checks. Preserve declaration repair evidence. Stop the owned5205 preview before rebuilding the root app; restart only from frozen output, then show the existing basic page for visual review. Include plan records in the eventual normal-hook commit; do not advance007 or publish.

## Runtime follow-up review — fix verified, visual approval pending

The user confirmed repeated shuffling as the trigger. The reduced three-gesture sequence failed three times with an exact54px jump. The permanent regression in e2e/reorder/basic.spec.ts also failed before the fix, including after rounding waypoints and making them relative to the list geometry. It samples intermediate held positions, requires multiple observed orders, and rejects drift above8px for input steps no larger than6px. Red logs: held-red.log, held-rounded-red.log, and paint-reduced.log under .temp/plan-006/.

Root cause: scheduleProjectionCommit's pending-frame guard discarded a fresh slot-change notification when sibling animation had already occupied that frame's throttle. The patch bypasses that guard only for an actively dragged element and reuses the already-pending frame callback. It preserves the existing upstream projection/didUpdate delta and drag.adjustOrigin path. No changes to the inner observer, projection adapter, drag mathematics, public API, examples, or dependency versions were needed. Scope is the container, one browser spec, .changeset/reorder-held-layout.md, and both plan records.

Green: permanent regression passes3/3; original30-gesture sequence loses all former54px spikes (largest within-gesture variation2.875px, BAD[]). Evidence: held-green.log, paint-seeded-green.log, and the green video under paint-seeded-green-results/. Full935 units pass; rootcheck0errors/35baselinewarnings; docscheck0errors/13baselinewarnings; normal build/package/publint and consumer types+SSR pass. Scoped Trunk has no new issues; its one existing eslint/unbound-method warning is at unchanged _MotionContainer.svelte:425. Diff integrity passes. Reviewer read the patch, regression, changeset, red sample neighborhood and video contact sheet; broader browser verification is recorded below when complete.

Owned preview3271 was stopped before rebuilding. Frozen final output is served by session82210 on5205, and T3 tab_6 has been reloaded at /tests/reorder/basic. Temporary user-tab instrumentation and recording were stopped; no user gestures were captured or needed once the automated sequence reproduced the issue. Runtime follow-up remains uncommitted for the requested visual checkpoint. Declaration commit29069bd3 remains complete;007 is still unstarted. Separate mid-animation re-grab offset observations require an upstream comparison before being classified as an additional defect; they are not the54px swap-time issue fixed here.

Independent final browser gate:66 passed,1 existing fixme skipped, exit0 in1.7minutes. Coverage includes all23 Reorder checks, layout/layout-id, element-ref resize, snap-to-origin, and the single-frame spec. The skipped case is the pre-existing tiny-move momentum-fling fixme at e2e/drag/single-frame.spec.ts:20; this patch did not introduce or change it. Command: pinned pnpm exec playwright test --config .temp/plan-005/countdown.config.ts e2e/reorder e2e/layout e2e/drag/element-ref-resize.spec.ts e2e/drag/single-frame.spec.ts e2e/drag/snap-to-origin.spec.ts --project chromium. Log: .temp/plan-006/held-reviewer-browser.log. Final diff has only the five scoped files on chore/motion-upstream-refresh; reviewer approves the implementation, with user visual approval and commit still pending.

Final user review: the maintainer can no longer reproduce the jump and explicitly authorized committing all reviewed changes and moving to007. This closes the visual checkpoint. Commit the five scoped source/test/changeset/plan files together with normal hooks on the shared branch; no push or publication.
