---
'@humanspeak/svelte-motion': minor
---

Expose Motion 13.2's effect registry. `animate.addEffect()` / `animate.removeEffect()` are now typed on the re-exported `animate`, and `createEffect`, `MotionValueState`, and the `Effect` / `AnimateEffect` / `EffectOptions` types are re-exported so custom effects can drive non-DOM subjects without a second dependency. `propEffect` keeps upstream's `.get()` accessor.

`createEffect` and the exported `Effect` / `AnimateEffect` types are re-typed so the effects they produce accept this library's augmented motion values directly: `dialEffect(subject, { angle: motionValue(0) })` compiles with no cast, matching the element effects. A consumer-style compile fixture (`src/lib/utils/effects.spec.ts`) now covers every exported effect entry point, so a future upstream surface that is adopted without the same widening fails the typecheck instead of shipping.
