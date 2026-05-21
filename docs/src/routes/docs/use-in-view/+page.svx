---
title: 'useInView'
description: 'Track whether an element is in the viewport via a $state-backed { current } snapshot.'
---

<script>
  import { useInView } from '@humanspeak/svelte-motion';
  import Example from '$lib/components/general/Example.svelte';
  import UseInViewExample from '$lib/examples/use-in-view/demos/Default.svelte';
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'useInView | Docs | Svelte Motion'
      seo.description = 'Track whether an element is in the viewport with a $state-backed { current } snapshot. useInView mirrors framer-motion and pairs naturally with Svelte 5 bind:this.'
      seo.ogTitle = 'useInView'
      seo.ogTagline = 'Detect viewport entry via a reactive snapshot'
      seo.ogFeatures = ['Svelte 5 Runes', 'IntersectionObserver', 'Once Latch', 'SSR Safe']
      seo.ogSlug = 'docs-use-in-view'
  }
</script>

# useInView

`useInView` returns a `$state`-backed `{ current }` object reporting whether an element is in the viewport. It uses the same `IntersectionObserver` infrastructure as the `whileInView` motion prop, so it's a good fit for non-animation side effects: analytics impressions, lazy data loads, one-shot reveals, and scroll-driven UI.

```svelte
<script>
    import { useInView } from '@humanspeak/svelte-motion'

    let ref
    const inView = useInView(() => ref)
</script>

<div bind:this={ref}>
    {inView.current ? 'visible' : 'hidden'}
</div>
```

> Diverges from React framer-motion's plain `boolean` return for the same reason as `useCycle`: a `$state`-backed value must live on an object so reads inside getters preserve tracking under Svelte 5 runes.

`target` accepts either an `HTMLElement` directly or a getter
`() => HTMLElement | undefined`. The getter form is the right choice with
Svelte 5 `bind:this`, because the element binding isn't available until after
mount &mdash; the hook resolves it lazily and polls on `requestAnimationFrame`
until it appears.

<Example isSmall exampleUrl="/examples/use-in-view">
  <UseInViewExample />
</Example>

## Latching with `once`

Pass `{ once: true }` when you only care about the first viewport entry. `.current` flips to `true` and the observer stops — subsequent scrolls don't flip it back:

```svelte
<script lang="ts">
    import { useInView } from '@humanspeak/svelte-motion'

    let card: HTMLElement | undefined
    const trackImpression = () => {
        // send analytics, fetch lazy data, etc.
    }
    const inView = useInView(() => card, { once: true })

    $effect(() => {
        if (inView.current) trackImpression()
    })
</script>

<article bind:this={card}>…</article>
```

## Custom thresholds and roots

`amount` controls how much of the element must be visible to count as
"in view": `"some"` (default, any pixel), `"all"` (fully visible), or a number
between `0` and `1`. `margin` is forwarded to `IntersectionObserver`'s
`rootMargin`, and `root` lets you observe inside a scrollable container instead
of the viewport.

```svelte
<script>
    import { useInView } from '@humanspeak/svelte-motion'

    let scrollContainer
    let target

    const inView = useInView(() => target, {
        root: () => scrollContainer,
        amount: 0.5,
        margin: '-10% 0%'
    })
</script>

<div bind:this={scrollContainer} style="overflow: auto; height: 400px;">
    <div bind:this={target}>…</div>
</div>
```

## How it works

- Subscribes to `motion`'s `inView()` primitive, which is also used by `whileInView` — one IntersectionObserver implementation, two consumers.
- The observer is bound to the component's lifecycle via `$effect`: it attaches at mount, detaches at unmount. Subscriber counts no longer drive lifecycle (unlike the pre-runes impl).
- Returns a static `{ current: options.initial ?? false }` when `window` or `IntersectionObserver` is unavailable, so server rendering is safe.

## API Reference

### Parameters

- **target** `HTMLElement | (() => HTMLElement | undefined)` — the element to observe.
- **options** `UseInViewOptions` (optional)

### `UseInViewOptions`

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `root` | `HTMLElement \| () => HTMLElement` | viewport | Scroll container to observe inside. |
| `margin` | `string` | `'0px'` | CSS margin around the root bounding box (passed to `rootMargin`). |
| `amount` | `'some' \| 'all' \| number` | `'some'` | Fraction of the target that must be visible. |
| `once` | `boolean` | `false` | When `true`, latches `true` on first entry and stops observing. |
| `initial` | `boolean` | `false` | Value emitted before the first IntersectionObserver callback. |

### Returns

An `InViewState` object:

- **`current`** `boolean` (getter) — `true` while the target is in view, `false` otherwise. Reactive via `$state`.
- **`subscribe(run)`** — Svelte readable store contract. Synchronously emits the current value, then re-emits on every change. Kept for compat with hooks that still consume Svelte readables.

## See also

- The `whileInView` motion prop &mdash; declarative animation when a
  `motion.*` element enters the viewport. Both this hook and `whileInView`
  share the same `IntersectionObserver` infrastructure under the hood.
- [useScroll](/docs/use-scroll) &mdash; scroll position stores for scroll-driven
  animations.

---

Based on [Motion's useInView](https://motion.dev/docs/react-use-in-view) API.
