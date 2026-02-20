<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseTimeSyncedExample from '$lib/examples/UseTimeSyncedExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useTime (Synced)' }
            ]
        }
        if (seo) {
            seo.title = 'useTime (Synced) | Examples | Svelte Motion'
            seo.description =
                'Synchronized time-based animations across multiple elements using a shared Svelte Motion useTime store for coordinated motion effects.'
        }
    })
</script>

<Example title="useTime (Synced)" motionUrl={data.sourceUrl}>
    <UseTimeSyncedExample />
</Example>
