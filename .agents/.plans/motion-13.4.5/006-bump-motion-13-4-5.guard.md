# Guard log — 006-bump-motion-13-4-5

## Checkpoint 1 — 2026-09-29 — PLAN AMENDED

- Operator: 13.4.5 published; run bump before 007 resumes. Step 2 revised (flip only unexpected passes); private ports for all e2e. Version-check command fixed earlier (2026-09-28).

## Checkpoint 2 — 2026-09-29 02:47 — ON TRACK

30b0088e · final close-out

- Diff: package.json (motion, motion-dom ^13.4.5), pnpm-lock.yaml (motion/motion-dom/framer-motion → 13.4.5), changeset. In scope.
- Guard rerun: installed motion 13.4.5 / motion-dom 13.4.5 (fs read); vitest 957/957; transform-page-point + parity suite 25 passed.
- Executor: full e2e 493 passed / 2 pre-existing skips / 0 failed; docs build+check 0 errors; React 13.4.5 reference fixture snap (716,-202) and move (766,-172) match plan 002's e2e numbers exactly.
- No parity case flipped on 13.4.5 alone — all 11 reds depend on 007 (and 008 for read counts). Parity comments still say "Plan 007 … + Plan 006"; 007 will rewrite them as it flips.
- Action: none needed.
