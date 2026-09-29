# Guard log — 008-layoutid-update-driven-capture

## Checkpoint 1 — 2026-09-29 05:20 — DRIFTING (spirit gap; awaiting operator)

4883f53a on branch guard/plan-008-snapshot (executor worktree; NOT integrated) · executor final

- Done criteria met per executor: rAF capture loop removed; idle reads 30 → 0; parity 16/16 green 3/3 (interrupt via native click, Step 0; both read-count cases flipped); full e2e 496 passed, 2 unrelated failures passing in isolation.
- Spirit gap: handoff rect goes stale when a plain-DOM change moves the element without resize or a motion update — executor measured a 72px handoff jump (old loop: 0). Upstream measures live at unmount (unmount → willUpdate, create-projection-node.ts:606-607), so this is a regression against upstream, not parity. No committed test covers it; the plan's STOP ("existing handoff e2e regresses") didn't fire only because coverage is missing.
- Extra: window resize listener (one read per resize frame) added beyond plan text — within intent.
- Action: held off the shared branch; reported to operator with options.

## Checkpoint 2 — 2026-09-29 — PLAN AMENDED

- Operator chose the IntersectionObserver position watcher (Step 3b, red first). Executor resumed on the snapshot.

## Checkpoint 3 — 2026-09-29 06:37 — ON TRACK

dd41b717 · final close-out

- Red→green: plain-DOM spacer then swap — 72px stale handoff → 0px (executor, 3/3).
- Guard rerun: vitest 1007/1007; check 0 errors; parity + read-budget --repeat-each=3 60 passed; docs build exit 0, docs check 0 errors; full e2e 497 passed / 2 skipped / 1 failed (animate-presence/modes.spec.ts:114) / 1 flaky (ai-glow-border frame budget).
- modes.spec.ts:114 investigated: page has no layoutId/LayoutGroup; 8/8 isolated on tip; e2e/animate-presence ×3 run concurrently on pre-007 baseline and on tip: 237/237 both. Load-sensitive flake, not attributable to 007/008.
- Diff read: rAF loop removed (grep 0); observeMove never calls getBoundingClientRect; spec edits limited to native click + marker flips.
- Action: none needed.
