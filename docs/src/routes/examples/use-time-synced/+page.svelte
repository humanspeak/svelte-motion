<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseTimeSyncedExample from '$lib/examples/UseTimeSyncedExample.svelte'

    let { data } = $props()
    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useTime (Synced)' }
            ]
        }
    })
</script>

<Example motionUrl={data.sourceUrl}>
    <UseTimeSyncedExample />
</Example>
