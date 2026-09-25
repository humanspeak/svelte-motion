# Plan 008: Protect the SVG docs example with Chromium and Firefox tests

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- docs/playwright.config.ts docs/e2e/svg-css-variables.spec.ts .github/workflows/docs-browser-tests.yml docs/src/lib/examples/svg-css-variables/demos/Default.svelte`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: M
- Fix risk: LOW
- Confidence: HIGH
- Depends on: 001-docs-verification.md; 002-ci-triggers.md; run final integrated gates after all plans
- Category: tests
- Audit finding: 08
- Planned at: commit 6f0085ef, 2026-09-24
- State: TODO

## Why this matters

The SVG CSS-variable demo is repaired for Firefox, but existing automated browsers never visit that docs route in Firefox. A dependency/example change could reintroduce invisible-path behavior. Add a bounded suite against the real route and prove it detects the original defect.

## Current state and conventions

docs/src/lib/examples/svg-css-variables/demos/Default.svelte:175:
~~~css
stroke-dasharray: calc((var(--trim-end) - var(--trim-start)) * 1px) 1px;
stroke-dashoffset: calc(var(--trim-start) * -1px);
~~~
Older expressions omitted px and yielded invalid SVG calc results in Firefox. Motion updates custom properties correctly; keep using upstream animate.

The component has accessible Draw, Erase, Replay, Reset buttons and Trim start/Trim end sliders. Both animated paths have pathLength=1 and initial variables 0/.65. Replay draws to 1, erases by moving start to 1, and returns to [0,.65]. Reduced motion makes Replay immediately restore [0,.65].

Root playwright.config.ts enables only Chromium, serving the root app on 4198. docs/vite.config.ts has Chromium-only Vitest component tests, not docs route smoke tests. Neither covers /examples/svg-css-variables. Existing root @playwright/test and docs playwright versions are compatible; no dependency addition is needed.

Match the expect/test import from @playwright/test in e2e/drag/element-ref-resize.spec.ts, but use expect.poll instead of old fixed sleeps. Inspect the actual docs page and target its live demo, not the source-code panel or hidden example-sheet content.

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
| Docs route suite | pnpm exec playwright test --config docs/playwright.config.ts | Chromium and Firefox pass |
| Firefox only | pnpm exec playwright test --config docs/playwright.config.ts --project=firefox | All pass |
| Install browsers if absent | pnpm exec playwright install --with-deps chromium firefox | Exit 0 |
| Integrated root coverage | pnpm test | All pass |
| Integrated root browsers | pnpm exec playwright test --project=chromium | All pass |
| Docs production build | pnpm --dir docs build | Exit 0 |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- docs/playwright.config.ts
- docs/e2e/svg-css-variables.spec.ts
- .github/workflows/docs-browser-tests.yml
- docs/src/lib/examples/svg-css-variables/demos/Default.svelte

Out of scope: Firefox for the full root suite, changes to the animation engine/CSS behavior, replacing docs Vitest configuration, WebKit support claims, or new browser dependencies. Demo edits are limited to minimal stable selectors if accessible markup is insufficient.

## Git workflow

Use a fresh branch named fix/upstream-svg-firefox-coverage in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "test(docs): cover SVG trimming in Firefox and Chromium". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Add the harness and prove regression sensitivity
Create docs/playwright.config.ts with testDir './e2e', Chromium/Firefox projects, baseURL http://127.0.0.1:5201, traces/screenshots on failure, and output/report directories under root test-results/docs and playwright-report/docs. Resolve repository root explicitly from import.meta.url.
Set webServer cwd to repository root and command to pnpm package && pnpm --dir docs build && pnpm --dir docs exec vite dev --host 127.0.0.1 --port 5201 --strictPort, with a startup timeout of at least 300000ms and reuseExistingServer:false. The normal docs build generates the ignored stats, registry, and demo inputs required in a fresh checkout; reuse it instead of copying caches. This serves actual docs with fresh package output. Do not use docs preview, which invokes Wrangler, or the user's active 5199 server.
Write an initial test asserting both animated paths resolve to a valid dash pair approximately [.65,1]. Parse computed strokeDasharray/strokeDashoffset numbers, reject none/non-finite values, and tolerate whitespace/comma serialization differences.
The CSS is already fixed, so a natural red baseline is not expected. In this isolated checkout only, temporarily restore the old unitless expressions, run Firefox afresh, and capture failure on invalid/incorrect stroke properties. Restore the exact source in finally-style cleanup; never commit the mutation.
**Verify:** pnpm exec playwright test --config docs/playwright.config.ts --project=firefox fails specifically on rendering with the deliberate regression, then passes with restored px expressions. Navigation/module errors do not count as red proof.

### Step 2: Exercise controls and real replay progression
Cover Draw (dash 1), Erase (dash 0), Reset (.65), sliders such as [25,75] (dash .5, offset -.25), and endpoints. Assert both glow and sharp paths, no none/NaN, and finite stroke widths. Test computed rendering, not only custom variables/readout labels.
Replay must first exhibit a changed/early drawing phase, then a drawn phase, then final .65/zero offset; merely asserting its final initial state could pass without playback. Use expect.poll with bounded timeouts rather than exact frame counts. Cover Reset interruption and reduced-motion immediate behavior; fail on unexpected page errors.
**Verify:** pnpm exec playwright test --config docs/playwright.config.ts passes both projects. Repeat once if needed to validate new timing assertions; do not widen acceptance to invalid CSS.

### Step 3: Add dedicated docs browser CI
Create docs-browser-tests.yml for PRs targeting main and workflow_dispatch. Include docs/**, src/**, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, root Svelte/Vite/TypeScript configs, and this workflow in path filters. Follow existing contents:read, checkout persist-credentials:false, pnpm/action-setup, and Node 24 conventions from pr-build.yml.
Use frozen full-workspace install, pnpm exec playwright install --with-deps chromium firefox, and the suite command. Let the Playwright config build the package once. Retain failure artifacts with always() handling and a bounded timeout. No production secrets/deployment.
**Verify:** trunk check validates new configuration; pnpm exec playwright test --config docs/playwright.config.ts --list lists both browsers; the actual suite passes. Hosted CI remains pending until an authorized PR runs it.

### Step 4: Run integrated release verification
After all selected plans are integrated, run pnpm check, pnpm package, pnpm --dir docs check, pnpm test, pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test, the docs browser suite, and pnpm exec playwright test --project=chromium. Run pnpm --dir docs build and inspect generated changes without committing unrelated artifacts. Run trunk fmt on changed source/config files, trunk check, and git diff --check. Do not version, publish, or deploy.
**Verify:** all commands pass. For full e2e failures follow the repository's one-at-a-time browser/user review workflow, retain evidence, and leave release readiness unchecked until resolved. Record actual tested browser projects, without claiming WebKit.

## Test plan

A deliberate regression proof is required for this already-fixed behavior. Cover initial stroke rendering, draw/erase/reset, both sliders and paths, replay progression/return, interruption, and reduced motion. Stable computed rendering assertions are primary; screenshots may supplement. CI must visit the actual docs route rather than a copied fixture.

## Done criteria

- [ ] Chromium and Firefox pass tests against the real SVG docs route.
- [ ] Original unitless CSS produces a specific Firefox rendering failure; source is restored afterward.
- [ ] Relevant changes trigger dedicated CI and failures preserve reports.
- [ ] Integrated release gates are recorded separately; outstanding failures block readiness.
- [ ] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [ ] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [ ] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The real route cannot load due to unrelated environment/modules, accessible controls do not reach the live demo, or deliberately broken Firefox CSS passes. Report or fix test targeting rather than substituting a synthetic page.

## Maintenance notes

Preserve route-level rendering coverage as docs layout evolves. Keep explicit px lengths even when Chromium tolerates unitless calc. Workflow filters must follow shared demo dependencies, and docs browser reports must remain separate from root e2e.
