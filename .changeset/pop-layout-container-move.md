---
'@humanspeak/svelte-motion': patch
---

`mode="popLayout"` exits now stay where they were when popping them moves their container (a bottom-anchored or centred list, a clamped scroll position, a scaled ancestor), for both owned and clone exits (Motion 14.7.0, #2348).
