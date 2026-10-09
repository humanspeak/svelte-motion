---
'@humanspeak/svelte-motion': patch
---

`animateView` now accepts a concise assignment as its update, such as `animateView(() => (open = true))`, as its docs show. The update was typed `() => void | Promise<void>`, which TypeScript rejects for an arrow that returns the assigned value. It now accepts any return value; a returned promise is still awaited before the new view is captured.
