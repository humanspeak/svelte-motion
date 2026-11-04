# Plan 003: Ignore superseded exit promises after re-entry

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.spec.ts src/lib/components/__tests__/AnimatePresenceOwnedChildHarness.svelte .changeset/exit-promise-cycle-guard.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: 001-docs-verification.md for the shared green verification baseline
- Category: bug
- Audit finding: 01
- Planned at: commit 6f0085ef, 2026-09-24
- State: DONE — c0389a83; independently reviewed; user visually approved

## Why this matters

An old exit promise can settle after an element re-enters and starts a second exit. Today the old handler can remove the second exit's DOM early and mark the wrong lifecycle complete. Follow upstream's active-promise guard and protect the Svelte presence adapter's cycle callback.

## Current state and conventions

src/lib/utils/visualElementCore.ts:226:
~~~ts
const exitAnimation = this.node.animationState.setActive('exit', !isPresent)
if (onExitComplete && !isPresent) {
    void exitAnimation.then(() => {
        this.isExitComplete = true
        onExitComplete(this.id)
    })
}
~~~
The class tracks isExitComplete but not the active promise. Re-entry clears isExitComplete without invalidating that handler.

src/lib/html/_MotionContainer.svelte:385:
~~~ts
register: () => () => {},
onExitComplete: () => presenceChildContext.safeToRemove(),
~~~
The arrow reads the wrapper's latest callback when invoked. PresenceChild mints versioned callbacks, but this late lookup defeats its protection.

src/lib/utils/visualElementCore.spec.ts:303 has a mid-exit test whose presence context sets onExitComplete: undefined. Add real completion callbacks and controlled promises using its mountWithExit helper. _MotionContainer.spec.ts uses motion-dom animation mocks that finish synchronously by default; override only the target test's relevant completions and restore them afterward.

Upstream reference: motiondivision/motion commit a47d6f25f, packages/framer-motion/src/motion/features/animation/exit.ts. Its implementation stores exitAnimation, clears it on re-entry, and checks identity before completion. This class is React-private, so adapt that small lifecycle guard into the existing Svelte feature; do not add framer-motion as a dependency.

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
| Exit feature and adapter | pnpm test:only src/lib/utils/visualElementCore.spec.ts src/lib/html/_MotionContainer.spec.ts src/lib/utils/usePresence.spec.ts | All pass |
| Existing presence browser coverage | pnpm exec playwright test e2e/utilities/use-presence.spec.ts e2e/utilities/use-presence-data.spec.ts --project=chromium | All pass |

Fresh root setup: build the package before the root typecheck so consumer fixtures resolve the local package; complete SvelteKit sync before units. Use pinned Node 24.18.0 and pnpm 11.24.0 via npm exec when needed.

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/utils/visualElementCore.ts
- src/lib/utils/visualElementCore.spec.ts
- src/lib/html/_MotionContainer.svelte
- src/lib/html/_MotionContainer.spec.ts
- src/lib/components/__tests__/AnimatePresenceOwnedChildHarness.svelte
- .changeset/exit-promise-cycle-guard.md
- src/routes/tests/use-presence/+page.svelte
- e2e/utilities/use-presence.spec.ts

Out of scope: replacing clone exits, adding a presence registry (plan 007), public API changes, unrelated blockInitialAnimation behavior, and dependency upgrades. Existing initial=false, variants, custom data, and wait-mode behavior must remain intact.

## Git workflow

Use a fresh branch named fix/upstream-exit-promise-guard in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "fix(presence): ignore superseded exit completions". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Reproduce the race with controlled promises
In visualElementCore.spec.ts queue distinct promises A and B for exit activation, retain the existing normal re-entry deactivation behavior, and install a real onExitComplete spy. Drive leave A → reenter → leave B → resolve A. Assert no B completion; resolve B and assert one completion. Also resolve A while present and verify a later re-entry does not spuriously take the completed-exit reset path. Account for mount's existing immediate notification by clearing setup calls before the cycle.
**Verify:** pnpm test:only src/lib/utils/visualElementCore.spec.ts -t 'superseded exit' fails because the stale promise calls completion. Name the new tests with that phrase. If it does not fail for that reason, stop.

### Step 2: Apply the upstream lifecycle guard
Track the current exit promise. Assign it when activating exit, clear it on re-entry, and compare identity inside then before changing isExitComplete or notifying completion. Preserve upstream setActive/resolveVariant/reset/animateChanges behavior. In buildPresenceContext, capture the versioned safeToRemove function at context construction rather than resolving its getter later. Keep fresh isPresent context objects; do not memoize away presence flips. Add an upstream commit comment.
**Verify:** the focused red tests turn green; run the complete visualElementCore.spec.ts suite.

### Step 3: Verify the adapter and public behavior
Use AnimatePresenceOwnedChildHarness plus _MotionContainer.spec.ts to demonstrate that a held real node survives the old completion after re-entry and another exit. Control promise/animation completion without arbitrary sleeps. Assert node identity is retained during cancellation, final removal occurs once, and parent counters remain balanced. Retain existing manual stale-callback and wait-mode tests.
For the requested visual checkpoint, add a focused owned-motion section to the existing `/tests/use-presence` page (already linked from the test index). Use real `AnimatePresence present` child-snippet behavior, visible Show/Hide controls and a replayable rapid hide/show/hide sequence, a deliberately readable exit duration, and clear current phase/completion feedback. Clear sequence timers on teardown/reset and prevent overlapping automatic runs. Explain that the interrupted exit must not remove the second exit early. Extend the existing use-presence browser spec to exercise this section with node identity and eventual completion assertions. The controlled-promise units remain the deterministic race proof; do not claim normal browser timing reproduces every stale-promise ordering. This bugfix needs no new public API/docs page.

**Verify:** the combined focused unit command above passes. Run the two existing presence browser specs; expect no regressions.

### Step 4: Package and document the fix
Add a patch changeset for @humanspeak/svelte-motion describing rapid hide/show/hide safety. Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, trunk fmt on changed source, trunk check, and git diff --check.
**Verify:** all exit 0, and the patch is limited to the guarded lifecycle and its tests. Record browser results as well as units.

## Test plan

The anchor is controlled promise A resolving while B is pending. Cover A resolving while present, repeated re-entry, only B notifying, and the component adapter's DOM retention. Preserve completed-exit replay, initial=false, variant resolution, manual callback idempotence, and wait-mode tests. Do not treat a mocked spy test as sufficient without the component integration.

## Done criteria

- [x] The superseded-exit tests failed before the fix and pass after it.
- [x] Stale completions neither remove live/newly exiting DOM nor mutate current completion state.
- [x] A patch changeset and passing presence browser results are included.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The race only reproduces after replacing real lifecycle code with an unrealistic mock, or fixing it appears to require the descendant registry/public API work reserved for plan 007.

## Execution reconciliation

Fresh origin/main is c8fbd7a8 as of 2026-09-25. No runtime drift; approved plan 001 adds only its wildcard-keyframes test to the in-scope container test file. Integrate the cumulative reviewed branch b0fdb49e (five commits after c8fbd7a8) into the isolated fresh-main branch. Preserve the primary worktree, including its unrelated .competitive-intel/state.json modification and untracked plans. Preserve prior preview on port 5202. Reviewer will own the persistent new preview server.

## Maintenance notes

Keep this guard when updating the adapted upstream feature. Promise cancellation is logical invalidation; do not assume stop() prevents then callbacks. Plan 007 will replace adapter registration, but must preserve this cycle binding.


## Review outcome

Implementation c0389a833d6babc2c73c4542879b2e09684f7c24 approved by independent review. All final gates passed; known baseline diagnostics and the exploratory dev-server browser mismatch are recorded in the batch README. The persistent production preview is http://localhost:5203/tests/use-presence; user eye-test approval was received on 2026-09-25; plan 004 is authorized.
