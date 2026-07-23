<!--
  @component
  Examples-gallery pager: docs-kit's `PagerV2` wired to the canonical
  examples order from `$lib/examplesIndex`, so its `№` numbering always
  agrees with the index grid. Renders nothing outside example detail
  routes, so the examples layout can mount it unconditionally.
-->
<script lang="ts">
    import { PagerV2 } from '@humanspeak/docs-kit'
    import { listExamples } from '$lib/examplesIndex'

    const items = listExamples().map((example) => ({
        href: example.route,
        label: `${example.slug}.`
    }))
</script>

<PagerV2 {items} ariaLabel="Example pagination" />
