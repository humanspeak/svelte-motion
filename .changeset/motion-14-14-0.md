---
'@humanspeak/svelte-motion': minor
---

Update Motion and motion-dom to 14.14.0. What arrives with the update:

- `mass: "auto"` is accepted on spring transitions. In a layout animation it sets the spring's mass from the element's size, so bigger elements move heavier.
- `pinch`: a drag that starts while the element is snapping back to its limits no longer stops scale and rotate.
