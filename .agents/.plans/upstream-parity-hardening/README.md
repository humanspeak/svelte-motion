# Upstream parity and verification checklist

Audited 2026-09-24 against `6f0085ef` on `chore/motion-upstream-refresh`.
All eight findings selected by the maintainer are locally implemented and verified, including the user-approved Reorder and owned-exit fixes. Plan008 is complete and awaits commit on the same shared branch. Generated with the improve skill on2026-09-24.

## Execution order and status

Plan numbering follows execution order; audit finding IDs below remain unchanged so earlier discussion stays traceable. Each plan is self-contained. Read it fully, reconcile baseline drift, follow its scope and STOP conditions, and update this table with evidence when finished.

| Plan | Finding | Deliverable | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [001](001-docs-verification.md) | 04 | Green docs types and enforced CI checks | P1 | S | — | DONE — d5245adb on shared branch; user visually approved |
| [002](002-ci-triggers.md) | 05 | Test-only changes trigger tests | P1 | S | — | DONE — 135e5297 on shared branch |
| [003](003-exit-promise-guard.md) | 01 | Upstream stale-exit promise guard and adapter protection | P1 | S | 001 | DONE — 9567fcc6 on shared branch; user visually approved |
| [004](004-drag-origin-resize.md) | 02 | Upstream resting drag-origin preservation | P1 | S | 001 | DONE — 356e4ced; guided page b10243d8 on shared branch; user visually approved |
| [005](005-constraint-observers.md) | 06 | Resize observation follows replacement constraints | P1 | S | 004 | DONE — user approved; ref-switch and held-resize parity verified against React Motion 13.4.4 |
| [006](006-reorder-declarations.md) | 03 | Emitted Reorder types and consumer inference gate | P1 | S | 001, 002 | DONE — declaration fix29069bd3 and runtime follow-up verified; user visually approved |
| [007](007-descendant-exit-registry.md) | 07 | All owned motion descendants finish before automatic removal | P1 | M | 001, 003 | DONE — all-descendant exits and re-entry verified; maintainer visually approved |
| [008](008-svg-firefox-coverage.md) | 08 | Actual SVG docs route tested in Chromium and Firefox | P1 | M | 001, 002; integrated release gate after all | DONE — 12/12 docs browsers; 470 root browsers pass, 2 existing skips; uncommitted review checkpoint |

Status values: TODO, IN PROGRESS, DONE, BLOCKED (reason), REJECTED (reason). Keep TODO until execution actually begins; a written plan is not a completed fix. S/M estimates include regression coverage and are rough, not deadlines.

Plan 004 [visual review follow-up](004-visual-review-follow-up.md) is DONE and user visually approved. Source commit 5291c8b5 and plan commits 13f44fee/a42d99d1 are complete. User authorized proceeding to 005. Fresh origin/main remains c8fbd7a8; cumulative reviewed baseline is a42d99d1. Plan 005 will reuse Motion's public resize subscriptions and retain the guided review layout on a separate preview.

### Plan005 final review — APPROVE; upstream parity and user approval complete

- Old delayed-switch coverage used equal-size bounds and missed the user's case. New regression failed with 140 px left overflow; three active element/numeric unit transitions also failed before the runtime correction.
- Fresh element bounds now pair with the current applied offset during a held drag, while numeric bounds use zero; pointer origin and session are preserved. Countdown visibly runs 3 → 2 → 1, with Reset cancellation covered. The meter's separate 2 px border false alarm was reproduced and corrected without widening tolerance.
- Independent 934 units, root types (0 errors/35 existing warnings), and final 18 Chromium checks pass. Executor production/package/publint and scoped lint pass with existing Reorder diagnostics deferred to 006. T3 confirms countdown and 0 px / Inside bounds at a legal edge. Full evidence is in plan005.
- Source, regression tests, changeset, and plan records belong together on chore/motion-upstream-refresh. Preview: http://localhost:5205/tests/drag/element-ref-resize#live-targets, primary final build, tab_2. User visually approved after upstream parity verification; 006 stays unstarted.

Stationary-pointer parity: actual React Motion 13.4.4 and Svelte both automatically move into smaller B within 100 ms while the pointer stays held, with no additional pointermove and no drag restart (x200 → 82; overflow118 → 0). The existing regression now also checks containment before any post-switch pointermove. Continuous frame updates explain this behavior; the earlier explanation that another physical move was required was incorrect. The user's conditional visual approval of that exact switch is satisfied. The same-ref control exposed stale bounds during held resize; removing one early dragging guard fixed it. Final React/Svelte comparisons now match both cases. Independent 935 units and 19 Chromium checks pass, with focused56, rootcheck, build/package, and scoped lint green. Plan005 is complete; see plan005 for red/green evidence and upstream references.

### Plan005 original review result — APPROVE

- Source ab210b3a uses Motion's public resize subscriptions, with local target ownership and callback invalidation. Five scoped files, no dependency/API changes. New section03 reuses the guided page and metrics component.
- Red: five lifecycle failures and two passes after fresh generated setup. Green independently rerun:931 full units,52 drag/inertia units,15 Chromium checks; root check0 errors/35 existing warnings; package/publint pass with known006 Reorder diagnostics; normal docs build and docs check0 errors/13 existing warnings; Trunk no new issues/one existing; diff integrity pass. See005 plan for fixture/setup reconciliations and log paths.
- Source and prep commits used normal hooks. Verified unrelated generated registry class-order churn was restored. No merge, push, PR, publication or deployment.
- Visual review: http://localhost:5205/tests/drag/element-ref-resize#live-targets, purple section03, visible in collaborative tab_2. Old5204 preview retained. User review pending;006 unstarted.
- The user selected chore/motion-upstream-refresh as the shared release branch. All reviewed source through005 is now consolidated there, with committed plan records. This supersedes per-plan fresh-branch instructions for remaining plans: do not create more per-plan branches by default. Prior isolated branches remain historical verification checkpoints.
- Consolidation completed without conflicts: docs baseline d5245adb, CI 135e5297, presence 9567fcc6, Motion 13.4.4 upgrade 01193714, resting drag 356e4ced, guided page b10243d8, live observers e83cde23. Before this final status note, the entire tracked tree on the shared branch matched tested 005 exactly (including plan records). No user changes were discarded; earlier branches and preview servers were retained.

- Integration validation in the shared checkout: pinned frozen install passed; installed motion and motion-dom are both13.4.4. Package/publint passed (known Reorder declaration diagnostics remain deferred006), root check passed with0 errors/35 existing warnings, and focused drag/inertia smoke passed52/52. Tracked non-plan files remain byte-identical to the tested005 tree; no manifest or lockfile drift.

### Execution records

For each completed plan record: execution base and commit, red failure, green focused results, package/type checks, browser projects/routes, and any unresolved limitation.

- **001 started:** refreshed origin/main is c8fbd7a8, with no in-scope drift from the audited baseline. Executor is preparing branch fix/upstream-docs-verification in /Users/jasonkummerl/Github/svelte-motion-upstream-001 and integrating the three reviewed refresh commits. Visual review will use docs port 5202 to leave the existing 5199 server untouched. User requested one plan at a time, visual output, then the next plan; do not dispatch 002 before the review checkpoint.
- **001 reconciliation:** isolated baseline is 9947bba2 (reviewed commits integrated as 870198ce, fa0dbd06, 9947bba2). Fresh install/package pass. Before docs generation, checker reports 77 errors/13 warnings: five expected example errors, 71 missing generated-input errors, and the optional PostHog token error that the warm audit environment did not reproduce. Plan now reuses the existing docs build before docs checks and narrowly includes optional server analytics guards/tests plus the caller. No environment files or credentials are copied. Execution resumed after the plan was corrected; this setup discovery is not waived.
- **001 characterization reconciliation:** controls.set populated static latestValues but did not create a live x MotionValue in the mocked unit fixture, yielding a misleading reset. Establishing the live position via controls.start (the real demo's Drift/Nudge path) preserves the original held-x=35 assertion; focused suite passes 23/23. Independent Chromium baseline verified interruption remains away from the origin. No engine changes or weaker hold assertion were introduced.

### Release readiness checklist

Run these on the final integrated candidate, not on a mixture of individual branch outputs. Do not repeat broad suites after every small step; plans use focused regressions, and the final candidate receives the combined gates.

- [x] All eight plan rows are DONE with evidence, or an explicit maintainer-approved disposition explains an exception.
- [ ] Fresh main has been reconciled with the shared release branch chore/motion-upstream-refresh, including all reviewed plan dependencies; user worktrees/stashes remain intact. The maintainer's shared-branch workflow supersedes the original per-plan isolation instruction.
- [x] `pnpm check` and `pnpm package` pass, with no missing Reorder declaration or hidden declaration emit error.
- [x] `pnpm --dir docs check` passes with zero errors.
- [x] `pnpm test` passes the full root suite with coverage.
- [x] `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` passes runtime and emitted-type consumer checks.
- [x] `pnpm exec playwright test --project=chromium` passes the full root browser suite.
- [x] `pnpm exec playwright test --config docs/playwright.config.ts` passes Chromium and Firefox on the real docs route, including the recorded deliberate-regression proof.
- [x] `pnpm --dir docs build`, `trunk check`, and `git diff --check` pass; generated registry churn is reviewed and excluded when unrelated.
- [x] Focused visual handoff covers `/tests/drag/element-ref-resize`, `/tests/use-presence`, `/examples/use-presence`, `/examples/keyframes`, `/examples/transform-template`, and `/examples/svg-css-variables`. Preserve the existing `/examples/use-follow-value` and `/tests/effects/three` as additional reviewed upgrade examples.
- [ ] Runtime/type fixes have patch changesets, and release notes distinguish inherited upstream improvements from Svelte adapter fixes and coverage work.
- [x] Resolve or document the upstream Motion13.4.4 HTMLWebViewElement failure when checking dependency declarations with skipLibCheck:false; it reproduces without svelte-motion (see006).
- [ ] Hosted PR checks pass when an authorized PR is opened. Local validation alone does not count as hosted CI evidence.

Publishing, versioning, merging, and deployment are outside this planning batch. The original audit checked no release-readiness boxes. Checked items now reflect recorded execution evidence; remaining integration and hosted-CI requirements stay explicit.

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

### Plan 004 review result — APPROVE; user visual checkpoint pending

- Implementation: f1393887f4f9d233e2519df516ccd591cee58a6d, branch fix/upstream-drag-origin-resize, worktree /Users/jasonkummerl/Github/svelte-motion-upstream-004. Fresh main c8fbd7a8 had no in-scope drift; cumulative approved predecessors were integrated, followed by prep docs 48015480, intel 265a6ff9, and dependency baseline 1ecdd5e1. Exactly five implementation files; normal hooks passed and source worktree clean. No push, merge, publishing, or 005 work.
- The user explicitly requested primary-checkout commits after noticing raw/untracked plans. All nine plans/checklist files are now tracked there in 7b91916d; existing competitive-intel content was committed separately as 54d9b005 and carried into 004 as 265a6ff9. JSON validation and byte comparison confirmed unchanged snapshot content. Future plan edits must remain tracked and be committed in the primary checkout as well as the execution branch. This final 004 record is included in separate docs commits in both checkouts.
- The user confirmed 13.4.4 availability during execution. npm metadata and installed package files were verified. Separate dependency commit 1ecdd5e1 updates motion and motion-dom to ^13.4.4, resolves framer-motion 13.4.4 transitively, and adds a patch changeset. The lock diff contains only these three package upgrades; motion-utils remains 13.3.0. No unrelated dependency or library release-version changes.
- Runtime adapts upstream motion 78fca61b7: refresh constraints, then skip zero applied offsets independently per axis. Optional per-axis flags on the existing writer prevent a resize on y from overwriting or adopting a skipped, independently controlled x value. Other callers retain their existing default write behavior. No observer replacement, inertia engine, public API, or axis-handoff redesign.
- Red proof reproduced both before and after the 13.4.4 upgrade: untouched x=0 moved to -25; mixed x=0/y=80 changed x incorrectly; authored x=20 moved; independently updated bound x=25 was overwritten. Nonzero x remapping characterization passed. All five regressions/characterizations now pass through shrink/grow. The unit fixture uses actual attachDrag, controlled ResizeObserver delivery, real MotionValues, and the existing VisualElement stub/writer.
- Reconciliations: the fixture's original transform string was empty, so its post-fix assertion now checks exact preservation instead of expecting the equivalent string none. Root typecheck caught the stub's Record<string, unknown> being passed into the transform formatter; the test renderer now narrows numeric fixture values without suppressions/casts. Neither required changing the runtime fix or weakening position/composition assertions. Final focused reruns passed after both corrections.
- Extended the existing resize page with an asymmetric blue card, imperative Shrink/Grow controls, and Reset. Browser coverage proves client hydration/remount before DOM-only resize, waits for ResizeObserver plus frame delivery, checks repeated resting-position preservation, verifies nonzero remapping, and exercises Reset. Existing centered mid-inertia and slow-review cases remain intact. Patch changeset included.
- Executor final gates on 13.4.4: full units 82 files/923 tests, focused drag 50/50, targeted production Chromium 25/25 (resize, while-drag transforms, axis handoff, and both presence specs), root check 0 errors/35 warnings, package/publint success, normal docs build success, docs check 0 errors/13 warnings, scoped formatting, Trunk, and diff check. Generated animated-tabs registry churn restored.
- Independent reviewer gates: full units 923/923, final focused drag 50/50, production Chromium 25/25 (32.3s), root check 0 errors/35 warnings, package/publint success, docs check 0 errors/13 warnings, full source/dependency/test review, Trunk and final fixture lint, and diff check passed. Trunk reports no new issues and one existing issue; known Reorder declaration diagnostics remain reserved for 006. Logs: ignored .temp/plan-004/reviewer-*.log. This is targeted Chromium coverage, not the final full browser/Firefox release gate.
- Persistent root-owned production preview session 6533: http://localhost:5204/tests/drag/element-ref-resize, in-app tab_g. Direct browser sampling across widths 404→204→404 (including borders), repeated twice, kept the blue card at relative left 42 with transform none: 40px authored inset plus the 2px border. Earlier 5202/5203 previews remain untouched. User eye-test approval is pending; do not start 005 until received.

## Prioritized checklist

All findings have HIGH confidence. S = hours; M = roughly a day including regression coverage.

| Done | ID | Finding / impact | Category | Effort | Fix risk | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| [x] | 01 | Invalidate stale exit promises: an old exit can complete a newer exit and remove its DOM early. | Correctness / upstream parity | S | Low: localized lifecycle guard | `src/lib/utils/visualElementCore.ts:226`; `src/lib/html/_MotionContainer.svelte:387` |
| [x] | 02 | Preserve zero drag offsets on constraint resize: an untouched, off-center draggable moves when its container shrinks. | Correctness / upstream parity | S | Medium: preserve authored transforms and per-axis ownership | `src/lib/utils/drag.ts:567` |
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

- **Primary tracking correction during 004:** the user asked that plans stop remaining untracked in the primary checkout. All nine plans/checklist files are now committed there as 7b91916d. Keep future status changes tracked in that checkout and commit them at handoff. The existing competitive-intel snapshot is separately authorized for an unchanged-content commit.
- **13.4.4 upgrade authorized during 004:** npm metadata confirms both motion and motion-dom 13.4.4 are published. A separate dependency commit will update both ranges and lockfile plus a patch changeset before final 004 verification. Drag tests must be rechecked under 13.4.4; shared upstream engine updates are reused through these dependencies.

### Plan006 review result — APPROVE

- Explicit readonly typeof Group/Item annotation repairs declaration emission while retaining generic inference. Runtime JavaScript is byte-identical. Existing CI consumer command now validates the published types, exact inferred numeric/object callbacks, non-any namespace/components, and rejected invalid props.
- Red: missing declaration before and after fresh package generation, plus deliberate missing/any emitted-artifact faults through the actual consumer entrypoint. Green independently verified: package/publint with no Reorder emit diagnostics, consumer types+SSR,935units (including49Reorder),22Reorder Chromium checks, rootcheck0errors/35existingwarnings, docscheck0errors/13existingwarnings, scopedTrunk/noissues and diff integrity.
- Optional skipLibCheck:false exposes an upstream Motion13.4.4 HTMLWebViewElement dependency-type diagnostic, independently reproduced by importing motion alone. It remains documented, without a shim or dependency change; required package-boundary inference checks pass. See006 for exact evidence.
- Primary shared branch, seven scoped files including both plan records, normal hooks. Preview http://localhost:5205/tests/reorder/basic loaded in T3 tab_6. Plan007 remains unstarted.

### Plan006 runtime visual follow-up — visually approved

- Reproduced the user's repeated-shuffle jump: at an upward DOM swap the held item moved54px away from the pointer for one frame. A reduced three-gesture regression failed before the fix. The active-drag layout notification now bypasses an occupied frame throttle and reaches the existing upstream projection compensation before paint; no new positioning algorithm or public API change.
- Green: new regression3/3, original30-gesture sequence without slot jumps,935 units, package/publint, consumer types+SSR, root/docs checks with baseline warnings, scoped Trunk with no new issues. Independent browser matrix:66 passed,1 pre-existing single-frame momentum fixme skipped; includes all23 Reorder checks plus affected layout and drag coverage. Full evidence and commands are in006.
- The maintainer confirmed the jump is gone and authorized committing all five scoped files, including both plan records, on chore/motion-upstream-refresh, then starting007. Frozen preview is http://localhost:5205/tests/reorder/basic. A separate mid-animation re-grab offset observation needs upstream comparison before classification and is not claimed fixed by this patch.


### Plan 007 implementation review — visual checkpoint pending

- Implemented on the shared `chore/motion-upstream-refresh` checkout after the approved 006 runtime commit `40ebd396`. Owned wrappers now wait for every registered automatic motion exit. Reused upstream's ID/completion map model and Motion animation paths, with cycle invalidation and the existing explicit manual `safeToRemove()` release preserved.
- Public-component red tests exposed premature removal, an injected VisualElement presence-context overwrite, and missing initial exit for a descendant mounted absent. Each has a focused regression and a narrow reviewed fix; 954 units pass. The plan records the scope reconciliation and exact evidence.
- Public docs and FIG-002 on `/examples/use-presence`, plus the existing `/tests/use-presence` page, demonstrate fast/slow exits, interruption, Reset, real MotionValue progress, wrapper presence, and completion counts. A browser red caught a frozen progress display before handoff; final demo code uses the existing public reactive MotionValue API.
- Broader Chromium coverage passed 131 checks; the only red was the new progress assertion against the old production demo. All 8 affected-route checks now pass against the final MotionValue production rebuild, including the progress assertion (23.6 seconds). Root/docs type checks now pass with 0 errors and the existing 35/13 warnings. Package/publint and consumer types/SSR pass. Final normal docs build passed in 2m 23s; Trunk found no new issues across 19 files (one existing warning). Generated registry drift was restored; diff integrity passes. Full logs and handoff evidence are in 007.
- Follow-up discovered while verifying metrics: component-level `onUpdate` is not forwarded by `buildMotionNodeProps`. This is outside the owned-exit registry change; the new examples use supported MotionValue reads. Assess public callback parity separately rather than adding an unreviewed API fix to 007.
- Review URLs: http://localhost:5205/tests/use-presence (Owned group section) and http://localhost:5199/examples/use-presence (FIG-002). T3 initially demonstrated correct group retention/removal, then its automation host disconnected. Headless browser checks and screenshots continued via the explicitly allowed fallback; both local servers are left running. Source and plan updates for 007 remain uncommitted pending the maintainer's visual checkpoint; 008 is unstarted.


### Plan 007 visual follow-up — completed-exit re-entry

- Red first, as explicitly requested: Hide → Fast finished while Slow exits → Show left the original Fast card at opacity 0.15/x100 after 5 seconds, while Slow returned to opacity 1/x0. A feature unit also failed because initial-animation suppression remained set at reset. Existing label-only coverage had missed the actual paint failure.
- Reused upstream's `blockInitialAnimation = false` before resetting/replaying a completed exit. No demo remount or value-reset workaround. New coverage checks original node identities, eventual computed opacity/transform for both cards across two re-entry cycles, and a later normal removal exactly once.
- Green: 85 focused units; root check 0 errors/35 baseline warnings; package/publint; Trunk/diff checks; production app build. The other 21 related browser checks passed. New regression passes 3/3 after waiting for the onMount-gated cards before capturing their identities. Same regression passes on the docs example; native T3 independently measured both cards restored to opacity 1/x0.
- Refreshed production test page: http://localhost:5205/tests/use-presence. Docs example: http://localhost:5199/examples/use-presence, FIG-002. Both servers remain running. T3 tab_d is loaded and Reset, though its visibility flag remains false. Refresh older tabs to pick up the fix. 007 is uncommitted pending renewed visual approval; 008 remains unstarted.


### Plan 007 approval and commit

The maintainer approved the repaired group exits and completed-exit re-entry, accepted the demonstrated Show/Reset progress behavior, and authorized committing all 007 work then starting 008. The source/tests/docs/changeset and both plan records are included together in `fix(presence): wait for all owned descendant exits` on the shared branch; the containing commit records the implementation. No push, merge, or release. Plan 008's cross-browser docs coverage is the next step.


### Plan 008 started

007 committed as `ae920f1e` with all hooks passing and a clean tree. The maintainer authorized moving to 008. Scope matches the original audit; execute docs Chromium/Firefox rendering coverage and dedicated CI in the shared checkout. Root maintains this index and coordinates final integrated release gates. Existing root5205/docs5199 stay available; new test harness uses dedicated5201. Full red/green and hosted-CI limitations will be recorded in 008.


### Plan 008 scoped verification

The actual SVG docs route passes12/12 Chromium/Firefox cases through the unchanged fresh package+docs build harness. The old unitless CSS produced `none` on both Firefox paths and failed the same rendering assertion; restored explicit lengths pass without changing the demo. CI now covers the actual route, all controls, Replay progression/interruption, and verified reduced-motion setup. Root unit coverage954/83files, package/publint, root/docs checks, published consumer types/SSR, and lint pass.

The first full root sweep returned468 passed,1 snap-to-origin assertion failure,1 flaky frame-budget case (passed retry2), and2 pre-existing skips. Maintainer confirmed return motion is correct. The assertion now observes an actual intermediate return with unchanged bounds; an instant snap still fails. Focused5/5 and repeated3/3 pass. A final full-root rerun is underway; do not call the initial run green.

Remote main has advanced to b6bfdfde with the docs favicon change (#483); it is not integrated into the tested release candidate yet. Fresh-main reconciliation and hosted CI remain open release steps.008 changes are uncommitted pending the review checkpoint. Full details and logs are in008.


### Plan 008 final review — APPROVE

Independent final root Chromium run:470 passed,2 pre-existing skips, no failures or retries (12.9minutes). The snap-to-origin assertion and AI glow frame-budget case both pass on the first attempt. Together with12/12 actualdocs Chromium/Firefox checks,954 coverage units, types/package/consumer/build/lint gates, this completes local verification of all eight selected plans. Exact evidence is recorded in008; the earlier failed run is preserved, not relabeled.

008 changes comprise three new docs testing/CI files, the visually approved snap timing assertion, and the two plan records. They remain uncommitted for review.007 is committed as ae920f1e. No runtime/demo/dependency/generated changes belong to008.

Review example: http://localhost:5199/examples/svg-css-variables (Draw, Erase, Replay, Reset, both sliders). Root test page remains http://localhost:5205/tests/drag/snap-to-origin. Both servers are running. Newer main b6bfdfde integration, final release notes, and hosted PR checks remain open release tasks; no push/merge/version/publish/deployment was performed.


### Final visual approval — 2026-09-26

The maintainer approved008 (“Looks great!”), completing the visual checkpoints for all eight plans.008 and its plan records remain uncommitted. Remaining release work: commit008, reconcile newer main b6bfdfde, review changesets/release notes, and run hosted PR checks. This approval does not itself request a push, PR, merge, version, publication, or deployment.
