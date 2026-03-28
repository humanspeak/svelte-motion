# CLAUDE.md

## Project Overview

`@humanspeak/svelte-motion` — A Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.

- **Package**: `@humanspeak/svelte-motion`
- **Homepage**: <https://motion.svelte.page>
- **Repository**: <https://github.com/humanspeak/svelte-motion>

## Notes

## AnimatePresence wait mode

- When enter is deferred in `mode="wait"`, mark the enter animation as already handled
  before flipping `isLoaded` to `ready`. Otherwise the ready-state effects can re-run
  enter and cause a visible "pop" after the deferred animation completes.
- For object-based `animate` props, also set `objectAnimateRanOnMount` and
  `lastAnimatePropJson` when unblocking, to prevent duplicate runs.

## Docs parity: MultiStateBadge example

- Match the motion.dev example: `AnimatePresence mode="sync"` is only used in the label.
- The icon `AnimatePresence` should use default mode (no explicit `mode` prop).
