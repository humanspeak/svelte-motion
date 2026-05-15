<script lang="ts">
    import ComparisonPage from '$lib/components/general/ComparisonPage.svelte'
    import type { PageData } from './$types'

    const { data }: { data: PageData } = $props()
</script>

<ComparisonPage competitor={data.competitor} />
