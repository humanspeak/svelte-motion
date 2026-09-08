# Guard report — MotionConfig transforms and layout/snap correction

**P2 runtime correction PASS; NO-PASS for overall feature closeout because full-browser review remains open.**

Runtime snapshot `66aff2cc` on `feat/motion-config-transform-page-point`. The user authorized fixing the review P2, then opening the remaining failure page; they also requested a useful explanation on the new test page.

## Correction and RED evidence

Projection measurements can omit motion transforms even while axis MotionValues remain translated. The snap cache now records zero represented motion-axis contribution for a physical authored-base measurement, treating empty CSS transform and `none` equivalently. Authored nonempty base transforms remain exact and are not parsed as motion axes. No projection engine, dependency, container or pan changes.

New zero/nonzero browser cases were added at `4239a6db`; `30cfe973` corrected an obstructed handle and added exact elementFromPoint preconditions. Guard proved RED before runtime edits: zero case first snap (117.53125,112) worked, subsequent snaps landed (45.0625,-66); the nonzero case also mis-snapped initially. All scroll/hit/layout preconditions passed. See `layout-snap-red-browser.log`. The first obstructed fixture run was rejected as invalid evidence.

The first cache correction passed 909 units but failed real-browser checks because projection used physical `none` versus authored empty string. Guard isolated this with a browser-only module probe and verified normalization before the second executor correction. Final runtime has 911 passing units. New browser tests and protected controls regression remain byte-identical to `30cfe973` during runtime corrections.

The dedicated test page now explains Snap → drag → Shift → Snap, labels starting offsets, shows cursor-distance PASS/FAIL after rendering, and follows the live matching pointer for diagnostic accuracy. Reference-only controls are hidden in this isolated case; existing reference geometry and cases are unchanged. A final CSS-only stacking adjustment keeps Snap/Shift above the snapped tile; final UI verification passed on a fresh build: the handle remains hittable and three real pointer starts report Snap1/2/3 PASS at0px. An immediate-movement diagnostic also reports0px correctly.

## Independently reproduced checks

| Gate | Result | Evidence |
| --- | --- | --- |
| Full units | 911/911, 82 files | `layout-snap-final-units.log` |
| Controls + feature browser tests | 20/20, including both previously RED cases | `layout-snap-final-browser.log` |
| Strict public React matrix | 29/29 matched | `layout-snap-final-parity-summary.json`; raw `/tmp/layout-snap-final-parity.json` |
| Initial-prop public consumers | Zero and x100/y40 each snap exactly to cursor three times around a layout change | `layout-snap-unbound-guard.log` |
| Diagnostic readout | Immediate drag and three real snaps PASS at0px; handle stays hittable | `layout-snap-readout-guard.log` |
| Root check, Trunk fmt/check | Source commit hooks passed all three | `/tmp/layout-snap-source-commit.log` |
| App/package/publint | Pass | `/tmp/layout-snap-final-build.log`; final UI build `/tmp/layout-snap-ui-build.log` |
| Axis-handoff unchanged targeted case | 1/1 pass on fixed runtime | `layout-snap-axis-handoff.log` |
| Diff hygiene / scope | Pass; only authorized drag runtime/tests/demo changed | Guard contribution review |

Docs source/API/dependencies remain unchanged in this P2 correction. Prior docs build, metadata and baseline diagnostic comparisons remain valid: production build and 5 SEO tests passed; docs check has 6 demonstrated baseline errors and 13 warnings. No new docs blockers were inferred.

## Remaining full-browser checkpoint

The approved owned-child test now uses bounded fade-progress polling and its seven tests passed. The subsequent full suite at `872a3f41` stopped at axis-handoff after 79 passes: expected x420, received x0, 370 tests not run. Three unchanged isolated repeats passed during review; another unchanged run passed on fixed runtime `66aff2cc`. This does not establish the cause or clear the full-suite gate.

Review page: http://127.0.0.1:4198/tests/drag/axis-handoff?@isPlaywright=true, section 3. Fling the item right, click retarget x→420 while gliding, then cancel inertia. The new animation should continue to420; cancelling the old glide must not stop it or reset it to0. No axis-handoff test/runtime/demo changes. Follow the repository one-failure-at-a-time review before moving on.

Keep the batch IN PROGRESS. No PR, push, merge or feature closeout. Original unrelated intel state remains untouched.
