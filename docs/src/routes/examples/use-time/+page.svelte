<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseTimeExample from '$lib/examples/UseTimeExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useTime' }
            ]
        }
    })
</script>

<svelte:head>
    <title>useTime | Examples | Svelte Motion</title>
</svelte:head>

<Example title="useTime" motionUrl={data.sourceUrl}>
    <UseTimeExample />
</Example>
