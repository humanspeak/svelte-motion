---
'@humanspeak/svelte-motion': patch
---

Cancel queued and running clone exits when their AnimatePresence boundary unmounts. Remove exit clones and layout placeholders immediately so SvelteKit navigation does not leave departing content over the destination page, while preserving normal exits inside a mounted boundary.

Preserve unitless line-height inheritance when freezing exit-clone styles so nested text and CSS-generated captions keep their spacing and scale correctly during font-size exits.
