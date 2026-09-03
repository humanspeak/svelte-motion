---
'@humanspeak/svelte-motion': minor
---

Expose Motion 13.2's effect registry. `animate.addEffect()` / `animate.removeEffect()` are now typed on the re-exported `animate`, and `createEffect`, `MotionValueState`, and the `Effect` / `AnimateEffect` / `EffectOptions` types are re-exported so custom effects can drive non-DOM subjects without a second dependency. `propEffect` keeps upstream's `.get()` accessor.
