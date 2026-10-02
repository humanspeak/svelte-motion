---
'@humanspeak/svelte-motion': patch
---

Update Motion and motion-dom to 13.5.1. `svgEffect` now writes transform and transform-origin keys that aren't CSS properties (for example `scaleX` and `originX`) as CSS instead of SVG attributes, matching Motion. Use `attrX`/`attrY` for the attributes.
