---
'@humanspeak/svelte-motion': minor
---

Add `MotionConfig.transformPagePoint` and the public `MotionTransformPoint` / `MotionConfigProps` types. Drag, pan, VisualElement measurements, element-ref constraints, controls, callback payloads, and release velocity now follow Motion's corrected-coordinate behavior inside uniformly or nonuniformly scaled parents.

Nested configs inherit an omitted callback, while explicit `undefined` clears it and an identity function opts a subtree out. Pointer input captures the callback reference at pointerdown; live measurements remain current, and retained gesture history is not remapped when a stable callback's closed-over state changes.
