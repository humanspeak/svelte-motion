<!--
  Thin re-skin layer over docs-kit's `EmbeddedExampleV2`. Existing
  consumers (~17 doc pages) keep their `<Example file=... exampleUrl=...
  title=...>` invocation; this wrapper translates those props into the
  upstream component so all docs pages immediately pick up the brutalist
  bar styling.

  `isSmall` is retained in the prop type for backward compatibility but
  is now a no-op — the embedded variant has a single consistent size.
-->
<script lang="ts">
    import { EmbeddedExampleV2 } from '@humanspeak/docs-kit'
    import { exampleSourceUrl } from '$lib/docs-config'
    import type { Snippet } from 'svelte'

    type ExampleProps = {
        children: Snippet
        /** Deprecated — no longer affects sizing. Kept to avoid breaking
         *  existing consumers; can be removed in a future cleanup PR. */
        isSmall?: boolean
        /** Filename inside `docs/src/lib/examples/` (e.g. `HoverAndTap.svelte`).
         *  Becomes the `source` link in the bar. */
        file?: string
        /** Standalone `/examples/...` route this demo also lives at — surfaces
         *  as the `open` link in the bar. */
        exampleUrl?: string
        title?: string
    }

    const { children, file, exampleUrl, title }: ExampleProps = $props()

    const sourceUrl = $derived(file ? exampleSourceUrl(file) : undefined)
    const filename = $derived(file ? file.split('/').pop() : undefined)
</script>

<EmbeddedExampleV2 {exampleUrl} {sourceUrl} {filename} label={title}>
    {@render children()}
</EmbeddedExampleV2>
