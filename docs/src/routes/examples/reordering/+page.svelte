<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import Reordering from '$lib/examples/Reordering.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Reordering' }
            ]
        }
        if (seo) {
            seo.title = 'Reordering | Examples | Svelte Motion'
            seo.description =
                'Drag-to-reorder list items with smooth layout animations using Svelte Motion. Demonstrates drag gestures and automatic layout transitions.'
        }
    })
</script>

<Example title="Reordering" motionUrl={data.sourceUrl}>
    <Reordering />
</Example>
