# Guard log — 001 wait-exit-key-change

## Checkpoint 1 — 2026-09-29 18:44 — DRIFTING

`0cba0f5e` · first immutable executor snapshot, full diff read and independent gates started.

- Scope: exactly the three authorized source/test files, no library/dependency changes.
- Independent full unit gate: 86 files / 1,029 tests passed (`/tmp/motion1346-001-guard-units.log`). Snapshot commit hooks independently passed scoped lint and root svelte-check.
- Fixture reset does not fully satisfy plan reset-cancellation intent: `handleExitComplete` shares `armed` across keyed generations. An old context's uncanceled clone finalizer can consume a newly armed run. Existing reset test calls the 12-frame `expectSettled` helper before rearming, concealing this case. Executor confirmed the mechanism read-only from context capture/finalizer code.
- Action: conductor routes narrow fixture/spec correction to Sol: capture immutable generation per callback and verify immediate reset/rearm event identity. Runtime remains out of scope. Green ordinary tests alone do not earn PASS.
- Environment-only plan amendment retained all gates: pinned JS pnpm plus process-local pm-on-fail/verify-deps settings. Guard frozen workspace bootstrap passed without dependency file changes. User withdrew the unrelated skip-publish label instruction.

## Checkpoint 2 — 2026-09-29 18:54 — ON TRACK

`cd900593` · final corrected snapshot; all plan gates met.

- Correction from 0cba0f5e is limited to the new fixture/spec: callbacks capture immutable generation, stale sources are rejected, and immediate reset/rearm assertions prove ignored generation0 and accepted generation1.
- Meaningful red observed in executor log `/tmp/sol001-identity-red.log`: both object/variant reset tests failed at events assertion, expected `exit-complete:generation-1:requested-1`, received `exit-complete:generation-0:requested-1`, with only rejection disabled. Missing-telemetry failures were explicitly rejected as proof. Guard read the actual red output; this red run was executed by Sol, not independently repeated by guard.
- Independent corrected-snapshot browser repetitions: 12/12 in1.7m (`/tmp/motion1346-001-guard-final-browser.log`), production webServer rebuild/package/publint passed.
- Independent neighbors:12/12 in27.6s (`/tmp/motion1346-001-guard-neighbor.log`). Used PW_REUSE_SERVER=1 only against a conductor-owned preview of the immediately preceding verified cd900593 production build; no source changes intervened; preview stopped afterward.
- Independent full units:1,029 across86files at0cba0f5e; correction changes only route/spec files excluded from Vitest and no dependency/runtime/unit file changed, so this gate remains valid. Final snapshot commit hooks passed root types; independent scoped Trunk check3files noissues and diff check passed.
- Full diff read, no unrelated source or dependency edits. Action: PASS; conductor updated index to DONE. No push/PR; dispatch batch close rules apply.
