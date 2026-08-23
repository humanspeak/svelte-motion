---
'@humanspeak/svelte-motion': patch
---

Require `motion` and `motion-dom` 13.1.1 so `animateTarget` no longer reads `window` in SSR and other non-browser runtimes.
