---
title: useFollowValue
description: Create a MotionValue that animates to its latest value using any transition type — spring, tween, inertia, or keyframes.
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import UseFollowValueExample from '$lib/examples/use-follow-value/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useFollowValue | Docs | Svelte Motion'
      seo.description = 'Motion value that follows any source through spring, tween, inertia, or keyframes. The generalised form of useSpring — pick the transition type per call.'
      seo.ogTitle = 'useFollowValue'
      seo.ogTagline = 'Follow a source with any transition type'
      seo.ogFeatures = ['Spring', 'Tween', 'Inertia', 'Keyframes']
      seo.ogSlug = 'docs-use-follow-value'
  }
</script>

# useFollowValue

`useFollowValue` is the generalised follow hook. Where [`useSpring`](/docs/use-spring) is locked to spring physics, `useFollowValue` accepts **any** transition type — spring, tween, inertia, or keyframes — so a single source can drive multiple followers, each with its own personality.

```svelte
<script lang="ts">
    import { useFollowValue, useMotionValue } from '@humanspeak/svelte-motion'

    const x = useMotionValue(0)
    const eased = useFollowValue(x, { type: 'tween', duration: 0.4, ease: 'easeOut' })
</script>

<button onclick={() => x.set(x.get() === 0 ? 200 : 0)}>Toggle</button>
<div style="transform: translateX({eased.current}px)">eased follow</div>
```

Returns a real motion-dom `MotionValue` augmented with a `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim — same shape every other Tier 2 hook returns.

<Example isSmall exampleUrl="/examples/use-follow-value">
  <UseFollowValueExample />
</Example>

The example above drives **six** followers from a single source (the pointer position). Each gets a different transition — crisp spring, bouncy spring, floaty heavy spring, quick tween, long lazy tween, and a deliberately under-damped wobbly spring — so the trail visually demonstrates how each transition feels. (Inertia is shown separately in [its own section](#inertia) — it's the right transition for fling-and-release, not continuous follow.)

## Relationship to `useSpring`

`useSpring(source, options)` is now a thin wrapper that calls `useFollowValue(source, { type: 'spring', ...options })`. Use whichever reads better:

```ts
// Equivalent — both produce a spring-animated MotionValue.
const a = useSpring(0, { stiffness: 200 })
const b = useFollowValue(0, { type: 'spring', stiffness: 200 })
```

Reach for `useFollowValue` when you want a non-spring transition or when you're building something that mixes transition types (the example above is the canonical case).

## Transition types

`useFollowValue`'s options accept any motion-dom transition shape. The four built-in types:

### Spring (default)

```svelte
<script lang="ts">
    const target = useMotionValue(0)

    // Defaults — soft spring, no overshoot.
    const soft = useFollowValue(target)

    // Tuned — stiff and lightly damped (bouncy).
    const bouncy = useFollowValue(target, {
        type: 'spring',
        stiffness: 220,
        damping: 14
    })

    // Heavy — high mass, floaty motion.
    const heavy = useFollowValue(target, {
        type: 'spring',
        stiffness: 70,
        damping: 12,
        mass: 4
    })
</script>
```

All `SpringOptions` are accepted: `stiffness`, `damping`, `mass`, `velocity`, `restDelta`, `restSpeed`, `duration`, `visualDuration`, `bounce`. See [`useSpring`](/docs/use-spring#options) for the per-option semantics.

### Tween

```svelte
<script lang="ts">
    const target = useMotionValue(0)

    const eased = useFollowValue(target, {
        type: 'tween',
        duration: 0.4,
        ease: 'easeOut'
    })
</script>
```

`ease` accepts a string (`'linear'`, `'easeIn'`, `'easeOut'`, `'easeInOut'`, `'circIn'` / `'circOut'` / `'circInOut'`, `'backIn'` / `'backOut'` / `'backInOut'`, `'anticipate'`), a function `(t: number) => number`, or a cubic-bezier array `[x1, y1, x2, y2]`.

### Inertia

```svelte
<script lang="ts">
    const target = useMotionValue(0)

    const settling = useFollowValue(target, {
        type: 'inertia',
        power: 0.6,
        timeConstant: 600
    })
</script>
```

`inertia` decays toward the target with no overshoot. Useful for scroll-rest, fling animations, and floaty-but-stable trails.

### Keyframes

```svelte
<script lang="ts">
    const target = useMotionValue(0)

    const stepped = useFollowValue(target, {
        type: 'keyframes',
        values: [0, 100, 50, 80, 0],
        times: [0, 0.3, 0.5, 0.7, 1],
        duration: 1
    })
</script>
```

Use when you want a follower that animates through a specific path on every source change rather than directly toward the new value.

## With Svelte readables

Like `useSpring`, `useFollowValue` accepts a Svelte `Readable` as the source via an internal bridge. Useful when the source is a `writable` store or a hook that still returns a Svelte readable:

```svelte
<script lang="ts">
    import { writable } from 'svelte/store'
    import { useFollowValue } from '@humanspeak/svelte-motion'

    const target = writable(0)
    const eased = useFollowValue(target, { type: 'tween', duration: 0.3 })
</script>

<button onclick={() => target.set(200)}>set 200</button>
<div style="transform: translateX({eased.current}px)" />
```

## SSR

`useFollowValue` is SSR-safe. On the server it returns a static `MotionValue` with no animation; `.set` and `.jump` become no-ops so the initial value matches the server-rendered snapshot.

## API Reference

### Parameters

- **source** `number | string | MotionValue<T> | Readable<T>` — initial value or a source to follow.
- **options** `UseFollowValueOptions` (optional) — `ValueAnimationTransition` of any type (`spring` / `tween` / `inertia` / `keyframes`) plus `skipInitialAnimation` to suppress the first animation when following a hot source (useful for `useScroll`-restoration scenarios).

### Returns

A `FollowMotionValue<T>` — a real motion-dom `MotionValue` (composes with `useTransform`, `useVelocity`, `animate()`, etc.) plus:

- `.current` — Svelte 5 reactive getter (templates / `$derived` / `$effect`).
- `.get()` — imperative current-value read.
- `.set(v)` — animate toward `v` using the configured transition.
- `.jump(v)` — set immediately without animation.
- `.subscribe(run)` — Svelte readable store contract.
- `.on(event, cb)` — motion-dom event bus (`'change'`, `'animationStart'`, `'animationComplete'`).
- All other `MotionValue` methods.

## See also

- [`useSpring`](/docs/use-spring) — convenience wrapper with `type: 'spring'` baked in
- [`useMotionValue`](/docs/motion-values) — the base motion-value primitive (no follow / no animation)
- [Motion values overview](/docs/motion-values) — how the augmented MotionValue shape composes

---

Based on [Motion's useFollowValue](https://motion.dev/docs/react-use-follow-value) API.
