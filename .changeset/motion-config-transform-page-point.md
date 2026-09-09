---
'@humanspeak/svelte-motion': minor
---

Add `MotionConfig.transformPagePoint` and the public `MotionTransformPoint` / `MotionConfigProps` types. Drag, pan, VisualElement measurements, element-ref constraints, controls, callback payloads, and release velocity now follow Motion's corrected-coordinate behavior inside uniformly or nonuniformly scaled parents.

Repeated `controls.start(event, { snapToCursor: true })` sessions now reconcile live axis values with their cached projection measurement, preventing cumulative snap drift after the first drag.

Nested configs inherit an omitted callback, while explicit `undefined` clears it and an identity function opts a subtree out. Pointer input captures the callback reference at pointerdown; live measurements remain current, and retained gesture history is not remapped when a stable callback's closed-over state changes.

This minor release also aligns the default, no-config gesture path with Motion: drag and pan callbacks are sampled on animation frames after the corrected 3px threshold, `delta` is frame-relative while `offset` is session-relative, and release velocity uses Motion's retained frame history. Terminal callbacks and teardown now follow Motion's pointer-up, cancellation, and detached-session ordering. These compatibility corrections can change callback timing, payloads, and short-drag behavior for consumers that do not set `transformPagePoint`.
