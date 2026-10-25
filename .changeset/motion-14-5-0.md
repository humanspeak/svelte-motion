---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.5.0. What arrives with the update:

- `arc()` paths now work with `animate()` and `useAnimate()` on plain elements, not only on motion elements. The numeric-endpoint guard still applies: unit-bearing `x`/`y` values (`'100px'`, `'50%'`) fall back to a straight line with a one-time dev warning.
- A `layout` prop turned on after mount now animates the next layout change instead of snapping.
- Keyboard `press` gestures no longer leak listeners on every focus and Enter press.
- `stagger` supports `grid` layouts and `from: 'edges'` or `from: 'random'`.
- `scaleZ` is supported as a transform value.
- `matrix3d(...)` transform strings animate correctly.
- Axis `rotate`/`skew` values (`rotateX`, `skewY` and the rest) interpolate during shared layout animations.
- Elements that unmount from a `layoutId` group are freed by the projection system.
- Accelerated transforms: animating a transform away and back no longer makes it vanish from a floating-point residue, and `stop()` no longer overwrites a transform you set yourself.
