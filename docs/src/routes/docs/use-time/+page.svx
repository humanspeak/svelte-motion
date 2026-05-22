---
title: "useTime"
description: "A motion value that ticks once per animation frame with elapsed milliseconds."
---

<script>
  import { useTime } from '@humanspeak/svelte-motion';
  import Example from '$lib/components/general/Example.svelte';
  import UseTimeExample from '$lib/examples/use-time/demos/Default.svelte';
  import UseTimeSyncedExample from '$lib/examples/use-time-synced/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useTime | Docs | Svelte Motion'
      seo.description = 'A motion-dom MotionValue that ticks once per animation frame with elapsed milliseconds. Reactive .current reads and shared timelines in Svelte 5.'
      seo.ogTitle = 'useTime'
      seo.ogTagline = 'Motion value that updates with elapsed time'
      seo.ogFeatures = ['Elapsed Time', 'Frame Updates', 'MotionValue', 'Shared Timelines']
      seo.ogSlug = 'docs-use-time'
  }
</script>

# useTime

`useTime` returns a motion-dom `MotionValue<number>` that updates once per animation frame with elapsed milliseconds since the value was created. It's a real motion value augmented with a `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim — so it composes with `useTransform`, `useSpring`, and the rest of the Tier 2 surface.

```svelte
<script>
  import { useTime, useTransform } from '@humanspeak/svelte-motion'

  const time = useTime()
  const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false })
</script>

<div style="transform: rotate({rotate.current}deg)">
  Rotating content
</div>
```

## Usage

The store value represents elapsed milliseconds, making it perfect for time-based animations that need to stay in sync with Svelte's reactivity system.

```svelte
<script lang="ts">
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  const time = useTime()

  // Create derived values for smooth animations
  const x = derived(time, (t) => Math.sin(t / 1000) * 100)
  const y = derived(time, (t) => Math.cos(t / 1000) * 100)
  const rotate = derived(time, (t) => (t / 10) % 360)
</script>

<div style="transform: translate({$x}px, {$y}px) rotate({$rotate}deg)">
  Animated content
</div>
```

<Example isSmall exampleUrl="/examples/use-time">
  <UseTimeExample />
</Example>

## Shared timelines

Pass an `id` string to share the same RAF loop **across multiple components**. Each call returns its **own** motion value — destroying one consumer's value doesn't ripple to others — but they all observe the same underlying timeline, so the values stay perfectly in lockstep. The shared loop runs while at least one consumer is alive and stops the moment the last one unmounts; the next `useTime(id)` call restarts it.

> **Note**: Within a single component, you can simply reuse the same motion-value reference. The `id` parameter is specifically useful for synchronizing animations across different components that don't share scope.

```svelte
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  // This component will sync with any other component using 'global'
  const time = useTime('global')
  const rotation = derived(time, (t) => (t / 20) % 360)
</script>

<div style="transform: rotate({$rotation}deg)">
  Synced animation
</div>
```

### Multiple components synchronized

```svelte
<!-- ComponentA.svelte -->
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  const time = useTime('shared-timeline')
</script>

<div>Time: {$time}ms</div>

<!-- ComponentB.svelte -->
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  const time = useTime('shared-timeline')
</script>

<div>Same time: {$time}ms</div>
```

Even though these are **separate components**, they both receive updates from the same timeline by using the same `id`, ensuring perfect synchronization.

### Synced timeline example

Here's a complete example demonstrating the power of shared timelines. Notice how two **separate** `useTime()` calls with the same `id` return independent-but-synchronized motion values — different references, identical values every frame:

```svelte
<script lang="ts">
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  // Two separate useTime calls with the same id
  const time = useTime('synced-timeline')
  const time2 = useTime('synced-timeline')

  // Create animations from DIFFERENT store references
  const rotate1 = derived(time, (t) => (t / 10) % 360)
  const rotate2 = derived(time2, (t) => (t / 10) % 360)

  const scale1 = derived(time, (t) => 1 + Math.sin(t / 800) * 0.2)
  const scale2 = derived(time2, (t) => 1 + Math.sin(t / 800) * 0.2)

  const hue = derived(time, (t) => (t / 30) % 360)
</script>

<div>
  <!-- Element A uses 'time' -->
  <div style="
    transform: rotate({$rotate1}deg) scale({$scale1});
    background: linear-gradient(135deg, hsl({$hue}, 70%, 60%), hsl({$hue + 30}, 70%, 50%));
  ">
    A
  </div>

  <!-- Element B uses 'time2' -->
  <div style="
    transform: rotate({$rotate2}deg) scale({$scale2});
    background: linear-gradient(135deg, hsl({$hue + 120}, 70%, 60%), hsl({$hue + 150}, 70%, 50%));
  ">
    B
  </div>

  <!-- Proof they're synchronized -->
  <div>
    time: {$time}ms = time2: {$time2}ms
  </div>
</div>
```

<Example isSmall exampleUrl="/examples/use-time-synced">
  <UseTimeSyncedExample />
</Example>

Both elements animate in perfect synchronization even though they use **different motion-value references** (`time` and `time2`). The magic happens because both `useTime('synced-timeline')` calls observe the same underlying timeline — independent values, shared frame loop. Watch the values display - they're always identical! This is especially powerful when these elements live in **separate components** - the `id` parameter ensures they all stay in sync without prop drilling or context.

## How it works

`useTime` wraps motion-dom's `MotionValue` with a per-frame RAF loop:

1. Creates a `MotionValue<number>` that writes elapsed milliseconds on every `requestAnimationFrame`
2. With an `id`, multiple consumers observe the **same** RAF loop — each call still returns an independent motion value (so destroying one doesn't affect others) but they stay in lockstep
3. The RAF loop attaches at component mount via `$effect` and detaches at unmount — when the last consumer of a shared `id` unmounts, the loop stops; the next `useTime(id)` call restarts it

### Read patterns

```svelte
<script>
  const time = useTime()

  // Preferred — reactive in Svelte 5 templates / $derived / $effect
  $effect(() => {
    console.log('Elapsed time:', time.current, 'ms')
  })

  // Imperative (event handlers, callbacks)
  function logNow() {
    console.log('Now:', time.get(), 'ms')
  }

  // Legacy $ prefix still works via the .subscribe shim
  // {$time}
</script>
```

The RAF loop starts at component mount and stops at unmount — no subscriber tracking required.

## Performance

`useTime` is optimized for smooth animations:

- **Frame-perfect**: Updates at display refresh rate (typically 60 FPS)
- **Efficient**: Single `requestAnimationFrame` loop per unique timeline
- **Shared resources**: Multiple consumers of the same `id` share one loop
- **Auto-cleanup**: Cancels the frame loop on component unmount

## Common patterns

### Smooth rotation

```svelte
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  const time = useTime()
  const degrees = derived(time, (t) => (t / 10) % 360)
</script>

<div style="transform: rotate({$degrees}deg)">
  ↻
</div>
```

### Oscillating scale

```svelte
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  const time = useTime()
  const scale = derived(time, (t) => 1 + Math.sin(t / 500) * 0.2)
</script>

<div style="transform: scale({$scale})">
  Pulsing
</div>
```

### Color cycling

```svelte
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  const time = useTime()
  const hue = derived(time, (t) => (t / 20) % 360)
</script>

<div style="background: hsl({$hue}, 70%, 50%)">
  Rainbow
</div>
```

### Multiple synchronized animations

```svelte
<script>
  import { useTime } from '@humanspeak/svelte-motion'
  import { derived } from 'svelte/store'

  const time = useTime('sync')

  const x = derived(time, (t) => Math.sin(t / 1000) * 50)
  const y = derived(time, (t) => Math.cos(t / 800) * 30)
  const rotate = derived(time, (t) => (t / 15) % 360)
  const scale = derived(time, (t) => 1 + Math.sin(t / 600) * 0.1)
</script>

<div style="transform: translate({$x}px, {$y}px) rotate({$rotate}deg) scale({$scale})">
  Complex animation
</div>
```

## API Reference

### Parameters

- **id** `string` (optional) - Timeline identifier for sharing across components

### Returns

An `AugmentedMotionValue<number>` — a real motion-dom `MotionValue` containing elapsed milliseconds since creation, plus:

- `.current` — Svelte 5 reactive getter (templates, `$derived`, `$effect`).
- `.subscribe(run)` — Svelte readable store contract (powers `$time` template syntax and `derived(time, …)`).
- `.get()` / `.on('change', cb)` / all other motion-value methods from motion-dom.

The motion value's lifecycle is bound to the surrounding `$effect`: the RAF loop starts at mount and stops at unmount. For shared `id` timelines the loop stops only when the last consumer unmounts.

## When to use

Use `useTime` when you need:

- **Reactive time values** - Integrate time into Svelte's reactive system
- **Store-based animations** - Derive multiple animated values from one timeline
- **Cross-component synchronization** - Keep separate components in sync with shared timeline `id`
- **Declarative time** - Use `$time` syntax for clean, reactive code

For direct DOM manipulation or frame-by-frame control, consider [useAnimationFrame](/docs/use-animation-frame) instead.

## Comparison with useAnimationFrame

| Feature | useTime | useAnimationFrame |
|---------|---------|-------------------|
| Returns | Reactive store | Cleanup function |
| Usage | Declarative with `$` | Imperative callback |
| Integration | Svelte stores | Direct DOM |
| Derived values | Easy with `derived()` | Manual calculation |
| Synchronization | Built-in with `id` | Manual coordination |

## See also

- [useAnimationFrame](/docs/use-animation-frame) - For direct frame control
- [useTransform](/docs/use-transform) - For mapping and transforming values
- [styleString](/docs/style-string) - For building CSS style strings with automatic unit handling
- [Examples](/examples) - See useTime in action

---

Based on [Motion's useTime](https://motion.dev/docs/react-use-time) API.
