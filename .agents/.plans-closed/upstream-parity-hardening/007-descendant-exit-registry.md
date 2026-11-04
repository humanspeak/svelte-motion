# Plan 007: Wait for all owned motion descendants before automatic removal

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/components/PresenceChild.svelte src/lib/utils/presence.ts src/lib/utils/presenceExitRegistry.ts src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/usePresence.ts src/lib/utils/usePresence.spec.ts src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.spec.ts src/lib/components/__tests__/OwnedPresenceGroupHarness.svelte src/routes/tests/use-presence/+page.svelte e2e/utilities/use-presence.spec.ts docs/src/routes/docs/use-presence/+page.svx docs/src/lib/examples/use-presence/demos/OwnedGroup.svelte docs/src/routes/examples/use-presence/+page.svelte .changeset/owned-descendant-exits.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: M
- Fix risk: MED
- Confidence: HIGH
- Depends on: 003-exit-promise-guard.md; 001-docs-verification.md
- Category: bug / docs
- Audit finding: 07
- Planned at: commit 6f0085ef, 2026-09-24; reconciled at40ebd396, 2026-09-25
- State: DONE

## Why this matters

An owned AnimatePresence child can contain multiple independently exiting motion descendants. Today every completion removes the whole wrapper, so the fastest exit truncates the rest. Add per-descendant coordination while preserving existing manual wrapper-level removal and cycle cancellation.

## Current state and conventions

src/lib/html/_MotionContainer.svelte:385 now supplies the cycle-bound callback from completed plan003:
~~~ts
register: () => () => {},
onExitComplete: presenceChildContext.safeToRemove,
~~~
Preserve plan003's cycle capture when replacing this adapter with registration/per-id completion. The ExitAnimationFeature promise identity guard in src/lib/utils/visualElementCore.ts is already implemented and must remain intact. Its feature IDs are numeric; installed PresenceContextProps accepts string or number. Derive the registry ID type from that public contract rather than narrowing it to string as in newer React source.

src/lib/components/PresenceChild.svelte:117:
~~~ts
if (currentSafeToRemove !== self || phase !== 'holding') return
phase = 'completed'
currentSafeToRemove = noopSafeToRemove
animatePresence?.notifyExitComplete()
~~~
Its phases are idle/holding/completed/enter-blocked. One accepted safeToRemove completes the wrapper. src/lib/utils/presence.ts:1234 exposes isPresent and safeToRemove. usePresence.ts returns the current versioned callback, and usePresence.spec.ts proves stale manual callbacks cannot complete a later cycle.

AnimatePresence.svelte renders its owned child() inside PresenceChild. _MotionContainer.spec.ts tests only one exiting descendant and mocks animations to finish synchronously by default; add controlled completions.

Upstream's packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx in motiondivision/motion keeps a Map of registered children and completes only when all finish. Reuse that coordination pattern, not React hooks/private imports. Unlike React's automatic zero-child removal, this library's explicit PresenceChild holds manual content until safeToRemove; preserve that established behavior.

docs/src/routes/docs/use-presence/+page.svx:137 incorrectly says nested motion exit props are ignored. Existing tests prove automatic motion removal already exists.

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
| Registry and component coverage | pnpm test:only src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/usePresence.spec.ts src/lib/utils/visualElementCore.spec.ts src/lib/html/_MotionContainer.spec.ts | All pass |
| Presence browser integration | pnpm exec playwright test e2e/utilities/use-presence.spec.ts e2e/utilities/use-presence-data.spec.ts --project=chromium | All pass |
| Docs build | pnpm --dir docs build | Exit 0 |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/components/PresenceChild.svelte
- src/lib/utils/presence.ts
- src/lib/utils/presenceExitRegistry.ts
- src/lib/utils/presenceExitRegistry.spec.ts
- src/lib/utils/usePresence.ts
- src/lib/utils/usePresence.spec.ts
- src/lib/html/_MotionContainer.svelte
- src/lib/html/_MotionContainer.spec.ts
- src/lib/utils/motionDomProjection.ts
- src/lib/utils/motionDomProjection.spec.ts
- src/lib/utils/visualElementCore.ts
- src/lib/utils/visualElementCore.spec.ts
- src/lib/components/__tests__/OwnedPresenceGroupHarness.svelte
- src/routes/tests/use-presence/+page.svelte
- src/routes/tests/_spike-clone-exit/SpikeExitProbe.svelte (existing manual context proxy shape only)
- e2e/utilities/use-presence.spec.ts
- docs/src/routes/docs/use-presence/+page.svx
- docs/src/lib/examples/use-presence/demos/OwnedGroup.svelte
- docs/src/routes/examples/use-presence/+page.svelte
- .changeset/owned-descendant-exits.md

Out of scope: replacing clone exits, adding owned keyed lists, popLayout redesign, changing usePresence's tuple shape, turning manual safeToRemove into a newly registered per-hook barrier, or a new public API. Existing manual examples must work unchanged.

## Git workflow

The maintainer explicitly selected the primary checkout on chore/motion-upstream-refresh for all reviewed release work. Execute here at40ebd396; do not create a branch or worktree. Plans001–006 are completed and committed. Preserve unrelated edits. The reviewer owns plan/index updates; include those records when this implementation is eventually committed after visual review. Do not reset, stash, or overwrite other work.

Use a conventional commit such as "fix(presence): coordinate owned descendant exits". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Reproduce premature subtree removal
Create OwnedPresenceGroupHarness with an owned snippet containing a plain wrapper and two independent motion descendants. Avoid variant orchestration that already aggregates internally. In _MotionContainer.spec.ts control each descendant completion. Hide, complete the fast node, and assert both nodes remain and parent completion is zero; complete the slow node and assert both are removed exactly once.
**Verify:** pnpm test:only src/lib/html/_MotionContainer.spec.ts -t 'owned descendant exits' fails because first completion removes the subtree. Name tests with that phrase. Write this public-component red test before the registry.

### Step 2: Implement a cycle-bound registry
Create internal presenceExitRegistry.ts and focused units. Reuse upstream's registered-id/pending-completion model with explicit cycle invalidation. Registering yields an idempotent disposer. Beginning exit resets registered participants and captures the versioned wrapper completion. Unknown/unregistered ids and stale cycles no-op. Unregistering the last pending participant during exit must re-evaluate completion. Never finish while any registered participant is pending.
Preserve manual-only holds: an exit starting with no motion participants must not auto-remove simply because the registry is empty. Track whether automatic participants joined the cycle so disposing its last automatic participant cannot leave an exit stuck. Participants mounted during exit become pending until completion/disposal.
**Verify:** pnpm test:only src/lib/utils/presenceExitRegistry.spec.ts passes two-participant, idempotence, unknown-completion, late-registration, disposal, cancellation/re-entry, and empty-manual-hold cases. Match the callback id types used by motion-dom's public presence context; do not cast mismatches away.

### Step 3: Connect the wrapper and adapter
Extend internal PresenceChildContext with registration and cycle-bound completion. Own the registry in PresenceChild; start/reset/invalidate it with existing phase transitions. Automatic completion must call captured safeToRemove, not separately notify the parent. Wire buildPresenceContext.register and onExitComplete to forward feature ids into the registry. Keep fresh presence objects and plan 003's stale-promise guard. Destroy invalidates callbacks and preserves existing exit-count cleanup.
Compatibility contract: manual safeToRemove remains an explicit wrapper-level release and may complete before motion descendants; it is not a per-hook participant. Calling usePresence alone must not silently add a barrier. Automatic completion waits for all registered motion exits. Consumers needing an independent custom hold must use a separate manual PresenceChild boundary; do not promise combined manual-plus-motion waiting in one wrapper.
**Verify:** Step 1 turns green and the combined unit command passes. Add mixed manual/automatic tests for this contract, repeated hide/show/hide, pending descendant removal, nested boundaries, no-exit descendants, and wait-mode parent accounting.

### Step 4: Correct docs and add a reusable visual example
Update use-presence docs/JSDoc to describe all-motion automatic completion and explicit manual release; remove claims that nested exits are ignored or that any hook call guarantees a hold. Keep the existing CSS example.
Add OwnedGroup.svelte as a second reusable demo on /examples/use-presence using existing ExampleV2, demoCodeSample, colors, and reduced-motion conventions. Show fast/slow exits, Hide/Show/Reset, and a completion count. Extend the already-linked /tests/use-presence route with a focused equivalent case; share a component only if the existing import/build boundaries allow it, never import docs-only styling dependencies into core.
**Verify:** pnpm --dir docs check and pnpm --dir docs build exit 0. Add browser coverage to e2e/utilities/use-presence.spec.ts for the new route case: fast completion retains the wrapper, slow completion removes once. The full presence browser command passes.

### Step 5: Complete the gates and visual handoff
Add a patch changeset. Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, trunk fmt on changed source, trunk check, and git diff --check. For requested review open http://localhost:5199/examples/use-presence and http://localhost:4198/tests/use-presence; leave relevant servers/pages available. The visual behavior is that the slower exit finishes smoothly rather than disappearing when its faster sibling finishes.
**Verify:** all gates pass; record unit/browser results and the preserved manual contract.

## Test plan

Anchor in the public component, then test every registry operation. Cover stale promises/callbacks across re-entry, unregister pending/completed descendants, late participants, wrapper destroy, nested boundaries, manual-only hold, explicit manual early release, automatic all-motion completion, and wait-mode single notification. Use controlled promises/frame progression rather than tightly timed sleeps.

## Done criteria

- [x] Independent descendants retain the subtree until all automatic exits complete.
- [x] Re-entry/teardown leave no stuck holds or duplicate parent notifications.
- [x] Manual-only and explicit safeToRemove behavior stay compatible and are documented.
- [x] Reusable docs example and existing test route demonstrate the behavior with browser coverage.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- Aggregation requires changing manual safeToRemove's public meaning, empty manual holds cannot be distinguished from removal of the last automatic participant, or nested boundaries require a broader redesign. Report before expanding scope.

## Maintenance notes

Registry lifecycle and phase transitions must evolve together. Preserve cycle binding in refreshed contexts. The zero-participant rule intentionally differs from React to retain manual PresenceChild; document and test it.

## Execution reconciliation — 2026-09-25

Base40ebd396, clean primary shared checkout after user-approved006 commit. In-scope drift from6f0085ef is the expected003 cycle-bound completion and its owned-motion interrupted-exit demo/tests, plus006's independent drag observer throttle. Preserve both. No registry exists yet; PresenceChild still releases the wrapper on one safeToRemove, and docs still incorrectly claim nested motion exits are ignored. Existing public tests provide controlled-promise and stale-callback patterns in _MotionContainer.spec.ts:748 onward. Local upstream reference is ~/Github/motion/packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx; reuse the registered-id/completion Map pattern, without importing React/private modules. Manual wrapper-level completion remains intentionally compatible with this library.

Use pinned npm exec --yes --package=node@24.18.0 --package=pnpm@11.24.0 -- pnpm ... for all verification and normal hooks; no manifest/lockfile change for tooling. Trunk authority is .trunk/trunk.yaml. Warm generated docs prerequisites exist; normal docs build is still a required gate and must not leave generated registry/catalog drift in the final diff.

Port5205 serves the frozen006 app (owned session82210, verified node99084 at preflight). Notify the reviewer before any root app build so that preview can be stopped first; package-only builds do not replace app assets. Reviewer restarts5205 after the final build and independently runs presence browser coverage using an ignored config against that known build. Preserve unrelated ports. Port5199 was free at preflight; run the docs dev server there after docs build/check to show /examples/use-presence, without using the deploy or build:indexnow scripts.

Extend the existing linked /tests/use-presence route and existing public example page; no extra route or homepage link is needed. Add a clearly labelled group section with Hide, Show, Reset, fast/slow progress or completion states, group-mounted state, and completion count. The slow exit must visibly finish after the fast one; timings and metrics must reflect actual lifecycle callbacks rather than a timer pretending completion. Use browser coverage to assert the fast node has finished while the wrapper/slow node remain, then one final group removal. Keep003's replay and manual CSS/wait examples working. Complete red evidence before implementation, and leave final source uncommitted for the requested visual checkpoint.

### Reconciled prerequisite: preserve injected presence context

The public two-descendant test reproduced premature removal before implementation (.temp/plan-007-red.log). Initial registry integration then exposed an existing ownership violation: MotionDomProjectionAdapter.updateOptions calls visualElement.update(props, null) even for a component-owned injected VisualElement. Source at motionDomProjection.ts:238 and a diagnostic run confirm it clears presence context before ExitAnimationFeature.mount, so registration never occurs (empty registry followed by completions for IDs0/1). The old direct safeToRemove adapter masked this defect because later component updates restored the context.

Scope now includes motionDomProjection.ts and its existing spec for one narrow prerequisite: preserve the injected VisualElement's current presenceContext while updating projection options; retain standalone adapter behavior. Add a failing ownership-contract unit test before changing that call, then verify it and the original public-component red turn green together. Do not re-register features opportunistically or alter projection geometry, drag compensation, or feature lifecycle. This reuses the owner's existing context and upstream registration mechanism. Reviewer independently read the cited updateOptions implementation and existing injected-VisualElement ownership tests before authorizing this expansion.

### Reconciled late-participant lifecycle

The required real-component late-participant test exposed another adapter edge after registration works: a motion child born while its wrapper is already exiting has false in both current and previous presence contexts by the time its feature updates. The equality guard suppresses its initial exit, leaving it registered and pending forever (.temp/plan-007-late-mount.log). Scope includes visualElementCore.ts and its existing spec for this case. Prefer distinguishing the first absent update (no exit promise started yet) from subsequent unchanged-absent updates, reusing the existing animationState.setActive path and promise-identity guard. Preserve upstream's mount completion/registration order and existing re-entry handling; do not invent a present=true context or add a second animation path. Add a controlled-promise feature regression proving one initial exit starts, unchanged updates do not restart it, and completion is delayed until that promise resolves; retain the public-component late participant regression. Report if this narrow guard is insufficient.

Typecheck reconciliation: the existing throwaway SpikeExitProbe re-publishes the internal PresenceChildContext with its own manual completeExit callback. Required registry context fields make that old shape incomplete. Scope includes only adapting that proxy with its existing no-op registration and completeExit callback behavior (already used in its pumpExitFeature); do not rewrite the spike or weaken the production context contract. Root inspected this sole additional context provider. Public animation callback type redesign remains out of scope; demos should accept callback payloads safely at their boundary.


## Implementation review — 2026-09-25

Implemented on `chore/motion-upstream-refresh` after commit `40ebd396`. Reused upstream PresenceChild's registered-ID completion model and existing motion-dom feature/animation paths. The Svelte registry adds explicit exit-cycle invalidation and preserves the existing manual-only hold contract. Source review includes the two prerequisite adapter fixes above; no public API redesign, dependency, manifest, or lockfile change.

Red evidence: the public multiple-descendant regression reproduced premature removal; injected projection context was null before its ownership fix; a descendant mounted absent never started its exit before the narrow first-update guard. Logs: `.temp/plan-007-red.log`, `plan-007-adapter-red.log`, and `plan-007-late-feature-red.log`. The controlled late-mount regression now uses the real feature mount path with a gated animation promise.

Green so far: 954 units in 83 files (`.temp/plan-007-units-final.log`); 42 registry/component tests after type-only lint cleanup; package/publint and published Reorder consumer types/SSR; root and normal docs production builds; docs check with 0 errors/13 existing warnings; scoped Trunk over 19 source files with no new issues (one existing `_MotionContainer.svelte` unbound-method warning). Root production build exit 0 was independently retrieved. The normal docs build completed with adapter-cloudflare success; its unrelated generated `docs/static/r/animated-tabs.json` drift was restored to the clean baseline.

Visual check in T3 confirmed fast finished / slow exiting / wrapper mounted / completion count 0, then both finished / wrapper removed / count 1. Reset restored the demo. The frozen progress readout was reproduced by a browser assertion (0% despite actual x ≈35 px), then corrected in both demos with the existing public useMotionValue API. A real docs browser run confirms 37% with actual x ≈37.08 px. No core callback API expansion was needed. T3 then explicitly reported its browser automation host disconnected; local servers remain available, and remaining browser verification may use its requested headless fallback. Final browser results are recorded below; maintainer visual approval remains pending.


### Demo metrics correction and browser verification

Component-level `onUpdate` is not forwarded by the existing `buildMotionNodeProps`; the original demo therefore reported 0% until final completion. Both demos now bind x through public `useMotionValue(0)` values and derive progress from reactive `.current`, using the same underlying Motion animation. Completion callbacks provide the final state, including instant reduced-motion exits; Reset jumps the values to zero. The regression asserts a value strictly between 0 and 100 while the slow exit is running after the fast exit finished. Both root and docs pages reproduced red; independent docs browser validation of the final MotionValue version passed with 37% matching computed translation ≈37.08 px (`.temp/plan-007-motionvalue-browser.log`). General component `onUpdate` forwarding is a separate follow-up, outside this exit-registry scope. No unsupported transition callbacks, type casts, or timer-based progress are included.

Independent Chromium matrix: 131 passed; the sole red was the newly added progress assertion intentionally exercised against the prior frozen production demo. No other presence, layout, layoutId, or Reorder failure occurred. Command: pinned `pnpm exec playwright test --config .temp/plan-005/countdown.config.ts e2e/utilities/use-presence.spec.ts e2e/utilities/use-presence-data.spec.ts e2e/animate-presence e2e/layout e2e/layout-id e2e/reorder --project chromium`; log `.temp/plan-007-browser.log`. Final MotionValue root app rebuild completed with exit 0 (`.temp/plan-007-root-build-motionvalue.log`); all 8 use-presence browser checks pass against that build (`.temp/plan-007-browser-motionvalue.log`, 23.6 seconds). Unchanged core tests need no repeat after demo-only progress wiring and the explicit test receiver type annotation.


Final type gates pass after the explicit test receiver annotation and public MotionValue demo wiring: root 0 errors/35 baseline warnings and docs 0 errors/13 baseline warnings (`.temp/plan-007-progress/root-check-final.log`, `docs-check-final.log`). Final package/publint remains clean (`.temp/plan-007-package-final.log`), and the published consumer types/SSR gate passed (`.temp/plan-007-consumer.log`). Production preview now runs on port 5205 from the final MotionValue app build. Documentation dev server remains on port 5199. Final normal docs build completed with exit 0 (2m 23s, `.temp/plan-007-progress/docs-build-final.log`). Final scoped Trunk checks all 19 source/test/docs/changeset files with no new issues and one existing warning (`.temp/plan-007-progress/trunk-final.log`). Generated animated-tabs drift was restored after the build. Final `git diff --check` passes; status contains only the intended 19 files plus the two plan records. Maintainer visual approval remains pending.


### Review handoff

Implementation is verified and ready for the maintainer's visual checkpoint. Open http://localhost:5199/examples/use-presence (FIG-002, “wait for every exit”) or http://localhost:5205/tests/use-presence (Owned group section). Click Hide group: Fast finishes at 0.6 seconds while Slow continues to 2.4 seconds; the wrapper stays mounted and the completion count remains zero until Slow finishes. Both nodes are then removed together and the count increases once. Show during exit cancels that cycle; Reset restores the initial state/count. Progress reflects actual reactive MotionValues. Root screenshot: `.temp/plan-007-root-ready.png`; docs screenshot: `.temp/plan-007-progress/docs-fig002-reset.png` (visual layout unchanged by final MotionValue wiring).

Servers are left running: root production preview on 5205 (owned session 41947) and docs dev on 5199 (owned session 32350). The T3 host disconnected during review, so no claim is made that the final docs tab is currently visible; links remain available. Plan stays IN PROGRESS until visual approval/commit; no push, merge, or deployment. Plan 008 is unstarted.


### Visual review follow-up: completed fast exit does not restore on Show

The maintainer reports Fast can remain faded and translated while the UI says ready/mounted and Slow has restored. Approval is withheld; 007 remains uncommitted. Explicit request: start with a red test. Extend the actual browser route regression to wait for Fast's exit completion while Slow still exits, then Show and assert computed opacity and transform of both same real nodes return to visible targets. Labels alone are insufficient. Run and record the red against the frozen production build before changing runtime code.

Read-only comparison identifies a candidate missed upstream step: current upstream `packages/framer-motion/src/motion/features/animation/exit.ts` clears `node.blockInitialAnimation` before resetting/replaying a completed exit on re-entry; local `ExitAnimationFeature` omits this. Motion's `animateChanges` suppresses reset animations when that flag remains true. The local key-change re-entry path already performs the upstream clearing. Validate with the red and a focused feature unit before reusing the upstream line; do not patch demo values or remount the cards to conceal a lifecycle failure. Existing scoped files `visualElementCore.ts`, its spec, and use-presence e2e are sufficient if this hypothesis holds.


The new real-browser test is RED before runtime edits (`.temp/plan-007-reentry-red.log`): after Show and a 5-second eventual-style assertion, Fast remains at opacity 0.15 / x 100; Slow reaches opacity 1 / x 0. Both original DOM handles are retained. This exactly matches the maintainer's screenshot, so the test is not tightened around a transient frame. Approved narrow reuse of upstream's `blockInitialAnimation = false` before reset/replay, with a feature unit verifying ordering and the browser regression verifying actual paint. No demo remount/value-reset workaround.


The feature unit also reproduced red before the fix: the first reset callback observed `blockInitialAnimation === true` (`.temp/plan-007-reentry-unit-red.log`, 42 pass/1 fail). The implementation now reuses upstream's flag clear directly before resetting/replaying animation. Post-fix gates: 85 scoped units pass; root check 0 errors/35 existing warnings; package/publint clean; scoped Trunk over four changed files has no issues; app build exit 0. Logs: `.temp/plan-007-reentry-{units-green,check,package,trunk,build}.log`.

The docs example passes the same real-paint regression across two cancellation cycles, retaining original nodes and allowing a later normal removal (`.temp/plan-007-reentry-docs.log`). Native T3 connection was recovered via a new tab (`tab_d`); independent Hide → Fast finished/Slow exiting → Show returned both original cards to computed opacity 1 / x 0. Reset left the page ready. Its viewport is automation-capable but reports visible=false even after open/show, so do not claim the inline preview is visibly open.

A 22-check related production-browser run passed 21; the new regression initially sampled element handles before the onMount-gated cards existed. Add an awaited count=2 before capturing original identities; retain the exact identity and eventual-paint assertions. This setup synchronization does not change the prior decisive red paint failure. Repeat the new regression after this correction; no runtime rebuild is needed for test-only setup changes.


Final follow-up result: new production regression passes 3/3 (36.3 seconds) after the awaited mount precondition, including six cancellation/re-entry cycles in total plus one final removal per run. Log `.temp/plan-007-reentry-browser-repeat.log`; command: pinned `pnpm exec playwright test --config .temp/plan-005/countdown.config.ts e2e/utilities/use-presence.spec.ts --grep 'restores both retained cards' --repeat-each 3 --project chromium --output .temp/plan-007-reentry-repeat-results`. The other 21 related presence/key-change/wait/owned-node checks passed unchanged in the preceding run. Test-only formatter/Trunk and final diff check pass. Together with the native T3 computed-style check and docs regression, this verifies the reported completed-fast-exit re-entry failure is fixed. No assertions were weakened; the test checks actual visual output and original node identity.

Final root production server is port 5205 (owned session 32787), rebuilt with the upstream fix; docs dev remains on 5199. T3 tab_d is loaded at the test page and Reset to ready. Existing older preview tabs need refresh to load the corrected production assets. Both plan records and patch changeset include this follow-up. All 007 source remains uncommitted pending renewed visual approval.


### Maintainer approval and commit — 2026-09-25

The maintainer visually approved the repaired behavior and explicitly authorized committing 007 and moving to 008. They confirmed the current demo after discussion that Show resets exit-progress readouts immediately while the cards animate back, and Reset intentionally snaps everything to the initial state. No additional progress-return behavior was requested for this approved commit. Source, docs, tests, patch changeset, and both plan records are committed together on `chore/motion-upstream-refresh` with subject `fix(presence): wait for all owned descendant exits` (the containing commit is this plan's implementation record). Full red/green evidence and remaining release-wide gates are recorded above and in the index; no push or release action is included.
