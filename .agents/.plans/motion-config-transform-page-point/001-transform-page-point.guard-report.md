# Guard report — MotionConfig coordinate transforms and repeated snap fix

**NO-PASS for feature closeout: the local repeated-start bug and all 29 parity cases are fixed; full browser review remains.**

Reviewed source: `2f191d3b` on `feat/motion-config-transform-page-point` in `/Users/jasonkummerl/Github/svelte-motion-transform-page-point`.

## What changed

The user authorized fixing Svelte first, as a narrow exception to the repeated snap bug reproduced in React Motion 13.2.0. `501ea9c3` pairs cached projection measurements with their axis values and corrects the center using subsequent axis movement. `88a811f0` keeps imperative drag attachment and option updates outside Svelte reactive tracking, preserving active sessions. `2f191d3b` additionally isolates the projection-measure callback axis reads using public Svelte untrack, preventing projection effects from accidentally tracking x/y. No dependency or projection implementation changes.

The controls regression was committed RED at `6c6781b` before these runtime changes. It remains byte-identical and now passes all three repeated real-pointer sessions. Earlier acceptance of cumulative drift is superseded. Upstream issue: https://github.com/motiondivision/motion/issues/3805. No upstream PR or feature PR/push.

## Independently reproduced verification

| Gate | Current result | Evidence |
| --- | --- | --- |
| Full units | 908/908 pass, 82 files; includes Reorder 14/14 | `snap-final-full-units.log` |
| Controls and feature browser tests | 18/18 pass on fresh build; protected RED test unchanged | `snap-final-targeted-browser.log` |
| Public React strict matrix | 29/29 exact matches; isolated layout checkpoint also passes | `snap-final-parity-summary.json`; raw `/tmp/svelte-motion-react-parity-1320/svelte-snap-fix3-guard.json` |
| App build, package, publint | Pass | `/tmp/snap-fix3-build.log` |
| Root check | Independent root check and source hooks pass: 0 errors, 39 existing warnings | `/tmp/snap-fix3-root-check.log`; `/tmp/snap-fix3-source-commit.log` |
| Docs metadata | 5/5 pass | `/tmp/snap-fix3-docs-seo.log` |
| Docs check | 6 baseline errors, 13 warnings; exact error locations and diagnostics unchanged from prior guard run | `/tmp/snap-fix3-docs-check.log` |
| Trunk check | No new issues; one existing issue | `/tmp/snap-fix3-trunk-check.log` |
| Full browser suite | At `88a811f0`: 53 pass, 1 fail, 396 not run; stopped at first failure. Final full gate remains pending | `snap-integration-full-browser.log` |
| Docs production build | Pass, 252 social images and Cloudflare output | `/tmp/snap-fix3-docs-build.log` |
| Formatting and diff hygiene | Trunk fmt and git diff --check pass; only planned guard artifacts remain after source snapshot | `/tmp/snap-fix3-trunk-fmt.log` |

## Strict parity finding — resolved

At historical snapshot `88a811f0`, `drag-real-layout-shift-held` had correct axis values `{x:0,y:30}` at `layout-commit`, but the immediate rendered target y was 315 rather than React's 330. The following sampled callbacks rendered correctly. The isolated case reproduced the same single mismatch. Read-only diagnosis traced this to the measurement listener subscribing active projection effects to axis values. Public Svelte untrack around the paired reads in `2f191d3b` fixes the exact isolated checkpoint and all 29 cases without changing assertions. No assertions or reference fixtures have been weakened. Other 28 cases match, including scrolled snap and callback/velocity semantics.

## First full-browser failure: review required

`e2e/animate-presence/owned-child.spec.ts:26` expects opacity below 0.95 at a fixed 120 ms after toggling removal; observed 0.98175. The identity assertion before it passed. The route and test are unchanged from base `14046a5`; that alone does not prove this failure is pre-existing.

Opened the page visibly in T3 tab_8 at http://127.0.0.1:4198/tests/animate-presence/owned-child?@isPlaywright=true. The page demonstrates retaining and fading the original live node, preserving state, then unmounting without a clone. A real T3 click plus requestAnimationFrame observations showed opacity 0.859 at 115 ms and 0.838625 at 131 ms, same original node and zero clones; by 1115 ms it was removed and exits completed was 1. This supports investigating the test's fixed timing, not a proven diagnosis or authority to change the assertion.

The repository AGENTS.md failed-e2e workflow requires the user's behavior-versus-test decision before altering this failure or moving to the next failing page. Only the same first test was subsequently repeated unchanged three times; all three passed (`owned-child-focused-repeat.log`). No full-suite retry, assertion edit or AnimatePresence source change has occurred. The page remains open for review.

## Remaining work

Obtain the user's decision on the first full-suite failure, then complete the full browser gate and final review. The strict layout mismatch is resolved. Keep the batch IN PROGRESS. The public scaled-board example is available in T3 tab_6 and docs server port 5188. Guard real-pointer checks at all four zoom presets pass: movement is 40 screen pixels horizontally and 25 vertically (nonuniform y=25.000015). See snap-final-docs-probe.cjs/json. Final user walkthrough remains paired with feature closeout. Do not close the plan or claim full parity/full e2e success yet.

All final source changes are limited to the approved snap calculation and reactive bookkeeping boundaries. The controls regression, strict reference runner and behavioral assertions are unchanged during the final corrections. The unrelated generated animated-tabs class ordering was inspected and restored. The original worktree intel edit remains untouched. No batch closure, PR, push or merge.
