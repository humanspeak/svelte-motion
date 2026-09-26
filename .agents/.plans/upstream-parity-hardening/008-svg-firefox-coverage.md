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
- State: DONE — local implementation and verification complete; source awaiting commit

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
- e2e/drag/snap-to-origin.spec.ts — approved integrated assertion-only follow-up below

Out of scope: Firefox for the full root suite, changes to the animation engine/CSS behavior, replacing docs Vitest configuration, WebKit support claims, or new browser dependencies. Demo edits are limited to minimal stable selectors if accessible markup is insufficient.

## Git workflow

Use the primary shared checkout on `chore/motion-upstream-refresh`, as explicitly required by the maintainer. The reconciled execution base is `ae920f1e` (approved 007 plus all predecessors), with a clean tree. Do not create or switch the implementation to another branch/worktree. The maintainer's shared-checkout and visual-checkpoint workflow supersedes the original isolation instruction. Leave 008 source uncommitted for review; root owns plan/index edits and final release-gate orchestration.

Use a conventional commit such as "test(docs): cover SVG trimming in Firefox and Chromium". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Add the harness and prove regression sensitivity
Create docs/playwright.config.ts with testDir './e2e', Chromium/Firefox projects, baseURL http://127.0.0.1:5201, traces/screenshots on failure, and output/report directories under root test-results/docs and playwright-report/docs. Resolve repository root explicitly from import.meta.url.
Set webServer cwd to repository root and command to pnpm package && pnpm --dir docs build && pnpm --dir docs exec vite preview --host 127.0.0.1 --port 5201 --strictPort, with a startup timeout of at least 300000ms and reuseExistingServer:false. The normal docs build generates the ignored stats, registry, and demo inputs required in a fresh checkout; reuse it instead of copying caches. This serves actual docs with fresh package output. Do not use docs preview, which invokes Wrangler, or the user's active 5199 server.
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

- [x] Chromium and Firefox pass tests against the real SVG docs route.
- [x] Original unitless CSS produces a specific Firefox rendering failure; source is restored afterward.
- [x] Relevant changes trigger dedicated CI and failures preserve reports.
- [x] Integrated release gates are recorded separately; outstanding failures block readiness.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record base commit, commands/results, and limitations in the batch README. Implementation is complete and uncommitted at the review checkpoint; 007 base is ae920f1e.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The real route cannot load due to unrelated environment/modules, accessible controls do not reach the live demo, or deliberately broken Firefox CSS passes. Report or fix test targeting rather than substituting a synthetic page.

## Maintenance notes

Preserve route-level rendering coverage as docs layout evolves. Keep explicit px lengths even when Chromium tolerates unitless calc. Workflow filters must follow shared demo dependencies, and docs browser reports must remain separate from root e2e.


## Execution reconciliation — 2026-09-25

Base `ae920f1e`, clean shared checkout following user-approved 007 commit; all normal commit hooks passed. Scope drift check from 6f0085ef is empty. SVG CSS remains the already repaired explicit-px implementation, controls and route match the plan, and no docs Playwright config/workflow/spec exists yet. Firefox and Chromium binaries are locally installed; verify the version expected by the existing root Playwright before downloading anything. Port 5201 was free at preflight. Existing user-facing docs5199 and frozen root5205 servers must remain available. Pinned commands: `npm exec --yes --package=node@24.18.0 --package=pnpm@11.24.0 -- pnpm ...`.

The executor owns only the four scoped source/config files and isolated ignored diagnostics; root owns plan/index and integrated release checks. Red proof must exercise the actual docs route in Firefox and fail on computed stroke rendering, not navigation or test setup. Because the user requires a shared checkout, prefer a tightly bounded temporary restoration of the old CSS declarations with exact source backup and guaranteed finally restoration, on a dedicated verification server. Do not leave the mutation in the working tree or commit it. Coordinate this window; preserve unrelated edits and record before/after source hashes. If a safe equivalent proof avoids touching the shared demo source, report the proposed mechanism before substituting it. This temporary regression is authorized test work, not a request to change the demo's final behavior.

Default harness must remain self-contained: fresh package + normal docs build + dedicated production preview, explicit root resolution, no reuse of stale servers, separate docs reports. Startup tests may use an ignored config only for deliberate regression diagnosis after proving the dedicated server is current; final green must run the committed harness command unchanged. Restore known unrelated generated `docs/static/r/animated-tabs.json` drift after normal docs builds (baseline clean), preserving any other unexpected change for review. Do not deploy or use IndexNow mode.

Run bounded Chromium/Firefox coverage and CI/config checks first. Once source is frozen, root runs the integrated candidate gates (coverage units, types/package/consumer, complete Chromium root suite, normal docs build/check and final docs browsers), without racing builds against live root previews. Full root failures require the one-page-at-a-time browser/user review workflow before altering behavior/assertions. Do not broaden Firefox to all root tests. Hosted CI remains unverified until an authorized PR runs it. No PR/push/merge/version/release action is authorized.


### Approved regression-proof reconciliation

Use page-local CSSOM mutation in an isolated Firefox test browser instead of editing shared demo source. Locate the actual compiled CSSStyleRule matching both live `pathLength=1` paths and containing the trim custom properties. Save its exact declaration text; install the old unitless dash-array and dash-offset expressions, verify/log that those declarations were actually installed, and invoke the same initial computed-rendering assertion. Restore the original cssText in finally. Audit the demo source hash before/after. This preserves the real route, CSS parser, and actual computed rendering while preventing a transient broken demo in the user's active server. No synthetic fixture, mock rendering, or assertion against custom-property values alone counts as red. Root reviewed and approved this equivalent proof before execution.

Initial integrated gates at ae920f1e: coverage run passes 954 tests in 83 files (`.temp/plan-008-integrated-units.log`); root check 0 errors/35 existing warnings (`.temp/plan-008-integrated-check.log`). Dedicated fresh root app build completed with exit 0, then root preview restarted on5205 for the complete Chromium suite. Docs harness builds package/docs separately; no stale preview reuse or overlapping root output rebuild. Existing Playwright 1.62.1 browser binaries match (Chromium1234/Firefox1538), so no dependency/browser installation change is needed.


### Harness reconciliation: direct production preview

First full harness built package/docs successfully but failed before browser execution when the dedicated dev server started: docs-kit's `docMirrorsPlugin.buildStart` removes/regenerates `static/docs`, while `llmsFullPlugin.configureServer` already watches those files and attempts to read a removed markdown file. Result: ENOENT for `docs/static/docs/animate-presence-custom.md`, not a rendering regression (`.temp/plan-008-red.log`). Root independently inspected both installed plugin implementations and confirmed this watcher/generation race.

Use direct `pnpm --dir docs exec vite preview --host 127.0.0.1 --port 5201 --strictPort` after the same fresh package + normal docs build. This is Vite/SvelteKit's local preview of built output, not the `docs preview` package script that invokes Wrangler. It avoids dev generator watchers, serves the actual production route, and requires no animation/plugin/dependency changes. Verify direct preview loads using the already successful build first, then run final green through the unchanged self-contained harness. Any Cloudflare platform emulation is local, not deployment. The test setup failure is recorded separately and does not count as the required Firefox red.


### Firefox red proof and initial green

The page-local CSSOM proof failed on the intended rendering assertion in Firefox: both actual demo paths computed `strokeDasharray: none` under the original unitless declarations, parsed as NaN instead of `[.65, 1]`. The diagnostic logged the matched compiled `.trim.svelte-qcocvi` rule before/after mutation. Finally restoration returned both paths to `[.65, 1]`, offset0, widths16/4; the identical initial assertion then passed. Evidence: `.temp/plan-008-red-preview.log` (expected rendering failure) and `.temp/plan-008-initial-green.log` (1/1 Firefox). Demo source SHA-256 remained `8d22bc4db57b1b1f5ad64c455adb2fee0388e4b7b83b23c70130705caeb41360`. No source mutation or generated fixture was used. The earlier dev startup ENOENT log is separate setup evidence, not the regression proof.

The integrated published-package consumer passed both emitted Reorder inference and Vite6 SSR checks (`.temp/plan-008-integrated-consumer.log`). Full root Chromium coverage is running against the fresh, unchanged ae920f1e app output on5205; docs-only test/config changes do not change that runtime candidate.


### Reduced-motion setup diagnosis and release-gate review

The first 12-case docs run passed10 and failed the reduced-motion hint assertion in both browsers. A read-only diagnostic confirmed the browser's `matchMedia('(prefers-reduced-motion: reduce)').matches` was false despite the context test option; explicitly invoking Playwright `page.emulateMedia` made the query true and immediately updated the real demo hint. Thus this was an ineffective browser setup, not evidence of an animation-hook defect. Installed Playwright1.62.1 declares reducedMotion on BrowserContextOptions, not as a top-level test.use fixture; the original option was ineffective. The test now explicitly enables and verifies the preference before exercising unchanged rendered-output assertions. No runtime change is authorized or needed from this evidence. Root opened the actual example in T3 before reviewing.

Independent final docs check passes0 errors/13 baseline warnings. Full Trunk check passes with no new issues (one existing issue). Root full Chromium sweep exposed a snap-to-origin timing failure: the moving box's x position at80ms was79.095, compared with the required <79 threshold. Root opened `/tests/drag/snap-to-origin` in T3 and requested maintainer classification under the repository's failed-e2e review workflow before changing the test or runtime. An unchanged targeted repeat is diagnostic only; it does not erase the full-run failure. Integrated release readiness remains unchecked pending disposition.

The unchanged snap-to-origin assertion passed3/3 targeted reruns (`.temp/plan-008-snap-review.log`), supporting a timing-sensitivity diagnosis without proving the full gate green. No assertion or runtime was changed; maintainer visual classification remains pending.


### Approved integrated follow-up: snap-to-origin assertion

The maintainer visually approved the “Both axes” return motion and requested review of the timing assertion. Narrowly extend008 scope to `e2e/drag/snap-to-origin.spec.ts`, only the failing intermediate-return assertion. Replace the exact80ms sample with a bounded observation of an actual intermediate return position, preserving displacement thresholds and rejection of an immediate snap. Do not alter runtime, spring settings, or unrelated cases. Run the focused file and prove the revised check still requires visible progress before reaching the origin. The original full failure and unchanged3/3 repeats remain recorded; this is a test timing repair based on explicit visual approval, not a hidden waiver.


Full integrated Chromium run completed:468 passed,1 failed (reviewed snap-to-origin timing assertion),1 flaky (AI glow frame-budget passed on configured retry2),2 pre-existing skips (single-frame momentum and SVG pathOffset). Log: `.temp/plan-008-integrated-browsers.log`; artifacts: `.temp/plan-008-integrated-browser-results`. The performance retries overlapped the docs production build; this is a possible contention factor, not proof of cause. Preserve this result honestly. After the current docs build/test finishes, rerun that performance case without concurrent build to classify it; do not widen its thresholds. The user-approved snap assertion repair receives a focused file run and repeated case. No full-suite-green claim is warranted from combining runs.


### Final scoped review and verification

Independent unchanged self-contained docs command passed12/12 in3.6minutes: fresh package/declarations/publint, normal docs production build, dedicated direct preview, and six real-route cases in each of Chromium/Firefox (`.temp/plan-008-final-docs-browsers.log`). Post-build docs check passes0errors/13existingwarnings (`.temp/plan-008-final-docs-check.log`). No demo source or animation behavior changed. Final scoped source consists of the three new docs harness/spec/workflow files and the maintainer-approved snap assertion repair. The generated animated-tabs registry class-order churn was inspected and restored.

The snap assertion preserves all original displacement and intermediate-position bounds, now retries within1.5seconds rather than choosing one80ms sample, and verifies eventual origin. A page-local forced-origin style makes the same assertion fail (expected x>4, received0), proving an instantaneous snap cannot pass. The focused file passes5/5 and the revised case passes3/3; formatting/lint/diff checks pass. Evidence: `.temp/plan-008-snap-{instant-red,file,repeat,lint}.log`. Root reviewed the complete diff and launched a fresh full Chromium rerun; that final integrated result is pending.

Remote-main check found `b6bfdfde` (`fix(docs): serve a crawlable branded PNG favicon (#483)`) beyond the batch base `c8fbd7a8`. It changes docs favicon/package tooling and workspace/lock data. It is not merged into this shared release branch during008; preserve the current candidate and leave fresh-main reconciliation unchecked until that integration is authorized and validated. Hosted CI is also pending an authorized PR. No push, PR, merge, version, publish, or deployment occurred.


### Final integrated review — APPROVE

The final complete Chromium run passed470 with2 pre-existing skips, no failures and no retries, exit0 in12.9minutes (`.temp/plan-008-final-root.log`, artifacts `.temp/plan-008-final-root-results`). It used the freshly built ae920f1e runtime on5205 plus the reviewed test-only snap assertion. The AI glow frame-budget test passed on its first attempt without a concurrent build. The initial failed/flaky run remains recorded above. No runtime changes followed the coverage/type/package/consumer checks, so their successful evidence applies to this final candidate.

Final gates:954 root units across83files with coverage; rootcheck0errors/35existingwarnings; package/declarations/publint; consumer emitted types+Vite6SSR; normal docs production build; docscheck0errors/13existingwarnings; actualdocs12/12 Chromium+Firefox; complete root470pass/2existing skips; fullTrunk no newissues/1existing plus final changed-test scopedlint; diff integrity. No new skip or retry policy was added. CI workflow matches scoped path triggers and retains reports, but hosted execution is still unverified.

Final diff is exactly2 plan records,3 new docs harness/spec/workflow files, and1 approved existing e2e assertion edit. The SVG demo source hash is unchanged; manifest, lockfile, runtime, and generated registry files are clean. All008 source remains uncommitted for the maintainer's review checkpoint on chore/motion-upstream-refresh. User-facing docs5199 and root5205 servers remain available. T3's SVG route reload succeeds with both paths atdash0.65px/1px andoffset0.

All eight selected plans are locally implemented and verified. This does not claim release readiness: integration of newer origin/main b6bfdfde, final release-note review, and hosted PR checks remain separate steps. No release action occurred.


Maintainer visual approval received2026-09-26 (“Looks great!”). The008 implementation and plan records remain uncommitted; all scoped implementation/visual verification is complete.
