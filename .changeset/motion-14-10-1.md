---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.10.1. What arrives with the update:

- `press()` gains `count`, `countTimeout`, `hold` and `repeat` options and `onActive`/`onHold`/`onRepeat` handlers. Its types are now exported.
- `drag()` accepts `x`/`y` motion values, and `dragControls.start(event, { immediate: true })` starts a drag without waiting for movement.
- `animate()` recognises a timeline made only of nested sequences.
- Timeline callbacks no longer fire extra times on repeat, and a timeline played again after finishing is stopped when its `useAnimate` scope unmounts.
- Various animation performance improvements.
