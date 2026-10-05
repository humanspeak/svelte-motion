# Guard report — 001 portable Chromium

**Recommendation: PASS** — pinned-first Chromium fallback works across all three consumers; combined docs units pass with only the two approved mirror writers isolated during Vitest; production generation preserved.

**Reviewed at** 7cdf6076 · 2026-10-05 17:20 · **Plan planned at** db7223a7

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Named launch-options regression failed before config changes and passes afterward. | met | Historical red.log has undefined launchOptions assertion; independent original23 and latest28focused tests pass. |
| Resolver branch/platform tests pass, and both Playwright configs use the shared helper. | met | Independent focused28pass; full contribution diff read. |
| Docs client project discovers/passes its browser smoke; configured provider uses helper output. | met | Normal combined docs units include real client smoke: four files/13tests pass on Node26 and pinnedNode24. |
| Existing root SSR/hydration smoke and docs Chromium/Firefox e2e pass. | met | Prior independently verified unchanged root SSR/hydration2pass reused as approved; latest production docs e2e12pass (six each). |
| Real helper-selected browser smoke passes; actual cloud validation is distinguished from local simulation. | met | Earlier independent externalChromium149.0.7827.55 text probe reused for unchanged helper; actual cloud image untested. |
| pnpm test, docs tests, package, root/docs checks/build, scoped Trunk, and diff checks pass. | met | Independent root92files/1142tests and docs4files/13tests on Node26 and24; production docs build/check0errors; fresh e2e package/publint0; root types via normal snapshot hook0; scopedTrunk/diff pass. |
| Each workflow filter includes shared helper; pinned installation remains unchanged. | met | One helper path per three workflows, browser-install commands retained; original independent audit reused. |
| git diff -- package.json docs/package.json pnpm-lock.yaml is empty; no out-of-scope edits. | met | Empty dependency diff; full scope audit of original plus two operator-approved amendments. Generated registry churn restored by executor; independent clean status at15f93ed7. |
| README status and verification evidence updated. | met | README001DONE and002INPROGRESS; append-only log and this report. |
| Approved isolation: named red regression, only two writers absent during Vitest, both retained otherwise. | met | Historical round3red registers mirror writer; independent5config cases within28focused prove true/unset/false branches, retained plugin order and projects. |
| Approved isolation: normal combined docs units and production build/output checks and Chromium/Firefox e2e pass. | met | Independent combined command13pass; production outputs deleted only after confirming ignored status, regenerated2327-byte mirror and306086-byte full reference containing entire exact mirror after manual/e2ebuild; VITESTunset; docs e2e12pass. |

Independent logs: `.temp/cloud-session-001/guard-round3/`; earlier unchanged-gate evidence in `guard/` and `guard-round2/`. Executor historical red logs in round3/red.log and original red.log. No PR opened: this batch remains in progress and publication requires a separate request.

## Spirit

Installed Chromium can be selected when the pinned executable is absent without altering pinned CI or Firefox. Tests genuinely launch the browser and exercise config wiring. The newly active docs client/server combined workflow remains green after isolating only conflicting publication writers during Vitest, while normal production builds still create both mirror/reference outputs.

## Scope & conduct

- Snapshot7cdf6076 changes only docs/vite.config.ts and new actual-config test. Original implementation and approved SEOcount correction retained. All Motion/package pins and runtime code untouched.
- Operator explicitly approved obsolete browser-setting removal, exact SEOcount67→68, and Vitest-only omission of two named writers with extra regression/production checks. Plan history/amendments at a97c05bd and5ab9a905; no gate waived.
- Guard authored no source. Executor restored generated registry output only after inspecting its diff; independent status clean. Plans/logs/reports committed separately from source snapshots.
- No assertion weakening, timeout increases, browser-cache changes, sandbox flags, Firefox edits or publishing.

## Residual risk / follow-ups

- Actual Claude cloud image/fetch behavior remains untested; external Chromium proof is local supplementary evidence.
- Shell default was Node26.10.0. Unit suites additionally pass with project-pinned Node24.18.0; production build/e2e gates used Node26. Documentation retains Node24/pnpm12.6pins; Plan002 executor will explicitly use installedNode24.
- One Node24 docs unit run during concurrent productionbuild hit existingPostHog first-import5stimeout. A normal full combined rerun after build/e2e processes finished passed13/13 without changes. Failed log retained; do not claim the harness is flake-free. Earlier watcher ENOENT did not recur after isolation.
- Actual-config child import uses about5sof default10shook allowance; latest full/focused runs pass. No timeout policy changed.
- Docs-kit mirror/watch coordination in normal development remains outside this narrow unit-test isolation.
