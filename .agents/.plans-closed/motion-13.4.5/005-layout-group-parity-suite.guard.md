# Guard log — 005-layout-group-parity-suite

## Checkpoint 1 — 2026-09-28 — BLOCKED

67815169 (executor worktree) · executor STOP at Step 2

- Upstream Cypress absolute #button tops (29/104/129/204) differ from Chromium (39/114/149/224); executor showed upstream's own page as static HTML measures the Chromium numbers, i.e. the port is faithful and the delta is the 10px column gap.
- Step 1 needed a test-only harness outside the in-scope list.
- Action: reported to operator.

## Checkpoint 2 — 2026-09-28 — PLAN AMENDED

- Operator decision: use measured tops 39/114/149/224, keep upstream's intermediate-frame checks as written. Revision note added to the plan (committed).
- Guard allowed one new test-only harness under src/lib/components/__tests__/ (communicated to executor; operator told).
- Operator addendum: human tester panel on all five pages, hidden under @isPlaywright.

## Checkpoint 3 — 2026-09-28 19:48 — ON TRACK

8747d80e · final close-out

- Specs read: assertions mirror upstream Cypress/Jest; reds marked test.fail with the plan's comment; nothing loosened.
- Guard rerun: vitest src/lib/components 102/102; playwright e2e/layout (incl. parity) 38 passed.
- Executor verified the matrix identical with and without the tester panel (--repeat-each=3, 42 passed both runs).
- Action: none needed.
