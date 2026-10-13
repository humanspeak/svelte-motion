---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.2.0. What arrives with the update:

- Independent transforms (`x`, `y`, `scale`, `rotate` and the rest) on motion elements now run as one hardware-accelerated animation per element in browsers that support `linear()` easing. They stay on the main thread when the element has a `transformTemplate`, a layout animation, drag momentum, or a literal `transform`.
- While an element's transforms are accelerated, its inline `style.transform` is not updated every frame. Read `getComputedStyle(element).transform` to get the live value.
- Accelerated springs now hand their velocity off correctly when interrupted.
- `cubicBezier` easing is more accurate.
