---
'@humanspeak/svelte-motion': minor
---

`LayoutGroup` now owns a projection node group like Motion: members animate together when any member changes or unmounts, `inherit="id"` and `inherit={false}` start a separate group whose nodes follow their parent instead of re-animating, and scoped `layoutId`s use Motion's `group-id` separator.
