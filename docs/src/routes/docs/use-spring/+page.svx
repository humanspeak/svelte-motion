---
title: "useSpring"
description: "Create a spring-animated motion value with physics-based motion."
---

<script>
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useSpring | Docs | Svelte Motion'
      seo.description = 'Create a spring-animated motion value with physics-based motion. Animate values with configurable stiffness, damping, mass, duration, and bounce using Svelte Motion.'
      seo.ogTitle = 'useSpring'
      seo.ogTagline = 'Spring-based motion values with natural physics'
      seo.ogFeatures = ['Spring Physics', 'Motion Values', 'Stiffness Control', 'Damping']
      seo.ogSlug = 'docs-use-spring'
  }
</script>

# useSpring

`useSpring` creates a spring-animated motion value. Call `.set(target)` to animate toward a new value with spring physics, or `.jump(value)` to skip the animation.

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'

  const x = useSpring(0)
</script>

<div
  style="transform: translateX({x.current}px)"
  onpointermove={(e) => x.set(e.clientX)}
>
  Follows pointer with spring physics
</div>
```

## Reading the value

The returned object is a real motion-dom `MotionValue` with a Svelte 5 reactive `.current` getter on top. There are three ways to read it:

```svelte
<!-- Svelte 5 idiomatic — recommended -->
<div style="transform: translateX({x.current}px)" />

<!-- Legacy auto-subscribe — still works via .subscribe() shim -->
<div style="transform: translateX({$x}px)" />

<!-- Imperative — for callbacks and event handlers -->
<script>
  function logPosition() {
    console.log(x.get())
  }
</script>
```

`x.current` tracks via `$state`, so reads inside templates, `$derived`, and `$effect` re-run automatically when the spring updates. `$x` is the Svelte 4–style auto-subscribe path — it works because the spring exposes a `.subscribe()` shim, but `.current` is preferred for new code.

## Usage

### From an initial value

Pass a number or unit string to create a spring with that initial value:

```svelte
<script lang="ts">
  import { useSpring } from '@humanspeak/svelte-motion'

  const scale = useSpring(1)
</script>

<div
  style="transform: scale({scale.current})"
  onpointerenter={() => scale.set(1.2)}
  onpointerleave={() => scale.set(1)}
>
  Hover to scale
</div>
```

### Following another motion value

Pass another `MotionValue` (e.g. from `useMotionValue`, `useScroll`, or another `useSpring`) and the spring will animate toward whatever that source emits:

```svelte
<script>
  import { useMotionValue, useSpring } from '@humanspeak/svelte-motion'

  const target = useMotionValue(0)
  const smoothed = useSpring(target, { stiffness: 100, damping: 20 })
</script>

<input
  type="range"
  min="0"
  max="100"
  oninput={(e) => target.set(+e.currentTarget.value)}
/>
<div style="transform: translateX({smoothed.current}px)">Smooth</div>
```

### Following a Svelte readable store

For interop with hooks that still return Svelte stores (`useScroll`, `useTime`), pass the store directly — it's bridged into a motion value internally:

```svelte
<script>
  import { useScroll, useSpring } from '@humanspeak/svelte-motion'

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress)
</script>

<div class="bar" style="transform: scaleX({scaleX.current}); transform-origin: left" />
```

### With unit strings

`useSpring` preserves unit suffixes like `px`, `deg`, `vh`, `%`:

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'

  const rotation = useSpring('0deg')
</script>

<button onclick={() => rotation.set('180deg')}>
  <div style="transform: rotate({rotation.current})">Flip</div>
</button>
```

## Configuration

Customize the spring physics by passing options:

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'

  // Snappy spring — stiffer, more damping
  const fast = useSpring(0, { stiffness: 400, damping: 30 })

  // Bouncy spring — stiff but underdamped
  const bouncy = useSpring(0, { stiffness: 200, damping: 10 })

  // Heavy, slow spring
  const heavy = useSpring(0, { stiffness: 100, damping: 20, mass: 3 })

  // Duration-based instead of physics-based
  const timed = useSpring(0, { duration: 0.5, bounce: 0.25 })
</script>
```

### Defaults

| Option        | Default | Notes                                                  |
| ------------- | ------- | ------------------------------------------------------ |
| `stiffness`   | `100`   | Higher = snappier                                      |
| `damping`     | `10`    | Higher = less oscillation                              |
| `mass`        | `1`     | Higher = more lethargic                                |
| `restDelta`   | `0.001` | Position threshold to settle                           |
| `restSpeed`   | `0.01`  | Velocity threshold to settle                           |
| `velocity`    | `0`     | Initial velocity                                       |

> **Note:** These defaults match [motion-dom](https://motion.dev/) — and React framer-motion's `useSpring`. They differ from `useSpring`'s prior svelte-motion defaults (`170` / `26`); pass explicit options if you need the older feel.

### Duration-based options

When you'd rather tune by feel than by physics constants, use the duration API:

| Option            | Default | Notes                                                                                |
| ----------------- | ------- | ------------------------------------------------------------------------------------ |
| `duration`        | `800`ms | Total animation duration                                                             |
| `visualDuration`  | —       | Visual settle time (overrides `duration` when set); easier to coordinate with tweens |
| `bounce`          | `0.3`   | `0` = no bounce, `1` = very bouncy                                                   |

Setting `stiffness`, `damping`, or `mass` overrides `duration` / `bounce`.

### `skipInitialAnimation`

When following a source motion value, the spring normally animates from its initial value to whatever the source emits first. For scroll-restoration or back-navigation scenarios where the first emit is the "current" position rather than a target, set `skipInitialAnimation: true` so the spring jumps to the first value and only animates on subsequent updates:

```svelte
<script>
  import { useScroll, useSpring } from '@humanspeak/svelte-motion'

  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, { skipInitialAnimation: true })
</script>
```

## Methods

### `set(value)`

Animate toward a new target value:

```svelte
<script>
  const x = useSpring(0)

  x.set(200) // smoothly animates to 200
</script>
```

If the spring is mid-animation, the existing velocity carries over into the new target — no visible discontinuity.

### `jump(value)`

Immediately set the value without animation:

```svelte
<script>
  const x = useSpring(0)

  x.jump(200) // instantly at 200, no animation
</script>
```

Useful for resetting state or initializing to a known position.

### `get()`

Read the current value imperatively:

```svelte
<script>
  const x = useSpring(0)

  function logPosition() {
    console.log(x.get())
  }
</script>
```

Prefer `x.current` inside reactive scopes (templates, `$derived`, `$effect`); use `.get()` in event handlers and other one-shot reads.

### `on(event, callback)`

Subscribe to motion value events. Returns an unsubscribe function.

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'
  import { onDestroy } from 'svelte'

  const x = useSpring(0)

  const off = x.on('change', (v) => console.log('changed', v))
  onDestroy(off)

  // Other events:
  x.on('animationStart', () => console.log('spring started'))
  x.on('animationComplete', () => console.log('spring settled'))
</script>
```

### `destroy()`

Tear down the spring early. Normally not needed — the spring auto-cleans up when its surrounding component unmounts.

## How it works

`useSpring` returns a `MotionValue` from `motion-dom` (the same primitive used by every other motion value in this library). The spring physics are computed by motion-dom's `attachFollow` + `JSAnimation` — the same engine React framer-motion uses, so behavior, defaults, and option semantics are 1:1.

The Svelte 5 layer adds:

- A `.current` getter backed by `$state`, kept in sync with the motion value's `change` event so reads inside reactive scopes track automatically.
- A `.subscribe(run)` shim implementing the Svelte readable store contract, so legacy `$store` syntax and store-consumers (`useTransform` function form, `useVelocity`, `derived(...)`, etc.) keep working.
- Lifecycle binding via `$effect`, so the spring auto-cleans when the component unmounts.

## Performance

- **On-demand:** The animation loop only runs while the spring is in motion.
- **Auto-settle:** Stops computing once both position delta and velocity fall below `restDelta` / `restSpeed`.
- **Velocity handoff:** Mid-animation retargets carry velocity into the new spring, so rapid input doesn't produce visual jumps.
- **SSR-safe:** Returns a static motion value with no-op `.set` / `.jump` on the server.

## Common patterns

### Pointer tracking

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'

  const x = useSpring(0, { stiffness: 300, damping: 25 })
  const y = useSpring(0, { stiffness: 300, damping: 25 })
</script>

<svelte:window
  onpointermove={(e) => { x.set(e.clientX); y.set(e.clientY) }}
/>

<div style="transform: translate({x.current}px, {y.current}px)">
  Cursor follower
</div>
```

### Toggle animation

```svelte
<script>
  import { useSpring } from '@humanspeak/svelte-motion'

  const rotation = useSpring(0, { stiffness: 200, damping: 15 })
  let toggled = $state(false)
</script>

<button onclick={() => { toggled = !toggled; rotation.set(toggled ? 180 : 0) }}>
  <div style="transform: rotate({rotation.current}deg)">Toggle</div>
</button>
```

### With useVelocity

Track the velocity of a spring for momentum-based effects:

```svelte
<script>
  import { useSpring, useVelocity, useTransform } from '@humanspeak/svelte-motion'

  const x = useSpring(0)
  const xVelocity = useVelocity(x)
  const skew = useTransform(xVelocity, [-1000, 0, 1000], [-20, 0, 20])
</script>

<div style="transform: translateX({x.current}px) skewX({$skew}deg)">
  Momentum skew
</div>
```

> `useVelocity` and `useTransform` still return Svelte stores in this release (`$skew`). They'll migrate to motion values in a future release; the `.current` pattern will apply there too.

## API Reference

### Signature

```ts
useSpring(
  source: number | string | MotionValue<number | string> | Readable<number | string>,
  options?: UseSpringOptions
): SpringMotionValue<number | string>
```

### Parameters

- **source** — Initial value, unit string, another `MotionValue` to follow, or a Svelte readable store to follow.
- **options** — `SpringOptions` plus `skipInitialAnimation`. See [Configuration](#configuration).

### Returns

A `SpringMotionValue<T>` — a real motion-dom `MotionValue` augmented with:

- **`current`** `T` (getter) — Svelte 5 reactive read backed by `$state`.
- **`set(value)`** — animate toward a new target.
- **`jump(value)`** — set immediately, no animation.
- **`get()`** — imperative current-value read.
- **`on(event, cb)`** — subscribe to `'change'` / `'animationStart'` / `'animationComplete'` / `'animationCancel'` / `'destroy'`.
- **`subscribe(run)`** — Svelte readable store contract for `$store` syntax and store-consumers.
- **`destroy()`** — early teardown.
- All other `MotionValue` methods from motion-dom (`getVelocity`, etc.).

## When to use

- **Smooth value transitions** — animate any numeric value with natural-feeling motion.
- **Pointer following** — track cursor or touch position with spring physics.
- **Interactive toggles** — smoothly animate between states on user interaction.
- **Smoothing scroll progress** — wrap `useScroll`'s output for buttery progress bars and parallax.

For gesture-driven springs, combine with event handlers. For time-based animations, see [useTime](/docs/use-time) + [useTransform](/docs/use-transform).

## See also

- [useVelocity](/docs/use-velocity) — track the velocity of a spring or any motion value.
- [useTransform](/docs/use-transform) — map spring values to other ranges.
- [useMotionTemplate](/docs/use-motion-template) — compose CSS strings from spring values.
- [useTime](/docs/use-time) — reactive time source for continuous animations.

---

Based on [Motion's useSpring](https://motion.dev/docs/react-use-spring) API; physics delegated to motion-dom's `attachFollow`.
