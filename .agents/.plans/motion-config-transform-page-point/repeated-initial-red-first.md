# Repeated initial controls: red-first investigation

> Approved by the user's direct instruction, 2026-09-08: “On the test page start initial drag keeps moving the item up... please address with a redtest first”.

Planned at: `40b5c11`. This supersedes accepting cumulative repeated-start drift in the pending controls amendment. The previous executor's result is snapshotted for audit, not approved as correct behavior.

First write only a regression in `e2e/drag/controls.spec.ts` demonstrating that a tile with initial x100/y40 snaps to the pointer and does not accumulate displacement across identical real-pointer controlled drags. Preserve the first movement test and tiny-nudge coverage. Retain boot geometry, input, active/end lifecycle assertions and <=2px meaningful geometry tolerance. Avoid input intercepted by the tile covering its button. Collect repeated positions for informative failures. Do not skip or mark the regression expected-to-fail.

Guard must run and retain a red result against unchanged production snapshot `0da2303` before dispatching runtime changes. Executor cannot run browsers/install/build/commit or edit plans; guard owns those operations. Existing verification gates remain mandatory.

Compare the same interaction with pinned public React Motion13.2.0. Existing evidence reports cumulative (-50,-50) in both systems. Investigate that evidence rather than assuming upstream is correct or silently discarding the user's React parity requirement. If correcting this behavior requires diverging from the verified public reference, explain the concrete conflict for user resolution before a runtime change. No runtime scope expansion is granted by this red-test step.

Status: IN PROGRESS — red proof requested; no runtime change authorized by this investigation step.

## Red proof complete

Snapshot6c6781b changes only the third controls test. Guard ran `PW_REUSE_SERVER=1 npm exec --yes --package=pnpm@11.24.0 -- pnpm exec playwright test e2e/drag/controls.spec.ts --reporter=line` against unchanged production0da2303:2passed,1failed in6.2s. The second snap is50px off (allowed<=2). Three identical(+150,+50) drags finish(750,427),(800,377),(850,327). First and tiny-nudge tests/helpers byte-identical todf11fcc.

Guard then ran controls-repeat-red-input-probe.cjs against both public React13.2.0 and Svelte with the exact red-test trajectory: all three before/snapped/active/released boxes and hit tests exactly match. All three inputs reach initial-handle. This establishes a repeated-start bug shared with upstream, not a Svelte-only parity mismatch. No runtime fix has been applied.

User subsequently asked whether this is a bug (answered yes) and whether to offer a fix upstream. Contribution guidance, related PR3445 and a local unsubmitted report are recorded in upstream-report-draft.md. Runtime direction remains in discussion; preserve the red test and full gates.

## Svelte correction approved — 2026-09-08

User: “Ok, lets fix it for us first”. This explicitly authorizes correcting the repeated-start bug in Svelte before an upstream fix. It is a narrow exception to matching the buggy React13.2.0 repeated-start result; other verified contracts remain in force. Upstream issue is now posted: https://github.com/motiondivision/motion/issues/3805. No upstream patch/PR or additional external messages are authorized by this local step.

Planned at:`bf50874`. RED was independently reproduced at6c6781b against production0da2303 (controls2pass/1fail; second snap50px off). Preserve that immutable evidence.

Executor scope for this correction: src/lib/utils/drag.ts, src/lib/utils/drag.spec.ts, existing feature transform-page-point e2e files only for meaningful additional repeated-start coverage if needed, and scoped docs/changeset wording from the parent plan if necessary to accurately disclose the correction. Existing e2e/drag/controls.spec.ts must remain byte-identical to6c6781b: it is the red-to-green acceptance test, not a target to soften. No demo workaround. No production projection, dependency, lockfile, workflow, Reorder, new exported API, private package import, or vendoring.

Correct snap position handling when the stored layout measurement and current motion value represent different positions. Preserve the first initial-coordinate snap, enabled axes, current axis ownership and interrupted animation behavior, transformed-coordinate domains, scroll handling and layout/constraints integration. Avoid fixed pixel corrections, special-casing initial x100/y40, or session-count hacks. Use the existing adapter and supported primitives. Add focused numerical unit coverage that proves repeated starts and guards the chosen measurement/axis bookkeeping. The same no-creep scenario should work with zero and nonzero initial coordinates.

Guard will snapshot, inspect the full diff, verify controls RED-to-GREEN on a fresh build, focused/full units, 29-case parity comparison (preserving all existing expected outputs outside this repeated-start bug), feature e2e and full browser gates; root/package/docs/Trunk gates remain as in parent plan. Run docs production build if shipped source/docs changes invalidate earlier proof. Full-suite failures follow one-page-at-a-time T3 review with the user. Close only when all gates pass or demonstrated baseline blockers are separately documented. Leave the public scaled-board example open in T3 when done.

## Integration correction — 2026-09-08

Reviewed source501ea9c3 fixes the unchangedcontrolsRED (all3pass) but introduced twoReorderunitfailures and the real-layout-shift browser mismatch. Reorderbefore111c1031 passes14/14; after501ea9c3 fails2/14 identically alone and fullsuite. Augmented MotionValue.get reads its Svelte-state-backedcurrent property; the new measurement snapshot runs inside the component attach/update effects and adds position dependencies. Gesture recreation breaks the intended live axis/layout session.

Use the existing original-plan runtime whitelist entry src/lib/html/_MotionContainer.svelte for a narrow integration fix: keep intentional options/dependency reads outside untrack, execute attachDrag and imperative updateOptions work untracked. This follows existing component patterns for pan, projection and VisualElement commits and keeps drag.ts framework-neutral. No change to Reorder runtime/tests, controlsregression or feature e2e assertions. This is a necessary correction within the original authorized runtime scope, not a new feature or removal of a gate. Baseline501ea9c3.

Guard must re-run unchanged Reorder14, controls3, feature15, fullunits and all29referencecases, then remaining gates.

## Measurement callback isolation — 2026-09-08

Reviewed source `88a811f0` passes 908 units and 18 targeted browser tests but retains one strict layout-commit DOM mismatch (y315 vs330 with correct bound y30). Read-only diagnosis traces this to projection measure callbacks sampling Svelte-augmented MotionValue.get under active projection effects. Correct within original drag.ts scope by wrapping captureProjectionAxisValues axis sampling in public Svelte untrack. This necessary integration correction supersedes the prior executor-prompt preference for framework-neutral drag.ts; no dependency or private Motion reuse is added. Keep all assertions, reference fixtures, numerical snap behavior, measurement ownership and gates unchanged. The unrelated full-e2e owned-child timing failure remains held for user review; no edits there.
