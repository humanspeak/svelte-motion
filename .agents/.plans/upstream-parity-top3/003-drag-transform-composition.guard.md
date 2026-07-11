# Guard log — 003 drag-transform-composition

## Checkpoint 1 — 2026-07-10 11:41 — ON TRACK

c3525d0 · post-completion checkpoint at operator request; executor had marked
the plan DONE in the batch README. Snapshot-committed the working tree
(drag.ts writer, transformComposer.ts, hover composer, container plumbing,
unit tests, README row) via the commit skill; pre-commit fmt/lint/svelte-check
passed.

- Drift check: in-scope files changed between `634983b` (planned-at) and the
  fork point `89f8d70` (263/29/8 lines), but the plan's "Current state"
  excerpts still matched at the fork — the executor's diff removes exactly the
  excerpted `managedScale`/translate string-splicing (`drag.ts` old ~550-589).
  No STOP warranted.
- Done criteria reproduced: `pnpm check` → 0 errors; `pnpm test` → 759/759;
  `grep -n "only updates \`origin\`" src/lib/utils/drag.ts` → no match;
  drag/reorder e2e launched (result recorded in Checkpoint 2).
- Assertions read, not gamed: e2e decomposes `getComputedStyle().transform`
  via DOMMatrix across 8 live frames (`while-drag-transforms.spec.ts:43-54,
71-78,90-105`); unit tests cover upstream channel order, live
  transformTemplate values, and the #421 bound-MotionValue empty-write guard
  (`drag.spec.ts:30-68`); the plan's required hover rotateX-survival case is
  present (`hover.spec.ts:219-230`). Demo page drives rotation only via
  `whileDrag` — nothing rigged.
- Plan defect (minor, moot): plan names `src/lib/utils/interaction.ts` for the
  hover partial-rebuild; the pattern actually lived in `hover.ts`
  (`writeComposedScale`, removed by this diff). `interaction.ts` has no
  transform rebuild (grep empty). Executor followed the plan's intent in the
  right file. No amendment needed post-execution.
- Justified deviation: shared writer landed in new
  `src/lib/utils/transformComposer.ts` instead of inside `drag.ts` — Step 4
  ("route hover through the same writer") requires a shared module, and it
  serves Plan 004's note to keep the writer's API small and documented.
- Action: proceeded to final close-out at operator request.

## Checkpoint 2 — 2026-07-10 11:44 — ON TRACK (final)

c3525d0 · final close-out. Tree already clean (same snapshot as Checkpoint 1).

- e2e gate reproduced: `pnpm exec playwright test e2e/drag e2e/reorder` →
  76 passed / 1 skipped, exit 0, including the `siblings-flip` drift-sampling
  specs that encode the #379 no-lag pin.
- Red verification: restored `drag.ts`/`hover.ts`/`_MotionContainer.svelte`
  from `e0a88c7` (tests present, fix absent) and re-ran the new spec — exactly
  the 3 characterization tests FAIL for the plan's documented reasons
  (rotation drops, y drifts, rotateX/m23 lost); only the nav-link test passes.
  Files restored byte-identical afterward (`git diff HEAD` empty).
- PR withheld despite PASS: the plan's Git workflow section is explicit —
  "Do NOT push or open a PR; maintainer signs off on live demos first."
  Recorded in the close-out report; publication is the operator's next move.
- Action: close-out report written (`003-drag-transform-composition.guard-report.md`),
  verdict PASS; reported to operator.

## Checkpoint 3 — 2026-07-10 11:55 — ON TRACK (integration)

c3525d0 · maintainer drove the live demo and signed off; publication gate
cleared.

- Branch pushed (`git push -u origin fix/drag-transform-composition`) and PR
  opened via the `pr` skill: <https://github.com/humanspeak/svelte-motion/pull/446>
  (base `main`, labels `bug`/`javascript`, `Closes #436`, refs #403/#396).
- Report's Integrated line updated with the PR URL.
- Action: handed back to operator — merging is the operator's call.
