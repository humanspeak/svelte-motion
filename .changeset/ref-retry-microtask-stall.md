---
'@humanspeak/svelte-motion': patch
---

`useInView` and `useScroll` no longer stall Motion's microtask scheduler when their element isn't ready yet. Before, an element that took more than one microtask to appear (for example rendered later with `{#if}`) could stop layout animations and prop-driven renders on the whole page.
