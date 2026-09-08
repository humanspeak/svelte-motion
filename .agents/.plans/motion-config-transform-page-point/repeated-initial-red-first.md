# Repeated initial controls: red-first investigation

> Approved by the user's direct instruction, 2026-09-08: “On the test page start initial drag keeps moving the item up... please address with a redtest first”.

Planned at: `40b5c11`. This supersedes accepting cumulative repeated-start drift in the pending controls amendment. The previous executor's result is snapshotted for audit, not approved as correct behavior.

First write only a regression in `e2e/drag/controls.spec.ts` demonstrating that a tile with initial x100/y40 snaps to the pointer and does not accumulate displacement across identical real-pointer controlled drags. Preserve the first movement test and tiny-nudge coverage. Retain boot geometry, input, active/end lifecycle assertions and <=2px meaningful geometry tolerance. Avoid input intercepted by the tile covering its button. Collect repeated positions for informative failures. Do not skip or mark the regression expected-to-fail.

Guard must run and retain a red result against unchanged production snapshot `0da2303` before dispatching runtime changes. Executor cannot run browsers/install/build/commit or edit plans; guard owns those operations. Existing verification gates remain mandatory.

Compare the same interaction with pinned public React Motion13.2.0. Existing evidence reports cumulative (-50,-50) in both systems. Investigate that evidence rather than assuming upstream is correct or silently discarding the user's React parity requirement. If correcting this behavior requires diverging from the verified public reference, explain the concrete conflict for user resolution before a runtime change. No runtime scope expansion is granted by this red-test step.

Status: IN PROGRESS — red proof requested; no runtime change authorized by this investigation step.
