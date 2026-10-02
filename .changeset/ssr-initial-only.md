---
'@humanspeak/svelte-motion': patch
---

Server-rendered motion elements now start from `initial`, not from their `animate` target, matching Framer Motion. Elements with `animate` but no `initial` now animate on the first server-rendered load instead of appearing at their final state. Use `initial={false}` to start at the `animate` values.
