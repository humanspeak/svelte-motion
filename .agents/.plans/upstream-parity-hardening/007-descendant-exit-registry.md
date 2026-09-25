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
- Planned at: commit 6f0085ef, 2026-09-24
- State: TODO

## Why this matters

An owned AnimatePresence child can contain multiple independently exiting motion descendants. Today every completion removes the whole wrapper, so the fastest exit truncates the rest. Add per-descendant coordination while preserving existing manual wrapper-level removal and cycle cancellation.

## Current state and conventions

src/lib/html/_MotionContainer.svelte:385 currently supplies:
~~~ts
register: () => () => {},
onExitComplete: () => presenceChildContext.safeToRemove(),
~~~
Plan 003 will bind completion to its cycle. Preserve that fix when replacing this adapter with registration/per-id completion.

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
- src/lib/components/__tests__/OwnedPresenceGroupHarness.svelte
- src/routes/tests/use-presence/+page.svelte
- e2e/utilities/use-presence.spec.ts
- docs/src/routes/docs/use-presence/+page.svx
- docs/src/lib/examples/use-presence/demos/OwnedGroup.svelte
- docs/src/routes/examples/use-presence/+page.svelte
- .changeset/owned-descendant-exits.md

Out of scope: replacing clone exits, adding owned keyed lists, popLayout redesign, changing usePresence's tuple shape, turning manual safeToRemove into a newly registered per-hook barrier, or a new public API. Existing manual examples must work unchanged.

## Git workflow

Use a fresh branch named fix/upstream-descendant-exit-registry in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

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

- [ ] Independent descendants retain the subtree until all automatic exits complete.
- [ ] Re-entry/teardown leave no stuck holds or duplicate parent notifications.
- [ ] Manual-only and explicit safeToRemove behavior stay compatible and are documented.
- [ ] Reusable docs example and existing test route demonstrate the behavior with browser coverage.
- [ ] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [ ] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [ ] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- Aggregation requires changing manual safeToRemove's public meaning, empty manual holds cannot be distinguished from removal of the last automatic participant, or nested boundaries require a broader redesign. Report before expanding scope.

## Maintenance notes

Registry lifecycle and phase transitions must evolve together. Preserve cycle binding in refreshed contexts. The zero-participant rule intentionally differs from React to retain manual PresenceChild; document and test it.

