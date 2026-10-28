---
'@humanspeak/svelte-motion': patch
---

`mode="popLayout"` exits now stay where they were when popping them moves their container: a bottom-anchored or centred list, a scaled ancestor, or a page scroll position (including a fixed container's page) that is clamped because the content got shorter. This applies to both owned and clone exits (Motion 14.7.0, #2348). Scrollable elements other than the page follow in a later fix.
