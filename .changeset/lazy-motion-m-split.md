---
'@humanspeak/svelte-motion': patch
---

**Behaviour change (Motion parity):** `motion.*` components now always have every feature and ignore `<LazyMotion>`; only `m.*` components take LazyMotion's bundle. `<LazyMotion strict>` now throws in development when a `motion` component renders inside it. New `@humanspeak/svelte-motion/m` entry exports `m` and a `Reorder` that gets its features from LazyMotion; the main `Reorder` inside `<LazyMotion strict>` warns once with that fix (Motion 14.7.0, #2232, #2094). LazyMotion does not reduce bundle size yet.
