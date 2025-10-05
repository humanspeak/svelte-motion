<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import Rotate from '$lib/examples/Rotate.svelte'

    // Placeholder canvas; hook up live example later.
    let { data } = $props()
    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Rotate' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Rotate | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl}>
    <Rotate />
</Example>
