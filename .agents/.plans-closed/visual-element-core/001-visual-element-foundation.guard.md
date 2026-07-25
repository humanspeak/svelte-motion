# Guard log — 001-visual-element-foundation

## Checkpoint 2026-07-24 — plan-boundary review (executor run 1)

- **Snapshot**: commits `953f00d`, `dfc9345`, `62de7ce`, `66a7af9` on
  `issue-449-visual-element-core` (executor committed per plan's git workflow;
  working tree clean at review time — nothing to snapshot).
- **Verdict**: **ON TRACK** — APPROVED. Two plan defects surfaced and were
  handled correctly; no executor drift.

### Done criteria — re-run independently by guard (not trusted from report)

| Criterion                                                      | Guard result                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                                           | PASS — `1056 FILES 0 ERRORS 33 WARNINGS` (warning count = baseline)                                                                                  |
| `pnpm test:only` exits 0                                       | PASS — 844 passed (executor reported 843; one-test variance across runs, both exit 0)                                                                |
| e2e gate (`e2e/motion e2e/layout e2e/projection e2e/variants`) | PASS — guard ran the gate PLUS `e2e/vanilla-values e2e/utilities` (style-binding deviation warranted wider net): **197 passed, 1 skipped, 0 failed** |
| `new HTMLVisualElement` only in fallback branch                | PASS — `motionDomProjection.ts:175`, inside `options.visualElement ?? …`                                                                             |
| Store-identity test exists                                     | PASS — `visualElementCore.spec.ts:252-253` asserts `adapter.visualElement === ve` and `visualElementStore.get(element) === ve`                       |
| No out-of-scope files                                          | PASS — diffstat `0293023..HEAD`: 7 files, all in scope                                                                                               |
| README status row updated                                      | PASS — 001 → DONE                                                                                                                                    |

Test-quality audit: assertions are substantive (latestValues shapes incl.
keyframe-array first/last selection, feature-registry idempotence, parent-tree
`addChild` wiring, store identity). No gamed criteria.

### Executor deviations — classification

1. **`updateFeatures()` never called by motion-dom internally** — executor
   claim VERIFIED by guard: `grep updateFeatures node_modules/motion-dom/dist/es/render/VisualElement.mjs`
   → only the declaration at `:317`. The plan's lifecycle prose ("mount →
   update → updateFeatures") described upstream HEAD, not installed 12.42.2.
   **Classification: plan defect (prose).** Executor's consumer-side call after
   mount matches upstream `use-visual-element.ts:147`. Correct handling.
2. **`style` carried in `buildMotionNodeProps()`** despite the plan's
   "deliberately omit style" instruction. **Classification: plan defect.** The
   plan's omit-style reasoning assumed style had never been bound to a VE on
   the element; in fact the projection adapter has always written
   `{ transition, style }` onto its VE (`motionDomProjection.ts:186-192` at
   planned-at SHA), so omitting it would have CHANGED behavior — the opposite
   of the plan's stated inertness floor. Executor bisected 6 e2e failures to
   this and fixed via props-merge in the adapter (preserving the owner's
   contract). Correct handling; deviation serves "Why this matters".
3. **`seedLatestValues: false` at creation** (new option, default true).
   **Classification: plan defect (missed constraint).** `HTMLProjectionNode`
   holds `visualElement.latestValues` **by reference** and treats its transform
   keys as already-applied transforms; seeding unrendered `initial`/`animate`
   targets corrupted projection measurement (exit clone measured 124px wide of
   the live box). `makeLatestValues` is implemented + unit-tested but not wired.
   **Plan 002 MUST flip this to `true` in the same step that makes the VE the
   renderer** — recorded as a revision note in 002.

Minor plan corrections for the record: the projection adapter is constructed
whenever `window` exists (not "gated on layout features" as the plan said);
`MotionConfigProps` has no `skipAnimations` field, so that option is threaded
but unset by the container (MotionConfig.skipAnimations lives elsewhere —
plan 002 should check `MotionGlobalConfig` before wiring it).

### PLAN AMENDED (002)

Guard amended `002-animate-through-animation-state.md` with a dated revision
note incorporating findings 1–3 (constraint-tightening only; no done-criterion
was weakened). 001 itself is complete and unamended — this log is its record.
