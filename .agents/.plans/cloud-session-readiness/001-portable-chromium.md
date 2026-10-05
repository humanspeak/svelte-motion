# Plan 001: Run all Chromium verification paths with an optional installed browser

> **Executor instructions:** Execute sequentially, preserve the scope below, and record red/green evidence. Stop on the listed conditions. Update the sibling README status unless a reviewer owns it.
>
> Revision 2026-10-05 (dispatch pre-flight): The operator selected Claude Sonnet 5.5. T3 delegated children inherit this thread's current checkout; this batch will use the dispatch skill's serial, otherwise-idle shared-checkout exception. Only one executor writes at a time. Guard will not modify repo files while an executor runs, and owns all commits/index updates. This supersedes the isolated-worktree wording below for this dispatch; there is no worktree binding override or parallel implementation. Source baseline remains d40a038f because no in-scope source drift was found.
>
> **Drift check first:** `git diff --stat d40a038f..HEAD -- playwright.config.ts docs/playwright.config.ts docs/vite.config.ts scripts/chromium-launch-options.ts src/testing/chromiumLaunchOptions.spec.ts docs/src/testing/chromium-provider.svelte.spec.ts .github/workflows/run-tests.yml .github/workflows/docs-browser-tests.yml .github/workflows/pr-build.yml`. Compare existing excerpts on drift; reconcile unexpected changes before execution.

## Status

- Priority: P2
- Effort: M (roughly a day including three consumers and verification)
- Risk: MED — arbitrary Chromium versions have no Playwright compatibility guarantee
- Depends on: none
- Category: dx / tests
- Planned at: commit `d40a038f`, 2026-10-05

## Why this matters

A remote agent container can contain usable Chromium without containing the exact revision required by Playwright. This repository currently provides no configuration path to use that installed browser. Support an explicitly configured fallback across root e2e, docs e2e, and docs browser unit tests, while retaining pinned-browser defaults and normal CI installation. No Motion version change is required; keep `motion` and `motion-dom` at 14.0.0.

## Current state

- `playwright.config.ts:1,45-48` imports `defineConfig, devices` and defines:

```ts
projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
```

- `docs/playwright.config.ts:34-36` defines Chromium and Firefox with device defaults; it must retain Firefox, ports, fresh production builds, artifact paths, and graceful shutdown.
- `docs/vite.config.ts:199-206` contains the third Chromium launch path:

```ts
name: 'client',
environment: 'browser',
browser: {
    enabled: true,
    provider: playwright(),
    instances: [{ browser: 'chromium' }]
},
include: ['src/**/*.svelte.{test,spec}.{js,ts}']
```

The installed `@vitest/browser-playwright` provider supports `playwright({ launchOptions })`; this was checked in its declaration file. No existing docs file currently matches that client-project inclusion, so running the client project with `--passWithNoTests` would not prove browser startup. Add the explicit smoke below. Docs Vitest defaults headless to detected CI; fresh cloud shells may have no DISPLAY and no CI variable. The commands here explicitly pass `--browser.headless`; provider launchOptions cannot override this because Vitest supplies its own headless value.

- `.github/workflows/run-tests.yml:143-144` installs Playwright browsers; docs-browser-tests.yml:51-55 installs Chromium/Firefox and runs actual docs routes. Do not replace those installations with fallback browsers.
- The PR path filters in run-tests.yml, docs-browser-tests.yml, and pr-build.yml do not include the proposed shared helper under `scripts/`; add its exact path to each filter.
- Repo: Svelte 5, TypeScript, pnpm workspace root/docs/consumer-vite6, Node 24, pnpm 12.6.0. Root app uses adapter-auto; public docs deploy via Cloudflare. Deployment is out of scope.
- Trunk is lint/format authority; `.trunk/trunk.yaml:58-74` includes ESLint, Prettier, YAML/security checks. Match four-space indentation, single quotes, no semicolons, Google-style JSDoc on new exported tooling functions.
- Testing exemplar: `src/lib/__tests__/motionDependencies.spec.ts:1-5,30-46` uses Node imports with Vitest `describe/expect/it`. `src/lib/utils/optimizedAppear.spec.ts:1-24` restores Vitest mocks after each test. Keep the new Node-only helper outside `src/lib` so it is not shipped as animation-library API.

## Commands you will need

Run from repository root unless the command specifies docs. Setup/build commands here are for the executor, not evidence that the planning advisor ran them.

| Purpose | Command | Expected |
| --- | --- | --- |
| Versions | `node --version` and `pnpm --version` | Node 24.x; pnpm 12.6.0 |
| Frozen setup | `pnpm install --frozen-lockfile --config.engine-strict=false` | Exit 0; no tracked lockfile drift |
| Package required by docs config | `pnpm package` | Exit 0; publint passes |
| Focused regression | `pnpm exec vitest run src/testing/chromiumLaunchOptions.spec.ts` | Named red first, then all green |
| Full root units | `pnpm test` | Exit 0, all tests pass |
| Root browser smoke | `pnpm exec playwright test e2e/text/exact-text.spec.ts --project=chromium` | Both SSR/hydration tests pass |
| Docs browser units | `pnpm --dir docs exec vitest run --project=client --browser.headless` | At least the new smoke is discovered and passes |
| All docs units | `pnpm --dir docs exec vitest run --browser.headless` | Exit 0, including new client smoke |
| Docs browsers | `pnpm exec playwright test --config docs/playwright.config.ts` | Chromium and Firefox suites pass |
| Root types | `pnpm check` | Exit 0, zero errors |
| Docs preparation/types | `pnpm --dir docs build` then `pnpm --dir docs check` | Exit 0, zero type errors; generated artifacts reviewed |
| Format/lint | `trunk fmt scripts/chromium-launch-options.ts src/testing/chromiumLaunchOptions.spec.ts docs/src/testing/chromium-provider.svelte.spec.ts playwright.config.ts docs/playwright.config.ts docs/vite.config.ts .github/workflows/run-tests.yml .github/workflows/docs-browser-tests.yml .github/workflows/pr-build.yml` then `trunk check scripts/chromium-launch-options.ts src/testing/chromiumLaunchOptions.spec.ts docs/src/testing/chromium-provider.svelte.spec.ts playwright.config.ts docs/playwright.config.ts docs/vite.config.ts .github/workflows/run-tests.yml .github/workflows/docs-browser-tests.yml .github/workflows/pr-build.yml` | Formatting stable; no new lint findings |
| Integrity | `git diff --check` | Exit 0 |

Pinned-browser setup is `pnpm exec playwright install --with-deps chromium firefox`. On a restricted machine where installation cannot run, report the prerequisite and verify the externally supplied browser separately; do not claim the full Firefox gate passed.

## Scope

Only modify:

- `scripts/chromium-launch-options.ts` (create, shared Node-only resolver).
- `src/testing/chromiumLaunchOptions.spec.ts` (create; root Vitest includes src specs).
- `docs/src/testing/chromium-provider.svelte.spec.ts` (create; actual browser-runner smoke).
- `playwright.config.ts`, `docs/playwright.config.ts`, `docs/vite.config.ts` (launch configuration only).
- `.github/workflows/run-tests.yml`, `.github/workflows/docs-browser-tests.yml`, `.github/workflows/pr-build.yml` (only add the helper's exact path to PR filters).
- This batch's README execution status/evidence.

Out of scope: manifests/lockfile/dependency versions; library runtime/exports; existing test assertions/tolerances/snapshots; server ports/reuse/timeouts/shards; Firefox settings; browser sandbox flags; managed release workflows including npm-publish.yml; deployment; broad CI/tooling cleanup; changesets for runtime packages. No feature demo or public animation-docs page is needed for this contributor tooling change.

## Git workflow

Use an isolated worktree based on the operator's reviewed branch (`feat/motion-14.0.1-parity` at planning time) if dispatched as an executor. Preserve #498 commit `d40a038f`. Branch naming example: `chore/cloud-session-chromium`. Conventional message example: `chore: support configured Chromium in remote sessions`. Do not commit/push/open a PR unless that operation is authorized by the operator. Do not merge into the shared branch.

## Steps

### Step 1: Reproduce missing fallback configuration before writing the helper

Create `src/testing/chromiumLaunchOptions.spec.ts`. Write an integration test that dynamically imports the existing root `playwright.config.ts` with a mocked Playwright `chromium.executablePath()` pointing to an absent pinned file, a stubbed `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pointing to a valid fake executable, and filesystem inspection mocked accordingly. Preserve real `defineConfig/devices` in the module mock. Read the Chromium project's `use.launchOptions` and assert it contains that fallback executablePath. Restore module/env/fs mocks after the test. Do not launch a browser in this unit test.

There is no helper at baseline, but importing the existing root config works: red must be a failed launch-options assertion, not a missing-module or import/build error.

**Verify:** `pnpm exec vitest run src/testing/chromiumLaunchOptions.spec.ts` → fails specifically because Chromium `use.launchOptions` is undefined rather than the expected fallback path. If config loading fails for an unrelated reason, fix the test harness without changing production config; if no reproduction is possible, STOP.

### Step 2: Implement and unit-test the shared resolver

Create `scripts/chromium-launch-options.ts`, exporting `resolveChromiumLaunchOptions(pinnedExecutablePath, env = process.env)` with a narrow `{ executablePath?: string }` return type. Keep browser-package selection in the callers; the helper imports only Node filesystem/path utilities. Empty/whitespace-only environment values count as unset. Do not execute or download anything while resolving.

Contract:

1. If the supplied pinned executable exists as a regular executable file, return `{}`. Ignore fallback environment values in this case, including invalid ones. This preserves Playwright's own headless/browser defaults.
2. Otherwise use nonempty `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` first. Validate it as a regular executable (on POSIX check execution access; on Windows use appropriate file existence/readability). Invalid explicitly supplied path throws an actionable error naming the variable and browser-install alternative. Never silently choose another browser when an explicit path is invalid.
3. If no explicit path was supplied, consider `join(PLAYWRIGHT_BROWSERS_PATH, 'chromium')`. This is a cloud-image convention for an actual executable, not Playwright's usual revision-directory cache layout. Select it only if executable and regular; otherwise return `{}` so normal Playwright missing-browser diagnostics remain. Do not scan caches or guess OS paths.
4. Without a valid fallback, return `{}`. Do not suppress normal launch failures.

Add Google-style JSDoc documenting precedence and limitations. Test pinned-present (even with invalid explicit fallback), missing pinned plus valid explicit path, explicit priority over browser-root candidate, invalid/missing/directory/nonexecutable explicit path, valid browser-root convention, ordinary cache directory without that executable, unset/empty/whitespace variables, and Windows checking behavior. Use mocks, not changes to actual browser caches or permissions. Assert error guidance and no shell/download calls. Unit tests cover every exported new function.

**Verify:** focused Vitest command → resolver unit cases pass; original config regression remains red until Step 3. Only that named integration case should still fail.

### Step 3: Connect all three Chromium consumers and exercise their launch paths

- Root config: import `chromium` from `@playwright/test`, import the shared helper, and apply its returned options to Chromium `use.launchOptions` using that caller's `chromium.executablePath()`.
- Docs Playwright: same pattern with `../scripts/chromium-launch-options`. Leave Firefox untouched.
- Docs Vitest: import `chromium` from docs' already-declared `playwright` dependency; pass its executable path through the same helper into `playwright({ launchOptions: ... })`. Match the installed provider's supported API. Keep the existing client/server project structure.
- Use direct relative, extensionless helper imports in the configuration files, matching existing config imports such as `./src/lib/docs-config`. The temporary `tsx` launch probe can import the actual `.ts` file. Do not change tsconfig, add aliases, or add package exports to accommodate these imports. Typecheck verifies the chosen configuration import form.
- Extend the config regression to root and docs Playwright options. Use actual config imports with the mocked environment/browser/fs, without starting their webServers. Do not mock away the helper itself.
- Add `docs/src/testing/chromium-provider.svelte.spec.ts` using `it/expect` from `vitest` and `page` from `vitest/browser`. Create a temporary button in `document.body`, update its text on click, drive the click with `page.getByRole`, assert the changed text, and remove it in `finally`. This is a browser provider smoke, not animation coverage. Its filename intentionally matches the client project's existing `.svelte.spec.ts` inclusion.

**Verify:** focused Vitest command → all green. Run root browser smoke, docs client command, and docs e2e commands from the table with normally installed pinned browsers; all pass and docs client reports at least one test, not "no tests".

Also exercise real fallback selection without hiding/deleting the pinned cache: use a small terminal script under the executor's ignored `.temp/` that imports the helper with a deliberately nonexistent pinned path and an environment object supplying the available executable, launches Chromium with returned options, sets a page's content, asserts its text, and closes in `finally`. Run it with `pnpm exec tsx <script>`. Record executable source and browser version. This proves resolver/launch compatibility; it is not evidence that a real cloud image was tested. Unit config tests establish missing-pinned wiring. If the target cloud image is available, run the three real Chromium paths there as additional evidence.

### Step 4: Preserve CI verification of future helper edits

Add only `scripts/chromium-launch-options.ts` to each of the three in-scope workflow PR path filters. Leave install commands, job graphs, permissions and release policy unchanged.

**Verify:** `rg -n 'scripts/chromium-launch-options.ts' .github/workflows/run-tests.yml .github/workflows/docs-browser-tests.yml .github/workflows/pr-build.yml` → one entry in each workflow. `trunk check` on those workflows → no new findings. Confirm browser-install commands remain present with `rg -n 'playwright install' .github/workflows/run-tests.yml .github/workflows/docs-browser-tests.yml`.

### Step 5: Run the integrated gate and record limits

Run the full root unit suite, all docs units, root browser smoke, full existing docs browser suite, package validation, root check, docs build/check, scoped Trunk fmt/check, and diff integrity using the commands table. Review any generated tracked files rather than staging unrelated churn. Repeat focused tests after any formatter-induced substantive change.

**Verify:** all required commands exit 0 with no new errors/findings, dependency pins remain unchanged, and `git diff --name-only` contains only scope paths. Record named red failure, green counts, normal versus external browser/version, any unavailable environment, and status in the index. Missing environment verification is an explicit limitation, not a green check.

## Test plan

The root config regression is red on existing 14.0.0 code and green after wiring. Resolver cases cover filesystem/environment precedence and platform behavior. The docs client smoke makes previously empty browser-unit coverage actually start a browser. Existing SSR/hydration and docs Chromium/Firefox behavior tests guard integration. No new animation timing assertions or Linux screenshot baselines are appropriate here.

## Done criteria

- [ ] Named launch-options regression failed before config changes and passes afterward.
- [ ] Resolver branch/platform tests pass, and both Playwright configs use the shared helper.
- [ ] Docs client project discovers/passes its browser smoke; configured provider uses helper output.
- [ ] Existing root SSR/hydration smoke and docs Chromium/Firefox e2e pass.
- [ ] Real helper-selected browser smoke passes; actual cloud validation is distinguished from local simulation.
- [ ] `pnpm test`, docs tests, package, root/docs checks/build, scoped Trunk, and diff checks pass.
- [ ] Each workflow filter includes shared helper; pinned installation remains unchanged.
- [ ] `git diff -- package.json docs/package.json pnpm-lock.yaml` is empty; no out-of-scope edits.
- [ ] README status and verification evidence updated.

## STOP conditions

- Browser compatibility requires package upgrades, `--no-sandbox`, or weakened assertions.
- Docs provider cannot accept launchOptions as specified by the installed declaration.
- Existing config drift changes projects, shutdown behavior, ports, or build prerequisites beyond these excerpts.
- A passing test requires moving/deleting browser caches or changing another user's browser installation.
- A verification command fails twice after a reasonable in-scope correction, or further work needs out-of-scope files.

A full e2e failure must follow the maintainer's page-by-page browser review workflow: show the related page and discuss behavior versus stale assertions before changes. Do not bulk-update tests.

## Maintenance notes

Pinned browser remains authoritative; supplementary external-browser success is not equivalent to supported pinned CI evidence. Revisit this resolver if Playwright changes executablePath/headless-shell behavior or docs adds other browser instances. Keep it out of the shipped animation bundle. Windows semantics and environmental whitespace must remain tested. Setup/Claude documentation is covered by the separate self-contained Plan 002.

Primary references: https://github.com/motiondivision/motion/pull/3894 and https://playwright.dev/docs/api/class-browsertype#browser-type-launch. Upstream tooling behavior informed this plan, but upstream removed ESLint by maintainer choice; this plan retains Trunk/ESLint.
