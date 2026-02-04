<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import ColorInterpolationExample from '$lib/examples/ColorInterpolationExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Color Interpolation' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Color Interpolation | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl}>
    <ColorInterpolationExample />
</Example>
