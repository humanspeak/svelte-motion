---
'@humanspeak/svelte-motion': patch
---

`snapToCursor` now measures the element's live box and maps the pointer through `transformPagePoint`, matching Motion 13.4.5. Repeated snaps with initial coordinates no longer drift, and scaled parents snap exactly like React.
