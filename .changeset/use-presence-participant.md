---
'@humanspeak/svelte-motion': patch
---

**Behaviour change (Motion parity):** an owned presence wrapper (`<AnimatePresence present>` + `child`, or `<PresenceChild>`) with nothing registered now leaves as soon as its exit starts and fires `onExitComplete` once. This includes plain elements and `m` components without `LazyMotion` features. Previously it stayed mounted until a manual `safeToRemove` that nothing called.

**API usage change:** call `usePresence()` once at component init (`const presence = usePresence()`) and read `presence` in `$effect` or the template. It registers the component with its wrapper; its `safeToRemove` now completes only this component, and the wrapper leaves when every participant (including motion exits) is done. `$derived(usePresence())` still works with the old rules (`safeToRemove` releases the whole wrapper), but is deprecated and warns once per wrapper in development.
