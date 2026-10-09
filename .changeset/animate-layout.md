---
'@humanspeak/svelte-motion': minor
---

Add `animateLayout`, Motion 14.1's layout animations for plain elements. Tag elements with `data-layout` (or `data-layout-id` for shared-element handoffs), make the change inside the update, and each one animates from its old box to its new one. Pass a scope element first to limit which elements animate. Like `animateView`, Svelte `$state` changes made inside the update are flushed to the DOM before the new layout is measured, so plain assignment works.
