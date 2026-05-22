---
title: "useScroll"
description: "Create scroll-linked animations like progress indicators and parallax effects."
---

<script>
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
  import Example from '$lib/components/general/Example.svelte'
  import ScrollProgressExample from '$lib/examples/scroll-progress/demos/Default.svelte'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useScroll | Docs | Svelte Motion'
      seo.description = 'Create scroll-linked animations like progress indicators and parallax effects with Svelte Motion useScroll.'
      seo.ogTitle = 'useScroll'
      seo.ogTagline = 'Track scroll progress of the page or a container'
      seo.ogFeatures = ['Scroll Progress', 'Parallax Effects', 'Container Scroll', 'Scroll Velocity']
      seo.ogSlug = 'docs-use-scroll'
  }
</script>

# useScroll

`useScroll` is used to create scroll-linked animations, like progress indicators and parallax effects.

> **Note:** When scroll-linked animations are powered by the `scroll` function from `motion`, animations using `opacity` or `transform` CSS properties can be hardware accelerated.

```svelte
<script>
  import { useScroll, useSpring } from '@humanspeak/svelte-motion'

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress)
</script>

<div
  style="position: fixed; top: 0; left: 0; right: 0; height: 5px;
         background: #ff0088; transform-origin: left;
         transform: scaleX({scaleX.current});"
/>
```

## Usage

### Import

```svelte
<script>
  import { useScroll } from '@humanspeak/svelte-motion'
</script>
```

`useScroll` returns four motion values augmented with a `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim:

| Value | Description |
|-------|-------------|
| `scrollX` | Horizontal scroll position in pixels |
| `scrollY` | Vertical scroll position in pixels |
| `scrollXProgress` | Horizontal scroll progress between `0` and `1` |
| `scrollYProgress` | Vertical scroll progress between `0` and `1` |

Read them with `scrollY.current` in templates and `$derived` / `$effect`, with `scrollY.get()` in imperative code, or with `$scrollY` for store-style consumers. They compose with `useTransform`, `useSpring`, and every other motion-value-aware hook.

### Page scroll

By default, `useScroll` tracks the page scroll position:

```svelte
<script>
  import { useScroll, useSpring } from '@humanspeak/svelte-motion'

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress)
</script>

<div
  style="position: fixed; top: 0; left: 0; right: 0; height: 5px;
         background: #ff0088; transform-origin: left;
         transform: scaleX({scaleX.current});"
/>
```

<Example isSmall exampleUrl="/examples/scroll-progress" file="scroll-progress/demos/Default.svelte">
  <ScrollProgressExample />
</Example>

### Element scroll

Track the scroll position of a specific scrollable element by passing it as the `container`:

```svelte
<script>
  import { useScroll } from '@humanspeak/svelte-motion'

  let containerEl

  const { scrollYProgress } = useScroll({ container: containerEl })
</script>

<div bind:this={containerEl} style="overflow-y: scroll; height: 300px;">
  <!-- tall content -->
</div>

<div>Scroll progress: {scrollYProgress.current}</div>
```

### Element position

Track a target element's position as it scrolls within its container (or the viewport):

```svelte
<script>
  import { useScroll } from '@humanspeak/svelte-motion'

  let targetEl

  const { scrollYProgress } = useScroll({ target: targetEl })
</script>

<div bind:this={targetEl}>
  <div style="opacity: {scrollYProgress.current}">
    Fades in as you scroll to this element
  </div>
</div>
```

### Scroll offsets

When tracking an element's position, the `offset` option defines when the tracking starts and ends. Each offset is a pair of intersections — one for the target and one for the container:

```svelte
<script>
  import { useScroll } from '@humanspeak/svelte-motion'

  let targetEl

  // Start when target enters bottom of viewport,
  // end when target reaches top of viewport
  const { scrollYProgress } = useScroll({
    target: targetEl,
    offset: ['start end', 'end start']
  })
</script>
```

Named offset values:

| Value | Description |
|-------|-------------|
| `"start"` | Top edge of the element |
| `"center"` | Center of the element |
| `"end"` | Bottom edge of the element |

You can also use numbers (`0` to `1`) and pixel values (`"100px"`).

## Performance

Scroll animations work best with CSS properties that can be GPU-accelerated:

- `transform` (translateX, translateY, scale, rotate)
- `opacity`

These properties don't trigger layout or paint, so the browser can animate them on the compositor thread for smooth 60fps performance even during rapid scrolling.

## Options

| Option | Type | Description |
|--------|------|-------------|
| `container` | `HTMLElement` | Scrollable element to track. Defaults to the page. |
| `target` | `HTMLElement` | Target element to track position of within the container. |
| `offset` | `string[]` | Array of scroll offsets defining when tracking starts and ends. |
| `axis` | `'x' \| 'y'` | Which axis to use for the single-axis progress callback. Defaults to `'y'`. |

## API Reference

### Signature

```ts
useScroll(options?: UseScrollOptions): {
  scrollX: AugmentedMotionValue<number>
  scrollY: AugmentedMotionValue<number>
  scrollXProgress: AugmentedMotionValue<number>
  scrollYProgress: AugmentedMotionValue<number>
}
```

### Returns

An object with four `AugmentedMotionValue<number>`s — real motion-dom `MotionValue`s with `.current` getter, `.subscribe` shim, and all standard motion-value methods (`get`, `getVelocity`, `on`, etc.).

## See also

- [Motion values overview](/docs/motion-values) — introduction to motion value stores
- [useSpring](/docs/use-spring) — smooth scroll progress with spring physics
- [useTransform](/docs/use-transform) — map scroll progress to visual ranges
- [useMotionValueEvent](/docs/use-motion-value-event) — subscribe to scroll changes

---

Based on [Motion's useScroll](https://motion.dev/docs/react-use-scroll) API.
