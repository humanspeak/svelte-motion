# Guard report — 008-layoutid-update-driven-capture

**Recommendation: PASS** — per-frame layoutId reads removed (idle 30 → 0), stale-rect regression closed by a read-free position watcher (72px → 0), all 16 LayoutGroup parity cases green
**Reviewed at** dd41b717 · 2026-09-29 06:37 · **Plan planned at** b791567f (amended 2026-09-29 ×2)
**Integrated** — committed on chore/motion-13.4.5; PR awaits maintainer sign-off

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| no requestAnimationFrame(captureRect) | met | grep → 0 |
| 0 idle reads; parity read-count cases green | met | read-budget + parity ×3: 60 passed; 0 test.fail left |
| e2e/layout-id, shared-layout, full e2e | met | full e2e 497 passed; 1 load flake proven pre-existing-equivalent (237/237 both trees) |
| unit, check, build, changeset | met | 1007/1007; 0 errors; docs build ok; .changeset/layoutid-update-driven-capture.md |

## Spirit

Delivers upstream's update-driven measurement: layoutId elements no longer read layout every frame, and handoffs start from the drawn position (mid-glide swaps now reverse from the on-screen box, as upstream).

## Scope & conduct

- In scope (as amended). STOPs respected; the executor surfaced the stale-rect regression instead of shipping it.

## Residual risk / follow-ups

- IntersectionObserver reports after the next frame: a click handler that shifts layout AND swaps the layoutId element in the same task still hands off from the pre-shift rect (upstream would not).
- Plain-DOM shifts during a layout animation are picked up only after it settles.
- Chromium-only verification.
- animate-presence/modes.spec.ts:114 flakes under full-suite load (both before and after this batch).
