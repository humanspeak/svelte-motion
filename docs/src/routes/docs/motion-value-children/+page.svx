---
title: 'MotionValue children'
description: 'Render MotionValue<number | string> values as live text children.'
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import MotionValueChildrenExample from '$lib/examples/motion-value-children/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'MotionValue children | Docs | Svelte Motion'
      seo.description = 'Render MotionValue<number | string> values as live text children on motion elements.'
      seo.ogTitle = 'MotionValue children'
      seo.ogTagline = 'Live text powered directly by MotionValue'
      seo.ogFeatures = ['MotionValue', 'Live Text', 'useTransform', 'Readouts']
      seo.ogSlug = 'docs-motion-value-children'
  }
</script>

# MotionValue children

Motion elements can render a `MotionValue<number | string>` as their live text
content. This mirrors Motion's DOM behavior: the first render samples
`children.get()`, then later MotionValue changes write to the element's
`textContent`.

In Svelte, slot content is compiled into a snippet, so the MotionValue is passed
with the `children` prop:

```svelte
<script lang="ts">
  import { motion, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

  const progress = useMotionValue(0)
  const percent = useTransform(progress, [0, 1], ['0%', '100%'])
</script>

<motion.span children={percent} />
```

<Example isSmall exampleUrl="/examples/motion-value-children">
  <MotionValueChildrenExample />
</Example>

## Usage

Use this when the value itself should be the text node: progress readouts,
scores, telemetry, prices, timers, or any small label that should update with a
MotionValue without manual subscription code.

```svelte
<script lang="ts">
  import { animate, motion, useMotionValue, useTransform } from '@humanspeak/svelte-motion'

  const value = useMotionValue(1200)
  const label = useTransform(value, (latest) => Math.round(latest).toLocaleString())

  function run() {
    animate(value, 9800, { duration: 0.8, ease: 'easeOut' })
  }
</script>

<button onclick={run}>Run</button>
<motion.output children={label} />
```

## Notes

- This path is for a single `MotionValue<number | string>` child.
- Normal slot children still render as snippets.
- To combine static text with a live value, place the text around a nested
  motion element:

```svelte
<span>
  Score <motion.span children={scoreText} />
</span>
```

## API Reference

### `children={motionValue}`

`motionValue` must be a MotionValue whose current value is a `number` or
`string`.

Based on Motion's DOM `children` handling in
`packages/framer-motion/src/render/dom/use-render.ts` and
`use-motion-value-child.ts`.
