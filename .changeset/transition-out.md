---
'@humanspeak/svelte-motion': minor
---

`transition.out` (Motion 14.7, #1725): set the transition a value uses when it leaves a state, for example `whileHover={{ scale: 1.2, transition: { out: true } }}`. On `initial` it times only the mount animation. SSR optimized appear animations now follow `initial`'s `transition.out` when set, otherwise `animate`'s own transition, so hydration no longer jumps when they differ from the `transition` prop. `initial` and `animate` objects accept an inline `transition` and `transitionEnd` in their types.
