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

Svelte Motion brings a Framer Motion-style API to Svelte 5 with `motion.<tag>` components, gestures, variants, exit animations, layout animation, and utility hooks.

For the latest documentation and examples, visit [motion.svelte.page](https://motion.svelte.page).

## Install

```bash
npm install @humanspeak/svelte-motion
```

```svelte
<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.97 }}>
    Hello motion
</motion.button>
```

## API parity snapshot (current)

Goal: Framer Motion API parity for Svelte where common React examples can be translated with minimal changes.

| Capability                                                | Status                          |
| --------------------------------------------------------- | ------------------------------- |
| `initial` / `animate` / `transition`                      | Supported                       |
| `variants` (string keys + inheritance)                    | Supported                       |
| `whileHover` / `whileTap` / `whileFocus` / `whileInView`  | Supported                       |
| Drag (`drag`, constraints, momentum, controls, callbacks) | Supported                       |
| `AnimatePresence` (`initial`, `mode`, `onExitComplete`)   | Supported                       |
| Layout (`layout`, `layout="position"`)                    | Supported (single-element FLIP) |
| Shared layout (`layoutId`)                                | Supported                       |
| Pan gesture API (`whilePan`, `onPan*`)                    | Not yet supported               |
| `MotionConfig` parity beyond `transition`                 | Partial                         |
| `reducedMotion`, `features`, `transformPagePoint`         | Not yet supported               |

## Supported elements

Motion components are generated from canonical HTML/SVG tag lists and exported from `src/lib/html/`.

- `motion.div`, `motion.button`, `motion.svg`, `motion.path`, etc.
- Most standard tags are included.
- Excluded by generation: `script`, `style`, `link`, `meta`, `title`, `head`, `html`, `body`.

## Core components

### `motion.<tag>`

Use motion components the same way you use regular elements, with animation props:

```svelte
<motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
/>
```

### `MotionConfig`

`MotionConfig` currently supports default `transition` values for descendants.

```svelte
<script lang="ts">
    import { MotionConfig, motion } from '@humanspeak/svelte-motion'
</script>

<MotionConfig transition={{ duration: 0.4 }}>
    <motion.div animate={{ scale: 1.05 }} />
</MotionConfig>
```

### `AnimatePresence`

Exit animations on unmount with support for `mode="sync" | "wait" | "popLayout"` and `onExitComplete`.

```svelte
<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    let show = $state(true)
</script>

<AnimatePresence mode="wait" onExitComplete={() => console.log('done')}>
    {#if show}
        <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        />
    {/if}
</AnimatePresence>

<motion.button whileTap={{ scale: 0.97 }} onclick={() => (show = !show)}>Toggle</motion.button>
```

Notes:

- Direct children of `AnimatePresence` require `key`.
- Exit transition precedence: base `{ duration: 0.35 }` < merged `transition` < `exit.transition`.

## Interaction props

### `whileHover`

```svelte
<motion.button whileHover={{ scale: 1.05, transition: { duration: 0.12 } }} />
```

- Uses true-hover gating (`(hover: hover)` and `(pointer: fine)`).
- Supports `onHoverStart` and `onHoverEnd`.

### `whileTap`

```svelte
<motion.button whileTap={{ scale: 0.95 }} />
```

- Supports `onTapStart`, `onTap`, `onTapCancel`.
- Keyboard accessible (Enter/Space).

### `whileFocus`

```svelte
<motion.button whileFocus={{ scale: 1.05, outline: '2px solid blue' }} />
```

- Supports `onFocusStart` and `onFocusEnd`.

### `whileInView`

```svelte
<motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    onInViewStart={() => console.log('entered')}
    onInViewEnd={() => console.log('left')}
/>
```

- Uses `IntersectionObserver`.
- Current implementation uses a fixed threshold behavior (no Framer-style `viewport` options yet).

## Drag

Supported drag props:

- `drag`: `true | 'x' | 'y'`
- `dragConstraints`: pixel object or element ref
- `dragElastic`, `dragMomentum`, `dragTransition`
- `dragDirectionLock`, `dragPropagation`, `dragSnapToOrigin`
- `dragListener`, `dragControls`
- `whileDrag`
- Callbacks: `onDragStart`, `onDrag`, `onDragEnd`, `onDirectionLock`, `onDragTransitionEnd`

```svelte
<script lang="ts">
    import { createDragControls, motion } from '@humanspeak/svelte-motion'

    const controls = createDragControls()
</script>

<button onpointerdown={(e) => controls.start(e)}>Start drag</button>

<motion.div
    drag="x"
    dragControls={controls}
    dragListener={false}
    dragConstraints={{ left: -120, right: 120 }}
    whileDrag={{ scale: 1.03 }}
/>
```

## Variants

```svelte
<script lang="ts">
    import { motion, type Variants } from '@humanspeak/svelte-motion'

    let open = $state(false)

    const parent: Variants = {
        open: { opacity: 1 },
        closed: { opacity: 0 }
    }

    const child: Variants = {
        open: { x: 0, opacity: 1 },
        closed: { x: -16, opacity: 0 }
    }
</script>

<motion.ul variants={parent} initial="closed" animate={open ? 'open' : 'closed'}>
    <motion.li variants={child}>Item A</motion.li>
    <motion.li variants={child}>Item B</motion.li>
</motion.ul>
```

- String variant keys are resolved from `variants`.
- Variant state inherits through context.

## Layout animation

Single-element FLIP layout animation:

```svelte
<motion.div layout />
<motion.div layout="position" />
```

- `layout`: translate + scale.
- `layout="position"`: translate only.
- Shared layout (`layoutId`) is not implemented yet.

## Utilities

- `useAnimationFrame`
- `useMotionTemplate`
- `useSpring`
- `useTime`
- `useTransform`
- `useVelocity`
- `styleString`
- `stringifyStyleObject` (deprecated)
- `createDragControls`

The package also re-exports core helpers from `motion` (for example `animate`, `stagger`, `transform`, easings, and utility functions).

## SSR behavior

- Initial visual state is rendered server-side from `initial` (or first `animate` keyframe when `initial` is empty).
- `initial={false}` skips initial enter animation.
- Hydration path is designed to avoid flicker.

## Verification snapshot

Validated against current source and test suite (local run):

- Unit/component tests: `259 passed`
- E2E tests: `78 passed`, `1 skipped`

## Known gaps vs Framer Motion

- No shared layout API (`layoutId`, `LayoutGroup`).
- No pan gesture API (`whilePan`, `onPan*`).
- `whileInView` does not yet expose Framer-style viewport options.
- `MotionConfig` currently only provides `transition` defaults.
- `reducedMotion`, `features`, and `transformPagePoint` are not implemented.

## External dependencies

- `motion`
- `motion-dom`

## License

MIT © [Humanspeak, Inc.](LICENSE)

## Credits

Made with ❤️ by [Humanspeak](https://humanspeak.com)
