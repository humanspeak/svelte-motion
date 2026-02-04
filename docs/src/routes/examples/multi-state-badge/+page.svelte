<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import MultiStateBadgeExample from '$lib/examples/MultiStateBadgeExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Multi-State Badge' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Multi-State Badge | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl ?? undefined}>
    <MultiStateBadgeExample />
</Example>
