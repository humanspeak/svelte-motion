# Upstream parity and verification checklist

Audited 2026-09-24 against `6f0085ef` on `chore/motion-upstream-refresh`.
All eight findings selected by the maintainer. Implementation plans are ready; plan 001 is implemented and visually approved by the user. Plans 002 and 003 are complete and independently reviewed. Plan 003 is visually approved; plan 004 is executing. Continue one plan at a time. Generated with the improve skill on 2026-09-24.

## Execution order and status

Plan numbering follows execution order; audit finding IDs below remain unchanged so earlier discussion stays traceable. Each plan is self-contained. Read it fully, reconcile baseline drift, follow its scope and STOP conditions, and update this table with evidence when finished.

| Plan | Finding | Deliverable | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [001](001-docs-verification.md) | 04 | Green docs types and enforced CI checks | P1 | S | — | DONE — 9307ece4; user visually approved |
| [002](002-ci-triggers.md) | 05 | Test-only changes trigger tests | P1 | S | — | DONE — b0fdb49e |
| [003](003-exit-promise-guard.md) | 01 | Upstream stale-exit promise guard and adapter protection | P1 | S | 001 | DONE — c0389a83; user visually approved |
| [004](004-drag-origin-resize.md) | 02 | Upstream resting drag-origin preservation | P1 | S | 001 | IN PROGRESS |
| [005](005-constraint-observers.md) | 06 | Resize observation follows replacement constraints | P1 | S | 004 | TODO |
| [006](006-reorder-declarations.md) | 03 | Emitted Reorder types and consumer inference gate | P1 | S | 001, 002 | TODO |
| [007](007-descendant-exit-registry.md) | 07 | All owned motion descendants finish before automatic removal | P1 | M | 001, 003 | TODO |
| [008](008-svg-firefox-coverage.md) | 08 | Actual SVG docs route tested in Chromium and Firefox | P1 | M | 001, 002; integrated release gate after all | TODO |

Status values: TODO, IN PROGRESS, DONE, BLOCKED (reason), REJECTED (reason). Keep TODO until execution actually begins; a written plan is not a completed fix. S/M estimates include regression coverage and are rough, not deadlines.

### Execution records

For each completed plan record: execution base and commit, red failure, green focused results, package/type checks, browser projects/routes, and any unresolved limitation.

- **001 started:** refreshed origin/main is c8fbd7a8, with no in-scope drift from the audited baseline. Executor is preparing branch fix/upstream-docs-verification in /Users/jasonkummerl/Github/svelte-motion-upstream-001 and integrating the three reviewed refresh commits. Visual review will use docs port 5202 to leave the existing 5199 server untouched. User requested one plan at a time, visual output, then the next plan; do not dispatch 002 before the review checkpoint.
- **001 reconciliation:** isolated baseline is 9947bba2 (reviewed commits integrated as 870198ce, fa0dbd06, 9947bba2). Fresh install/package pass. Before docs generation, checker reports 77 errors/13 warnings: five expected example errors, 71 missing generated-input errors, and the optional PostHog token error that the warm audit environment did not reproduce. Plan now reuses the existing docs build before docs checks and narrowly includes optional server analytics guards/tests plus the caller. No environment files or credentials are copied. Execution resumed after the plan was corrected; this setup discovery is not waived.
- **001 characterization reconciliation:** controls.set populated static latestValues but did not create a live x MotionValue in the mocked unit fixture, yielding a misleading reset. Establishing the live position via controls.start (the real demo's Drift/Nudge path) preserves the original held-x=35 assertion; focused suite passes 23/23. Independent Chromium baseline verified interruption remains away from the origin. No engine changes or weaker hold assertion were introduced.

### Release readiness checklist

Run these on the final integrated candidate, not on a mixture of individual branch outputs. Do not repeat broad suites after every small step; plans use focused regressions, and the final candidate receives the combined gates.

- [ ] All eight plan rows are DONE with evidence, or an explicit maintainer-approved disposition explains an exception.
- [ ] Fresh main has been reconciled in an isolated release branch, including the reviewed upstream-refresh commits and all plan dependencies; user worktrees/stashes remain intact.
- [ ] `pnpm check` and `pnpm package` pass, with no missing Reorder declaration or hidden declaration emit error.
- [ ] `pnpm --dir docs check` passes with zero errors.
- [ ] `pnpm test` passes the full root suite with coverage.
- [ ] `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` passes runtime and emitted-type consumer checks.
- [ ] `pnpm exec playwright test --project=chromium` passes the full root browser suite.
- [ ] `pnpm exec playwright test --config docs/playwright.config.ts` passes Chromium and Firefox on the real docs route, including the recorded deliberate-regression proof.
- [ ] `pnpm --dir docs build`, `trunk check`, and `git diff --check` pass; generated registry churn is reviewed and excluded when unrelated.
- [ ] Focused visual handoff covers `/tests/drag/element-ref-resize`, `/tests/use-presence`, `/examples/use-presence`, `/examples/keyframes`, `/examples/transform-template`, and `/examples/svg-css-variables`. Preserve the existing `/examples/use-follow-value` and `/tests/effects/three` as additional reviewed upgrade examples.
- [ ] Runtime/type fixes have patch changesets, and release notes distinguish inherited upstream improvements from Svelte adapter fixes and coverage work.
- [ ] Hosted PR checks pass when an authorized PR is opened. Local validation alone does not count as hosted CI evidence.

Publishing, versioning, merging, and deployment are outside this planning batch. No release-readiness box is checked by this audit.

### Plan 001 review result — APPROVE

- Commit: 9307ece48a996bf8d19feefbb197f22214082468, branch fix/upstream-docs-verification, worktree /Users/jasonkummerl/Github/svelte-motion-upstream-001. Ten approved files; clean worktree; normal commit hooks passed. No merge, push, deployment, or publication.
- Red evidence: generated baseline checker 6 errors/13 warnings; optional analytics regression 5 expected failures plus 1 configured pass. The initial 77 errors included absent generated docs inputs and are not waived.
- Independent reviewer reruns: root unit suite 82 files/914 tests passed; root typecheck 0 errors/35 warnings; package/publint passed; normal docs production build passed; docs typecheck 0 errors/13 warnings; PostHog server tests 6/6; Trunk checked 33 modified files with no issues; diff check passed. Logs are under the worktree's ignored .temp/plan-001/reviewer-*.log.
- Executor additionally proved ignored generated-input removal → normal docs build → docs check succeeds. CI ordering was reconciled accordingly. Existing Reorder declaration diagnostics remain explicitly deferred to plan 006; this plan does not claim they are repaired.
- Actual docs browser smoke passed in Chromium and Firefox: settled x=30 stays held through Pulse, interrupted Drift holds the sampled position, Reset restores origin; transform-template Apply/Back and Reset during playback all pass, with no page errors. These were focused browser checks, not a full root e2e run or the future permanent SVG suite.
- Analytics-free /r/animated-button.json serves HTTP200 with the expected payload/CORS header. Vite dev overrides cache-control to no-cache, so the actual route handler was separately executed in memory with no analytics and verified to retain public, s-maxage=300, stale-while-revalidate=86400. The initial dev-header assertion was corrected as a verification-environment mismatch, with no source change.
- Reviewer-owned docs process: PID92015, tool session33889, listening on127.0.0.1:5202 from the isolated worktree. Review URLs: http://localhost:5202/examples/keyframes (second demo) and http://localhost:5202/examples/transform-template. Collaborative preview tabs tab_d and tab_e are loaded at those pages.
- User visual checkpoint complete: confirmed Reset deliberately snaps via progress.jump(0), while Back animates the return; user conditionally approved on that confirmation. Plan002 may proceed.
- Plan002 started from refreshed origin/main c8fbd7a8 with no workflow-scope drift; isolated worktree /Users/jasonkummerl/Github/svelte-motion-upstream-002 will include the approved cumulative commits. The001preview remains unchanged.

### Plan 002 review result — APPROVE

- Commit: b0fdb49ea07ac26731dd769d52236624076ec1e1, branch fix/upstream-ci-triggers, worktree /Users/jasonkummerl/Github/svelte-motion-upstream-002. Fresh origin/main c8fbd7a8 with approved cumulative baseline e1e0a9f3 (35266773, f56c8c30, a859c5d5, e1e0a9f3). Exactly one file and three additions; normal hooks passed; worktree clean. No merge, push, or hosted PR.
- Implementation adds e2e/**, vitest.config.*, and vitest.setup.* to the test workflow's pull-request paths. Full diff reviewed; job bodies, permissions, branches, actions, and existing path rules preserved.
- Independent before/after representative path checks prove the three missing cases were excluded and are now included. Existing source, consumer-test, and workflow paths remain included; docs-only prose remains excluded. This local matcher does not replace hosted GitHub trigger confirmation.
- Fresh setup initially lacked package output for consumer type resolution and raced first SvelteKit generation against Vitest. Running the existing package build, then typecheck, then units resolved these setup failures without source changes. The plan now records this prerequisite. Package succeeds with the already-known Reorder declaration diagnostic reserved for plan 006.
- Final executor and independent reviewer gates passed: root typecheck 0 errors/35 existing warnings; all 82 unit files/914 tests; scoped workflow Trunk and full Trunk (34 modified files, no issues); representative filters; diff integrity. Executor also completed frozen install and scoped formatting. Reviewer logs: ignored .temp/plan-002/reviewer-{check,units,trunk}.log in the isolated worktree.
- No new runtime/browser surface. Plan 001's approved preview remains available on port 5202. Plan 003 remains TODO for the next review cycle; no full e2e, docs rebuild, or hosted workflow was claimed for this configuration-only step.

### Plan 003 review result — APPROVE; user visually approved

- Implementation: c0389a833d6babc2c73c4542879b2e09684f7c24 on fix/upstream-exit-promise-guard, worktree /Users/jasonkummerl/Github/svelte-motion-upstream-003. Fresh main c8fbd7a8 with the approved cumulative predecessors and plan snapshot 5da7ce4e. Seven scoped implementation files, normal hooks passed, clean implementation commit; no push, merge, or publication.
- At the user's request, all eight plans plus this checklist were committed separately on the 002 branch as ef03c8dfaa22d5cc8a33a45396b370f86e1745d3, then carried into 003 as 5da7ce4e. This review record and plan 003 status are included in a follow-up docs commit on the 003 branch. Primary worktree plans and unrelated .competitive-intel/state.json remain untouched by source execution.
- Reuses upstream motion a47d6f25f's active-promise identity guard in the existing Svelte exit feature. Adapter captures the already-versioned safeToRemove callback at context creation. No new engine, dependency, public API, descendant registry, or unrelated initial-animation change.
- Red proof: two controlled-promise tests failed specifically because stale exits notified completion. They pass with the upstream guard. Separately restoring only the old adapter getter caused the real-node callback regression to fail with the child missing; restoring capture passed. Component integration preserves actual setActive behavior, defers only completion, and asserts DOM identity, stale-callback rejection, final removal, and balanced parent notifications.
- Added a replayable owned-motion section to the already-indexed /tests/use-presence page, with Hide/Show, Replay hide/show/hide, Reset, phase feedback, and timer cleanup. Two new e2e cases cover replay/identity/completion and reset cancellation. Reused the existing unit harness unchanged. Patch changeset included.
- Executor gates: frozen install, focused units 79/79, full units 82 files/918 tests, root check 0 errors/35 warnings, package/publint success, normal docs production build success, docs check 0 errors/13 warnings, targeted production Chromium 9/9, formatting, Trunk, and diff check passed. Generated registry noise restored.
- Independent reviewer gates: full units 918/918, root check 0 errors/35 warnings, package/publint success, docs check 0 errors/13 warnings, targeted production Chromium 9/9, full diff/test review, Trunk and diff check passed. Logs are ignored .temp/plan-003/reviewer-*.log. Trunk reports no new issues and one existing eslint/unbound-method finding at _MotionContainer.svelte:425 in unchanged readLiveChannelValue code; verified against baseline. Known Reorder declaration diagnostics remain reserved for plan 006.
- Verification limitation disclosed: an exploratory reviewer run against the dev server had 8/9 failures because SSR controls were clicked before client hydration, while builds/sync were refreshing generated inputs. Diagnostic browser interaction succeeded after hydration; unchanged tests then passed 9/9 against the production preview. No implementation or test assertions were changed to address those environment failures. No full root e2e or Firefox suite was run for this step.
- Visual smoke sampled the same real node through exit A, re-entry, and exit B; at 1196ms it was still fading through B, and after completion it was removed. The review tab is tab_f at http://localhost:5203/tests/use-presence, scrolled to the owned-motion section. Persistent root-owned production preview session 94923 serves the actual tested checkout; earlier 5202 preview is preserved. User eye-test approval received on 2026-09-25, with explicit authorization to proceed to 004.

## Prioritized checklist

All findings have HIGH confidence. S = hours; M = roughly a day including regression coverage.

| Done | ID | Finding / impact | Category | Effort | Fix risk | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| [x] | 01 | Invalidate stale exit promises: an old exit can complete a newer exit and remove its DOM early. | Correctness / upstream parity | S | Low: localized lifecycle guard | `src/lib/utils/visualElementCore.ts:226`; `src/lib/html/_MotionContainer.svelte:387` |
| [ ] | 02 | Preserve zero drag offsets on constraint resize: an untouched, off-center draggable moves when its container shrinks. | Correctness / upstream parity | S | Medium: preserve authored transforms and per-axis ownership | `src/lib/utils/drag.ts:567` |
| [ ] | 03 | Emit the public Reorder declaration: current package output re-exports a missing declaration, silently degrading the import to `any` with skipLibCheck. | Consumer types | S | Low: preserve generic component inference | `src/lib/reorder.ts:22`; `dist/index.d.ts:13`; `.agents/.plans-closed/motion-13.2-effects/README.md:93` |
| [x] | 04 | Restore docs typechecking and gate it in CI: five current errors in copyable examples can pass build-only verification. | Verification / docs | S | Low: example corrections and CI gate | `docs/src/lib/examples/keyframes/demos/Wildcard.svelte:36`; `docs/src/lib/examples/transform-template/demos/Default.svelte:14`; `.github/workflows/pr-build.yml:77` |
| [x] | 05 | Trigger test CI for test-only changes: e2e and Vitest configuration/setup changes are missing from the workflow path filter. | CI | S | Low: additional relevant CI executions | `.github/workflows/run-tests.yml:12` |
| [ ] | 06 | Rebind resize observation when constraint refs change: a replacement container is measured once but never observed for later resizing. | Correctness | S | Low: observer lifecycle must preserve the pointer session | `src/lib/utils/drag.ts:456`; `src/lib/utils/drag.ts:600`; `src/lib/html/_MotionContainer.svelte:1618` |
| [ ] | 07 | Wait for every motion descendant in an owned exit: the fastest descendant currently removes the whole held subtree. Correct the contradictory usePresence docs alongside the contract. | Correctness / docs | M | Medium: registration, re-entry, teardown, and manual completion interact | `src/lib/html/_MotionContainer.svelte:385`; `src/lib/components/PresenceChild.svelte:117`; `docs/src/routes/docs/use-presence/+page.svx:137` |
| [ ] | 08 | Add Chromium and Firefox regression coverage for the actual SVG CSS-variable docs example: existing browser suites do not protect the repaired Firefox behavior. | Browser coverage | M | Low: bounded docs suite with rendering assertions | `docs/src/lib/examples/svg-css-variables/demos/Default.svelte:175`; `playwright.config.ts:46`; `docs/vite.config.ts:204` |

## Verification targets for selected plans

1. Controlled promises: exit A → reenter → exit B → resolve A must retain B; only resolving B may complete its exit. Existing mid-exit unit coverage omits the completion callback. Follow upstream `a47d6f25f`'s active-promise guard; do not invent a replacement animation engine.
2. ResizeObserver regression with container [0,400], card [40,120], x=0: shrinking the container to [0,200] must leave x=0. Current actual-attachDrag probe produces x=-25. Adapt upstream `78fca61b7`'s per-axis origin preservation; retain nonzero-offset remapping and inertia behavior.
3. Fresh package output must include `dist/reorder.d.ts`; consumer typing must reject invalid props and prove Reorder is not `any`, preserving generic value inference. Current in-memory strict consumer accepts assigning Reorder to a number with skipLibCheck. No fresh build was performed during this audit.
4. Root and docs checks must run in the relevant CI jobs. Docs svelte-check currently reports 5 errors and 13 warnings: scalar-null animation target and state/$state name collision. Resolve these without casts or suppressions; investigate intended scalar-null semantics before changing API types.
5. Verify trigger coverage for `e2e/**`, `vitest.config.ts`, and `vitest.setup.ts`, as well as the existing source/config inputs.
6. Test A→B, numeric→B, and B→numeric constraint changes. Observe the current ref, disconnect obsolete targets, preserve active pointer sessions, and clean up at teardown. Actual-attachDrag probe confirms A→B currently keeps observing only the card and A.
7. Two descendants with controlled exit durations: first completion must retain the subtree; last completion removes it exactly once. Cover re-entry, descendant destruction, and the chosen manual usePresence interaction. This finding is established by source control flow; no full component reproduction was run in the audit.
8. Exercise Draw, Erase, trim sliders, and replay on the docs route in Chromium and Firefox. Assert valid rendered dash behavior, not merely changing CSS variables. Temporarily restoring the old unitless calc expressions in an implementation worktree must make Firefox coverage fail.

## Execution order and dependencies

- All eight audit findings are selected. Follow the plan-number execution table above, not the priority-ranked finding numbers.
- Plans 001 and 002 establish reliable verification before broader changes.
- Plan 003 precedes 007: descendant registration must inherit reliable cycle cancellation; both touch the presence adapter.
- Plans 004 and 005 run sequentially because both change drag constraint-resize code and its demo/tests.
- Plan 006 is independent of drag/presence fixes after verification setup. Plan 008 can establish its browser harness after 001/002, but its final integrated release gate runs after all plans.
- Every plan uses Trunk (`trunk check`, `trunk fmt`) as the lint/format authority and defines red-first regressions or an explicit type/tooling/already-fixed exception.
- Preserve the existing public-upstream-reuse boundary. Reuse exported upstream functionality where available; otherwise adapt only the necessary Svelte lifecycle logic with upstream attribution. Do not import private React implementation files.
- Plan 007 preserves manual `safeToRemove` as an explicit wrapper-level release. It adds all-descendant coordination to automatic motion completion; it does not silently introduce a new manual-hook registration API. The docs and tests must state this boundary.

## Direction

Prioritize parity and regression protection over adding another feature surface. Shared Motion performance/easing/SVG-engine changes already arrive through the dependency upgrade. Existing spring followers are already implemented; do not duplicate them. No additional feature proposal was sufficiently justified by this pass.

## Considered and rejected

- Independently porting the upstream blockInitialAnimation reset: no separate reachable public defect established; the retained key-change path already clears it, while completed owned exits unmount descendants.
- Replacing the clone-exit architecture: explicitly retained by prior design decisions. Item 07 concerns the existing real-node adapter only.
- Changing already-versioned manual safeToRemove callbacks: their identity guard works; item 01 concerns the adapter's late callback lookup.
- Reimplementing spring/follower optimizations, easing fallback, or the SVG style writer: inherited from shared upstream dependencies.
- Adding a public inspector API around upstream's private global hooks: no public API contract supports that reuse.
- Porting React 19.3 AnimateView or Suspense behavior directly: React-specific integration is not a Svelte feature gap by itself.
- PostHog as a sixth docs type error: did not reproduce in the warm audit environment, but DOES reproduce in the fresh execution checkout. This rejection is superseded; plan 001 now includes optional server analytics configuration handling and a regression test.
- Generic SSRF, missing security headers, or dependency-age claims: inspected paths did not substantiate them. Production dependency audit found no high/critical advisories (one low).
- Reorder auto-scroll coordinate mismatch: implementation uses raw client coordinates correctly; a stale comment alone does not establish a runtime bug.

## Scope and limitations

Standard, hotspot-weighted audit across correctness, security, performance, tests, architecture, dependencies, tooling, docs, and direction. Focused on upstream Motion 13.2–13.4.4 changes, local presence/drag adapters, package declarations, and verification paths. This is not an exhaustive review of every animation, layout, scroll, or deployment path. No performance benchmarks, fresh package build, full unit/e2e run, hosted workflow run, or WebKit verification was performed during this audit. Source files were not modified.

The existing transform-page-point and clone-exit-migration batches were reviewed to avoid duplicating their design work. Item 03 was explicitly deferred in the closed Motion 13.2 effects batch; it remains unresolved.

- **003 started (2026-09-25):** user authorized the next step. Fresh main remains c8fbd7a8; no runtime scope drift. Plan reconciled for a replayable owned-motion section on the existing use-presence test page and its e2e coverage, plus known fresh-checkout build/sync prerequisites. Isolated cumulative execution follows 002; primary worktree changes remain untouched.

- **004 started (2026-09-25):** user visually approved 003 and authorized 004. Fresh main c8fbd7a8; no in-scope drift. Execute in a fresh isolated cumulative branch, preserve existing servers, and use the production resize demo for the next visual checkpoint. Plan 003 implementation c0389a83 and evidence docs 0f447abe are already committed.
