/**
 * SPIKE 006 (spike/upstream-drag only, never merged): internal switch that
 * routes `drag` through motion-dom's `VisualElementDragControls` instead of
 * svelte-motion's own `attachDrag`.
 *
 * Set `VITE_UPSTREAM_DRAG=1` at build time to turn it on. Not a public prop.
 */
export const USE_UPSTREAM_DRAG: boolean = import.meta.env.VITE_UPSTREAM_DRAG === '1'
