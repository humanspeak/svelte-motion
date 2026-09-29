# Plan 001: Pin the latest key at wait-mode exit completion

> **Executor instructions:** Follow the ordered steps and boundaries. The conductor maintains the index and commits your changes; never edit `.agents/**` or commit. This is characterization, not an assumed bug fix. Report unexpected runtime failures with their evidence before changing library implementation.
>
> **Drift check:** `git diff --stat 07a1b1ae..HEAD -- src/routes/tests/animate-presence/wait-exit-key-change src/routes/+page.svelte e2e/animate-presence/wait-exit-key-change.spec.ts`. Compare any changes with the facts below before proceeding.

## Status

- Priority: P2
- Effort: S–M
- Risk: LOW for coverage; a runtime fix requires a separate decision
- Depends on: none
- Category: tests
- Planned at: commit `07a1b1ae`, 2026-09-29

## Why this matters

Motion 13.4.6 adds a concrete non-React-concurrent regression: key 0 starts exiting toward key 1, then completion of exit 0 changes the requested key to 2. Only child 2 must remain, fully visible. Our existing tests cover sync/popLayout additions and ordinary key changes, but not this wait-mode completion boundary. Establish the actual Svelte behavior before updating dependencies; green characterization is a valid outcome.

## Current state and conventions

- `src/lib/components/AnimatePresence.svelte:90` renders current Svelte children directly, or a retained `PresenceChild` when supplied `present` and a named `child` snippet. It has no React `pendingPresentChildren` array; do not copy upstream's state fix.
- `src/lib/utils/presence.ts:987` completes clone exits in this order:

```ts
inFlightExits -= 1
if (inFlightExits === 0) {
    context.forceRender?.()
    context.onExitComplete?.()
    if (mode === 'wait' && enterBlocked) {
        enterBlocked = false
        notifyEnterUnblocked()
    }
}
```

- `_MotionContainer.svelte:2067` subscribes to `onEnterUnblocked`, reveals its waiting element, then schedules animation and ready-state work via RAF. The animation-before-ready order prevents duplicate enter/pop; leave it intact.
- Clone exits animate detached copies and do not forward the original element's `onAnimationComplete`. Use aggregate `AnimatePresence.onExitComplete` for the legacy keyed-clone scenario; label this adaptation honestly. Do not pretend this is the exact React callback implementation or add callback forwarding here.
- `e2e/animate-presence/add-during-exit.spec.ts:15` contains `const MODES = ['sync', 'popLayout'] as const`. Its companion route uses state, a one-shot completion flag, and explicit `#state`/child IDs. Follow that style.
- `src/routes/tests/animate-presence/key-change/+page.svelte:22` uses default sync mode. Its rapid key test therefore does not cover wait.
- Test links live in the AnimatePresence list around `src/routes/+page.svelte:676`, using `resolve('/tests/...') + searchParams`.
- Svelte 5 runes, TypeScript, four-space indentation, single-quoted TS strings. Trunk owns formatting/linting. No ADR/product/design document adds a conflicting requirement.

## Scope

Only modify:

- `src/routes/tests/animate-presence/wait-exit-key-change/+page.svelte` (new)
- `e2e/animate-presence/wait-exit-key-change.spec.ts` (new)
- `src/routes/+page.svelte` (one link)

Out of scope: all library source, existing tests, package/lock files, public docs, generated files, changesets, other routes, and plans. This is not a new public feature; no new public API/helper or public docs page is required. Fixture-local handlers are exercised through the browser test; do not manufacture unit tests mirroring UI handlers.

## Commands and environment

Use pnpm 11.24.0. Here the launcher is `/Users/jasonkummerl/.npm/_npx/0c20c093bc303280/node_modules/.bin/pnpm`; prepend that directory to PATH in shell commands. If absent, obtain it with `npm exec --yes --package=pnpm@11.24.0 -- which pnpm`. Never substitute pnpm 12 or rewrite packageManager.

| Purpose | Command | Expected |
| --- | --- | --- |
| Types | `pnpm check` | 0 errors; existing warnings may remain |
| Build/package | `pnpm build` | exit 0, including svelte-package/publint |
| Units | `pnpm test:only` | all pass |
| Focused browsers | `pnpm exec playwright test e2e/animate-presence/wait-exit-key-change.spec.ts --project=chromium --reporter=list` | all new cases pass |
| Repeat coverage | same focused command plus `--repeat-each=3` | all repeats pass |
| Neighbor browsers | `pnpm exec playwright test e2e/animate-presence/add-during-exit.spec.ts e2e/animate-presence/key-change.spec.ts e2e/animate-presence/wait-reset-label-pop.spec.ts e2e/animate-presence/enter-handoff-label-pop.spec.ts --project=chromium --reporter=list` | all pass |
| Format (executor) | `trunk fmt <three scoped files>` | clean scoped formatting |
| Lint | `trunk check <three scoped files>` | no new diagnostics |
| Integrity | `git diff --check` | exit 0 |

Playwright's root config builds and launches production preview on 4198, with one Chromium worker. Do not set PW_REUSE_SERVER against a stale build, kill unrelated servers, or change config. Report an occupied port to the conductor. Installed Vitest can also run as `node node_modules/vitest/vitest.mjs run ...`; this is a verified fallback, not a reason to skip tests.

## Git workflow

Work on `chore/motion-13.4.6`; no branch switch, worktree, commit, push, or PR by executor. Conductor commits via the commit skill and verifies the immutable snapshot. Suggested source commit: `test: cover wait-mode key changes at exit completion`.

## Steps

### 1. Add the deterministic completion fixture and regression tests

Create one guided demo route with `AnimatePresence mode="wait" initial={false}` around one keyed child, an initial requested key 0, and a Run button requesting 1. Arm a one-shot aggregate `onExitComplete` handler so completion of exit 0 requests 2. Do not use a guessed-duration timer to trigger 2. Capture observable event/state evidence that key 1 was requested before the callback and key 2 was requested inside the callback. Use a visible duration (roughly 0.25–0.4s) and opacity enter/exit targets.

Provide object and variant animation forms (query parameter or two clearly separate scenarios on the same page) to exercise both supported wait-enter paths. Use independent fresh navigations in tests. Include Reset that cancels the armed callback and resets the scenario cleanly (a keyed boundary reset is acceptable). Text must explain what to click and that key 1 is superseded at exit completion; show requested key and callback count.

At least two tests, one per animation form, must establish: initial child 0 visible; child 1 actually requested while 0 exits; completion callback requests 2 exactly once for the armed run; final exactly one non-clone scenario child, key 2, visible with opacity near 1; no `[data-clone="true"]`, `[data-presence-placeholder="true"]`, or `[data-presence-wait-hidden="true"]` remnants in the scenario; state remains settled across additional frames. Scope selectors so clones with duplicated IDs do not make intermediate assertions ambiguous. Add a repeat/reset test if Reset is present.

Use retrying locator/expect.poll assertions for convergence, then observe additional RAF frames for late disappearance/resurrection. Do not assert that child 1 never has a DOM node: the clone architecture may mount it hidden, and this plan targets final-state preservation. Avoid fixed sleeps as the race trigger and do not require React startTransition APIs.

**Verify:** focused browser command → expected green on existing runtime. If it fails due to fixture/test setup, correct only scoped files. If it demonstrates a real library failure, STOP with the failing assertion and mechanism; do not broaden scope or weaken the final-state contract.

### 2. Link and verify the characterization

Add the route to the root AnimatePresence test list using the existing resolve/searchParams pattern. Run repeat coverage and neighbor browsers. Describe any adaptation from upstream explicitly in the test's header.

**Verify:** `rg -n 'wait-exit-key-change' src/routes/+page.svelte e2e/animate-presence/wait-exit-key-change.spec.ts` → link/test URL present; repeat and neighbor commands → all pass.

### 3. Run final local gates and hand off

Run scoped Trunk format/check, `pnpm build`, `pnpm check`, `pnpm test:only`, and diff integrity. Do not run the full browser suite for this coverage-only step; the focused and neighboring suites are the relevant gates. Return a concise report with files changed, exact counts, limitations, and confirmation runtime stayed unchanged. The conductor reproduces these checks, snapshots and records the verdict.

**Verify:** commands above → exit 0; `git diff --name-only` plus untracked-file listing contains only the three authorized files (conductor plan files excepted).

## Test plan and red-first exception

This plan changes no runtime behavior and the audit found no reproducible local bug, so a failing baseline test is neither promised nor required. The test is a characterization of the new upstream scenario. Do not manufacture a runtime defect to obtain red. If actual runtime behavior fails, retain the honest failing test and stop for diagnosis. Unit baseline was 83 presence-related tests green on `07a1b1ae`; full unit suite is required for final verification.

## Done criteria

- [ ] New route and root link exist; tests cover object and variant completion-driven 0→1→2 plus reset behavior.
- [ ] Focused Chromium tests pass three repeats, proving final key 2, full visibility, cleanup and stability.
- [ ] Neighbor browser command passes unchanged tests.
- [ ] `pnpm build`, `pnpm check`, and `pnpm test:only` pass.
- [ ] Scoped `trunk check` and `git diff --check` pass; executor ran scoped `trunk fmt`.
- [ ] No source changes outside the three scoped files; library runtime and dependency versions unchanged.
- [ ] Conductor records independent evidence and updates README status.

## STOP conditions

- Genuine runtime defect, unexpected scope drift, or an out-of-scope file needed.
- Completion is not exercised (e.g. handler fires at mount or a guessed timer instead of exit completion).
- A verification failure persists twice after a reasonable fixture correction.
- Do not interpret environment failure as proof of a runtime bug; report exact tool limitation.

## Maintenance notes

If legacy clone exits become retained-node exits, keep this final-state contract and update the completion trigger to the appropriate outgoing-node callback. Future changes to wait unblocking, animation dedup or clone cleanup should run this spec. Do not add React-specific scheduling shims to the Svelte fixture.
