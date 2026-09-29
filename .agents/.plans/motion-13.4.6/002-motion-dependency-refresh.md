# Plan 002: Align the tested Motion dependency with 13.4.6

> **Executor instructions:** Follow this plan and report STOP conditions. The conductor owns all commits, index updates and guard records; never edit plans. Run only after plan 001 is DONE. Do not claim the React AnimatePresence fix changes Svelte runtime behavior.
>
> **Drift check:** `git diff --stat 07a1b1ae..HEAD -- package.json pnpm-lock.yaml .changeset/motion-13-4-5.md`. Inspect any drift before proceeding; plan 001 must not change these files.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: 001-wait-exit-key-change.md (reviewed DONE)
- Category: migration
- Planned at: commit `07a1b1ae`, 2026-09-29

## Why this matters

Align our tested dependency floor and lockfile with Motion 13.4.6 after characterizing the relevant Svelte presence behavior. This is release alignment, not an adapter fix. The only net upstream runtime change is the React AnimatePresence implementation; `motion-dom` remains 13.4.5 and `motion-utils` remains 13.3.0. Existing `^13.4.5` already permits consumers to resolve Motion 13.4.6, so keep the change narrow.

## Current state and conventions

`package.json:146`:

```json
"dependencies": {
    "acorn": "^8.18.0",
    "motion": "^13.4.5",
    "motion-dom": "^13.4.5"
}
```

`pnpm-lock.yaml:14` locks both Motion and motion-dom at 13.4.5, and Motion's snapshot depends on framer-motion 13.4.5. Motion 13.4.6 depends on framer-motion `^13.4.6`, which depends on motion-dom `^13.4.5`. Motion's main ESM entry is `export * from 'framer-motion/dom'`; local `src/lib/index.ts` exports our own Svelte AnimatePresence. Root package version is 1.5.0; do not bump it manually.

`.changeset/motion-13-4-5.md` currently contains:

```md
---
'@humanspeak/svelte-motion': patch
---

Update the upstream Motion and motion-dom dependencies to 13.4.5.
```

Reconcile this pending note to the actual pair of versions; keep filename and patch frontmatter. Do not add a second dependency-only changeset or claim a Svelte race fix. `docs/package.json` consumes the library via `workspace:*` and needs no change. CI already triggers on dependency changes. Trunk is authoritative; match the existing manifest formatting.

## Scope

Only modify `package.json` (motion requirement only), `pnpm-lock.yaml` (Motion/framer-motion resolutions and references/integrity), and `.changeset/motion-13-4-5.md` (accurate release note).

Out of scope: motion-dom/motion-utils upgrades, all other dependencies, packageManager/Node/toolchain configuration, public API/source/tests/docs/exports, CI, root version, unrelated lock churn and generated files. Preserve reviewed plan 001 coverage.

## Commands and environment

Use pnpm 11.24.0 via `/Users/jasonkummerl/.npm/_npx/0c20c093bc303280/node_modules/.bin/pnpm` with its directory prepended to PATH. If missing use `npm exec --yes --package=pnpm@11.24.0 -- which pnpm` to locate the JS distribution. The system native launcher fails on this host; do not substitute pnpm 12. This executor has actual local shell access, so the old Claude-companion sandbox restrictions do not apply; if a real restriction arises, report it.

| Purpose | Command | Expected |
| --- | --- | --- |
| Narrow update | `pnpm --filter @humanspeak/svelte-motion update motion@13.4.6 --save-prefix='^' --config.engine-strict=false` | root requirement ^13.4.6, minimal Motion/framer lock changes |
| Locked install | `pnpm install --frozen-lockfile --config.engine-strict=false` | exit 0, no tracked rewrite |
| Dependency tree | `pnpm list motion motion-dom framer-motion motion-utils --depth 3` | Motion/framer13.4.6; DOM13.4.5; utils13.3.0 |
| Package/app | `pnpm build` | exit 0 including svelte-package/publint |
| Root types | `pnpm check` | 0 errors |
| Unit suite | `pnpm test:only` | all pass |
| Consumer | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | runtime and emitted type checks pass |
| Docs | `pnpm --dir docs build` then `pnpm --dir docs check` | both exit 0; 0 type errors |
| Browser smoke | `pnpm exec playwright test e2e/animate-presence/wait-exit-key-change.spec.ts e2e/animate-presence/add-during-exit.spec.ts e2e/animate-presence/key-change.spec.ts e2e/animate-presence/wait-reset-label-pop.spec.ts e2e/animate-presence/enter-handoff-label-pop.spec.ts --project=chromium --reporter=list` | all pass |
| Scoped formatting | `trunk fmt package.json pnpm-lock.yaml .changeset/motion-13-4-5.md` | clean |
| Lint | `trunk check package.json pnpm-lock.yaml .changeset/motion-13-4-5.md` | no new issues |
| Integrity | `git diff --check` | exit 0 |

Docs build may write generated registry files; inspect git status and restore only generated differences created by this run that are unrelated. Never discard pre-existing user edits. Do not print environment secrets. Root Playwright owns 4198 and rebuilds current source; do not reuse stale preview. Tests are the focused release gate, not the full browser suite; full-suite failures invoke the user's per-page review workflow.

## Git workflow

Stay on `chore/motion-13.4.6`. Conductor pre-flights dependencies and commits snapshots via commit skill. Executor never commits, pushes, publishes or opens a PR. Suggested source commit: `chore: update motion to 13.4.6`.

## Steps

### 1. Refresh only the intended dependency

Confirm 001 is DONE and scoped baseline has not drifted. Run the narrow update, inspect every lockfile hunk, and retain motion-dom 13.4.5/motion-utils13.3.0. If the update unexpectedly upgrades unrelated dependencies, report before committing any broad refresh; do not fabricate integrity hashes. Registry-generated resolution metadata is required.

**Verify:** `git diff -- package.json pnpm-lock.yaml` → only authorized dependency fields/snapshots; dependency tree command → expected versions; frozen install → 0 without additional tracked changes.

### 2. Correct the pending release note

Update `.changeset/motion-13-4-5.md` to say Motion13.4.6 and motion-dom13.4.5. It may mention wait-mode characterization coverage but must not advertise that Svelte inherits React's reconciliation fix. No package version bump.

**Verify:** `git diff -- .changeset/motion-13-4-5.md` → same patch metadata and accurate version pair; `node -p "require('./package.json').version"` → 1.5.0.

### 3. Validate the updated dependency graph

Run formatting, build/package, root types, full unit suite, consumer check, docs build/check, focused browser smoke and scoped lint/integrity. Checks may run concurrently only when they do not share generated outputs; serialize root/docs builds and browser webServer builds. Inspect generated output churn. Report exact results and limitations. Conductor independently reproduces every done criterion.

**Verify:** all command-table gates exit 0; final scoped diff matches only the three authorized files relative to this plan's dispatch baseline.

## Test plan and red-first exception

This is a dependency baseline change with no claimed runtime behavior fix; a failing Svelte red test is not expected. Plan 001 already pins the new completion scenario against the old dependency. Re-run it and neighboring presence regressions on the new graph; run full units plus consumer/types/package/docs to catch integration drift. Do not edit existing tests to accommodate an unexplained regression.

## Done criteria

- [ ] Manifest requires motion ^13.4.6; root version1.5.0 and motion-dom ^13.4.5 unchanged; lock/tree resolve Motion/framer13.4.6, DOM13.4.5 and utils13.3.0.
- [ ] Frozen install passes without tracked-file mutation.
- [ ] Release note names the actual versions without claiming a Svelte runtime fix.
- [ ] `pnpm build`, `pnpm check`, `pnpm test:only`, and consumer test pass.
- [ ] Docs build/check and the focused browser-smoke command pass.
- [ ] Scoped `trunk check` and `git diff --check` pass; executor ran scoped `trunk fmt`.
- [ ] Only the three scoped files changed relative to dispatch baseline; plan001 remains intact.
- [ ] Conductor records independent evidence and marks README DONE.

## STOP conditions

- Plan001 incomplete; genuine source/API/browser regression; a need for source/test/CI edits.
- Registry graph differs from expected versions; unrelated lockfile upgrade; package-manager mismatch.
- Verification fails twice after reasonable environment correction. Report the failure; do not weaken tests or declare PASS.

## Maintenance notes

Motion and motion-dom versions do not always move together. Compare net tag diffs rather than every intermediate commit; scroll range changes were reverted in this release. Future alignment must distinguish inherited DOM behavior from React code the Svelte adapter owns separately.
