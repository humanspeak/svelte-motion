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

This package includes support for `MotionConfig`, which allows you to set default motion settings for all child components. See the [Reach - Motion Config](https://motion.dev/docs/react-motion-config) for more details.

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

| Motion                                                                                                   | Demo / Route                             | REPL                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [React - Enter Animation](https://examples.motion.dev/react/enter-animation)                             | `/tests/motion/enter-animation`          | [View Example](https://svelte.dev/playground/7f60c347729f4ea48b1a4590c9dedc02?version=5.38.10) |
| [HTML Content (0→100 counter)](https://examples.motion.dev/react/html-content)                           | `/tests/motion/html-content`             | [View Example](https://svelte.dev/playground/31cd72df4a3242b4b4589501a25e774f?version=5.38.10) |
| [Aspect Ratio](https://examples.motion.dev/react/aspect-ratio)                                           | `/tests/motion/aspect-ratio`             | [View Example](https://svelte.dev/playground/1bf60e745fae44f5becb4c830fde9b6e?version=5.38.10) |
| [Hover + Tap (whileHover + whileTap)](https://motion.dev/docs/react?platform=react#hover-tap-animation)  | `/tests/motion/hover-and-tap`            | [View Example](https://svelte.dev/playground/674c7d58f2c740baa4886b01340a97ea?version=5.38.10) |
| [Random - Shiny Button](https://www.youtube.com/watch?v=jcpLprT5F0I) by [@verse\_](https://x.com/verse_) | `/tests/random/shiny-button`             | [View Example](https://svelte.dev/playground/96f9e0bf624f4396adaf06c519147450?version=5.38.10) |
| [Fancy Like Button](https://github.com/DRlFTER/fancyLikeButton)                                          | `/tests/random/fancy-like-button`        | [View Example](https://svelte.dev/playground/c34b7e53d41c48b0ab1eaf21ca120c6e?version=5.38.10) |
| [Keyframes (square → circle → square; scale 1→2→1)](https://motion.dev/docs/react-animation#keyframes)   | `/tests/motion/keyframes`                | [View Example](https://svelte.dev/playground/05595ce0db124c1cbbe4e74fda68d717?version=5.38.10) |
| [Animated Border Gradient (conic-gradient rotate)](https://www.youtube.com/watch?v=OgQI1-9T6ZA)          | `/tests/random/animated-border-gradient` | [View Example](https://svelte.dev/playground/6983a61b4c35441b8aa72a971de01a23?version=5.38.10) |

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
