---
'@humanspeak/svelte-motion': major
---

Update Motion and motion-dom to 14.0.0. svelte-motion 2.x tracks Motion 14, as version numbers mirror upstream.

`motion` and `motion-dom` are now pinned to the same exact version. Motion 14 pins its own internal packages (`framer-motion`, `motion-dom`, `motion-utils`) exactly, so a looser range here could install a second copy of motion-dom and split its shared state.

Motion 14 removes internal compatibility APIs that 13.5.1 had restored temporarily (`observeTimeline`, and `rangeStart`/`rangeEnd` on `attachTimeline`). svelte-motion's public API is unchanged.
