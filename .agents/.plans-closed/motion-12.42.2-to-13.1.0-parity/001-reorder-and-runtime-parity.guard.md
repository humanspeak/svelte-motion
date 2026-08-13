# Guard log — 001 reorder and runtime parity

## Checkpoint 1 — 2026-08-12 18:16 — ON TRACK

`1fb2a4f` · final close-out after operator browser review and PR integration

- Runtime and public contract: `ReorderAxis` is `'x' | 'y' | 'xy'`; automatic,
  grid, RTL, continuous-drag, unmeasured-value, override, and auto-scroll coverage
  passed in unit/component tests and the 22-test Reorder browser suite.
- Inherited runtime coverage: the SVG suite passed, the exact final-style test
  passed 3/3 after an explicit hydration wait, and presence coverage passed apart
  from one existing 120 ms opacity sample that passed 3/3 in isolation.
- Release gates: unit, build, docs-build, Trunk, and both e2e CI shards passed on
  PR #469; direct local `svelte-check` reported 0 errors and the docs production
  build completed successfully.
- Scope: `_MotionContainer.svelte`, drag coverage, and the expanded SVG docs/demo
  were explicit operator-approved revisions prompted by manual browser review.
- Action: marked Plan 001 DONE, recorded the PASS report, and retired the batch.
