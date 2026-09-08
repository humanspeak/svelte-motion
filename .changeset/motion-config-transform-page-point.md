---
'@humanspeak/svelte-motion': minor
---

Add `MotionConfig.transformPagePoint` and the public `MotionTransformPoint` / `MotionConfigProps` types. Drag, pan, VisualElement measurements, element-ref constraints, snap-to-cursor, callback payloads, and release velocity now share corrected local units inside uniformly or nonuniformly scaled parents.

Nested configs inherit the callback, while an explicit identity function resets a subtree. The callback reference is captured at pointerdown so replacing config during a live gesture cannot mix coordinate domains; the replacement applies to the next session.
