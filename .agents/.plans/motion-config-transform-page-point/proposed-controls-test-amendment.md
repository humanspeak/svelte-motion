# Controls test amendment — APPROVED 2026-09-08

The user approved this amendment with “Go ahead” and requested the example page be opened after verification. The earlier Reorder amendment remains complete.

## Why the current controls assertions conflict with React

Guard ran the public Motion 13.2.0 React controls fixture with the existing Svelte page's DOM geometry, initial props, viewport, pointer coordinates, mouse steps and waits. No private APIs were used. Evidence is preserved in `react-controls-reference.json`, `react-controls-tiny-raw-guard.json`, and `svelte-controls-fix2-guard.json` beside this proposal.

- The x-only two-pixel nudge produces no drag callbacks in React. The target moves from x590 to x589.9921875 solely from snap alignment, delta -0.0078125; y remains235. The existing test requires delta >=1. The raw-input guard probe verified the exact fractional mouse coordinates; the supplementary runner's rounding error was corrected without changing mouse inputs or gesture tolerances. The corrected runner passes every input precondition and preserves the same outcomes in `react-controls-reference-fixed.json`.
- With initial x100/y40, the target starts at (700,477), handle center (640,417). Each drag moves to (690,467) in five mouse steps, waits50ms, samples the active box, releases, and waits100ms. React yields active (650,427), then (600,377). The current test requires identical positions across the two drags. The behavior observed in React is a repeated -50/-50 shift.
- Svelte snapshot52654fc instead yields (750,467), then (800,457), from the same starting geometry. This is a runtime mismatch, not evidence for adopting Svelte's current output. Guard verified the runtime correction at snapshot `0da2303`: Svelte now matches both React active positions exactly, as recorded in `svelte-controls-fix3-guard.json`. The fix removes duplicate initial-position reseeding within the approved drag file; no projection changes were needed.

## Proposed scope and assertions

Permit only `e2e/drag/controls.spec.ts`, restricted to the two failing tests and shared helpers required for those tests. Leave the existing imperative-start movement test and the controls demo route unchanged.

1. Replace the tiny-nudge minimum-movement assertion with the public React no-start/snap outcome, retaining its no-teleport bound and unchanged-y assertion. Add a separate gesture that crosses the threshold and demonstrates actual x-only drag movement, so the test cannot pass simply because drag is disabled.
2. Replace repeated-snap consistency with the matched React sequence and explicit initial/handle/input preconditions. Assert both axes, both active positions, and the between-session delta. Do not accept the current mismatching Svelte values or enlarge position tolerances to conceal a mismatch.
3. Retain all verification gates: strict29-case matrix, strengthened feature tests, controls and other gesture regressions, full450-test browser suite, full units, root/package/docs checks, Trunk and diff hygiene. Preserve existing baseline exceptions separately.

No production projection, Reorder runtime, dependency, lockfile, workflow, controls demo or other test scope is added. The executor must stop if matching React requires another production file.

## Approval boundary

Plan001's governing revision says to keep the current file scope and obtain review for required scope expansion. Its Scope section does not include `e2e/drag/controls.spec.ts`. The explicit user approval authorizes this one-file expansion and the evidence-based expectation changes. The repository's separate full-e2e failure review workflow still applies if a full run fails.
