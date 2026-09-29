# Motion 13.4.5 follow-ups

Generated 2026-09-29 from the closed `motion-13.4.5` batch's residual risks, after the
maintainer ruled them not acceptable to ship. Lands on `chore/motion-13.4.5` before the PR.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
| ---- | ----- | -------- | ------ | ---------- | ------ |
| [010](010-exit-clone-keeps-styles.md) | Exit clones keep the look of the element they replace | P1 | M | 009 | TODO |
| [009](009-presence-placeholder-and-handoff.md) | Exit placeholders keep margins; pin same-update handoffs; link presence demo | P1 | S–M | motion-13.4.5 (closed) | DONE — 9a3a8df5; guard PASS |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason).

## Notes

- Numbering continues from the closed batch (001–008).
- Accepted without a plan: IntersectionObserver latency for an *imperative* DOM shift + swap in
  the same task (we start from the painted position; upstream would start from an unpainted one).
  Step 3 of 009 pins the same-state-change case, which is the parity-relevant one.

- Fixture fix (not a plan; guard-dispatched after the maintainer's recording): 0ae30275 removes `min-height: 0` from 7 test pages that let `<body>` collapse and clip layout animations; adds a paint-level spec.
- 010 repro page committed first as 6f3612ab.
