---
title: Animated Button (shadcn)
description: Drop-in animated replacement for the shadcn Button component
---

<script>
  import { Button } from '$lib/shadcn/ui/button'
  import ComponentSource from '$lib/components/general/ComponentSource.svelte'
  import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
  import { Download, Heart, Star, Zap, Send, Settings, Trash2, ExternalLink } from '@lucide/svelte'

  const { data } = $props()

  const seo = getSeoContext()
  if (seo) {
      seo.title = 'Animated Button (shadcn) | Docs | Svelte Motion'
      seo.description = 'Drop-in animated replacement for the shadcn-svelte Button component. Spring-based press feedback and subtle hover lift powered by Svelte Motion.'
      seo.ogTitle = 'Shadcn Button'
      seo.ogTagline = 'Animated button component built with Shadcn UI'
      seo.ogFeatures = ['Spring Press', 'Hover Lift', 'Drop-in Ready', 'Accessible']
      seo.ogSlug = 'docs-shadcn-button'
  }
</script>

# Animated Button

<div class="not-prose mb-6 flex flex-wrap items-center justify-between gap-2">
  {#if data.downloads !== null}
  <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
    <Download size={12} />
    {data.downloads.toLocaleString()} installs
  </span>
  {/if}
  <ComponentSource slug="animated-button" />
</div>

A drop-in replacement for the [shadcn-svelte Button](https://www.shadcn-svelte.com/docs/components/button) powered by `svelte-motion`. Spring-based press feedback and subtle hover lift come out of the box — no extra config needed.

## Installation

Install via the shadcn-svelte CLI from our registry:

```bash
npx shadcn-svelte@latest add https://motion.svelte.page/r/animated-button.json
```

This installs `AnimatedButton` alongside your existing `Button`. It automatically pulls in `@humanspeak/svelte-motion` and `tailwind-variants` as dependencies.

Then use it:

```svelte
<script>
  import { AnimatedButton } from '$lib/components/ui/animated-button'
</script>

<AnimatedButton variant="default">Click me</AnimatedButton>
<AnimatedButton variant="outline" size="icon" aria-label="Like"><Heart size={16} /></AnimatedButton>
<AnimatedButton animated={false}>No motion</AnimatedButton>
```

### Manual Installation

Alternatively, copy the component source directly from [GitHub](https://github.com/humanspeak/svelte-motion/tree/main/docs/src/lib/shadcn/ui/button).

## Live Demo

Try clicking and hovering on each variant:

<div class="not-prose my-8 flex flex-col gap-8">

### Variants

<div class="flex flex-wrap items-center gap-3">
  <Button variant="default">Default</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="link">Link</Button>
  <Button variant="destructive">Destructive</Button>
</div>

### Sizes

<div class="flex flex-wrap items-center gap-3">
  <Button size="sm">Small</Button>
  <Button size="default">Default</Button>
  <Button size="lg">Large</Button>
  <Button size="icon" aria-label="Like"><Heart size={16} /></Button>
  <Button size="icon-sm" variant="outline" aria-label="Favorite"><Star size={14} /></Button>
  <Button size="icon-lg" variant="secondary" aria-label="Boost"><Zap size={18} /></Button>
</div>

### With Icons

<div class="flex flex-wrap items-center gap-3">
  <Button><Send size={14} /> Send</Button>
  <Button variant="secondary"><Download size={14} /> Download</Button>
  <Button variant="outline"><Settings size={14} /> Settings</Button>
  <Button variant="ghost"><Trash2 size={14} /> Delete</Button>
</div>

### As Link

<div class="flex flex-wrap items-center gap-3">
  <Button href="https://motion.svelte.page" variant="default">Visit Docs</Button>
  <Button href="https://github.com/humanspeak/svelte-motion" variant="outline">GitHub <ExternalLink size={14} /></Button>
</div>

### Disabled State

<div class="flex flex-wrap items-center gap-3">
  <Button disabled>Disabled</Button>
  <Button variant="outline" disabled>Disabled Outline</Button>
  <Button variant="secondary" disabled>Disabled Secondary</Button>
</div>

### Without Animation

Set `animated={false}` to get vanilla shadcn behavior with no motion:

<div class="flex flex-wrap items-center gap-3">
  <Button animated={false}>No Animation</Button>
  <Button animated={false} variant="outline">Static Outline</Button>
  <Button animated={false} variant="secondary">Static Secondary</Button>
</div>

</div>

## Animation Details

| Variant | whileTap | whileHover | Transition |
|---------|----------|------------|------------|
| default, secondary, outline, ghost, destructive | `scale: 0.97` | `y: -1` | Spring (400/25) |
| icon, icon-sm, icon-lg | `scale: 0.9` | `scale: 1.08` | Spring (400/25) |
| link | `scale: 0.97` | `scale: 1.03` | Spring (400/25) |

The `animated` prop (default `true`) lets consumers opt out entirely for vanilla shadcn behavior — useful for cases where the animation conflicts with a parent layout.

## API

All standard [shadcn-svelte Button props](https://www.shadcn-svelte.com/docs/components/button) are supported, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `animated` | `boolean` | `true` | Enable/disable motion animations |
| `variant` | `string` | `"default"` | Visual variant |
| `size` | `string` | `"default"` | Size variant |
| `href` | `string` | — | Renders as `<a>` (or `motion.a`) when set |
