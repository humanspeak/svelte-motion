<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import MotionPath from '$lib/examples/MotionPath.svelte'

    let { data } = $props()

    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Motion Path' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Motion Path | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl ?? undefined}>
    <MotionPath />
</Example>
