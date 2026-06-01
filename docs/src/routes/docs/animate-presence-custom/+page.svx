---
title: 'AnimatePresence custom'
description: 'Pass dynamic data from AnimatePresence into exiting variants.'
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import AnimatePresenceCustomExample from '$lib/examples/animate-presence-custom/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'AnimatePresence custom | Docs | Svelte Motion'
      seo.description = 'Forward dynamic data from AnimatePresence into exiting variants, matching Motion custom presence semantics.'
      seo.ogTitle = 'AnimatePresence custom'
      seo.ogTagline = 'Directional exits from parent presence data'
      seo.ogFeatures = ['AnimatePresence', 'custom', 'Dynamic Variants', 'Directional Exit']
      seo.ogSlug = 'docs-animate-presence-custom'
  }
</script>

# AnimatePresence custom

`AnimatePresence` accepts a `custom` prop for data that exiting children still
need after they have been removed from Svelte state. This mirrors Motion's
presence context: exit variants resolve with the latest parent
`custom` value, falling back to the motion element's own `custom` only when the
parent doesn't provide one.

```svelte
<script lang="ts">
    import { AnimatePresence, motion, type Variants } from '@humanspeak/svelte-motion'

    let index = $state(0)
    let direction = $state(1)

    const variants: Variants = {
        enter: (direction) => ({ x: direction > 0 ? 120 : -120, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (direction) => ({ x: direction > 0 ? -120 : 120, opacity: 0 })
    }
</script>

<AnimatePresence custom={direction} initial={false}>
    <motion.div
        key={index}
        {variants}
        initial="enter"
        animate="center"
        exit="exit"
    />
</AnimatePresence>
```

<Example isSmall exampleUrl="/examples/animate-presence-custom">
  <AnimatePresenceCustomExample />
</Example>

## Why parent custom matters

When a child is removed, its props are already stale. A directional carousel
needs the new navigation direction to tell the old slide where to exit. Passing
`custom={direction}` to `AnimatePresence` makes that direction available to the
exiting variant at the exact moment the exit animation is resolved.

## API Reference

### `<AnimatePresence custom={value}>`

- **`custom`** — any value forwarded to dynamic exit variants.
- Exit variants receive the `AnimatePresence` custom value before the element's
  own `custom` value.
- If `AnimatePresence custom` is `undefined`, the element's inherited
  `custom` value continues to drive variants.

## Related

- [`AnimatePresence`](/docs/animate-presence) — coordinate enter and exit animations
- [`Variants`](/docs/variants) — named animation states and function-form variants

Based on [Motion's AnimatePresence custom API](https://motion.dev/motion/animate-presence/#custom).
