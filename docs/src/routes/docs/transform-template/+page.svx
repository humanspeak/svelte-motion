---
title: 'transformTemplate'
description: 'Customize the generated CSS transform string for motion components.'
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import TransformTemplateExample from '$lib/examples/transform-template/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'transformTemplate | Docs | Svelte Motion'
      seo.description = 'Customize generated Motion transform strings while keeping transform shortcuts and MotionValues.'
      seo.ogTitle = 'transformTemplate'
      seo.ogTagline = 'Reshape generated transform strings'
      seo.ogFeatures = ['Transform Shortcuts', 'MotionValue', 'CSS Transform', 'Motion Parity']
      seo.ogSlug = 'docs-transform-template'
  }
</script>

# transformTemplate

`transformTemplate` lets a motion component customize the final CSS
`transform` string that Motion writes to the element.

Motion still builds the generated transform from shortcuts like `x`, `y`,
`scale`, and `rotate`. Your template receives both the latest transform values
and the generated string, then returns the transform that should be rendered.

```svelte
<script lang="ts">
  import { motion } from '@humanspeak/svelte-motion'

  const transformTemplate = ({ x }, generated) =>
    `translateY(${x}) ${generated}`
</script>

<motion.div
  style={{ x: 24 }}
  {transformTemplate}
/>
```

<Example isSmall exampleUrl="/examples/transform-template">
  <TransformTemplateExample />
</Example>

## Callback Shape

```ts
type TransformTemplate = (
  transform: Record<string, string | number>,
  generatedTransform: string
) => string
```

- `transform` contains the latest transform shortcut values with CSS units
  applied. For example, `x: 10` is passed to the template as `"10px"`, and
  `rotate: 45` is passed as `"45deg"`.
- `generatedTransform` is the string Motion would normally write, such as
  `"translateX(10px) rotate(45deg)"`.
- The returned string becomes the element's final inline `transform`.

## MotionValue Styles

`transformTemplate` also works with MotionValues inside object-form styles:

```svelte
<script lang="ts">
  import { motion, useMotionValue } from '@humanspeak/svelte-motion'

  const x = useMotionValue(0)
</script>

<motion.div
  style={{ x }}
  transformTemplate={({ x }, generated) => `skewY(-2deg) ${generated}`}
/>
```

When `x` changes, the generated transform and the templated transform update
together.

## API Reference

### `transformTemplate`

```ts
transformTemplate?: TransformTemplate
```

Pass a callback to any `motion.*` component. The callback receives latest
transform shortcut values and the generated transform string.

Based on [Motion's transformTemplate prop](https://motion.dev/docs/react-motion-component#transformtemplate).
