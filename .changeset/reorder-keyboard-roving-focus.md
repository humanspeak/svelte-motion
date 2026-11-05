---
'@humanspeak/svelte-motion': minor
---

**Behaviour change (Motion 14.9 parity):** a `Reorder.Group` is now one tab stop: Tab reaches the first item, or the one focused last, and arrow keys move focus between items. Space still grabs and drops, and arrows move a grabbed item. In a grid (`axis="xy"`), Up and Down move by the row as drawn. A `tabindex` on an item still overrides this.
