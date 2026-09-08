# Guard report — MotionConfig coordinate transforms and repeated snap fix

**NO-PASS: the repeated-start regression is fixed; one strict parity checkpoint and full browser review remain.**

Reviewed source: `88a811f0` on `feat/motion-config-transform-page-point` in `/Users/jasonkummerl/Github/svelte-motion-transform-page-point`.

## What changed

The user authorized fixing Svelte first, as a narrow exception to the repeated snap bug reproduced in React Motion 13.2.0. `501ea9c3` pairs cached projection measurements with their axis values and corrects the center using subsequent axis movement. `88a811f0` keeps imperative drag attachment and option updates outside Svelte reactive tracking, preserving active sessions. No dependency or projection implementation changes.

The controls regression was committed RED at `6c6781b` before these runtime changes. It remains byte-identical and now passes all three repeated real-pointer sessions. Earlier acceptance of cumulative drift is superseded. Upstream issue: https://github.com/motiondivision/motion/issues/3805. No upstream PR or feature PR/push.

## Independently reproduced verification

| Gate | Current result | Evidence |
| --- | --- | --- |
| Full units | 908/908 pass, 82 files; includes Reorder 14/14 | `snap-integration-full-units.log` |
| Controls and feature browser tests | 18/18 pass on fresh build; protected RED test unchanged | `snap-integration-targeted-browser.log` |
| Public React strict matrix | 28/29 match; one intermediate rendered rectangle mismatch | `snap-integration-parity-summary.json`; raw `/tmp/svelte-motion-react-parity-1320/svelte-snap-fix2-guard.json` |
| App build, package, publint | Pass | `/tmp/snap-fix2-build.log` |
| Root check | Source commit hooks pass; executor reports 0 errors, 39 existing warnings | `/tmp/snap-fix2-source-commit.log`; `snap-integration-executor-report.md` |
| Docs metadata | 5/5 pass | `/tmp/snap-fix2-docs-seo.log` |
| Docs check | 6 baseline errors, 13 warnings; exact error locations and diagnostics unchanged from prior guard run | `/tmp/snap-fix2-docs-check.log` |
| Trunk check | No new issues; one existing issue | `/tmp/snap-fix2-trunk-check.log` |
| Full browser suite | 53 pass, 1 fail, 396 not run; stopped at first failure | `snap-integration-full-browser.log` |
| Final docs build and formatting | Pending after remaining runtime decision/correction | Earlier builds are historical, not final verification of this snapshot |

## Strict parity finding

`drag-real-layout-shift-held` now has correct axis values `{x:0,y:30}` at `layout-commit`, but the immediate rendered target y is 315 rather than React's 330. The following sampled callbacks render correctly. The isolated case reproduces the same single mismatch. A read-only executor diagnosis is underway. No assertions or reference fixtures have been weakened. Other 28 cases match, including scrolled snap and callback/velocity semantics.

## First full-browser failure: review required

`e2e/animate-presence/owned-child.spec.ts:26` expects opacity below 0.95 at a fixed 120 ms after toggling removal; observed 0.98175. The identity assertion before it passed. The route and test are unchanged from base `14046a5`; that alone does not prove this failure is pre-existing.

Opened the page visibly in T3 tab_8 at http://127.0.0.1:4198/tests/animate-presence/owned-child?@isPlaywright=true. The page demonstrates retaining and fading the original live node, preserving state, then unmounting without a clone. A real T3 click plus requestAnimationFrame observations showed opacity 0.859 at 115 ms and 0.838625 at 131 ms, same original node and zero clones; by 1115 ms it was removed and exits completed was 1. This supports investigating the test's fixed timing, not a proven diagnosis or authority to change the assertion.

The repository AGENTS.md failed-e2e workflow requires the user's behavior-versus-test decision before altering this failure or moving to the next failing page. No full-suite retry, assertion edit or AnimatePresence source change has occurred. The page remains open for review.

## Remaining work

Resolve the strict layout snapshot diagnosis within approved scope, obtain the user's decision on the first full-suite failure, then complete required browser/docs/formatting gates and final review. Keep the batch IN PROGRESS. The public scaled-board example is available in T3 tab_6 and docs server port 5188, but the requested finished walkthrough remains pending. Do not close the plan or claim full parity/full e2e success yet.
