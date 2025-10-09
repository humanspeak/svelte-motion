<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import Reordering from '$lib/examples/Reordering.svelte'

    let { data } = $props()

    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Reordering' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Reordering | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl}>
    <Reordering />
</Example>
