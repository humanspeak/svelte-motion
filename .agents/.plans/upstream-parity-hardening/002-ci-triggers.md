# Plan 002: Run test CI for test and runner-configuration changes

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- .github/workflows/run-tests.yml`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: none
- Category: tests / dx
- Audit finding: 05
- Planned at: commit 6f0085ef, 2026-09-24
- State: DONE — b0fdb49e; independently reviewed (see batch README)

## Why this matters

A PR changing only e2e tests or Vitest setup can currently receive a successful build without executing the affected suite. Close the path-filter gap without expanding permissions or running all tests for unrelated docs changes.

## Current state and conventions

.github/workflows/run-tests.yml:12 currently includes:
~~~yaml
paths:
    - src/**
    - tests/**
    - '!docs/**'
    - package.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - svelte.config.*
    - vite.config.*
    - playwright.config.*
    - tsconfig*.json
    - .github/workflows/run-tests.yml
~~~
It omits e2e/**, vitest.config.ts, and vitest.setup.ts. Root vitest.config.ts includes src/**/*.{test,spec}.{js,ts}, uses vitest.setup.ts, and excludes tests. playwright.config.ts uses testDir './e2e'. pr-build.yml includes e2e/** but only builds.

Match the existing YAML indentation and existing workflow_call and pull_request interfaces. No new actions or script dependencies are needed.

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
| Parse/lint changed workflow | trunk check .github/workflows/run-tests.yml | Exit 0 |

Fresh root-checkout prerequisite: run `pnpm package` before `pnpm check` so the consumer fixture can resolve the local package. Complete SvelteKit synchronization before starting the unit suite; do not race first-time generation against Vitest. These are existing build prerequisites, not source changes. Plan 002 does not require docs or browser checks.

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- .github/workflows/run-tests.yml

Out of scope: job bodies, branch policy, workflow permissions, actions versions, browser matrix, docs test coverage (plan 008), and a new CI framework.

## Git workflow

Use a fresh branch named fix/upstream-ci-triggers in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "ci: run tests for test-only changes". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Record the missing trigger cases
Read the current filter and make an execution note of these representative paths: e2e/drag/element-ref-resize.spec.ts, vitest.config.ts, vitest.setup.ts. All are absent from matching positive patterns. Existing src/lib/utils/drag.spec.ts and tests/consumer-vite6/verify.mjs should remain included; docs-only prose should remain excluded.
**Verify:** rg -n 'e2e/|vitest' .github/workflows/run-tests.yml shows no corresponding trigger entries at the top (later cache references do not count). This is pure CI configuration, exempt from a runtime red test.

### Step 2: Add the missing positive patterns
Add e2e/**, vitest.config.*, and vitest.setup.* to pull_request.paths. Preserve the existing docs exclusion and workflow_call interface. No scripts, dependencies, or source files are necessary.
**Verify:** trunk check .github/workflows/run-tests.yml exits 0; git diff -- .github/workflows/run-tests.yml shows only the intended path additions.

### Step 3: Validate filters and complete the gate
Run the following source-independent representative matching check after the edit; it tests the actual positive patterns and preserves the existing ordered negation behavior for this simple filter. GitHub remains authoritative for hosted trigger behavior.
~~~sh
python3 - <<'PY'
from pathlib import Path
from fnmatch import fnmatchcase
text = Path('.github/workflows/run-tests.yml').read_text()
block = text.split('        paths:\n', 1)[1].split('\nconcurrency:', 1)[0]
patterns = [line.strip()[2:].strip("'\"") for line in block.splitlines() if line.strip().startswith('- ')]
def included(path):
    answer = False
    for pattern in patterns:
        negative = pattern.startswith('!')
        if fnmatchcase(path, pattern[1:] if negative else pattern):
            answer = not negative
    return answer
for path in ['e2e/drag/element-ref-resize.spec.ts', 'vitest.config.ts', 'vitest.setup.ts', 'src/lib/utils/drag.spec.ts', 'tests/consumer-vite6/verify.mjs', '.github/workflows/run-tests.yml']:
    assert included(path), path
assert not included('docs/src/routes/docs/use-presence/+page.svx')
print('Representative workflow paths passed')
PY
~~~
**Verify:** output is Representative workflow paths passed. Run pnpm check, pnpm test:only, trunk fmt .github/workflows/run-tests.yml, trunk check, and git diff --check; all exit 0. Do not manufacture a hosted PR just to test this plan.

## Test plan

No new permanent runtime test is necessary for this small reversible configuration change. The representative path check and Trunk YAML/security validation cover the edited surface. Later, an authorized test-only PR provides hosted confirmation; do not claim that occurred during local validation.

## Done criteria

- [x] The representative path command passes for e2e and both Vitest files while preserving the docs exclusion.
- [x] The only implementation diff is the workflow trigger list.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The workflow trigger structure has changed enough that the representative-path extraction no longer targets its path list; inspect and revise the validation instead of accepting an empty or unrelated match.

## Maintenance notes

Every new test root or runner setup file must be reflected in the relevant workflow filters. The dedicated docs browser workflow in plan 008 owns docs route tests.
