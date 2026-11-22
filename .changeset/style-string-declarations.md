---
'@humanspeak/svelte-motion': patch
---

String `style` props on `motion.*` elements no longer break on a `;` inside a value (data URIs, quoted strings, comments), and CSS fallback pairs such as `height: 100vh; height: 100dvh` now reach the element intact instead of collapsing to the last declaration.
