---
'@humanspeak/svelte-motion': patch
---

`svelteMotionOptimize()` no longer removes `import { motion }` when a template expression still uses it, such as `<W as={motion.span} />` or `<svelte:component this={motion.span} />`, which threw `motion is not defined` with the plugin on. HTML and CSS comments that mention `motion` no longer keep the full import.
