# Guard report — 007 reorder-board-keyboard

**Recommendation: PASS** — Reorder.Board keyboard moves match upstream. Red and the load-bearing blur guard were both reproduced, and the batch-final gate is fully green.
**Reviewed at** 8008cc06 · 2026-11-06 15:56 · **Plan planned at** f93a1d92 (pre-flight revision 2026-11-06, baseline 5011a60a)
**Integrated** — committed on `feat/motion-14.10.1`. This is the last plan in the batch; the PR waits for maintainer sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| isMoving / restore / key in board.ts | met | present (executor-cited lines 270, 312, 335) |
| `pnpm test:only` all pass; ≥12 board keyboard tests | met | 1649/1649; 15/15 keyboard tests |
| `e2e/reorder` all pass | met | included in 935/0 full chromium run |
| `pnpm check` 0 errors | met | 0 errors |
| only in-scope files | met | the 8 planned files plus the changeset |

## Spirit

A Reorder.Board is now keyboard-accessible like upstream: arrows move a grabbed card to the next column, and Escape restores it. That closes the accessibility gap plan 006 would otherwise have left. The Svelte-specific risk (the removed node's blur ending the handoff) is real in Chromium and is guarded.

## Scope & conduct

- In scope: yes. STOP respected: none fired. Amendments: pre-flight revision (baseline SHA, no Firefox project).

## Residual risk / follow-ups

- `layout: false` in the jsdom keyboard fixture hides a FLIP settle issue in jsdom only. Real browsers pass, but there's no keyboard test with layout animations on in jsdom.
- No Firefox coverage for the blur-on-removal behaviour.
