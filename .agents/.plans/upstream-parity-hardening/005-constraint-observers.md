# Plan 005: Keep constraint resize observers attached to the live ref

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/utils/drag.ts src/lib/utils/drag.spec.ts src/routes/tests/drag/element-ref-resize/+page.svelte e2e/drag/element-ref-resize.spec.ts .changeset/live-drag-constraint-observer.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: 004-drag-origin-resize.md; serialize changes to drag.ts
- Category: bug
- Audit finding: 06
- Planned at: commit 6f0085ef, 2026-09-24
- State: TODO

## Why this matters

Changing dragConstraints to a different element updates its bounds once but leaves ResizeObserver attached to the original element. Subsequent resizing of the new container can use stale constraints. Also support numeric-to-element transitions without interrupting an active pointer session.

## Current state and conventions

src/lib/utils/drag.ts:456 updates opts and remeasures:
~~~ts
Object.assign(opts, nextOptions)
constraints = resolveConstraints(el, nextOptions.constraints, nextOptions.transformPagePoint)
~~~
Observer ownership is created only once at line 600:
~~~ts
const stopConstraintResizeObserver =
    isDomElement(opts.constraints) && typeof ResizeObserver !== 'undefined'
        ? (() => {
              const observer = new ResizeObserver(() => scalePositionWithinConstraints())
              observer.observe(el)
              observer.observe(opts.constraints)
              return () => observer.disconnect()
          })()
        : null
~~~
Teardown calls stopConstraintResizeObserver at line 1834. _MotionContainer.svelte:1618 updates options in place specifically to preserve live pointer sessions. A probe of actual attachDrag confirmed A→B left observed targets as card and A.

src/lib/utils/drag.spec.ts already tests updateOptions during a pointer session by spreading baseOptions into the next complete options object. Follow that pattern. Plan 004 adds captured ResizeObserver tests and a resting-origin guard; reuse those helpers and preserve those changes. Its diff is expected predecessor drift.

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
| Drag units | pnpm test:only src/lib/utils/drag.spec.ts src/lib/utils/dragInertia.spec.ts | All pass |
| Observer and pointer lifecycle browsers | pnpm exec playwright test e2e/drag/element-ref-resize.spec.ts e2e/drag/axis-handoff.spec.ts e2e/drag/pointer-cancel.spec.ts --project=chromium | All pass |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/utils/drag.ts
- src/lib/utils/drag.spec.ts
- src/routes/tests/drag/element-ref-resize/+page.svelte
- e2e/drag/element-ref-resize.spec.ts
- .changeset/live-drag-constraint-observer.md

Out of scope: replacing attachDrag, recreating PanSession on prop changes, transformPagePoint semantics, a new resize abstraction outside drag, and unrelated projection systems. Extend the same demo route edited by 004.

## Git workflow

Use a fresh branch named fix/upstream-constraint-observers in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "fix(drag): rebind resize observers for live constraints". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Write failing observer lifecycle tests
Add a block named 'live constraint observers' in drag.spec.ts. Attach with ref A, updateOptions to B while the card size stays constant, and assert active observed targets are card+B, not card+A. Add numeric→B and B→numeric cases. Track observe, unobserve/disconnect, and delivery through the actual callback. Assertions may accept disconnect/reobserve or equivalent ownership management.
**Verify:** pnpm test:only src/lib/utils/drag.spec.ts -t 'live constraint observers' fails because B is absent and numeric→B has no observer.

### Step 2: Make observation follow the current constraint identity
Introduce local updateable observer ownership in attachDrag. Synchronize initially and when updateOptions changes ref identity/type. Observe the card and current ref for element constraints; disconnect obsolete observation for numeric/absent constraints. Avoid churn for the same ref. Teardown must invalidate queued deliveries and disconnect the owned observer; queued callbacks from A after replacement or teardown must not write stale state.
Preserve the pointer session, scalePositionWithinConstraints's dragging guard, fresh measurements, constraintsBase synchronization, and plan 004's origin preservation. Initialize helper closures before any invocation that might enter their temporal dead zone.
**Verify:** focused tests turn green; pnpm test:only src/lib/utils/drag.spec.ts src/lib/utils/dragInertia.spec.ts passes.

### Step 3: Verify live replacement in the browser
Extend the existing resize page with an independent case switching numeric bounds and refs A/B, then resizing B alone. Preserve older selectors, add reset and current-target labels. The browser test establishes a nonzero drag offset, replaces A with B, changes only B's CSS size, and polls for containment in fresh bounds. Keep the card size stable so its own observer cannot hide the defect. Exercise ref replacement while pressed and assert the pointer interaction continues.
**Verify:** the observer/pointer browser command above passes. Visual review URL: http://localhost:4198/tests/drag/element-ref-resize.

### Step 4: Run final gates
Add a patch changeset. Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, trunk fmt on changed source, trunk check, and git diff --check.
**Verify:** all exit 0 and plan 004's regressions remain green.

## Test plan

Cover A→B, numeric→B, B→numeric, unchanged-ref updates, teardown, queued old callbacks, SSR/no ResizeObserver, and ref replacement during an active pointer session. At least one behavior test must resize the new element and observe new bounds, beyond mock observe-call counts. Reuse 004's geometry fixtures.

## Done criteria

- [ ] Observation follows the current ref and is absent for numeric constraints.
- [ ] Resizing only the replacement container refreshes bounds without a card resize.
- [ ] Ref replacement preserves active drag; queued callbacks cannot write after teardown.
- [ ] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [ ] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [ ] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- Preserving the gesture requires recreating attachDrag/PanSession, or a test only passes because the draggable itself resizes. Those would evade the defect.

## Maintenance notes

Keep observer identity lifecycle separate from measurement and gesture state. disconnect does not justify assuming queued callbacks cannot run. Future updateOptions fields should be reviewed for similar one-time initialization assumptions.

