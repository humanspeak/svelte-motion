---
'@humanspeak/svelte-motion': patch
---

`useInView` resets to `false` when the element it observes is removed or replaced, and observes the new element (Motion 14.6.0). With `once`, it stays `true`.
