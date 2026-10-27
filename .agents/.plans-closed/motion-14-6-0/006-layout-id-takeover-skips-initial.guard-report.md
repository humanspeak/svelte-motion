# Guard report — 006-layout-id-takeover-skips-initial

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `a3fea964` (lane/1460-layoutid) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| All six takeover-initial e2e tests pass; e2e/layout-id and e2e/animate-presence pass | met | `PW_PORT=4206 … e2e/layout-id e2e/animate-presence` → 154/154 |
| `layoutIdTakeover` declaration + two uses | met | _MotionContainer.svelte diff (24 changed lines) |
| `has(id` in type and implementation | met | layoutId.ts diff |
| `pnpm check` 0 errors; `pnpm test:only` passes | met | 0 errors; 91 files, 1152 tests; layoutId.spec.ts 9/9 |
| Changeset, page linked, only in-scope files | met | 7 files, all in scope |

## Spirit

A takeover now mounts as `initial={false}` (also for variant children) only when it has an `initial`, mirroring upstream's guard. The executor's red run showed opacity 0.17-0.20 for the takeover, mounted-parent and variants cases. The first-mount, long-gone and no-`initial` guards pass both before and after, so the check isn't too broad.

## Scope & conduct

In scope, no STOP, committed per the Git workflow.

## Residual risk / follow-ups

- The new test page has no guided human-tester panel; add one if the maintainer reviews it visually. The registry's handoff window now also decides whether an entrance is skipped (see the plan's maintenance notes).
