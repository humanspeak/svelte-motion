---
title: 'useAnimationControls'
description: 'Legacy imperative controls for coordinating one or more motion components.'
---

<script>
  import Example from '$lib/components/general/Example.svelte';
  import UseAnimationControlsExample from '$lib/examples/use-animation-controls/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useAnimationControls | Docs | Svelte Motion'
      seo.description = 'Coordinate one or more motion components with a shared imperative controller. Mirrors Motion start, set, stop, and mount semantics.'
      seo.ogTitle = 'useAnimationControls'
      seo.ogTagline = 'Shared imperative animation controls'
      seo.ogFeatures = ['Imperative Controls', 'Variants', 'Sequencing', 'Shared Subscribers']
      seo.ogSlug = 'docs-use-animation-controls'
  }
</script>

# useAnimationControls

`useAnimationControls` creates a legacy imperative controller. Pass the returned
object to one or more `motion.*` components via `animate={controls}`, then call
`controls.start(...)`, `controls.set(...)`, or `controls.stop()`.

```svelte
<script lang="ts">
    import { motion, useAnimationControls } from '@humanspeak/svelte-motion'

    const controls = useAnimationControls()

    const run = async () => {
        await controls.start('launch')
        await controls.start('complete')
    }
</script>

<button onclick={run}>Start</button>
<motion.div
    animate={controls}
    variants={{
        launch: { x: 100 },
        complete: { x: 0, scale: 1.1 }
    }}
/>
```

<Example isSmall exampleUrl="/examples/use-animation-controls">
  <UseAnimationControlsExample />
</Example>

## Sequencing

`controls.start(definition)` returns a promise. If the controls are subscribed
to three motion components, that promise resolves after all three components
finish their animation.

```svelte
<script lang="ts">
    const controls = useAnimationControls()

    const submit = async () => {
        await controls.start('loading', { duration: 0.4 })
        await controls.start('success', { duration: 0.3 })
    }
</script>
```

## Variants

Each subscribed component resolves the same variant label against its own
`variants` map. This mirrors Motion's VisualElement fan-out behavior:

```svelte
<motion.div
    animate={controls}
    variants={{
        loading: { scale: 1.1 },
        success: { scale: 1 }
    }}
/>

<motion.span
    animate={controls}
    variants={{
        loading: { opacity: 0.5 },
        success: { opacity: 1 }
    }}
/>
```

## API Reference

### `useAnimationControls()`

Returns an `AnimationControls` object:

- **`start(definition, transitionOverride?)`** — animates every subscribed
  component and returns `Promise<unknown[]>`.
- **`set(definition)`** — synchronously sets every subscribed component to the
  target's final values. Variant labels and `transitionEnd` values are resolved.
- **`stop()`** — stops active subscriber animations.
- **`mount()`** — internal lifecycle hook called automatically by
  `useAnimationControls()`.
- **`subscribe(subscriber)`** — internal component subscription hook.

`start` and `set` throw if called before the hook's component has mounted,
matching upstream Motion's guard against render-synchronous control calls.

## Alias

`useAnimation` is exported as an alias of `useAnimationControls`, matching
Motion's legacy API.

## Related

- [`useAnimate`](/docs/use-animate) — scoped selector-based imperative animation
- [`Variants`](/docs/variants) — named animation states

Based on [Motion's useAnimationControls](https://motion.dev/docs/react-use-animation-controls) API.
