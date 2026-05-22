---
title: MotionConfig
description: Component that supplies default transition and reduced-motion behavior to every descendant motion component.
---

<script>
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'MotionConfig | Docs | Svelte Motion'
      seo.description = 'Provide default transition timing and the reducedMotion policy to descendant motion components from one ancestor. Nest configs to scope overrides.'
      seo.ogTitle = 'MotionConfig'
      seo.ogTagline = 'Default transitions and reduced-motion policy for a subtree'
      seo.ogFeatures = ['Default Transitions', 'Reduced Motion', 'Subtree Scoped', 'Nestable']
      seo.ogSlug = 'docs-motion-config'
  }
</script>

# MotionConfig

`<MotionConfig>` is a context provider that supplies default `transition` timing and the `reducedMotion` policy to every descendant `motion.<tag>` component. Use it at the root of a route, an interactive subtree, or a single section to avoid repeating the same transition props on every child.

```svelte
<script lang="ts">
    import { MotionConfig, motion } from '@humanspeak/svelte-motion'
</script>

<MotionConfig transition={{ duration: 0.4, ease: 'easeOut' }}>
    <motion.div animate={{ scale: 1.05 }} />
    <motion.div animate={{ opacity: 0.5 }} />
</MotionConfig>
```

Both `motion.div`s above pick up `{ duration: 0.4, ease: 'easeOut' }` as their default transition. Any explicit `transition` prop on a descendant overrides the inherited default.

## Default `transition`

The `transition` prop accepts any `MotionTransition` — duration, easing, spring options, per-key overrides, etc.

```svelte
<MotionConfig
    transition={{
        type: 'spring',
        stiffness: 260,
        damping: 22
    }}
>
    <motion.div animate={{ x: 100 }} />
    <motion.div animate={{ scale: 1.1 }} />
</MotionConfig>
```

### Per-property defaults

```svelte
<MotionConfig
    transition={{
        opacity: { duration: 0.2 },
        x: { type: 'spring', stiffness: 200 },
        default: { duration: 0.4 }
    }}
>
    <!-- opacity uses 0.2s tween; x uses spring; other keys use the 0.4s default -->
    <motion.div animate={{ opacity: 1, x: 0, scale: 1.05 }} />
</MotionConfig>
```

### Override at the leaf

Explicit `transition` on a `motion.<tag>` always wins:

```svelte
<MotionConfig transition={{ duration: 0.4 }}>
    <motion.div animate={{ x: 100 }} />
    <!-- This one ignores the inherited 0.4s and uses 1s instead -->
    <motion.div animate={{ x: 100 }} transition={{ duration: 1 }} />
</MotionConfig>
```

## `reducedMotion` policy

`reducedMotion` controls how transform animations behave for descendants. Three values:

| Value | Behavior |
| --- | --- |
| `'never'` (default) | Animations run as authored, regardless of OS preference |
| `'always'` | Strip transform keys (`x`, `y`, `scale`, `rotate`, `skew`, …). Other props (opacity, color, etc.) still animate |
| `'user'` | Honor the OS-level `prefers-reduced-motion: reduce` — acts like `'always'` for users who opted in, `'never'` otherwise |

```svelte
<MotionConfig reducedMotion="user">
    <motion.div
        initial={{ x: -200, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
    >
        Always fades in. Translation only runs for users who haven't requested
        reduced motion.
    </motion.div>
</MotionConfig>
```

**`'user'` is the right default for production sites** — it respects the OS accessibility preference without forcing motion off for users who haven't opted in. Use `'always'` for previews / docs surfaces where you want motion disabled regardless of user setting.

## Nesting

Configs nest. The nearest ancestor wins per prop — and props from outer configs that aren't overridden still apply.

```svelte
<MotionConfig transition={{ duration: 0.4 }} reducedMotion="user">
    <Outer />
    <MotionConfig transition={{ duration: 0.2 }}>
        <!-- inherits reducedMotion="user" from outer, overrides duration -->
        <Inner />
    </MotionConfig>
</MotionConfig>
```

## Programmatic reads

For per-component decisions that go beyond stripping transforms (e.g. swapping a parallax effect for a static background), read the resolved policy via [`useReducedMotionConfig`](/docs/use-reduced-motion-config):

```svelte
<script lang="ts">
    import { useReducedMotionConfig } from '@humanspeak/svelte-motion'

    const reduced = useReducedMotionConfig()
</script>

{#if reduced.current}
    <StaticHero />
{:else}
    <ParallaxHero />
{/if}
```

[`useReducedMotion`](/docs/use-reduced-motion) reads only the OS preference (no `MotionConfig` ancestor required). [`useReducedMotionConfig`](/docs/use-reduced-motion-config) reads the resolved policy from the nearest `MotionConfig` combined with the OS preference.

## See also

- [`useReducedMotionConfig`](/docs/use-reduced-motion-config) — Reactive read of the resolved policy
- [`useReducedMotion`](/docs/use-reduced-motion) — OS preference only
- [WCAG 2.3.3 — Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)

---

Based on [Motion's MotionConfig](https://motion.dev/docs/react-motion-config) API.
