---
'@humanspeak/svelte-motion': minor
---

Bring Reorder behavior in line with Motion 13.1, including wrapped grids, RTL dragging, continuous sibling layout animation, and automatic axis detection when `axis` is omitted. Omitting `axis` previously retained the documented vertical lock, so horizontal consumers that relied on that default should now pass `axis="y"` explicitly.

Bind every top-level SVG MotionValue prop and restore exact final values for accelerated SVG `opacity`, `transform`, and motion-offset styles.
