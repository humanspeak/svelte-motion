<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import HoverAndTap from '$lib/examples/HoverAndTap.svelte'

    // Placeholder canvas; hook up live example later.
    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Hover and Tap' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Hover and Tap | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl}>
    <HoverAndTap />
</Example>
