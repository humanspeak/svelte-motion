---
'@humanspeak/svelte-motion': minor
---

`animate()` and `useAnimate()`'s scoped `animate` return Motion 14.7's mutable `Timeline`: add, move and remove segments, labels (with offsets like `'mid+0.5'`), callbacks and pauses while it plays, nest timelines, `playTo` a label and `reverse`. The `Timeline`, `TimelineCallback`, `TimelineItem`, `TimelineOptions`, `AnimationSequence`, `NestedSequence`, `ObjectTarget`, `Segment`, `SequenceOptions` and `SequenceInfo` types are exported. `useAnimate` now passes `<MotionConfig reducedMotion>` to its animations (it already passed `skipAnimations`) and writes both onto `scope`, as Motion does. Like Motion, with no `MotionConfig` it animates transforms regardless of the OS reduced-motion setting.
