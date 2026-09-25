---
'@humanspeak/svelte-motion': patch
---

Wait for every independent motion descendant to finish exiting before automatically removing an owned presence wrapper. Preserve explicit manual removal and cancelled-exit guards, and include descendants mounted during an active exit.

Restore retained descendants when shown after their exit finishes, including children with initial animations disabled.
