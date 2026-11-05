---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.9.1. What arrives with the update:

- `jump()` during a running animation ends at the jumped value (#4027).
- An open `layoutId` card that switches to another item can still exit (#4042).
- SVG path data is written to the `d` attribute.
- Accelerated transform animations finish and clean up correctly, including in WebKit.
- Timeline changes stay inside their `scopeMotion` scope.
