---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.6.0. What arrives with the update:

- `processFrame` is re-exported. Call it to process a Motion frame right away, so you can drive Motion from a loop other than `requestAnimationFrame`, like a WebXR `renderer.setAnimationLoop` callback or a custom render loop. With `MotionGlobalConfig.useManualTiming = true`, pass each frame's time in milliseconds to step a timeline you control.
- `Reorder` groups with `axis="x"` whose items wrap onto several rows no longer leave a stray vertical offset on an item after it is dragged into another row (#2255). More generally, a drag now compensates layout changes only on the axes it drags, so a non-drag axis follows its layout.
- Shared `layoutId` elements that also animate `scale` no longer apply it twice during the handoff (#2284).
- A `useTransform` that combines several values now sees chained transform updates in the same frame (#2280).
- Stopping an instant WAAPI animation that has finished but not yet reported it now stops it cleanly.
- Layout children keep animating alongside a card whose drag ended mid-render.
