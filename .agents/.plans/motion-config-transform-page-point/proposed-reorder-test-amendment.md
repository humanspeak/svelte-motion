# Proposed amendment: Reorder test frame sampling

Status: APPROVED by the user on 2026-09-08: “Approve the narrow test amendment”. The active plan now includes this bounded test-only allowance.

## Exact scope addition

Allow edits to `src/lib/components/Reorder/reorder.component.spec.ts` for its five gesture tests only. Permit valid primary mouse pointer metadata, deterministic Motion frame advancement after pointer events, and terminal cleanup. Preserve the existing numerical, axis, keyed-layout, and reorder callback assertions. Any additional behavioral expectation change requires separate evidence and review.

No Reorder production code, algorithms, dependencies, projection implementation, other test files, or verification gates are added or removed.

## Why this is needed

The user's governing requirement is exact observable React Motion 13.2.0 parity. React samples drag on Motion's frame loop; the earlier Svelte drag updated synchronously inside `pointermove`. Snapshot `06ae8a4` adopts frame sampling. Five existing Reorder tests assert immediately after `pointermove`, before a frame executes.

Guard reproduced the full suite: 899 passed, 5 failed (904 total). All failures are in this one file, at lines 72, 95, 135, 162 and 204. Three expect x=30 and receive 0; one expects an immediate reorder callback and receives none; one expects the active-drag marker before the start frame.

The clean `14046a5` baseline passes all 14 tests in this file. This is a compatibility consequence introduced by the frame scheduling change, not a pre-existing failure. It is not yet proven that frame advancement alone makes every later assertion pass; the executor must investigate any further failure and cannot weaken it to obtain green results.

## Approved execution and verification

1. Guard adds this single test path and bounded allowance to Plan 001 and records the approval.
2. Executor changes the five tests to sample controlled Motion frames, preserving their intended behavioral assertions and proper pointer cleanup.
3. Guard snapshots the change, independently reproduces all 14 Reorder tests and the full unit suite, then continues all existing parity/browser/build/docs/lint gates.
4. Stop if fixing a later failure needs Reorder runtime changes or another scope expansion.

Evidence: `/tmp/transform-page-point-parity-full-units.log` and `/tmp/transform-page-point-baseline-reorder.log`.
