---
title: "useTransform"
description: "Create a MotionValue that maps another motion value across input/output ranges or computes from dependencies."
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import HTMLContent from '$lib/examples/html-content/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useTransform | Docs | Svelte Motion'
      seo.description = 'Create a MotionValue that maps numeric values across input/output ranges or computes from dependencies. Reactive .current reads in Svelte 5.'
      seo.ogTitle = 'useTransform'
      seo.ogTagline = 'Map one motion value range to another'
      seo.ogFeatures = ['Range Mapping', 'MotionValue', '.current Reads', 'Multi-Source']
      seo.ogSlug = 'docs-use-transform'
  }
</script>

# useTransform

`useTransform` creates a `MotionValue` derived from another motion value (or any Svelte readable). It supports two forms:

- Mapping form: Map a numeric source across input/output ranges with options like `clamp`, `ease`, and `mixer`.
- Compute form: Recompute from a function whose `MotionValue` reads are auto-tracked. Plus single-MV and multi-MV transformer forms, and a multi-output mapping form.

The returned value is a real motion-dom `MotionValue` augmented with a `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim — read it via `transformed.current` in templates, `$transformed` for store-style consumers, or `transformed.get()` in imperative code.

```svelte
<script lang="ts">
  import { useTime, useTransform } from '@humanspeak/svelte-motion'

  // Time source that ticks every frame
  const time = useTime()

  // Map 0..4000ms -> 0..360deg (unclamped to allow wrap-around)
  const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false })
</script>

<div style="transform: rotate({rotate.current}deg)">Rotating</div>
```

<Example isSmall exampleUrl="/examples/html-content">
  <HTMLContent />
</Example>

## Usage

### Mapping form

Map a numeric source across input/output ranges. You can shape interpolation with `ease`, clamp input to segment bounds with `clamp`, and provide a custom `mixer` for non-numeric outputs.

```svelte
<script lang="ts">
  import { useTime, useTransform } from '@humanspeak/svelte-motion'

  const time = useTime()

  // Progress cycles 0..1 every 2s
  const progress = useTransform(time, [0, 2000], [0, 1], { clamp: false })

  // Map progress to degrees
  const degrees = useTransform(progress, [0, 1], [0, 360])
</script>

<div style="transform: rotate({$degrees}deg)">↻</div>
```

#### With easing

Provide a single easing or one per segment.

```svelte
<script lang="ts">
  import { useTime, useTransform } from '@humanspeak/svelte-motion'
  const easeIn = (t: number) => t * t

  const time = useTime()
  const size = useTransform(time, [0, 1000, 2000], [0.9, 1.1, 0.9], { ease: [easeIn, easeIn] })
</script>

<div style="transform: scale({$size})">Pulsing</div>
```

#### Non-numeric outputs with mixer

For non-numeric outputs, pass a `mixer(from, to)` that returns an interpolator `(t) => value`.

```svelte
<script lang="ts">
  import { useTransform } from '@humanspeak/svelte-motion'
  import { writable } from 'svelte/store'

  // Source 0..1
  const src = writable(0)

  // Simple discrete color mixer
  const stepColor = (from: string, to: string) => (t: number) => (t < 0.5 ? from : to)

  const color = useTransform(src, [0, 1], ['red', 'blue'], { mixer: stepColor })
</script>

<div style="background: {$color}; width: 80px; height: 24px;" />
```

### Compute form (auto-tracking)

Pass a compute function with no deps array. Every `MotionValue` whose `.get()` (or `.current`) is read inside the function is automatically tracked — motion-dom's `collectMotionValues` discovers them during the initial seed call.

```svelte
<script lang="ts">
  import { useMotionValue, useTransform } from '@humanspeak/svelte-motion'

  const a = useMotionValue(2)
  const b = useMotionValue(3)

  // Recomputes whenever a or b change — no deps array required.
  const total = useTransform(() => a.get() + b.get())
</script>

<span>Total: {total.current}</span>
```

For mixed `MotionValue` + Svelte readable scenarios, sample the readable via `get(readable)` inside the compute (or `$store` syntax). Readables don't participate in `collectMotionValues`, so their values are sampled when an adjacent motion value triggers a recompute.

### Single-MV / multi-MV transformer forms

For straightforward 1→1 or N→1 transforms, the transformer-style overloads are terser than the compute form:

```svelte
<script lang="ts">
  import { useMotionValue, useTransform } from '@humanspeak/svelte-motion'

  // Single MV → single output
  const x = useMotionValue(10)
  const doubled = useTransform(x, (latest) => latest * 2)

  // Multi MV → single output
  const a = useMotionValue(2)
  const b = useMotionValue(3)
  const product = useTransform([a, b], ([latestA, latestB]) => latestA * latestB)
</script>
```

### Multi-output mapping form

Map a single source to many output ranges in one call. Returns an object of motion values keyed by your map:

```svelte
<script lang="ts">
  import { useMotionValue, useTransform } from '@humanspeak/svelte-motion'

  const x = useMotionValue(0)
  const { opacity, scale } = useTransform(x, [0, 100], {
    opacity: [0, 1],
    scale: [0.5, 1]
  })
</script>

<div style="opacity: {opacity.current}; transform: scale({scale.current})">…</div>
```

## How it works

- Mapping form picks the active input segment and interpolates between its corresponding outputs.
- `clamp` (default `true`) limits the input to current segment bounds; set `false` to allow extrapolation.
- `ease` shapes the 0..1 progress before mixing.
- If outputs are numeric, a linear mixer is used; otherwise provide a custom `mixer`.
- Descending input ranges are supported. Equal segment endpoints produce zero progress for that segment.

## API Reference

### Signatures

```ts
// Mapping form
useTransform(source, input, output, options?)
  source: MotionValue<number> | Readable<number>   // numeric source
  input:  number[]                                  // input stops
  output: T[]                                       // output stops (same length as input)
  options.clamp:  boolean                           // clamp to active segment (default true)
  options.ease:   Function | Function[]             // easing per segment
  options.mixer:  (from, to) => (t) => value        // custom mixer
  Returns: AugmentedMotionValue<T>

// Single-MV transformer form
useTransform(mv, (latest) => out)
  mv:          MotionValue<I>                       // source motion value
  transformer: (latest: I) => O                     // map latest into output
  Returns: AugmentedMotionValue<O>

// Multi-MV transformer form
useTransform([mv1, mv2, …], ([a, b, …]) => out)
  sources:     Array<MotionValue>                   // source motion values
  transformer: (latest: I[]) => O                   // combine latest values
  Returns: AugmentedMotionValue<O>

// Multi-output mapping form
useTransform(source, input, outputMap, options?)
  source:    MotionValue<number> | Readable<number>
  input:     number[]
  outputMap: { [key]: T[] }                         // one output range per key
  Returns: { [key]: AugmentedMotionValue<T> }

// Compute form (auto-tracking — no deps array)
useTransform(() => compute)
  compute: () => T                                  // reads .get() on any MotionValues
  Returns: AugmentedMotionValue<T>
  // Inside compute, call mv.get() (or read mv.current) on each MotionValue
  // you want tracked. motion-dom's collectMotionValues discovers them
  // automatically during the seed call — no explicit deps array.
```

### Parameters

- `source` `MotionValue<number> | Readable<number>`: Numeric source (mapping form).
- `input` `number[]`: Input stops (length must match `output`).
- `output` `T[]`: Output stops (same length as `input`).
- `outputMap` `{ [key: string]: T[] }`: Object of output ranges, one per key. Returns an object of motion values with the same keys.
- `options.clamp` `boolean` (default `true`): Clamp to active segment.
- `options.ease` `((t: number) => number) | Array<...>`: Easing per segment or single easing.
- `options.mixer` `(from, to) => (t) => any`: Custom mixer for non-numeric outputs.
- `transformer` `(latest) => O` / `([latest, …]) => O`: Transform / combine function (single-MV / multi-MV forms).
- `compute` `() => T`: Compute function (compute form). MotionValues read via `.get()` inside are auto-tracked.

### Returns

An `AugmentedMotionValue<T>` — a real motion-dom `MotionValue` (so it composes with `useTransform`, `useSpring`, `animate()`, etc.) plus:

- `.current` — Svelte 5 reactive getter for templates / `$derived` / `$effect`.
- `.subscribe(run)` — Svelte readable store contract (powers `$transformed` template syntax).
- All other `MotionValue` methods from motion-dom (`get`, `getVelocity`, `on`, etc.).

## When to use

- Link styles directly to time or gesture progress.
- Derive values from other stores using a declarative, reactive API.
- Map ranges with easing and clamp behavior without manual math.
- Interpolate non-numeric outputs via a custom mixer.

## See also

- [useTime](/docs/use-time) — Time source for mapping and progress.
- [useAnimationFrame](/docs/use-animation-frame) — Imperative frame callback.
- [styleString](/docs/style-string) — Build CSS style strings with automatic unit handling.

---

Based on [Motion's useTransform](https://motion.dev/docs/react-use-transform?platform=react) API.
