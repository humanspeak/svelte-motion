# CLAUDE Notes

## AnimatePresence wait mode

- When enter is deferred in `mode="wait"`, mark the enter animation as already handled
  before flipping `isLoaded` to `ready`. Otherwise the ready-state effects can re-run
  enter and cause a visible "pop" after the deferred animation completes.
- For object-based `animate` props, also set `objectAnimateRanOnMount` and
  `lastAnimatePropJson` when unblocking, to prevent duplicate runs.

## Docs parity: MultiStateBadge example

- Match the motion.dev example: `AnimatePresence mode="sync"` is only used in the label.
- The icon `AnimatePresence` should use default mode (no explicit `mode` prop).
