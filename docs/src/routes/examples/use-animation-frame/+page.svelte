<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseAnimationFrameExample from '$lib/examples/UseAnimationFrameExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useAnimationFrame' }
            ]
        }
    })
</script>

<svelte:head>
    <title>useAnimationFrame | Examples | Svelte Motion</title>
</svelte:head>

<Example title="useAnimationFrame" motionUrl={data.sourceUrl}>
    <UseAnimationFrameExample />
</Example>
