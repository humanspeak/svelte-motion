# Guard report — 006 reorder-board-pointer

**Recommendation: PASS** — `Reorder.Board` pointer moves between groups work through our components with no core edits. The two load-bearing deviations are proven by mutation, and every gate is green.
**Reviewed at** 5011a60a · 2026-11-06 14:47 · **Plan planned at** f93a1d92
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `pnpm check` 0 errors | met | 1844 files, 0 errors (34 warnings; +2 in the test harness) |
| `pnpm test:only`; board.component.spec ≥18 passing | met | 1625/1625; board.component.spec 23/23 |
| `e2e/reorder e2e/lazy-motion` all pass | met | 73/73, port 4250 |
| `Board` in reorder.ts and m.ts | met | grep matches in both |
| no change to _MotionContainer / visualElementCore | met | `git diff --name-only HEAD~1` → 0 |
| consumer fixture passes | met | types + tree-shaking + SSR checks passed |

## Spirit

Users can now drag cards between `Reorder.Group`s inside a `Reorder.Board`, with the gesture continuing seamlessly in the new group, as in Motion 14.10. The Svelte-specific risk the plan flagged was the store entry being deleted before receive. It was proven real and solved without touching core, and tests now guard it.

## Scope & conduct

- In scope: yes. A temporary `SpikeItem.svelte` was created and then deleted. `ReorderSsr.svelte` was tried and reverted, because it's out of scope via `verify.mjs`.
- STOP respected: yes. No core edits.
- Amendments: none.

## Residual risk / follow-ups

- **Latent drift during Board auto-scroll (core; needs its own plan).** The trigger is a handed-off item dragged while its new siblings are still layout-animating, while an ancestor without `layoutScroll` scrolls. The scroll is then compensated twice: once by PanSession, and again by the drag's `didUpdate` layout delta from `_MotionContainer`'s per-frame re-measure. The item runs ahead of the pointer. The e2e passes only because, with upstream's geometry, the item lands before scrolling starts.
- No Firefox run: there's no firefox Playwright project.
- Keyboard moves across groups are plan 007. Docs are plan 008.
