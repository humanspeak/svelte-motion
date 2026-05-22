---
title: "useMotionTemplate"
description: "Compose a MotionValue<string> from multiple motion values using a tagged template literal."
---

<script>
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useMotionTemplate | Docs | Svelte Motion'
      seo.description = 'Compose a MotionValue<string> from multiple motion values using a tagged template literal. Build dynamic filter, transform, and background values reactively in Svelte 5.'
      seo.ogTitle = 'useMotionTemplate'
      seo.ogTagline = 'Compose motion values into CSS template strings'
      seo.ogFeatures = ['Template Literals', 'CSS Composition', 'MotionValue', 'Reactive Strings']
      seo.ogSlug = 'docs-use-motion-template'
  }
</script>

# useMotionTemplate

`useMotionTemplate` is a tagged template literal that builds an augmented `MotionValue<string>` from interpolated motion values (or Svelte readables). When any input emits, the template is recomposed.

```svelte
<script>
  import { useSpring, useMotionTemplate } from '@humanspeak/svelte-motion'

  const blur = useSpring(0)
  const filter = useMotionTemplate`blur(${blur}px)`
</script>

<div style="filter: {filter.current}">Content</div>
```

## Usage

Pass motion values (or any Svelte readable) as template interpolations. Static strings and current values are interleaved to produce the result.

```svelte
<script lang="ts">
  import { useSpring, useMotionTemplate } from '@humanspeak/svelte-motion'

  const x = useSpring(0)
  const y = useSpring(0)
  const shadow = useMotionTemplate`${x}px ${y}px 20px rgba(0, 0, 0, 0.3)`
</script>

<div style="box-shadow: {shadow.current}">
  Dynamic shadow
</div>
```

### Multiple stores

You can interpolate as many stores as needed:

```svelte
<script>
  import { useSpring, useMotionTemplate } from '@humanspeak/svelte-motion'

  const hue = useSpring(200)
  const saturation = useSpring(70)
  const lightness = useSpring(50)

  const background = useMotionTemplate`hsl(${hue}, ${saturation}%, ${lightness}%)`
</script>

<div style="background: {background.current}">
  Reactive color
</div>
```

### With useTransform

Combine with `useTransform` to map values before composing:

```svelte
<script>
  import { useTime, useTransform, useMotionTemplate } from '@humanspeak/svelte-motion'

  const time = useTime()
  // Map elapsed time directly to a 0..1 progress motion value.
  const progress = useTransform(time, [0, 3000], [0, 1], { clamp: false })
  const blur = useTransform(progress, [0, 0.5, 1], [0, 8, 0])
  const brightness = useTransform(progress, [0, 0.5, 1], [1, 1.5, 1])

  const filter = useMotionTemplate`blur(${blur}px) brightness(${brightness})`
</script>

<div style="filter: {filter.current}">
  Animated filter
</div>
```

## How it works

1. The tagged template function receives the static string parts and the interpolated inputs (motion values or Svelte readables)
2. Seeds the result motion value by sampling each input once via `sampleSource`
3. Subscribes to every input. The first synchronous emit from each input is skipped (we've already seeded) — subsequent emits recompose the template and write to the result via `result.set(...)`
4. All subscriptions and the result motion value are torn down when the surrounding `$effect` scope unmounts

## Performance

- **Subscription-driven**: Recomposes only when an input emits, no animation frames or polling
- **Single allocation per recompose**: The static-parts array is constant; only the composed string is rebuilt
- **SSR-safe**: Returns a static augmented motion value composed from the seed snapshots on the server

## Common patterns

### Dynamic CSS filter

```svelte
<script>
  import { useSpring, useMotionTemplate } from '@humanspeak/svelte-motion'

  const blur = useSpring(0)
  const brightness = useSpring(1)
  const filter = useMotionTemplate`blur(${blur}px) brightness(${brightness})`
</script>

<img style="filter: {filter.current}" src="photo.jpg" alt="Filtered" />
```

### Animated gradient

```svelte
<script>
  import { useTime, useTransform, useMotionTemplate } from '@humanspeak/svelte-motion'

  const time = useTime()
  const angle = useTransform(time, [0, 7200], [0, 360], { clamp: false })
  const background = useMotionTemplate`linear-gradient(${angle}deg, #ff6b6b, #4ecdc4)`
</script>

<div style="background: {background.current}">
  Rotating gradient
</div>
```

### Reactive box-shadow

```svelte
<script>
  import { useSpring, useMotionTemplate } from '@humanspeak/svelte-motion'

  const offsetX = useSpring(0)
  const offsetY = useSpring(4)
  const blurRadius = useSpring(12)
  const shadow = useMotionTemplate`${offsetX}px ${offsetY}px ${blurRadius}px rgba(0, 0, 0, 0.2)`
</script>

<div style="box-shadow: {shadow.current}">
  Hover to lift
</div>
```

## API Reference

### Signature

```ts
useMotionTemplate(
  strings: TemplateStringsArray,
  ...values: MotionTemplateInput[]
): AugmentedMotionValue<string>

type MotionTemplateInput =
  | AugmentedMotionValue<number | string>
  | Readable<number | string>
```

### Parameters

- **strings** `TemplateStringsArray` — Static template string parts (provided automatically by the tagged template syntax).
- **values** `MotionTemplateInput[]` — Motion values or Svelte readables to interpolate into the template.

### Returns

An `AugmentedMotionValue<string>` — a real motion-dom `MotionValue` containing the composed string, plus:

- `.current` — Svelte 5 reactive getter (templates, `$derived`, `$effect`).
- `.subscribe(run)` — Svelte readable store contract (powers `$filter` template syntax).
- All other `MotionValue` methods from motion-dom (`get`, `on`, etc.).

## When to use

- **CSS filter chains**: Compose `blur()`, `brightness()`, `saturate()` from reactive values
- **Dynamic gradients**: Build `linear-gradient()` or `radial-gradient()` with animated stops
- **Complex box-shadows**: Animate shadow offsets, blur, and spread independently
- **Any CSS value**: Anywhere you need to compose a string from multiple reactive sources

For single-value CSS properties, you can use Svelte's built-in `{$store}` interpolation directly. `useMotionTemplate` is most useful when combining multiple reactive values into one CSS string.

## See also

- [useVelocity](/docs/use-velocity) - Track velocity of store values
- [useTransform](/docs/use-transform) - Map and transform reactive values
- [styleString](/docs/style-string) - Build complete CSS style strings with automatic unit handling

---

Based on [Motion's useMotionTemplate](https://motion.dev/docs/react-use-motion-template) API.
