<script lang="ts">
    import { ComparisonPageV2, type CompareSlugLoadData } from '@humanspeak/docs-kit'
    import { competitors, ours } from '$lib/compare-data'
    import posthog from 'posthog-js'
    import { browser } from '$app/environment'

    const { data }: { data: CompareSlugLoadData } = $props()
    const others = $derived(competitors.filter((c) => c.slug !== data.competitor.slug))

    $effect(() => {
        if (browser) {
            posthog.capture('compare_page_viewed', { competitor: data.competitor.slug })
        }
    })
</script>

<ComparisonPageV2 competitor={data.competitor} {others} {ours} getStartedHref="/docs" />
