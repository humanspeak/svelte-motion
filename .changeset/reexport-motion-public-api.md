---
'@humanspeak/svelte-motion': minor
---

Re-export more of Motion's public, framework-agnostic API: `createScopedAnimate` (an `animate` bound to a scope element, the factory behind `useAnimate`), `animateMini` (the Web Animations-only `animate` from `motion/mini`), the `inertia` and `keyframes` generators (alongside `spring`) and `resolveElements`. Also export the `ValueAnimationOptions`, `KeyframeGenerator`, `GeneratorFactory`, `InertiaOptions`, `KeyframeOptions`, `SpringOptions`, `ElementOrSelector`, `SelectorCache`, `DOMKeyframesDefinition`, `AnimationOptions` and `AnimationPlaybackControlsWithThen` types. All are Motion's own functions, unchanged.
