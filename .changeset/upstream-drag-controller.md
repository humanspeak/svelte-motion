---
'@humanspeak/svelte-motion': minor
---

`drag` is now powered by Motion's own drag controller. Fixes: window scroll during a held drag, dragging from a `var()` or `%` value, default `touch-action`/`user-select`/`draggable`. `dragControls` now drives every subscribed element and honors `distanceThreshold`. Behavior now matches Motion:

- Default drag styles (`touch-action`, `user-select: none`, `draggable="false"`) are set inline and win over your CSS.
- Re-grabbing an element outside its constraints moves it back toward the edge, then it follows the pointer at the elastic rate.
- `pointercancel` ends a drag like `pointerup`, so momentum runs and `onDragEnd` fires.
- Only the first `dragConstraints` element is watched for resizes; swapping to a new element applies its bounds but doesn't observe it.
- When a constraint element resizes, a resting element moves to the same relative position within the new constraints.
- `dragControls.stop()` and `cancel()` do nothing when no drag is live, so they no longer stop the animation after release.
