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
