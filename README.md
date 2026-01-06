# @humanspeak/svelte-motion

[![NPM version](https://img.shields.io/npm/v/@humanspeak/svelte-motion.svg)](https://www.npmjs.com/package/@humanspeak/svelte-motion)
[![Build Status](https://github.com/humanspeak/svelte-motion/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/humanspeak/svelte-motion/actions/workflows/npm-publish.yml)
[![Coverage Status](https://coveralls.io/repos/github/humanspeak/svelte-motion/badge.svg?branch=main)](https://coveralls.io/github/humanspeak/svelte-motion?branch=main)
[![License](https://img.shields.io/npm/l/@humanspeak/svelte-motion.svg)](https://github.com/humanspeak/svelte-motion/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@humanspeak/svelte-motion.svg)](https://www.npmjs.com/package/@humanspeak/svelte-motion)
[![CodeQL](https://github.com/humanspeak/svelte-motion/actions/workflows/codeql.yml/badge.svg)](https://github.com/humanspeak/svelte-motion/actions/workflows/codeql.yml)
[![Install size](https://packagephobia.com/badge?p=@humanspeak/svelte-motion)](https://packagephobia.com/result?p=@humanspeak/svelte-motion)
[![Code Style: Trunk](https://img.shields.io/badge/code%20style-trunk-blue.svg)](https://trunk.io)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Types](https://img.shields.io/npm/types/@humanspeak/svelte-motion.svg)](https://www.npmjs.com/package/@humanspeak/svelte-motion)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/humanspeak/svelte-motion/graphs/commit-activity)

## Why are we here?

Motion vibes, Svelte runes. This brings Motion’s declarative animation goodness to Svelte with `motion.<tag>` components, interaction props, and composable config. If you spot a cool React example, drop it in an issue—we’ll port it. 😍

Requests welcome: Have a feature/prop/example you want? Please open an issue (ideally include a working Motion/React snippet or example link) and we’ll prioritize it.

## Supported Elements

All standard HTML and SVG elements are supported as motion components (e.g., `motion.div`, `motion.button`, `motion.svg`, `motion.circle`). The full set is generated from canonical lists using `html-tags`, `html-void-elements`, and `svg-tags`, and exported from `src/lib/html/`.

- HTML components respect void elements for documentation and generation purposes.
- SVG components are treated as non-void.
- Dashed tag names are exported as PascalCase components (e.g., `color-profile` → `ColorProfile`).

## Configuration

### MotionConfig

This package includes support for `MotionConfig`, which allows you to set default motion settings for all child components. See the [React - Motion Config](https://motion.dev/docs/react-motion-config) for more details.

```svelte
<MotionConfig transition={{ duration: 0.5 }}>
    <!-- All motion components inside will inherit these settings -->
    <motion.div animate={{ scale: 1.2 }}>Inherits 0.5s duration</motion.div>
</MotionConfig>
```

### Layout Animations (FLIP)

Svelte Motion supports minimal layout animations via FLIP using the `layout` prop:

```svelte
<motion.div layout transition={{ duration: 0.25 }} />
```

- **`layout`**: smoothly animates translation and scale between layout changes (size and position).
- **`layout="position"`**: only animates translation (no scale).

### Exit Animations (AnimatePresence)

Animate elements as they leave the DOM using `AnimatePresence`. This mirrors Motion’s React API and docs for exit animations ([reference](https://motion.dev/docs/react)).

```svelte
<script lang="ts">
    import { motion, AnimatePresence } from '$lib'
    let show = $state(true)
</script>

<AnimatePresence>
    {#if show}
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5 }}
            class="size-24 rounded-md bg-cyan-400"
        />
    {/if}
</AnimatePresence>

<motion.button whileTap={{ scale: 0.97 }} onclick={() => (show = !show)}>Toggle</motion.button>
```

- The exit animation is driven by `exit` and will play when the element unmounts.
- Transition precedence (merged before running exit):
    - `exit.transition` (highest precedence)
    - component `transition` (merged with `MotionConfig`)
    - fallback default `{ duration: 0.35 }`

#### Current Limitations

Some Motion features are not yet implemented:

- `reducedMotion` settings
- `features` configuration
- Performance optimizations like `transformPagePoint`
- Advanced transition controls
- Shared layout / `layoutId` (planned)

## External Dependencies

This package carefully selects its dependencies to provide a robust and maintainable solution:

### Core Dependencies

- **motion**
    - High-performance animation library for the web
    - Provides smooth, hardware-accelerated animations
    - Supports spring physics and custom easing
    - Used for creating fluid motion and transitions

### Examples

| Motion                                                                                                   | Demo / Route                             | Live Demo                                                                                      |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [React - Enter Animation](https://examples.motion.dev/react/enter-animation)                             | `/tests/motion/enter-animation`          | [View Example](https://svelte.dev/playground/7f60c347729f4ea48b1a4590c9dedc02?version=5.38.10) |
| [HTML Content (0→100 counter)](https://examples.motion.dev/react/html-content)                           | `/tests/motion/html-content`             | [View Example](https://motion.svelte.page/examples/html-content)                               |
| [Aspect Ratio](https://examples.motion.dev/react/aspect-ratio)                                           | `/tests/motion/aspect-ratio`             | [View Example](https://svelte.dev/playground/1bf60e745fae44f5becb4c830fde9b6e?version=5.38.10) |
| [Hover + Tap (whileHover + whileTap)](https://examples.motion.dev/react/gestures)                        | `/tests/motion/hover-and-tap`            | [View Example](https://motion.svelte.page/examples/hover-and-tap)                              |
| [Focus (whileFocus)](https://motion.dev/docs/react-motion-component#focus)                               | `/tests/motion/while-focus`              | [View Example](https://motion.svelte.page/examples/while-focus)                                |
| [Rotate](https://examples.motion.dev/react/rotate)                                                       | `/tests/motion/rotate`                   | [View Example](https://motion.svelte.page/examples/rotate)                                     |
| [Random - Shiny Button](https://www.youtube.com/watch?v=jcpLprT5F0I) by [@verse\_](https://x.com/verse_) | `/tests/random/shiny-button`             | [View Example](https://svelte.dev/playground/96f9e0bf624f4396adaf06c519147450?version=5.38.10) |
| [Fancy Like Button](https://github.com/DRlFTER/fancyLikeButton)                                          | `/tests/random/fancy-like-button`        | [View Example](https://svelte.dev/playground/c34b7e53d41c48b0ab1eaf21ca120c6e?version=5.38.10) |
| [Keyframes (square → circle → square; scale 1→2→1)](https://motion.dev/docs/react-animation#keyframes)   | `/tests/motion/keyframes`                | [View Example](https://svelte.dev/playground/05595ce0db124c1cbbe4e74fda68d717?version=5.38.10) |
| [Animated Border Gradient (conic-gradient rotate)](https://www.youtube.com/watch?v=OgQI1-9T6ZA)          | `/tests/random/animated-border-gradient` | [View Example](https://svelte.dev/playground/6983a61b4c35441b8aa72a971de01a23?version=5.38.10) |
| [Exit Animation](https://motion.dev/docs/react#exit-animations)                                          | `/tests/animate-presence/basic`          | [View Example](https://svelte.dev/playground/ef277e283d864653ace54e7453801601?version=5.38.10) |

## Interactions

### Hover

Svelte Motion now supports hover interactions via the `whileHover` prop, similar to React Motion/Framer Motion.

```svelte
<motion.div whileHover={{ scale: 1.05 }} />
```

- `whileHover` accepts a keyframes object. It also supports a nested `transition` to override the global transition for hover only:

```svelte
<motion.button
    whileHover={{ scale: 1.05, transition: { duration: 0.12 } }}
    transition={{ duration: 0.25 }}
/>
```

- Baseline restoration: when the pointer leaves, changed values are restored to their pre-hover baseline. Baseline is computed from `animate` values if present, otherwise `initial`, otherwise sensible defaults (e.g., `scale: 1`, `x/y: 0`) or current computed style where applicable.
- True-hover gating: hover behavior runs only on devices that support real hover and fine pointers (media queries `(hover: hover)` and `(pointer: fine)`), avoiding sticky hover states on touch devices.

### Tap

```svelte
<motion.button whileTap={{ scale: 0.95 }} />
```

- Callbacks: `onTapStart`, `onTap`, `onTapCancel` are supported.
- Accessibility: Elements with `whileTap` are keyboard-accessible (Enter and Space).
    - Enter or Space down → fires `onTapStart` and applies `whileTap` (Space prevents default scrolling)
    - Enter or Space up → fires `onTap`
    - Blur while key is held → fires `onTapCancel`
    - `MotionContainer` sets `tabindex="0"` automatically when `whileTap` is present and no `tabindex`/`tabIndex` is provided.

### Focus

```svelte
<motion.button whileFocus={{ scale: 1.05, outline: '2px solid blue' }} />
```

- Animates when the element receives keyboard focus and restores baseline on blur.
- Callbacks: `onFocusStart`, `onFocusEnd` are supported.
- Perfect for keyboard navigation and accessibility enhancements.

### Animation lifecycle

```svelte
<motion.div
    onAnimationStart={(def) => {
        /* ... */
    }}
    onAnimationComplete={(def) => {
        /* ... */
    }}
/>
```

## Variants

Variants allow you to define named animation states that can be referenced throughout your component tree. They're perfect for creating reusable animations and orchestrating complex sequences.

### Basic usage

Instead of defining animation objects inline, create a `Variants` object with named states:

```svelte
<script lang="ts">
    import { motion, type Variants } from '@humanspeak/svelte-motion'

    let isOpen = $state(false)

    const variants: Variants = {
        open: { opacity: 1, scale: 1 },
        closed: { opacity: 0, scale: 0.8 }
    }
</script>

<motion.div {variants} initial="closed" animate={isOpen ? 'open' : 'closed'}>Click me</motion.div>
```

### Variant propagation

One of the most powerful features is **automatic propagation** through component trees. When a parent changes its animation state, all children with `variants` defined automatically inherit that state:

```svelte
<script lang="ts">
    let isVisible = $state(false)

    const containerVariants: Variants = {
        visible: { opacity: 1 },
        hidden: { opacity: 0 }
    }

    const itemVariants: Variants = {
        visible: { opacity: 1, x: 0 },
        hidden: { opacity: 0, x: -20 }
    }
</script>

<motion.ul variants={containerVariants} initial="hidden" animate={isVisible ? 'visible' : 'hidden'}>
    <!-- Children automatically inherit parent's variant state -->
    <motion.li variants={itemVariants}>Item 1</motion.li>
    <motion.li variants={itemVariants}>Item 2</motion.li>
    <motion.li variants={itemVariants}>Item 3</motion.li>
</motion.ul>
```

**How it works:**

- Parent sets `animate="visible"`
- Children with `variants` automatically inherit `"visible"` state
- Each child resolves its own variant definition
- No need to pass `animate` props to children!

### Staggered animations

Create staggered animations with transition delays:

```svelte
{#each items as item, i}
    <motion.div variants={itemVariants} transition={{ delay: i * 0.1 }}>
        {item}
    </motion.div>
{/each}
```

See the [Variants documentation](https://motion.svelte.page/docs/variants) for complete details and examples.

## Server-side rendering

Motion components render their initial state during SSR. The container merges inline `style` with the first values from `initial` (or the first keyframes from `animate` when `initial` is empty) so the server HTML matches the starting appearance. On hydration, components promote to a ready state and animate without flicker.

```svelte
<motion.div
    initial={{ opacity: 0, borderRadius: '12px' }}
    animate={{ opacity: 1 }}
    style="width: 100px; height: 50px"
/>
```

Notes:

- Transform properties like `scale`/`rotate` are composed into a single `transform` style during SSR.
- When `initial` is empty, the first keyframe from `animate` is used to seed SSR styles.
- `initial` can be `false` to not run on initial

## Utilities

### useTime(id?)

- Returns a Svelte readable store that updates once per animation frame with elapsed milliseconds since creation.
- If you pass an `id`, calls with the same id return a shared timeline (kept in sync across components).
- SSR-safe: Returns a static `0` store when `window` is not available.

```svelte
<script lang="ts">
    import { motion, useTime } from '$lib'
    import { derived } from 'svelte/store'

    const time = useTime('global') // shared
    const rotate = derived(time, (t) => ((t % 4000) / 4000) * 360)
</script>

<motion.div style={`rotate: ${$rotate}deg`} />
```

### useAnimationFrame(callback)

- Runs a callback on every animation frame with the current timestamp.
- The callback receives a `DOMHighResTimeStamp` representing the time elapsed since the time origin.
- Returns a cleanup function that stops the animation loop.
- Best used inside a `$effect` to ensure proper cleanup when the component unmounts.
- SSR-safe: Does nothing and returns a no-op cleanup function when `window` is unavailable.

```svelte
<script lang="ts">
    import { useAnimationFrame } from '$lib'

    let cubeRef: HTMLDivElement

    $effect(() => {
        return useAnimationFrame((t) => {
            if (!cubeRef) return

            const rotate = Math.sin(t / 10000) * 200
            const y = (1 + Math.sin(t / 1000)) * -50
            cubeRef.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`
        })
    })
</script>

<div bind:this={cubeRef}>Animated content</div>
```

- Reference: Motion useAnimationFrame docs [motion.dev](https://motion.dev/docs/react-use-animation-frame).

### useSpring

`useSpring` creates a readable store that animates to its latest target with a spring. You can either control it directly with `set`/`jump`, or have it follow another readable (like a time-derived value).

```svelte
<script lang="ts">
    import { useTime, useTransform, useSpring } from '$lib'

    // Track another readable
    const time = useTime()
    const blurTarget = useTransform(() => {
        const phase = ($time % 2000) / 2000
        return 4 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) // 0..4
    }, [time])
    const blur = useSpring(blurTarget, { stiffness: 300 })

    // Or direct control
    const x = useSpring(0, { stiffness: 300 })
    // x.set(100) // animates to 100
    // x.jump(0)  // jumps without animation
</script>

<div style={`filter: blur(${$blur}px)`} />
```

- Accepts number or unit string (e.g., `"100vh"`) or a readable source.
- Returns a readable with `{ set, jump }` methods when used in the browser; SSR-safe on the server.
- Reference: Motion useSpring docs [motion.dev](https://motion.dev/docs/react-use-spring?platform=react).

### useTransform

`useTransform` creates a derived readable. It supports:

- Range mapping: map a numeric source across input/output ranges with optional `{ clamp, ease, mixer }`.
- Function form: compute from one or more dependencies.

Range mapping example:

```svelte
<script lang="ts">
    import { useTime, useTransform } from '$lib'
    const time = useTime()
    // Map 0..4000ms to 0..360deg, unclamped to allow wrap-around
    const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false })
</script>

<div style={`rotate: ${$rotate}deg`} />
```

Function form example:

```svelte
<script lang="ts">
    import { useTransform } from '$lib'
    // Given stores a and b, compute their sum
    const add = (a: number, b: number) => a + b
    // deps are stores; body can access them via $ syntax
    const total = useTransform(() => add($a, $b), [a, b])
</script>

<span>{$total}</span>
```

- Reference: Motion useTransform docs [motion.dev](https://motion.dev/docs/react-use-transform?platform=react).

## Access the underlying element (bind:ref)

You can bind a ref to access the underlying DOM element rendered by a motion component:

```svelte
<script lang="ts">
    import { motion } from '$lib'
    let el: HTMLDivElement | null = null
</script>

<motion.div bind:ref={el} animate={{ scale: 1.1 }} />

{#if el}
    <!-- use el for measurements, focus, etc. -->
{/if}
```

## License

MIT © [Humanspeak, Inc.](LICENSE)

## Credits

Made with ❤️ by [Humanspeak](https://humanspeak.com)
