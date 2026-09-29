# Guard log — 008-layoutid-update-driven-capture

## Checkpoint 1 — 2026-09-29 05:20 — DRIFTING (spirit gap; awaiting operator)

4883f53a on branch guard/plan-008-snapshot (executor worktree; NOT integrated) · executor final

- Done criteria met per executor: rAF capture loop removed; idle reads 30 → 0; parity 16/16 green 3/3 (interrupt via native click, Step 0; both read-count cases flipped); full e2e 496 passed, 2 unrelated failures passing in isolation.
- Spirit gap: handoff rect goes stale when a plain-DOM change moves the element without resize or a motion update — executor measured a 72px handoff jump (old loop: 0). Upstream measures live at unmount (unmount → willUpdate, create-projection-node.ts:606-607), so this is a regression against upstream, not parity. No committed test covers it; the plan's STOP ("existing handoff e2e regresses") didn't fire only because coverage is missing.
- Extra: window resize listener (one read per resize frame) added beyond plan text — within intent.
- Action: held off the shared branch; reported to operator with options.
