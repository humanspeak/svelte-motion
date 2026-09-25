# Plan 001: Restore the docs typecheck and make CI enforce it

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- docs/src/lib/examples/keyframes/demos/Wildcard.svelte docs/src/lib/examples/transform-template/demos/Default.svelte docs/src/routes/examples/keyframes/+page.svelte src/lib/html/_MotionContainer.spec.ts .github/workflows/pr-build.yml .github/workflows/cloudflare-deploy.yml docs/src/lib/server/posthog.ts docs/src/lib/server/posthog.spec.ts docs/src/hooks.server.ts 'docs/src/routes/r/[slug].json/+server.ts'`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: none
- Category: tests / docs
- Audit finding: 04
- Planned at: commit 6f0085ef, 2026-09-24
- State: DONE — reviewer APPROVE, commit9307ece4; user visually approved (Reset snaps; Back animates)

## Why this matters

Copyable examples currently contain five type errors while CI only builds them. Restore a trustworthy docs baseline before adding more release gates. Keep the wildcard example's visible behavior and avoid expanding public API types merely to silence a demo error.

## Current state and conventions

### Execution reconciliation (2026-09-24)

Fresh worktree at 9947bba2 reproduces 77 errors/13 warnings before docs generation: the five original example errors, 71 missing generated-module errors, and one optional PostHog configuration error. This worktree is based on refreshed main c8fbd7a8 plus the three reviewed upgrade commits. Scope is extended narrowly to server analytics optional-config handling and its regression test; no credentials are needed.

The existing docs build runs fetch-github-stats.ts and generate-registry.mjs; docs-kit Vite buildStart emits demo-loaders.ts. Reuse that build before docs checks instead of inventing a second generation pipeline. PR docs checks therefore run AFTER docs build and before the job succeeds. Deployment checks run after a normal docs build and BEFORE the existing deploy command; the existing deploy command may rebuild in IndexNow mode and must not run locally as validation.

docs/src/lib/server/posthog.ts currently constructs PostHog with env.PUBLIC_POSTHOG_PROJECT_TOKEN, which is string | undefined in a clean environment. docs/src/hooks.client.ts already skips initialization if token OR host is absent. Match that optional configuration contract on the server: return null without constructing a client when either is missing; configured calls retain singleton behavior. docs/src/hooks.server.ts handleError currently unconditionally calls posthog.capture; make reporting conditional while preserving its returned message/status. The second production caller is docs/src/routes/r/[slug].json/+server.ts: return early from its existing async telemetry task when the client is absent; preserve item response, cache/CORS headers, KV counting, and configured capture/flush/waitUntil behavior. Do not suppress typing with a dummy token or non-null assertion.


The audit ran svelte-check directly from docs without syncing: five errors, thirteen warnings. Re-run the normal scripts on execution because generated environment types can differ.

docs/src/lib/examples/transform-template/demos/Default.svelte:14,19:
~~~ts
let trackWidth = $state(0)
let state = $state<'start' | 'moving' | 'end'>('start')
~~~
The local state binding conflicts with rune/store interpretation. Rename it consistently to playbackState, including markup and callbacks.

docs/src/lib/examples/keyframes/demos/Wildcard.svelte:36:
~~~ts
{ scale: [null, 1.15, 1], x: null }
~~~
AnimationControlsDefinition uses upstream DOMKeyframesDefinition; bare scalar null is rejected. The existing controls adapter resolves wildcard arrays against live values before calling upstream animateVisualElement. Use the already-supported array form x: [null, null, null], aligned with times [0, 0.4, 1], to hold the sampled x throughout the pulse. Update the copyable explanation in docs/src/routes/examples/keyframes/+page.svelte, which currently advertises bare x: null.

.github/workflows/pr-build.yml builds package and docs but does not run their check scripts. cloudflare-deploy.yml also builds before deployment with no type gate.

Unit convention in src/lib/html/_MotionContainer.spec.ts:
~~~ts
import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
~~~
Execution confirmed that controls.set can update static latestValues without creating a MotionValue in this fixture. Establish x/scale using controls.start, not controls.set, before the pulse; the unchanged x=35 assertion passes through that real-demo setup. Do not weaken the hold assertion or modify engine code.

Its motion-dom animation mock resolves final targets; use that existing harness for the supported wildcard-array characterization, and use browser observation for in-flight behavior.

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
| Focused controls/component coverage | pnpm test:only src/lib/html/_MotionContainer.spec.ts | All pass |
| Docs production build | pnpm --dir docs build | Exit 0; inspect generated changes |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- docs/src/lib/examples/keyframes/demos/Wildcard.svelte
- docs/src/lib/examples/transform-template/demos/Default.svelte
- docs/src/routes/examples/keyframes/+page.svelte
- src/lib/html/_MotionContainer.spec.ts
- .github/workflows/pr-build.yml
- .github/workflows/cloudflare-deploy.yml
- docs/src/lib/server/posthog.ts
- docs/src/lib/server/posthog.spec.ts
- docs/src/hooks.server.ts
- docs/src/routes/r/[slug].json/+server.ts

Out of scope: public animation type widening, motion runtime changes, new features, dependency versions, CI permissions, deployment credentials, and generated registry artifacts. Do not remove tests or cast to any/never to pass the checker.

## Git workflow

Use a fresh branch named fix/upstream-docs-verification in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "fix(docs): restore checked animation examples". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Capture the failing baseline
Run pnpm package and the normal pnpm --dir docs build to generate clean-checkout artifacts, then pnpm --dir docs check. Save the remaining example and optional-config errors. The initial unprepared 77-error result is setup evidence, not 77 independent bugs. This is a type/docs correction, so the existing typecheck is the red gate; no synthetic test that merely mirrors the rename is needed. Add a focused characterization in _MotionContainer.spec.ts using animationControls.start to establish a live x value of 35 (matching the demo Drift/Nudge path): a scale pulse with x: [null, null, null] must retain x=35. Use the existing mounted-controls and latestValuesOf patterns.
**Verify:** pnpm --dir docs check fails with the named errors; pnpm test:only src/lib/html/_MotionContainer.spec.ts passes the supported-array characterization. If arrays do not preserve the sampled value, stop instead of changing engine semantics.

### Step 2: Correct the two examples and explanation
Rename state to playbackState throughout the transform-template demo. Replace the scalar-null x target with the three-entry wildcard array. Update its inline comments and the public keyframes notes to explain first-null=current and later-null=previous keyframe. Preserve start-time sampling, relative nudge, reset, and the scale pulse.
**Verify:** pnpm package && pnpm --dir docs check removes the five example errors; only the known optional PostHog error may remain until Step 3. pnpm test:only src/lib/html/_MotionContainer.spec.ts remains green. Existing warnings must not increase. Until Step 3, the optional PostHog error may remain; record it separately rather than bypassing it.

### Step 3: Make optional server analytics safe without configuration
Before changing server code, add docs/src/lib/server/posthog.spec.ts using the existing docs Vitest server project. Mock $env/dynamic/public with an empty object and posthog-node with constructor/capture/shutdown spies; no real telemetry or tokens. Assert getPostHogClient returns null and never constructs when token or host is absent. This must fail against current code. Also cover configured singleton construction and shutdown without configuration.
**Red verify:** pnpm --dir docs exec vitest run --project=server src/lib/server/posthog.spec.ts fails on construction with absent configuration.
Add an explicit PostHog | null return type and token/host guards matching hooks.client.ts. Make hooks.server.ts conditionally capture only when a client exists, preserving error response data. Guard the registry route caller inside its existing async telemetry task with if (!posthog) return; add Google-style JSDoc to touched GET without changing registry responses or KV counting. Add Google-style JSDoc to touched exported helpers. Do not change configured telemetry payloads or proxy/security-header behavior.
**Green verify:** the focused server test and pnpm --dir docs check pass. Confirm both blank environment and configured mock cases are covered. With the local docs server running without telemetry configuration, curl -i http://127.0.0.1:5202/r/animated-button.json must return HTTP200, registry JSON, and CORS headers. Vite dev overrides cache-control to no-cache; verify production cache headers by exercising the actual handler separately rather than asserting production caching on the dev transport.

### Step 4: Add type gates with correct generation ordering
In pr-build.yml run pnpm check in the root build job after install and before build. In docs-build preserve package build, then docs build (which generates required inputs), then pnpm --dir docs check before job success. In cloudflare-deploy.yml add root check before Build Package, a normal pnpm --dir docs build after the package build, and docs check before the existing Deploy Docs command. Keep the existing deploy script/IndexNow behavior, permissions, environment, and secret handling. No continue-on-error; no local deployment.
**Verify:** trunk check validates YAML and ordered steps show checks before job success/deployment. Re-run the build→check sequence with generated docs inputs initially absent in the isolated checkout to prove it does not depend on the user's caches.

### Step 5: Run gates and inspect the examples
Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, pnpm --dir docs exec vitest run --project=server src/lib/server/posthog.spec.ts, trunk fmt on the changed source/config paths, trunk check, and git diff --check. Run pnpm --dir docs build in the execution checkout; it generates registry assets, so exclude unrelated generated churn from the commit and report any unexpected tracked changes. Start docs with pnpm --dir docs dev --host 127.0.0.1 --port 5202 --strictPort when visual review is requested (5202 is reserved for this execution; leave the user's existing 5199 server untouched). Open /examples/keyframes and /examples/transform-template: drift then pulse must preserve the current position, and transform playback/reset must work.
**Verify:** all commands exit 0; record the two example URLs and observed behavior. Never deploy as verification.

## Test plan

The docs checker is the original red baseline; the added server analytics guard has a focused red-first runtime test. The wildcard-array test characterizes existing supported behavior rather than a new API. Preserve current runtime tests and verify the docs example during an interrupted drift as well as at rest. CI YAML is pure tooling; validate configuration with Trunk and inspect fail-fast ordering rather than inventing a unit test of YAML text.

## Done criteria

- [x] pnpm --dir docs check exits 0; the five known errors are gone without suppressions.
- [x] Clean-checkout docs build→check passes without user caches or telemetry configuration.
- [x] No-config server analytics regression failed before repair and passes afterward; configured singleton behavior is preserved.
- [x] PR checks run before job success, and deployment checks run before publication.
- [x] The wildcard demo and copyable explanation agree, and its focused characterization passes.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The wildcard-array form changes the visible hold behavior, the checker reports additional errors outside these files, or docs verification needs secret values. Report the concrete blocker without printing secrets.

## Maintenance notes

Keep public docs examples compatible with emitted package types. Do not turn future typecheck failures into a permanent exception list. The sixth PostHog error reproduces in a clean execution environment and is now explicitly included. Keep analytics optional for clean contributors/CI; do not add placeholder environment values to hide an error.
