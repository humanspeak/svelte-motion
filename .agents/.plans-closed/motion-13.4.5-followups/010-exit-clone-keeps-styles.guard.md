# Guard log — 010-exit-clone-keeps-styles

## Checkpoint 1 — 2026-09-29 — ON TRACK

f34fd411 · D1 placement + D2 snapshot

- Red: Card A tomato/12px, solo unstyled, unit '' (executor); green 3/3; painted: Card A region 0 tomato frames (guard); full e2e 506/0 failed (guard). Three 009 sibling-order assertions replaced by stricter chains (A → clone → placeholder → C) — accepted by guard (not loosened).

## Checkpoint 2 — 2026-09-29 — PLAN AMENDED

- Maintainer review found: (a) stale snapshot (B after A keeps registration look), (b) re-entry mid-exit pops + crossfades. Guard probe confirmed both. Step 5 added.

## Checkpoint 3 — 2026-09-29 — PLAN AMENDED

- Executor STOP: e2e/motion/reentry-animation.spec.ts asserted the old crossfade (clone + box mid-transition). Guard approved amending only that assertion to upstream semantics (1 box, 0 clones, opacity in (0,1)) under the operator's standing "follow upstream" rule; spec's core intent (one element after settle) unchanged.

## Checkpoint 4 — 2026-09-29 15:03 — ON TRACK

1b5d70dc · final close-out

- (b) pre-dated 010 (reproduced at 61a58d35 by executor).
- Guard painted frames: B-after-A 92 frames 0 tomato; solo re-show single smooth reversal, max frame step 1.9%.
- Guard rerun: vitest 1020/1020; check 0 errors; animate-presence + reentry 89/89. Executor full e2e 508 passed / 2 skipped / 0 failed.
- Action: none needed.
