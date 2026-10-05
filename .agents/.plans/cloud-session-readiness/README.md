# Cloud session readiness

Prepared with the improve skill on 2026-10-05 against `d40a038f` on `feat/motion-14.0.1-parity`. The maintainer selected work that can proceed without Motion14.0.1. This is a new bounded batch; prior upstream-parity-hardening plans are already marked DONE and are not reopened. Only advisory plan files were written; no implementation was performed.

## Execution order and status

| Plan | Deliverable | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-portable-chromium.md) | Shared optional Chromium resolver across root e2e, docs e2e, docs browser units; config red regression and actual browser smoke; helper CI path coverage | P2 | M | — | IN PROGRESS — pre-flight complete; Sonnet dispatch pending |
| [002](002-fresh-session-setup.md) | Provider-neutral setup/verification guide, four scoped Claude WebFetch rules, personal-settings ignore and contract tests | P2 | S | 001 for accurate shipped fallback docs | TODO |

Status values: TODO, IN PROGRESS, DONE, BLOCKED (reason), REJECTED (reason). A written plan is not an implemented change. An executor records baseline, named red failure (when applicable), green test counts/commands, selected browser/version, environment limits and review result before changing status.

## Dependency notes

- Both plans execute with existing Motion/motion-dom14.0.0 pins. Neither requires installing14.0.1 or substituting an unreleased GitHub dependency.
- Plan001 owns executable-resolution/config/CI changes; Plan002 owns explanatory docs and shared Claude settings. Plan002 depends on reviewed001 before describing fallback as available. Provider-neutral setup text can be drafted independently, but no misleading completion claim.
- Keep current pinned-browser CI installation, Firefox docs coverage, Trunk/ESLint, ports, artifact handling and production rebuild semantics.
- Treat current operator branch/workspace preferences as authoritative; isolated executor worktrees are for dispatched execution. No plan author merge/push/commit/deploy is authorized by creating these files.

## Findings selected

| Finding | Evidence | Impact | Effort / risk | Confidence | Plan |
| --- | --- | --- | --- | --- | --- |
| External Chromium path unavailable through all browser configs | playwright.config.ts:45-48; docs/playwright.config.ts:34-36; docs/vite.config.ts:201-204 | Containers with installed Chromium but absent pinned revision cannot use it through repo configuration | M / MED compatibility | HIGH config gap; actual target cloud image untested | 001 |
| Fresh-session setup requirements absent from contributor guidance | CLAUDE.md:15-29; package manifests; .husky/pre-commit:5-9; run-tests.yml:143-144 | Agents lack tool/browser prerequisites and can mistake skipped hooks for passed lint | S / LOW | HIGH | 002 |

Follow-up from plan specification: a shared script needs explicit workflow path coverage; current three PR path filters omit scripts/. Also, docs client Vitest inclusion has no matching existing test, so a new browser smoke is needed to avoid empty-project validation. These are included inside001, not separate generic infrastructure projects.

## Deferred runtime parity

- **Delayed first frame (#3890):** read-only reproduction on installed14.0.0 advanced a linear0→100/1000ms animation to10 at a first tick100ms late, where upstream fix begins at0. Public animate and follow hooks delegate to upstream; do not vendor JSAnimation/FollowAnimation. When a published paired version contains the fix, add red deterministic public-adapter/follower tests, cover >40ms versus <=40ms delay and manual/explicit timing/retarget controls, then bump both exact pins and run dependency-instance tests.
- **SVG clipPath/filter CSS channels (#3891):** svg.ts:4-11 duplicates the renderer's channel classification; current helper outputs attributes for these keys and empty style output. Changing only the local set on14.0.0 leaves upstream SVGVisualElement's writer on the old channel. Plan the renderer upgrade and local adapter alignment together, starting with red helper and accelerated-animation→duration0 restore regressions, plus SSR/hydration/reactive style rewrite coverage. No partial adapter change or permanently failing default-suite tests are planned now.
- Live registry checks during the preceding audit found14.0.1 unavailable for both motion and motion-dom. This batch intentionally does not depend on that remaining true at execution: versions stay unchanged regardless. Recheck publication and fix inclusion when the maintainer selects runtime parity work.

## Findings considered and rejected

- Remove ESLint: upstream maintainer policy, not a requirement for cloud execution; local Trunk deliberately includes ESLint and no recursive lint alias was found.
- Copy Yarn workspace tool dependency repairs: local pnpm root/docs already declare relevant script binaries; no equivalent global binary resolution failure was demonstrated.
- Add Linux screenshot baselines: current local suites capture failure screenshots but have no corresponding screenshot-baseline assertions needing this port.
- Replace CI browser installation with fallback: lowers reproducibility; optional external-browser checks supplement pinned CI.
- Rebuild Firefox/docs gates or reopen prior completed plans: current docs e2e already runs Chromium/Firefox and prior upstream-parity-hardening reports completion.
- Treat Claude permissions as universal agent integration: other providers/hosts don't consume them, and current multi-repository Claude cloud sessions don't read permission keys from each repo.
- Hand-port delayed-start physics classes or patch dependency caches: creates a fork and makes the anticipated release upgrade harder.
- Repair unrelated stale README parity claims/counts: outside the maintainer-selected cloud-readiness scope.

## Verification and scope limits

Planning used source/config/installed declaration reads and earlier read-only runtime probes. No dependencies were installed, no formatter/build/test suite was run, and no cloud container was launched during this planning turn. This was an upstream/cloud-readiness survey, not a general security, dependency-advisory, animation-performance or whole-codebase audit. Primary references are linked in each plan; repo source excerpts came from advisor reads at the stamped baseline.

The intended review gates are red/green configuration and resolver tests, a real docs browser-unit smoke, root SSR/hydration smoke, existing docs Chromium/Firefox suite, root/full docs units, package validation, root/docs checks/build, Trunk and diff integrity. Exact commands and scope boundaries are in the self-contained plans. A cold executability review caught docs Vitest defaulting to headed outside CI. Both plans now use explicit `--browser.headless` for docs client/full-unit commands; the browser provider overwrites its own launchOptions headless from Vitest settings. No other execution blockers were reported. Actual external-browser and actual cloud-image evidence must be distinguished; neither can be inferred from mocks.

## Dispatch pre-flight — 2026-10-05

Operator selected Claude Sonnet 5.5. Source drift from d40a038f is empty. T3 children inherit the current checkout, so the dispatch uses the documented serial shared-checkout exception: one active executor, guard reads only while it runs, guard owns all plan/index writes and commits. No PR will be opened by this batch unless separately requested. Plan002 remains gated on001 PASS.
