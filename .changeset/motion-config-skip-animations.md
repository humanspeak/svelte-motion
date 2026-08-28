---
'@humanspeak/svelte-motion': minor
---

Add `skipAnimations` to `<MotionConfig>` — a subtree-wide animation kill switch matching Framer Motion 13.1.1. When set, every animation beneath it jumps straight to its final value instead of tweening: `animate`, `initial`, variants, `exit`, the `whileX` gestures, `useAnimationControls()` and `useAnimate()`. Intended for E2E tests and visual-regression screenshots, where a deterministic settled frame matters more than the transition.

Unlike `reducedMotion="always"`, which strips only transform keys while opacity and colour keep animating, `skipAnimations` disables the tween for every animated property. Layout/FLIP projection animations and drag momentum are unaffected, matching upstream. The prop is reactive: toggling it takes effect on already-mounted elements without a remount, so subsequent animations use the current setting. Animations already in flight when the switch flips run to completion.

**Behaviour change:** `<MotionConfig>` now inherits from its nearest ancestor config instead of shadowing it, matching upstream's `config = { ...parentConfig, ...config }`. A nested config that sets only `transition` now keeps the outer `reducedMotion` and `skipAnimations`, which is what the documentation already described. Without this, a nested config would silently re-enable animations inside a `skipAnimations` subtree.

This breaks the previously-working idiom of using a bare `<MotionConfig>` as a reset barrier — it no longer resets anything. To drop an inherited default, pass an explicit empty object instead:

```svelte
<MotionConfig transition={{ duration: 0.6 }}>
    <MotionConfig transition={{}}>
        <!-- back to motion's defaults -->
    </MotionConfig>
</MotionConfig>
```
