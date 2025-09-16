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

All standard HTML elements are supported as motion components (e.g., `motion.div`, `motion.button`). See the full set in `src/lib/html/`.

## Configuration

### MotionConfig

This package includes support for `MotionConfig`, which allows you to set default motion settings for all child components. See the [Reach - Motion Config](https://motion.dev/docs/react-motion-config) for more details.

```svelte
<MotionConfig transition={{ duration: 0.5 }}>
    <!-- All motion components inside will inherit these settings -->
    <motion.div animate={{ scale: 1.2 }}>Inherits 0.5s duration</motion.div>
</MotionConfig>
```

#### Current Limitations

Some Motion features are not yet implemented:

- `reducedMotion` settings
- `features` configuration
- Performance optimizations like `transformPagePoint`
- Advanced transition controls
- `layout`/`layoutId` (FLIP) — prototype planned

We're actively working on adding these features. Check our GitHub issues for progress updates or to contribute.

## External Dependencies

This package carefully selects its dependencies to provide a robust and maintainable solution:

### Core Dependencies

- **motion**
    - High-performance animation library for the web
    - Provides smooth, hardware-accelerated animations
    - Supports spring physics and custom easing
    - Used for creating fluid motion and transitions

### Examples

| Motion                                                                                                   | Demo / Route                      | REPL                                                                                           |
| -------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| [React - Enter Animation](https://examples.motion.dev/react/enter-animation)                             | `/tests/motion/enter-animation`   | [View Example](https://svelte.dev/playground/7f60c347729f4ea48b1a4590c9dedc02?version=5.20.2)  |
| HTML Content (0→100 counter)                                                                             | `/tests/motion/html-content`      | [View Example](https://svelte.dev/playground/31cd72df4a3242b4b4589501a25e774f?version=5.38.10) |
| [Random - Shiny Button](https://www.youtube.com/watch?v=jcpLprT5F0I) by [@verse\_](https://x.com/verse_) | `/tests/random/shiny-button`      | [View Example](https://svelte.dev/playground/96f9e0bf624f4396adaf06c519147450?version=5.38.10) |
| [Fancy Like Button](https://github.com/DRlFTER/fancyLikeButton)                                          | `/tests/random/fancy-like-button` | [View Example](https://svelte.dev/playground/c34b7e53d41c48b0ab1eaf21ca120c6e?version=5.38.10) |

## License

MIT © [Humanspeak, Inc.](LICENSE)

## Credits

Made with ❤️ by [Humanspeak](https://humanspeak.com)
